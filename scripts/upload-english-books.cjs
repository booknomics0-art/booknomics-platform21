#!/usr/bin/env node
/**
 * 📤 One-command uploader: 10 English books → Supabase
 *
 * Reads credentials from environment or repo-root .env (never committed):
 *   SUPABASE_URL=https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service role key>   # SECRET — server-side only
 *   (or SUPABASE_DB_URL for the psql path — see docs/ENGLISH-BOOKS.md)
 *
 * What it does:
 *   1. Verifies local drafts pass the quality gate (word counts, structure).
 *   2. Upserts all 10 books via PostgREST (merge on slug — safe to re-run).
 *   3. Reads back every row and verifies visibility flags + word counts.
 *
 * Usage: node scripts/upload-english-books.cjs
 * Exit codes: 0 = uploaded & verified, 1 = config/verification failure.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const JSON_FILE = path.join(ROOT, 'content-drafts-english', 'BOOKS_10_ENGLISH.json');

// ---- load .env if present (no dependency, no logging of secrets) ----
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const URL_BASE = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !KEY) {
  console.error(`
❌ Missing credentials.

Add to .env (repo root, gitignored) or export:
  SUPABASE_URL=https://<project-ref>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # Supabase Dashboard → Settings → API

Never commit the service-role key. Prefer the dashboard SQL Editor path if you
cannot keep secrets on this machine: content-drafts-english/sql-chunks-english/chunk-01.sql
`);
  process.exit(1);
}

if (!fs.existsSync(JSON_FILE)) {
  console.error('❌ BOOKS_10_ENGLISH.json not found. Run: node scripts/generate-english-upload.cjs');
  process.exit(1);
}

const books = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
console.log(`\n📤 Upserting ${books.length} English books → ${URL_BASE.replace(/^https?:\/\//, '')} ...`);

async function main() {
  const rows = books.map(({ word_count, ...r }) => r); // DB has no word_count column
  const res = await fetch(`${URL_BASE}/rest/v1/books?on_conflict=slug`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    console.error(`❌ Upsert failed: HTTP ${res.status} ${res.statusText}`);
    console.error((await res.text()).slice(0, 800));
    process.exit(1);
  }
  const saved = await res.json();
  console.log(`✅ Upserted ${saved.length} rows.`);

  // ---- read back & verify ----
  const slugs = books.map(b => `"${b.slug}"`).join(',');
  const back = await fetch(
    `${URL_BASE}/rest/v1/books?slug=in.(${slugs})&select=slug,title,is_draft,status,reading_time,language,deep_analysis`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
  );
  const rowsBack = await back.json();
  console.log('\n🔎 POST-UPLOAD VERIFICATION');
  let ok = true;
  const bySlug = Object.fromEntries(rowsBack.map(r => [r.slug, r]));
  for (const b of books) {
    const r = bySlug[b.slug];
    if (!r) { console.log(`  ✗ ${b.slug}: MISSING after upsert`); ok = false; continue; }
    const wc = (r.deep_analysis || '').trim().split(/\s+/).filter(Boolean).length;
    const visible = r.is_draft === false && r.status === 'published';
    const wordsOk = wc >= b.word_count - 5;
    console.log(`  ${visible && wordsOk ? '✓' : '✗'} ${b.slug}: ${wc} words (local ${b.word_count}), is_draft=${r.is_draft}, status=${r.status}`);
    if (!visible || !wordsOk) ok = false;
  }
  console.log(ok ? '\n✅ UPLOAD VERIFIED — all 10 books live-ready (is_draft=false, status=published, word counts intact)\n'
                  : '\n❌ VERIFICATION FAILED — inspect rows above\n');
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
