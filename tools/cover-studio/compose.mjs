#!/usr/bin/env node
/**
 * Booknomics cover studio — final cover composer.
 *
 * Takes text-free AI artwork and sets the typography in code, so every
 * Devanagari title is spelled exactly as it is in the database (AI image
 * models regularly garble conjuncts like क्त, श्र, ह्य). Output is always
 * 800x1200 (2:3), the ratio BookCard renders with object-contain.
 *
 * Single cover:
 *   node compose.mjs --art art.png --out cover.jpg --title "गोदान" --author "मुंशी प्रेमचंद" \
 *        [--font mukta] [--mode dark|light] [--title-color #hex] [--author-color #hex] [--shade #hex]
 *
 * Batch (reads content-drafts/covers/hindi/manifest.json by default):
 *   node compose.mjs --batch [manifest.json] [--art-dir DIR] [--only slug1,slug2]
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const FONT_DIR = path.join(HERE, "node_modules", "@expo-google-fonts");
export const W = 800;
export const H = 1200;

const font = (file, family) => ({ file, family });

/** Title faces. Every Devanagari face below also carries Latin glyphs. */
export const TITLE_FONTS = {
  mukta: font("mukta/700Bold/Mukta_700Bold.ttf", "Mukta Bold"),
  muktaxb: font("mukta/800ExtraBold/Mukta_800ExtraBold.ttf", "Mukta Ultra-Bold"),
  tiro: font("tiro-devanagari-hindi/400Regular/TiroDevanagariHindi_400Regular.ttf", "Tiro Devanagari Hindi"),
  rozha: font("rozha-one/400Regular/RozhaOne_400Regular.ttf", "Rozha One"),
  yatra: font("yatra-one/400Regular/YatraOne_400Regular.ttf", "Yatra One"),
  khand: font("khand/700Bold/Khand_700Bold.ttf", "Khand Bold"),
  eczar: font("eczar/700Bold/Eczar_700Bold.ttf", "Eczar Bold"),
  laila: font("laila/600SemiBold/Laila_600SemiBold.ttf", "Laila Semi-Bold"),
  notoserif: font("noto-serif-devanagari/700Bold/NotoSerifDevanagari_700Bold.ttf", "Noto Serif Devanagari Bold"),
  kalam: font("kalam/700Bold/Kalam_700Bold.ttf", "Kalam Bold"),
  amita: font("amita/700Bold/Amita_700Bold.ttf", "Amita Bold"),
  martel: font("martel/800ExtraBold/Martel_800ExtraBold.ttf", "Martel Ultra-Bold"),
  // Latin-only display faces, for regional titles stored in Latin script.
  cinzel: font("cinzel/700Bold/Cinzel_700Bold.ttf", "Cinzel Bold"),
  playfair: font("playfair-display/700Bold/PlayfairDisplay_700Bold.ttf", "Playfair Display Bold"),
  cormorant: font("cormorant-garamond/700Bold/CormorantGaramond_700Bold.ttf", "Cormorant Garamond Bold"),
  oswald: font("oswald/600SemiBold/Oswald_600SemiBold.ttf", "Oswald Semi-Bold"),
  teko: font("teko/600SemiBold/Teko_600SemiBold.ttf", "Teko Semi-Bold"),
};

/** Lighter companion face used for the author line. */
const AUTHOR_FONTS = {
  mukta: font("mukta/500Medium/Mukta_500Medium.ttf", "Mukta Medium"),
  muktaxb: font("mukta/500Medium/Mukta_500Medium.ttf", "Mukta Medium"),
  tiro: font("tiro-devanagari-hindi/400Regular/TiroDevanagariHindi_400Regular.ttf", "Tiro Devanagari Hindi"),
  rozha: font("laila/500Medium/Laila_500Medium.ttf", "Laila Medium"),
  yatra: font("mukta/500Medium/Mukta_500Medium.ttf", "Mukta Medium"),
  khand: font("khand/500Medium/Khand_500Medium.ttf", "Khand Medium"),
  eczar: font("eczar/500Medium/Eczar_500Medium.ttf", "Eczar Medium"),
  laila: font("laila/500Medium/Laila_500Medium.ttf", "Laila Medium"),
  notoserif: font("noto-serif-devanagari/500Medium/NotoSerifDevanagari_500Medium.ttf", "Noto Serif Devanagari Medium"),
  kalam: font("kalam/400Regular/Kalam_400Regular.ttf", "Kalam"),
  amita: font("laila/500Medium/Laila_500Medium.ttf", "Laila Medium"),
  martel: font("martel/600SemiBold/Martel_600SemiBold.ttf", "Martel Semi-Bold"),
  cinzel: font("cinzel/500Medium/Cinzel_500Medium.ttf", "Cinzel Medium"),
  playfair: font("playfair-display/400Regular_Italic/PlayfairDisplay_400Regular_Italic.ttf", "Playfair Display Italic"),
  cormorant: font("cormorant-garamond/600SemiBold_Italic/CormorantGaramond_600SemiBold_Italic.ttf", "Cormorant Garamond Semi-Bold Italic"),
  oswald: font("oswald/300Light/Oswald_300Light.ttf", "Oswald Light"),
  teko: font("teko/400Regular/Teko_400Regular.ttf", "Teko"),
};

const BRAND_FONT = font("mukta/500Medium/Mukta_500Medium.ttf", "Mukta Medium");

