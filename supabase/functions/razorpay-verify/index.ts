import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const PLAN_DAYS: Record<string, number> = { weekly: 7, monthly: 30, quarterly: 90 };

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json(req, { error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
    const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
    if (!KEY_SECRET || !KEY_ID) return json(req, { error: "Razorpay not configured" }, 500);

    const authed = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userErr } = await authed.auth.getUser();
    if (userErr || !userData.user) return json(req, { error: "Unauthorized" }, 401);
    const user = userData.user;

    const rl = checkRateLimit(`rzp-verify:${user.id}`, 30, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json(req, { error: "Missing payment fields" }, 400);
    }

    if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every(v => typeof v === 'string') ||
        !/^order_[A-Za-z0-9]+$/.test(razorpay_order_id) || !/^pay_[A-Za-z0-9]+$/.test(razorpay_payment_id) ||
        !/^[0-9a-f]{64}$/i.test(razorpay_signature)) return json(req, { error: 'Invalid payment fields' }, 400);
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(KEY_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const signature = Uint8Array.from(razorpay_signature.match(/../g)!, (hex: string) => parseInt(hex, 16));
    const valid = await crypto.subtle.verify('HMAC', key, signature, enc.encode(`${razorpay_order_id}|${razorpay_payment_id}`));
    if (!valid) return json(req, { error: 'Invalid signature' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Find the pending subscription for this order belonging to this user
    const { data: sub, error: readError } = await admin
      .from("subscriptions")
      .select("id,plan,user_id,status,amount,currency,razorpay_payment_id,expires_at")
      .eq("razorpay_order_id", razorpay_order_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) return json(req, { error: "Could not verify order" }, 500);
    if (!sub) return json(req, { error: "Order not found" }, 404);

    // A valid replay returns the original entitlement; it never extends expiry.
    if (sub.status !== 'pending') {
      if (sub.razorpay_payment_id === razorpay_payment_id)
        return json(req, { ok: true, plan: sub.plan, expires_at: sub.expires_at });
      return json(req, { error: 'Order already processed' }, 409);
    }
    const days = PLAN_DAYS[sub.plan];
    if (!days) return json(req, { error: 'Unsupported plan' }, 400);
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { Authorization: `Basic ${btoa(`${KEY_ID}:${KEY_SECRET}`)}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!paymentResponse.ok) return json(req, { error: 'Payment provider verification unavailable' }, 502);
    const payment = await paymentResponse.json();
    if (payment.status !== 'captured' || payment.order_id !== razorpay_order_id ||
        payment.amount !== sub.amount || payment.currency !== sub.currency)
      return json(req, { error: 'Payment not captured or order mismatch. Please retry after capture.' }, 409);

    const now = new Date();
    const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const { data: activated, error: upErr } = await admin.from("subscriptions").update({
      status: "active",
      razorpay_payment_id,
      starts_at: now.toISOString(),
      expires_at: expires.toISOString(),
    }).eq("id", sub.id).eq("status", "pending").select("expires_at").maybeSingle();
    if (upErr) {
      console.error("razorpay-verify update failed:", upErr.message);
      return json(req, { error: "Failed to activate subscription" }, 500);
    }

    if (!activated) {
      const { data: current, error } = await admin.from('subscriptions')
        .select('razorpay_payment_id,expires_at').eq('id', sub.id).maybeSingle();
      if (error || current?.razorpay_payment_id !== razorpay_payment_id)
        return json(req, { error: 'Order processing conflict. Please retry.' }, 409);
      return json(req, { ok: true, plan: sub.plan, expires_at: current.expires_at });
    }
    return json(req, { ok: true, plan: sub.plan, expires_at: activated.expires_at });
  } catch (e) {
    console.error("razorpay-verify error:", e);
    return json(req, { error: "Something went wrong" }, 500);
  }
});

function json(req: Request, b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}
