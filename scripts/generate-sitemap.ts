// Runs before `vite dev` and `vite build` (predev/prebuild hooks).
// Writes public/sitemap.xml, public/books-sitemap.xml, and public/_redirects.
import { writeFileSync, readFileSync } from "fs";
import { loadEnv } from "vite";
Object.assign(process.env, { ...loadEnv(process.env.NODE_ENV || "production", process.cwd(), ""), ...process.env });
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { SLUG_REDIRECTS } from "../src/lib/slugRedirects";
import { auditSeoSlug } from "../src/lib/seoSlugTools";
import { CATEGORY_CONTENT } from "../src/content/categoryContent";

const BASE_URL = "https://booknomics.com";

const ENV_SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
const ENV_SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!ENV_SUPABASE_URL || !ENV_SUPABASE_KEY) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before building.');
const SUPABASE_URL = ENV_SUPABASE_URL;
const SUPABASE_KEY = ENV_SUPABASE_KEY;
const configuredMinBooks = Number(process.env.SITEMAP_MIN_BOOKS || '50');
const safeConfiguredMinBooks = Number.isFinite(configuredMinBooks) ? Math.max(0, configuredMinBooks) : 50;
// Never allow a production deployment to silently publish an empty/stale sitemap.
// Local/preview builds may intentionally set 0 while the catalog is being prepared.
const MIN_EXPECTED_BOOKS = process.env.VERCEL_ENV === 'production'
  ? Math.max(50, safeConfiguredMinBooks)
  : safeConfiguredMinBooks;