/**
 * "summary" layout = the look of the covers already on the site (public/book-covers, Supabase
 * book-covers): a small "— BOOKNOMICS SUMMARY —" label, a big heavy title (metallic gold on dark
 * art, deep ink colour on light art), the author underneath. These heavier cuts are used there.
 */
export const SUMMARY_FONTS = {
  martel: font("martel/900Black/Martel_900Black.ttf", "Martel Heavy"),
  eczar: font("eczar/800ExtraBold/Eczar_800ExtraBold.ttf", "Eczar Ultra-Bold"),
  notoserif: font("noto-serif-devanagari/900Black/NotoSerifDevanagari_900Black.ttf", "Noto Serif Devanagari Heavy"),
  mukta: font("mukta/800ExtraBold/Mukta_800ExtraBold.ttf", "Mukta Ultra-Bold"),
  muktaxb: font("mukta/800ExtraBold/Mukta_800ExtraBold.ttf", "Mukta Ultra-Bold"),
  laila: font("laila/700Bold/Laila_700Bold.ttf", "Laila Bold"),
};
const LABEL_FONT = font("cinzel/600SemiBold/Cinzel_600SemiBold.ttf", "Cinzel Semi-Bold");

/**
 * "foil" layout = the look of the reference cover the user approved (यशोधरा): a big gold-foil
 * calligraphic title, a thin rule with a lotus, the author in ivory, and an open-book icon with
 * BOOKNOMICS at the foot. High-contrast faces that match that lettering:
 */
export const FOIL_FONTS = {
  vesper: font("vesper-libre/700Bold/VesperLibre_700Bold.ttf", "Vesper Libre Bold"),
  vesperxb: font("vesper-libre/900Black/VesperLibre_900Black.ttf", "Vesper Libre Heavy"),
  rozha: font("rozha-one/400Regular/RozhaOne_400Regular.ttf", "Rozha One"),
  sahitya: font("sahitya/700Bold/Sahitya_700Bold.ttf", "Sahitya Bold"),
  kadwa: font("kadwa/700Bold/Kadwa_700Bold.ttf", "Kadwa Bold"),
  sura: font("sura/700Bold/Sura_700Bold.ttf", "Sura Bold"),
  tillana: font("tillana/700Bold/Tillana_700Bold.ttf", "Tillana Bold"),
  martel: font("martel/900Black/Martel_900Black.ttf", "Martel Heavy"),
  tiro: font("tiro-devanagari-hindi/400Regular/TiroDevanagariHindi_400Regular.ttf", "Tiro Devanagari Hindi"),
};
const FOIL_AUTHOR = font("noto-serif-devanagari/500Medium/NotoSerifDevanagari_500Medium.ttf", "Noto Serif Devanagari Medium");

const DEVANAGARI = /[\u0900-\u097F]/;
const escapeXml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = ([r, g, b]) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const textCache = new Map();
/** Renders Pango markup to a transparent PNG with HarfBuzz shaping. */
async function renderText({ text, face, size, color = "#ffffff", alpha = 1, tracking = 0, spacing = 0 }) {
  const key = JSON.stringify([text, face.family, size, color, alpha, tracking, spacing]);
  if (textCache.has(key)) return textCache.get(key);
  const attrs = [`foreground="${color}"`];
  if (alpha < 1) attrs.push(`fgalpha="${Math.max(1, Math.round(alpha * 100))}%"`);
  if (tracking) attrs.push(`letter_spacing="${Math.round(tracking * 1024)}"`);
  const markup = text
    .split("\n")
    .map((line) => `<span ${attrs.join(" ")}>${escapeXml(line)}</span>`)
    .join("\n");
  const buf = await sharp({
    text: {
      text: markup,
      font: `${face.family} ${size}`,
      fontfile: path.join(FONT_DIR, face.file),
      rgba: true,
      dpi: 72,
      align: "centre",
      ...(spacing ? { spacing } : {}),
    },
  })
    .png()
    .toBuffer();
  const { width, height } = await sharp(buf).metadata();
  const out = { buf, width, height };
  textCache.set(key, out);
  return out;
}

/** All ways to split `words` into `k` contiguous lines. */
function splits(words, k) {
  if (k === 1) return [[words.join(" ")]];
  const out = [];
  for (let i = 1; i <= words.length - k + 1; i++) {
    for (const rest of splits(words.slice(i), k - 1)) out.push([words.slice(0, i).join(" "), ...rest]);
  }
  return out;
}

/** Picks line breaks + size so the title is as large as possible inside maxWidth. */
async function fitBlock(text, face, { maxWidth, sizes, minSizes, maxLines, spacingRatio = 0 }) {
  const words = text.trim().split(/\s+/);
  let best = null;
  for (let lines = 1; lines <= Math.min(maxLines, words.length); lines++) {
    let bestSplit = null;
    for (const cand of splits(words, lines)) {
      const widths = [];
      for (const line of cand) widths.push((await renderText({ text: line, face, size: 100 })).width);
      const widest = Math.max(...widths);
      // Prefer balanced lines; slight bonus for a longer last line looking natural.
      const score = widest;
      if (!bestSplit || score < bestSplit.score) bestSplit = { cand, score };
    }
    const size = Math.min(sizes[lines - 1], Math.floor((100 * maxWidth) / bestSplit.score));
    const candidate = { text: bestSplit.cand.join("\n"), size, lines };
    if (!best || size > best.size * 1.12) best = candidate; // more lines only when clearly larger
    if (size >= minSizes[lines - 1]) break;
  }
  const spacing = best.lines > 1 ? Math.round(best.size * spacingRatio) : 0;
  return { ...best, spacing };
}

