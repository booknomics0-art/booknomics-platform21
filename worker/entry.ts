import baseWorker from "./index";

type D1 = any;
type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: D1;
  BOOK_COVERS?: any;
  BOOK_ASSETS?: any;
  BOOKNOMICS_ENV?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

const SESSION_COOKIE = "bn_session";
const OAUTH_COOKIE = "bn_oauth_state";
const encoder = new TextEncoder();
const PASSWORD_ITERATIONS = 200_000;

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

const randomToken = (bytes = 32) => {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlToBytes = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

async function hashPassword(password: string) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(hash)}`;
}

async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [scheme, iterationsRaw, saltRaw, hashRaw] = stored.split("$");
  if (scheme !== "pbkdf2_sha256" || !iterationsRaw || !saltRaw || !hashRaw) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
  const salt = base64UrlToBytes(saltRaw);
  const expected = base64UrlToBytes(hashRaw);
  const actual = await derivePassword(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

const safeReturnTo = (value: string | null) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value.slice(0, 500);
};

function authCookie(token: string, maxAge: number) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function createSession(db: D1, userId: string) {
  const sessionToken = randomToken(48);
  const tokenHash = await sha256(sessionToken);
  const sessionId = crypto.randomUUID();
  const maxAge = 60 * 60 * 24 * 30;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString();
  await db.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(sessionId, userId, tokenHash, expiresAt, now)
    .run();
  return { sessionToken, maxAge };
}

async function handleEmailSignup(request: Request, env: Env) {
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });
  const body = await request.json().catch(() => null) as { email?: string; password?: string; name?: string } | null;
  const email = body?.email?.trim().toLowerCase() || "";
  const password = body?.password || "";
  const name = body?.name?.trim().slice(0, 120) || null;

  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Enter a valid email address" }, { status: 400 });
  if (password.length < 8 || password.length > 200) return json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const existing = await env.DB.prepare("SELECT id, password_hash, provider FROM users WHERE lower(email) = lower(?) LIMIT 1")
    .bind(email)
    .first();
  if (existing) {
    return json(
      { error: existing.password_hash ? "An account with this email already exists" : "This email already uses Google sign-in" },
      { status: 409 },
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, email_verified, provider, created_at, updated_at, display_name, last_sign_in_at)
     VALUES (?, ?, ?, 1, 'email', ?, ?, ?, ?)`,
  )
    .bind(id, email, passwordHash, now, now, name, now)
    .run();
  await env.DB.prepare(
    `INSERT INTO profiles (id, display_name, avatar_url, created_at, streak_count, daily_goal_minutes)
     VALUES (?, ?, NULL, ?, 0, 15)`,
  )
    .bind(id, name, now)
    .run();

  const session = await createSession(env.DB, id);
  return json(
    { user: { id, email, display_name: name, avatar_url: null } },
    { status: 201, headers: { "set-cookie": authCookie(session.sessionToken, session.maxAge) } },
  );
}

async function handleEmailLogin(request: Request, env: Env) {
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase() || "";
  const password = body?.password || "";
  if (!email || !password) return json({ error: "Email and password are required" }, { status: 400 });

  const user = await env.DB.prepare(
    "SELECT id, email, password_hash, display_name, avatar_url FROM users WHERE lower(email) = lower(?) LIMIT 1",
  )
    .bind(email)
    .first();
  if (!user || !(await verifyPassword(password, user.password_hash as string | null))) {
    return json({ error: "Invalid email or password" }, { status: 401 });
  }

  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE users SET last_sign_in_at = ?, updated_at = ? WHERE id = ?")
    .bind(now, now, user.id)
    .run();
  const session = await createSession(env.DB, String(user.id));
  return json(
    { user: { id: user.id, email: user.email, display_name: user.display_name || null, avatar_url: user.avatar_url || null } },
    { headers: { "set-cookie": authCookie(session.sessionToken, session.maxAge) } },
  );
}