const staticPreview = process.env.ALLOW_STATIC_SITEMAP === 'true';
if (staticPreview && process.env.VERCEL_ENV === 'production') throw new Error('Static-only sitemap is forbidden in production.');
const makeClient = () => createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }) },
});
async function fetchBooks() {
  if (staticPreview) return [];
  const db = makeClient();
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('books')
      .select('id,slug,seo_slug,old_slugs,category,created_at,language,title,cover_url,status')
      .eq('is_draft', false)
      .eq('status', 'published')
      .order('id').range(offset, offset + 499);
    if (error) throw new Error(`Sitemap fetch failed: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}
const bookRowsPromise = fetchBooks();

interface Entry {
  path: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: string;
}

const slugify = (s: string) =>
  s.toLowerCase()
    .replace(/[\/&]+/g, "-")
    .replace(/[^a-z0-9\u0900-\u097F]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const dedupe = (entries: Entry[]) => Array.from(new Map(entries.map((e) => [e.path, e])).values());

async function build(): Promise<{ entries: Entry[]; bookCount: number; staticCount: number }> {
  console.log("[sitemap] VITE_SUPABASE_URL present:", !!ENV_SUPABASE_URL, "| VITE_SUPABASE_PUBLISHABLE_KEY present:", !!ENV_SUPABASE_KEY);
  console.log("[sitemap] using Supabase URL:", SUPABASE_URL, ENV_SUPABASE_URL ? "(env)" : "(fallback)");

  const entries: Entry[] = [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/browse", changefreq: "daily", priority: "0.9" },
    { path: "/english", changefreq: "weekly", priority: "0.9" },
    { path: "/hindi", changefreq: "weekly", priority: "0.9" },
    { path: "/best-hindi-book-summaries", changefreq: "weekly", priority: "0.9" },
    { path: "/about", changefreq: "monthly", priority: "0.5" },
    { path: "/contact", changefreq: "monthly", priority: "0.4" },
    { path: "/press", changefreq: "monthly", priority: "0.6" },
    { path: "/resources", changefreq: "weekly", priority: "0.8" },
    { path: "/resources/7-day-reading-action-tracker", changefreq: "monthly", priority: "0.7" },
    { path: "/resources/book-summary-template", changefreq: "monthly", priority: "0.7" },
    { path: "/resources/best-book-summary-websites", changefreq: "monthly", priority: "0.7" },
    { path: "/resources/best-hindi-book-summaries-guide", changefreq: "monthly", priority: "0.7" },
    { path: "/blog", changefreq: "weekly", priority: "0.8" },
    { path: "/privacy", changefreq: "yearly", priority: "0.3" },
    { path: "/terms", changefreq: "yearly", priority: "0.3" },
  ];

  // Static blog posts (file-based)
  try {
    const { BLOG_POSTS } = await import("../src/content/blog");
    for (const p of BLOG_POSTS) {
      entries.push({ path: `/blog/${p.slug}`, lastmod: p.publishedAt, changefreq: "monthly", priority: "0.7" });
    }
  } catch {}

  const staticCount = entries.length;
  console.log(`[sitemap] static + blog entries: ${staticCount}`);

  const books = await bookRowsPromise;

  const bookCount = books?.length ?? 0;
  console.log(`[sitemap] published books fetched: ${bookCount}`);

  if (!staticPreview && bookCount < MIN_EXPECTED_BOOKS) {
    throw new Error(
      `[sitemap] Only ${bookCount} published books returned (expected >= ${MIN_EXPECTED_BOOKS}). ` +
        `Refusing to write a stale sitemap. Check Supabase connectivity and the is_draft/status filters.`,
    );
  }

  let skippedBroken = 0;
  for (const b of books!) {
    const isHi = (b as any).language === "hi";
    // Prefer the keyword URL (seo_slug) when set. Fall back to the canonical slug.
    const preferred = ((b as any).seo_slug as string | null) || b.slug;
    if (!preferred) { skippedBroken++; continue; }
    // Skip garbage auto-suffix slugs like "-etkl", "--apt8" from failed Devanagari slugify.
    const audit = auditSeoSlug(preferred, { title: (b as any).title, language: (b as any).language });
    if (!audit.ok && audit.score < 30) {
      console.warn(`[sitemap] skipping broken slug "${preferred}" (score ${audit.score}: ${audit.issues.join("; ")})`);
      skippedBroken++;
      continue;
    }
    entries.push({
      path: `/books/${preferred}`,
      lastmod: b.created_at?.slice(0, 10),
      changefreq: isHi ? "weekly" : "monthly",
      priority: isHi ? "0.9" : "0.8",
    });
  }
  if (skippedBroken) console.log(`[sitemap] skipped ${skippedBroken} broken/garbage slugs`);
  // Keep thin taxonomy pages usable for navigation, but only submit
  // category hubs that have enough indexable inventory or curated editorial copy.
  const categoryCounts = new Map<string, number>();
  for (const b of books!) {
    if (!b.category) continue;
    const category = String(b.category);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }

  const categorySlugs = new Set<string>(Object.keys(CATEGORY_CONTENT));
  for (const [category, count] of categoryCounts) {
    const slug = slugify(category);
    if (!slug) continue;
    if (count >= 3) categorySlugs.add(slug);
  }

  for (const slug of Array.from(categorySlugs).sort()) {
    entries.push({
      path: `/category/${slug}`,
      changefreq: "weekly",
      priority: "0.7",
    });
  }

  return { entries: dedupe(entries), bookCount, staticCount };
}

function renderUrlset(entries: Entry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${escapeXml(BASE_URL + e.path)}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ].filter(Boolean).join("\n")
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

function renderRedirects(
  canonicalSlugs: Set<string>,
  bookRedirects: Array<{ from: string; to: string }>,
) {
  const lines: string[] = [
    "# Auto-generated by scripts/generate-sitemap.ts — do not edit by hand.",
    "# NOTE: /sitemap.xml and /books-sitemap.xml are served as static files from public/",
    "# (generated at build time). Do NOT proxy them to the edge function — that would",
    "# override the freshly-built static sitemap with whatever the function returns.",
    "",
    "# 301 canonical redirects for duplicate/variant book slugs",
  ];
  const aliases = Object.entries(SLUG_REDIRECTS).sort(([a], [b]) => a.localeCompare(b));
  for (const [from, to] of aliases) {
    if (from === to) continue;
    if (canonicalSlugs.size && !canonicalSlugs.has(to)) {
      console.warn(`_redirects: alias "${from}" → "${to}" — target slug not found in DB, keeping anyway.`);
    }
    lines.push(`/books/${from}   /books/${to}   301!`);
  }
  if (bookRedirects.length) {
    lines.push("", "# 301 redirects for renamed book slugs (from books.old_slugs / seo_slug)");
    const seen = new Set<string>();
    for (const { from, to } of bookRedirects) {
      if (!from || !to || from === to) continue;
      const key = `${from}=>${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`/books/${from}   /books/${to}   301!`);
    }
  }
  return lines.join("\n") + "\n";
}

