import { writeFileSync, readFileSync } from "fs";
import { loadEnv } from "vite";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { SLUG_REDIRECTS } from "../src/lib/slugRedirects";
import { SERVER_SLUG_REDIRECTS } from "../src/lib/serverSlugRedirects";
import { auditSeoSlug } from "../src/lib/seoSlugTools";
import { CATEGORY_CONTENT } from "../src/content/categoryContent";

Object.assign(process.env, { ...loadEnv(process.env.NODE_ENV || "production", process.cwd(), ""), ...process.env });

const BASE_URL = "https://www.booknomics.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before building.");

const configuredMinBooks = Number(process.env.SITEMAP_MIN_BOOKS || "50");
const safeConfiguredMinBooks = Number.isFinite(configuredMinBooks) ? Math.max(0, configuredMinBooks) : 50;
const MIN_EXPECTED_BOOKS = process.env.VERCEL_ENV === "production" ? Math.max(50, safeConfiguredMinBooks) : safeConfiguredMinBooks;
const staticPreview = process.env.ALLOW_STATIC_SITEMAP === "true";
if (staticPreview && process.env.VERCEL_ENV === "production") throw new Error("Static-only sitemap is forbidden in production.");

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20000) }) },
});

type BookRow = {
  id: string; slug: string | null; seo_slug: string | null; old_slugs: string[] | null;
  category: string | null; created_at: string | null; language: string | null;
  title: string; cover_url: string | null; status: string;
};
type Entry = { path: string; lastmod?: string; changefreq?: "daily"|"weekly"|"monthly"|"yearly"; priority?: string };

async function fetchBooks(): Promise<BookRow[]> {
  if (staticPreview) return [];
  const rows: BookRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("books")
      .select("id,slug,seo_slug,old_slugs,category,created_at,language,title,cover_url,status")
      .eq("is_draft", false).eq("status", "published").order("id").range(offset, offset + 499);
    if (error) throw new Error(`Sitemap fetch failed: ${error.message}`);
    rows.push(...((data ?? []) as BookRow[]));
    if (!data || data.length < 500) break;
  }
  return rows;
}

