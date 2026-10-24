import { handleAdminContentAiRoute } from "./adminContentAiRoutes";
import { handleAdminMediaAiRoute } from "./adminMediaAiRoutes";

type D1 = any;
type R2 = any;

export type OAuthMcpEnv = {
  DB?: D1;
  BOOK_COVERS?: R2;
  BOOK_ASSETS?: R2;
  GEMINI_API_KEY?: string;
  LOVABLE_API_KEY?: string;
  XAI_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
};

type User = { id: string; email: string };
type TokenPrincipal = User & { client_id: string; scope: string; resource: string; raw_token: string };

const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();
const ACCESS_TTL_SECONDS = 60 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const CODE_TTL_SECONDS = 10 * 60;
const AUTH_TTL_SECONDS = 10 * 60;
const ALLOWED_SCOPES = new Set(["mcp:read", "mcp:write", "mcp:admin"]);
const VOICE_HI = "XrExE9yKIg1WjnnlVkGX";
const VOICE_EN = "nPczCjzI2devNBz1zQrb";
const TTS_CHUNK = 3400;

const json = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...init.headers,
  },
});

const oauthError = (error: string, description: string, status = 400) =>
  json({ error, error_description: description }, { status });

const cookies = (request: Request) => {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey) result.set(rawKey, decodeURIComponent(rest.join("=")));
  }
  return result;
};

const randomToken = (bytes = 32) => {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let raw = "";
  for (const byte of data) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (value: string) => hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
const sha256Base64url = async (value: string) => {
  const data = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  let raw = "";
  for (const byte of data) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
const isoPlus = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

async function sessionUser(request: Request, db: D1): Promise<User | null> {
  const token = cookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const row = await db.prepare(
    `SELECT u.id,u.email FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=? AND datetime(s.expires_at)>datetime('now') LIMIT 1`,
  ).bind(await sha256(token)).first();
  return row ? row as User : null;
}

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

async function oauthPrincipal(request: Request, db: D1): Promise<TokenPrincipal | null> {
  const raw = bearer(request);
  if (!raw) return null;
  const row = await db.prepare(
    `SELECT u.id,u.email,t.client_id,t.scope,t.resource
     FROM oauth_access_tokens t JOIN users u ON u.id=t.user_id
     WHERE t.token_hash=? AND datetime(t.expires_at)>datetime('now') LIMIT 1`,
  ).bind(await sha256(raw)).first();
  return row ? { ...(row as any), raw_token: raw } as TokenPrincipal : null;
}

const scopes = (value: string) => new Set(value.split(/\s+/).filter(Boolean));
const hasScope = (principal: TokenPrincipal, scope: string) => scopes(principal.scope).has(scope);

function normalizeScope(raw: string | null) {
  const requested = (raw || "mcp:read mcp:write").split(/\s+/).filter(Boolean);
  if (!requested.length || requested.some(value => !ALLOWED_SCOPES.has(value))) return null;
  return Array.from(new Set(requested)).join(" ");
}

function validRedirectUri(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname);
  } catch { return false; }
}

function redirectWith(uri: string, params: Record<string, string | null | undefined>) {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) if (value != null) url.searchParams.set(key, value);
  return Response.redirect(url.toString(), 302);
}

function metadata(request: Request, kind: "authorization" | "resource") {
  const origin = new URL(request.url).origin;
  if (kind === "resource") {
    return json({
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
      scopes_supported: ["mcp:read", "mcp:write", "mcp:admin"],
      bearer_methods_supported: ["header"],
      resource_name: "Booknomics MCP",
    });
  }
  return json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp:read", "mcp:write", "mcp:admin"],
  });
}

async function registerClient(request: Request, env: OAuthMcpEnv) {
  if (!env.DB) return oauthError("server_error", "D1 binding not configured", 503);
  const body = await request.json().catch(() => null) as any;
  const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.filter((v: unknown) => typeof v === "string") : [];
  if (!redirectUris.length || redirectUris.length > 10 || redirectUris.some((uri: string) => !validRedirectUri(uri))) {
    return oauthError("invalid_redirect_uri", "Register one or more HTTPS or loopback redirect URIs");
  }
  const clientName = typeof body?.client_name === "string" && body.client_name.trim()
    ? body.client_name.trim().slice(0, 120)
    : "MCP client";
  if (body?.token_endpoint_auth_method && body.token_endpoint_auth_method !== "none") {
    return oauthError("invalid_client_metadata", "Only public PKCE clients are supported");
  }
  const clientId = `bn_${randomToken(24)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO oauth_clients (client_id,client_name,redirect_uris,grant_types,response_types,token_endpoint_auth_method,created_at)
     VALUES (?,?,?,?,?,'none',?)`,
  ).bind(clientId, clientName, JSON.stringify(redirectUris), JSON.stringify(["authorization_code", "refresh_token"]), JSON.stringify(["code"]), now).run();
  return json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  }, { status: 201 });
}

