// Production sitemap verification.
// Usage: bun run check:sitemap:prod
const SITEMAP_URL = "https://booknomics.com/sitemap.xml";
const MIN_URLS = 165;
const MAX_URLS = 185;
const REQUIRED = [
  "https://booknomics.com/books/atomic-habits",
  "https://booknomics.com/books/deep-work",
  "https://booknomics.com/books/godan",
  "https://booknomics.com/books/panchatantra-hi",
  "https://booknomics.com/books/don-quixote",
];

(async () => {
  console.log(`[check:sitemap:prod] fetching ${SITEMAP_URL}`);
  const res = await fetch(SITEMAP_URL, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) {
    console.error(`FAIL — HTTP ${res.status}`);
    process.exit(1);
  }
  const xml = await res.text();
  const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());
  const count = locs.length;
  const set = new Set(locs);
  const missing = REQUIRED.filter((u) => !set.has(u));
  const inRange = count >= MIN_URLS && count <= MAX_URLS;

  console.log(`  total URLs:      ${count}`);
  console.log(`  expected range:  ${MIN_URLS}–${MAX_URLS}`);
  console.log(`  missing required: ${missing.length ? missing.join(", ") : "none"}`);
  console.log(`  deployment id:   ${res.headers.get("x-deployment-id") ?? "n/a"}`);

  const pass = inRange && missing.length === 0;
  console.log(pass ? "\n✅ PASS — production sitemap healthy" : "\n❌ FAIL — production sitemap check failed");
  process.exit(pass ? 0 : 1);
})().catch((e) => {
  console.error("FAIL —", e);
  process.exit(1);
});
