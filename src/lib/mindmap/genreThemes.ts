/**
 * Genre-adaptive visual identity for Booknomics premium mind maps.
 *
 * Every genre gets its own premium editorial identity (hero gradient, accent,
 * spine, branch palette, background motif). English books only (v1).
 */

export type MindmapGenreKey =
  | "business"
  | "psychology"
  | "selfhelp"
  | "mystery"
  | "romance"
  | "fantasy"
  | "scifi"
  | "history"
  | "biography"
  | "philosophy"
  | "productivity"
  | "leadership"
  | "default";

export interface GenreTheme {
  key: MindmapGenreKey;
  /** Short editorial label shown on the map, e.g. "Business & Finance". */
  label: string;
  /** Hero gradient stops (left → right). */
  heroFrom: string;
  heroVia: string;
  heroTo: string;
  /** Text color used on top of the hero gradient. */
  heroInk: string;
  /** Muted text color on top of the hero gradient. */
  heroMuted: string;
  /** Primary accent (pills, links, active states). */
  accent: string;
  /** Deep ink for headings inside cards on cream. */
  ink: string;
  /** Vertical spine gradient (mobile timeline). */
  spineFrom: string;
  spineTo: string;
  /** Soft section background behind the branches. */
  canvasFrom: string;
  canvasTo: string;
  /** 8 color-coded branch accents, in branch order. */
  branches: [string, string, string, string, string, string, string, string];
  /** Decorative motif keyword (used for subtle background pattern). */
  motif: "grid" | "dots" | "lines" | "arcs" | "waves";
}