async function authorize(request: Request, env: OAuthMcpEnv) {
  if (!env.DB) return oauthError("server_error", "D1 binding not configured", 503);
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") || "";
  const redirectUri = url.searchParams.get("redirect_uri") || "";
  const responseType = url.searchParams.get("response_type") || "";
  const codeChallenge = url.searchParams.get("code_challenge") || "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") || "";
  const state = url.searchParams.get("state");
  const resource = url.searchParams.get("resource") || `${url.origin}/mcp`;
  const scope = normalizeScope(url.searchParams.get("scope"));

  const client = await env.DB.prepare("SELECT client_name,redirect_uris FROM oauth_clients WHERE client_id=? LIMIT 1").bind(clientId).first() as any;
  if (!client) return oauthError("invalid_request", "Unknown client_id");
  let redirects: string[] = [];
  try { redirects = JSON.parse(String(client.redirect_uris || "[]")); } catch { redirects = []; }
  if (!redirects.includes(redirectUri)) return oauthError("invalid_request", "redirect_uri is not registered");
  if (responseType !== "code") return redirectWith(redirectUri, { error: "unsupported_response_type", state });
  if (!codeChallenge || codeChallengeMethod !== "S256") return redirectWith(redirectUri, { error: "invalid_request", error_description: "PKCE S256 is required", state });
  if (resource !== `${url.origin}/mcp`) return redirectWith(redirectUri, { error: "invalid_target", state });
  if (!scope) return redirectWith(redirectUri, { error: "invalid_scope", state });

  const user = await sessionUser(request, env.DB);
  if (!user) {
    const next = `${url.pathname}${url.search}`;
    return Response.redirect(`${url.origin}/auth?next=${encodeURIComponent(next)}`, 302);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO oauth_authorizations
      (id,user_id,client_id,redirect_uri,code_challenge,scope,resource,state,expires_at,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).bind(id,user.id,clientId,redirectUri,codeChallenge,scope,resource,state,isoPlus(AUTH_TTL_SECONDS),now).run();
  return Response.redirect(`${url.origin}/.lovable/oauth/consent?authorization_id=${encodeURIComponent(id)}`, 302);
}

async function authorizationDetails(request: Request, env: OAuthMcpEnv, id: string) {
  if (!env.DB) return oauthError("server_error", "D1 binding not configured", 503);
  const user = await sessionUser(request, env.DB);
  if (!user) return json({ error: "Authentication required" }, { status: 401 });
  const row = await env.DB.prepare(
    `SELECT a.id,a.client_id,a.redirect_uri,a.scope,a.resource,a.state,a.expires_at,a.approved_at,a.denied_at,c.client_name
     FROM oauth_authorizations a JOIN oauth_clients c ON c.client_id=a.client_id
     WHERE a.id=? AND a.user_id=? AND datetime(a.expires_at)>datetime('now') LIMIT 1`,
  ).bind(id,user.id).first();
  return row ? json({ data: row }) : json({ error: "Authorization request not found or expired" }, { status: 404 });
}

