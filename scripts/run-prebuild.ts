import { spawnSync } from "node:child_process";

const env = { ...process.env };

// Preview deployments are for UI/QA and should not fail because the build runner
// cannot reach Supabase for sitemap data. Production remains strict and continues
// to fetch/validate the live catalog in generate-sitemap.ts.
if (env.VERCEL_ENV === "preview") {
  env.ALLOW_STATIC_SITEMAP = "true";
  env.SITEMAP_MIN_BOOKS = "0";
  console.log("[prebuild] Preview deployment: using static sitemap fallback");
}

for (const script of ["scripts/check-env.ts", "scripts/generate-sitemap.ts"]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", script], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}
