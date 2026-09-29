// Shared security helpers for Supabase Edge Functions.
// Rate limiting: fixed-window, in-memory. Note this is per warm instance;
// combine with the platform's request concurrency limits for defense in depth.

const ALLOWED_ORIGINS = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "").split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Defaults keep local dev working; production should set CORS_ALLOWED_ORIGINS.
const DEV_ORIGINS = new Set([
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
]);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  let allowOrigin = "";
  const trusted = origin === "https://booknomics.com" || origin === "https://www.booknomics.com";
  if (trusted || ALLOWED_ORIGINS.includes(origin) || DEV_ORIGINS.has(origin)) {
    allowOrigin = origin;
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

// Fixed-window in-memory rate limiter.
// Returns { ok: true } or { ok: false, retryAfterSeconds }.
const buckets = new Map<string, { windowStart: number; expiresAt: number; count: number }>();

export function checkRateLimit(key: string, max: number, windowSeconds: number): {
  ok: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.windowStart >= windowSeconds * 1000) {
    buckets.set(key, { windowStart: now, expiresAt: now + windowSeconds * 1000, count: 1 });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= max) {
    const retryAfter = Math.ceil((entry.windowStart + windowSeconds * 1000 - now) / 1000);
    return { ok: false, retryAfterSeconds: retryAfter };
  }
  entry.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

// Prevent unbounded memory growth: periodically prune expired buckets.
const PRUNE_INTERVAL_MS = 60 * 1000;
let lastPrune = Date.now();
export function maybePruneRateLimits(): void {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  for (const [key, entry] of buckets) {
    if (now >= entry.expiresAt) buckets.delete(key);
  }
}

// Build a 429 response with Retry-After.
export function rateLimitedResponse(req: Request, retryAfterSeconds: number): Response {
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSeconds),
    },
  });
}