async function authorizationDecision(request: Request, env: OAuthMcpEnv, id: string) {
  if (!env.DB) return oauthError("server_error", "D1 binding not configured", 503);
  const user = await sessionUser(request, env.DB);
  if (!user) return json({ error: "Authentication required" }, { status: 401 });
  const row = await env.DB.prepare(
    `SELECT * FROM oauth_authorizations WHERE id=? AND user_id=? AND datetime(expires_at)>datetime('now')
     AND approved_at IS NULL AND denied_at IS NULL LIMIT 1`,
  ).bind(id,user.id).first() as any;
  if (!row) return json({ error: "Authorization request not found or expired" }, { status: 404 });
  const body = await request.json().catch(() => null) as any;
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "deny") return json({ error: "decision must be approve or deny" }, { status: 400 });
  const now = new Date().toISOString();
  if (decision === "deny") {
    await env.DB.prepare("UPDATE oauth_authorizations SET denied_at=? WHERE id=?").bind(now,id).run();
    const target = new URL(String(row.redirect_uri));
    target.searchParams.set("error", "access_denied");
    if (row.state) target.searchParams.set("state", String(row.state));
    return json({ redirect_url: target.toString() });
  }

  const rawCode = randomToken(32);
  await env.DB.batch([
    env.DB.prepare("UPDATE oauth_authorizations SET approved_at=? WHERE id=?").bind(now,id),
    env.DB.prepare(
      `INSERT INTO oauth_codes
        (code_hash,authorization_id,user_id,client_id,redirect_uri,code_challenge,scope,resource,expires_at,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).bind(await sha256(rawCode),id,user.id,row.client_id,row.redirect_uri,row.code_challenge,row.scope,row.resource,isoPlus(CODE_TTL_SECONDS),now),
  ]);
  const target = new URL(String(row.redirect_uri));
  target.searchParams.set("code", rawCode);
  if (row.state) target.searchParams.set("state", String(row.state));
  return json({ redirect_url: target.toString() });
}

async function issueTokens(db: D1, userId: string, clientId: string, scope: string, resource: string) {
  const access = randomToken(32);
  const refresh = randomToken(48);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO oauth_access_tokens (token_hash,user_id,client_id,scope,resource,expires_at,created_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(await sha256(access),userId,clientId,scope,resource,isoPlus(ACCESS_TTL_SECONDS),now),
    db.prepare(`INSERT INTO oauth_refresh_tokens (token_hash,user_id,client_id,scope,resource,expires_at,created_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(await sha256(refresh),userId,clientId,scope,resource,isoPlus(REFRESH_TTL_SECONDS),now),
  ]);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_SECONDS, refresh_token: refresh, scope };
}

async function tokenEndpoint(request: Request, env: OAuthMcpEnv) {
  if (!env.DB) return oauthError("server_error", "D1 binding not configured", 503);
  const form = await request.formData().catch(() => null);
  if (!form) return oauthError("invalid_request", "Form body required");
  const grant = String(form.get("grant_type") || "");
  const clientId = String(form.get("client_id") || "");
  if (!clientId) return oauthError("invalid_client", "client_id required", 401);
  const client = await env.DB.prepare("SELECT client_id FROM oauth_clients WHERE client_id=? LIMIT 1").bind(clientId).first();
  if (!client) return oauthError("invalid_client", "Unknown client", 401);

  if (grant === "authorization_code") {
    const code = String(form.get("code") || "");
    const redirectUri = String(form.get("redirect_uri") || "");
    const verifier = String(form.get("code_verifier") || "");
    if (!code || !redirectUri || verifier.length < 43 || verifier.length > 128) return oauthError("invalid_grant", "Invalid authorization code exchange");
    const row = await env.DB.prepare(
      `SELECT * FROM oauth_codes WHERE code_hash=? AND client_id=? AND redirect_uri=? AND used_at IS NULL
       AND datetime(expires_at)>datetime('now') LIMIT 1`,
    ).bind(await sha256(code),clientId,redirectUri).first() as any;
    if (!row || await sha256Base64url(verifier) !== row.code_challenge) return oauthError("invalid_grant", "Authorization code or PKCE verifier is invalid");
    await env.DB.prepare("UPDATE oauth_codes SET used_at=? WHERE code_hash=?").bind(new Date().toISOString(),await sha256(code)).run();
    return json(await issueTokens(env.DB,row.user_id,row.client_id,row.scope,row.resource));
  }

  if (grant === "refresh_token") {
    const refresh = String(form.get("refresh_token") || "");
    if (!refresh) return oauthError("invalid_grant", "refresh_token required");
    const hash = await sha256(refresh);
    const row = await env.DB.prepare(
      `SELECT * FROM oauth_refresh_tokens WHERE token_hash=? AND client_id=? AND revoked_at IS NULL
       AND datetime(expires_at)>datetime('now') LIMIT 1`,
    ).bind(hash,clientId).first() as any;
    if (!row) return oauthError("invalid_grant", "Refresh token is invalid or expired");
    await env.DB.prepare("UPDATE oauth_refresh_tokens SET revoked_at=? WHERE token_hash=?").bind(new Date().toISOString(),hash).run();
    return json(await issueTokens(env.DB,row.user_id,row.client_id,row.scope,row.resource));
  }
  return oauthError("unsupported_grant_type", "Supported grants: authorization_code, refresh_token");
}

