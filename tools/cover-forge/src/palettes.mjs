import { hashText } from "./util.mjs";

// Palette system. Colours are harmonised with the 12 cover fallbacks already
// shipped inside src/components/BookCard.tsx so generated covers and the
// in-app fallback cards feel like one family.

export const PALETTES = [
  // ---- dark palettes -------------------------------------------------------
  { id: "indigo", mode: "dark", bg: ["#0f172a", "#1d4ed8"], ink: "#f8fafc", sub: "#c7d2fe", accent: "#38bdf8", art: ["#1e3a8a", "#60a5fa", "#bae6fd"], templates: ["band", "arch", "classic", "poster"] },
  { id: "violet", mode: "dark", bg: ["#18181b", "#4c1d95"], ink: "#faf5ff", sub: "#ddd6fe", accent: "#c084fc", art: ["#6d28d9", "#a855f7", "#f0abfc"], templates: ["band", "split", "poster", "side"] },
  { id: "amber", mode: "dark", bg: ["#1c1917", "#7c2d12"], ink: "#fffbeb", sub: "#fed7aa", accent: "#fbbf24", art: ["#b45309", "#f59e0b", "#fde68a"], templates: ["classic", "arch", "band", "split"] },
  { id: "forest", mode: "dark", bg: ["#052e16", "#166534"], ink: "#f0fdf4", sub: "#bbf7d0", accent: "#86efac", art: ["#15803d", "#4ade80", "#d9f99d"], templates: ["band", "poster", "arch", "classic"] },
  { id: "crimson", mode: "dark", bg: ["#450a0a", "#991b1b"], ink: "#fef2f2", sub: "#fecdd3", accent: "#fb7185", art: ["#b91c1c", "#f87171", "#fecdd3"], templates: ["poster", "classic", "band", "arch"] },
  { id: "teal", mode: "dark", bg: ["#083344", "#0e7490"], ink: "#ecfeff", sub: "#a5f3fc", accent: "#67e8f9", art: ["#0e7490", "#22d3ee", "#cffafe"], templates: ["band", "arch", "side", "poster"] },
  { id: "stone", mode: "dark", bg: ["#1c1917", "#57534e"], ink: "#fafaf9", sub: "#e7e5e4", accent: "#d6d3d1", art: ["#78716c", "#a8a29e", "#f5f5f4"], templates: ["minimal", "classic", "side", "split"] },
  { id: "gold", mode: "dark", bg: ["#1c1917", "#78350f"], ink: "#fef3c7", sub: "#fcd34d", accent: "#fde047", art: ["#a16207", "#eab308", "#fef08a"], templates: ["arch", "classic", "band", "poster"] },
  { id: "ocean", mode: "dark", bg: ["#0c4a6e", "#075985"], ink: "#f0f9ff", sub: "#bae6fd", accent: "#7dd3fc", art: ["#0369a1", "#38bdf8", "#e0f2fe"], templates: ["band", "poster", "classic", "side"] },
  { id: "ink", mode: "dark", bg: ["#111113", "#27272a"], ink: "#fafafa", sub: "#d4d4d8", accent: "#a1a1aa", art: ["#3f3f46", "#71717a", "#e4e4e7"], templates: ["minimal", "side", "classic", "split"] },

  // ---- light / paper palettes ---------------------------------------------
  { id: "ivory", mode: "light", bg: ["#faf7f0", "#efe6d5"], ink: "#241f1a", sub: "#6b5f4e", accent: "#b45309", art: ["#8a6b3f", "#c2a173", "#e8dcc6"], templates: ["minimal", "classic", "arch", "side"] },
  { id: "parchment", mode: "light", bg: ["#f7f3e8", "#e9dfc6"], ink: "#1f2937", sub: "#6b7280", accent: "#b91c1c", art: ["#9a3412", "#d97706", "#fcd9a4"], templates: ["minimal", "arch", "classic", "split"] },
  { id: "mint", mode: "light", bg: ["#f0fdf9", "#d1fae5"], ink: "#064e3b", sub: "#047857", accent: "#0d9488", art: ["#0f766e", "#2dd4bf", "#ccfbf1"], templates: ["minimal", "band", "side", "classic"] },
  { id: "blush", mode: "light", bg: ["#fff7f5", "#ffe4e6"], ink: "#4c0519", sub: "#9f1239", accent: "#e11d48", art: ["#be123c", "#fb7185", "#fecdd3"], templates: ["minimal", "band", "arch", "split"] },
];

// Category -> palette preference. Everything not listed falls back to the
// generic pools below, split by language (Devanagari covers read better warm).
const CATEGORY_HINTS = [
  [/(कविता|महाकाव्य|भक्ति|छायावाद|poetry|epic)/i, ["amber", "gold", "ivory", "parchment", "crimson"]],
  [/(उपन्यास|कहानी|सामाजिक|नाटक|fiction|novel|story|drama)/i, ["forest", "teal", "crimson", "ink", "violet", "stone"]],
  [/(आध्यात्म|धर्म|भक्ति|philosophy|spiritual|religion|self)/i, ["gold", "ocean", "ivory", "indigo", "amber"]],
  [/(इतिहास|जीवनी|संस्मरण|राजनीति|history|biography|memoir|politics)/i, ["stone", "parchment", "ink", "ocean", "teal"]],
  [/(आलोचना|निबंध|essay|criticism|critique)/i, ["ink", "stone", "ivory", "mint"]],
  [/(यात्रा|travel)/i, ["teal", "ocean", "mint", "forest"]],
  [/(व्यवसाय|स्वयं|self-help|business|productivity|psychology|startup)/i, ["indigo", "ocean", "ink", "mint", "violet"]],
];

const HINDI_POOL = ["amber", "gold", "forest", "crimson", "ivory", "parchment", "teal", "violet", "indigo", "blush"];
const ENGLISH_POOL = ["indigo", "ink", "ocean", "mint", "violet", "stone", "teal", "crimson", "ivory", "blush"];

const byId = Object.fromEntries(PALETTES.map((p) => [p.id, p]));

/**
 * Palettes are assigned by cycling through the candidate list rather than by
 * drawing at random, for the same reason templates are (see layouts.mjs):
 * random draws clump, and clumps of five amber novel covers in one browse grid
 * look like a bug. `index` is the book's stable position in the source list;
 * the slug hash only shifts the starting point so the cycle is not obvious.
 */
export function paletteFor(book, index = 0) {
  const category = book.category || "";
  const language = (book.language || "Hindi").toLowerCase();
  const pool = (base) => base.map((id) => byId[id]).filter(Boolean);
  const offset = hashText(book.slug || book.title || "") ;
  for (const [re, ids] of CATEGORY_HINTS) {
    if (re.test(category)) {
      const allowed = pool(ids);
      if (allowed.length) return allowed[(Number(index) + offset) % allowed.length];
    }
  }
  const allowed = pool(language.startsWith("hi") ? HINDI_POOL : ENGLISH_POOL);
  return allowed[(Number(index) + offset) % allowed.length];
}

export const paletteIds = () => PALETTES.map((p) => p.id);
export const getPalette = (id) => byId[id];