async function sampleTopColor(artBuf) {
  const { data } = await sharp(artBuf)
    .extract({ left: 0, top: 0, width: W, height: Math.round(H * 0.3) })
    .resize(1, 1, { kernel: "cubic" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return [data[0], data[1], data[2]];
}

function gradientSvg({ shade, topAlpha, topEnd, bottomAlpha }) {
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="t" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade}" stop-opacity="${topAlpha}"/>
      <stop offset="${(topEnd * 0.55).toFixed(3)}" stop-color="${shade}" stop-opacity="${(topAlpha * 0.62).toFixed(3)}"/>
      <stop offset="${topEnd.toFixed(3)}" stop-color="${shade}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="b" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="${shade}" stop-opacity="${bottomAlpha}"/>
      <stop offset="0.15" stop-color="${shade}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#t)"/>
  <rect width="${W}" height="${H}" fill="url(#b)"/>
</svg>`);
}

/**
 * Compose one cover.
 * @param {object} o
 * @param {string|Buffer} o.art   text-free artwork (any size; centre-cropped to 2:3)
 * @param {string} o.title
 * @param {string} o.author
 * @param {string} [o.font]        key of TITLE_FONTS (default: mukta for Devanagari, playfair for Latin)
 * @param {"dark"|"light"} [o.mode] dark = cream text over darkened sky (default, auto-detected)
 * @param {string} [o.titleColor] @param {string} [o.authorColor] @param {string} [o.shade]
 * @param {number} [o.titleTop]    px from top where the title block starts (default 78)
 * @returns {Promise<Buffer>} PNG buffer, 800x1200
 */
/**
 * Some generations paint the "empty title area" as a flat block with a hard horizontal edge.
 * Hide that edge under a soft, eased band of the colour sampled just above it.
 * @param {Buffer} art 800x1200 art buffer
 * @param {number} seam edge position as a fraction of the cover height
 */
async function softenSeam(art, seam, above = 90, below = 170) {
  const y = Math.round(seam * H);
  const s = await sharp(art)
    .extract({ left: 0, top: Math.max(0, y - 46), width: W, height: 40 })
    .resize(1, 1, { kernel: "cubic" })
    .raw()
    .toBuffer();
  const c = rgbToHex([s[0], s[1], s[2]]);
  const ease = [0, 0.1, 0.32, 0.6, 0.85, 1];
  const stops = [
    ...ease.map((a, i) => [y - above + ((above - 6) * i) / (ease.length - 1), a]),
    ...[...ease].reverse().map((a, i) => [y + 12 + ((below - 12) * i) / (ease.length - 1), a]),
  ]
    .map(([py, a]) => `<stop offset="${Math.min(1, Math.max(0, py / H)).toFixed(4)}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join("");
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient></defs><rect width="${W}" height="${H}" fill="url(#s)"/></svg>`;
  return sharp(art).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}

const rgbToHsl = ([r, g, b]) => {
  (r /= 255), (g /= 255), (b /= 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
};
const hslToRgb = ([h, s, l]) => {
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
};
/** Deep "ink" colour for type on light artwork, in the hue of the artwork's sky. */
const inkFrom = (rgb) => {
  const [h, s] = rgbToHsl(rgb);
  return s < 0.12 ? "#3B2414" : rgbToHex(hslToRgb([h, Math.min(0.8, Math.max(0.5, s * 1.3)), 0.21]));
};

/** Renders each line separately, trims it to its ink, and stacks the lines with an even gap. */
async function stackLines(lines, face, size, gapRatio = 0.16) {
  const parts = [];
  for (const line of lines) {
    const r = await renderText({ text: line, face, size, color: "#FFFFFF" });
    const { data, info } = await sharp(r.buf).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
    parts.push({ buf: data, width: info.width, height: info.height });
  }
  const gap = Math.round(size * gapRatio);
  const width = Math.max(...parts.map((p) => p.width));
  const height = parts.reduce((s, p) => s + p.height, 0) + gap * (parts.length - 1);
  const boxes = [];
  let y = 0;
  const comps = parts.map((p) => {
    const c = { input: p.buf, left: Math.round((width - p.width) / 2), top: y };
    boxes.push({ top: y, height: p.height });
    y += p.height + gap;
    return c;
  });
  const buf = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(comps)
    .png()
    .toBuffer();
  return { buf, width, height, boxes };
}

/** Solid-colour copy of a mask. */
async function tint(mask, color, alpha = 1) {
  const [r, g, b] = hexToRgb(color);
  return sharp({ create: { width: mask.width, height: mask.height, channels: 4, background: { r, g, b, alpha } } })
    .composite([{ input: mask.buf, blend: "dest-in" }])
    .png()
    .toBuffer();
}

/** Fills the mask with a vertical gradient that restarts on every line. */
async function gradientFill(mask, stops) {
  const all = [];
  for (const box of mask.boxes) for (const [off, c] of stops) all.push([(box.top + off * box.height) / mask.height, c]);
  const svg = `<svg width="${mask.width}" height="${mask.height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">${all
    .map(([off, c]) => `<stop offset="${Math.min(1, Math.max(0, off)).toFixed(4)}" stop-color="${c}"/>`)
    .join("")}</linearGradient></defs><rect width="${mask.width}" height="${mask.height}" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).composite([{ input: mask.buf, blend: "dest-in" }]).png().toBuffer();
}

