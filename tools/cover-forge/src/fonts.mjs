// Font registry + text measuring / fitting.
//
// Fonts are vendored into ./fonts (see fetch-fonts.mjs) so generation never
// depends on the network. opentype.js is used for advance-width measurement;
// the actual shaping is done by resvg (HarfBuzz), which handles Devanagari
// conjuncts correctly. Measurement is therefore approximate — fitting applies a
// small safety factor and check.mjs verifies real rendered ink width.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FONT_DIR = path.resolve(HERE, "..", "fonts");

export const FONT_FILES = {
  devanagari: {
    title: { file: "NotoSerifDevanagari_700Bold.ttf", family: "NotoSerifDevanagari", weight: 700 },
    titleAlt: { file: "NotoSansDevanagari_700Bold.ttf", family: "NotoSansDevanagari", weight: 700 },
    sub: { file: "NotoSerifDevanagari_500Medium.ttf", family: "NotoSerifDevanagari", weight: 500 },
    label: { file: "NotoSansDevanagari_600SemiBold.ttf", family: "NotoSansDevanagari", weight: 600 },
  },
  latin: {
    title: { file: "Fraunces_600SemiBold.ttf", family: "Fraunces", weight: 600 },
    titleAlt: { file: "Inter_700Bold.ttf", family: "Inter", weight: 700 },
    sub: { file: "EBGaramond_500Medium.ttf", family: "EBGaramond", weight: 500 },
    label: { file: "Inter_600SemiBold.ttf", family: "Inter", weight: 600 },
  },
};

const cache = new Map();

export function loadFont(spec) {
  const key = spec.file;
  if (cache.has(key)) return cache.get(key);
  const file = path.join(FONT_DIR, spec.file);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing font ${spec.file}. Run "node fetch-fonts.mjs" inside tools/cover-forge first.`);
  }
  const buf = fs.readFileSync(file);
  const parsed = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const font = { ...spec, path: file, ot: parsed };
  cache.set(key, font);
  return font;
}

export function fontSetFor(language) {
  const dev = String(language || "Hindi").toLowerCase().startsWith("hi");
  const set = dev ? FONT_FILES.devanagari : FONT_FILES.latin;
  return {
    language: dev ? "hi" : "en",
    title: loadFont(set.title),
    titleAlt: loadFont(set.titleAlt),
    sub: loadFont(set.sub),
    label: loadFont(set.label),
    all: [...new Set([set.title.file, set.titleAlt.file, set.sub.file, set.label.file])].map((file) =>
      loadFont(Object.values(set).find((f) => f.file === file) || set.title),
    ),
  };
}

export const fontFiles = (fonts) => fonts.all.map((f) => f.path);

/** Advance width in design units (px at the given font size). */
export function measure(text, font, size) {
  return font.ot.getAdvanceWidth(text, size, { kerning: true });
}

/** Characters in `text` that the font cannot render (tofu risk). */
export function missingGlyphs(text, font) {
  const missing = [];
  for (const ch of String(text)) {
    if (ch === " " || ch === "\n") continue;
    let idx = 0;
    try {
      idx = font.ot.charToGlyphIndex(ch);
    } catch {
      idx = 0;
    }
    if (!idx) missing.push(ch);
  }
  return [...new Set(missing)];
}

/**
 * Fit `text` into a box using greedy word wrapping, shrinking the font size
 * until it fits in `maxLines`.
 */
export function fitText({ text, font, maxWidth, maxLines = 3, startSize, minSize = 34, lineHeight = 1.28, safety = 1.04 }) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  for (let size = startSize; size >= minSize; size -= 2) {
    const lines = wrap(clean, font, size, maxWidth, safety);
    const widest = Math.max(...lines.map((l) => measure(l, font, size) * safety));
    if (lines.length <= maxLines && widest <= maxWidth) {
      return {
        lines,
        size,
        lh: size * lineHeight,
        height: lines.length * size * lineHeight,
        widest,
        box: maxWidth,
        measured: lines.map((l) => ({ text: l, width: measure(l, font, size) })),
      };
    }
  }
  const size = minSize;
  const lines = wrap(clean, font, size, maxWidth, safety).slice(0, maxLines);
  return {
    lines,
    size,
    lh: size * lineHeight,
    height: lines.length * size * lineHeight,
    widest: maxWidth,
    box: maxWidth,
    measured: lines.map((l) => ({ text: l, width: measure(l, font, size) })),
    saturated: true,
  };
}

export function wrap(text, font, size, maxWidth, safety = 1.04) {
  const words = String(text).split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, font, size) * safety <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
