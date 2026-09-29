/** Canonical URL slug for a book category label. Mirrors scripts/generate-sitemap.ts. */
export const slugifyCategory = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\/&]+/g, "-")
    .replace(/[^a-z0-9\u0900-\u097F]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