const escapeXml = (v: string) => v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const slugify = (s: string) => s.toLowerCase().replace(/[\\/&]+/g,"-").replace(/[^a-z0-9\u0900-\u097F]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");
const dedupe = (entries: Entry[]) => Array.from(new Map(entries.map(e => [e.path, e])).values());

function renderUrlset(entries: Entry[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(e => [
    "  <url>", `    <loc>${escapeXml(BASE_URL + e.path)}</loc>`, e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
    e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null, e.priority ? `    <priority>${e.priority}</priority>` : null, "  </url>"
  ].filter(Boolean).join("\n")).join("\n")}\n</urlset>`;
}

function renderImageSitemap(items: Array<{slug:string;title:string;cover:string}>) {
  const abs = (u:string) => u.startsWith("http") ? u : `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${items.map(b => `  <url>\n    <loc>${escapeXml(`${BASE_URL}/books/${b.slug}`)}</loc>\n    <image:image>\n      <image:loc>${escapeXml(abs(b.cover))}</image:loc>\n      <image:title>${escapeXml(b.title)}</image:title>\n      <image:caption>${escapeXml(`${b.title} — book summary on Booknomics`)}</image:caption>\n    </image:image>\n  </url>`).join("\n")}\n</urlset>`;
}

function renderRedirects(bookRedirects: Array<{from:string;to:string}>) {
  const lines = ["# Auto-generated canonical redirects", ""];
  for (const [from,to] of Object.entries(SLUG_REDIRECTS).sort(([a],[b])=>a.localeCompare(b))) if (from !== to) lines.push(`/books/${from}   /books/${to}   301!`);
  const seen = new Set<string>();
  for (const {from,to} of bookRedirects) {
    if (!from || !to || from === to || seen.has(`${from}=>${to}`)) continue;
    seen.add(`${from}=>${to}`); lines.push(`/books/${from}   /books/${to}   301!`);
  }
  return lines.join("\n") + "\n";
}

(async () => {
  try {
    const books = await fetchBooks();
    if (!staticPreview && books.length < MIN_EXPECTED_BOOKS) throw new Error(`Only ${books.length} published books returned (expected >= ${MIN_EXPECTED_BOOKS}). Refusing stale sitemap.`);
    console.log(`[sitemap-v2] published books fetched: ${books.length}`);

    const entries: Entry[] = [
      {path:"/",changefreq:"weekly",priority:"1.0"},{path:"/browse",changefreq:"daily",priority:"0.9"},{path:"/english",changefreq:"weekly",priority:"0.9"},
      {path:"/hindi",changefreq:"weekly",priority:"0.9"},{path:"/best-hindi-book-summaries",changefreq:"weekly",priority:"0.9"},{path:"/about",changefreq:"monthly",priority:"0.5"},
      {path:"/contact",changefreq:"monthly",priority:"0.4"},{path:"/press",changefreq:"monthly",priority:"0.6"},{path:"/resources",changefreq:"weekly",priority:"0.8"},
      {path:"/resources/7-day-reading-action-tracker",changefreq:"monthly",priority:"0.7"},{path:"/resources/book-summary-template",changefreq:"monthly",priority:"0.7"},
      {path:"/resources/best-book-summary-websites",changefreq:"monthly",priority:"0.7"},{path:"/resources/best-hindi-book-summaries-guide",changefreq:"monthly",priority:"0.7"},
      {path:"/blog",changefreq:"weekly",priority:"0.8"},{path:"/privacy",changefreq:"yearly",priority:"0.3"},{path:"/terms",changefreq:"yearly",priority:"0.3"},
    ];
    try { const { BLOG_POSTS } = await import("../src/content/blog"); for (const p of BLOG_POSTS) entries.push({path:`/blog/${p.slug}`,lastmod:p.publishedAt,changefreq:"monthly",priority:"0.7"}); } catch {}
    const staticCount = entries.length;

    let skippedBroken = 0;
    for (const b of books) {
      const preferred = (b.seo_slug || b.slug || "").trim(); if (!preferred) { skippedBroken++; continue; }
      const audit = auditSeoSlug(preferred, { title: b.title, language: b.language });
      if (!audit.ok && audit.score < 30) { skippedBroken++; continue; }
      entries.push({path:`/books/${preferred}`,lastmod:b.created_at?.slice(0,10),changefreq:b.language === "hi" ? "weekly" : "monthly",priority:b.language === "hi" ? "0.9" : "0.8"});
    }

    const counts = new Map<string,number>();
    for (const b of books) if (b.category) counts.set(b.category,(counts.get(b.category)??0)+1);
    const categorySlugs = new Set<string>(Object.keys(CATEGORY_CONTENT));
    for (const [category,count] of counts) if (count >= 3) { const s=slugify(category); if(s) categorySlugs.add(s); }
    for (const s of [...categorySlugs].sort()) entries.push({path:`/category/${s}`,changefreq:"weekly",priority:"0.7"});

    const finalEntries = dedupe(entries);
    const bookEntries = finalEntries.filter(e => e.path.startsWith("/books/"));
    const canonicalSlugs = new Set(bookEntries.map(e => e.path.slice("/books/".length)));
    const imageItems = books.filter(b => {const s=b.seo_slug||b.slug;return !!(s&&b.cover_url&&canonicalSlugs.has(s));}).map(b => ({slug:(b.seo_slug||b.slug)!,title:b.title,cover:b.cover_url!}));

    const bookRedirects: Array<{from:string;to:string}> = [];
    for (const b of books) {
      const to=b.seo_slug||b.slug; if(!to) continue;
      if(b.seo_slug&&b.slug&&b.slug!==b.seo_slug) bookRedirects.push({from:b.slug,to});
      for(const old of b.old_slugs??[]) if(old&&old!==to) bookRedirects.push({from:old,to});
    }

    writeFileSync(resolve("public/sitemap.xml"),renderUrlset(finalEntries));
    writeFileSync(resolve("public/books-sitemap.xml"),renderUrlset(bookEntries));
    writeFileSync(resolve("public/image-sitemap.xml"),renderImageSitemap(imageItems));
    writeFileSync(resolve("public/_redirects"),renderRedirects(bookRedirects));

    const config=JSON.parse(readFileSync(resolve("vercel.json"),"utf8"));
    const configured=new Map<string,string>((config.redirects??[]).map((r:any)=>[r.source,r.destination]));
    const middleware=new Map<string,string>(Object.entries(SERVER_SLUG_REDIRECTS).map(([from,to])=>[`/books/${encodeURIComponent(from)}`,`/books/${encodeURIComponent(to)}`]));
    const expected=new Map<string,string>();
    for(const [from,to] of [...Object.entries(SLUG_REDIRECTS),...bookRedirects.map(r=>[r.from,r.to] as [string,string])]) {
      if(from!==to&&canonicalSlugs.has(to)&&!canonicalSlugs.has(from)) expected.set(`/books/${encodeURIComponent(from)}`,`/books/${encodeURIComponent(to)}`);
    }
    const missing=[...expected].filter(([source,destination])=>configured.get(source)!==destination&&middleware.get(source)!==destination);
    if(missing.length) throw new Error(`[redirects] hosting config is missing ${missing.length} canonical redirects. First missing: ${missing[0][0]} → ${missing[0][1]}`);

    console.log(`[sitemap-v2] ✅ sitemap ${finalEntries.length} · books ${bookEntries.length} · images ${imageItems.length} · categories ${categorySlugs.size} · broken skipped ${skippedBroken} · middleware redirects ${middleware.size}`);
  } catch (err) {
    console.error("[sitemap-v2] Build stopped to protect published SEO:", err instanceof Error ? err.message : err);
    process.exitCode=1;
  }
})();
