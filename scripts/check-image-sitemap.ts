// Fetches production image-sitemap.xml and verifies every <image:loc> returns HTTP 200.
// Follows redirects (openlibrary.org uses 302). Exits non-zero on any failure.
// Usage: bunx tsx scripts/check-image-sitemap.ts

const URL_XML = "https://booknomics.com/image-sitemap.xml";
const CONCURRENCY = 12;

async function head(url: string): Promise<number> {
  try {
    // Try HEAD first, fall back to GET (some CDNs disallow HEAD).
    let r = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (r.status === 405 || r.status === 403) {
      r = await fetch(url, { method: "GET", redirect: "follow" });
    }
    return r.status;
  } catch {
    return 0;
  }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += n) {
    out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
  }
  return out;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

(async () => {
  console.log(`[img-sitemap] fetching ${URL_XML}`);
  const res = await fetch(URL_XML, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) {
    console.error(`FAIL — sitemap HTTP ${res.status}`);
    process.exit(1);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const xml = await res.text();
  if (/text\/html/i.test(contentType) || !/<urlset\b/i.test(xml) || !/xmlns:image=/i.test(xml)) {
    console.error(`FAIL — image sitemap is not valid image-sitemap XML (content-type: ${contentType || "missing"})`);
    process.exit(1);
  }

  const urls = Array.from(xml.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)).map((m) => decode(m[1].trim()));
  console.log(`[img-sitemap] ${urls.length} image URLs to check`);
  if (urls.length === 0) {
    console.error("FAIL — image sitemap contains zero image URLs");
    process.exit(1);
  }

  const results = await pool(urls, CONCURRENCY, async (u) => ({ u, code: await head(u) }));
  const bad = results.filter((r) => r.code !== 200);
  const ok = results.length - bad.length;

  console.log(`\n  OK:   ${ok}`);
  console.log(`  FAIL: ${bad.length}`);
  if (bad.length) {
    console.log("\nFailing URLs:");
    for (const r of bad.slice(0, 50)) console.log(`  ${r.code}  ${r.u}`);
    console.log("\n❌ FAIL — image sitemap has broken URLs");
    process.exit(1);
  }
  console.log("\n✅ PASS — all image URLs return 200");
})().catch((e) => {
  console.error("check-image-sitemap error:", e);
  process.exit(1);
});