const THEMES: Record<MindmapGenreKey, GenreTheme> = {
  business: {
    key: "business",
    label: "Business & Finance",
    heroFrom: "#16224E",
    heroVia: "#1E2A5A",
    heroTo: "#0E5C46",
    heroInk: "#F7F3E6",
    heroMuted: "#C9CDAE",
    accent: "#C9A227",
    ink: "#1B2440",
    spineFrom: "#1E2A5A",
    spineTo: "#C9A227",
    canvasFrom: "#F4F1E6",
    canvasTo: "#E9EDF3",
    branches: ["#1E2A5A", "#0E7C5B", "#B8860B", "#2A7F8A", "#475569", "#2F5233", "#8C6A2F", "#3B6EA5"],
    motif: "grid",
  },
  psychology: {
    key: "psychology",
    label: "Psychology",
    heroFrom: "#2E4E7E",
    heroVia: "#5B5FBF",
    heroTo: "#7C6BD6",
    heroInk: "#F4F2FB",
    heroMuted: "#CFC8EA",
    accent: "#5B5FBF",
    ink: "#2B2E55",
    spineFrom: "#3B82C4",
    spineTo: "#7C6BD6",
    canvasFrom: "#EFF2FA",
    canvasTo: "#EDE8F7",
    branches: ["#3B82C4", "#7C6BD6", "#2A9D8F", "#8E6BA8", "#5DA9E9", "#9D8DF1", "#7FB069", "#6C7BD6"],
    motif: "arcs",
  },
  selfhelp: {
    key: "selfhelp",
    label: "Self-Help",
    heroFrom: "#8A3B12",
    heroVia: "#C2571B",
    heroTo: "#D99A2B",
    heroInk: "#FFF7EA",
    heroMuted: "#F3D9B8",
    accent: "#C2571B",
    ink: "#3A2412",
    spineFrom: "#EA580C",
    spineTo: "#D97706",
    canvasFrom: "#FDF5E7",
    canvasTo: "#FBEEDD",
    branches: ["#D97706", "#E11D48", "#EA580C", "#059669", "#7C3AED", "#0284C7", "#65A30D", "#0D9488"],
    motif: "waves",
  },
  mystery: {
    key: "mystery",
    label: "Mystery & Thriller",
    heroFrom: "#191920",
    heroVia: "#3A1E28",
    heroTo: "#6B1F2A",
    heroInk: "#F4EFE6",
    heroMuted: "#C9B896",
    accent: "#A8823C",
    ink: "#26262B",
    spineFrom: "#3A3A42",
    spineTo: "#7A2434",
    canvasFrom: "#F1EDE6",
    canvasTo: "#E4DCD2",
    branches: ["#2B2B2E", "#7A2434", "#A8823C", "#4B5563", "#5C1A24", "#5B7C99", "#9A6B3F", "#4A2545"],
    motif: "lines",
  },
  romance: {
    key: "romance",
    label: "Romance",
    heroFrom: "#5C2233",
    heroVia: "#7A2E3F",
    heroTo: "#A86B7C",
    heroInk: "#FBF1EC",
    heroMuted: "#E4C4BC",
    accent: "#9D4E5C",
    ink: "#452530",
    spineFrom: "#9D4E5C",
    spineTo: "#D66E7E",
    canvasFrom: "#FAF1EA",
    canvasTo: "#F5E6E2",
    branches: ["#7A2E3F", "#D66E7E", "#9D4E5C", "#B99B5F", "#A86B7C", "#C67B5C", "#C99CA5", "#6B4A3A"],
    motif: "arcs",
  },
  fantasy: {
    key: "fantasy",
    label: "Fantasy",
    heroFrom: "#1B2A5E",
    heroVia: "#27408B",
    heroTo: "#0E5C46",
    heroInk: "#F2F0E4",
    heroMuted: "#C4C9A8",
    accent: "#C9A227",
    ink: "#232B4E",
    spineFrom: "#27408B",
    spineTo: "#0E7C5B",
    canvasFrom: "#EEF0F6",
    canvasTo: "#E6EFE6",
    branches: ["#27408B", "#0E7C5B", "#B8860B", "#6D4AC8", "#1F8A80", "#9A6B3F", "#3B4CC0", "#7A4A8C"],
    motif: "dots",
  },
  scifi: {
    key: "scifi",
    label: "Science Fiction",
    heroFrom: "#0B1B33",
    heroVia: "#102A4C",
    heroTo: "#0E5E6E",
    heroInk: "#EAF6FB",
    heroMuted: "#A9CFDD",
    accent: "#0EA5C4",
    ink: "#16283F",
    spineFrom: "#2563EB",
    spineTo: "#0EA5C4",
    canvasFrom: "#EDF4F9",
    canvasTo: "#E2EEF5",
    branches: ["#102A4C", "#0EA5C4", "#2563EB", "#14B8A6", "#4B6B8A", "#7C3AED", "#5EB1E6", "#34D399"],
    motif: "grid",
  },
  history: {
    key: "history",
    label: "History",
    heroFrom: "#2F3A24",
    heroVia: "#4A3D28",
    heroTo: "#6B4A2F",
    heroInk: "#F5EDD8",
    heroMuted: "#D3C29A",
    accent: "#8C6A2F",
    ink: "#33301F",
    spineFrom: "#2F5233",
    spineTo: "#A8823C",
    canvasFrom: "#F5EEDC",
    canvasTo: "#EAE0C8",
    branches: ["#2F5233", "#6B4A2F", "#A8823C", "#8C7A4F", "#6B7C3B", "#9C4A2F", "#5B6570", "#8C5A2B"],
    motif: "lines",
  },
  biography: {
    key: "biography",
    label: "Biography",
    heroFrom: "#141414",
    heroVia: "#262626",
    heroTo: "#4A3D28",
    heroInk: "#F7F1E3",
    heroMuted: "#CFC2A4",
    accent: "#B8860B",
    ink: "#1F1F1F",
    spineFrom: "#262626",
    spineTo: "#B8860B",
    canvasFrom: "#F4F0E6",
    canvasTo: "#E9E4D6",
    branches: ["#1A1A1A", "#B8860B", "#3A3A3A", "#8C6A2F", "#4B5563", "#7A5C3E", "#6B6560", "#2B3A55"],
    motif: "lines",
  },
  philosophy: {
    key: "philosophy",
    label: "Philosophy",
    heroFrom: "#2B2B2B",
    heroVia: "#3D3A33",
    heroTo: "#6B5F45",
    heroInk: "#FAF7EF",
    heroMuted: "#CFC6B2",
    accent: "#8C7A4F",
    ink: "#2B2B2B",
    spineFrom: "#4B4B4B",
    spineTo: "#A8823C",
    canvasFrom: "#F7F4EC",
    canvasTo: "#ECE7D9",
    branches: ["#2B2B2B", "#A8823C", "#6B6560", "#7C8B6F", "#5B6570", "#8C6A2F", "#9C7A5B", "#6B7C5B"],
    motif: "dots",
  },
  productivity: {
    key: "productivity",
    label: "Productivity",
    heroFrom: "#1D4ED8",
    heroVia: "#2563EB",
    heroTo: "#0E7C5B",
    heroInk: "#F2F7FF",
    heroMuted: "#C4DBF5",
    accent: "#2563EB",
    ink: "#1E2E4A",
    spineFrom: "#2563EB",
    spineTo: "#16A34A",
    canvasFrom: "#EFF4FD",
    canvasTo: "#E8F5EC",
    branches: ["#2563EB", "#16A34A", "#0D9488", "#D97706", "#7C3AED", "#0284C7", "#65A30D", "#E11D48"],
    motif: "grid",
  },
  leadership: {
    key: "leadership",
    label: "Leadership",
    heroFrom: "#141C44",
    heroVia: "#1B2A5C",
    heroTo: "#2B3F8C",
    heroInk: "#F1F2FA",
    heroMuted: "#C2C9E4",
    accent: "#C9A227",
    ink: "#1B2440",
    spineFrom: "#1B2A5C",
    spineTo: "#C9A227",
    canvasFrom: "#EFF0F8",
    canvasTo: "#E6E9F3",
    branches: ["#1B2A5C", "#2B4EFF", "#B8860B", "#3B6EA5", "#475569", "#8C6A2F", "#2A7F8A", "#6B4A6B"],
    motif: "grid",
  },
  default: {
    key: "default",
    label: "Booknomics Pick",
    heroFrom: "#3A2E18",
    heroVia: "#5C4A24",
    heroTo: "#2B3A55",
    heroInk: "#FAF5E8",
    heroMuted: "#D3C8A8",
    accent: "#B8860B",
    ink: "#2B2620",
    spineFrom: "#8C6A2F",
    spineTo: "#2B3A55",
    canvasFrom: "#F6F2E7",
    canvasTo: "#ECE9DF",
    branches: ["#B8860B", "#2B3A55", "#2A7F8A", "#B5651D", "#6B4A6B", "#4A7C59", "#3B6EA5", "#8C6A2F"],
    motif: "waves",
  },
};