async function revoke(request: Request, env: OAuthMcpEnv) {
  if (!env.DB) return oauthError("server_error", "D1 binding not configured", 503);
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") || "");
  if (token) {
    const hash = await sha256(token);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM oauth_access_tokens WHERE token_hash=?").bind(hash),
      env.DB.prepare("UPDATE oauth_refresh_tokens SET revoked_at=? WHERE token_hash=?").bind(new Date().toISOString(),hash),
    ]);
  }
  return new Response(null, { status: 200, headers: { "cache-control": "no-store" } });
}

function toolDefinitions() {
  return [
    { name: "search_books", title: "Search books", description: "Search published Booknomics summaries by title, author or category.", inputSchema: { type: "object", additionalProperties: false, properties: { query: { type: "string", maxLength: 200 }, language: { type: "string", enum: ["en","hi"] }, category: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["query"] }, annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false } },
    { name: "get_book_summary", title: "Get book summary", description: "Fetch public summary content for one Booknomics book by slug.", inputSchema: { type: "object", additionalProperties: false, properties: { slug: { type: "string" } }, required: ["slug"] }, annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false } },
    { name: "list_my_library", title: "List my library", description: "List books saved in the authenticated user's Booknomics library.", inputSchema: { type: "object", additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false } },
    { name: "add_book_to_library", title: "Add book to my library", description: "Save a published Booknomics book to the authenticated user's library.", inputSchema: { type: "object", additionalProperties: false, properties: { slug: { type: "string" } }, required: ["slug"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
    { name: "admin_update_book", title: "Update book content (admin only)", description: "Update approved public fields of one existing book.", inputSchema: { type: "object", additionalProperties: false, properties: { book_id: { type: "string" }, patch: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, author: { type: "string" }, tagline: { type: "string" }, overview: { type: "string" }, category: { type: "string" }, meta_title: { type: "string" }, meta_description: { type: "string" } } } }, required: ["book_id","patch"] }, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } },
    { name: "admin_create_book", title: "Create a book draft (admin only)", description: "Create a new Booknomics draft book record.", inputSchema: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, author: { type: "string" }, slug: { type: "string" }, category: { type: "string" }, language: { type: "string", enum: ["en","hi"] }, year: { type: "integer" }, tagline: { type: "string" } }, required: ["title","author","slug","category","language"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } },
    { name: "admin_generate_book_content", title: "Generate book content (admin only)", description: "Generate long-form Booknomics editorial content for an existing book.", inputSchema: { type: "object", additionalProperties: false, properties: { book_id: { type: "string" }, language: { type: "string", enum: ["en","hi"] } }, required: ["book_id"] }, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } },
    { name: "admin_generate_book_cover", title: "Generate book cover (admin only)", description: "Generate and attach a premium cover to an existing book.", inputSchema: { type: "object", additionalProperties: false, properties: { book_id: { type: "string" }, prompt: { type: "string" } }, required: ["book_id"] }, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } },
    { name: "admin_generate_book_podcast", title: "Generate book podcast (admin only)", description: "Generate and attach an 8-20 minute English or Hindi podcast.", inputSchema: { type: "object", additionalProperties: false, properties: { book_id: { type: "string" }, language: { type: "string", enum: ["en","hi"] }, duration_minutes: { type: "integer", minimum: 8, maximum: 20 } }, required: ["book_id"] }, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } },
    { name: "admin_publish_book", title: "Publish book (admin only)", description: "Publish a reviewed book after required content and cover checks.", inputSchema: { type: "object", additionalProperties: false, properties: { book_id: { type: "string" } }, required: ["book_id"] }, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } },
  ];
}

const textResult = (value: unknown, structured?: Record<string, unknown>) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }], ...(structured ? { structuredContent: structured } : {}) });
const toolError = (message: string) => ({ content: [{ type: "text", text: message }], isError: true });

async function isAdmin(db: D1, userId: string) {
  return Boolean(await db.prepare("SELECT 1 AS ok FROM user_roles WHERE user_id=? AND role='admin' LIMIT 1").bind(userId).first());
}

