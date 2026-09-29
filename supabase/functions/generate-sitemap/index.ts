// Dynamic sitemap for booknomics.com — public, no JWT.
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
    .replace(/[\/&]+/g, "-")
    .replace(/[^a-z0-9\u0900-\u097F]+/g, "-")
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
  </url>`).join("\n")}
</urlset>`;

Deno.serve(async (req) => {
  maybePruneRateLimits();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });

  // Rate limiting for public sitemap endpoint (e.g. max 30 requests per minute per IP)
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
    { loc: `${SITE}/`,           changefreq: "weekly",  priority: 1.0 },
    { loc: `${SITE}/browse`,     changefreq: "daily",   priority: 0.9 },
    { loc: `${SITE}/english`,    changefreq: "weekly",  priority: 0.9 },
    { loc: `${SITE}/hindi`,      changefreq: "weekly",  priority: 0.9 },
    { loc: `${SITE}/best-hindi-book-summaries`, changefreq: "weekly", priority: 0.9 },
    { loc: `${SITE}/about`,      changefreq: "monthly", priority: 0.5 },
    { loc: `${SITE}/privacy`,    changefreq: "yearly",  priority: 0.3 },
    { loc: `${SITE}/terms`,      changefreq: "yearly",  priority: 0.3 },
  ];

  const { data: books } = await supabase
    .from("books")
    .select("slug, created_at, category, language")
    .eq("is_draft", false)
    .order("created_at", { ascending: false })
    .range(0, 4999);

  const bookUrls: SitemapUrl[] = Array.from(new Map((books ?? [])
    .filter(b => b.slug)
    .map(b => [`/books/${b.slug}`, {
      loc: `${SITE}/books/${b.slug}`,
      lastmod: (b.created_at ?? today).toString().split("T")[0],
      changefreq: ((b as any).language === "hi" ? "weekly" : "monthly") as ChangeFreq,
      priority: (b as any).language === "hi" ? 0.9 : 0.8,
    }])).values());

  const categoryUrls: SitemapUrl[] = Array.from(new Set((books ?? []).map(b => b.category).filter(Boolean)))
    .map(c => slugify(String(c)))
    .filter(Boolean)
    .map(slug => ({
      loc: `${SITE}/category/${slug}`,
      lastmod: today,
      changefreq: "weekly" as ChangeFreq,
      priority: 0.7,
    }));

  const urls = bookSitemapOnly ? bookUrls : [
    ...staticUrls.map(u => ({ ...u, lastmod: today })),
    ...categoryUrls,
    ...bookUrls,
  ];

  const xml = renderUrlset(urls);

  return new Response(xml, {
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
