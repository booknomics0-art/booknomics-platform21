import { transliterateDevanagari } from "./seoSlugTools";

// Parses structured bulk book content into draft book records.
// Supports core narrative tags PLUS learning-asset tags:
//   #AUDIO_URL, #MINDMAP_URL, #QUIZ_JSON, #FLASHCARDS_JSON
//
// Format:
// #BOOK_START
// Title: ...
// Author: ...
// Language: English | Hindi
// Category: ...
// #HOOK ... #SUMMARY ... #KEY_INSIGHTS ... #APPLY_TODAY ...
// #REFLECTION ... #ACTION_SYSTEM ... #AUDIO_SCRIPT
// #AUDIO_URL <https://...>
// #MINDMAP_URL <https://...>
// #QUIZ_JSON [{...}]
// #FLASHCARDS_JSON [{...}]
// #BOOK_END

export type ParsedBook = {
  title: string;
  author: string;
  language: string;
  category: string;
  slug: string;
  tagline: string | null;
  overview: string | null;
  key_ideas: string | null;
  daily_application: string | null;
  reflection_questions: string | null;
  action_system: string | null;
  deep_analysis: string | null;
  cover_color: string;
  // Learning assets (stored later in book_assets table)
  audio_url: string | null;
  mindmap_url: string | null;
  quiz_data: any[] | null;
  flashcard_data: any[] | null;
  // Validation
  asset_status: "complete" | "partial" | "missing";
  missing_assets: string[];
};

// Devanagari titles must survive slugification. The old regex stripped every
// non-ASCII character, so "चित्रा" collapsed to "" and the record ended up with
// a garbage slug like "-kwqk" — which generate-sitemap.ts then drops entirely
// (auditSeoSlug scores it 0), making the book invisible to search engines.
// Transliterating first keeps ASCII-only titles byte-identical to the previous
// behaviour while giving Hindi books a real slug.
const slugify = (s: string) => {
  const base = transliterateDevanagari(s)
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, "");
  return base || "book";
};

const normalizeLang = (l: string) => {
  const v = l.trim().toLowerCase();
  if (v.startsWith("hi") || v.includes("हिन्दी") || v.includes("हिंदी")) return "hi";
  return "en";
};

const SECTION_TAGS = [
  "HOOK", "SUMMARY", "KEY_INSIGHTS", "APPLY_TODAY", "REFLECTION",
  "ACTION_SYSTEM", "AUDIO_SCRIPT",
  "AUDIO_URL", "MINDMAP_URL", "QUIZ_JSON", "FLASHCARDS_JSON",
];

function extractSections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const tagRegex = new RegExp(`^#(${SECTION_TAGS.join("|")})\\s*$`, "gmi");
  const matches: { tag: string; index: number; len: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(body)) !== null) {
    matches.push({ tag: m[1].toUpperCase(), index: m.index, len: m[0].length });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].len;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    out[matches[i].tag] = body.slice(start, end).trim();
  }
  return out;
}

function parseHeader(headerBlock: string) {
  const fields: Record<string, string> = {};
  for (const line of headerBlock.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z]+)\s*:\s*(.+)$/);
    if (m) fields[m[1].toLowerCase()] = m[2].trim();
  }
  return fields;
}

function safeJson<T = any>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v as T;
  } catch {
    return null;
  }
}

export function parseBulkBooks(raw: string): { books: ParsedBook[]; errors: string[] } {
  const errors: string[] = [];
  const books: ParsedBook[] = [];

  const blockRegex = /#BOOK_START\s*([\s\S]*?)#BOOK_END/gi;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = blockRegex.exec(raw)) !== null) {
    idx++;
    const block = match[1];
    const firstTagIdx = block.search(/^#[A-Z_]+/m);
    const headerPart = firstTagIdx === -1 ? block : block.slice(0, firstTagIdx);
    const bodyPart = firstTagIdx === -1 ? "" : block.slice(firstTagIdx);

    const header = parseHeader(headerPart);
    const sections = extractSections(bodyPart);

    if (!header.title || !header.author) {
      errors.push(`Book #${idx}: missing Title or Author`);
      continue;
    }

    const audio_url = sections.AUDIO_URL?.trim() || null;
    const mindmap_url = sections.MINDMAP_URL?.trim() || null;
    const quiz_data = safeJson<any[]>(sections.QUIZ_JSON);
    const flashcard_data = safeJson<any[]>(sections.FLASHCARDS_JSON);

    if (sections.QUIZ_JSON && !quiz_data) errors.push(`Book #${idx} (${header.title}): QUIZ_JSON is not valid JSON`);
    if (sections.FLASHCARDS_JSON && !flashcard_data) errors.push(`Book #${idx} (${header.title}): FLASHCARDS_JSON is not valid JSON`);

    const missing_assets: string[] = [];
    if (!audio_url) missing_assets.push("audio");
    if (!mindmap_url) missing_assets.push("mindmap");
    if (!quiz_data || quiz_data.length === 0) missing_assets.push("quiz");
    if (!flashcard_data || flashcard_data.length === 0) missing_assets.push("flashcards");

    const asset_status: ParsedBook["asset_status"] =
      missing_assets.length === 0 ? "complete" :
      missing_assets.length === 4 ? "missing" : "partial";

    books.push({
      title: header.title,
      author: header.author,
      language: normalizeLang(header.language || "English"),
      category: header.category || "General",
      slug: slugify(header.title) + "-" + Math.random().toString(36).slice(2, 6),
      tagline: sections.HOOK || null,
      overview: sections.SUMMARY || null,
      key_ideas: sections.KEY_INSIGHTS || null,
      daily_application: sections.APPLY_TODAY || null,
      reflection_questions: sections.REFLECTION || null,
      action_system: sections.ACTION_SYSTEM || null,
      deep_analysis: sections.AUDIO_SCRIPT || null,
      cover_color: "amber",
      audio_url,
      mindmap_url,
      quiz_data,
      flashcard_data,
      asset_status,
      missing_assets,
    });
  }

  if (books.length === 0 && errors.length === 0) {
    errors.push("No #BOOK_START ... #BOOK_END blocks found");
  }

  return { books, errors };
}