async function invokeAdminWithSession(request: Request, env: OAuthMcpEnv, user: User, path: string, body: unknown, handler: (request: Request, env: any) => Promise<Response | null>) {
  const raw = randomToken(32);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB!.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)")
    .bind(id,user.id,await sha256(raw),isoPlus(300),now).run();
  try {
    const headers = new Headers({ "content-type": "application/json", cookie: `${SESSION_COOKIE}=${encodeURIComponent(raw)}` });
    const ua = request.headers.get("user-agent"); if (ua) headers.set("user-agent", ua);
    const ip = request.headers.get("cf-connecting-ip"); if (ip) headers.set("cf-connecting-ip", ip);
    const internal = new Request(new URL(path, request.url).toString(), { method: "POST", headers, body: JSON.stringify(body) });
    const response = await handler(internal, env);
    if (!response) throw new Error("Internal admin route unavailable");
    const payload = await response.json().catch(() => ({ error: `Admin operation failed (${response.status})` })) as any;
    if (!response.ok || payload?.error) throw new Error(payload?.error || `Admin operation failed (${response.status})`);
    return payload;
  } finally {
    await env.DB!.prepare("DELETE FROM sessions WHERE id=?").bind(id).run().catch(() => {});
  }
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/[#*_`>]+/g," ").replace(/\s+/g," ").trim() : "";
}
function splitTts(text: string) {
  const sentences = text.split(/(?<=[.!?।])\s+/); const chunks: string[] = []; let current = "";
  for (const sentence of sentences) {
    if (!sentence.trim()) continue;
    const next = `${current} ${sentence}`.trim();
    if (next.length <= TTS_CHUNK) current = next;
    else { if (current) chunks.push(current); for (let i=0;i<sentence.length;i+=TTS_CHUNK) chunks.push(sentence.slice(i,i+TTS_CHUNK)); current = ""; }
  }
  if (current) chunks.push(current); return chunks.filter(Boolean);
}
async function buildPodcast(env: OAuthMcpEnv, book: any, lang: "en" | "hi", minutes: number) {
  if (!env.GEMINI_API_KEY) throw new Error("Podcast script service not configured");
  const context = [book.tagline,book.overview,book.deep_summary,book.key_ideas,book.deep_analysis,book.daily_application].map(cleanText).filter(Boolean).join("\n\n").slice(0,50000);
  const prompt = `Create a single-host Booknomics podcast script about "${book.title}" by ${book.author}. Target approximately ${minutes} minutes (${Math.round(minutes*130)} words). ${lang === "hi" ? "Write natural spoken Hindi in Devanagari." : "Write natural spoken English."} Use only the supplied editorial material as factual source; do not invent quotations, page numbers or claims. Explain the premise/core arguments, key themes, interpretation, relevance and closing takeaway. No markdown, timestamps or speaker labels.\n\nSOURCE MATERIAL:\n${context}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ contents:[{role:"user",parts:[{text:prompt}]}], generationConfig:{temperature:0.65,maxOutputTokens:7000} }) });
  if (!response.ok) throw new Error("Podcast script generation failed");
  const data: any = await response.json(); const script = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!script) throw new Error("Podcast script generation failed"); return script as string;
}
async function synthesize(env: OAuthMcpEnv, text: string, lang: "en" | "hi") {
  if (!env.ELEVENLABS_API_KEY) throw new Error("Podcast audio service not configured");
  const voice = lang === "hi" ? VOICE_HI : VOICE_EN;
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, { method:"POST", headers:{"xi-api-key":env.ELEVENLABS_API_KEY,"content-type":"application/json"}, body:JSON.stringify({ text, model_id:"eleven_turbo_v2_5", voice_settings:{stability:0.55,similarity_boost:0.75,style:0.3,use_speaker_boost:true,speed:lang === "hi" ? 0.95 : 1.0} }) });
  if (!response.ok) throw new Error("Podcast audio generation failed"); return new Uint8Array(await response.arrayBuffer());
}
function concat(parts: Uint8Array[]) { const size=parts.reduce((s,p)=>s+p.length,0); const out=new Uint8Array(size); let offset=0; for (const part of parts){out.set(part,offset);offset+=part.length;} return out; }
async function generatePodcast(request: Request, env: OAuthMcpEnv, principal: TokenPrincipal, args: any) {
  if (!env.BOOK_ASSETS) throw new Error("R2 asset binding not configured");
  const bookId = String(args?.book_id || ""); if (!/^[0-9a-f-]{36}$/i.test(bookId)) throw new Error("Valid book_id required");
  const minutes = Math.min(Math.max(Number(args?.duration_minutes || 15),8),20);
  const recent = await env.DB!.prepare("SELECT COUNT(*) AS total FROM admin_access_logs WHERE user_id=? AND reason='ai:generate-podcast' AND datetime(created_at)>=datetime('now','-1 hour')").bind(principal.id).first();
  if (Number(recent?.total || 0) >= 8) throw new Error("Podcast generation rate limit reached");
  const book = await env.DB!.prepare("SELECT id,title,author,tagline,overview,deep_summary,key_ideas,deep_analysis,daily_application,language FROM books WHERE id=? LIMIT 1").bind(bookId).first() as any;
  if (!book) throw new Error("Book not found"); if (!book.overview && !book.deep_summary) throw new Error("Generate book content before creating the podcast");
  const lang: "en" | "hi" = (args?.language || book.language) === "hi" ? "hi" : "en";
  const script = await buildPodcast(env,book,lang,minutes); const parts: Uint8Array[]=[]; for (const chunk of splitTts(script)) parts.push(await synthesize(env,chunk,lang));
  const audio = concat(parts); const key = `${book.id}/podcast-${lang}-${Date.now()}.mp3`;
  await env.BOOK_ASSETS.put(key,audio,{httpMetadata:{contentType:"audio/mpeg",cacheControl:"public, max-age=31536000, immutable"}});
  const audioUrl = `/media/assets/${key.split("/").map(encodeURIComponent).join("/")}`; const now=new Date().toISOString();
  await env.DB!.prepare(`INSERT INTO book_assets (id,book_id,audio_url,status,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(book_id) DO UPDATE SET audio_url=excluded.audio_url,status='published',updated_at=excluded.updated_at`).bind(crypto.randomUUID(),book.id,audioUrl,"published",now,now).run();
  await env.DB!.prepare(`INSERT INTO admin_access_logs (id,attempted_email,user_id,ip_address,user_agent,outcome,reason,created_at) VALUES (?,?,?,?,?,'allowed','ai:generate-podcast',?)`).bind(crypto.randomUUID(),principal.email,principal.id,request.headers.get("cf-connecting-ip"),request.headers.get("user-agent"),now).run();
  return { ok:true,audio_url:audioUrl,language:lang,target_duration_minutes:minutes,script_words:script.split(/\s+/).length,parts:parts.length };
}

async function callTool(request: Request, env: OAuthMcpEnv, principal: TokenPrincipal, name: string, args: any) {
  const need = (scope: string) => { if (!hasScope(principal,scope)) throw new Error(`Missing required scope: ${scope}`); };
  if (name === "search_books") {
    need("mcp:read"); const take=Math.min(Math.max(Number(args?.limit||10),1),50); const q=String(args?.query||"").replace(/[^\p{L}\p{N}\s-]/gu," ").trim(); const language=args?.language === "hi" ? "hi" : args?.language === "en" ? "en" : null; const category=typeof args?.category === "string" ? args.category.trim() : "";
    const clauses=["is_draft=0","status IN ('published','published_noindex')"]; const binds:any[]=[]; if(q){clauses.push("(lower(title) LIKE lower(?) OR lower(author) LIKE lower(?))");binds.push(`%${q}%`,`%${q}%`);} if(language){clauses.push("language=?");binds.push(language);} if(category){clauses.push("lower(category)=lower(?)");binds.push(category);} binds.push(take);
    const rows=await env.DB!.prepare(`SELECT slug,title,author,category,language,reading_time,rating FROM books WHERE ${clauses.join(" AND ")} ORDER BY rating DESC,title ASC LIMIT ?`).bind(...binds).all(); return textResult(rows.results||[],{books:(rows.results||[]) as any});
  }
  if (name === "get_book_summary") {
    need("mcp:read"); const slug=String(args?.slug||"").trim(); const row=await env.DB!.prepare(`SELECT slug,title,author,category,language,reading_time,rating,tagline,overview,cover_url FROM books WHERE is_draft=0 AND status IN ('published','published_noindex') AND (slug=? OR seo_slug=?) LIMIT 1`).bind(slug,slug).first(); if(!row) return toolError(`No published book found for slug '${slug}'.`); return textResult(row,{book:row as any});
  }
  if (name === "list_my_library") {
    need("mcp:read"); const rows=await env.DB!.prepare(`SELECT b.slug,b.title,b.author,b.category,b.language,l.created_at AS saved_at,rp.completed,rp.last_read_at FROM library l JOIN books b ON b.id=l.book_id LEFT JOIN reading_progress rp ON rp.user_id=l.user_id AND rp.book_id=l.book_id WHERE l.user_id=? ORDER BY datetime(l.created_at) DESC`).bind(principal.id).all(); const items=(rows.results||[]).map((row:any)=>({...row,progress:row.completed==null?null:{completed:Boolean(row.completed),last_read_at:row.last_read_at}})); return textResult(items,{items});
  }
  if (name === "add_book_to_library") {
    need("mcp:write"); const slug=String(args?.slug||"").trim(); const book=await env.DB!.prepare(`SELECT id,slug,title FROM books WHERE is_draft=0 AND status IN ('published','published_noindex') AND (slug=? OR seo_slug=?) LIMIT 1`).bind(slug,slug).first() as any; if(!book) return toolError(`No published book found for slug '${slug}'.`); await env.DB!.prepare(`INSERT INTO library (id,user_id,book_id,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id,book_id) DO NOTHING`).bind(crypto.randomUUID(),principal.id,book.id,new Date().toISOString()).run(); return textResult(`Saved "${book.title}" to your library.`,{saved:{slug:book.slug,title:book.title}});
  }

  need("mcp:admin"); if (!(await isAdmin(env.DB!,principal.id))) return toolError("Administrator role required");
  if (name === "admin_update_book") {
    const bookId=String(args?.book_id||""); const patch=args?.patch && typeof args.patch === "object" ? args.patch : {}; const allowed=["title","author","tagline","overview","category","meta_title","meta_description"]; const entries=allowed.filter(k=>typeof patch[k] === "string" && patch[k].trim()).map(k=>[k,String(patch[k]).trim()] as const); if(!/^[0-9a-f-]{36}$/i.test(bookId)||!entries.length) return toolError("Valid book_id and at least one approved field are required"); await env.DB!.prepare(`UPDATE books SET ${entries.map(([k])=>`${k}=?`).join(",")} WHERE id=?`).bind(...entries.map(([,v])=>v),bookId).run(); const row=await env.DB!.prepare("SELECT id,title,author,tagline,overview,category,meta_title,meta_description FROM books WHERE id=? LIMIT 1").bind(bookId).first(); return row?textResult(row,{book:row as any}):toolError("Book not found");
  }
  if (name === "admin_create_book") {
    const title=String(args?.title||"").trim(),author=String(args?.author||"").trim(),slug=String(args?.slug||"").trim(),category=String(args?.category||"").trim(),language=args?.language === "hi" ? "hi" : "en"; if(!title||!author||!category||!/^([a-z0-9]+)(-[a-z0-9]+)*$/.test(slug)) return toolError("Valid title, author, category and lowercase hyphenated slug are required"); const exists=await env.DB!.prepare("SELECT 1 AS ok FROM books WHERE slug=? LIMIT 1").bind(slug).first(); if(exists) return toolError("A book with this slug already exists"); const id=crypto.randomUUID(),now=new Date().toISOString(); await env.DB!.prepare(`INSERT INTO books (id,slug,title,author,category,language,year,tagline,is_draft,status,seo_slug,created_at) VALUES (?,?,?,?,?,?,?,?,1,'pending',?,?)`).bind(id,slug,title.slice(0,300),author.slice(0,200),category.slice(0,100),language,args?.year==null?null:Number(args.year),typeof args?.tagline === "string"?args.tagline.slice(0,500):null,slug,now).run(); const row=await env.DB!.prepare("SELECT id,slug,title,author,category,language,year,is_draft,status FROM books WHERE id=?").bind(id).first(); return textResult(row,{book:row as any});
  }
  if (name === "admin_generate_book_content") {
    const data=await invokeAdminWithSession(request,env,principal,"/api/admin/ai/generate-content",{book_id:args?.book_id,language:args?.language},handleAdminContentAiRoute); return textResult(data,{result:data});
  }
  if (name === "admin_generate_book_cover") {
    const data=await invokeAdminWithSession(request,env,principal,"/api/admin/ai/generate-cover",{book_id:args?.book_id,prompt:args?.prompt},handleAdminMediaAiRoute); return textResult(data,{result:data});
  }
  if (name === "admin_generate_book_podcast") {
    const data=await generatePodcast(request,env,principal,args); return textResult(data,{result:data});
  }
  if (name === "admin_publish_book") {
    const bookId=String(args?.book_id||""); const book=await env.DB!.prepare("SELECT id,slug,title,overview,deep_summary,cover_url FROM books WHERE id=? LIMIT 1").bind(bookId).first() as any; if(!book) return toolError("Book not found"); if(!book.overview||!book.deep_summary||!book.cover_url) return toolError("Book needs overview, deep summary and cover before publication"); await env.DB!.prepare("UPDATE books SET is_draft=0,status='published' WHERE id=?").bind(bookId).run(); const row=await env.DB!.prepare("SELECT id,slug,title,is_draft,status,cover_url FROM books WHERE id=?").bind(bookId).first(); return textResult(row,{book:row as any});
  }
  return toolError(`Unknown tool: ${name}`);
}

async function mcp(request: Request, env: OAuthMcpEnv) {
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const principal = await oauthPrincipal(request,env.DB);
  if (!principal) {
    const origin=new URL(request.url).origin;
    return json({ error:"invalid_token" },{status:401,headers:{"www-authenticate":`Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`}});
  }
  const body=await request.json().catch(()=>null) as any; if(!body||body.jsonrpc!=="2.0"||typeof body.method!=="string") return json({jsonrpc:"2.0",id:body?.id??null,error:{code:-32600,message:"Invalid Request"}},{status:400});
  if (body.id === undefined && body.method.startsWith("notifications/")) return new Response(null,{status:202});
  try {
    let result:any;
    if(body.method==="initialize") result={protocolVersion:String(body.params?.protocolVersion||"2025-06-18"),capabilities:{tools:{listChanged:false}},serverInfo:{name:"booknomics",title:"Booknomics MCP",version:"1.0.0"},instructions:"Search Booknomics summaries, manage your library, and use admin publishing tools when your account has administrator access."};
    else if(body.method==="ping") result={};
    else if(body.method==="tools/list") result={tools:toolDefinitions()};
    else if(body.method==="tools/call") result=await callTool(request,env,principal,String(body.params?.name||""),body.params?.arguments||{});
    else return json({jsonrpc:"2.0",id:body.id??null,error:{code:-32601,message:"Method not found"}});
    return json({jsonrpc:"2.0",id:body.id??null,result});
  } catch(error) {
    console.error("MCP request failed",error);
    return json({jsonrpc:"2.0",id:body.id??null,result:toolError(error instanceof Error?error.message:"Tool failed")});
  }
}

export async function handleOAuthMcpRoute(request: Request, env: OAuthMcpEnv): Promise<Response | null> {
  const url=new URL(request.url); const path=url.pathname;
  try {
    if ((path === "/.well-known/oauth-authorization-server" || path === "/.well-known/openid-configuration") && request.method === "GET") return metadata(request,"authorization");
    if (path === "/.well-known/oauth-protected-resource" && request.method === "GET") return metadata(request,"resource");
    if (path === "/oauth/register" && request.method === "POST") return await registerClient(request,env);
    if (path === "/oauth/authorize" && request.method === "GET") return await authorize(request,env);
    if (path === "/oauth/token" && request.method === "POST") return await tokenEndpoint(request,env);
    if (path === "/oauth/revoke" && request.method === "POST") return await revoke(request,env);
    const details=path.match(/^\/api\/oauth\/authorizations\/([^/]+)$/); if(details&&request.method==="GET") return await authorizationDetails(request,env,decodeURIComponent(details[1]));
    const decision=path.match(/^\/api\/oauth\/authorizations\/([^/]+)\/decision$/); if(decision&&request.method==="POST") return await authorizationDecision(request,env,decodeURIComponent(decision[1]));
    if (path === "/mcp") return await mcp(request,env);
    return null;
  } catch(error) {
    console.error("OAuth/MCP route failed",error);
    return oauthError("server_error","OAuth/MCP request failed",500);
  }
}
