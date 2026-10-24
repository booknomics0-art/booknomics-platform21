/** Book matching stays entirely in the browser; an approximate match is never auto-approved. */
export type AudioCatalogBook = {
  id: string;
  title: string;
  author: string;
  slug: string;
  seo_slug?: string | null;
  language: string;
  audio_url: string | null;
};

export type AudioSuggestion = { book: AudioCatalogBook; score: number };
export type AudioFileMatch = {
  bookId: string | null;
  reason: "exact" | "ambiguous" | "existing-audio" | "suggestion" | "none";
  suggestions: AudioSuggestion[];
};

const AUDIO_SUFFIXES = /(?:[\s_-]+(?:audiobook|audio[\s_-]*summary|podcast|audio|mp3|english|hindi|eng|हिंदी|हिन्दी))+(?:\s*\(\d+\))?$/iu;

export function normalizedAudioTitle(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\.mp3$/iu, "")
    .replace(/\s*\(\d+\)$/u, "")
    .replace(AUDIO_SUFFIXES, "")
    .replace(/[_-]+/gu, " ")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .toLocaleLowerCase("en")
    .trim()
    .replace(/\s+/gu, " ");
}

function languageHint(filename: string): "hi" | "en" | null {
  const stem = filename.replace(/\.mp3$/iu, "");
  if (/\p{Script=Devanagari}/u.test(stem) || /(?:^|[\s_-])(?:hindi|hi)(?:$|[\s_-])/iu.test(stem)) return "hi";
  if (/(?:^|[\s_-])(?:english|eng)(?:$|[\s_-])/iu.test(stem)) return "en";
  return null;
}

function langCode(language: string): "hi" | "en" | null {
  if (/^(hi|hindi)$/i.test(language)) return "hi";
  if (/^(en|english)$/i.test(language)) return "en";
  return null;
}

function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 4 || b.length < 4) return 0;
  const grams = (text: string) => {
    const characters = Array.from(text.replace(/\s/gu, ""));
    const output = new Map<string, number>();
    for (let i = 0; i + 1 < characters.length; i++) {
      const gram = characters[i] + characters[i + 1];
      output.set(gram, (output.get(gram) ?? 0) + 1);
    }
    return output;
  };
  const left = grams(a), right = grams(b);
  let overlap = 0;
  for (const [gram, n] of left) overlap += Math.min(n, right.get(gram) ?? 0);
  const leftCount = Array.from(left.values()).reduce((a, b) => a + b, 0);
  const rightCount = Array.from(right.values()).reduce((a, b) => a + b, 0);
  return (2 * overlap) / (leftCount + rightCount);
}

export function matchAudioFilename(filename: string, books: AudioCatalogBook[]): AudioFileMatch {
  const key = normalizedAudioTitle(filename);
  if (!key) return { bookId: null, reason: "none", suggestions: [] };
  const hint = languageHint(filename);
  const preferred = (book: AudioCatalogBook) => !hint || langCode(book.language) === hint;
  const exact = books.filter((book) => preferred(book) &&
    [book.title, book.slug, book.seo_slug ?? ""].some((title) => normalizedAudioTitle(title) === key));

  if (exact.length === 1) {
    const book = exact[0];
    return {
      bookId: book.audio_url ? null : book.id,
      reason: book.audio_url ? "existing-audio" : "exact",
      suggestions: [{ book, score: 1 }],
    };
  }
  if (exact.length > 1) {
    return { bookId: null, reason: "ambiguous", suggestions: exact.slice(0, 8).map((book) => ({ book, score: 1 })) };
  }

  const suggestions = books
    .filter(preferred)
    .map((book) => ({ book, score: Math.max(diceSimilarity(key, normalizedAudioTitle(book.title)), diceSimilarity(key, normalizedAudioTitle(book.slug))) }))
    .filter(({ score }) => score >= 0.52)
    .sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title))
    .slice(0, 5);

  return { bookId: null, reason: suggestions.length ? "suggestion" : "none", suggestions };
}
