import pilotRows from "@/content/gscSeoPilot.json";

type BookIdentity = {
  title: string;
  author?: string | null;
  language?: string | null;
  status?: string | null;
};

export type GscSeoPilot = {
  slug: string;
  bookTitle: string;
  author: string;
  language: string;
  query: string;
  title?: string;
  description: string;
  h1: string;
  intro: string;
};

const pilotBySlug = new Map(
  (pilotRows as GscSeoPilot[]).map((entry) => [entry.slug, entry]),
);

const normalize = (value: string | null | undefined) => (value || "")
  .normalize("NFC")
  .toLocaleLowerCase()
  .replace(/\s+/g, " ")
  .trim();

/**
 * GSC 2026-10-23: a small, reversible content experiment on confirmed books.
 * Do not change a noindex page, a different edition, or a reused URL with
 * inconsistent author/title data. The original DB metadata wins otherwise.
 */
export function getGscSeoPilot(slug: string, book: BookIdentity): GscSeoPilot | null {
  const pilot = pilotBySlug.get(slug);
  if (!pilot || book.status === "published_noindex") return null;
  if (normalize(book.title) !== normalize(pilot.bookTitle)) return null;
  if (normalize(book.author) !== normalize(pilot.author)) return null;
  if (book.language !== pilot.language) return null;
  return pilot;
}