/** Keyword → genre. Order matters: first match wins (most specific first). */
const GENRE_MATCHERS: Array<{ key: MindmapGenreKey; test: RegExp }> = [
  { key: "mystery", test: /mystery|thriller|crime|detective|suspense|horror|noir/i },
  { key: "romance", test: /romance|love story|romantic/i },
  { key: "fantasy", test: /fantasy|magic|mytholog|epic|fairy/i },
  { key: "scifi", test: /sci[\s-]?fi|science fiction|dystopi|utopi|cyber|space opera|time travel/i },
  { key: "biography", test: /biograph|memoir|autobiograph|life story|lives of/i },
  { key: "history", test: /histor|ancient|medieval|civilization|war\b|empire/i },
  { key: "philosophy", test: /philosoph|stoic|ethics|existential|metaphys|vedanta|upani|spiritual|meditation|mindfulness|awareness/i },
  { key: "psychology", test: /psycholog|behavior|behaviour|cognitive|neuro|emotion|mind\b|mental|bias|persuasion|influence/i },
  { key: "productivity", test: /productiv|time management|focus|deep work|habit|organizing|efficiency|getting things/i },
  { key: "leadership", test: /leadership|leader\b|management|manager|executive|team\b|organiz/i },
  { key: "business", test: /business|finance|money|invest|wealth|startup|entrepreneur|marketing|sales|econom|strategy|corporate|stock|trading|rich|millionaire|billionaire/i },
  { key: "selfhelp", test: /self[\s-]?help|personal development|self improvement|motivat|confidence|discipline|purpose|growth mindset|success|manifest/i },
];

export function resolveGenreKey(category: string | null | undefined): MindmapGenreKey {
  const value = (category ?? "").trim();
  if (!value) return "default";
  for (const { key, test } of GENRE_MATCHERS) {
    if (test.test(value)) return key;
  }
  return "default";
}

export function resolveGenreTheme(category: string | null | undefined): GenreTheme {
  return THEMES[resolveGenreKey(category)];
}

/** Categories that should use the fiction-flavoured Story / People branches. */
const FICTION_MATCHER =
  /fiction|novel|romance|mystery|thriller|fantasy|sci[\s-]?fi|science fiction|horror|drama|poetry|poem|classic|myth|fable|story|stories|literature|tale|sahitya|साहित्य|kavya|katha|natak/i;

export function isFictionCategory(category: string | null | undefined): boolean {
  return FICTION_MATCHER.test(category ?? "");
}

/** Convert hex (#rgb / #rrggbb) to rgba() for soft tints. Falls back to the input. */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
