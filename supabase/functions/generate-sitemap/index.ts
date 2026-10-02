// Dynamic sitemap for booknomics.com — public, no JWT.
// Mirrors the production build-time sitemap rules: only indexable books are
// emitted and seo_slug is preferred over legacy/raw slugs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, checkRateLimit, maybePruneRateLimits, rateLimitedResponse } from "../_shared/security.ts";

const SITE = "https://booknomics.com";

type ChangeFreq = "daily" | "weekly" | "monthly" | "yearly";
type SitemapUrl = {
  loc: string;
  lastmod?: string;
  changefreq: ChangeFreq;
  priority: number;
};

const slugify = (s: string) =>
  s.toLowerCase()
    .replace(/[\\/&]+/g, "-")
    .replace(/[^a-z0-9\\u0900-\\u097F]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const renderUrlset = (urls: SitemapUrl[]) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\\n")}
</urlset>`;

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });

  const ip = req.headers.get("x-forwarded-for") || "unknown-ip";
  const rl = checkRateLimit(`sitemap:${ip}`, 30, 60);
  if (!rl.ok) return rateLimitedResponse(req, rl.retryAfterSeconds);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const today = new Date().toISOString().split("T")[0];
  const url = new URL(req.url);
  const bookSitemapOnly = url.pathname.endsWith("/books-sitemap") || url.pathname.endsWith("/books-sitemap.xml");

  const staticUrls: SitemapUrl[] = [
    { loc: `${SITE}/`, changefreq: "weekly", priority: 1.0 },
    { loc: `${SITE}/browse`, changefreq: "daily", priority: 0.9 },
    { loc: `${SITE}/english`, changefreq: "weekly", priority: 0.9 },
    { loc: `${SITE}/hindi`, changefreq: "weekly", priority: 0.9 },
    { loc: `${SITE}/best-hindi-book-summaries`, changefreq: "weekly", priority: 0.9 },
    { loc: `${SITE}/about`, changefreq: "monthly", priority: 0.5 },
    { loc: `${SITE}/contact`, changefreq: "monthly", priority: 0.4 },
    { loc: `${SITE}/press`, changefreq: "monthly", priority: 0.6 },
    { loc: `${SITE}/resources`, changefreq: "weekly", priority: 0.8 },
    { loc: `${SITE}/resources/7-day-reading-action-tracker`, changefreq: "monthly", priority: 0.7 },
    { loc: `${SITE}/resources/book-summary-template`, changefreq: "monthly", priority: 0.7 },
    { loc: `${SITE}/resources/best-book-summary-websites`, changefreq: "monthly", priority: 0.7 },
    { loc: `${SITE}/resources/best-hindi-book-summaries-guide`, changefreq: "monthly", priority: 0.7 },
    { loc: `${SITE}/blog`, changefreq: "weekly", priority: 0.8 },
    { loc: `${SITE}/privacy`, changefreq: "yearly", priority: 0.3 },
    { loc: `${SITE}/terms`, changefreq: "yearly", priority: 0.3 },
  ];

  const books: any[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("books")
      .select("slug,seo_slug,created_at,category,language,status")
      .eq("is_draft", false)
      .eq("status", "published")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) {
      return new Response(`Sitemap query failed: ${error.message}`, {
        status: 503,
        headers: { ...corsHeaders(req), "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    books.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  const bookUrls: SitemapUrl[] = Array.from(new Map(books
    .map((b) => {
      const preferred = (b.seo_slug || b.slug || "").trim();
      if (!preferred) return null;
      return [preferred, {
        loc: `${SITE}/books/${preferred}`,
        lastmod: (b.created_at ?? today).toString().split("T")[0],
        changefreq: b.language === "hi" ? "weekly" as ChangeFreq : "monthly" as ChangeFreq,
        priority: b.language === "hi" ? 0.9 : 0.8,
      }] as const;
    })
    .filter(Boolean) as Array<readonly [string, SitemapUrl]>).values());

  const categoryCounts = new Map<string, number>();
  for (const b of books) {
    if (!b.category) continue;
    const category = String(b.category);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  const categoryUrls: SitemapUrl[] = Array.from(categoryCounts.entries())
    .filter(([, count]) => count >= 3)
    .map(([category]) => slugify(category))
    .filter(Boolean)
    .map((slug) => ({
      loc: `${SITE}/category/${slug}`,
      lastmod: today,
      changefreq: "weekly" as ChangeFreq,
      priority: 0.7,
    }));

  const urls = bookSitemapOnly
    ? bookUrls
    : [...staticUrls.map((u) => ({ ...u, lastmod: today })), ...categoryUrls, ...bookUrls];

  const xml = renderUrlset(urls);
  return new Response(xml, {
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=300",
    },
  });
});
