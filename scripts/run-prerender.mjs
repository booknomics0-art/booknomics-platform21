import { spawnSync } from "node:child_process";

// Preview deployments intentionally test the React app without indexing copies
// of thousands of production books. Production and direct Cloudflare builds
// MUST generate their SEO pages; missing catalog credentials remain fatal.
if (process.env.VERCEL_ENV === "preview" ||
    (process.env.BOOKNOMICS_PREVIEW_BUILD === "1" && process.env.VERCEL_ENV !== "production")) {
  console.log("[postbuild] Vercel preview: skipped production SEO prerender; live production builds remain strict.");
  process.exit(0);
}

const scripts = [
  "prerender-en-crawl.mjs",
  "prerender-low-volume-categories.mjs",
  "prerender-all-books.mjs",
  "enhance-english-top50-seo.mjs",
  "prerender-aeo-geo.mjs",
  "finalize-hindi-hub.mjs",
  "finalize-hindi-guide.mjs",
  "repair-book-structured-data.mjs",
  "guard-aeo-prerender.mjs",
  "guard-public-prerender.mjs",
  "finalize-core-technical-seo.mjs",
  "guard-final-seo-head.mjs",
];

for (const filename of scripts) {
  console.log(`[postbuild] ${filename}`);
  const result = spawnSync(process.execPath, [new URL(filename, import.meta.url).pathname], {
    stdio: "inherit", env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
