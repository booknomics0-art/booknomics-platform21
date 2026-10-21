import { corsHeaders } from "../_shared/security.ts";
import { PRICE, provider, adminClient, authenticatedUser, config, signed, time } from "../_shared/razorpay-billing.ts";
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  const user = await authenticatedUser(req);
  if (!user) return json(req, { error: "Unauthorized" }, 401);
  try {
    const body = await req.json();
    const id = body?.razorpay_subscription_id;
    const payId = body?.razorpay_payment_id;
    const sig = body?.razorpay_signature;
    if (![id, payId, sig].every((v) => typeof v === "string") ||
      !/^sub_[A-Za-z0-9]+$/.test(id) || !/^pay_[A-Za-z0-9]+$/.test(payId))
      return json(req, { error: "Invalid payment callback" }, 400);

    const db = adminClient();
    const { data: row, error: readError } = await db.from("subscriptions").select("*")
      .eq("razorpay_subscription_id", id).eq("user_id", user.id).maybeSingle();
    if (readError || !row || !PRICE[row.plan]) return json(req, { error: "Subscription not found" }, 404);
    if (!await signed(config().secret, payId + "|" + row.razorpay_subscription_id, sig))
      return json(req, { error: "Invalid signature" }, 403);

    const [subscription, payment] = await Promise.all([
      provider("subscriptions/" + id), provider("payments/" + payId),
    ]);
    // Mandate authorisation alone is not proof of a paid billing period.
    const paid = payment.status === "captured" && (!payment.subscription_id || payment.subscription_id === id) &&
      payment.amount === PRICE[row.plan].amount && payment.currency === "INR" &&
      subscription.paid_count > 0 && !!time(subscription.current_end);
    if (!paid) return json(req, { ok: true, activated: false, message: "Mandate authorised. Waiting for the first subscription charge." });
    const expiry = time(subscription.current_end);
    if (!expiry || new Date(expiry) <= new Date()) return json(req, { ok: false, error: "Paid period not available" }, 409);
    const { error } = await db.from("subscriptions").update({
      status: "active", starts_at: time(subscription.current_start) || new Date().toISOString(),
      expires_at: expiry, provider_status: subscription.status,
      razorpay_payment_id: payId,
    }).eq("id", row.id);
    if (error) throw error;
    return json(req, { ok: true, activated: true, expires_at: expiry });
  } catch (error) {
    console.error("Subscription confirmation failed", String(error));
    return json(req, { error: "Confirmation pending; access will update after the verified webhook." }, 503);
  }
});
