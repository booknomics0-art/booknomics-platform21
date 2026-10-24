import appWorker from "./appEntry";
import { handleOAuthMcpRoute } from "./oauthMcpRoutes";
import { handleSocialRoute } from "./socialRoutes";
import { handleCompatRoute } from "./compatRoutes";
import { handlePaymentRoute } from "./paymentRoutes";
import { handleRecurringBillingRoute } from "./recurringBillingRoutes";
import { handleGrowthRoute } from "./growthRoutes";
import { handleBookAiRoute } from "./bookAiRoutes";
import { handleBookDetailRoute } from "./bookDetailRoutes";
import { handleCatalogRoute } from "./catalogRoutes";
import { handleAudioRoute } from "./audioRoutes";
import { handleAdminRoute } from "./adminRoutes";
import { handleAdminOpsRoute } from "./adminOpsRoutes";
import { handleAdminGscRoute } from "./adminGscRoutes";
import { handleCutoverAdminRoute } from "./cutoverAdminRoutes";
import { handleCutoverFeatureRoute } from "./cutoverFeatureRoutes";
import { handleAdminAiRoute } from "./adminAiRoutes";
import { handleAdminContentAiRoute } from "./adminContentAiRoutes";
import { handleAdminMediaAiRoute } from "./adminMediaAiRoutes";
import { handleSitemapDataRoute } from "./sitemapRoutes";
import { handleSubjectiveMasteryRoute } from "./subjectiveMasteryRoutes";

type D1 = any;
type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: D1;
  BOOK_COVERS?: any;
  BOOK_ASSETS?: any;
  BOOKNOMICS_ENV?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_SEARCH_CONSOLE_API_KEY?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  LOVABLE_API_KEY?: string;
  GEMINI_API_KEY?: string;
  XAI_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
};

type SafeUser = { id: string; email: string; display_name: string | null; avatar_url: string | null };
const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();
const PREMIUM_FIELDS = ["action_system", "practice_tracker", "reflection_questions", "real_life_example"] as const;

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...init.headers },
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
    `SELECT u.id, u.email, u.display_name, u.avatar_url
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now') LIMIT 1`,
  ).bind(tokenHash).first();
  return row ? row as SafeUser : null;
}

async function premiumSummary(request: Request, env: Env, bookId: string) {
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });
  if (!/^[0-9a-f-]{36}$/i.test(bookId)) return json({ error: "Bad book id" }, { status: 400 });
  const user = await currentUser(request, env.DB);
  if (!user) return json({ error: "Authentication required" }, { status: 401 });
  const sub = await env.DB.prepare(
    `SELECT 1 AS ok FROM subscriptions WHERE user_id = ? AND status = 'active'
     AND (expires_at IS NULL OR datetime(expires_at) > datetime('now')) LIMIT 1`,
  ).bind(user.id).first();
  if (!sub) return json({ error: "Premium subscription required" }, { status: 403 });
  const row = await env.DB.prepare(
    `SELECT action_system, practice_tracker, reflection_questions, real_life_example
     FROM books WHERE id = ? AND is_draft = 0 AND status IN ('published','published_noindex') LIMIT 1`,
  ).bind(bookId).first();
  if (!row) return json({ error: "Book not found" }, { status: 404 });
  return json({ data: row });
}

async function stripPremiumFields(response: Response) {
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return response;
  const payload = await response.json().catch(() => null) as any;
  if (!payload?.data || Array.isArray(payload.data) || typeof payload.data !== "object") return response;
  for (const field of PREMIUM_FIELDS) delete payload.data[field];
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(payload), { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url);
    if (requestUrl.hostname === "booknomics.com") {
      requestUrl.hostname = "www.booknomics.com";
      return Response.redirect(requestUrl.toString(), 308);
    }

    const oauthMcp = await handleOAuthMcpRoute(request, env);
    if (oauthMcp) return oauthMcp;

    const recurringPayment = await handleRecurringBillingRoute(request, env);
    if (recurringPayment) return recurringPayment;

    const payment = await handlePaymentRoute(request, env);
    if (payment) return payment;

    const growth = await handleGrowthRoute(request, env);
    if (growth) return growth;

    const cutoverFeature = await handleCutoverFeatureRoute(request, env);
    if (cutoverFeature) return cutoverFeature;

    const subjectiveMastery = await handleSubjectiveMasteryRoute(request, env);
    if (subjectiveMastery) return subjectiveMastery;

    const bookAi = await handleBookAiRoute(request, env);
    if (bookAi) return bookAi;

    const bookDetail = await handleBookDetailRoute(request, env);
    if (bookDetail) return bookDetail;

    const catalog = await handleCatalogRoute(request, env);
    if (catalog) return catalog;

    const audio = await handleAudioRoute(request, env);
    if (audio) return audio;

    const admin = await handleAdminRoute(request, env);
    if (admin) return admin;

    const adminOps = await handleAdminOpsRoute(request, env);
    if (adminOps) return adminOps;

    const adminGsc = await handleAdminGscRoute(request, env);
    if (adminGsc) return adminGsc;

    const cutoverAdmin = await handleCutoverAdminRoute(request, env);
    if (cutoverAdmin) return cutoverAdmin;

    const adminAi = await handleAdminAiRoute(request, env);
    if (adminAi) return adminAi;

    const adminContentAi = await handleAdminContentAiRoute(request, env);
    if (adminContentAi) return adminContentAi;

    const adminMediaAi = await handleAdminMediaAiRoute(request, env);
    if (adminMediaAi) return adminMediaAi;

    const sitemapData = await handleSitemapDataRoute(request, env);
    if (sitemapData) return sitemapData;

    const compat = await handleCompatRoute(request, env);
    if (compat) return compat;
    const social = await handleSocialRoute(request, env);
    if (social) return social;

    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/premium-summary/") && request.method === "GET") {
      return premiumSummary(request, env, decodeURIComponent(url.pathname.slice("/api/premium-summary/".length)));
    }
    if (url.pathname.startsWith("/api/books/") && request.method === "GET") {
      return stripPremiumFields(await appWorker.fetch(request, env as any));
    }
    return appWorker.fetch(request, env as any);
  },
};
