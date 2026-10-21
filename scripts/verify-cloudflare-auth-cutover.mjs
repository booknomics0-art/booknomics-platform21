#!/usr/bin/env node
/**
 * Verify that the public Booknomics frontend and the Cloudflare Auth backend
 * belong to the same release. A green static-hosting build is insufficient:
 * a Supabase frontend can otherwise be served alongside Cloudflare /api.
 *
 * Usage: AUTH_SMOKE_BASE_URL=https://www.booknomics.com node scripts/verify-cloudflare-auth-cutover.mjs
 * Only prints non-sensitive diagnostics. Never prints OAuth states, cookies or tokens.
 */
const baseValue = process.env.AUTH_SMOKE_BASE_URL || process.argv[2];
if (!baseValue) throw new Error("Set AUTH_SMOKE_BASE_URL to the site/preview origin");
const base = new URL(baseValue);
if (base.protocol !== "https:") throw new Error("Auth smoke target must use HTTPS");
if (base.pathname !== "/" || base.search || base.hash) throw new Error("Use a site origin, not a path");
const origin = base.origin;

async function read(path, { redirect = "follow" } = {}) {
  const url = new URL(path, origin);
  if (url.origin !== origin) throw new Error("Refusing cross-origin asset fetch");
  const response = await fetch(url, {
    redirect,
    signal: AbortSignal.timeout(20000),
    headers: { "cache-control": "no-cache", "accept": "*/*" },
  });
  return response;
}

function assert(ok, description) {
  if (!ok) throw new Error(description);
}

function relativeAsset(asset) {
  const url = new URL(asset, origin);
  assert(url.origin === origin, "Frontend asset points to an unexpected origin");
  assert(url.pathname.startsWith("/assets/") && url.pathname.endsWith(".js"), "Expected Vite JS asset");
  return url.pathname + url.search;
}

const healthResponse = await read("/api/health");
assert(healthResponse.status === 200, `Cloudflare health returned HTTP ${healthResponse.status}`);
const health = await healthResponse.json();
assert(health.platform === "cloudflare" && health.ok === true, "Wrong API platform");
assert(health.bindings?.d1 === true, "D1 binding missing");
assert(health.bindings?.googleOAuth === true, "Google OAuth bindings missing");
assert(health.bindings?.coversR2 === true && health.bindings?.assetsR2 === true, "R2 bindings missing");
console.log("PASS: Cloudflare API and D1/R2/OAuth bindings");

const sessionResponse = await read("/api/auth/session");
assert(sessionResponse.status === 200, `Anonymous session returned HTTP ${sessionResponse.status}`);
assert((sessionResponse.headers.get("content-type") || "").includes("application/json"), "Session endpoint did not return JSON");
assert((sessionResponse.headers.get("cache-control") || "").includes("no-store"), "Session response is cacheable");
const session = await sessionResponse.json();
assert(Object.prototype.hasOwnProperty.call(session, "user"), "Session payload lacks user field");
assert(session.user === null, "Anonymous smoke unexpectedly has a user; do not share session credentials");
console.log("PASS: Same-origin, non-cacheable session endpoint");

const googleResponse = await read("/api/auth/google/start?return_to=%2Fdashboard", { redirect: "manual" });
assert(googleResponse.status === 302, `Google OAuth start returned HTTP ${googleResponse.status}`);
const googleLocation = new URL(googleResponse.headers.get("location") || "");
assert(googleLocation.origin === "https://accounts.google.com", "OAuth start does not redirect to Google");
assert(googleLocation.searchParams.get("redirect_uri") === `${origin}/api/auth/google/callback`, "Google redirect_uri does not match the Cloudflare site origin");
const stateCookie = googleResponse.headers.get("set-cookie") || "";
assert(/^bn_oauth_state=/i.test(stateCookie), "OAuth start does not set its state cookie");
assert(/;\s*httponly\b/i.test(stateCookie) && /;\s*secure\b/i.test(stateCookie) && /;\s*samesite=lax\b/i.test(stateCookie), "OAuth state cookie security attributes missing");
console.log("PASS: Google OAuth start, canonical redirect and state cookie");

const htmlResponse = await read("/auth?auth_cutover_probe=1");
assert(htmlResponse.status === 200, `Auth page returned HTTP ${htmlResponse.status}`);
const html = await htmlResponse.text();
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js(?:\?[^"']*)?)["']/gi)].map(match => match[1]);
assert(scripts.length > 0, "Auth page has no JS entry script");
const entryAsset = scripts.find(src => /\/assets\/index-[\w-]+\.js(?:\?|$)/.test(src)) || scripts[0];
const entryResponse = await read(relativeAsset(entryAsset));
assert(entryResponse.status === 200, "Cannot read Vite entry asset");
const entry = await entryResponse.text();
const authChunks = [...new Set([...entry.matchAll(/Auth-[A-Za-z0-9_-]+\.js/g)].map(match => match[0]))];
assert(authChunks.length > 0, "Cannot locate lazy-loaded Auth chunk in Vite bundle");

const chunks = await Promise.all(authChunks.slice(0, 6).map(async chunkName => {
  const response = await read(`/assets/${chunkName}`);
  assert(response.status === 200, `Cannot read ${chunkName}`);
  return response.text();
}));
const browserJS = [entry, ...chunks].join("\n");

assert(!/\.auth\.signInWithOAuth\s*\(/.test(browserJS), "BLOCK: live auth bundle still calls Supabase Google OAuth");
assert(!/pbkfewrtdgiagytmcigb\.supabase\.co/.test(browserJS), "BLOCK: legacy Supabase host found in auth JS bundle");
assert(browserJS.includes("/api/auth/session"), "BLOCK: frontend does not request Cloudflare sessions");
assert(browserJS.includes("/api/auth/google/start"), "BLOCK: frontend does not start Cloudflare Google OAuth");
console.log("PASS: /auth browser JS uses Cloudflare Auth and has no legacy Supabase OAuth");
console.log("PASS: Cloudflare frontend/backend release consistency smoke");
