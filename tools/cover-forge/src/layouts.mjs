// Layout templates. Each template returns { below, above } SVG layers:
//   below = drawn on top of the background / AI artwork
//   above = drawn after the artwork (used for photo scrims)
// Text is fitted first (see fonts.mjs) so templates only place what already fits.

import { svgText, svgLine, r2, range, int, hashText } from "./util.mjs";
import { fitText, measure } from "./fonts.mjs";
import { MOTIFS, motifIds } from "./motifs.mjs";

export const TEMPLATE_IDS = ["band", "classic", "arch", "split", "poster", "minimal", "side", "photo"];

const W = 800;
const H = 1200;
const M = 64; // safe margin

// Ascender factors: how much of the em box sits above the baseline. Devanagari
// needs extra headroom for matras, Fraunces/EB Garamond sit lower.
const ASC = { devanagari: 0.8, latin: 0.78 };

function helpers({ pal, fonts, rand, book }) {
  let clipSeq = 0;
  const isDev = fonts.language === "hi";
  const asc = isDev ? ASC.devanagari : ASC.latin;

  const text = (opts) => svgText(opts);

  const fit = (text_, font, opts) => fitText({ text: text_, font, safety: isDev ? 1.06 : 1.03, ...opts });

  const block = ({ item, font, x, top, align = "middle", fill, opacity = 1, tracking = 0 }) => {
    const out = [];
    item.lines.forEach((line, i) => {
      out.push(
        text({
          x,
          y: r2(top + item.size * asc + i * item.lh),
          size: item.size,
          family: font.family,
          weight: font.weight,
          fill,
          anchor: align,
          tracking,
          opacity,
          text: line,
        }),
      );
    });
    return out.join("");
  };

  const art = (x, y, w, h, motifId, opts = {}) => {
    const motif = MOTIFS[motifId] || MOTIFS.chakra;
    const id = `clip-${(clipSeq += 1)}`;
    const clip = opts.clip === false ? "" : `<clipPath id="${id}"><rect x="0" y="0" width="${r2(w)}" height="${r2(h)}"/></clipPath>`;
    const inner = motif({ w, h, pal, rand });
    return `<g transform="translate(${r2(x)} ${r2(y)})"${opts.clip === false ? "" : ` clip-path="url(#${id})"`}>${clip}${inner}</g>`;
  };

  const brand = ({ x, y, align = "middle", color, sub = "auto" }) => {
    const subText = sub === "auto" ? (isDev ? "सारांश" : "BOOK SUMMARIES") : sub;
    const parts = [
      text({ x, y, size: 21, family: fonts.label.family, weight: fonts.label.weight, fill: color, anchor: align, tracking: 6.2, text: "BOOKNOMICS" }),
    ];
    if (subText) {
      parts.push(text({ x, y: y + 34, size: 17, family: fonts.label.family, weight: fonts.label.weight, fill: color, anchor: align, tracking: 3.4, opacity: 0.72, text: subText }));
    }
    return parts.join("");
  };

  const label = ({ x, y, align = "middle", color, value }) => {
    const raw = value ?? book.category ?? (isDev ? "सारांश" : "Book summary");
    const txt = isDev ? raw : String(raw).toUpperCase();
    return text({ x, y, size: 22, family: fonts.label.family, weight: fonts.label.weight, fill: color, anchor: align, tracking: isDev ? 1.6 : 4.4, text: txt });
  };

  return { isDev, asc, text, fit, block, art, brand, label };
}

