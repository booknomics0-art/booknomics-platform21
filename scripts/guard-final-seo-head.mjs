import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const DIST = resolve("dist");
const EXPECTED_HOME_TITLE = "Booknomics — English & Hindi Book Summaries";
const CANONICAL_RE = /<link\s+[^>]*rel=["']canonical["'][^>]*>/gi;

const fail = (message) => {
  console.error(`[guard-final-seo-head] ❌ ${message}`);
  process.exitCode = 1;
};

const htmlFiles = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile() && entry.name.endsWith(".html")) htmlFiles.push(absolute);
  }
}

if (!existsSync(DIST)) {
  fail("dist directory is missing");
} else {
  walk(DIST);
}

let pagesWithCanonical = 0;
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const canonicals = html.match(CANONICAL_RE) ?? [];
  if (canonicals.length > 1) {
    fail(`${file.replace(`${DIST}/`, "")} contains ${canonicals.length} canonical tags`);
  }
  if (canonicals.length === 1) pagesWithCanonical += 1;
}

const coreRoutes = [
  ["index.html", "https://www.booknomics.com/"],
  ["browse/index.html", "https://www.booknomics.com/browse"],
  ["english/index.html", "https://www.booknomics.com/english"],
  ["hindi/index.html", "https://www.booknomics.com/hindi"],
  ["research/index.html", "https://www.booknomics.com/research"],
];

for (const [relative, expectedCanonical] of coreRoutes) {
  const file = resolve(DIST, relative);
  if (!existsSync(file)) {
    fail(`missing ${relative}`);
    continue;
  }
  const html = readFileSync(file, "utf8");
  const canonicals = html.match(CANONICAL_RE) ?? [];
  if (canonicals.length !== 1) {
    fail(`${relative} must contain exactly one canonical tag; found ${canonicals.length}`);
    continue;
  }
  if (!canonicals[0].includes(`href="${expectedCanonical}"`) && !canonicals[0].includes(`href='${expectedCanonical}'`)) {
    fail(`${relative} canonical is not ${expectedCanonical}`);
  }
}

const home = resolve(DIST, "index.html");
if (existsSync(home)) {
  const html = readFileSync(home, "utf8");
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  if (title !== EXPECTED_HOME_TITLE) {
    fail(`homepage title mismatch: ${JSON.stringify(title)}`);
  }
}

if (!process.exitCode) {
  console.log(`[guard-final-seo-head] ✅ ${pagesWithCanonical} canonicalized HTML pages checked; no duplicates; homepage title aligned`);
}
