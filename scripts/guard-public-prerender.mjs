import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const fail = (message) => {
  console.error(`[guard-public-prerender] ❌ ${message}`);
  process.exitCode = 1;
};

const read = (path) => readFileSync(resolve("dist", path), "utf8");

for (const path of ["browse/index.html", "english/index.html", "hindi/index.html", "books-sitemap.xml", "sitemap.xml"]) {
  if (!existsSync(resolve("dist", path))) fail(`missing ${path}`);
}

if (!process.exitCode) {
  const browse = read("browse/index.html");
  const english = read("english/index.html");
  if (!/<h1>Browse all book summaries<\/h1>/i.test(browse)) fail("/browse is not prerendered with its crawlable H1");
  if ((browse.match(/href="\/books\//g) || []).length < 100) fail("/browse exposes fewer than 100 direct published-book links");
  if (!/<h1>English book summaries<\/h1>/i.test(english)) fail("/english is not prerendered with its crawlable H1");
  if ((english.match(/href="\/books\//g) || []).length < 100) fail("/english exposes fewer than 100 direct published-book links");
}

const booksDir = resolve("dist", "books");
if (!existsSync(booksDir)) {
  fail("dist/books is missing");
} else {
  let englishSnapshots = 0;
  let loadingShells = 0;
  let canonicalMissing = 0;
  let noindexSnapshots = 0;
  for (const entry of readdirSync(booksDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = resolve(booksDir, entry.name, "index.html");
    if (!existsSync(file)) continue;
    const html = readFileSync(file, "utf8");
    if (!/<html\s+lang="en"/i.test(html)) continue;
    englishSnapshots++;
    if (/Loading book[….\.]*<\/div>/i.test(html)) loadingShells++;
    if (!/<link\s+rel="canonical"\s+href="https:\/\/www\.booknomics\.com\/books\//i.test(html)) canonicalMissing++;
    if (/name="robots"\s+content="noindex,follow"/i.test(html)) noindexSnapshots++;
  }
  if (englishSnapshots < 500) fail(`only ${englishSnapshots} English book snapshots were generated; expected >= 500`);
  if (loadingShells > 0) fail(`${loadingShells} English snapshots still contain a Loading book shell`);
  if (canonicalMissing > 0) fail(`${canonicalMissing} English snapshots are missing canonical URLs`);
  console.log(`[guard-public-prerender] checked ${englishSnapshots} English snapshots (${noindexSnapshots} intentionally noindex)`);
}

const categoriesDir = resolve("dist", "category");
if (!existsSync(categoriesDir)) {
  fail("dist/category is missing");
} else {
  const categoryCount = readdirSync(categoriesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
  if (categoryCount < 5) fail(`only ${categoryCount} category hubs were prerendered; expected >= 5`);
  console.log(`[guard-public-prerender] checked ${categoryCount} category hubs`);
}

if (!process.exitCode) console.log("[guard-public-prerender] ✅ crawler-visible SEO output passed");