const blurPad = async (b, s) =>
  sharp(b).extend({ top: 30, bottom: 30, left: 30, right: 30, background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(s).png().toBuffer();

/** The site's existing cover look (see SUMMARY_FONTS). */
async function composeSummary(o, art) {
  const isDeva = DEVANAGARI.test(o.title);
  const fontKey = o.font && (SUMMARY_FONTS[o.font] || TITLE_FONTS[o.font]) ? o.font : isDeva ? "martel" : "playfair";
  const titleFace = SUMMARY_FONTS[fontKey] || TITLE_FONTS[fontKey];
  const authorFace = AUTHOR_FONTS[fontKey] || AUTHOR_FONTS.martel;

  const top = await sampleTopColor(art);
  const mode = o.mode || (luminance(top) > 0.6 ? "light" : "dark");
  const dark = mode === "dark";
  const ink = o.ink || inkFrom(top);
  const cx = (w) => Math.round((W - w) / 2);

  const latinScale = isDeva ? 1 : fontKey === "cinzel" ? 0.8 : fontKey === "teko" || fontKey === "oswald" ? 1.05 : 0.9;
  const title = await fitBlock(o.title, titleFace, {
    maxWidth: o.titleMaxWidth || 700,
    sizes: [196, 132, 104].map((s) => Math.round(s * latinScale)),
    minSizes: [124, 90, 70].map((s) => Math.round(s * latinScale)),
    maxLines: 3,
  });
  const mask = await stackLines(title.text.split("\n"), titleFace, title.size, o.lineGap ?? 0.17);
  const T = (color, alpha = 1) => tint(mask, color, alpha);
  const fill = await gradientFill(
    mask,
    o.titleGradient ||
      (dark
        ? [[0, "#FFF4D2"], [0.36, "#F7D990"], [0.68, "#E2B05A"], [1, "#B47C2C"]]
        : [[0, rgbToHex(mix(hexToRgb(ink), [255, 255, 255], 0.22))], [1, ink]]),
  );

  const author = await fitBlock(o.author, authorFace, {
    maxWidth: 640,
    sizes: [DEVANAGARI.test(o.author) ? 48 : 40, 36],
    minSizes: [32, 28],
    maxLines: 2,
  });
  const authorMask = await stackLines(author.text.split("\n"), authorFace, author.size, 0.3);
  const authorColor = o.authorColor || (dark ? "#F4E3BA" : rgbToHex(mix(hexToRgb(ink), [0, 0, 0], 0.2)));
  const A = (color, alpha = 1) => tint(authorMask, color, alpha);

  const labelColor = dark ? "#E9D7A9" : ink;
  const label = await renderText({ text: "BOOKNOMICS SUMMARY", face: LABEL_FONT, size: 17, color: labelColor, alpha: dark ? 0.9 : 0.85, tracking: 4.2 });

  // Vertical rhythm (all positions are ink edges, so every font spaces the same).
  const labelTop = 30;
  const titleTop = o.titleTop ?? 84;
  const titleBottom = titleTop + mask.height;
  const dividerY = titleBottom + 26;
  const authorTop = dark ? titleBottom + 24 : dividerY + 22;
  const blockBottom = authorTop + authorMask.height;
  const topEnd = Math.min(0.6, (blockBottom + 170) / H);

  const shade = o.shade || (dark ? rgbToHex(mix(top, [0, 0, 0], 0.6)) : "#FFFBF2");
  const topAlpha = o.topAlpha ?? (dark ? 0.66 : 0.62);
  const ruleY = labelTop + Math.round(label.height * 0.5);
  const lx = cx(label.width);
  const overlay = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${shade}" stop-opacity="${topAlpha}"/>
    <stop offset="${(topEnd * 0.55).toFixed(3)}" stop-color="${shade}" stop-opacity="${(topAlpha * 0.6).toFixed(3)}"/>
    <stop offset="${topEnd.toFixed(3)}" stop-color="${shade}" stop-opacity="0"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#t)"/>
  <g stroke="${labelColor}" stroke-opacity="${dark ? 0.6 : 0.55}" stroke-width="1.4">
    <line x1="${lx - 86}" y1="${ruleY}" x2="${lx - 16}" y2="${ruleY}"/>
    <line x1="${lx + label.width + 16}" y1="${ruleY}" x2="${lx + label.width + 86}" y2="${ruleY}"/>
  </g>
  ${
    dark
      ? ""
      : `<g stroke="${ink}" stroke-opacity="0.75" stroke-width="1.6" fill="${ink}" fill-opacity="0.8">
    <line x1="${W / 2 - 78}" y1="${dividerY}" x2="${W / 2 - 12}" y2="${dividerY}"/>
    <line x1="${W / 2 + 12}" y1="${dividerY}" x2="${W / 2 + 78}" y2="${dividerY}"/>
    <rect x="${W / 2 - 4.5}" y="${dividerY - 4.5}" width="9" height="9" transform="rotate(45 ${W / 2} ${dividerY})"/>
  </g>`
  }
</svg>`);

  const tx = cx(mask.width);
  const ax = cx(authorMask.width);
  const layers = [{ input: overlay, left: 0, top: 0 }];
  if (dark) {
    // Metallic gold: soft drop shadow, thin dark rim, light top edge, gradient face.
    layers.push({ input: await blurPad(await T("#000000", 0.8), 8), left: tx - 30, top: titleTop - 30 + 6 });
    const rim = await T("#2A1705", 0.85);
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4], [0, 3]])
      layers.push({ input: rim, left: Math.round(tx + dx), top: Math.round(titleTop + dy) });
    layers.push({ input: await T("#FFF9E6"), left: tx, top: titleTop - 1 });
  } else {
    layers.push({ input: await blurPad(await T("#FFFFFF", 0.9), 10), left: tx - 30, top: titleTop - 30 });
  }
  layers.push({ input: fill, left: tx, top: titleTop });
  layers.push({ input: await blurPad(await A(dark ? "#000000" : "#FFFFFF", dark ? 0.75 : 0.9), 6), left: ax - 30, top: authorTop - 30 + (dark ? 2 : 0) });
  layers.push({ input: await A(authorColor), left: ax, top: authorTop });
  layers.push({ input: label.buf, left: lx, top: labelTop });
  return sharp(art).composite(layers).png().toBuffer();
}

/**
 * Fits art that is wider than 2:3 (e.g. a square 1024² generation) without cropping the figures
 * away: the art is scaled to H - extendTop, centre-cropped to W, and the sky is continued upward
 * by stretching + blurring its top rows, feathered into the picture.
 */
/**
 * Some generations come back as a 2:3 picture inside a square canvas with black pillarbox bars.
 * Cut away edge bands that are pure black over their full length (≥2% of the side).
 */
async function trimBars(input) {
  const base = await sharp(input).rotate().toBuffer();
  const { data, info } = await sharp(base).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const colMax = new Uint8Array(w), rowMax = new Uint8Array(h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = data[y * w + x];
      if (v > colMax[x]) colMax[x] = v;
      if (v > rowMax[y]) rowMax[y] = v;
    }
  let l = 0, r = w - 1, t = 0, b = h - 1;
  while (l < w - 1 && colMax[l] < 14) l++;
  while (r > l && colMax[r] < 14) r--;
  while (t < h - 1 && rowMax[t] < 14) t++;
  while (b > t && rowMax[b] < 14) b--;
  const L = l >= w * 0.02 ? l + 2 : 0, R = w - 1 - r >= w * 0.02 ? r - 2 : w - 1;
  const T = t >= h * 0.02 ? t + 2 : 0, B = h - 1 - b >= h * 0.02 ? b - 2 : h - 1;
  if (!L && !T && R === w - 1 && B === h - 1) return base;
  return sharp(base).extract({ left: L, top: T, width: R - L + 1, height: B - T + 1 }).toBuffer();
}

async function fitArt(input, o) {
  input = await trimBars(input);
  const img = sharp(input);
  const { width, height } = await img.metadata();
  const aspect = width / height;
  const ext = Math.round(o.extendTop ?? (aspect > 0.8 ? 170 : 0));
  if (!ext) return img.resize(W, H, { fit: "cover", position: o.artPosition || "centre" }).toBuffer();
  const artH = H - ext;
  const body = await sharp(input).rotate().resize(W, artH, { fit: "cover", position: o.artPosition || "centre" }).toBuffer();
  const strip = await sharp(body).extract({ left: 0, top: 0, width: W, height: 6 }).toBuffer();
  const sky = await sharp(strip).resize(W, ext + 80, { fit: "fill" }).blur(18).toBuffer();
  const feather = Buffer.from(`<svg width="${W}" height="${artH}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${(70 / artH).toFixed(4)}" stop-color="#fff" stop-opacity="1"/></linearGradient></defs><rect width="${W}" height="${artH}" fill="url(#f)"/></svg>`);
  const bodyFeathered = await sharp(body).ensureAlpha().composite([{ input: feather, blend: "dest-in" }]).png().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([
      { input: sky, left: 0, top: 0 },
      { input: bodyFeathered, left: 0, top: ext },
    ])
    .png()
    .toBuffer();
}

/** Mean colour of a horizontal band of the art (fractions of the height). */
async function sampleBand(artBuf, from, to) {
  const top = Math.round(H * from), height = Math.max(1, Math.round(H * (to - from)));
  const { data } = await sharp(artBuf).extract({ left: 0, top, width: W, height }).resize(1, 1, { kernel: "cubic" }).raw().toBuffer({ resolveWithObject: true });
  return [data[0], data[1], data[2]];
}

let grainCache = null;
/**
 * Film finish so the artwork reads as a photograph rather than a glossy render: a touch less
 * saturation, fine monochrome grain (soft-light) and a gentle vignette.
 */
async function filmFinish(art, { grain = 1, saturation = 0.93, vignette = 0.24 } = {}) {
  let img = await sharp(art).modulate({ saturation }).toBuffer();
  const layers = [];
  if (grain > 0) {
    grainCache ||= await sharp({ create: { width: W, height: H, channels: 3, background: { r: 128, g: 128, b: 128 }, noise: { type: "gaussian", mean: 128, sigma: 22 } } })
      .greyscale()
      .toColourspace("srgb")
      .png()
      .toBuffer();
    const g = grain === 1 ? grainCache : await sharp(grainCache).linear(grain, 128 * (1 - grain)).png().toBuffer();
    layers.push({ input: g, blend: "soft-light" });
  }
  if (vignette > 0)
    layers.push({
      input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="v" cx="50%" cy="50%" r="75%"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${vignette}"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#v)"/></svg>`),
    });
  return layers.length ? sharp(img).composite(layers).png().toBuffer() : img;
}

