#!/usr/bin/env node
/**
 * 🚀 BATCH 01 RUNNER — generates 50 English drafts via the shared engine.
 * Usage: node scripts/generate-english-batch-01.cjs
 */
const fs = require('fs');
const path = require('path');
const { DATA } = require('./english-batch-01.data.cjs');
const { generateDraft, words, MIN_WORDS } = require('./english-engine.cjs');

const OUT = path.join(__dirname, '..', 'content-drafts-library');
fs.mkdirSync(OUT, { recursive: true });

let ok = 0, short = [];
DATA.forEach((b, i) => {
  const text = generateDraft(b, i);
  // strict count: everything between TAGLINE body and #KEY_IDEAS
  const body = text.split(/#TAGLINE\n[^\n]*\n\n/)[1].split(/#KEY_IDEAS/)[0];
  const wc = words(body);
  fs.writeFileSync(path.join(OUT, `${b.slug}.txt`), text);
  if (wc >= MIN_WORDS) { ok++; console.log(`  ✅ [${i + 1}/${DATA.length}] ${b.t} — ${wc} words`); }
  else { short.push(`${b.t} (${wc})`); console.log(`  ⚠️  [${i + 1}/${DATA.length}] ${b.t} — SHORT: ${wc}`); }
});

console.log(`\n📊 Batch 01: ${ok}/${DATA.length} passed the ${MIN_WORDS}-word floor.`);
if (short.length) console.log('Short:', short.join(', '));

// update PROGRESS.json
const PROGRESS = path.join(OUT, 'PROGRESS.json');
const progress = fs.existsSync(PROGRESS) ? JSON.parse(fs.readFileSync(PROGRESS, 'utf8')) : { generated: {}, runs: [] };
DATA.forEach((b, i) => {
  const text = fs.readFileSync(path.join(OUT, `${b.slug}.txt`), 'utf8');
  const body = text.split(/#TAGLINE\n[^\n]*\n\n/)[1].split(/#KEY_IDEAS/)[0];
  progress.generated[b.slug] = {
    status: words(body) >= MIN_WORDS ? 'drafted' : 'short',
    words: words(body), engine: 'template-v2', batch: 1, at: new Date().toISOString(),
  };
});
progress.runs.push({ at: new Date().toISOString(), engine: 'template-v2', batch: 1, books: DATA.length, ok });
fs.writeFileSync(PROGRESS, JSON.stringify(progress, null, 2));
console.log('PROGRESS.json updated.');
