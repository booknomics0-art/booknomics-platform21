#!/usr/bin/env node
// Booknomics — book count audit (READ ONLY, never writes to the database).
//
// Answers one question with evidence: "kitni books hain?"
// across the three places a book can "exist":
//
//   1. local   — what this repo contains (covers, drafts, committed sitemaps)
//   2. live    — what Google/users actually see on booknomics.com
//   3. db      — what the Supabase `books` table holds (published vs drafts)
//
// Usage:
//   node scripts/book-count-audit.mjs            # local + live + db (db/live skipped if unreachable)
//   node scripts/book-count-audit.mjs --local    # offline, repo files only
//   node scripts/book-count-audit.mjs --live     # production sitemaps only
//   node scripts/book-count-audit.mjs --db       # Supabase REST only
//   node scripts/book-count-audit.mjs --json     # machine-readable output
//   node scripts/book-count-audit.mjs --strict   # exit 1 if published < SITEMAP_MIN_BOOKS (default 50)
//
// No dependencies: plain Node >= 20, uses global fetch.
// Reads VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY from the environment
// or from .env (same names the app and sitemap generator use).

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const want = (flag) => args.has(flag);
const jsonOut = want("--json");
const onlyLocal = want("--local");
const onlyLive = want("--live");
const onlyDb = want("--db");
const strict = want("--strict");
const mode = onlyLocal || onlyLive || onlyDb ? "explicit" : "all";

const MIN_EXPECTED_BOOKS = Number(process.env.SITEMAP_MIN_BOOKS || "50");
const SITE = "https://booknomics.com";
const report = { startedAt: new Date().toISOString(), local: null, live: null, db: null, problems: [] };

// ---------------------------------------------------------------- env loading
function loadEnvFile() {
  const file = resolve(ROOT, ".env");
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}
const dotenv = loadEnvFile();
const getEnv = (key) => (process.env[key] ?? dotenv[key] ?? "").trim();

// --------------------------------------------------------------------- local
function countLocal() {
  const assetDir = (p) => {
    const full = resolve(ROOT, p);
    if (!existsSync(full)) return 0;
    return readdirSync(full).filter((f) => f.endsWith(".asset.json")).length;
  };
  const locsIn = (p) => {
    const full = resolve(ROOT, p);
    if (!existsSync(full)) return null;
    const xml = readFileSync(full, "utf8");
    return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());
  };
  const sitemapLocs = locsIn("public/sitemap.xml") ?? [];
  const bookSitemapLocs = locsIn("public/books-sitemap.xml") ?? [];
  const draftsDir = resolve(ROOT, "content-drafts");
  const draftFiles = existsSync(draftsDir)
    ? readdirSync(draftsDir).filter((f) => f.endsWith(".txt"))
    : [];

  return {
    englishCoverStubs: assetDir("src/assets/english-covers"),
    hindiCoverStubs: assetDir("src/assets/hindi-covers"),
    coverStubsTotal: assetDir("src/assets/english-covers") + assetDir("src/assets/hindi-covers"),
    committedSitemapBookUrls: sitemapLocs.filter((u) => u.includes("/books/")).length,
    committedSitemapTotalUrls: sitemapLocs.length,
    committedBooksSitemapUrls: bookSitemapLocs.length,
    draftSummaryFiles: draftFiles.length,
    note: "Cover stubs are asset.json placeholders, not book text. This repo holds no book content and no book seed rows.",
  };
}

// ---------------------------------------------------------------------- live
async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "BooknomicsCountAudit/1.0", "cache-control": "no-cache" },
    signal: AbortSignal.timeout(20000),
  });
  return { status: res.status, ok: res.ok, text: res.ok ? await res.text() : "" };
}
const parseLocs = (xml) => Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());

async function countLive() {
  const out = {};
  const sm = await fetchText(`${SITE}/sitemap.xml`);
  out.sitemapStatus = sm.status;
  const locs = sm.ok ? parseLocs(sm.text) : [];
  out.sitemapTotalUrls = locs.length;
  out.bookUrls = locs.filter((u) => u.startsWith(`${SITE}/books/`)).length;

  try {
    const bsm = await fetchText(`${SITE}/books-sitemap.xml`);
    out.booksSitemapStatus = bsm.status;
    out.booksSitemapUrls = bsm.ok ? parseLocs(bsm.text).length : null;
  } catch (e) {
    out.booksSitemapStatus = `unreachable (${e.message})`;
    out.booksSitemapUrls = null;
  }

  try {
    const robots = await fetchText(`${SITE}/robots.txt`);
    out.robotsAnnouncesBooksSitemap = /books-sitemap\.xml/i.test(robots.text);
  } catch {
    out.robotsAnnouncesBooksSitemap = null;
  }

  try {
    const browse = await fetchText(`${SITE}/browse`);
    const m = browse.text.match(/>\s*(\d[\d,]*)\s+books\s*</i);
    out.browseRenderedCount = m ? Number(m[1].replace(/,/g, "")) : null;
  } catch {
    out.browseRenderedCount = null;
  }
  return out;
}