/** Outline lotus centred on (x, y), about 46×26 px. */
const lotusSvg = (x, y, color, opacity = 0.95) => `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
  <path d="M0,-13 C7,-6 7,4 0,11 C-7,4 -7,-6 0,-13 Z"/>
  <path d="M-2,11 C-10,7 -14,-1 -12,-8 C-6,-4 -2,3 -2,11 Z"/><path d="M2,11 C10,7 14,-1 12,-8 C6,-4 2,3 2,11 Z"/>
  <path d="M-4,11 C-16,11 -23,3 -23,-2 C-15,-2 -8,4 -4,11 Z"/><path d="M4,11 C16,11 23,3 23,-2 C15,-2 8,4 4,11 Z"/>
  <path d="M-15,13.5 Q0,17 15,13.5"/>
</g>`;

/** Outline open book centred on (x, y), about 48×32 px. */
const bookSvg = (x, y, color, opacity = 0.95) => `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
  <path d="M0,-10 C-6,-14 -14,-15 -21,-13 L-21,8 C-14,6 -6,7 0,11 Z"/>
  <path d="M0,-10 C6,-14 14,-15 21,-13 L21,8 C14,6 6,7 0,11 Z"/>
  <path d="M-24,-10 L-24,11 C-15,9 -6,10 0,14 C6,10 15,9 24,11 L24,-10"/>
  <path d="M-16,-7 C-11,-8 -6,-7 -3,-5 M-16,-2 C-11,-3 -6,-2 -3,0 M16,-7 C11,-8 6,-7 3,-5 M16,-2 C11,-3 6,-2 3,0" stroke-width="1.1" stroke-opacity="${opacity * 0.8}"/>
</g>`;

