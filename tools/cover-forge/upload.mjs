#!/usr/bin/env node
// Push generated covers into Supabase Storage and point books.cover_url at them.
//
//   node upload.mjs --manifest out/manifest.json                 # dry run
//   node upload.mjs --manifest out/manifest.json --apply         # upload + update
//   node upload.mjs --manifest out/manifest.json --apply --skip-existing
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (never
// VITE_* — this script runs on your machine, not in the browser).

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    manifest: { type: "string", default: "covers/manifest.json" },
    bucket: { type: "string", default: "book-covers" },
    prefix: { type: "string", default: "covers" },
    apply: { type: "boolean", default: false },
    "skip-existing": { type: "boolean", default: false },
    concurrency: { type: "string", default: "4" },
    "max-bytes": { type: "string", default: String(300 * 1024) },
    help: { type: "boolean", default: false },
  },
});

if (args.help) {
  console.log("Usage: node upload.mjs --manifest covers/manifest.json [--apply] [--skip-existing] [--bucket book-covers] [--prefix covers]");
  process.exit(0);
}

const configured = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (args.apply && !configured) throw new Error("SUPABASE_URL is required with --apply");
if (args.apply && !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required with --apply (service role, not the anon key)");
// A dry run does not touch the network, so it also works with no credentials.
const url = configured || "https://<project>.supabase.co";
if (args.apply && args["skip-existing"] && !url) throw new Error("--skip-existing needs SUPABASE_URL");
if (!configured) console.log("SUPABASE_URL is not set — dry run only, URLs below are illustrative.\n");

const manifestPath = path.resolve(args.manifest);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const outDir = path.dirname(manifestPath);
const maxBytes = Number(args["max-bytes"]);
const concurrency = Math.max(1, Number(args.concurrency));

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function existingCover(slug) {
  const res = await fetch(`${url}/rest/v1/books?select=slug,cover_url&slug=eq.${encodeURIComponent(slug)}&limit=1`, { headers });
  if (!res.ok) return undefined;
  const rows = await res.json();
  return rows[0]?.cover_url;
}

async function uploadOne(item) {
  const file = path.join(outDir, item.file);
  if (!fs.existsSync(file)) return `missing ${item.file}`;
  const bytes = fs.statSync(file).size;
  if (bytes > maxBytes) return `${item.slug}: ${(bytes / 1024).toFixed(0)} KB exceeds the limit, run check.mjs first`;

  const objectPath = `${args.prefix}/${item.slug}.jpg`;
  const publicUrl = `${url}/storage/v1/object/public/${args.bucket}/${objectPath}`;

  if (args["skip-existing"] && configured) {
    const current = await existingCover(item.slug);
    if (current) return `skip (already has a cover)`;
  }

  if (!args.apply) return `would upload -> ${publicUrl}`;

  const body = fs.readFileSync(file);
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const up = await fetch(`${url}/storage/v1/object/${args.bucket}/${objectPath}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "image/jpeg", "cache-control": "31536000", "x-upsert": "true" },
      body,
    });
    if (up.ok) {
      lastError = "";
      break;
    }
    lastError = `${up.status} ${(await up.text()).slice(0, 160)}`;
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  if (lastError) return `${item.slug}: upload failed (${lastError})`;

  const filter = item.id ? `id=eq.${encodeURIComponent(item.id)}` : `slug=eq.${encodeURIComponent(item.slug)}`;
  const patch = await fetch(`${url}/rest/v1/books?${filter}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ cover_url: publicUrl }),
  });
  if (!patch.ok) return `${item.slug}: DB update failed (${patch.status} ${(await patch.text()).slice(0, 160)})`;
  return `ok`;
}

console.log(
  `${args.apply ? "UPLOADING" : "DRY RUN"} — ${manifest.books.length} cover(s) -> ${args.bucket}/${args.prefix}/ ` +
    `(${args["skip-existing"] ? "skipping books that already have covers" : "overwriting"})`,
);

let cursor = 0;
let ok = 0;
const problems = [];
await Promise.all(
  Array.from({ length: Math.min(concurrency, manifest.books.length) }, async () => {
    while (cursor < manifest.books.length) {
      const item = manifest.books[cursor];
      cursor += 1;
      const result = await uploadOne(item);
      if (result === "ok" || result.startsWith("skip") || result.startsWith("would")) ok += 1;
      else problems.push(result);
      if (!args.apply || item === manifest.books[cursor - 1]) console.log(`  ${item.slug}: ${result}`);
    }
  }),
);

console.log(`\n${ok} processed, ${problems.length} problem(s).`);
for (const p of problems) console.log(`  ! ${p}`);
if (!args.apply) console.log("\nNothing was written. Re-run with --apply when the plan looks right.");
process.exit(problems.length ? 1 : 0);
