#!/usr/bin/env node
/**
 * Book factory: writes 3,200+ word book summaries with an LLM, section by section,
 * checks word count and quality, repairs what fails, and stores only books that pass.
 *
 *   node scripts/bookfactory/generate.cjs --limit 50 --concurrency 4
 *   node scripts/bookfactory/generate.cjs --genre Finance --limit 10
 *   node scripts/bookfactory/generate.cjs --expand-catalog 100 --genre History   (ask the LLM for more titles)
 *   node scripts/bookfactory/generate.cjs --lang hi --limit 5                      (Hindi, Devanagari)
 *
 * Env: LLM_PROVIDER = gemini | anthropic | openai | mock   (default gemini)
 *      LLM_MODEL     model id (see README for suggested defaults)
 *      GEMINI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY
 *      LLM_BASE_URL  optional override (proxy / testing)
 *
 * Resumable: results are tracked in <out>/_state.json. Re-running skips finished books.
 * Nothing is sent to Supabase from here. Use upload.cjs after reviewing.
 */
const fs = require('fs');
const path = require('path');
const lib = require('./lib.cjs');
const { complete } = require('./providers.cjs');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const flag = (n) => args.includes(n);

const ROOT = path.join(__dirname, '..', '..');
const LANG = opt('--lang', 'en');
const OUT = path.resolve(opt('--out', path.join(ROOT, 'content-drafts', LANG === 'hi' ? 'hi-long' : 'en')));
const CATALOG = path.resolve(opt('--catalog', path.join(__dirname, 'catalog.csv')));
const LIMIT = Number(opt('--limit', '10'));
const CONC = Number(opt('--concurrency', '3'));
const GENRE = opt('--genre');
const MAX_REPAIR_ROUNDS = 3;
const GENRES = JSON.parse(fs.readFileSync(path.join(__dirname, 'genres.json'), 'utf8'));
const STATE_FILE = path.join(OUT, '_state.json');

// ---- tiny CSV (supports quoted fields) --------------------------------------
function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out;
}
const csvField = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
function readCatalog() {
  const [head, ...rows] = fs.readFileSync(CATALOG, 'utf8').split(/\r?\n/).filter(Boolean);
  const cols = parseCsvLine(head);
  return rows.map((r) => Object.fromEntries(parseCsvLine(r).map((v, i) => [cols[i], v.trim()])));
}