async function handleGoogleStart(request: Request, env: Env) {
  if (!env.DB || !env.GOOGLE_CLIENT_ID) return json({ error: "Google OAuth is not configured" }, { status: 503 });

  const url = new URL(request.url);
  const state = randomToken(32);
  const stateHash = await sha256(state);
  const returnTo = safeReturnTo(url.searchParams.get("return_to"));
  const expires = new Date(Date.now() + 10 * 60_000).toISOString();

  await env.DB.prepare("DELETE FROM oauth_states WHERE datetime(expires_at) <= datetime('now')").run();
  await env.DB.prepare("INSERT INTO oauth_states (state_hash, return_to, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(stateHash, returnTo, expires, new Date().toISOString())
    .run();

  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  google.searchParams.set("redirect_uri", redirectUri);
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email profile");
  google.searchParams.set("state", state);
  google.searchParams.set("prompt", "select_account");

  const headers = new Headers({ location: google.toString() });
  headers.append("set-cookie", `${OAUTH_COOKIE}=${encodeURIComponent(state)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  return new Response(null, { status: 302, headers });
}

async function handleGoogleCallback(request: Request, env: Env) {
  if (!env.DB || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json({ error: "Google OAuth is not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = cookies(request).get(OAUTH_COOKIE);
  if (!code || !state || !cookieState || state !== cookieState) {
    return json({ error: "Invalid OAuth state" }, { status: 400 });
  }

  const stateHash = await sha256(state);
  const stateRow = await env.DB.prepare(
    "SELECT return_to FROM oauth_states WHERE state_hash = ? AND datetime(expires_at) > datetime('now') LIMIT 1",
  )
    .bind(stateHash)
    .first();
  if (!stateRow) return json({ error: "OAuth state expired" }, { status: 400 });
  await env.DB.prepare("DELETE FROM oauth_states WHERE state_hash = ?").bind(stateHash).run();

  const tokenBody = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: `${url.origin}/api/auth/google/callback`,
    grant_type: "authorization_code",
  });
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  if (!tokenResponse.ok) return json({ error: "Google token exchange failed" }, { status: 502 });
  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) return json({ error: "Google access token missing" }, { status: 502 });

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!profileResponse.ok) return json({ error: "Google profile request failed" }, { status: 502 });
  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  if (!profile.sub || !profile.email || profile.email_verified !== true) {
    return json({ error: "Verified Google email is required" }, { status: 403 });
  }

  const now = new Date().toISOString();
  let user = await env.DB.prepare(
    "SELECT id, email, display_name, avatar_url FROM users WHERE google_sub = ? OR lower(email) = lower(?) LIMIT 1",
  )
    .bind(profile.sub, profile.email)
    .first();

  if (user) {
    await env.DB.prepare(
      `UPDATE users SET google_sub = ?, display_name = COALESCE(?, display_name), avatar_url = COALESCE(?, avatar_url),
       email_verified = 1, provider = 'google', last_sign_in_at = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(profile.sub, profile.name || null, profile.picture || null, now, now, user.id)
      .run();
  } else {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO users (id, email, email_verified, provider, created_at, updated_at, google_sub, display_name, avatar_url, last_sign_in_at)
       VALUES (?, ?, 1, 'google', ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, profile.email, now, now, profile.sub, profile.name || null, profile.picture || null, now)
      .run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO profiles (id, display_name, avatar_url, created_at, streak_count, daily_goal_minutes)
       VALUES (?, ?, ?, ?, 0, 15)`,
    )
      .bind(id, profile.name || null, profile.picture || null, now)
      .run();
    user = { id, email: profile.email, display_name: profile.name || null, avatar_url: profile.picture || null };
  }

  const session = await createSession(env.DB, String(user.id));
  const destination = new URL(safeReturnTo(String(stateRow.return_to || "/")), url.origin);
  const headers = new Headers({ location: destination.toString() });
  headers.append("set-cookie", authCookie(session.sessionToken, session.maxAge));
  headers.append("set-cookie", `${OAUTH_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return new Response(null, { status: 302, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api/auth/google/start" && request.method === "GET") return handleGoogleStart(request, env);
    if (pathname === "/api/auth/google/callback" && request.method === "GET") return handleGoogleCallback(request, env);
    if (pathname === "/api/auth/signup" && request.method === "POST") return handleEmailSignup(request, env);
    if (pathname === "/api/auth/login" && request.method === "POST") return handleEmailLogin(request, env);
    return baseWorker.fetch(request, env as any);
  },
};