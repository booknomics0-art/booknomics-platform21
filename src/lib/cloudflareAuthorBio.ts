/**
 * Cloudflare D1 editorial author biographies.
 * The existing same-origin /api/books/:slug Worker reads D1 books via SELECT *.
 * We only display rows explicitly approved by an editor. Unreviewed or mismatched
 * content must never replace a reviewed local profile or the honest fallback.
 */
export interface CloudflareAuthorBio {
  text: string;
  language: "hi" | "en";
  sources: string[];
}

export interface AuthorBioIdentity {
  bookId: string;
  slug: string;
  title: string;
  author: string;
}

// Earlier reviewed profiles are ~400 words; the next editorial cohorts are
// ~200 words. Keep both valid without rewriting already approved biographies.
const BIO_WORD_BANDS = [[180, 240], [350, 460]] as const;

export function parseCloudflareAuthorBio(payload: unknown, expected: AuthorBioIdentity): CloudflareAuthorBio | null {
  if (!payload || typeof payload !== "object" || !("data" in payload)) return null;
  const row = payload.data;
  if (!row || typeof row !== "object") return null;
  const book = row as Record<string, unknown>;

  if (book.id !== expected.bookId || book.slug !== expected.slug || book.title !== expected.title || book.author !== expected.author) {
    return null;
  }
  if (book.status !== "published" && book.status !== "published_noindex") return null;
  if (book.is_draft !== 0 && book.is_draft !== false) return null;
  if (book.author_bio_status !== "reviewed") return null;
  if (book.language !== "hi" && book.language !== "en") return null;
  if (typeof book.author_bio !== "string") return null;

  const text = book.author_bio.trim();
  const wordCount = text.split(/\s+/u).length;
  if (!BIO_WORD_BANDS.some(([min, max]) => wordCount >= min && wordCount <= max)) return null;
  if (!text.includes(expected.title) || !text.includes(expected.author)) return null;

  let sources: unknown = book.author_bio_sources;
  if (typeof sources === "string") {
    try { sources = JSON.parse(sources); } catch { return null; }
  }
  if (!Array.isArray(sources) || sources.length < 2 || sources.length > 12) return null;
  if (!sources.every((source) => typeof source === "string" && /^https:\/\/[^\s]+$/i.test(source))) return null;
  if (new Set(sources).size !== sources.length) return null;

  return { text, language: book.language, sources };
}

export async function fetchCloudflareAuthorBio(identity: AuthorBioIdentity, signal?: AbortSignal): Promise<CloudflareAuthorBio | null> {
  if (!identity.bookId || !identity.slug) return null;
  try {
    const response = await fetch(`/api/books/${encodeURIComponent(identity.slug)}`, {
      method: "GET",
      credentials: "omit",
      signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return parseCloudflareAuthorBio(await response.json(), identity);
  } catch {
    // A Cloudflare outage must not break the entire Mastery tab.
    return null;
  }
}
