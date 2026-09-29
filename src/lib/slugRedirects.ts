// Single source of truth for book slug aliases → canonical slug.
// Used by:
//  - public/_redirects (hosting-level 301 redirects)
//  - src/pages/BookDetail.tsx client-side fallback (SPA navigations)
//
// To add a new alias: add an entry below, then run `bun run prebuild`
// (or any build) to regenerate _redirects.
export const SLUG_REDIRECTS: Record<string, string> = {
  // Hindi titles
  "bhagavad-gita-hindi": "bhagavad-gita-hi",
  "bhagwat-gita": "bhagavad-gita",
  "bhagwad-gita": "bhagavad-gita",
  "gandhi-autobiography": "gandhi-autobiography-hi",
  "my-experiments-with-truth": "gandhi-autobiography-hi",

  // Punctuation / spacing variants
  "cant-hurt-me": "can-t-hurt-me",
  "can_t_hurt_me": "can-t-hurt-me",
  "mans-search-for-meaning": "man-search-meaning",
  "man-s-search-for-meaning": "man-search-meaning",
  "mans-search-meaning": "man-search-meaning",

  // Numbered/prefix variants
  "7-habits": "the-7-habits",
  "7-habits-of-highly-effective-people": "the-7-habits",
  "seven-habits": "the-7-habits",

  // External/legacy slugs → canonical (with random suffix)
  "the-intelligent-investor": "the-intelligent-investor-cmkh",
  "intelligent-investor": "the-intelligent-investor-cmkh",
  "the-mountain-is-you": "the-mountain-is-you-a2fg",
  "mountain-is-you": "the-mountain-is-you-a2fg",
  "the-power-of-your-subconscious-mind": "the-power-of-your-subconscious-mind-6znj",
  "power-of-subconscious-mind": "the-power-of-your-subconscious-mind-6znj",
  "power-of-your-subconscious-mind": "the-power-of-your-subconscious-mind-6znj",

  // Common typos / singulars
  "atomic-habit": "atomic-habits",
  "atomichabits": "atomic-habits",
  "wings-of-fire-apj": "wings-of-fire",
  "the-bhagavad-gita": "bhagavad-gita",
  "chanakya-neeti": "chanakya-niti",
};

/** Returns the canonical slug if `slug` is a known alias, else null. */
export function resolveCanonicalSlug(slug: string): string | null {
  if (!slug) return null;
  const key = slug.toLowerCase().trim();
  return SLUG_REDIRECTS[key] ?? null;
}
