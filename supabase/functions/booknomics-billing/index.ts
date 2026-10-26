// IMPORTANT: Deploy only to NEW Supabase project otmjrtigeiuzktunodmb.
// This function deliberately accepts both signed-in browser calls and a
// Razorpay webhook. Deploy with --no-verify-jwt; it authenticates EVERY
// private call with auth.getUser() and EVERY webhook with its raw-body HMAC.
// Never invoke it with a secret/service_role key from the browser.
import { createClient } from 'npm:@supabase/supabase-js@2.105.1';

type Plan = 'weekly' | 'monthly';
type Subscriber = { id: string; email: string };
type Subscription = {
  id: string; user_id: string; plan: Plan; amount: number; status: string;
  razorpay_subscription_id: string | null; razorpay_payment_id: string | null;
  provider_status: string | null; expires_at: string | null;
  cancel_at_cycle_end: boolean; last_provider_event_at: string | null;
};

const encoder = new TextEncoder();
const prices: Record<Plan, number> = { weekly: 1900, monthly: 4900 };
const cycles: Record<Plan, number> = { weekly: 52, monthly: 12 };
const validId = (v: unknown, prefix: string): v is string =>
  typeof v === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(v);
const fromUnix = (n: unknown): string | null =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;

const allowedOrigins = new Set(['https://www.booknomics.com', 'https://booknomics.com']);
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  return origin && allowedOrigins.has(origin)
    ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version', 'access-control-allow-methods': 'GET, POST, OPTIONS', vary: 'Origin' }
    : {};
}
function json(req: Request, value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...cors(req), 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function text(req: Request, msg: string, status = 200) {
  return new Response(msg, { status, headers: { ...cors(req), 'cache-control': 'no-store' } });
}
function env(name: string): string {
  return Deno.env.get(name) || '';
}
function supabaseKeys() {
  const url = env('SUPABASE_URL');
  const publishable = env('SUPABASE_ANON_KEY') || JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS') || '{}').default || '';
  const secret = env('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}').default || '';
  if (!url || !publishable || !secret || !url.includes('otmjrtigeiuzktunodmb.supabase.co')) {
    throw new Error('The NEW Supabase project is not configured');
  }
  return { url, publishable, secret };
}
function authClient() {
  const keys = supabaseKeys();
  return createClient(keys.url, keys.publishable, { auth: { persistSession: false, autoRefreshToken: false } });
}
function dbClient() {
  const keys = supabaseKeys();
  return createClient(keys.url, keys.secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function authUser(req: Request): Promise<Subscriber | null> {
  const header = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+$/i.test(header)) return null;
  const token = header.replace(/^Bearer\s+/i, '');
  const { data, error } = await authClient().auth.getUser(token);
  return error || !data.user ? null : { id: data.user.id, email: data.user.email || '' };
}
function creds() {
  const id = env('RAZORPAY_KEY_ID');
  const secret = env('RAZORPAY_KEY_SECRET');
  if (!id.startsWith('rzp_live_') || !secret) throw new Error('Razorpay Live credentials missing');
  return { id, secret };
}
function planId(plan: Plan) {
  return plan === 'weekly' ? env('RAZORPAY_WEEKLY_PLAN_ID') : env('RAZORPAY_MONTHLY_PLAN_ID');
}
async function razorpay(path: string, method = 'GET', body?: unknown): Promise<any> {
  const { id, secret } = creds();
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method,
    headers: {
      authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error('[billing] provider returned', response.status, payload?.error?.code || 'unknown');
    throw new Error('Payment provider unavailable');
  }
  return payload;
}
async function verifyHmac(secret: string, raw: string, signature: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = Uint8Array.from(signature.match(/.{2}/g) || [], item => parseInt(item, 16));
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(raw));
}
async function verifyLivePlan(plan: Plan) {
  const id = planId(plan);
  if (!validId(id, 'plan')) throw new Error('Live plan ID is missing');
  const remote = await razorpay(`plans/${encodeURIComponent(id)}`);
  if (remote.id !== id || remote.period !== plan || Number(remote.interval) !== 1 ||
      Number(remote.item?.amount) !== prices[plan] || remote.item?.currency !== 'INR') {
    throw new Error('Live plan price or period does not match Booknomics');
  }
  return id;
}

async function subscribe(req: Request, user: Subscriber) {
  const body = await req.json().catch(() => null);
  if (body?.plan !== 'weekly' && body?.plan !== 'monthly') return json(req, { error: 'Invalid plan' }, 400);
  const plan: Plan = body.plan;
  const db = dbClient();
  // Heal expired access before the partial unique open-subscription index check.
  const { error: cleanupError } = await db.from('subscriptions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('user_id', user.id).eq('status', 'active').lt('expires_at', new Date().toISOString());
  if (cleanupError) throw cleanupError;
  const providerPlan = await verifyLivePlan(plan);
  const { data: reservation, error } = await db.from('subscriptions').insert({
    user_id: user.id, plan, status: 'creating', amount: prices[plan], currency: 'INR', provider_status: 'creating',
  }).select('id').single();
  // A DB unique index stops concurrent or duplicate active/pending reservations.
  if (error || !reservation) return json(req, { error: 'A membership is already active or pending. Open My Subscription or contact support.' }, 409);
  try {
    const remote = await razorpay('subscriptions', 'POST', {
      plan_id: providerPlan,
      total_count: cycles[plan],
      quantity: 1,
      customer_notify: 0,
      notes: { booknomics_user_id: user.id, booknomics_subscription_id: reservation.id, plan },
    });
    if (!validId(remote.id, 'sub') || remote.plan_id !== providerPlan) throw new Error('Invalid provider subscription');
    const { error: updateError } = await db.from('subscriptions').update({
      status: 'pending', provider_status: String(remote.status || 'created'), razorpay_subscription_id: remote.id,
      updated_at: new Date().toISOString(),
    }).eq('id', reservation.id).eq('status', 'creating');
    if (updateError) throw updateError;
    return json(req, { subscription_id: remote.id, key_id: creds().id });
  } catch (error) {
    // Leave the reservation blocked: a network failure may have created a
    // subscription at Razorpay. Support must reconcile before a second attempt.
    console.error('[billing] subscription creation requires reconciliation', String(error));
    await db.from('subscriptions').update({ status: 'pending', provider_status: 'creation_uncertain', updated_at: new Date().toISOString() }).eq('id', reservation.id).eq('status', 'creating');
    return json(req, { error: 'Checkout could not start. Contact support before trying again; no premium access was granted.' }, 503);
  }
}

async function confirm(req: Request, user: Subscriber) {
  const body = await req.json().catch(() => null);
  if (!validId(body?.razorpay_subscription_id, 'sub') || !validId(body?.razorpay_payment_id, 'pay') ||
      typeof body?.razorpay_signature !== 'string') return json(req, { error: 'Invalid checkout response' }, 400);
  const db = dbClient();
  const { data: row, error } = await db.from('subscriptions').select('*')
    .eq('razorpay_subscription_id', body.razorpay_subscription_id).eq('user_id', user.id).maybeSingle();
  if (error || !row) return json(req, { error: 'Subscription does not belong to this account' }, 404);
  if (!(await verifyHmac(creds().secret, `${body.razorpay_payment_id}|${body.razorpay_subscription_id}`, body.razorpay_signature)))
    return json(req, { error: 'Invalid payment signature' }, 401);
  const remote = await razorpay(`subscriptions/${encodeURIComponent(body.razorpay_subscription_id)}`);
  if (remote.id !== row.razorpay_subscription_id || remote.plan_id !== planId(row.plan))
    return json(req, { error: 'Subscription plan mismatch' }, 409);
  const payment = await razorpay(`payments/${encodeURIComponent(body.razorpay_payment_id)}`);
  const expiry = fromUnix(remote.current_end);
  const paid = payment.status === 'captured' && payment.currency === 'INR' &&
    Number(payment.amount) === row.amount &&
    (!payment.subscription_id || payment.subscription_id === row.razorpay_subscription_id) &&
    expiry && new Date(expiry) > new Date() && (!row.expires_at || expiry >= row.expires_at);
  if (paid) {
    // Same atomic, idempotent database procedure as the asynchronous webhook.
    const { data: applied, error: applyError } = await db.rpc('booknomics_apply_razorpay_event', {
      p_event_id: `checkout_${payment.id}`,
      p_event_name: 'subscription.charged',
      p_subscription_id: row.razorpay_subscription_id,
      p_payment_id: payment.id,
      p_amount: Number(payment.amount),
      p_currency: payment.currency,
      p_starts_at: fromUnix(remote.current_start),
      p_expires_at: expiry,
      p_happened_at: new Date().toISOString(),
      p_provider_status: String(remote.status || 'active'),
    });
    if (applyError || applied !== true) throw applyError || new Error('Unable to apply payment');
  }
  return json(req, { activated: Boolean(paid || (row.status === 'active' && row.expires_at && new Date(row.expires_at) > new Date())) });
}

async function manage(req: Request, user: Subscriber) {
  const body = await req.json().catch(() => null);
  if (!validId(body?.subscription_id, 'sub') || !['cancel_at_period_end', 'cancel_pending'].includes(body?.action))
    return json(req, { error: 'Invalid cancellation request' }, 400);
  const db = dbClient();
  const { data: row } = await db.from('subscriptions').select('*')
    .eq('user_id', user.id).eq('razorpay_subscription_id', body.subscription_id).maybeSingle();
  if (!row) return json(req, { error: 'Subscription not found' }, 404);
  if (row.cancel_at_cycle_end) return json(req, { ok: true });
  const paid = row.status === 'active' && row.expires_at && new Date(row.expires_at) > new Date();
  if ((body.action === 'cancel_pending' && paid) || (body.action === 'cancel_at_period_end' && !paid))
    return json(req, { error: 'Cancellation action does not match the membership state' }, 409);
  const remote = await razorpay(`subscriptions/${encodeURIComponent(body.subscription_id)}/cancel`, 'POST', { cancel_at_cycle_end: paid ? 1 : 0 });
  const { error } = await db.from('subscriptions').update({
    cancel_at_cycle_end: true, status: paid ? 'active' : 'cancelled',
    provider_status: String(remote?.status || 'cancelled'), updated_at: new Date().toISOString(),
  }).eq('id', row.id);
  if (error) throw error;
  return json(req, { ok: true, expires_at: paid ? row.expires_at : null });
}

async function listSubscriptions(req: Request, user: Subscriber) {
  const { data, error } = await dbClient().from('subscriptions')
    .select('id,plan,amount,status,expires_at,created_at,razorpay_subscription_id,cancel_at_cycle_end,provider_status')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return json(req, { subscriptions: data || [] });
}

const subscribedEvents = new Set([
  'subscription.authenticated', 'subscription.activated', 'subscription.charged',
  'subscription.pending', 'subscription.halted', 'subscription.cancelled',
  'subscription.completed', 'subscription.paused', 'subscription.resumed', 'subscription.updated',
]);
async function webhook(req: Request) {
  const secret = env('RAZORPAY_WEBHOOK_SECRET');
  if (!secret) return text(req, 'Webhook is not configured', 503);
  const raw = await req.text();
  if (raw.length > 250_000 || !(await verifyHmac(secret, raw, req.headers.get('x-razorpay-signature') || '')))
    return text(req, 'Invalid signature', 401);
  const eventId = req.headers.get('x-razorpay-event-id');
  if (!eventId || !/^[A-Za-z0-9_-]{6,120}$/.test(eventId)) return text(req, 'Invalid event ID', 400);
  const event = JSON.parse(raw);
  if (!subscribedEvents.has(event.event)) return text(req, 'ok');
  const payloadSub = event.payload?.subscription?.entity;
  if (!validId(payloadSub?.id, 'sub')) return text(req, 'Invalid subscription', 400);
  // Fetch current provider state; the signed payload may arrive out of order.
  const providerSub = await razorpay(`subscriptions/${encodeURIComponent(payloadSub.id)}`);
  if (providerSub.id !== payloadSub.id) return text(req, 'Provider mismatch', 409);
  let paymentId = '';
  let amount = 0;
  let currency = '';
  if (event.event === 'subscription.charged') {
    const id = event.payload?.payment?.entity?.id;
    if (validId(id, 'pay')) {
      const payment = await razorpay(`payments/${encodeURIComponent(id)}`);
      if (payment.id === id && payment.status === 'captured' &&
          (!payment.subscription_id || payment.subscription_id === providerSub.id)) {
        paymentId = id;
        amount = Number(payment.amount);
        currency = String(payment.currency);
      }
    }
    // Never permanently claim this event while its charged period is unknown.
    if (!paymentId || !fromUnix(providerSub.current_end)) return text(req, 'Charge still unverified', 503);
  }
  const { data, error } = await dbClient().rpc('booknomics_apply_razorpay_event', {
    p_event_id: eventId,
    p_event_name: event.event,
    p_subscription_id: providerSub.id,
    p_payment_id: paymentId,
    p_amount: amount,
    p_currency: currency,
    p_starts_at: fromUnix(providerSub.current_start),
    p_expires_at: fromUnix(providerSub.current_end),
    p_happened_at: fromUnix(event.created_at) || new Date().toISOString(),
    p_provider_status: String(providerSub.status || ''),
  });
  if (error || data !== true) {
    console.error('[billing] webhook apply failed', error?.code || 'not_applied');
    return text(req, 'Processing failed', 503); // Ask Razorpay to retry.
  }
  return text(req, 'ok');
}

Deno.serve(async (req: Request) => {
  const path = new URL(req.url).pathname;
  const suffix = path.split('/booknomics-billing/')[1] || '';
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors(req), 'cache-control': 'no-store' } });
  if (!['subscribe', 'confirm', 'manage', 'subscription', 'webhook'].includes(suffix))
    return json(req, { error: 'Not found' }, 404);
  if (req.method !== (suffix === 'subscription' ? 'GET' : 'POST'))
    return json(req, { error: 'Method not allowed' }, 405);
  if (suffix !== 'webhook' && req.headers.get('origin') && !allowedOrigins.has(req.headers.get('origin')!))
    return json(req, { error: 'Invalid origin' }, 403);
  try {
    if (suffix === 'webhook') return await webhook(req);
    const user = await authUser(req);
    if (!user) return json(req, { error: 'Sign in required' }, 401);
    if (suffix === 'subscribe') return await subscribe(req, user);
    if (suffix === 'confirm') return await confirm(req, user);
    if (suffix === 'manage') return await manage(req, user);
    return await listSubscriptions(req, user);
  } catch (error) {
    console.error('[billing] request failed', String(error));
    return json(req, { error: 'Billing temporarily unavailable' }, 503);
  }
});
