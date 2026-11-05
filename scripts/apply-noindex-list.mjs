// Apply (or restore) status=published_noindex for a reviewed audit list, via
// the worker admin endpoint PATCH /api/admin/books/:id.
//
// DRY-RUN BY DEFAULT. Nothing is written unless --apply is passed.
//
// Auth: the worker checks the bn_session cookie (site sign-in) and requires
// user_roles.role='admin'. Copy the cookie value from DevTools
// (Application → Cookies → booknomics.com → bn_session) into the environment:
//
//   export BN_ADMIN_COOKIE="..."
//
// Usage:
//   node scripts/apply-noindex-list.mjs --csv out/template-audit/template-audit-2026-11-05.csv \
//        --recommendation noindex                # dry-run: prints planned changes
//   node scripts/apply-noindex-list.mjs --csv ... --recommendation noindex --apply
//   node scripts/apply-noindex-list.mjs --csv ... --recommendation noindex --apply --restore
//       # --restore sets the same books back to status=published
//
// Optional: --api <origin> (default $PRERENDER_CATALOG_API or https://www.booknomics.com)
//           --limit N (safety cap per run; 0 = no cap)
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_API = "https://www.booknomics.com";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const pushCell = () => { row.push(cell); cell = ""; };
  const pushRow = () => { pushCell(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") pushCell();
    else if (ch === "\n") pushRow();
    else if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) pushRow();
  const headers = rows.shift() || [];
  return rows.filter((r) => r.length === headers.length).map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i]]))
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (name, fallback = "") => {
    const i = argv.indexOf(name);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const hasFlag = (name) => argv.includes(name);

  const csvPath = resolve(flag("--csv"));
  if (!csvPath || !existsSync(csvPath)) {
    console.error("usage: node scripts/apply-noindex-list.mjs --csv <template-audit CSV> --recommendation noindex [--apply] [--restore] [--limit N]");
    process.exit(2);
  }
  const recommendation = flag("--recommendation", "noindex");
  const apply = hasFlag("--apply");
  const restore = hasFlag("--restore");
  const limit = Number(flag("--limit", "0"));
  const apiBase = (flag("--api", process.env.PRERENDER_CATALOG_API || DEFAULT_API)).replace(/\/$/, "");
  const cookie = process.env.BN_ADMIN_COOKIE?.trim();

  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  const targets = rows.filter((r) => r.recommendation === recommendation && r.id);
  if (!targets.length) {
    console.error(`No rows with recommendation="${recommendation}" and an id in ${csvPath}.`);
    process.exit(2);
  }
  const planned = limit > 0 ? targets.slice(0, limit) : targets;
  const status = restore ? "published" : "published_noindex";
  const verb = restore ? "RESTORE to published" : "SET published_noindex";

  console.log(`[apply-noindex-list] ${planned.length} books selected (${recommendation}) → ${verb}`);
  console.log(`[apply-noindex-list] api=${apiBase} mode=${apply ? "APPLY" : "DRY-RUN"}`);

  if (!apply) {
    for (const row of planned.slice(0, 50)) {
      console.log(`  ${row.score ?? "?"}  ${row.language ?? "?"}  ${row.seo_slug || row.slug}  ${row.title || ""}`);
    }
    if (planned.length > 50) console.log(`  ...and ${planned.length - 50} more`);
    console.log(`\nDry-run only. Re-run with --apply (requires BN_ADMIN_COOKIE) to make the change.`);
    return;
  }

  if (!cookie) {
    console.error("BN_ADMIN_COOKIE is required for --apply. Log in to the site as an admin, then copy the bn_session cookie value from DevTools (Application → Cookies) into the environment.");
    process.exit(2);
  }

  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  let ok = 0;
  let failed = 0;
  const failures = [];
  for (let i = 0; i < planned.length; i++) {
    const row = planned[i];
    let done = false;
    for (let attempt = 0; attempt < 3 && !done; attempt++) {
      try {
        const response = await fetch(`${apiBase}/api/admin/books/${row.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: `bn_session=${cookie}`,
          },
          body: JSON.stringify({ status }),
          signal: AbortSignal.timeout(30000),
        });
        if (response.ok) { ok++; done = true; continue; }
        const body = (await response.text()).slice(0, 200);
        if (response.status === 401 || response.status === 403) {
          console.error(`[apply-noindex-list] ${response.status} ${body} — aborting (check BN_ADMIN_COOKIE / admin role).`);
          process.exit(1);
        }
        if (response.status === 429 || response.status >= 500) {
          console.warn(`[apply-noindex-list] ${response.status} for ${row.seo_slug}; retry ${attempt + 1}/2`);
          await pause(2000 * (attempt + 1));
          continue;
        }
        failed++;
        failures.push({ slug: row.seo_slug, status: response.status, body });
        done = true;
      } catch (err) {
        failed++;
        failures.push({ slug: row.seo_slug, error: String(err?.message || err) });
        done = true;
      }
    }
    if ((i + 1) % 25 === 0) console.log(`  ...${i + 1}/${planned.length} (ok=${ok} failed=${failed})`);
    await pause(250);
  }
  console.log(`\n[apply-noindex-list] done: ok=${ok} failed=${failed}`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures.slice(0, 20)) console.log(`  ${f.slug}: ${f.status || ""} ${f.body || f.error || ""}`);
    process.exitCode = 1;
  }
  console.log("After applying, trigger a Vercel production redeploy so the next prerender emits noindex meta for these pages, then watch the GSC Pages report over the following days.");
}

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isDirectRun) {
  main().catch((err) => {
    console.error("[apply-noindex-list] failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
