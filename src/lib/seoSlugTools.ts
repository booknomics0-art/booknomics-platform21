// SEO slug + long-tail keyword generation for Booknomics.
// Pure functions — safe to run in browser (admin UI) and node (sitemap script).

// ITRANS-ish Devanagari transliteration for common Hindi book/author words.
// Not phonetically perfect, but produces clean ASCII slugs (madhushala, harivansh, dinkar).
const DEVA_MAP: Record<string, string> = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u",
  "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
  "ं": "n", "ः": "h", "ँ": "n", "ऽ": "",
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v",
  "श": "sh", "ष": "sh", "स": "s", "ह": "h",
  "ळ": "l", "क्ष": "ksh", "त्र": "tr", "ज्ञ": "gy",
  // vowel signs (matras)
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u",
  "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
  "्": "", // virama — suppress inherent 'a'
  // nukta letters
  "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f",
  // digits
  "०":"0","१":"1","२":"2","३":"3","४":"4","५":"5","६":"6","७":"7","८":"8","९":"9",
};

// Devanagari consonants carry an inherent "a" unless followed by a matra or a
// virama. Without this rule मधुशाला transliterated to "mdhushala" instead of
// "madhushala", so slugs lost their vowels and stopped matching real titles.
const DEVA_CONSONANTS = new Set([
  "क","ख","ग","घ","ङ","च","छ","ज","झ","ञ","ट","ठ","ड","ढ","ण",
  "त","थ","द","ध","न","प","फ","ब","भ","म","य","र","ल","व",
  "श","ष","स","ह","ळ","क़","ख़","ग़","ज़","ड़","ढ़","फ़",
]);
// Characters that suppress the inherent "a" when they follow a consonant.
const DEVA_VOWEL_SIGNS = new Set([
  "ा","ि","ी","ु","ू","ृ","े","ै","ो","ौ","्",
]);

const isDevanagari = (ch: string | undefined) =>
  ch !== undefined && ch >= "\u0900" && ch <= "\u097F";

/** Transliterate a single Devanagari word, applying schwa-deletion rules. */
function transliterateWord(word: string): string {
  // A word-final conjunct still ends in a spoken "a": कुरुक्षेत्र → kurukshetra.
  // Mark it before the conjunct shortcuts erase the virama that identifies it.
  const endsWithConjunct = /[\u0915-\u0939]\u094D[\u0915-\u0939]$/.test(word);
  // Conjuncts first (क्ष, त्र, ज्ञ) so the per-char pass sees clean input.
  const chars = [...word.replace(/क्ष/g, "ksh").replace(/त्र/g, "tr").replace(/ज्ञ/g, "gy")];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    // Anusvara before a consonant is closer to "n"/"m" than a standalone vowel;
    // DEVA_MAP already handles that, so just emit the mapping.
    out += DEVA_MAP[ch] !== undefined ? DEVA_MAP[ch] : ch;

    if (!DEVA_CONSONANTS.has(ch)) continue;

    const next = chars[i + 1];
    // A matra or virama supplies the vowel itself.
    if (next !== undefined && DEVA_VOWEL_SIGNS.has(next)) continue;

    // Anusvara/visarga add a nasal or aspirate but the inherent "a" still
    // sounds before them: पंचतंत्र → panchatantra, not pnchatntr.
    if (next === "ं" || next === "ँ" || next === "ः") {
      out += "a";
      continue;
    }

    // Word-final schwa is silent in modern Hindi: गोदान → godan, not godana.
    // Keep it for single-consonant output so "न" does not collapse to "n".
    const isFinal = next === undefined || !isDevanagari(next);
    if (isFinal && out.length > 1) continue;

    out += "a";
  }
  return endsWithConjunct ? out + "a" : out;
}

export function transliterateDevanagari(input: string): string {
  if (!input) return "";
  // Split on non-Devanagari runs so schwa-deletion applies per word while
  // spaces, ASCII and punctuation pass through untouched.
  return input.replace(/[\u0900-\u097F]+/g, (word) => transliterateWord(word));
}