// ---- state --------------------------------------------------------------------
fs.mkdirSync(path.join(OUT, '_rejected'), { recursive: true });
fs.mkdirSync(path.join(OUT, '_reports'), { recursive: true });
let state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
const saveState = () => { fs.writeFileSync(STATE_FILE + '.tmp', JSON.stringify(state, null, 2)); fs.renameSync(STATE_FILE + '.tmp', STATE_FILE); };
const log = (slug, msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${slug}: ${msg}`);

// ---- prompts --------------------------------------------------------------------
const STYLE_RULES = `Style rules (strict):
- Write like a thoughtful human expert. Have opinions. Include honest criticism of the book.
- No em dashes at all. Use commas, periods, colons. No semicolon chains.
- Vary sentence length on purpose: some under six words, some over twenty-five.
- Avoid these phrases entirely: ${lib.AI_CLICHES.join(', ')}.
- Use concrete facts: years, names, numbers, places. Never invent quotes, statistics, studies or anecdotes. If you are not sure a detail is true, leave it out or say it is commonly reported.
- Do not mention being an AI. Do not use placeholders. Do not repeat the same idea in different words to fill space.
- Plain text with simple markdown only (### subheadings, **bold**, numbered lists). No tables, no HTML.`;

const SECTION_SPECS = (g) => ({
  HOOK: { target: 35, how: `A hook of 28 to 40 words, plain text. ${g.opening}` },
  SUMMARY: { target: 1450, how: `The main summary, about 1450 words, organised with ### subheadings. Shape: ${g.summary_shape}. Include publication year, the author's background and why the book was written.` },
  KEY_INSIGHTS: { target: 850, how: `12 to 14 numbered key insights, about 850 words in total, each 55 to 80 words. ${g.insights_style}` },
  APPLY_TODAY: { target: 150, how: 'A single paragraph of 130 to 170 words, addressed to the reader as "you", describing one concrete thing to do today, with a time and a finish line.' },
  REFLECTION: { target: 190, how: 'A numbered list of 8 to 9 reflection questions, about 190 words in total, specific to this book.' },
  ACTION_SYSTEM: { target: 470, how: `About 470 words. ${g.action_style} Use ### Day N or ### Week N subheadings.` },
  AUDIO_SCRIPT: { target: 1000, how: `A spoken-word deep analysis of about 1000 words meant to be read aloud. ${g.audio_style} No subheadings, no lists, natural paragraphs. Include one honest caution about the book.` },
});
const ORDER = ['HOOK', 'SUMMARY', 'KEY_INSIGHTS', 'APPLY_TODAY', 'REFLECTION', 'ACTION_SYSTEM', 'AUDIO_SCRIPT'];

const sysPrompt = (lang) => `You are a senior book analyst and editor writing for Booknomics, a reading platform. ${lang === 'hi' ? 'Write in natural, literate Hindi (Devanagari script). Numerals may be Devanagari or Latin. Do not transliterate into English letters.' : 'Write in clear, natural English.'}\n${STYLE_RULES}`;

function clean(text) {
  return String(text || '')
    .replace(/^```[a-z]*\n?|```$/gim, '')
    .replace(/^#{1,2}\s*(HOOK|SUMMARY|KEY_INSIGHTS|APPLY_TODAY|REFLECTION|ACTION_SYSTEM|AUDIO_SCRIPT)\s*$/gim, '')
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(/\u2013/g, '-')
    .trim();
}
function extractJson(text) {
  const t = String(text).replace(/^```[a-z]*\n?|```$/gim, '').trim();
  const start = t.search(/[\[{]/);
  const end = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
  return JSON.parse(t.slice(start, end + 1));
}

async function llm(prompt, meta, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await complete({ system: sysPrompt(LANG), user: prompt, meta, maxTokens: meta.maxTokens || 8000, temperature: meta.temperature ?? 0.8 }); }
    catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw lastErr;
}

// ---- pipeline steps -------------------------------------------------------------
async function makeFacts(b, g) {
  const p = `Book: "${b.title}" by ${b.author} (${b.year}). Genre: ${b.genre}.
Produce a JSON fact sheet used to keep the later writing accurate. Only include facts you are highly confident are true. JSON keys:
"first_published": string, "author_background": string, "central_thesis": string, "structure": [main parts or chapters or plot stages],
"key_ideas_or_events": [at least 10 items, each a precise sentence], "real_examples_or_studies": [named, dated items you are sure about],
"known_criticisms": [at least 3], "do_not_claim": [things people often get wrong about this book],
"slug_base": "latin-letters-kebab-case-title" , "meta_title": "30-62 chars ending with | Booknomics", "meta_description": "125-158 chars", "keywords": [6 search phrases],
"category": "short category label".
Return JSON only.`;
  const raw = await llm(p, { task: 'facts', book: b, maxTokens: 4000, temperature: 0.3 });
  return extractJson(raw);
}

async function writeSection(b, g, facts, tag, done) {
  const spec = SECTION_SPECS(g)[tag];
  const [min] = lib.PROSE_SECTIONS[tag];
  const context = ORDER.filter((t) => done[t]).map((t) => `#${t} (already written, do not repeat its points): ${done[t].slice(0, 300).replace(/\s+/g, ' ')}...`).join('\n');
  const p = `Write the ${tag} section for "${b.title}" by ${b.author} (${b.year}), genre ${b.genre}.
Fact sheet (ground truth, stay consistent, never contradict):
${JSON.stringify(facts)}
${context ? `\nOther sections so far:\n${context}\n` : ''}
Instruction: ${spec.how}
Length target: about ${spec.target} words. Err on the long side; the minimum is ${min} words and writers usually undershoot.
Return only the section text, no heading line.`;
  let text = clean(await llm(p, { task: 'section', section: tag, target: spec.target, book: b }));
  for (let i = 0; i < 4 && lib.wordCount(text) < min; i++) text = await expand(b, facts, tag, text, min);
  return text;
}

async function expand(b, facts, tag, text, min) {
  const have = lib.wordCount(text);
  const add = Math.ceil((min - have) * 1.4) + 60;
  const p = `Below is the ${tag} section for "${b.title}" by ${b.author}. It has ${have} words but must have at least ${min}.
Rewrite the WHOLE section, keeping everything good, and add roughly ${add} words of genuinely new substance: concrete detail from the fact sheet, examples, context, analysis or honest criticism. Do not repeat earlier points or pad with filler. Keep the same format.
Fact sheet: ${JSON.stringify(facts)}
Current section:
${text}
Return only the full rewritten section.`;
  const out = clean(await llm(p, { task: 'expand', section: tag, target: min + 80, book: b, current: text }));
  return lib.wordCount(out) > have ? out : text;
}

async function makeAssets(b, facts) {
  const p = `For "${b.title}" by ${b.author} create study assets from this fact sheet: ${JSON.stringify(facts)}
Return JSON: {"quiz":[5 items {"id":"q1","question":"...","options":[4 strings],"correct_option":0-3,"explanation":"..."}],"flashcards":[10 items {"id":"f1","front":"...","back":"..."}]}
Rules: questions must be answerable from the fact sheet, spread correct_option across different positions, no trick questions. JSON only.`;
  for (let i = 0; i < 3; i++) {
    try { const j = extractJson(await llm(p, { task: 'assets', book: b, maxTokens: 4000, temperature: 0.4 })); if (j.quiz && j.flashcards) return j; } catch { /* retry */ }
  }
  throw new Error('could not produce valid quiz/flashcards JSON');
}

function assemble(b, facts, sections, assets, slug) {
  const header = {
    title: b.title, author: b.author, language: LANG === 'hi' ? 'Hindi' : 'English', category: facts.category || b.genre,
    genre: b.genre, year: b.year, slug, keywords: (facts.keywords || []).join(', '), metatitle: facts.meta_title, metadescription: facts.meta_description,
  };
  return lib.buildBookFile(header, { ...sections, QUIZ_JSON: JSON.stringify(assets.quiz, null, 2), FLASHCARDS_JSON: JSON.stringify(assets.flashcards, null, 2) });
}

async function repair(b, facts, slug, sections, assets, v) {
  const fixes = {};
  for (const i of v.issues) {
    const m = i.msg.match(/^#(\w+) has (\d+) words, minimum (\d+)/);
    if (m) { fixes[m[1]] = ['short', Number(m[3])]; continue; }
    if (/^Total \d+ words/.test(i.msg)) {
      // Expand the section furthest below its target share.
      const worst = ORDER.filter((t) => t !== 'HOOK').sort((a, c) => lib.wordCount(sections[a]) / SECTION_SPECS(GENRES[b.genre])[a].target - lib.wordCount(sections[c]) / SECTION_SPECS(GENRES[b.genre])[c].target)[0];
      fixes[worst] = fixes[worst] || ['short', lib.wordCount(sections[worst]) + 250];
    }
    if (/cliche|em dashes|uniform|repetition|Duplicate|flat/i.test(i.msg)) fixes.SUMMARY = fixes.SUMMARY || ['style', i.msg];
  }
  for (const [tag, [kind, arg]] of Object.entries(fixes)) {
    if (kind === 'short') sections[tag] = await expand(b, facts, tag, sections[tag], arg);
    else {
      const p = `Rewrite this ${tag} section of a summary of "${b.title}" to fix this problem: ${arg}. Keep length and facts. ${STYLE_RULES}\n\n${sections[tag]}\n\nReturn only the rewritten section.`;
      const out = clean(await llm(p, { task: 'style', section: tag, current: sections[tag], book: b }));
      if (lib.wordCount(out) >= lib.wordCount(sections[tag]) * 0.95) sections[tag] = out;
    }
  }
  return sections;
}

async function review(b, facts, sections) {
  const prose = ORDER.map((t) => `#${t}\n${sections[t]}`).join('\n\n');
  const p = `You are a skeptical fact-checker and editor. Review this summary of "${b.title}" by ${b.author} (${b.year}) against the fact sheet and your own knowledge.
Fact sheet: ${JSON.stringify(facts)}
Text:
${prose.slice(0, 30000)}
Return JSON: {"score":0-100,"factual_risks":[{"claim":"exact text","why":"..."}],"generic_passages":["..."],"verdict":"accept|revise"}
Only list a factual risk if you think the claim is probably wrong or unverifiable. Be strict.`;
  try { return extractJson(await llm(p, { task: 'review', book: b, maxTokens: 3000, temperature: 0.2 })); }
  catch { return { score: 0, factual_risks: [{ claim: '(review failed)', why: 'reviewer returned invalid JSON' }], verdict: 'revise' }; }
}

async function processBook(b) {
  const g = GENRES[b.genre];
  if (!g) throw new Error(`Unknown genre "${b.genre}". Add it to genres.json.`);
  const facts = await makeFacts(b, g);
  const slug = LANG === 'hi'
    ? `${lib.kebab(facts.slug_base || b.title)}-${lib.kebab(b.author).split('-').slice(0, 2).join('-')}-saransh`.slice(0, 70)
    : lib.seoSlug(b.title);
  log(slug, 'facts ready');
  const sections = {};
  for (const tag of ORDER) { sections[tag] = await writeSection(b, g, facts, tag, sections); log(slug, `${tag} ${lib.wordCount(sections[tag])} words`); }
  const assets = await makeAssets(b, facts);

  let file = assemble(b, facts, sections, assets, slug);
  let v = lib.validate(file);
  for (let round = 1; round <= MAX_REPAIR_ROUNDS && !v.pass; round++) {
    log(slug, `repair round ${round}: ${v.words} words, score ${v.score}, ${v.issues.filter((i) => i.hard).length} hard issues`);
    await repair(b, facts, slug, sections, assets, v);
    file = assemble(b, facts, sections, assets, slug);
    v = lib.validate(file);
  }
  if (!v.pass) {
    fs.writeFileSync(path.join(OUT, '_rejected', `${slug}.txt`), file);
    state[slug] = { status: 'rejected', words: v.words, score: v.score, issues: v.issues.map((i) => i.msg), title: b.title };
    log(slug, `REJECTED (${v.words} words, score ${v.score})`);
    return;
  }
  const rv = await review(b, facts, sections);
  const needsReview = (rv.factual_risks || []).length > 0 || rv.score < 90;
  fs.writeFileSync(path.join(OUT, '_reports', `${slug}.review.json`), JSON.stringify({ facts, review: rv, validation: v }, null, 2));
  if (needsReview) {
    fs.writeFileSync(path.join(OUT, '_rejected', `${slug}.txt`), file);
    state[slug] = { status: 'needs_review', words: v.words, score: v.score, reviewScore: rv.score, risks: rv.factual_risks, title: b.title };
    log(slug, `NEEDS REVIEW (${(rv.factual_risks || []).length} factual risks, reviewer score ${rv.score})`);
  } else {
    fs.writeFileSync(path.join(OUT, `${slug}.txt`), file);
    state[slug] = { status: 'accepted', words: v.words, score: v.score, reviewScore: rv.score, title: b.title };
    log(slug, `ACCEPTED ${v.words} words, quality ${v.score}, reviewer ${rv.score}`);
  }
}

// ---- catalog expansion ------------------------------------------------------------
async function expandCatalog(n) {
  const rows = readCatalog();
  const have = new Set(rows.map((r) => r.title.toLowerCase()));
  const genre = GENRE || 'Self-Help';
  const p = `List ${n} widely read, well-regarded ${LANG === 'hi' ? 'Hindi' : 'English-language'} books in the genre "${genre}" that are NOT in this list: ${[...have].slice(0, 400).join('; ')}.
Only real books where you are certain of the exact title, author and first publication year. JSON array of {"title","author","year"}. JSON only.`;
  const items = extractJson(await llm(p, { task: 'catalog', genre, n, maxTokens: 8000, temperature: 0.5 }));
  const fresh = items.filter((i) => i.title && i.author && /^\d{3,4}$/.test(String(i.year)) && !have.has(i.title.toLowerCase()));
  fs.appendFileSync(CATALOG, fresh.map((i) => [i.title, i.author, i.year, genre, 'queued'].map(csvField).join(',')).join('\n') + '\n');
  console.log(`Added ${fresh.length} titles to ${CATALOG}. Review them: the model can be wrong about years.`);
}

// ---- main ---------------------------------------------------------------------------
(async () => {
  if (opt('--expand-catalog')) return expandCatalog(Number(opt('--expand-catalog')));
  const rows = readCatalog().filter((r) => r.status === 'queued' && (!GENRE || r.genre === GENRE));
  const todo = rows.filter((r) => { const s = state[lib.seoSlug(r.title)]; return !s || s.status === 'rejected'; }).slice(0, LIMIT);
  console.log(`Provider ${process.env.LLM_PROVIDER || 'gemini'}. ${todo.length} book(s) to write into ${OUT}`);
  let next = 0;
  async function worker() {
    while (next < todo.length) {
      const b = todo[next++];
      try { await processBook(b); } catch (e) { log(b.title, `ERROR ${e.message}`); state[lib.seoSlug(b.title)] = { status: 'error', error: e.message, title: b.title }; }
      saveState();
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, todo.length) }, worker));
  saveState();
  const counts = Object.values(state).reduce((a, s) => ({ ...a, [s.status]: (a[s.status] || 0) + 1 }), {});
  console.log('Totals:', counts);
  console.log('Next: node scripts/bookfactory/check.cjs', path.relative(ROOT, OUT), ' then upload.cjs');
})();
