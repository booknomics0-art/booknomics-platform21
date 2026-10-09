#!/usr/bin/env node
// Bulk-upload composed covers to Supabase Storage (bucket "book-covers") and set books.cover_url.
// Same result as Admin → "HD Cover" for every finished manifest entry, in one go.
//
// SAFE BY DEFAULT
//   • Dry run unless --apply is given.
//   • Skips every book that already has a cover_url (re-checked live just before writing), unless --force.
//   • Objects are never overwritten: each upload gets a new path  <folder>/<book-id>/<timestamp>.<ext>
//
// ENV (read from the shell or the repo-root .env; never commit real keys)
//   SUPABASE_URL or VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY          required for --apply (service_role or sb_secret_… key)
//   VITE_SUPABASE_PUBLISHABLE_KEY      enough for a dry run (read-only)
//
// USAGE
//   node upload.mjs                          # dry run: what would be uploaded
//   node upload.mjs --apply                  # upload + update cover_url
//   node upload.mjs --only slug1,slug2       # only these books
//   node upload.mjs --force --only <slug>    # replace an existing cover (e.g. the Godan sample)
//   node upload.mjs --manifest path/to/manifest.json --folder hindi-story-covers
//   node upload.mjs --apply --report uploaded.json   # also write the resulting URLs as JSON
//
// In GitHub Actions (.github/workflows/upload-hindi-covers.yml) the list of uploaded covers
// and their public URLs is also written to the job summary.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const k = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) a[k] = true;
    else (a[k] = next), i++;
  }
  return a;
}

