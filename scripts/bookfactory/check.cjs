#!/usr/bin/env node
/**
 * Quality + word-count gate for book files.
 *   node scripts/bookfactory/check.cjs [dir] [--json] [--quiet]
 * Exit code 1 if any book fails (so it can run in CI).
 */
const path = require('path');
const { validate, similarity, listBookFiles, MIN_TOTAL_WORDS, PASS_SCORE } = require('./lib.cjs');
const fs = require('fs');

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', '..', 'content-drafts', 'en'));
const asJson = args.includes('--json');
const quiet = args.includes('--quiet');

const files = listBookFiles(dir);
const results = files.map((f) => ({ file: path.basename(f), ...validate(fs.readFileSync(f, 'utf8')) }));
const sims = similarity(files);
const failed = results.filter((r) => !r.pass);

if (asJson) {
  console.log(JSON.stringify({ results, similarity: sims }, null, 2));
} else {
  for (const r of results) {
    if (quiet && r.pass) continue;
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${String(r.words).padStart(5)} words  score ${String(r.score).padStart(3)}  ${r.file}`);
    if (!r.pass || !quiet) for (const i of r.issues) console.log(`        ${i.hard ? '[HARD]' : '[soft]'} ${i.msg}`);
  }
  for (const s of sims) console.log(`SIMILAR ${s.a} <-> ${s.b} overlap ${s.overlap}${s.note ? ' ' + s.note : ''}`);
  const total = results.reduce((a, r) => a + r.words, 0);
  console.log(`\n${results.length - failed.length}/${results.length} pass (>= ${MIN_TOTAL_WORDS} words and score >= ${PASS_SCORE}). ${total} words total.`);
}
process.exit(failed.length || sims.length ? 1 : 0);