/** The approved reference look (see FOIL_FONTS). */
async function composeFoil(o, art) {
  const isDeva = DEVANAGARI.test(o.title);
  let fontKey = o.font && (FOIL_FONTS[o.font] || TITLE_FONTS[o.font]) ? o.font : "vesper";
  // Rozha One draws इ with a dot-like tail, so "बाइरे" reads as "बाड़रे". Never use it for इ.
  if (fontKey === "rozha" && /इ/.test(o.title)) fontKey = "vesper";
  const titleFace = FOIL_FONTS[fontKey] || TITLE_FONTS[fontKey];
  const cx = (w) => Math.round((W - w) / 2);

  const topC = await sampleBand(art, 0, 0.3);
  const botC = await sampleBand(art, 0.86, 1);
  const mode = o.mode || (luminance(topC) > 0.6 ? "light" : "dark");
  const dark = mode === "dark";
  const ink = o.ink || inkFrom(topC);
  const gold = "#E7C67E";

  const latinScale = isDeva ? 1 : 0.88;
  const title = await fitBlock(o.title, titleFace, {
    maxWidth: o.titleMaxWidth || 650,
    sizes: [204, 138, 106].map((s) => Math.round(s * latinScale)),
    minSizes: [130, 92, 72].map((s) => Math.round(s * latinScale)),
    maxLines: 3,
  });
  const mask = await stackLines(title.text.split("\n"), titleFace, title.size, o.lineGap ?? 0.15);
  const T = (color, alpha = 1) => tint(mask, color, alpha);
  const fill = await gradientFill(
    mask,
    o.titleGradient ||
      (dark
        ? [[0, "#FFF2CC"], [0.28, "#F4D793"], [0.52, "#D8AC5A"], [0.7, "#EFCF88"], [1, "#B4812D"]]
        : [[0, rgbToHex(mix(hexToRgb(ink), [255, 255, 255], 0.25))], [0.55, ink], [1, rgbToHex(mix(hexToRgb(ink), [0, 0, 0], 0.25))]]),
  );

  const author = await fitBlock(o.author, FOIL_AUTHOR, {
    maxWidth: 620,
    sizes: [DEVANAGARI.test(o.author) ? 44 : 38, 34],
    minSizes: [30, 26],
    maxLines: 2,
  });
  const authorMask = await stackLines(author.text.split("\n"), FOIL_AUTHOR, author.size, 0.3);
  const authorColor = o.authorColor || (dark ? "#F7F0E2" : rgbToHex(mix(hexToRgb(ink), [0, 0, 0], 0.15)));
  const A = (color, alpha = 1) => tint(authorMask, color, alpha);

  // Foot: open book + BOOKNOMICS, coloured for whatever the bottom of the art is.
  const footDark = luminance(botC) < 0.55;
  const footColor = footDark ? gold : rgbToHex(mix(hexToRgb(ink), [0, 0, 0], 0.1));
  const brand = await renderText({ text: "BOOKNOMICS", face: LABEL_FONT, size: 21, color: footDark ? "#EAD7A6" : footColor, tracking: 3.2 });

  const titleTop = o.titleTop ?? 62;
  const titleBottom = titleTop + mask.height;
  const dividerY = titleBottom + 26;
  const authorTop = dividerY + 26;
  const blockBottom = authorTop + authorMask.height;
  const topEnd = Math.min(0.58, (blockBottom + 160) / H);
  const bookY = H - 108;
  const brandTop = H - 74;

  const shadeTop = o.shade || (dark ? rgbToHex(mix(topC, [0, 0, 0], 0.62)) : "#FFFBF2");
  const shadeBot = footDark ? rgbToHex(mix(botC, [0, 0, 0], 0.6)) : "#FFFBF2";
  const topAlpha = o.topAlpha ?? (dark ? 0.6 : 0.58);
  const ruleColor = dark ? gold : ink;
  const overlay = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="t" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shadeTop}" stop-opacity="${topAlpha}"/>
      <stop offset="${(topEnd * 0.55).toFixed(3)}" stop-color="${shadeTop}" stop-opacity="${(topAlpha * 0.6).toFixed(3)}"/>
      <stop offset="${topEnd.toFixed(3)}" stop-color="${shadeTop}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="b" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="${shadeBot}" stop-opacity="${footDark ? 0.62 : 0.5}"/>
      <stop offset="0.2" stop-color="${shadeBot}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#t)"/>
  <rect width="${W}" height="${H}" fill="url(#b)"/>
  <g stroke="${ruleColor}" stroke-opacity="0.85" stroke-width="1.4">
    <line x1="${W / 2 - 190}" y1="${dividerY}" x2="${W / 2 - 34}" y2="${dividerY}"/>
    <line x1="${W / 2 + 34}" y1="${dividerY}" x2="${W / 2 + 190}" y2="${dividerY}"/>
  </g>
  ${lotusSvg(W / 2, dividerY - 1, ruleColor)}
  <g stroke="${footColor}" stroke-opacity="0.8" stroke-width="1.3">
    <line x1="${W / 2 - 170}" y1="${bookY + 4}" x2="${W / 2 - 40}" y2="${bookY + 4}"/>
    <line x1="${W / 2 + 40}" y1="${bookY + 4}" x2="${W / 2 + 170}" y2="${bookY + 4}"/>
  </g>
  ${bookSvg(W / 2, bookY, footColor)}