async function loadDotEnv(file) {
  try {
    for (const line of (await fs.readFile(file, "utf8")).split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env — fine */
  }
}

const args = parseArgs(process.argv.slice(2));
await loadDotEnv(path.join(REPO, ".env"));

const BASE = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const KEY = SERVICE || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const BUCKET = "book-covers";
const FOLDER = String(args.folder || "hindi-story-covers").replace(/^\/+|\/+$/g, "");
const APPLY = Boolean(args.apply);
const manifestPath = path.resolve(typeof args.manifest === "string" ? args.manifest : path.join(REPO, "content-drafts/covers/hindi/manifest.json"));

if (!BASE || !KEY) {
  console.error("Set SUPABASE_URL (or VITE_SUPABASE_URL) and a key (SUPABASE_SERVICE_ROLE_KEY for --apply).");
  process.exit(2);
}
if (APPLY && !SERVICE) {
  console.error("--apply needs SUPABASE_SERVICE_ROLE_KEY (the publishable key cannot write to storage or books).");
  process.exit(2);
}

// New-style keys (sb_publishable_…, sb_secret_…) are not JWTs: send them only as `apikey` and the
// gateway substitutes the matching role. Legacy JWT keys also go in Authorization.
const headers = (extra = {}) => (KEY.startsWith("sb_") ? { apikey: KEY, ...extra } : { apikey: KEY, Authorization: `Bearer ${KEY}`, ...extra });

async function api(method, url, { body, headers: h } = {}) {
  const res = await fetch(url, { method, body, headers: headers(h) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url.replace(BASE, "")} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const outDir = path.dirname(manifestPath);
const only = args.only ? new Set(String(args.only).split(",").map((s) => s.trim())) : null;

const ready = [];
for (const b of manifest.books) {
  if (only && !only.has(b.slug) && !only.has(b.key)) continue;
  if (b.status !== "done") continue;
  const file = path.join(outDir, b.file || `${b.slug}.jpg`);
  try {
    await fs.access(file);
    ready.push({ b, file });
  } catch {
    console.warn(`! missing file for ${b.title}: ${path.relative(REPO, file)}`);
  }
}

// Current DB state, in chunks (keeps the URL short).
const rows = new Map();
for (let i = 0; i < ready.length; i += 40) {
  const ids = ready.slice(i, i + 40).map((r) => r.b.id);
  const data = await api("GET", `${BASE}/rest/v1/books?select=id,title,cover_url,language&id=in.(${ids.join(",")})`);
  for (const r of data) rows.set(r.id, r);
}

const plan = [];
const skipped = [];
for (const r of ready) {
  const row = rows.get(r.b.id);
  if (!row) {
    console.log(`- skip  ${r.b.title}: book id not found (${r.b.id})`);
    skipped.push({ key: r.b.key, title: r.b.title, reason: "book id not found" });
  } else if (row.cover_url && !args.force) {
    console.log(`- skip  ${r.b.title}: already has a cover`);
    skipped.push({ key: r.b.key, title: r.b.title, reason: "already has a cover", cover_url: row.cover_url });
  } else plan.push({ ...r, row });
}
const uploaded = [];
let failed = 0;

async function writeReport() {
  if (typeof args.report === "string")
    await fs.writeFile(path.resolve(args.report), JSON.stringify({ generatedAt: new Date().toISOString(), apply: APPLY, uploaded, skipped, failed }, null, 2) + "\n");
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary) return;
  const lines = [`### Hindi covers: ${uploaded.length} uploaded${failed ? `, ${failed} failed` : ""}, ${skipped.length} skipped`, ""];
  if (uploaded.length) {
    lines.push("| Book | Author | Cover URL |", "|---|---|---|");
    for (const u of uploaded) lines.push(`| ${u.title} | ${u.author} | ${u.url} |`);
    lines.push("");
  }
  if (!APPLY) lines.push(`Dry run: ${plan.length} cover(s) would be uploaded.`, "");
  await fs.appendFile(summary, lines.join("\n") + "\n");
}

console.log(`\n${plan.length} cover(s) to upload${APPLY ? "" : " (dry run — add --apply to upload)"}:`);
for (const p of plan) console.log(`  ${p.b.title} — ${p.b.authorDisplay || p.b.author}  ←  ${path.basename(p.file)}${p.row.cover_url ? "  (replaces existing)" : ""}`);
if (!APPLY || plan.length === 0) {
  await writeReport();
  process.exit(0);
}

let ok = 0;
for (const p of plan) {
  try {
    // Re-check right before writing, in case someone set a cover meanwhile.
    const [fresh] = await api("GET", `${BASE}/rest/v1/books?select=cover_url&id=eq.${p.b.id}`);
    if (fresh?.cover_url && !args.force) {
      console.log(`- skip  ${p.b.title}: got a cover meanwhile`);
      continue;
    }
    const ext = path.extname(p.file).slice(1).toLowerCase();
    const type = ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "image/jpeg";
    const objectPath = `${FOLDER}/${p.b.id}/${Date.now()}.${ext}`;
    await api("POST", `${BASE}/storage/v1/object/${BUCKET}/${objectPath}`, {
      body: await fs.readFile(p.file),
      headers: { "Content-Type": type, "cache-control": "max-age=3600", "x-upsert": "false" },
    });
    const publicUrl = `${BASE}/storage/v1/object/public/${BUCKET}/${objectPath}`;
    await api("PATCH", `${BASE}/rest/v1/books?id=eq.${p.b.id}`, {
      body: JSON.stringify({ cover_url: publicUrl }),
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    });
    p.b.uploadedUrl = publicUrl;
    p.b.uploadedAt = new Date().toISOString();
    uploaded.push({ key: p.b.key, slug: p.b.slug, id: p.b.id, title: p.b.title, author: p.b.authorDisplay || p.b.author, url: publicUrl });
    ok++;
    console.log(`✓ ${p.b.title}  →  ${objectPath}`);
  } catch (e) {
    console.error(`✗ ${p.b.title}: ${e.message}`);
    failed++;
  }
}
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\n${ok}/${plan.length} uploaded. Manifest updated with uploadedUrl.`);
for (const u of uploaded) console.log(`URL  ${u.title}  ${u.url}`);
await writeReport();
if (failed) process.exitCode = 1;