/** Kebab-case ASCII slug from any (English + Devanagari mixed) string. */
export function toKebab(input: string): string {
  if (!input) return "";
  const trans = transliterateDevanagari(input);
  return trans
    .toLowerCase()
    .replace(/[''`"]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const STOP = new Set(["a","an","the","of","in","on","by","to","for","and","or","with","from","is","it"]);

function condense(base: string, maxLen: number): string {
  const parts = base.split("-").filter(Boolean);
  // Drop stop words only if it helps stay under budget.
  let out = parts.join("-");
  if (out.length <= maxLen) return out;
  const filtered = parts.filter((p) => !STOP.has(p));
  out = filtered.join("-");
  if (out.length <= maxLen) return out;
  // Hard truncate at word boundary.
  const acc: string[] = [];
  let len = 0;
  for (const p of filtered) {
    if (len + p.length + (acc.length ? 1 : 0) > maxLen) break;
    acc.push(p);
    len += p.length + (acc.length > 1 ? 1 : 0);
  }
  return acc.join("-");
}

export type BookLike = {
  title?: string | null;
  author?: string | null;
  category?: string | null;
  language?: string | null; // "en" | "hi"
  slug?: string | null;
};

/**
 * Generate a long-tail keyword URL slug for a book.
 * - English: {title}-summary-key-lessons
 * - Hindi (classic literature): {title}-{author}-saransh
 * - Hindi (self-help / other): {title}-summary-in-hindi
 */
export function generateSeoSlug(book: BookLike): string {
  const isHi = (book.language ?? "en").toLowerCase() === "hi";
  const title = toKebab(book.title ?? "");
  if (!title) return "";
  const author = toKebab(book.author ?? "");
  const cat = (book.category ?? "").toLowerCase();

  const MAX = 70;
  if (isHi) {
    // Category names are stored in either script, so match both. Without the
    // Devanagari entries a book filed under "साहित्य" fell through to the
    // generic "-summary-in-hindi" pattern instead of the "-saransh" one.
    const classicCategories = [
      "classic", "literature", "poetry", "fiction", "hindi", "religion", "philosophy",
      "साहित्य", "कविता", "काव्य", "उपन्यास", "कहानी", "नाटक", "धर्म", "दर्शन", "अध्यात्म",
    ];
    const isClassic = classicCategories.some((c) => cat.includes(c));
    if (isClassic && author) {
      const budget = MAX - "-saransh".length;
      const authorKeep = condense(author, Math.max(12, Math.floor(budget * 0.4)));
      const titleKeep = condense(title, budget - authorKeep.length - 1);
      return `${titleKeep}-${authorKeep}-saransh`.slice(0, MAX);
    }
    const budget = MAX - "-summary-in-hindi".length;
    return `${condense(title, budget)}-summary-in-hindi`.slice(0, MAX);
  }
  const budget = MAX - "-summary-key-lessons".length;
  return `${condense(title, budget)}-summary-key-lessons`.slice(0, MAX);
}

const MAX_TITLE = 60;
const MAX_DESC = 155;

export function generateSeoTitle(book: BookLike): string {
  const isHi = (book.language ?? "en").toLowerCase() === "hi";
  const title = (book.title ?? "").trim();
  if (!title) return "";
  const template = isHi
    ? `${title} Summary in Hindi — Key Lessons & Saransh | Booknomics`
    : `${title} Summary: Themes, Analysis & Key Lessons | Booknomics`;
  if (template.length <= MAX_TITLE) return template;
  // Fallback: shorter form
  const short = isHi
    ? `${title} Summary in Hindi | Booknomics`
    : `${title} Summary & Key Lessons | Booknomics`;
  return short.length <= MAX_TITLE ? short : short.slice(0, MAX_TITLE - 1) + "…";
}

export function generateSeoDescription(book: BookLike): string {
  const title = (book.title ?? "").trim();
  const author = (book.author ?? "").trim();
  const isHi = (book.language ?? "en").toLowerCase() === "hi";
  if (!title) return "";
  const desc = isHi
    ? `${title}${author ? ` (${author})` : ""} ka complete summary in Hindi — key lessons, chapter-wise saransh aur 7-day action plan. Free padhein Booknomics par.`
    : `${title}${author ? ` by ${author}` : ""} — complete summary with key lessons, chapter-wise breakdown and a 7-day action plan. Read free on Booknomics.`;
  return desc.length <= MAX_DESC ? desc : desc.slice(0, MAX_DESC - 1) + "…";
}

const MODIFIERS_EN = [
  "summary", "key lessons", "chapter wise summary", "explained in simple english",
  "for students", "themes and analysis", "book review", "quotes and takeaways",
];
const MODIFIERS_HI = [
  "summary in hindi", "saransh", "hindi mein", "key lessons in hindi",
  "kya sikhati hai", "moral of the story", "chapter wise summary in hindi", "book summary pdf online",
];

export function suggestLongTailKeywords(book: BookLike): string[] {
  const isHi = (book.language ?? "en").toLowerCase() === "hi";
  const title = (book.title ?? "").trim();
  const author = (book.author ?? "").trim();
  if (!title) return [];
  const mods = isHi ? MODIFIERS_HI : MODIFIERS_EN;
  const t = title.toLowerCase();
  const out = new Set<string>();
  for (const m of mods) out.add(`${t} ${m}`);
  if (author) {
    out.add(`${t} by ${author.toLowerCase()} summary`);
    if (isHi) out.add(`${t} ${author.toLowerCase()} saransh`);
  }
  return Array.from(out).slice(0, 8);
}

export type SlugAudit = { ok: boolean; score: number; issues: string[] };

/** Flags broken auto-generated slugs like "-etkl", "--apt8", etc. */
export function auditSeoSlug(slug: string | null | undefined, book?: BookLike): SlugAudit {
  const issues: string[] = [];
  let score = 100;
  if (!slug) return { ok: false, score: 0, issues: ["Missing slug"] };
  if (slug.length < 4) { issues.push("Too short"); score -= 40; }
  if (slug.length > 70) { issues.push(`Too long (${slug.length} chars)`); score -= 15; }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) { issues.push("Invalid characters or leading/trailing hyphen"); score -= 25; }
  if (slug.includes("--")) { issues.push("Double hyphens"); score -= 15; }
  // "Garbage" pattern: only 1-2 letters between hyphens and looks like a random suffix.
  // Detect: fewer than 3 alphabetic characters before the first hyphen, or slugs that are mostly short tokens.
  const parts = slug.split("-").filter(Boolean);
  const shortTokens = parts.filter((p) => p.length <= 4 && !/^\d+$/.test(p));
  if (parts.length <= 2 && parts.every((p) => p.length <= 5)) {
    issues.push("Looks like a garbage auto-suffix (e.g. '-etkl')");
    score -= 40;
  }
  if (parts.length && parts[0].length <= 1) { issues.push("Starts with single-letter token"); score -= 20; }
  // Missing keyword modifier
  const hasKw = /summary|hindi|saransh|lessons|analysis|themes|kahani/.test(slug);
  if (!hasKw) { issues.push("Missing SEO keyword modifier (summary/hindi/saransh/lessons)"); score -= 15; }
  // Book-aware: does slug contain any word from the title?
  if (book?.title) {
    const titleKebab = toKebab(book.title);
    const firstWord = titleKebab.split("-")[0];
    if (firstWord && firstWord.length >= 3 && !slug.includes(firstWord)) {
      issues.push("Doesn't contain any word from the book title");
      score -= 25;
    }
  }
  score = Math.max(0, score);
  return { ok: score >= 60 && issues.length === 0, score, issues };
}
