// Cloudflare Workers + D1 implementation. No Supabase billing dependency.
type D1 = any;
type Env = {
  DB?: D1;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  RAZORPAY_WEEKLY_PLAN_ID?: string;
  RAZORPAY_MONTHLY_PLAN_ID?: string;
};
type PaidPlan = "weekly" | "monthly";
type User = { id: string; email: string };
type Subscription = {
  id: string; user_id: string; plan: string; amount: number; status: string;
  razorpay_subscription_id: string | null; razorpay_payment_id: string | null;
  provider_status: string | null; expires_at: string | null;
  starts_at: string | null; last_provider_event_at: string | null;
  cancel_at_cycle_end: number;
};
const bytes = new TextEncoder();
const AMOUNTS: Record<PaidPlan, number> = { weekly: 1900, monthly: 4900 };
const CYCLES: Record<PaidPlan, number> = { weekly: 52, monthly: 12 };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
const text = (message: string, status = 200) => new Response(message, { status, headers: { "cache-control": "no-store" } });
const validId = (id: unknown, prefix: string): id is string =>
  typeof id === "string" && new RegExp("^" + prefix + "_[A-Za-z0-9]+$").test(id);
const fromUnix = (seconds: unknown): string | null => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
};
function planConfig(env: Env, plan: PaidPlan) {
  return { id: plan === "weekly" ? env.RAZORPAY_WEEKLY_PLAN_ID : env.RAZORPAY_MONTHLY_PLAN_ID, amount: AMOUNTS[plan] };
}
function liveCredentials(env: Env) {
  if (!env.RAZORPAY_KEY_ID?.startsWith("rzp_live_") || !env.RAZORPAY_KEY_SECRET) return null;
  return { key: env.RAZORPAY_KEY_ID, secret: env.RAZORPAY_KEY_SECRET };
}
async function verifyHmac(secret: string, message: string, hex: string) {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return false;
  const key = await crypto.subtle.importKey("raw", bytes.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signature = Uint8Array.from(hex.match(/.{2}/g) || [], (pair) => parseInt(pair, 16));
  return crypto.subtle.verify("HMAC", key, signature, bytes.encode(message));
}
async function razorpay(env: Env, path: string, method = "GET", payload?: unknown): Promise<any> {
  const creds = liveCredentials(env);
  if (!creds) throw new Error("Razorpay Live Mode is not configured");
  const response = await fetch("https://api.razorpay.com/v1/" + path, {
    method,
    headers: { authorization: "Basic " + btoa(creds.key + ":" + creds.secret), ...(payload ? { "content-type": "application/json" } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Razorpay API returned", response.status, data?.error?.code || "unknown");
    throw new Error("Payment provider returned " + response.status);
  }
  return data;
}
function sessionToken(req: Request) {
  const raw = (req.headers.get("cookie") || "").split(";").map((v) => v.trim()).find((v) => v.startsWith("bn_session="));
  if (!raw) return null;
  try { return decodeURIComponent(raw.slice("bn_session=".length)); } catch { return null; }
}
async function userFromSession(req: Request, db: D1): Promise<User | null> {
  const token = sessionToken(req);
  if (!token) return null;
  const digest = await crypto.subtle.digest("SHA-256", bytes.encode(token));
  const hash = Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("");
  const row = await db.prepare(
    "SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now') LIMIT 1"
  ).bind(hash).first();
  return row as User | null;
}
function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin browser requests may omit Origin; session is SameSite=Lax.
  const url = new URL(req.url);
  return origin === url.origin && url.protocol === "https:";
}
async function ownSubscriptions(db: D1, userId: string): Promise<Subscription[]> {
  const result = await db.prepare(
    "SELECT id,user_id,plan,status,amount,currency,razorpay_subscription_id,razorpay_payment_id,provider_status,expires_at,starts_at,created_at,cancel_at_cycle_end,last_provider_event_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20"
  ).bind(userId).all();
  return result.results || [];
}
async function verifyProviderPlan(env: Env, plan: PaidPlan) {
  const cfg = planConfig(env, plan);
  if (!validId(cfg.id, "plan")) throw new Error("Live billing plan is missing");
  const remote = await razorpay(env, "plans/" + encodeURIComponent(cfg.id));
  if (remote.id !== cfg.id || remote.period !== plan || Number(remote.interval) !== 1 ||
      Number(remote.item?.amount) !== cfg.amount || remote.item?.currency !== "INR") {
    throw new Error("Razorpay Live plan amount or billing frequency mismatch");
  }
  return cfg;
}
async function createSubscription(req: Request, env: Env, user: User) {
  if (!liveCredentials(env)) return json({ error: "Live billing is not configured" }, 503);
  const body = await req.json().catch(() => null) as { plan?: string } | null;
  if (body?.plan !== "weekly" && body?.plan !== "monthly") return json({ error: "Invalid plan" }, 400);
  const plan = body.plan;
  const existing = await env.DB!.prepare(
    "SELECT id,status FROM subscriptions WHERE user_id = ? AND (status IN ('creating','pending') OR (status = 'active' AND (expires_at IS NULL OR datetime(expires_at) > datetime('now')))) LIMIT 1"
  ).bind(user.id).first();
  if (existing) return json({ error: "You already have an active or pending subscription. Open My Subscription before starting a new one." }, 409);
  const cfg = await verifyProviderPlan(env, plan);
  const recordId = crypto.randomUUID();
  const now = new Date().toISOString();
  // Reserve locally first. Unique partial D1 index guards double-click/concurrent checkout.
  try {
    await env.DB!.prepare(
      "INSERT INTO subscriptions (id,user_id,plan,status,amount,currency,created_at,updated_at,provider_status,cancel_at_cycle_end) VALUES (?,?,?,'creating',?,'INR',?,?,'creating',0)"
    ).bind(recordId,user.id,plan,cfg.amount,now,now).run();
  } catch { return json({ error: "A subscription is already being prepared; refresh My Subscription." }, 409); }
  try {
    const remote = await razorpay(env, "subscriptions", "POST", {
      plan_id: cfg.id, total_count: CYCLES[plan], quantity: 1, customer_notify: 0,
      notes: { booknomics_user_id: user.id, booknomics_subscription_id: recordId, plan },
    });
    if (!validId(remote.id, "sub") || remote.plan_id !== cfg.id) throw new Error("Invalid subscription returned by Razorpay");
    await env.DB!.prepare(
      "UPDATE subscriptions SET status='pending',provider_status=?,razorpay_subscription_id=?,updated_at=? WHERE id=? AND status='creating'"
    ).bind(String(remote.status || "created"),remote.id,new Date().toISOString(),recordId).run();
    return json({ ok: true, subscription_id: remote.id, key_id: env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.error("Subscription creation failed", String(error));
    // A remote subscription created just before a timeout may be orphaned and is never entitled automatically.
    await env.DB!.prepare("UPDATE subscriptions SET status='failed',provider_status='creation_failed',updated_at=? WHERE id=? AND status='creating'")
      .bind(new Date().toISOString(),recordId).run();
    return json({ error: "Could not create subscription. Contact support before retrying if a mandate was authorised." }, 502);
  }
}
async function confirmSubscription(req: Request, env: Env, user: User) {
  const body = await req.json().catch(() => null) as any;
  const id = body?.razorpay_subscription_id;
  const paymentId = body?.razorpay_payment_id;
  if (!validId(id, "sub") || !validId(paymentId, "pay") || typeof body?.razorpay_signature !== "string")
    return json({ error: "Invalid payment verification fields" }, 400);
  const record = await env.DB!.prepare("SELECT * FROM subscriptions WHERE razorpay_subscription_id=? AND user_id=? LIMIT 1")
    .bind(id,user.id).first() as Subscription | null;
  if (!record) return json({ error: "Subscription not found" }, 404);
  if (!liveCredentials(env)) return json({ error: "Billing credentials unavailable" }, 503);
  const sigOk = await verifyHmac(env.RAZORPAY_KEY_SECRET!, paymentId + "|" + id, body.razorpay_signature);
  if (!sigOk) return json({ error: "Invalid checkout signature" }, 401);
  const remote = await razorpay(env,"subscriptions/"+encodeURIComponent(id));
  if (remote.id !== id || remote.plan_id !== planConfig(env,record.plan as PaidPlan).id) return json({ error: "Provider subscription mismatch" }, 409);
  const payment = await razorpay(env,"payments/"+encodeURIComponent(paymentId));
  const end = fromUnix(remote.current_end);
  const charged = payment.status === "captured" && payment.currency === "INR" &&
    Number(payment.amount) === Number(record.amount) &&
    (!payment.subscription_id || payment.subscription_id === id) && !!end &&
    new Date(end) > new Date() &&
    (!record.expires_at || end >= record.expires_at);
  if (charged) {
    await env.DB!.prepare(
      "UPDATE subscriptions SET status='active',provider_status=?,razorpay_payment_id=?,starts_at=?,expires_at=?,updated_at=? WHERE id=? AND (expires_at IS NULL OR expires_at <= ?)"
    ).bind(String(remote.status || "active"),paymentId,fromUnix(remote.current_start) || new Date().toISOString(),end,new Date().toISOString(),record.id,end).run();
  }
  return json({ ok: true, activated: charged || (record.status === "active" && !!record.expires_at && new Date(record.expires_at)>new Date()) });
}
async function manageSubscription(req: Request, env: Env, user: User) {
  const body = await req.json().catch(() => null) as any;
  if (!validId(body?.subscription_id,"sub") || !["cancel_at_period_end","cancel_pending"].includes(body?.action))
    return json({ error: "Invalid cancellation request" }, 400);
  const row = await env.DB!.prepare("SELECT * FROM subscriptions WHERE razorpay_subscription_id=? AND user_id=? LIMIT 1")
    .bind(body.subscription_id,user.id).first() as Subscription | null;
  if (!row) return json({ error: "Subscription not found" }, 404);
  if (row.cancel_at_cycle_end) return json({ ok: true });
  const hasPaidAccess = row.status === "active" && !!row.expires_at && new Date(row.expires_at)>new Date();
  if (body.action === "cancel_pending" && hasPaidAccess) return json({ error: "An active subscription must be cancelled at cycle end" }, 409);
  if (body.action === "cancel_at_period_end" && !hasPaidAccess) return json({ error: "No active paid period" }, 409);
  const remote = await razorpay(env,"subscriptions/"+encodeURIComponent(body.subscription_id)+"/cancel","POST",
    { cancel_at_cycle_end: hasPaidAccess ? 1 : 0 });
  await env.DB!.prepare(
    "UPDATE subscriptions SET cancel_at_cycle_end=1, provider_status=?, status=?, updated_at=? WHERE id=?"
  ).bind(String(remote?.status || "cancelled"),hasPaidAccess?"active":"cancelled",new Date().toISOString(),row.id).run();
  return json({ ok: true, expires_at: hasPaidAccess ? row.expires_at : null });
}
const allowedEvents = new Set([
  "subscription.authenticated","subscription.activated","subscription.charged",
  "subscription.pending","subscription.halted","subscription.cancelled",
  "subscription.completed","subscription.paused","subscription.resumed","subscription.updated",
]);
async function webhook(req: Request, env: Env) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return text("Webhook not configured", 503);
  const raw = await req.text();
  if (raw.length > 250_000 || !(await verifyHmac(env.RAZORPAY_WEBHOOK_SECRET,raw,req.headers.get("x-razorpay-signature") || "")))
    return text("Invalid signature", 401);
  const eventId = req.headers.get("x-razorpay-event-id");
  if (!eventId || !/^[A-Za-z0-9_-]{6,120}$/.test(eventId)) return text("Invalid event ID", 400);
  const event = JSON.parse(raw);
  if (!allowedEvents.has(event.event)) return text("ok");
  const providerSub = event.payload?.subscription?.entity;
  if (!validId(providerSub?.id,"sub")) return text("Invalid subscription",400);
  const row = await env.DB!.prepare("SELECT * FROM subscriptions WHERE razorpay_subscription_id=? LIMIT 1").bind(providerSub.id).first() as Subscription | null;
  if (!row) return text("Untracked subscription",404);
  const previous = await env.DB!.prepare("SELECT processed_at FROM razorpay_webhook_events WHERE event_id=? LIMIT 1").bind(eventId).first();
  if (previous?.processed_at) return text("ok");
  await env.DB!.prepare("INSERT OR IGNORE INTO razorpay_webhook_events(event_id,event_name,received_at) VALUES (?,?,?)")
    .bind(eventId,event.event,new Date().toISOString()).run();
  const happened = fromUnix(event.created_at);
  const newer = !!happened && (!row.last_provider_event_at || happened >= row.last_provider_event_at);
  if (event.event === "subscription.charged") {
    const payment = event.payload?.payment?.entity;
    const expires = fromUnix(providerSub.current_end);
    const since = fromUnix(providerSub.current_start);
    if (validId(payment?.id,"pay") && payment.status === "captured" &&
        payment.currency === "INR" && Number(payment.amount) === Number(row.amount) &&
        (!payment.subscription_id || payment.subscription_id === providerSub.id) &&
        expires && new Date(expires)>new Date() && (!row.expires_at || expires>=row.expires_at)) {
      await env.DB!.prepare(
        "UPDATE subscriptions SET status='active',expires_at=?,starts_at=?,razorpay_payment_id=?,provider_status=?,last_provider_event_at=COALESCE(?,last_provider_event_at),updated_at=? WHERE id=? AND (expires_at IS NULL OR expires_at<=?)"
      ).bind(expires,since || new Date().toISOString(),payment.id,String(providerSub.status || "active"),newer?happened:null,new Date().toISOString(),row.id,expires).run();
    }
  } else if (newer) {
    const newStatus = String(providerSub.status || event.event.split(".")[1]);
    if (event.event === "subscription.cancelled" || event.event === "subscription.completed") {
      const hasAccess = !!row.expires_at && new Date(row.expires_at)>new Date();
      await env.DB!.prepare(
        "UPDATE subscriptions SET status=?,cancel_at_cycle_end=1,provider_status=?,last_provider_event_at=?,updated_at=? WHERE id=?"
      ).bind(hasAccess?"active":"expired",newStatus,happened,new Date().toISOString(),row.id).run();
    } else {
      await env.DB!.prepare("UPDATE subscriptions SET provider_status=?,last_provider_event_at=?,updated_at=? WHERE id=?")
        .bind(newStatus,happened,new Date().toISOString(),row.id).run();
    }
  }
  await env.DB!.prepare("UPDATE razorpay_webhook_events SET processed_at=? WHERE event_id=?")
    .bind(new Date().toISOString(),eventId).run();
  return text("ok");
}
export async function handleRecurringBillingRoute(req: Request, env: Env): Promise<Response | null> {
  const path = new URL(req.url).pathname;
  const target = "/api/payments/razorpay/";
  if (!path.startsWith(target)) return null;
  const suffix = path.slice(target.length);
  if (!["subscribe","confirm","manage","subscription","webhook"].includes(suffix)) return null;
  if (suffix === "webhook") {
    if (req.method !== "POST") return text("Method not allowed", 405);
    if (!env.DB) return text("D1 unavailable",503);
    try { return await webhook(req,env); } catch (error) { console.error("Razorpay webhook failure",String(error)); return text("Processing failed",503); }
  }
  if (req.method !== (suffix === "subscription" ? "GET" : "POST")) return json({ error: "Method not allowed" }, 405);
  if (!env.DB) return json({ error: "D1 unavailable" }, 503);
  if (!checkOrigin(req)) return json({ error: "Invalid request origin" },403);
  const user = await userFromSession(req,env.DB);
  if (!user) return json({ error: "Sign in required" },401);
  try {
    if (suffix === "subscription") return json({ subscriptions: await ownSubscriptions(env.DB,user.id) });
    if (suffix === "subscribe") return await createSubscription(req,env,user);
    if (suffix === "confirm") return await confirmSubscription(req,env,user);
    return await manageSubscription(req,env,user);
  } catch (error) {
    console.error("Recurring billing route failed", String(error));
    return json({ error: "Payment service is temporarily unavailable" }, 503);
  }
}
