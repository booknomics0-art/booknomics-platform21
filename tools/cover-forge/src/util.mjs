// Small shared helpers: deterministic RNG, hashing, SVG escaping.

/** FNV-1a 32-bit hash — same algorithm the app uses in BookCard.tsx. */
export function hashText(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32 — tiny deterministic PRNG from a 32-bit seed. */
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (rand, list) => list[Math.floor(rand() * list.length) % list.length];
export const range = (rand, min, max) => min + rand() * (max - min);
export const int = (rand, min, max) => Math.round(range(rand, min, max));

export function esc(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Round to 2 decimals to keep SVG output small and diff-friendly. */
export const r2 = (n) => Math.round(n * 100) / 100;

export function svgText({ x, y, size, family, text, fill, anchor = "middle", weight = 400, tracking = 0, opacity = 1, italic = false }) {
  const attrs = [
    `x="${r2(x)}"`,
    `y="${r2(y)}"`,
    `font-family="${esc(family)}"`,
    `font-size="${r2(size)}"`,
    `font-weight="${weight}"`,
    `fill="${fill}"`,
    `text-anchor="${anchor}"`,
    `xml:space="preserve"`,
  ];
  if (tracking) attrs.push(`letter-spacing="${r2(tracking)}"`);
  if (opacity !== 1) attrs.push(`opacity="${opacity}"`);
  if (italic) attrs.push(`font-style="italic"`);
  return `<text ${attrs.join(" ")}>${esc(text)}</text>`;
}

export function svgLine(x1, y1, x2, y2, stroke, width = 1, opacity = 1, dash = "") {
  const d = dash ? ` stroke-dasharray="${dash}"` : "";
  return `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${stroke}" stroke-width="${r2(width)}" opacity="${opacity}"${d}/>`;
}
