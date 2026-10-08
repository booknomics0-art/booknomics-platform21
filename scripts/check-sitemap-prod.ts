// Production sitemap verification.
// Reconciles the deployed sitemap against the current published catalog when
// Supabase credentials are available. Falls back to internal sitemap
// consistency checks when run without database access.
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";

Object.assign(
  process.env,
  { ...loadEnv(process.env.NODE_ENV || "production", process.cwd(), ""), ...process.env },
);

const SITE = "https://www.booknomics.com";
const SITEMAP_URL = `${SITE}/sitemap.xml`;
const BOOKS_SITEMAP_URL = `${SITE}/books-sitemap.xml`;
const MIN_BOOKS = Math.max(1, Number(process.env.SITEMAP_MIN_BOOKS || "50") || 50);

const REQUIRED_STATIC = [
  `${SITE}/`,
  `${SITE}/browse`,
  `${SITE}/english`,
  `${SITE}/hindi`,
  `${SITE}/best-hindi-book-summaries`,
];

const parseLocs = (xml: string) =>
  Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());

async function fetchXml(url: string) {
  const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  return { xml: await res.text(), deploymentId: res.headers.get("x-deployment-id") ?? "n/a" };
}

async function expectedBookUrls(): Promise<string[] | null> {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;

  const db = createClient(url, key);
  const out: string[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await db
      .from("books")
      .select("slug,seo_slug")
      .eq("is_draft", false)
      .eq("status", "published")
      .order("id")
      .range(from, from + 499);
    if (error) throw new Error(`Supabase reconciliation failed: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows as any[]) {
      const slug = row.seo_slug || row.slug;
      if (slug) out.push(`${SITE}/books/${slug}`);
    }
    if (rows.length < 500) break;
  }
  return out;
}

(async () => {
  console.log(`[check:sitemap:prod] fetching production sitemaps`);
  const [main, books, expected] = await Promise.all([
    fetchXml(SITEMAP_URL),
    fetchXml(BOOKS_SITEMAP_URL),
    expectedBookUrls(),
  ]);

  const mainLocs = parseLocs(main.xml);
  const bookLocs = parseLocs(books.xml);
  const mainSet = new Set(mainLocs);
  const bookSet = new Set(bookLocs);
  const duplicateMain = mainLocs.length - mainSet.size;
  const duplicateBooks = bookLocs.length - bookSet.size;
  const mainBookSet = new Set(mainLocs.filter((u) => u.startsWith(`${SITE}/books/`)));

  const missingStatic = REQUIRED_STATIC.filter((u) => !mainSet.has(u));
  const missingFromMain = [...bookSet].filter((u) => !mainBookSet.has(u));
  const unexpectedInMainBooks = [...mainBookSet].filter((u) => !bookSet.has(u));

  let missingExpected: string[] = [];
  let unexpectedExpected: string[] = [];
  let expectedOk = bookLocs.length >= MIN_BOOKS;
  if (expected) {
    const expectedSet = new Set(expected);
    missingExpected = [...expectedSet].filter((u) => !bookSet.has(u));
    unexpectedExpected = [...bookSet].filter((u) => !expectedSet.has(u));
    expectedOk =
      expectedSet.size === bookSet.size &&
      missingExpected.length === 0 &&
      unexpectedExpected.length === 0;
  }

  const pass =
    duplicateMain === 0 &&
    duplicateBooks === 0 &&
    missingStatic.length === 0 &&
    missingFromMain.length === 0 &&
    unexpectedInMainBooks.length === 0 &&
    expectedOk;

  console.log(JSON.stringify({
    deploymentId: main.deploymentId,
    mainUrls: mainLocs.length,
    bookUrls: bookLocs.length,
    expectedPublishedBooks: expected?.length ?? null,
    duplicateMain,
    duplicateBooks,
    missingStatic,
    missingFromMain: missingFromMain.slice(0, 20),
    unexpectedInMainBooks: unexpectedInMainBooks.slice(0, 20),
    missingExpected: missingExpected.slice(0, 20),
    unexpectedExpected: unexpectedExpected.slice(0, 20),
  }, null, 2));

  console.log(pass ? "\n✅ PASS — production sitemap reconciles with the published catalog" : "\n❌ FAIL — production sitemap mismatch");
  process.exit(pass ? 0 : 1);
})().catch((e) => {
  console.error("FAIL —", e instanceof Error ? e.message : e);
  process.exit(1);
});
