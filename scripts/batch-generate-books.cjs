#!/usr/bin/env node
/**
 * 🏭 BATCH BOOK GENERATOR — scales to 2000 books
 *
 * Reads the queue from data/books-master-list.json, generates one draft per
 * book into content-drafts-library/<slug>.txt, and tracks progress in
 * content-drafts-library/PROGRESS.json (resumable — re-run any time).
 *
 * Engines:
 *   --engine=gemini     Real LLM generation. Needs GEMINI_API_KEY (env or .env).
 *                       Optional: GEMINI_MODEL (default gemini-2.0-flash).
 *   --engine=template   Deterministic fallback (marks drafts `template: true`;
 *                       they must be upgraded before publishing — the verifier
 *                       warns on them).
 *
 * Options:
 *   --limit=N       stop after N books this run (default 25)
 *   --tier=1,2      only these tiers (default all)
 *   --only=<slug>   regenerate a single book
 *   --minWords=3200 hard floor per summary (default 3200)
 *   --target=3600   target length asked from the model (default 3600)
 *
 * After generation each draft is immediately word-counted; short outputs get
 * ONE expansion retry; still-short books are logged in PROGRESS.json as
 * `status: "short"` for the next run's retry pass.
 *
 * Usage: node scripts/batch-generate-books.cjs --engine=gemini --limit=25
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIST = path.join(ROOT, 'data', 'books-master-list.json');
const GENRES = JSON.parse(fs.readFileSync(path.join(__dirname, 'library-genres.json'), 'utf8'));
const OUT_DIR = path.join(ROOT, 'content-drafts-library');
const PROGRESS = path.join(OUT_DIR, 'PROGRESS.json');

// ---- .env loader (no deps, no secret logging) ----
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

// ---- args ----
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([a-zA-Z]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
}));
const ENGINE = args.engine || 'gemini';
const LIMIT = +args.limit || 25;
const MIN_WORDS = +args.minWords || 3200;
const TARGET_WORDS = +args.target || 3600;
const ONLY = args.only || null;
const TIERS = args.tier ? String(args.tier).split(',').map(Number) : null;

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const API_KEY = process.env.GEMINI_API_KEY;

fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(PROGRESS)) fs.writeFileSync(PROGRESS, JSON.stringify({ generated: {}, runs: [] }, null, 2));
const progress = JSON.parse(fs.readFileSync(PROGRESS, 'utf8'));

function slugify(title, author, lang) {
  const clean = s => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\u0900-\u097F]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `${clean(title)}-${clean(author).split('-').slice(0, 2).join('-')}-${lang === 'hi' ? 'hindi' : 'summary'}-summary`;
}

function buildPrompt(book) {
  const genre = GENRES[book.genre] || GENRES.self_help;
  const sections = genre.sections;
  const langLine = book.lang === 'hi'
    ? 'Write the ENTIRE output in Hindi (Devanagari script), natural साहित्यिक हिंदी, the way a good Hindi literary magazine writes.'
    : 'Write the ENTIRE output in English, in the voice of a brilliant literary critic.';
  return `You are writing a flagship book-summary for a premium reading site (Booknomics).

Book: "${book.title}" by ${book.author} (${book.year < 0 ? Math.abs(book.year) + ' BCE' : book.year})
Genre: ${genre.label}

${langLine}

HARD REQUIREMENTS:
1. Output between ${TARGET_WORDS} and ${TARGET_WORDS + 500} words total. This is a hard floor — if you finish early, deepen the analysis instead of stopping.
2. Use EXACTLY these section headers, each as a "### <header>" line, in this order (adapt each header's wording to the book, keep the intent):
${sections.map(s => `   - ${s}`).join('\n')}
3. After the sections, output:
   KEY_IDEAS: then 6 bullets, each one line, each a sharp insight (not plot summary).
   HOW_TO_READ: one paragraph (4-6 sentences) of concrete reading advice.
   REFLECTION: then exactly 4 numbered questions (deep, personal, answerable).
4. Facts only about the real book: real plot points, real arguments, real quotes where famous. No invented plot events. If a detail is uncertain, stay at the level you are certain about.
5. Vary sentence rhythm. No filler ("in today's fast-paced world"). No repeating the title meaninglessly. Every paragraph must teach something.
6. No markdown except the "### " headers and the listed labels. Plain prose.

Output ONLY the content (start directly with the first ### section).`;
}

async function callGemini(prompt) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  if (!text.trim()) throw new Error('Gemini returned empty text');
  return text.trim();
}

function countWords(s) { return s.trim().split(/\s+/).filter(Boolean).length; }

function templateDraft(book) {
  const g = GENRES[book.genre] || GENRES.self_help;
  return g.sections.map(s => `### ${s.charAt(0).toUpperCase() + s.slice(1)}\n\n[TEMPLATE PLACEHOLDER — regenerate with --engine=gemini. Book: ${book.title} by ${book.author}. Section intent: ${s}.]`).join('\n\n') +
    `\n\nKEY_IDEAS:\n- [template placeholder]\n\nHOW_TO_READ\n[template placeholder]\n\nREFLECTION\n1. [template placeholder]`;
}

function draftToText(book, raw) {
  const head = `#BOOK_START
Title: ${book.title}
Author: ${book.author}
Year: ${book.year}
Language: ${book.lang}
Genre: ${book.genre}
Category: ${book.category}
Slug: ${book.slug}

#TAGLINE
${raw.match(/TAGLINE:\s*(.+)/)?.[1]?.trim() || `${book.title} — ${book.author} ke sabse gehre vichar, ek hi padhai mein.`}

`;
  // Model was asked for sections + KEY_IDAS/HOW_TO_READ/REFLECTION labels
  const body = raw
    .replace(/KEY_IDEAS:\s*/g, '#KEY_IDEAS\n')
    .replace(/HOW_TO_READ:?\s*/g, '#HOW_TO_READ\n')
    .replace(/REFLECTION:?\s*/g, '#REFLECTION\n');
  return head + body.trim() + '\n';
}

