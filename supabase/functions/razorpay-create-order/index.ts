import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const PLANS: Record<string, { amount: number; days: number }> = {
  weekly:    { amount: 1900,  days: 7 },
  monthly:   { amount: 6900,  days: 30 },
  quarterly: { amount: 19900, days: 90 },
};

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
    // Trim to avoid stray whitespace/newlines from copy-paste that break Basic auth
    const KEY_ID = (Deno.env.get("RAZORPAY_KEY_ID") ?? "").trim();
    const KEY_SECRET = (Deno.env.get("RAZORPAY_KEY_SECRET") ?? "").trim();
    if (!KEY_ID || !KEY_SECRET) {
      console.error("Razorpay credentials missing", { hasKeyId: !!KEY_ID, hasKeySecret: !!KEY_SECRET });
      return json(req, { error: "Razorpay credentials missing" }, 500);
    }
    if (!/^rzp_(test|live)_/.test(KEY_ID)) {
      console.error("RAZORPAY_KEY_ID has invalid format", { prefix: KEY_ID.slice(0, 8) });
      return json(req, { error: "Razorpay key id has invalid format (must start with rzp_test_ or rzp_live_)" }, 500);
    }
    const keyMode = KEY_ID.startsWith("rzp_live_") ? "live" : "test";

    const authed = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userErr } = await authed.auth.getUser();
    if (userErr || !userData.user) return json(req, { error: "Unauthorized" }, 401);
    const user = userData.user;

    const rl = checkRateLimit(`rzp-order:${user.id}`, 30, 60 * 60);
    if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

    const body = await req.json().catch(() => ({}));
    const plan = String(body?.plan ?? "");
    const cfg = PLANS[plan];
    if (!cfg) return json(req, { error: "Invalid plan" }, 400);

    // Create Razorpay order
    const basic = btoa(`${KEY_ID}:${KEY_SECRET}`);
    const orderResp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${basic}` },
      body: JSON.stringify({
        amount: cfg.amount,
        currency: "INR",
        receipt: `bn_${user.id.slice(0, 8)}_${Date.now()}`,
        notes: { user_id: user.id, plan },
      }),
    });
    const order = await orderResp.json();
    if (!orderResp.ok || !order?.id) {
      // Log details server-side WITHOUT returning them to the client.
      const description = order?.error?.description ?? "Razorpay order failed";
      const code = order?.error?.code ?? "RAZORPAY_ERROR";
      const hint = code === "BAD_REQUEST_ERROR" && /auth/i.test(description)
        ? `Razorpay rejected the credentials. Verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are from the same account and same mode (${keyMode}).`
        : undefined;
      console.error("Razorpay order creation failed", {
        status: orderResp.status,
        keyMode,
        keyIdPrefix: KEY_ID.slice(0, 12),
        code,
        description,
        hint,
        razorpayError: order?.error ?? order,
      });
      return json(req, { error: "Razorpay order failed" }, 502);
    }

    // Persist pending subscription row
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { error: persistError } = await admin.from("subscriptions").insert({
      user_id: user.id,
      plan,
      status: "pending",
      amount: cfg.amount,
      currency: "INR",
      razorpay_order_id: order.id,
    });

    if (persistError) return json(req, { error: "Could not save payment order. Please retry." }, 500);

    return json(req, { ok: true, order_id: order.id, key_id: KEY_ID, amount: cfg.amount });
  } catch (e) {
    console.error("razorpay-create-order unexpected error", { message: String((e as any)?.message ?? e) });
    return json(req, { error: "Something went wrong" }, 500);
  }
});

function json(req: Request, b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}
