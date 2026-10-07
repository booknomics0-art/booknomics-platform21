import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const routes = [
  "/about", "/contact", "/press", "/resources",
  "/resources/7-day-reading-action-tracker",
  "/resources/book-summary-template",
  "/resources/best-book-summary-websites",
  "/resources/best-hindi-book-summaries-guide",
  "/privacy", "/terms", "/blog",
  "/blog/5-ways-to-build-a-morning-routine",
  "/blog/how-to-read-more-books-without-burning-out",
  "/blog/the-real-psychology-of-money",
  "/blog/stoicism-for-modern-anxiety",
  "/blog/build-deep-work-in-a-distracted-world",
];

const failures = [];
for (const route of routes) {
  const file = resolve("dist", route.replace(/^\//, ""), "index.html");
  if (!existsSync(file)) { failures.push(`${route}: missing snapshot`); continue; }
  const html = readFileSync(file, "utf8");
  if (!/<div id="root">\s*<main/i.test(html)) failures.push(`${route}: empty crawler root`);
  if (!/<meta name="robots" content="index,follow/i.test(html)) failures.push(`${route}: missing index robots`);
  const canonical = `https://www.booknomics.com${route}`;
  if (!html.includes(`<link rel="canonical" href="${canonical}"`)) failures.push(`${route}: canonical mismatch`);
  if (/Booknomics — Book Summaries in English & Hindi \| Read Smarter, Apply Faster/.test(html)) failures.push(`${route}: homepage title leaked`);
  if (!/<h1[ >]/i.test(html)) failures.push(`${route}: missing H1`);
}

if (failures.length) {
  console.error("[guard-public-authority] ❌", failures.join("\n"));
  process.exit(1);
}
console.log(`[guard-public-authority] ✅ checked ${routes.length} public authority/resource/blog snapshots`);