// ------------------------------------------------------------------------ db
async function countDb() {
  const base = getEnv("VITE_SUPABASE_URL");
  const key = getEnv("VITE_SUPABASE_PUBLISHABLE_KEY") || getEnv("VITE_SUPABASE_ANON_KEY");
  if (!base || !key) {
    return { skipped: "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or anon key) to count the database." };
  }
  const count = async (query) => {
    const res = await fetch(`${base}/rest/v1/books?select=id&${query}`, {
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        prefer: "count=exact",
        range: "0-0",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
    const range = res.headers.get("content-range") || "";
    const total = Number(range.split("/")[1]);
    return Number.isFinite(total) ? total : null;
  };
  const q = {
    total: "",
    published: "is_draft=eq.false",
    drafts: "is_draft=eq.true",
    hindi: "language=eq.hi",
    english: "language=neq.hi",
    missingCover: "cover_url=is.null",
    publishedMissingCover: "is_draft=eq.false&cover_url=is.null",
    publishedMissingOverview: "is_draft=eq.false&overview=is.null",
  };
  const out = {};
  for (const [label, query] of Object.entries(q)) out[label] = await count(query);
  return out;
}

// ----------------------------------------------------------------- reporting
for (const [name, fn] of [
  ["local", countLocal],
  ["live", countLive],
  ["db", countDb],
]) {
  const wanted = mode === "all" || (name === "local" && onlyLocal) || (name === "live" && onlyLive) || (name === "db" && onlyDb);
  if (!wanted) continue;
  try {
    report[name] = await fn();
  } catch (e) {
    report[name] = { error: String(e?.message || e) };
    report.problems.push(`${name} check failed: ${e?.message || e}`);
  }
}

if (report.live && !report.live.error) {
  if (report.live.bookUrls === 0) report.problems.push("Live sitemap advertises 0 book URLs — book pages are invisible to search.");
  if (report.live.robotsAnnouncesBooksSitemap === false) report.problems.push("robots.txt does not announce books-sitemap.xml.");
  if (report.live.browseRenderedCount === 0) report.problems.push("/browse renders 0 books — the public catalog is empty right now.");
}
if (report.db && !report.db.error && !report.db.skipped) {
  const { published, drafts, missingCover } = report.db;
  if (published === 0) report.problems.push("Database has 0 published books — nothing can be served.");
  if (published !== null && published < MIN_EXPECTED_BOOKS) report.problems.push(`Only ${published} published books (< SITEMAP_MIN_BOOKS=${MIN_EXPECTED_BOOKS}).`);
  if (drafts) report.problems.push(`${drafts} books are drafts (invisible on the public site).`);
  if (missingCover) report.problems.push(`${missingCover} books have no cover_url.`);
}

if (jsonOut) {
  console.log(JSON.stringify({ ...report, minExpectedBooks: MIN_EXPECTED_BOOKS }, null, 2));
} else {
  const line = (k, v) => console.log(`  ${String(k).padEnd(34)} ${v === null || v === undefined ? "n/a" : v}`);
  console.log("\nBooknomics book count audit");
  console.log("=".repeat(62));
  if (report.local && !report.local.error) {
    console.log("\n[1] Local repo files (what this checkout can prove)");
    line("cover stubs — English", report.local.englishCoverStubs);
    line("cover stubs — Hindi", report.local.hindiCoverStubs);
    line("cover stubs — total", report.local.coverStubsTotal);
    line("content-drafts summary files", report.local.draftSummaryFiles);
    line("committed sitemap book URLs", report.local.committedSitemapBookUrls);
    line("committed books-sitemap URLs", report.local.committedBooksSitemapUrls);
    console.log(`  note: ${report.local.note}`);
  }
  if (report.live && !report.live.error) {
    console.log(`\n[2] Production (${SITE})`);
    line("sitemap.xml status", report.live.sitemapStatus);
    line("sitemap.xml total URLs", report.live.sitemapTotalUrls);
    line("book URLs in sitemap", report.live.bookUrls);
    line("books-sitemap.xml status", report.live.booksSitemapStatus);
    line("books-sitemap.xml URLs", report.live.booksSitemapUrls);
    line("robots.txt announces books", report.live.robotsAnnouncesBooksSitemap);
    line("/browse rendered count", report.live.browseRenderedCount);
  } else if (report.live?.error) {
    console.log(`\n[2] Production — skipped: ${report.live.error}`);
  }
  if (report.db && !report.db.error && !report.db.skipped) {
    console.log("\n[3] Supabase books table (source of truth)");
    line("total rows", report.db.total);
    line("published (is_draft=false)", report.db.published);
    line("drafts (is_draft=true)", report.db.drafts);
    line("Hindi (language=hi)", report.db.hindi);
    line("English / other", report.db.english);
    line("missing cover_url", report.db.missingCover);
    line("published missing cover_url", report.db.publishedMissingCover);
    line("published missing overview", report.db.publishedMissingOverview);
  } else if (report.db?.skipped) {
    console.log(`\n[3] Supabase — skipped: ${report.db.skipped}`);
  } else if (report.db?.error) {
    console.log(`\n[3] Supabase — failed: ${report.db.error}`);
  }
  console.log("\nFindings");
  if (report.problems.length === 0) console.log("  none — catalog looks consistent.");
  else report.problems.forEach((p) => console.log(`  ! ${p}`));
  console.log("\nNext: docs/CATALOG-COUNT-REPORT.md has the SQL and the ordered fix list.\n");
}

if (strict) {
  const published = report.db?.published ?? report.live?.bookUrls ?? 0;
  if (published < MIN_EXPECTED_BOOKS) {
    console.error(`STRICT FAIL — ${published} published books, expected >= ${MIN_EXPECTED_BOOKS}.\n`);
    process.exit(1);
  }
}
