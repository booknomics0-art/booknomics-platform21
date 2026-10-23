import { readFileSync } from "node:fs";

const source = new URL("../src/content/gscSeoPilot.json", import.meta.url);
export const pilotRows = JSON.parse(readFileSync(source, "utf8"));
const bySlug = new Map(pilotRows.map((entry) => [entry.slug, entry]));
const normalize = (value) => String(value || "")
  .normalize("NFC")
  .toLocaleLowerCase()
  .replace(/\s+/g, " ")
  .trim();

export function getGscSeoPilot(slug, book) {
  const pilot = bySlug.get(slug);
  if (!pilot || book.status === "published_noindex") return null;
  if (normalize(book.title) !== normalize(pilot.bookTitle)) return null;
  if (normalize(book.author) !== normalize(pilot.author)) return null;
  if (book.language !== pilot.language) return null;
  return pilot;
}
