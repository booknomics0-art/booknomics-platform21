// Lightweight indexing/discoverability monitor for booknomics.com.
// Usage: bun run monitor:indexing            (checks first 40 URLs by default)
//        SAMPLE=all bun run monitor:indexing (checks every URL — slower)
//
// Fetches the production sitemap, then for each URL checks:
//   • HTTP status
//   • <link rel="canonical"> match
//   • <meta name="robots" content="noindex">
//   • robots.txt Disallow rules
//   • Book + Breadcrumb JSON-LD presence (book pages)
// Writes machine-readable JSON to reports/indexing-<timestamp>.json and
// exits non-zero when any critical issue is found.

import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const SITE = "https://booknomics.com";
const SITEMAP = `${SITE}/sitemap.xml`;
const ROBOTS = `${SITE}/robots.txt`;
const SAMPLE = process.env.SAMPLE ?? "40";

type Row = {
  url: string;
  status: number;
  ok: boolean;
  canonical: string | null;
  canonicalMatches: boolean;
  noindex: boolean;
  robotsBlocked: boolean;
  hasBookLd?: boolean;
  hasBreadcrumbLd?: boolean;
  discoverable: boolean;
  reasons: string[];
};

async function fetchText(url: string) {
  const res = await fetch(url, { headers: { "user-agent": "BooknomicsMonitor/1.0", "cache-control": "no-cache" } });
  return { status: res.status, text: res.ok ? await res.text() : "" };
}

function parseSitemap(xml: string) {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());
}

function parseRobots(text: string): (path: string) => boolean {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  const disallows: string[] = [];
  let inStar = false;
  for (const line of lines) {
    if (/^user-agent:/i.test(line)) inStar = /:\s*\*\s*$/.test(line);
    else if (inStar && /^disallow:/i.test(line)) {
      const rule = line.replace(/^disallow:\s*/i, "").trim();
      if (rule) disallows.push(rule);
    }
  }
  return (path) => disallows.some((r) => path.startsWith(r));
}

function pick(re: RegExp, html: string) {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

async function check(url: string, robotsBlocked: (p: string) => boolean): Promise<Row> {
  const path = new URL(url).pathname;
  const isBook = path.startsWith("/books/");
  const reasons: string[] = [];
  let status = 0, html = "";
  try {
    const r = await fetchText(url);
    status = r.status; html = r.text;
  } catch (e) {
    reasons.push(`fetch error: ${(e as Error).message}`);
  }
  const ok = status === 200;
  if (!ok) reasons.push(`http ${status}`);

  const canonical = pick(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i, html);
  const canonicalMatches = !!canonical && canonical.replace(/\/$/, "") === url.replace(/\/$/, "");
  if (canonical && !canonicalMatches) reasons.push(`canonical mismatch → ${canonical}`);

  const robotsMeta = pick(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i, html) ?? "";
  const noindex = /noindex/i.test(robotsMeta);
  if (noindex) reasons.push("noindex meta");

  const blocked = robotsBlocked(path);
  if (blocked) reasons.push("blocked by robots.txt");

  const row: Row = {
    url, status, ok, canonical, canonicalMatches, noindex, robotsBlocked: blocked,
    discoverable: ok && !noindex && !blocked && (canonical ? canonicalMatches : true),
    reasons,
  };

  if (isBook && html) {
    const ldBlocks = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)).map((m) => m[1]);
    row.hasBookLd = ldBlocks.some((b) => /"@type"\s*:\s*"Book"/.test(b));
    row.hasBreadcrumbLd = ldBlocks.some((b) => /"@type"\s*:\s*"BreadcrumbList"/.test(b));
    if (!row.hasBookLd) reasons.push("missing Book JSON-LD");
    if (!row.hasBreadcrumbLd) reasons.push("missing BreadcrumbList JSON-LD");
  }
  return row;
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  }
  return out;
}

(async () => {
  console.log(`[monitor] fetching ${SITEMAP}`);
  const sm = await fetchText(SITEMAP);
  if (sm.status !== 200) { console.error(`FAIL: sitemap ${sm.status}`); process.exit(1); }
  const allUrls = parseSitemap(sm.text);
  const urls = SAMPLE === "all" ? allUrls : allUrls.slice(0, Number(SAMPLE) || 40);
  console.log(`[monitor] ${allUrls.length} URLs in sitemap · checking ${urls.length}`);

  const robots = await fetchText(ROBOTS);
  const robotsBlocked = parseRobots(robots.text);

  const rows = await pool(urls, 8, (u) => check(u, robotsBlocked));

  const summary = {
    checkedAt: new Date().toISOString(),
    sitemapTotal: allUrls.length,
    checked: rows.length,
    ok200: rows.filter((r) => r.ok).length,
    failed: rows.filter((r) => !r.ok).length,
    canonicalMismatches: rows.filter((r) => r.canonical && !r.canonicalMatches).length,
    noindex: rows.filter((r) => r.noindex).length,
    robotsBlocked: rows.filter((r) => r.robotsBlocked).length,
    discoverable: rows.filter((r) => r.discoverable).length,
    nonDiscoverable: rows.filter((r) => !r.discoverable).length,
    bookLdMissing: rows.filter((r) => r.hasBookLd === false).length,
    breadcrumbLdMissing: rows.filter((r) => r.hasBreadcrumbLd === false).length,
    problems: rows.filter((r) => r.reasons.length).map((r) => ({ url: r.url, reasons: r.reasons })),
  };

  mkdirSync(resolve("reports"), { recursive: true });
  const outPath = resolve(`reports/indexing-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify({ summary, rows }, null, 2));

  console.log("\n[monitor] summary");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\n[monitor] report saved → ${outPath}`);

  const critical = summary.failed > 0 || summary.canonicalMismatches > 0 || summary.noindex > 0;
  console.log(critical ? "\n❌ FAIL — critical indexing issues found" : "\n✅ PASS — all sampled URLs technically discoverable");
  process.exit(critical ? 1 : 0);
})().catch((e) => { console.error("monitor error:", e); process.exit(1); });
