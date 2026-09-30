#!/usr/bin/env node
/**
 * 📤 LIBRARY UPLOADER — chunked Supabase upsert for the 2000-book catalog
 *
 * Reads verified drafts from content-drafts-library/, converts to book rows,
 * upserts in chunks of 50 (merge on slug), then verifies: visibility flags +
 * word counts read back from DB.
 *
 * Credentials (.env or env): SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * Options:
 *   --limit=N     upload at most N books (default 100)
 *   --status=...  only books whose PROGRESS.json status is 'drafted' (default)
 *
 * Usage: node scripts/upload-library.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'content-drafts-library');
const PROGRESS = path.join(DIR, 'PROGRESS.json');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([a-zA-Z]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const LIMIT = +args.limit || 100;
const CHUNK = 50;

const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const BASE = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error('❌ Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

const GENRES = JSON.parse(fs.readFileSync(path.join(__dirname, 'library-genres.json'), 'utf8'));
const progress = fs.existsSync(PROGRESS) ? JSON.parse(fs.readFileSync(PROGRESS, 'utf8')) : { generated: {} };

function esc(s) { return (s || '').replace(/\\/g, '\\\\').replace(/'/g, "''"); }
function words(s) { return s.trim().split(/\s+/).filter(Boolean).length; }
function display(s) { return (s || '').replace(/^#{1,6}\s+/gm, '').trim(); }

function parseDraft(file) {
  const c = fs.readFileSync(path.join(DIR, file), 'utf8');
  const grab = re => { const m = c.match(re); return m ? m[1].trim() : null; };
  const title = grab(/^Title:\s*(.+)$/m);
  const author = grab(/^Author:\s*(.+)$/m);
  const year = +grab(/^Year:\s*(-?\d{1,4})$/m) || null;
  const lang = grab(/^Language:\s*(\w+)$/m) || 'en';
  const genre = grab(/^Genre:\s*(.+)$/m);
  const category = grab(/^Category:\s*(.+)$/m) || (GENRES[genre] || {}).label || 'General';
  const slug = grab(/^Slug:\s*(.+)$/m);
  const body = c.split(/#TAGLINE\n/)[1] || '';
  const tagline = (body.split('\n')[0] || '').trim();
  const summary = display(body.split(/#KEY_IDEAS/)[0].replace(/^[\s\S]*?\n\n/, '').trim());
  const keyIdeas = display((c.match(/#KEY_IDEAS\n([\s\S]*?)(?=#HOW_TO_READ|$)/) || [])[1] || '');
  const howToRead = display((c.match(/#HOW_TO_READ\n([\s\S]*?)(?=#REFLECTION|$)/) || [])[1] || '');
  const reflection = display((c.match(/#REFLECTION\n([\s\S]*)$/) || [])[1] || '');
  const wc = words(summary);
  const cut = summary.slice(0, 760);
  const overview = summary.length <= 760 ? summary : cut.slice(0, cut.lastIndexOf('. ') + 1).trim();
  return {
    slug, title, author, category, cover_color: ['amber', 'blue', 'green', 'purple', 'teal', 'rose', 'indigo', 'orange'][wc % 8],
    tagline, overview, key_ideas: keyIdeas, deep_analysis: summary,
    daily_application: howToRead, reflection_questions: reflection, action_system: '',
    language: lang, reading_time: Math.max(8, Math.ceil(wc / 200)), rating: 4.7, year: year && year > 0 ? year : null,
    is_draft: false, status: 'published',
    meta_title: `${title} Summary — Key Lessons & Deep Analysis | Booknomics`,
    meta_description: (tagline || overview).replace(/\s+/g, ' ').slice(0, 155).replace(/\s+\S*$/, '') + '…',
  };
}

async function upsert(rows) {
  const res = await fetch(`${BASE}/rest/v1/books?on_conflict=slug`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function main() {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.txt') && (progress.generated[f.replace('.txt', '')] || {}).status === 'drafted');
  const batch = files.slice(0, LIMIT).map(parseDraft);
  if (!batch.length) { console.log('Nothing to upload (no drafted books).'); return; }
  console.log(`\n📤 Uploading ${batch.length} books in chunks of ${CHUNK}...`);
  const slugs = [];
  for (let i = 0; i < batch.length; i += CHUNK) {
    const chunk = batch.slice(i, i + CHUNK);
    const saved = await upsert(chunk);
    slugs.push(...saved.map(r => r.slug));
    console.log(`   chunk ${Math.floor(i / CHUNK) + 1}: ${saved.length} rows ✓`);
    await new Promise(r => setTimeout(r, 500));
  }
  // verify
  const back = await fetch(`${BASE}/rest/v1/books?slug=in.(${slugs.map(s => `"${s}"`).join(',')})&select=slug,is_draft,status,deep_analysis`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const rows = await back.json();
  let bad = 0;
  for (const r of rows) {
    const wc = (r.deep_analysis || '').trim().split(/\s+/).filter(Boolean).length;
    if (r.is_draft !== false || r.status !== 'published' || wc < 3000) { bad++; console.log(`  ✗ ${r.slug}: draft=${r.is_draft} status=${r.status} words=${wc}`); }
  }
  console.log(bad === 0 ? `\n✅ VERIFIED: ${rows.length} books live-ready (is_draft=false, published, word counts intact)\n` : `\n❌ ${bad} books failed verification\n`);
  process.exit(bad === 0 ? 0 : 1);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
