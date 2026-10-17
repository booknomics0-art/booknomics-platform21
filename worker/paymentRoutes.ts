type D1 = any;
type Env = {
  DB?: D1;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
};

type SafeUser = { id: string; email: string };
type Plan = "weekly" | "monthly" | "quarterly";

const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();
const PLANS: Record<Plan, { amount: number; days: number }> = {
  weekly: { amount: 1900, days: 7 },
  monthly: { amount: 6900, days: 30 },
  quarterly: { amount: 19900, days: 90 },
};

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
  });

const cookies = (request: Request) => {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey) result.set(rawKey, decodeURIComponent(rest.join("=")));
  }
  return result;
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};

async function currentUser(request: Request, db: D1): Promise<SafeUser | null> {
  const token = cookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await db.prepare(
    `SELECT u.id, u.email
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now')
     LIMIT 1`,
  ).bind(tokenHash).first();
  return row ? row as SafeUser : null;
}

async function requireUser(request: Request, env: Env) {
  if (!env.DB) return { user: null, response: json({ error: "D1 binding not configured" }, { status: 503 }) };
  const user = await currentUser(request, env.DB);
  if (!user) return { user: null, response: json({ error: "Authentication required" }, { status: 401 }) };
  return { user, response: null };
}

function credentials(env: Env) {
  const keyId = (env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = (env.RAZORPAY_KEY_SECRET || "").trim();
  if (!keyId || !keySecret) return null;
  if (!/^rzp_(test|live)_/.test(keyId)) return null;
  return { keyId, keySecret };
}

async function rateLimited(db: D1, userId: string) {
  const row = await db.prepare(
    `SELECT COUNT(*) AS count FROM subscriptions
     WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-1 hour')`,
  ).bind(userId).first();
  return Number(row?.count || 0) >= 30;
}

async function createOrder(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const user = auth.user!;
  const creds = credentials(env);
  if (!creds) return json({ error: "Razorpay is not configured" }, { status: 503 });
  if (await rateLimited(env.DB!, user.id)) return json({ error: "Too many payment attempts. Try again later." }, { status: 429 });

  const body = await request.json().catch(() => null) as { plan?: string } | null;
  const plan = body?.plan as Plan | undefined;
  const cfg = plan ? PLANS[plan] : undefined;
  if (!cfg) return json({ error: "Invalid plan" }, { status: 400 });

  const basic = btoa(`${creds.keyId}:${creds.keySecret}`);
  const providerResponse = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${basic}` },
    body: JSON.stringify({
      amount: cfg.amount,
      currency: "INR",
      receipt: `bn_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: { user_id: user.id, plan },
    }),
  });
  const order = await providerResponse.json().catch(() => null) as any;
  if (!providerResponse.ok || !order?.id) {
    console.error("Razorpay order creation failed", { status: providerResponse.status, code: order?.error?.code });
    return json({ error: "Razorpay order failed" }, { status: 502 });
  }

  const now = new Date().toISOString();
  await env.DB!.prepare(
    `INSERT INTO subscriptions
      (id, user_id, plan, status, amount, currency, razorpay_order_id, starts_at, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, 'INR', ?, NULL, NULL, ?, ?)`,
  ).bind(crypto.randomUUID(), user.id, plan, cfg.amount, String(order.id), now, now).run();

  return json({ ok: true, order_id: order.id, key_id: creds.keyId, amount: cfg.amount });
}

async function verifyOrder(request: Request, env: Env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const user = auth.user!;
  const creds = credentials(env);
  if (!creds) return json({ error: "Razorpay is not configured" }, { status: 503 });

  const body = await request.json().catch(() => null) as {
    razorpay_order_id?: unknown;
    razorpay_payment_id?: unknown;
    razorpay_signature?: unknown;
  } | null;
  const orderId = body?.razorpay_order_id;
  const paymentId = body?.razorpay_payment_id;
  const signatureHex = body?.razorpay_signature;
  if (
    typeof orderId !== "string" || !/^order_[A-Za-z0-9]+$/.test(orderId) ||
    typeof paymentId !== "string" || !/^pay_[A-Za-z0-9]+$/.test(paymentId) ||
    typeof signatureHex !== "string" || !/^[0-9a-f]{64}$/i.test(signatureHex)
  ) return json({ error: "Invalid payment fields" }, { status: 400 });

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(creds.keySecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signature = Uint8Array.from(signatureHex.match(/../g) || [], (hex) => parseInt(hex, 16));
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(`${orderId}|${paymentId}`),
  );
  if (!valid) return json({ error: "Invalid signature" }, { status: 400 });

  const sub = await env.DB!.prepare(
    `SELECT id, plan, status, amount, currency, razorpay_payment_id, expires_at
     FROM subscriptions WHERE razorpay_order_id = ? AND user_id = ? LIMIT 1`,
  ).bind(orderId, user.id).first();
  if (!sub) return json({ error: "Order not found" }, { status: 404 });

  if (sub.status !== "pending") {
    if (sub.razorpay_payment_id === paymentId) {
      return json({ ok: true, plan: sub.plan, expires_at: sub.expires_at });
    }
    return json({ error: "Order already processed" }, { status: 409 });
  }

  const cfg = PLANS[sub.plan as Plan];
  if (!cfg) return json({ error: "Unsupported plan" }, { status: 400 });

  const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { authorization: `Basic ${btoa(`${creds.keyId}:${creds.keySecret}`)}` },
  });
  const payment = await paymentResponse.json().catch(() => null) as any;
  if (!paymentResponse.ok) return json({ error: "Payment provider verification unavailable" }, { status: 502 });
  if (
    payment?.status !== "captured" ||
    payment?.order_id !== orderId ||
    Number(payment?.amount) !== Number(sub.amount) ||
    payment?.currency !== sub.currency
  ) return json({ error: "Payment not captured or order mismatch. Please retry after capture." }, { status: 409 });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + cfg.days * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();
  await env.DB!.prepare(
    `UPDATE subscriptions
     SET status = 'active', razorpay_payment_id = ?, starts_at = ?, expires_at = ?, updated_at = ?
     WHERE id = ? AND status = 'pending'`,
  ).bind(paymentId, nowIso, expiresAt, nowIso, sub.id).run();

  const activated = await env.DB!.prepare(
    "SELECT status, razorpay_payment_id, expires_at FROM subscriptions WHERE id = ? LIMIT 1",
  ).bind(sub.id).first();
  if (activated?.status !== "active" || activated?.razorpay_payment_id !== paymentId) {
    return json({ error: "Order processing conflict. Please retry." }, { status: 409 });
  }

  return json({ ok: true, plan: sub.plan, expires_at: activated.expires_at });
}

export async function handlePaymentRoute(request: Request, env: Env): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  try {
    if (pathname === "/api/payments/razorpay/order" && request.method === "POST") return await createOrder(request, env);
    if (pathname === "/api/payments/razorpay/verify" && request.method === "POST") return await verifyOrder(request, env);
    return null;
  } catch (error) {
    console.error("payment route failed", error);
    return json({ error: "Something went wrong" }, { status: 500 });
  }
}
