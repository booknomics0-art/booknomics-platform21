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
 *   node compose.mjs --art art.png --out cover.webp --title "गोदान" --author "मुंशी प्रेमचंद" \
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

export async function composeCover(o) {
  let art = await sharp(o.art).rotate().resize(W, H, { fit: "cover", position: o.artPosition || "centre" }).toBuffer();
  if (o.seam) art = await softenSeam(art, Number(o.seam));
  o = { ...o, title: o.titleDisplay || o.title, author: o.authorDisplay || o.author };
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
  if (ext === ".jpg" || ext === ".jpeg") await img.jpeg({ quality: 88, progressive: true, mozjpeg: true }).toFile(outPath);
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
    const artDir = path.resolve(args.artDir || path.join(process.env.HOME || "/tmp", ".cache/cover-art"));
    const only = args.only ? new Set(String(args.only).split(",")) : null;
    const outDir = path.dirname(manifestPath);
    let n = 0;
    for (const b of manifest.books) {
      if (only && !only.has(b.slug)) continue;
      if (!only && b.status === "done" && !args.force) continue;
      b.file = b.file || `${b.slug}.webp`;
      const artPath = path.join(artDir, `${b.key}.png`);
      try {
        await fs.access(artPath);
      } catch {
        continue;
      }
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
    console.error("Usage: node compose.mjs --art art.png --out cover.webp --title T --author A [--font key] [--mode dark|light]");
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