</svg>`);

  const tx = cx(mask.width);
  const ax = cx(authorMask.width);
  const layers = [{ input: overlay, left: 0, top: 0 }];
  if (dark) {
    layers.push({ input: await blurPad(await T("#000000", 0.6), 7), left: tx - 30, top: titleTop - 30 + 4 });
    const rim = await T("#3A2208", 0.55);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1.6]]) layers.push({ input: rim, left: Math.round(tx + dx), top: Math.round(titleTop + dy) });
  } else {
    layers.push({ input: await blurPad(await T("#FFFFFF", 0.85), 10), left: tx - 30, top: titleTop - 30 });
  }
  layers.push({ input: fill, left: tx, top: titleTop });
  layers.push({ input: await blurPad(await A(dark ? "#000000" : "#FFFFFF", dark ? 0.7 : 0.9), 6), left: ax - 30, top: authorTop - 30 + (dark ? 2 : 0) });
  layers.push({ input: await A(authorColor), left: ax, top: authorTop });
  if (footDark) layers.push({ input: await blurPad((await renderText({ text: "BOOKNOMICS", face: LABEL_FONT, size: 21, color: "#000000", alpha: 0.6, tracking: 3.2 })).buf, 4), left: cx(brand.width) - 30, top: brandTop - 30 + 1 });
  layers.push({ input: brand.buf, left: cx(brand.width), top: brandTop });
  return sharp(art).composite(layers).png().toBuffer();
}

export async function composeCover(o) {
  let art = await fitArt(o.art, o);
  if (o.seam) art = await softenSeam(art, Number(o.seam));
  o = { ...o, title: o.titleDisplay || o.title, author: o.authorDisplay || o.author };
  if ((o.layout || "foil") === "foil") return composeFoil(o, await filmFinish(art, { grain: o.grain ?? 1 }));
  if ((o.layout || "summary") === "summary") return composeSummary(o, art);
  const isDeva = DEVANAGARI.test(o.title);
  const fontKey = o.font && TITLE_FONTS[o.font] ? o.font : isDeva ? "mukta" : "playfair";
  const titleFace = TITLE_FONTS[fontKey];
  const authorFace = AUTHOR_FONTS[fontKey];

  const top = await sampleTopColor(art);
  const mode = o.mode || (luminance(top) > 0.62 ? "light" : "dark");
  const shade =
    o.shade || rgbToHex(mode === "dark" ? mix(top, [0, 0, 0], 0.58) : mix(top, [255, 252, 245], 0.55));
  const titleColor = o.titleColor || (mode === "dark" ? "#F7EEDC" : rgbToHex(mix(top, [0, 0, 0], 0.82)));
  const authorColor = o.authorColor || (mode === "dark" ? "#E2BC72" : rgbToHex(mix(top, [0, 0, 0], 0.62)));
  const brandColor = o.brandColor || (mode === "dark" ? "#F2E8D5" : rgbToHex(mix(top, [0, 0, 0], 0.7)));

  // Latin display faces run wider than Devanagari at the same point size.
  const latinScale = isDeva ? 1 : fontKey === "cinzel" ? 0.8 : fontKey === "teko" || fontKey === "oswald" ? 1.05 : 0.9;
  const title = await fitBlock(o.title, titleFace, {
    maxWidth: o.titleMaxWidth || 680,
    sizes: [172, 120, 92].map((s) => Math.round(s * latinScale)),
    minSizes: [100, 74, 56].map((s) => Math.round(s * latinScale)),
    maxLines: 3,
    spacingRatio: isDeva ? -0.05 : -0.1,
  });
  const titleImg = await renderText({ text: title.text, face: titleFace, size: title.size, color: titleColor, spacing: title.spacing });

  const authorIsDeva = DEVANAGARI.test(o.author);
  const author = await fitBlock(o.author, authorFace, {
    maxWidth: 620,
    sizes: [authorIsDeva ? 52 : 44, 38],
    minSizes: [34, 28],
    maxLines: 2,
  });
  const authorImg = await renderText({ text: author.text, face: authorFace, size: author.size, color: authorColor, spacing: author.spacing });

  const titleTop = o.titleTop ?? 78;
  const authorTop = titleTop + titleImg.height + (isDeva ? 14 : 22);
  const blockBottom = authorTop + authorImg.height;
  const topEnd = Math.min(0.62, (blockBottom + 150) / H);

  // Soft shadow (dark mode) or glow (light mode) behind the type for legibility on any artwork.
  const haloColor = mode === "dark" ? "#000000" : "#FFFFFF";
  const titleHalo = await renderText({ text: title.text, face: titleFace, size: title.size, color: haloColor, alpha: mode === "dark" ? 0.75 : 0.85, spacing: title.spacing });
  const authorHalo = await renderText({ text: author.text, face: authorFace, size: author.size, color: haloColor, alpha: 0.7, spacing: author.spacing });
  const blur = async (b, s) => sharp(b).extend({ top: 30, bottom: 30, left: 30, right: 30, background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(s).png().toBuffer();

  const brand = await renderText({ text: "BOOKNOMICS", face: BRAND_FONT, size: 24, color: brandColor, alpha: 0.86, tracking: 8.5 });

  const cx = (w) => Math.round((W - w) / 2);
  const layers = [
    { input: gradientSvg({ shade, topAlpha: o.topAlpha ?? (mode === "dark" ? 0.82 : 0.78), topEnd, bottomAlpha: o.bottomAlpha ?? 0.7 }), left: 0, top: 0 },
    { input: await blur(titleHalo.buf, 9), left: cx(titleHalo.width) - 30, top: titleTop - 30 + 4 },
    { input: titleImg.buf, left: cx(titleImg.width), top: titleTop },
    { input: await blur(authorHalo.buf, 6), left: cx(authorHalo.width) - 30, top: authorTop - 30 + 2 },
    { input: authorImg.buf, left: cx(authorImg.width), top: authorTop },
    { input: brand.buf, left: cx(brand.width), top: H - 46 - brand.height },
  ];
  return sharp(art).composite(layers).png().toBuffer();
}

export async function writeCover(pngBuf, outPath) {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const ext = path.extname(outPath).toLowerCase();
  const img = sharp(pngBuf);
  if (ext === ".jpg" || ext === ".jpeg") await img.jpeg({ quality: 84, progressive: true, mozjpeg: true }).toFile(outPath);
  else if (ext === ".webp") await img.webp({ quality: 84, effort: 6, smartSubsample: true }).toFile(outPath);
  else await img.png().toFile(outPath);
  return (await fs.stat(outPath)).size;
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith("--")) continue;
    const key = k.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) a[key] = true;
    else (a[key] = next), i++;
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.batch) {
    const manifestPath = path.resolve(typeof args.batch === "string" ? args.batch : path.join(REPO, "content-drafts/covers/hindi/manifest.json"));
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const artDir = path.resolve(args.artDir || process.env.COVER_ART_DIR || path.join(process.env.HOME || "/tmp", "cover-art-raw"));
    const only = args.only ? new Set(String(args.only).split(",")) : null;
    const outDir = path.dirname(manifestPath);
    let n = 0;
    for (const b of manifest.books) {
      if (only && !only.has(b.slug) && !only.has(b.key)) continue;
      if (!only && b.status === "done" && !args.force) continue;
      b.file = (b.file || `${b.slug}.jpg`).replace(/\.webp$/i, ".jpg");
      let artPath = null;
      for (const ext of ["png", "webp", "jpg"]) {
        try {
          await fs.access(path.join(artDir, `${b.key}.${ext}`));
          artPath = path.join(artDir, `${b.key}.${ext}`);
          break;
        } catch {
          /* try next extension */
        }
      }
      if (!artPath) continue;
      const png = await composeCover({ ...b, art: artPath });
      const out = path.join(outDir, b.file);
      const bytes = await writeCover(png, out);
      b.status = "done";
      n++;
      console.log(`✓ ${b.file}  ${(bytes / 1024).toFixed(0)} KB  ${b.title} — ${b.author}`);
    }
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`${n} cover(s) composed.`);
    return;
  }
  if (!args.art || !args.out || !args.title || !args.author) {
    console.error("Usage: node compose.mjs --art art.png --out cover.jpg --title T --author A [--font key] [--mode dark|light]");
    process.exit(2);
  }
  const png = await composeCover({ ...args, titleTop: args.titleTop ? Number(args.titleTop) : undefined });
  const bytes = await writeCover(png, path.resolve(args.out));
  console.log(`✓ ${args.out}  ${(bytes / 1024).toFixed(0)} KB`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