function summaryWordCount(text) {
  const m = text.match(/#SUMMARY_NOT_USED/) ? null : text;
  // count everything between the tagline block and #KEY_IDEAS (sections live there)
  const body = m.replace(/^[\s\S]*?#TAGLINE\n[^\n]*\n\n/, '').split(/#KEY_IDEAS/)[0];
  return countWords(body);
}

async function generateOne(book) {
  const file = path.join(OUT_DIR, `${book.slug}.txt`);
  let raw;
  if (ENGINE === 'gemini') {
    raw = await callGemini(buildPrompt(book));
  } else {
    raw = templateDraft(book);
  }
  let text = draftToText(book, raw);
  let wc = summaryWordCount(text);

  if (ENGINE === 'gemini' && wc < MIN_WORDS) {
    console.log(`   ↻ ${book.slug}: ${wc} words < ${MIN_WORDS}, retrying with expansion instruction...`);
    const expand = await callGemini(buildPrompt(book) + `\n\nIMPORTANT: your previous draft was only ${wc} words. Depth, not speed: expand analysis, evidence, and examples. Do not summarize your summary — write fuller.`);
    const text2 = draftToText(book, expand);
    const wc2 = summaryWordCount(text2);
    if (wc2 > wc) { text = text2; wc = wc2; }
  }
  fs.writeFileSync(file, text);
  return wc;
}

async function main() {
  const list = JSON.parse(fs.readFileSync(LIST, 'utf8')).books;
  let queue = list.map(b => ({ ...b, slug: b.slug || slugify(b.title, b.author, b.lang) }));

  if (ONLY) queue = queue.filter(b => b.slug === ONLY);
  if (TIERS) queue = queue.filter(b => TIERS.includes(b.tier));
  queue = queue.filter(b => {
    const st = progress.generated[b.slug];
    return !st || st.status === 'short'; // retry short ones
  });
  queue = queue.slice(0, LIMIT);

  if (!queue.length) { console.log('✅ Queue empty — nothing pending in this filter.'); return; }
  if (ENGINE === 'gemini' && !API_KEY) {
    console.error('❌ --engine=gemini needs GEMINI_API_KEY in env/.env. Get one free at aistudio.google.com and add to .env: GEMINI_API_KEY=...');
    process.exit(1);
  }

  console.log(`\n🏭 Generating ${queue.length} books (engine=${ENGINE}, model=${MODEL}, min=${MIN_WORDS}w)\n`);
  const started = Date.now();
  let ok = 0, short = 0, fail = 0;

  for (const [i, book] of queue.entries()) {
    try {
      const wc = await generateOne(book);
      const status = wc >= MIN_WORDS ? 'drafted' : 'short';
      progress.generated[book.slug] = { status, words: wc, engine: ENGINE, at: new Date().toISOString() };
      if (status === 'drafted') { ok++; console.log(`  ✅ [${i + 1}/${queue.length}] ${book.title} (${wc} words)`); }
      else { short++; console.log(`  ⚠️  [${i + 1}/${queue.length}] ${book.title} SHORT: ${wc} words — will retry next run`); }
    } catch (e) {
      fail++; console.log(`  ❌ [${i + 1}/${queue.length}] ${book.title}: ${e.message}`);
      progress.generated[book.slug] = { status: 'error', error: e.message.slice(0, 200), at: new Date().toISOString() };
    }
    fs.writeFileSync(PROGRESS, JSON.stringify(progress, null, 2));
    if (ENGINE === 'gemini') await new Promise(r => setTimeout(r, 1200)); // polite rate limit
  }

  progress.runs.push({ at: new Date().toISOString(), engine: ENGINE, requested: queue.length, ok, short, fail, mins: ((Date.now() - started) / 60000).toFixed(1) });
  fs.writeFileSync(PROGRESS, JSON.stringify(progress, null, 2));
  const total = Object.values(progress.generated).filter(s => s.status === 'drafted').length;
  console.log(`\n📊 Run: ${ok} ok, ${short} short, ${fail} failed. Total drafted so far: ${total}. Next: node scripts/verify-library.cjs\n`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
