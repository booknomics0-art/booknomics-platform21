// Single source of truth for book slug aliases → canonical slug.
// Used by:
//  - public/_redirects (hosting-level 301 redirects)
//  - src/pages/BookDetail.tsx client-side fallback (SPA navigations)
//
// Only map aliases to books that currently exist as public, indexable catalog
// records. Do not keep aliases that resolve to deleted, draft-only, or noindex
// records because that creates a 301 → dead/noindex crawl path and wastes link equity.
export const SLUG_REDIRECTS: Record<string, string> = {
  // Punctuation / spacing variants
  "cant-hurt-me": "can-t-hurt-me-david-goggins-summary",
  "can_t_hurt_me": "can-t-hurt-me-david-goggins-summary",
  "mans-search-for-meaning": "man-s-search-for-meaning-viktor-e-frankl-summary",
  "man-s-search-for-meaning": "man-s-search-for-meaning-viktor-e-frankl-summary",
  "mans-search-meaning": "man-s-search-for-meaning-viktor-e-frankl-summary",

  // Numbered / prefix variants
  "7-habits": "the-7-habits-of-highly-effective-people-stephen-r-covey-summary",
  "7-habits-of-highly-effective-people": "the-7-habits-of-highly-effective-people-stephen-r-covey-summary",
  "seven-habits": "the-7-habits-of-highly-effective-people-stephen-r-covey-summary",

  // External / legacy aliases → current canonical published records
  "the-intelligent-investor": "the-intelligent-investor-benjamin-graham-summary",
  "intelligent-investor": "the-intelligent-investor-benjamin-graham-summary",
  "the-mountain-is-you": "the-mountain-is-you-brianna-wiest-summary",
  "mountain-is-you": "the-mountain-is-you-brianna-wiest-summary",

  // Common typos / singulars
  "atomic-habit": "atomic-habits-james-clear-summary",
  "atomichabits": "atomic-habits-james-clear-summary",
  "wings-of-fire-apj": "wings-of-fire-a-p-j-abdul-kalam-summary",
};

/** Returns the canonical slug if `slug` is a known alias, else null. */
export function resolveCanonicalSlug(slug: string): string | null {
  if (!slug) return null;
  const key = slug.toLowerCase().trim();
  return SLUG_REDIRECTS[key] ?? null;
}