const escapeXml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function renderImageSitemap(items: Array<{ slug: string; title: string; cover: string }>) {
  const abs = (u: string) => (u.startsWith("http") ? u : `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`);
  const urls = items.map((b) => [
    `  <url>`,
    `    <loc>${escapeXml(BASE_URL + "/books/" + b.slug)}</loc>`,
    `    <image:image>`,
    `      <image:loc>${escapeXml(abs(b.cover))}</image:loc>`,
    `      <image:title>${escapeXml(b.title)}</image:title>`,
    `      <image:caption>${escapeXml(`${b.title} — book summary on Booknomics`)}</image:caption>`,
    `    </image:image>`,
    `  </url>`,
  ].join("\n"));
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

(async () => {
  try {
    const { entries, bookCount, staticCount } = await build();
    const bookEntries = entries.filter((e) => e.path.startsWith("/books/"));
    const canonicalSlugs = new Set(bookEntries.map((e) => e.path.replace("/books/", "")));

    const bookRows = await bookRowsPromise;

    const imageItems = (bookRows ?? [])
      .filter((b: any) => {
        const s = (b.seo_slug as string | null) || b.slug;
        return s && b.cover_url && canonicalSlugs.has(s);
      })
      .map((b: any) => ({
        slug: (b.seo_slug as string | null) || b.slug,
        title: b.title,
        cover: b.cover_url,
      }));

    // Build per-book redirect table: every old_slug (and the raw canonical slug, when a keyword seo_slug exists) → current preferred URL.
    const bookRedirects: Array<{ from: string; to: string }> = [];
    for (const b of (bookRows ?? []) as any[]) {
      const to = (b.seo_slug as string | null) || b.slug;
      if (!to) continue;
      // If we have a keyword URL, also redirect the raw canonical slug to it.
      if (b.seo_slug && b.slug && b.slug !== b.seo_slug) {
        bookRedirects.push({ from: b.slug, to });
      }
      for (const old of (b.old_slugs ?? []) as string[]) {
        if (old && old !== to) bookRedirects.push({ from: old, to });
      }
    }

    writeFileSync(resolve("public/sitemap.xml"), renderUrlset(entries));
    writeFileSync(resolve("public/books-sitemap.xml"), renderUrlset(bookEntries));
    writeFileSync(resolve("public/image-sitemap.xml"), renderImageSitemap(imageItems));
    writeFileSync(resolve("public/_redirects"), renderRedirects(canonicalSlugs, bookRedirects));
    // Vercel routing config is source-controlled. Do not mutate vercel.json here:
    // project routing is evaluated before this prebuild script runs.
    // Instead, fail the build if a current canonical redirect is missing so a
    // slug change can never silently ship without its hosting-level redirect.
    const config = JSON.parse(readFileSync(resolve("vercel.json"), "utf8"));
    const configuredRedirects = new Map<string, string>(
      (config.redirects ?? []).map((r: any) => [r.source, r.destination]),
    );
    const expectedRedirects = new Map<string, string>();
    for (const [from, to] of [...Object.entries(SLUG_REDIRECTS), ...bookRedirects.map((r) => [r.from, r.to] as [string, string])]) {
      if (from !== to && canonicalSlugs.has(to) && !canonicalSlugs.has(from)) {
        expectedRedirects.set(`/books/${from}`, `/books/${to}`);
      }
    }
    const missingRedirects = Array.from(expectedRedirects).filter(
      ([source, destination]) => configuredRedirects.get(source) !== destination,
    );
    if (missingRedirects.length) {
      throw new Error(
        `[redirects] vercel.json is missing ${missingRedirects.length} canonical redirects. ` +
        `Update the source-controlled redirects before deploying. First missing: ${missingRedirects[0][0]} → ${missingRedirects[0][1]}`,
      );
    }
    console.log(
      `[sitemap] ✅ wrote sitemap.xml (${entries.length} URLs = ${staticCount} static + ${bookCount} books + categories) · books-sitemap.xml (${bookEntries.length}) · image-sitemap.xml (${imageItems.length}) · _redirects (${Object.keys(SLUG_REDIRECTS).length} static aliases + ${bookRedirects.length} book redirects)`,
    );

  } catch (err) {
    console.error('[sitemap] Build stopped to protect the published sitemap:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
})();
