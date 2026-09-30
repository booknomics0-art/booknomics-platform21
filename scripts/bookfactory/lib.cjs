/**
 * Booknomics book factory: shared parsing, word counting, validation, slugs.
 * Pure Node, no dependencies. Used by check / generate / upload scripts.
 *
 * File format is the app's own bulk-upload format (src/lib/bookParser.ts), so a
 * file can also be pasted into Admin > Bulk Upload. Extra header fields (Year,
 * Genre, Slug, Keywords, MetaTitle, MetaDescription) are ignored by that parser.
 */
const fs = require('fs');
const path = require('path');

// Section -> [min words, max words]. Minimums sum to 3,300 so a book that meets
// every minimum also clears the 3,200 total with margin. JSON sections are not
// counted as words (conservative: only real reading text counts).
const PROSE_SECTIONS = {
  HOOK: [20, 60],
  SUMMARY: [1150, 1700],
  KEY_INSIGHTS: [650, 1000],
  APPLY_TODAY: [110, 220],
  REFLECTION: [140, 300],
  ACTION_SYSTEM: [380, 650],
  AUDIO_SCRIPT: [850, 1300],
};
const MIN_TOTAL_WORDS = 3200;
const PASS_SCORE = 98;

const AI_CLICHES = [
  "in today's fast-paced world", 'in conclusion', 'delve into', 'it is important to note',
  'navigate the complexities', 'ever-evolving', 'in the realm of', 'embark on a journey',
  'at the end of the day', 'tapestry', 'harness the power', 'game-changer', 'unlock the secrets',
  'it is worth noting', 'in a nutshell', 'testament to', 'rich tapestry', 'paradigm shift',
];
const PLACEHOLDERS = /\b(lorem ipsum|TODO|TBD|\[insert|\[your|placeholder|xxx+)\b/i;

const GENRE_COVER = {
  'Self-Help': 'amber', 'Business': 'navy', 'Psychology': 'plum', 'Philosophy': 'forest',
  'Classic Literature': 'burgundy', 'Memoir': 'slate', 'Finance': 'emerald', 'History': 'rust',
  'Dystopian Fiction': 'obsidian', 'Literary Fiction': 'indigo', 'Science': 'indigo',
  'Biography': 'stone', 'Economics': 'emerald', 'Politics': 'sand', 'Spirituality': 'gold',
};

function wordCount(text) {
  const m = (text || '').match(/[A-Za-z0-9\u0900-\u097F][A-Za-z0-9\u0900-\u097F'\u2019\-]*/g);
  return m ? m.length : 0;
}

function sentences(text) {
  return (text || '')
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?\u0964])["')\]]*\s+/)
    .map((s) => s.trim())
    .filter((s) => wordCount(s) > 0);
}

function kebab(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['\u2019`"]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const STOP = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'by', 'to', 'for', 'and', 'or', 'with', 'from', 'is', 'it']);

/** Same rule as generateSeoSlug() in src/lib/seoSlugTools.ts for English books. */
function seoSlug(title) {
  const MAX = 70;
  const suffix = '-summary-key-lessons';
  const budget = MAX - suffix.length;
  const parts = kebab(title).split('-').filter(Boolean);
  let out = parts.join('-');
  if (out.length > budget) {
    out = parts.filter((p) => !STOP.has(p)).join('-');
    const acc = [];
    let len = 0;
    for (const p of out.split('-')) {
      if (len + p.length + (acc.length ? 1 : 0) > budget) break;
      acc.push(p);
      len += p.length + (acc.length > 1 ? 1 : 0);
    }
    out = acc.join('-');
  }
  return out + suffix;
}

/** Mirrors auditSeoSlug() scoring for the cases that matter here. */
function slugScore(slug, title) {
  let score = 100;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) || slug.includes('--')) score -= 25;
  if (slug.length > 70) score -= 15;
  if (!/summary|lessons|analysis|themes/.test(slug)) score -= 15;
  const first = kebab(title).split('-')[0];
  if (first && first.length >= 3 && !slug.includes(first)) score -= 25;
  return score;
}

const SECTION_TAGS = [
  'HOOK', 'SUMMARY', 'KEY_INSIGHTS', 'APPLY_TODAY', 'REFLECTION', 'ACTION_SYSTEM',
  'AUDIO_SCRIPT', 'AUDIO_URL', 'MINDMAP_URL', 'QUIZ_JSON', 'FLASHCARDS_JSON',
];

/** Parse one #BOOK_START..#BOOK_END block (same tag rules as the app parser). */
function parseBookFile(raw) {
  const m = raw.match(/#BOOK_START\s*([\s\S]*?)#BOOK_END/i);
  if (!m) return { error: 'No #BOOK_START ... #BOOK_END block' };
  const block = m[1];
  const firstTag = block.search(/^#[A-Z_]+/m);
  const headerPart = firstTag === -1 ? block : block.slice(0, firstTag);
  const bodyPart = firstTag === -1 ? '' : block.slice(firstTag);
  const header = {};
  for (const line of headerPart.split(/\r?\n/)) {
    const h = line.match(/^([A-Za-z]+)\s*:\s*(.+)$/);
    if (h) header[h[1].toLowerCase()] = h[2].trim();
  }
  const sections = {};
  const re = new RegExp(`^#(${SECTION_TAGS.join('|')})\\s*$`, 'gmi');
  const hits = [];
  let t;
  while ((t = re.exec(bodyPart)) !== null) hits.push({ tag: t[1].toUpperCase(), index: t.index, len: t[0].length });
  hits.forEach((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].index : bodyPart.length;
    sections[h.tag] = bodyPart.slice(h.index + h.len, end).trim();
  });
  return { header, sections };
}

function buildBookFile(header, sections) {
  const order = ['Title', 'Author', 'Language', 'Category', 'Genre', 'Year', 'Slug', 'Keywords', 'MetaTitle', 'MetaDescription'];
  const lines = ['#BOOK_START'];
  for (const k of order) if (header[k.toLowerCase()] != null && header[k.toLowerCase()] !== '') lines.push(`${k}: ${header[k.toLowerCase()]}`);
  for (const tag of ['HOOK', 'SUMMARY', 'KEY_INSIGHTS', 'APPLY_TODAY', 'REFLECTION', 'ACTION_SYSTEM', 'AUDIO_SCRIPT', 'QUIZ_JSON', 'FLASHCARDS_JSON']) {
    if (sections[tag] != null) lines.push('', `#${tag}`, String(sections[tag]).trim());
  }
  lines.push('', '#BOOK_END', '');
  return lines.join('\n');
}

function stdev(a) {
  if (!a.length) return 0;
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  return Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / a.length);
}

/**
 * Deterministic quality gate. Returns { score, pass, words, sectionWords, issues[] }.
 * `hard` issues cap the score below PASS_SCORE so a short book can never pass.
 */
function validate(raw) {
  const issues = [];
  const parsed = parseBookFile(raw);
  if (parsed.error) return { score: 0, pass: false, words: 0, sectionWords: {}, issues: [{ hard: true, msg: parsed.error }] };
  const { header, sections } = parsed;
  let score = 100;
  const hard = (msg) => { issues.push({ hard: true, msg }); };
  const soft = (msg, cost) => { issues.push({ hard: false, msg, cost }); score -= cost; };

  for (const k of ['title', 'author', 'language', 'category', 'genre', 'year', 'slug', 'metatitle', 'metadescription', 'keywords']) {
    if (!header[k]) hard(`Missing header: ${k}`);
  }

  const sectionWords = {};
  let total = 0;
  const prose = [];
  for (const [tag, [min, max]] of Object.entries(PROSE_SECTIONS)) {
    const txt = sections[tag];
    if (!txt) { hard(`Missing section #${tag}`); continue; }
    const w = wordCount(txt);
    sectionWords[tag] = w;
    total += w;
    prose.push(txt);
    if (w < min) hard(`#${tag} has ${w} words, minimum ${min}`);
    if (w > max * 1.25) soft(`#${tag} has ${w} words, well above ${max}`, 2);
  }
  if (total < MIN_TOTAL_WORDS) hard(`Total ${total} words, need at least ${MIN_TOTAL_WORDS}`);

  // JSON assets
  let quiz, cards;
  try { quiz = JSON.parse(sections.QUIZ_JSON || ''); } catch { quiz = null; }
  try { cards = JSON.parse(sections.FLASHCARDS_JSON || ''); } catch { cards = null; }
  if (!Array.isArray(quiz) || quiz.length < 5) hard('QUIZ_JSON must be a valid array of 5+ questions');
  else quiz.forEach((q, i) => {
    if (!q.id || !q.question || !Array.isArray(q.options) || q.options.length !== 4 || !Number.isInteger(q.correct_option) || q.correct_option < 0 || q.correct_option > 3 || !q.explanation) hard(`Quiz question ${i + 1} malformed (needs id, question, 4 options, correct_option 0-3, explanation)`);
  });
  if (Array.isArray(quiz)) {
    const dist = [0, 0, 0, 0];
    quiz.forEach((q) => { if (Number.isInteger(q.correct_option)) dist[q.correct_option]++; });
    if (quiz.length >= 5 && Math.max(...dist) > Math.ceil(quiz.length * 0.6)) soft('Quiz answers are clustered on one option position', 2);
  }
  if (!Array.isArray(cards) || cards.length < 10) hard('FLASHCARDS_JSON must be a valid array of 10+ cards');
  else cards.forEach((c, i) => { if (!c.id || !c.front || !c.back) hard(`Flashcard ${i + 1} malformed (needs id, front, back)`); });

  // Metadata
  if (header.metatitle && (header.metatitle.length < 30 || header.metatitle.length > 65)) soft(`MetaTitle length ${header.metatitle.length} (want 30-65)`, 2);
  if (header.metadescription && (header.metadescription.length < 120 || header.metadescription.length > 160)) soft(`MetaDescription length ${header.metadescription.length} (want 120-160)`, 2);
  if (header.slug) {
    const s = slugScore(header.slug, header.title || '');
    if (s < 100) soft(`Slug scores ${s}/100`, 3);
  }
  if (header.language && !/^en/i.test(header.language) && !/^hi/i.test(header.language)) soft('Language should be English or Hindi', 2);
  if (header.year && !/^-?\d{3,4}$/.test(header.year)) soft('Year should be a number', 1);

  // Text quality
  const isHi = /^hi/i.test(header.language || '');
  const all = prose.join('\n\n');
  const lower = all.toLowerCase();
  const dashes = (all.match(/\u2014/g) || []).length;
  if (dashes > 5) soft(`${dashes} em dashes (limit 5, a common AI tell)`, Math.min(10, dashes - 5));
  if (!isHi) for (const c of AI_CLICHES) if (lower.includes(c)) soft(`AI cliche: "${c}"`, 3);
  if (PLACEHOLDERS.test(all)) hard('Placeholder text found');
  if (/\*\*|^\s*[-*] /m.test(sections.HOOK || '')) soft('HOOK should be plain text', 1);

  const sents = sentences(all);
  const lens = sents.map(wordCount);
  const avg = lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length);
  const sd = stdev(lens);
  if (sd < 6) soft(`Sentence length too uniform (stdev ${sd.toFixed(1)}, want >= 6)`, 4);
  if (avg > 26 || avg < 9) soft(`Average sentence length ${avg.toFixed(1)} words (want 9-26)`, 3);
  const short = lens.filter((l) => l <= 6).length / Math.max(1, lens.length);
  if (short < 0.05) soft('Almost no short sentences; rhythm will feel flat', 2);

  const words = (lower.match(/[\p{L}\p{M}\p{N}'\u2019]+/gu) || []);
  if (words.length > 400) {
    const grams = new Set();
    for (let i = 0; i + 4 <= words.length; i++) grams.add(words.slice(i, i + 4).join(' '));
    const distinct = grams.size / (words.length - 3);
    if (distinct < 0.93) soft(`High repetition (distinct 4-grams ${(distinct * 100).toFixed(0)}%, want >= 93%)`, 8);
  }
  const paras = all.split(/\n{2,}/).map((p) => p.trim()).filter((p) => wordCount(p) > 12);
  if (new Set(paras).size < paras.length) soft('Duplicate paragraphs', 10);
  const nums = (all.match(/\b(\d+)\b|[\u0966-\u096F]+/g) || []).length;
  if (nums < 12) soft(`Only ${nums} concrete numbers/years (want >= 12)`, 3);
  if (!isHi && !/\b(you|your)\b/i.test(sections.APPLY_TODAY || '')) soft('APPLY_TODAY should speak to the reader (you/your)', 2);

  score = Math.max(0, score);
  const hardFail = issues.some((i) => i.hard);
  if (hardFail) score = Math.min(score, PASS_SCORE - 1);
  return { score, pass: !hardFail && score >= PASS_SCORE, words: total, sectionWords, issues, avgSentence: +avg.toFixed(1) };
}

/** 7-word shingle overlap between books. Returns pairs above `threshold` (0-1). */
function similarity(files, threshold = 0.03) {
  const sets = files.map((f) => {
    const p = parseBookFile(fs.readFileSync(f, 'utf8'));
    const txt = p.sections ? Object.entries(p.sections).filter(([k]) => PROSE_SECTIONS[k]).map(([, v]) => v).join(' ') : '';
    const w = txt.toLowerCase().match(/[\p{L}\p{M}\p{N}'\u2019]+/gu) || [];
    const s = new Set();
    for (let i = 0; i + 7 <= w.length; i++) s.add(w.slice(i, i + 7).join(' '));
    return { f, s, open: w.slice(0, 10).join(' ') };
  });
  const out = [];
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
    let inter = 0;
    const [small, big] = sets[i].s.size < sets[j].s.size ? [sets[i].s, sets[j].s] : [sets[j].s, sets[i].s];
    for (const g of small) if (big.has(g)) inter++;
    const ratio = inter / Math.max(1, small.size);
    if (ratio > threshold) out.push({ a: path.basename(sets[i].f), b: path.basename(sets[j].f), overlap: +ratio.toFixed(3) });
    if (sets[i].open === sets[j].open && sets[i].open) out.push({ a: path.basename(sets[i].f), b: path.basename(sets[j].f), overlap: 1, note: 'identical opening' });
  }
  return out;
}

function listBookFiles(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.txt') && !f.startsWith('_')).sort().map((f) => path.join(dir, f));
}

module.exports = {
  PROSE_SECTIONS, MIN_TOTAL_WORDS, PASS_SCORE, AI_CLICHES, GENRE_COVER,
  wordCount, sentences, kebab, seoSlug, slugScore, parseBookFile, buildBookFile, validate, similarity, listBookFiles,
};
