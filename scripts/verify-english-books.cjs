#!/usr/bin/env node
/**
 * 🔍 Quality Gate — 10 Best English Books
 *
 * Hard gates (fail = exit 1):
 *   - word count of #SUMMARY >= 3200 (configurable via MIN_WORDS)
 *   - all genre-required sections present
 *   - required front-matter fields present
 *   - no placeholder junk (TODO, Lorem, xxx, [...])
 *
 * Quality score (pass >= 98/100):
 *   - words        40 pts  (min(WC / 3400, 1) — encourages 3400+)
 *   - structure    25 pts  (all genre sections present)
 *   - originality  15 pts  (no duplicated 12-word shingle across books)
 *   - meta         10 pts  (tagline length, slug format, year, category)
 *   - readability  10 pts  (avg sentence length in band; penalty for very long sentences)
 *
 * Usage: node scripts/verify-english-books.cjs
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'content-drafts-english');
const MIN_WORDS = 3200;
const TARGET_WORDS = 3400;
const PASS_SCORE = 98;

// Genre-specific required sections (substring match, case-insensitive).
const BOOKS = [
  { file: 'pride-and-prejudice-jane-austen.txt', genre: 'Romance of Manners', sections: ['world of longbourn', 'first proposal', 'charlotte', 'pemberley', 'why elizabeth changed the novel'] },
  { file: 'to-kill-a-mockingbird-harper-lee.txt', genre: 'Social Justice Drama', sections: ['maycomb', 'courage', 'mob at the jail', 'trial of tom robinson', 'mockingbird'] },
  { file: '1984-george-orwell.txt', genre: 'Dystopia', sections: ['oceania', 'machinery of control', 'small rebellion', 'room 101', 'newspeak'] },
  { file: 'the-great-gatsby-f-scott-fitzgerald.txt', genre: 'Jazz Age Tragedy', sections: ['nick', 'careless people', 'green light', 'plaza', 'afterlife'] },
  { file: 'hamlet-william-shakespeare.txt', genre: 'Revenge Tragedy', sections: ['ghost', 'delay', 'mousetrap', 'ophelia', 'bloodbath'] },
  { file: 'the-hobbit-jrr-tolkien.txt', genre: 'Fantasy Quest', sections: ['unexpected party', 'riddles in the dark', 'dragon', 'battle of five armies', 'return'] },
  { file: 'animal-farm-george-orwell.txt', genre: 'Political Allegory', sections: ['old major', 'commandments', 'windmill', 'boxer', 'final scene'] },
  { file: 'jane-eyre-charlotte-bronte.txt', genre: 'Gothic Bildungsroman', sections: ['red room', 'lowood', 'thornfield', 'attic', 'moors'] },
  { file: 'lord-of-the-flies-william-golding.txt', genre: 'Allegorical Survival', sections: ['island as laboratory', 'conch', 'beast', 'piggy', 'rescue'] },
  { file: 'the-old-man-and-the-sea-ernest-hemingway.txt', genre: 'Literary Parable', sections: ['eighty-four days', 'sharks', 'destroyed but not defeated', 'lions', 'iceberg'] },
];

function words(s) { return s.trim().split(/\s+/).filter(w => w.length > 0).length; }

function countShingles(text, n = 12) {
  const toks = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const set = new Map();
  for (let i = 0; i <= toks.length - n; i++) {
    const key = toks.slice(i, i + n).join(' ');
    const arr = set.get(key) || [];
    arr.push(i);
    set.set(key, arr);
  }
  return set;
}

const results = [];
const allShingles = []; // {book, map}
const hardFailures = [];

for (const spec of BOOKS) {
  const p = path.join(DIR, spec.file);
  if (!fs.existsSync(p)) { hardFailures.push(`MISSING FILE: ${spec.file}`); results.push({ file: spec.file, error: 'missing' }); continue; }
  const c = fs.readFileSync(p, 'utf8');

  const field = (re) => { const m = c.match(re); return m ? m[1].trim() : null; };
  const title = field(/^Title:\s*(.+)$/m);
  const author = field(/^Author:\s*(.+)$/m);
  const yearRaw = field(/^Year:\s*(\d{4})$/m);
  const lang = field(/^Language:\s*(\w+)$/m);
  const category = field(/^Category:\s*(.+)$/m);
  const slug = field(/^Slug:\s*(.+)$/m);
  const tagline = ((c.match(/#TAGLINE\n([\s\S]*?)(?=\n#\w)/) || [])[1] || '').trim();
  const summary = ((c.match(/#SUMMARY\n([\s\S]*?)(?=\n#KEY_IDEAS)/) || [])[1] || '').trim();
  const keyIdeas = ((c.match(/#KEY_IDEAS\n([\s\S]*?)(?=\n#HOW_TO_READ)/) || [])[1] || '').trim();
  const howToRead = ((c.match(/#HOW_TO_READ\n([\s\S]*?)(?=\n#REFLECTION)/) || [])[1] || '').trim();
  const reflection = ((c.match(/#REFLECTION\n([\s\S]*)$/) || [])[1] || '').trim();

  // ---- hard gates ----
  const wc = words(summary);
  const sections = spec.sections.filter(s => summary.toLowerCase().includes(s));
  const missingSections = spec.sections.filter(s => !sections.includes(s));
  const placeholders = /\b(TODO|FIXME|Lorem ipsum|\[\.\.\.\]|xxx)\b/i.test(summary);

  if (wc < MIN_WORDS) hardFailures.push(`${spec.file}: word count ${wc} < ${MIN_WORDS}`);
  if (missingSections.length) hardFailures.push(`${spec.file}: missing sections: ${missingSections.join(', ')}`);
  if (placeholders) hardFailures.push(`${spec.file}: placeholder text found`);
  for (const [name, v] of [['Title', title], ['Author', author], ['Category', category], ['Slug', slug]]) {
    if (!v) hardFailures.push(`${spec.file}: missing field ${name}`);
  }
  if (!yearRaw || +yearRaw < 1000 || +yearRaw > 2026) hardFailures.push(`${spec.file}: bad year`);
  if (lang !== 'en') hardFailures.push(`${spec.file}: Language must be 'en'`);
  if (words(keyIdeas.split(/[-•\n]/).filter(x => x.trim()).join(' ')) < 30) hardFailures.push(`${spec.file}: KEY_IDEAS too thin`);
  if ((reflection.match(/^\s*\d+\./gm) || []).length < 4) hardFailures.push(`${spec.file}: REFLECTION needs >=4 questions`);
  if (words(howToRead) < 60) hardFailures.push(`${spec.file}: HOW_TO_READ too thin`);
  if (slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) hardFailures.push(`${spec.file}: bad slug format: ${slug}`);

  // ---- score ----
  const wordPts = 40 * Math.min(1, wc / TARGET_WORDS);
  const structPts = missingSections.length === 0 ? 25 : 25 * (sections.length / spec.sections.length);
  const metaPts = (
    (tagline.length > 20 && tagline.length <= 300 ? 4 : 0) +
    (slug && /^[a-z0-9-]+$/.test(slug) ? 2 : 0) +
    (yearRaw ? 2 : 0) +
    (category ? 2 : 0)
  );
  const prose = summary.split('\n').filter(l => !l.startsWith('#')).join('\n');
  const sentences = prose.split(/(?<=[.!?]["'”’)]?)\s+/).filter(s => words(s) > 2);
  const sentLens = sentences.map(words);
  const avgLen = sentLens.reduce((a, b) => a + b, 0) / Math.max(1, sentLens.length);
  const longOnes = sentLens.filter(l => l > 85).length;
  const readPts = Math.max(0, (avgLen >= 13 && avgLen <= 38 ? 8 : 4) + (longOnes === 0 ? 2 : 0));

  const shMap = countShingles(summary);
  allShingles.push({ book: spec.file, map: shMap });

  results.push({
    file: spec.file, genre: spec.genre, wc, score: null, avgLen: avgLen.toFixed(1),
    metaPts, readPts, wordPts, structPts,
  });
}

// ---- originality across books ----
let dupes = 0;
for (let i = 0; i < allShingles.length; i++) {
  for (let j = i + 1; j < allShingles.length; j++) {
    for (const key of allShingles[i].map.keys()) {
      if (allShingles[j].map.has(key)) { dupes++; if (dupes <= 3) hardFailures.push(`DUPLICATE ${allShingles[i].book} <-> ${allShingles[j].book}: "${key}"`); }
    }
  }
}
const origPts = dupes === 0 ? 15 : Math.max(0, 15 - dupes);

// finalize scores
for (const r of results) {
  if (r.error) continue;
  r.score = +(r.wordPts + r.structPts + origPts + r.metaPts + r.readPts).toFixed(1);
}

console.log('\n📚 QUALITY REPORT — 10 Best English Books\n');
console.log('FILE'.padEnd(46) + 'GENRE'.padEnd(22) + 'WORDS'.padStart(6) + '  SCORE');
console.log('-'.repeat(90));
for (const r of results) {
  console.log(r.file.replace('.txt', '').padEnd(46) + (r.genre || '').padEnd(22) + String(r.wc || '-').padStart(6) + `  ${r.score !== null ? r.score : 'ERR'} ${r.wc >= MIN_WORDS ? '✓' : '✗'}`);
}
const total = results.reduce((a, r) => a + (r.wc || 0), 0);
const minScore = Math.min(...results.filter(r => r.score !== null).map(r => r.score));
console.log('-'.repeat(90));
console.log(`TOTAL WORDS: ${total}   MIN BOOK SCORE: ${minScore}/100 (pass >= ${PASS_SCORE})   CROSS-BOOK DUPLICATE 12-GRAMS: ${dupes}`);

if (hardFailures.length) {
  console.log('\n❌ HARD FAILURES:');
  hardFailures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
if (minScore < PASS_SCORE) {
  console.log(`\n❌ Quality score below ${PASS_SCORE}. Improve the flagged books.`);
  process.exit(1);
}
console.log('\n✅ ALL CHECKS PASSED — every book >= 3200 words, genre-complete, original, quality >= 98/100\n');
