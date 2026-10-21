import { corsHeaders, checkRateLimit, rateLimitedResponse } from "../_shared/security.ts";
import { adminClient, authenticatedUser, provider } from "../_shared/razorpay-billing.ts";
const json = (req: Request, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  const user = await authenticatedUser(req);
  if (!user) return json(req, { error: "Unauthorized" }, 401);
  const rl = checkRateLimit("rzp-manage:" + user.id, 6, 60 * 60);
  if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);
  const { action, subscription_id } = await req.json().catch(() => ({}));
  if (!["cancel_at_period_end", "cancel_pending"].includes(action) || typeof subscription_id !== "string" ||
    !/^sub_[A-Za-z0-9]+$/.test(subscription_id))
    return json(req, { error: "Invalid request" }, 400);
  try {
    const db = adminClient();
    const { data: row, error } = await db.from("subscriptions").select("id,status,cancel_at_cycle_end")
      .eq("razorpay_subscription_id", subscription_id).eq("user_id", user.id).maybeSingle();
    if (error || !row) return json(req, { error: "Subscription not found" }, 404);
    if (row.cancel_at_cycle_end) return json(req, { ok: true, scheduled: true });
    if (action === "cancel_at_period_end" && row.status !== "active") return json(req, { error: "Only active subscriptions can schedule cancellation" }, 409);
    if (action === "cancel_pending" && row.status !== "pending") return json(req, { error: "Only pending mandates can be cancelled immediately" }, 409);
    // API must succeed before changing the local database; do not truncate paid access.
    const remote = await provider("subscriptions/" + subscription_id + "/cancel", {
      method: "POST", body: JSON.stringify({ cancel_at_cycle_end: action === "cancel_pending" ? 0 : 1 }),
    });
    if (!["active", "cancelled"].includes(remote?.status))
      return json(req, { error: "Unable to confirm cancellation with the payment provider" }, 503);
    const { error: updateError } = await db.from("subscriptions")
      .update({ cancel_at_cycle_end: true, provider_status: remote.status,
        ...(action === "cancel_pending" ? { status: "cancelled" } : {}) })
      .eq("id", row.id);
    if (updateError) throw updateError;
    return json(req, { ok: true, scheduled: true });
  } catch (error) {
    console.error("Subscription cancellation failed", String(error));
    return json(req, { error: "Unable to cancel. Please contact support if it persists." }, 503);
  }
});
