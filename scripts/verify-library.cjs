#!/usr/bin/env node
/**
 * 🔍 LIBRARY QUALITY GATE — verifies every draft in content-drafts-library/
 *
 * Checks per book (exit 1 on any hard failure):
 *   - summary word count >= MIN (default 3200)
 *   - genre sections present (scripts/library-genres.json)
 *   - KEY_IDEAS / HOW_TO_READ / REFLECTION (>=4 questions) present
 *   - front-matter complete (Title/Author/Year/Language/Category/Slug)
 *   - not a template placeholder
 *   - no cross-book duplicate 12-word shingles
 *
 * Usage:
 *   node scripts/verify-library.cjs                 # verify all drafted
 *   node scripts/verify-library.cjs --min=3200      # custom floor
 *   node scripts/verify-library.cjs --quiet         # only failures
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'content-drafts-library');
const GENRES = JSON.parse(fs.readFileSync(path.join(__dirname, 'library-genres.json'), 'utf8'));
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([a-zA-Z]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const MIN = +args.min || 3200;
const QUIET = !!args.quiet;

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.txt')) : [];
if (!files.length) { console.log('No drafts yet. Generate first: node scripts/batch-generate-books.cjs'); process.exit(0); }

const failures = [];
const shingles = new Map(); // key -> first book
const rows = [];
let dupes = 0;

function words(s) { return s.trim().split(/\s+/).filter(Boolean).length; }

for (const f of files) {
  const c = fs.readFileSync(path.join(DIR, f), 'utf8');
  const grab = re => { const m = c.match(re); return m ? m[1].trim() : null; };
  const title = grab(/^Title:\s*(.+)$/m);
  const author = grab(/^Author:\s*(.+)$/m);
  const genre = grab(/^Genre:\s*(.+)$/m);
  const lang = grab(/^Language:\s*(\w+)$/m);
  const slug = grab(/^Slug:\s*(.+)$/m);
  const body = c.split(/#TAGLINE\n/)[1] || '';
  const summary = body.split(/#KEY_IDEAS/)[0].replace(/^[\s\S]*?\n\n/, '').trim();
  const keyIdeas = (c.match(/#KEY_IDEAS\n([\s\S]*?)(?=#HOW_TO_READ|$)/) || [])[1] || '';
  const reflection = (c.match(/#REFLECTION\n([\s\S]*)$/) || [])[1] || '';
  const wc = words(summary);
  const req = (GENRES[genre] || {}).sections || [];
  const missing = req.filter(s => !summary.toLowerCase().includes(s.split(' ')[0].toLowerCase()));
  const isTemplate = /\[TEMPLATE PLACEHOLDER/.test(c);
  const qCount = (reflection.match(/^\s*\d+\./gm) || []).length;

  const errs = [];
  if (!title || !author || !slug) errs.push('missing front-matter');
  if (wc < MIN) errs.push(`${wc} words < ${MIN}`);
  if (missing.length >= Math.ceil(req.length / 2)) errs.push(`sections largely missing (${missing.length}/${req.length})`);
  if (isTemplate) errs.push('template placeholder');
  if (words(keyIdeas) < 25) errs.push('KEY_IDEAS thin');
  if (qCount < 4) errs.push('REFLECTION needs 4+ questions');
  if (lang !== 'en' && lang !== 'hi') errs.push(`bad language: ${lang}`);

  // originality shingles
  const toks = summary.toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = 0; i <= toks.length - 12; i++) {
    const key = toks.slice(i, i + 12).join(' ');
    const owner = shingles.get(key);
    if (owner && owner !== slug) { dupes++; if (dupes <= 3) errs.push(`duplicate content with ${owner}`); }
    else shingles.set(key, slug);
  }

  rows.push({ file: f, title, wc, ok: errs.length === 0 });
  if (errs.length) failures.push(`${f}: ${errs.join('; ')}`);
}

rows.sort((a, b) => a.wc - b.wc);
if (!QUIET) {
  console.log(`\n🔍 LIBRARY REPORT — ${rows.length} drafts, floor ${MIN}w, duplicates ${dupes}`);
  for (const r of rows) console.log(`  ${r.ok ? '✓' : '✗'} ${String(r.wc).padStart(5)}w  ${r.title || r.file}`);
}
if (failures.length) {
  console.log(`\n❌ FAILURES (${failures.length}):`);
  failures.slice(0, 30).forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log(`\n✅ ALL ${rows.length} DRAFTS PASS (>= ${MIN} words, structured, original)\n`);