/** Prepare fitted text for a book. */
function prepareText(book, fonts, artMode) {
  const isDev = fonts.language === "hi";
  return {
    title: book.title,
    author: book.author || "",
    label: book.category || (isDev ? "सारांश" : "Summary"),
    brandSub: isDev ? "सारांश · HINDI BOOK SUMMARIES" : "BOOK SUMMARIES",
    artMode,
  };
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function gradientDefs(pal, id = "bg", angle = 160) {
  const rad = (angle * Math.PI) / 180;
  const x1 = r2(0.5 - Math.cos(rad) * 0.5);
  const y1 = r2(0.5 - Math.sin(rad) * 0.5);
  const x2 = r2(0.5 + Math.cos(rad) * 0.5);
  const y2 = r2(0.5 + Math.sin(rad) * 0.5);
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${pal.bg[0]}"/><stop offset="1" stop-color="${pal.bg[1]}"/></linearGradient>`;
}

function vignette(pal, opacity) {
  return `<radialGradient id="vig" cx="0.5" cy="0.42" r="0.78"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${opacity}"/></radialGradient>`;
}

function band(c, h) {
  const { pal, rand, fonts } = c;
  const t = {};
  t.title = h.fit(c.book.title, fonts.title, { maxWidth: 620, maxLines: 3, startSize: 108, minSize: 52, lineHeight: h.isDev ? 1.34 : 1.2 });
  t.author = h.fit(c.book.author || "", fonts.sub, { maxWidth: 560, maxLines: 2, startSize: 42, minSize: 24, lineHeight: 1.25 });
  const titleTop = 372;
  const artSize = 300;
  const body = [
    `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    h.art(W / 2 - artSize / 2, 108, artSize, artSize, c.motif),
    `<rect width="${W}" height="${H}" fill="url(#vig)"/>`,
    h.label({ x: W / 2, y: 74, color: pal.sub, value: t.label }),
    svgLine(W / 2 - 34, titleTop - 56, W / 2 + 34, titleTop - 56, pal.accent, 2.4, 0.9),
    h.block({ item: t.title, font: fonts.title, x: W / 2, top: titleTop, fill: pal.ink }),
    h.block({ item: t.author, font: fonts.sub, x: W / 2, top: titleTop + t.title.height + 42, fill: pal.sub }),
    h.brand({ x: W / 2, y: 1122, color: pal.sub }),
  ];
  void rand;
  return { below: `<defs>${gradientDefs(pal)}${vignette(pal, 0.35)}</defs>${body.join("")}`, above: "", fitted: t };
}

function classic(c, h) {
  const { pal, rand, fonts } = c;
  const t = {};
  t.title = h.fit(c.book.title, fonts.title, { maxWidth: 560, maxLines: 3, startSize: 96, minSize: 46, lineHeight: h.isDev ? 1.32 : 1.18 });
  t.author = h.fit(c.book.author || "", fonts.sub, { maxWidth: 520, maxLines: 2, startSize: 40, minSize: 24 });
  const titleTop = 700;
  const artH = 420;
  const body = [
    `<rect width="${W}" height="${H}" fill="${pal.bg[0]}"/>`,
    `<rect x="${M / 2}" y="${M / 2}" width="${W - M}" height="${H - M}" fill="${pal.bg[1]}" opacity="0.55"/>`,
    `<rect x="${M / 2}" y="${M / 2}" width="${W - M}" height="${H - M}" fill="none" stroke="${pal.accent}" stroke-width="2" opacity="0.75"/>`,
    `<rect x="${M / 2 + 12}" y="${M / 2 + 12}" width="${W - M - 24}" height="${H - M - 24}" fill="none" stroke="${pal.accent}" stroke-width="1" opacity="0.4"/>`,
    h.art(W / 2 - 260, 150, 520, artH, c.motif),
    h.label({ x: W / 2, y: 118, color: pal.sub, value: t.label }),
    h.block({ item: t.title, font: fonts.title, x: W / 2, top: titleTop, fill: pal.ink }),
    svgLine(300, titleTop + t.title.height + 26, 500, titleTop + t.title.height + 26, pal.accent, 1.6, 0.8),
    h.block({ item: t.author, font: fonts.sub, x: W / 2, top: titleTop + t.title.height + 52, fill: pal.sub }),
    h.brand({ x: W / 2, y: 1108, color: pal.sub }),
  ];
  void rand;
  return { below: `<defs>${gradientDefs(pal)}</defs>${body.join("")}`, above: "", fitted: t };
}

function arch(c, h) {
  const { pal, fonts } = c;
  const t = {};
  t.title = h.fit(c.book.title, fonts.title, { maxWidth: 600, maxLines: 3, startSize: 100, minSize: 46, lineHeight: h.isDev ? 1.32 : 1.18 });
  t.author = h.fit(c.book.author || "", fonts.sub, { maxWidth: 520, maxLines: 2, startSize: 40, minSize: 24 });
  const archW = 460;
  const archX = W / 2 - archW / 2;
  const archTop = 96;
  const archBottom = 560;
  const r = archW / 2;
  const titleTop = 660;
  const body = [
    `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    `<path d="M ${r2(archX)} ${archBottom} L ${r2(archX)} ${r2(archTop + r)} A ${r2(r)} ${r2(r)} 0 0 1 ${r2(archX + archW)} ${r2(archTop + r)} L ${r2(archX + archW)} ${archBottom} Z" fill="${pal.bg[0]}" opacity="0.55"/>`,
    h.art(archX + 20, archTop + 20, archW - 40, archBottom - archTop - 20, c.motif),
    `<path d="M ${r2(archX)} ${archBottom} L ${r2(archX)} ${r2(archTop + r)} A ${r2(r)} ${r2(r)} 0 0 1 ${r2(archX + archW)} ${r2(archTop + r)} L ${r2(archX + archW)} ${archBottom}" fill="none" stroke="${pal.accent}" stroke-width="3" opacity="0.9"/>`,
    `<path d="M ${r2(archX + 16)} ${archBottom} L ${r2(archX + 16)} ${r2(archTop + r)} A ${r2(r - 16)} ${r2(r - 16)} 0 0 1 ${r2(archX + archW - 16)} ${r2(archTop + r)} L ${r2(archX + archW - 16)} ${archBottom}" fill="none" stroke="${pal.accent}" stroke-width="1" opacity="0.45"/>`,
    svgLine(archX - 40, archBottom, archX + archW + 40, archBottom, pal.accent, 2, 0.8),
    h.label({ x: W / 2, y: 74, color: pal.sub, value: t.label }),
    h.block({ item: t.title, font: fonts.title, x: W / 2, top: titleTop, fill: pal.ink }),
    h.block({ item: t.author, font: fonts.sub, x: W / 2, top: titleTop + t.title.height + 40, fill: pal.sub }),
    h.brand({ x: W / 2, y: 1122, color: pal.sub }),
  ];
  return { below: `<defs>${gradientDefs(pal)}${vignette(pal, 0.3)}</defs>${body.join("")}`, above: "", fitted: t };
}

function split(c, h) {
  const { pal, fonts } = c;
  const t = {};
  t.title = h.fit(c.book.title, fonts.title, { maxWidth: 600, maxLines: 3, startSize: 88, minSize: 44, lineHeight: h.isDev ? 1.32 : 1.18 });
  t.author = h.fit(c.book.author || "", fonts.sub, { maxWidth: 520, maxLines: 2, startSize: 38, minSize: 24 });
  const bandTop = 430;
  const bandH = Math.max(230, t.title.height + 96);
  const titleTop = bandTop + (bandH - t.title.height) / 2;
  const body = [
    `<rect width="${W}" height="${H}" fill="${pal.bg[0]}"/>`,
    h.art(60, 30, 680, 360, c.motif),
    `<rect x="0" y="${r2(bandTop)}" width="${W}" height="${r2(bandH)}" fill="url(#bandGrad)"/>`,
    svgLine(0, bandTop, W, bandTop, pal.accent, 3, 0.9),
    svgLine(0, bandTop + bandH, W, bandTop + bandH, pal.accent, 1.4, 0.6),
    h.label({ x: W / 2, y: 74, color: pal.sub, value: t.label }),
    h.block({ item: t.title, font: fonts.title, x: W / 2, top: titleTop, fill: pal.ink }),
    h.block({ item: t.author, font: fonts.sub, x: W / 2, top: bandTop + bandH + 70, fill: pal.sub }),
    h.brand({ x: W / 2, y: 1122, color: pal.sub }),
  ];
  // The band is a gradient rather than a flat fill: on the grey palettes a flat
  // slab read as a placeholder box instead of part of the cover.
  const bandGrad =
    `<linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${pal.bg[1]}" stop-opacity="0.9"/>` +
    `<stop offset="0.55" stop-color="${pal.bg[1]}" stop-opacity="0.62"/>` +
    `<stop offset="1" stop-color="${pal.bg[1]}" stop-opacity="0.28"/></linearGradient>`;
  return { below: `<defs>${gradientDefs(pal, "bg", 175)}${bandGrad}</defs>${body.join("")}`, above: "", fitted: t };
}

function poster(c, h) {
  const { pal, rand, fonts } = c;
  const t = {};
  t.title = h.fit(c.book.title, fonts.title, { maxWidth: 620, maxLines: 3, startSize: 104, minSize: 48, lineHeight: h.isDev ? 1.32 : 1.18 });
  t.author = h.fit(c.book.author || "", fonts.sub, { maxWidth: 520, maxLines: 2, startSize: 38, minSize: 24 });
  const titleTop = 780;
  const scale = range(rand, 1.25, 1.6);
  const artW = W * scale;
  const artH = 820 * scale;
  const body = [
    `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    h.art(W / 2 - artW / 2, -60, artW, artH, c.motif, { clip: false }),
    `<rect width="${W}" height="${H}" fill="url(#scrim)"/>`,
    `<rect width="${W}" height="${H}" fill="url(#vig)"/>`,
    h.block({ item: t.title, font: fonts.title, x: W / 2, top: titleTop, fill: pal.ink }),
    svgLine(W / 2 - 30, titleTop + t.title.height + 34, W / 2 + 30, titleTop + t.title.height + 34, pal.accent, 2, 0.9),
    h.block({ item: t.author, font: fonts.sub, x: W / 2, top: titleTop + t.title.height + 62, fill: pal.sub }),
    h.label({ x: W / 2, y: 74, color: pal.sub, value: t.label }),
    h.brand({ x: W / 2, y: 1150, color: pal.sub }),
  ];
  const scrim = `<linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0.42" stop-color="${pal.bg[0]}" stop-opacity="0"/><stop offset="0.72" stop-color="${pal.bg[0]}" stop-opacity="0.86"/><stop offset="1" stop-color="${pal.bg[0]}" stop-opacity="0.97"/></linearGradient>`;
  return { below: `<defs>${gradientDefs(pal, "bg", 200)}${scrim}${vignette(pal, 0.4)}</defs>${body.join("")}`, above: "", fitted: t };
}

function minimal(c, h) {
  const { pal, fonts } = c;
  const t = {};
  t.title = h.fit(c.book.title, fonts.title, { maxWidth: 580, maxLines: 4, startSize: 92, minSize: 44, lineHeight: h.isDev ? 1.34 : 1.2 });
  t.author = h.fit(c.book.author || "", fonts.sub, { maxWidth: 520, maxLines: 2, startSize: 38, minSize: 24 });
  const titleTop = 520;
  const body = [
    `<rect width="${W}" height="${H}" fill="${pal.bg[0]}"/>`,
    `<rect width="${W}" height="${H}" fill="url(#bg)" opacity="0.75"/>`,
    `<rect x="42" y="42" width="${W - 84}" height="${H - 84}" fill="none" stroke="${pal.accent}" stroke-width="1.2" opacity="0.5"/>`,
    h.art(W / 2 - 130, 110, 260, 260, c.motif),
    svgLine(120, titleTop - 60, W - 120, titleTop - 60, pal.accent, 1, 0.45),
    h.block({ item: t.title, font: fonts.title, x: W / 2, top: titleTop, fill: pal.ink }),
    h.block({ item: t.author, font: fonts.sub, x: W / 2, top: titleTop + t.title.height + 44, fill: pal.sub }),
    h.brand({ x: W / 2, y: 1100, color: pal.sub }),
  ];
  return { below: `<defs>${gradientDefs(pal, "bg", 200)}</defs>${body.join("")}`, above: "", fitted: t };
}

function side(c, h) {
  const { pal, fonts } = c;
  const left = 120;
  const t = {};
  t.title = h.fit(c.book.title, fonts.title, { maxWidth: 560, maxLines: 3, startSize: 92, minSize: 44, lineHeight: h.isDev ? 1.32 : 1.18 });
  t.author = h.fit(c.book.author || "", fonts.sub, { maxWidth: 520, maxLines: 2, startSize: 38, minSize: 24 });
  const titleTop = 560;
  const body = [
    `<rect width="${W}" height="${H}" fill="${pal.bg[0]}"/>`,
    `<rect width="72" height="${H}" fill="url(#bg)"/>`,
    `<rect x="72" y="0" width="2" height="${H}" fill="${pal.accent}" opacity="0.55"/>`,
    h.art(360, 110, 360, 360, c.motif),
    h.label({ x: left, y: 74, align: "start", color: pal.sub, value: t.label }),
    svgLine(left, titleTop - 58, left + 72, titleTop - 58, pal.accent, 3, 0.9),
    h.block({ item: t.title, font: fonts.title, x: left, top: titleTop, align: "start", fill: pal.ink }),
    h.block({ item: t.author, font: fonts.sub, x: left, top: titleTop + t.title.height + 40, align: "start", fill: pal.sub }),
    h.brand({ x: left, y: 1122, align: "start", color: pal.sub }),
  ];
  return { below: `<defs>${gradientDefs(pal)}</defs>${body.join("")}`, above: "", fitted: t };
}

function photo(c, h) {
  const { pal, fonts } = c;
  const t = {};
  t.title = h.fit(c.book.title, fonts.title, { maxWidth: 620, maxLines: 3, startSize: 96, minSize: 44, lineHeight: h.isDev ? 1.32 : 1.18 });
  t.author = h.fit(c.book.author || "", fonts.sub, { maxWidth: 520, maxLines: 2, startSize: 38, minSize: 24 });
  const titleTop = 760;
  const scrimTop = `<linearGradient id="scrimTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>`;
  const scrimBottom = `<linearGradient id="scrimBottom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.35" stop-color="#000" stop-opacity="0.62"/><stop offset="1" stop-color="#000" stop-opacity="0.92"/></linearGradient>`;
  const body = [
    h.label({ x: 48, y: 66, align: "start", color: "#ffffff", value: t.label }),
    svgLine(W / 2 - 30, titleTop - 48, W / 2 + 30, titleTop - 48, pal.accent, 2.4, 0.95),
    h.block({ item: t.title, font: fonts.title, x: W / 2, top: titleTop, fill: "#ffffff" }),
    h.block({ item: t.author, font: fonts.sub, x: W / 2, top: titleTop + t.title.height + 44, fill: "#f5f5f4", opacity: 0.92 }),
    h.brand({ x: W / 2, y: 1122, color: "#e7e5e4" }),
  ];
  const above = `<defs>${scrimTop}${scrimBottom}</defs><rect width="${W}" height="260" fill="url(#scrimTop)"/><rect y="${H - 560}" width="${W}" height="560" fill="url(#scrimBottom)"/>${body.join("")}`;
  return { below: "", above, fitted: t };
}

const TEMPLATES = { band, classic, arch, split, poster, minimal, side, photo };

export function composeCover({ book, palette, motifId, templateId, fonts, seed }) {
  const rand = seeded(seed);
  const h = helpers({ pal: palette, fonts, rand, book });
  const template = TEMPLATES[templateId] || band;
  const layers = template({ book, pal: palette, rand, motif: motifId, fonts }, h);
  const lines = (key) => {
    const item = layers.fitted?.[key];
    return item && Array.isArray(item.lines) ? item.lines.filter((l) => l && l.trim()) : [];
  };
  const svg = `${layers.below}${layers.above || ""}`;
  return {
    ...layers,
    templateId,
    motifId,
    paletteId: palette.id,
    text: {
      titleLines: lines("title"),
      authorLines: lines("author"),
      titleSize: layers.fitted?.title?.size ?? null,
      titleBox: layers.fitted?.title?.box ?? null,
      titleSaturated: Boolean(layers.fitted?.title?.saturated),
      titleMeasured: layers.fitted?.title?.measured ?? [],
      // Guard against the "empty <text/>" class of bug: check.mjs fails when
      // the title is not actually present in the rendered SVG.
      titleRendered: svg.includes(`>${escapeForCompare(lines("title")[0] || "")}<`) || svg.includes(`>${escapeForCompare(lines("title")[0] || "")}`),
      svgBytes: svg.length,
    },
  };
}

// Minimal version of the SVG escaper used in util.esc, for the guard above.
function escapeForCompare(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Motifs cycle with the book's index too, so neighbours are never the same
 * drawing. The step is 7 (coprime with the 20-motif cycle) and the palette
 * cycle advances by 1, which decorrelates the two: a (palette, template) pair
 * that comes back around lands on a different motif instead of repeating the
 * whole cover.
 */
export function chooseMotif(index, key = "") {
  const ids = motifIds();
  return ids[(Number(index) * 7 + hashText(key)) % ids.length];
}

/**
 * Templates are cycled by a book's position in the source list instead of being
 * drawn at random: random draw clumps (16 covers in a row hitting the same
 * template reads as a bug), cycling spreads them evenly and keeps neighbouring
 * covers in a browse grid visually distinct. The palette contributes a stable
 * offset so two palettes do not march in lockstep.
 */
export function chooseTemplate(index, palette, artAvailable) {
  const base = palette.templates?.length ? palette.templates : TEMPLATE_IDS;
  const list = artAvailable ? [...base, "photo", "photo"] : base;
  const offset = hashText(palette.id) % list.length;
  return list[(Number(index) + offset) % list.length];
}

function seeded(seed) {
  // Local copy of mulberry32; kept here so layouts only depend on util's hash.
  let a = (seed ^ 0x2545f491) >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const COVER = { W, H, M };
export { measure, int, range, hashText };
