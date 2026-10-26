type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first(): Promise<Record<string, unknown> | null>;
  run(): Promise<unknown>;
};
type D1 = { prepare(sql: string): D1Statement };

type Env = {
  DB?: D1;
  AUTH_MODE?: string;
  AUTH_SUPABASE_URL?: string;
  AUTH_SUPABASE_PUBLISHABLE_KEY?: string;
};

type VerifiedUser = {
  id?: string;
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
};

const encoder = new TextEncoder();

const reply = (data: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});

const hashToken = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

function safeAuthOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) return null;
    if (url.pathname !== '/' || url.search || url.hash || url.port) return null;
    return url.origin;
  } catch { return null; }
}

/**
 * Exchanges one verified Supabase Auth access token for Booknomics' short-lived
 * HttpOnly Cloudflare session, keeping all user library data inside D1.
 * This calls Supabase Auth once per exchange, never PostgREST.
 */
export async function handleSupabaseAuthBridge(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/auth/supabase/session') return null;
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return reply({ error: 'Invalid request origin' }, 403);

  const authOrigin = safeAuthOrigin(env.AUTH_SUPABASE_URL);
  if (env.AUTH_MODE !== 'supabase' || !authOrigin || !env.AUTH_SUPABASE_PUBLISHABLE_KEY || !env.DB) {
    return reply({ error: 'Supabase Auth bridge is not configured' }, 503);
  }
  const body = await request.json().catch(() => null) as { access_token?: unknown } | null;
  const accessToken = body?.access_token;
  if (typeof accessToken !== 'string' || accessToken.length < 20 || accessToken.length > 8192) {
    return reply({ error: 'Missing or invalid access token' }, 400);
  }

  let verified: VerifiedUser;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const identity = await fetch(`${authOrigin}/auth/v1/user`, {
      headers: { apikey: env.AUTH_SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!identity.ok) return reply({ error: 'Supabase session is invalid or expired' }, 401);
    verified = await identity.json() as VerifiedUser;
  } catch {
    return reply({ error: 'Supabase authentication service is unavailable' }, 502);
  } finally {
    clearTimeout(timeout);
  }

  const id = verified.id || '';
  const email = verified.email?.trim().toLowerCase() || '';
  if (!/^[a-f0-9-]{36}$/i.test(id) || !/^\S+@\S+\.\S+$/.test(email) || !verified.email_confirmed_at) {
    return reply({ error: 'A verified Supabase account is required' }, 403);
  }

  const old = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1').bind(email).first();
  if (old && String(old.id) !== id) {
    // Intentionally do not link legacy users by email. The new Supabase project
    // starts fresh; linking would silently restore an old user's entitlements.
    return reply({ error: 'This email belongs to a legacy Booknomics account. Contact the administrator to reset its local profile before signing in.' }, 409);
  }

  const metadata = verified.user_metadata || {};
  const name = typeof metadata.full_name === 'string' ? metadata.full_name.slice(0, 120)
    : typeof metadata.name === 'string' ? metadata.name.slice(0, 120) : null;
  const avatar = typeof metadata.avatar_url === 'string' && /^https:\/\//.test(metadata.avatar_url)
    ? metadata.avatar_url.slice(0, 1000) : null;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO users (id,email,password_hash,email_verified,provider,created_at,updated_at,display_name,avatar_url,last_sign_in_at)
     VALUES (?,?,NULL,1,'supabase',?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET email=excluded.email, email_verified=1, provider='supabase',
       display_name=COALESCE(excluded.display_name,users.display_name),
       avatar_url=COALESCE(excluded.avatar_url,users.avatar_url),last_sign_in_at=excluded.last_sign_in_at,
       updated_at=excluded.updated_at`,
  ).bind(id, email, now, now, name, avatar, now).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO profiles (id,display_name,avatar_url,created_at,streak_count,daily_goal_minutes)
     VALUES (?,?,?,?,0,15)`,
  ).bind(id, name, avatar, now).run();

  const token = randomToken();
  const hash = await hashToken(token);
  // Never let a Cloudflare session outlive the verified Supabase access token.
  // The Auth server has already validated the token above.
  let expiresIn = 60 * 60;
  try {
    const body = accessToken.split('.')[1];
    const encoded = body.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(encoded)) as { exp?: number };
    if (typeof claims.exp === 'number') expiresIn = Math.floor(claims.exp - Date.now() / 1000);
  } catch { /* The Supabase Auth server already authenticated this token. */ }
  if (expiresIn < 30) return reply({ error: 'Your Supabase session needs refreshing' }, 401);
  const maxAge = Math.min(60 * 60, expiresIn);
  const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(), id, hash, expiresAt, now).run();

  return reply({ user: { id, email, display_name: name, avatar_url: avatar } }, 200, {
    'set-cookie': `bn_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
  });
}
