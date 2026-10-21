import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";
import { PRICE, provider, adminClient, authenticatedUser, config } from "../_shared/razorpay-billing.ts";

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  try {
    const user = await authenticatedUser(req);
    if (!user) return json(req, { error: "Sign in before subscribing" }, 401);
    const rate = checkRateLimit("rzp-subscribe:" + user.id, 8, 60 * 60);
    if (!rate.ok) return rateLimitedResponse(req, rate.retryAfterSeconds);
    const { plan } = await req.json().catch(() => ({}));
    if (typeof plan !== "string" || !PRICE[plan]) return json(req, { error: "Invalid plan" }, 400);
    const cfg = PRICE[plan];
    const { key } = config();
    const planId = (Deno.env.get(cfg.env) || "").trim();
    if (!/^plan_[A-Za-z0-9]+$/.test(planId)) return json(req, { error: "Subscription plan not configured" }, 503);

    const db = adminClient();
    const { data: current, error: currentError } = await db.from("subscriptions")
      .select("id, plan, status, expires_at, razorpay_subscription_id, created_at")
      .eq("user_id", user.id).not("razorpay_subscription_id", "is", null)
      .order("created_at", { ascending: false }).limit(10);
    if (currentError) throw currentError;
    // Also respect existing one-time / quarterly memberships when protecting from double billing.
    const { data: legacy, error: legacyError } = await db.from("subscriptions")
      .select("id,expires_at").eq("user_id", user.id).eq("status", "active")
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString()).limit(1);
    if (legacyError) throw legacyError;
    const active = (legacy || []).length > 0;
    if (active) return json(req, { error: "You already have a Premium subscription. Manage it from your account." }, 409);
    const pending = (current || []).find((s: any) => s.status === "pending");
    if (pending) {
      if (pending.plan !== plan) return json(req, { error: "Finish or cancel your pending mandate before changing plans. Contact billing support if it is stuck." }, 409);
      const remotePending = await provider("subscriptions/" + pending.razorpay_subscription_id);
      if (remotePending.status !== "created") return json(req, { error: "Your mandate is being processed. Check My Subscription before trying another payment." }, 409);
      return json(req, { subscription_id: pending.razorpay_subscription_id, key_id: key, plan, amount: cfg.amount });
    }

    // Do not trust an environment plan id to charge the correct price or cycle.
    const remotePlan = await provider("plans/" + planId);
    if (remotePlan.period !== cfg.period || remotePlan.interval !== 1 ||
        remotePlan.item?.amount !== cfg.amount || remotePlan.item?.currency !== "INR")
      return json(req, { error: "Payment plan configuration mismatch" }, 503);

    const subscription = await provider("subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId, total_count: cfg.count, quantity: 1,
        customer_notify: 1, notes: { user_id: user.id, booknomics_plan: plan },
      }),
    });
    if (!/^sub_[A-Za-z0-9]+$/.test(subscription?.id || ""))
      return json(req, { error: "Subscription creation failed" }, 502);
    const { error } = await db.from("subscriptions").insert({
      user_id: user.id, plan, status: "pending", amount: cfg.amount, currency: "INR",
      razorpay_subscription_id: subscription.id, provider_status: "created",
    });
    if (error) {
      console.error("Subscription persistence failed", error.message);
      // Never expose an untracked subscription to checkout; operations can reconcile in Razorpay.
      return json(req, { error: "Could not prepare subscription. Contact support before retrying." }, 503);
    }
    return json(req, { subscription_id: subscription.id, key_id: key, plan, amount: cfg.amount });
  } catch (e) {
    console.error("Subscription setup failed", String(e));
    return json(req, { error: "Unable to start checkout. Please retry." }, 503);
  }
});
