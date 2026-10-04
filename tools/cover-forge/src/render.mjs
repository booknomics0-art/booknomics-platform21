// Rasterise a composed cover to an 800x1200 progressive JPEG.

import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { COVER, chooseMotif, chooseTemplate, composeCover } from "./layouts.mjs";
import { hashText, rng } from "./util.mjs";
import { paletteFor, getPalette } from "./palettes.mjs";
import { fontFiles, missingGlyphs } from "./fonts.mjs";

const SS = 2; // supersample factor: render 1600x2400, then downscale to 800x1200
const ART_EXT = [".jpg", ".jpeg", ".png", ".webp", ".avif"];

let noiseCache = null;

async function grainBuffer(width, height) {
  if (noiseCache) return noiseCache;
  const noise = await sharp({
    create: { width, height, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 22 } },
  })
    .greyscale()
    .ensureAlpha(0.055)
    .png()
    .toBuffer();
  noiseCache = noise;
  return noise;
}

export function findArt(artDir, slug) {
  if (!artDir) return null;
  for (const ext of ART_EXT) {
    const p = path.join(artDir, `${slug}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function wrapSvg(layers) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER.W * SS}" height="${COVER.H * SS}" viewBox="0 0 ${COVER.W} ${COVER.H}">${layers}</svg>`;
}

function rasterise(layers, fonts) {
  if (!layers) return null;
  const resvg = new Resvg(wrapSvg(layers), {
    font: {
      fontFiles: fontFiles(fonts),
      loadSystemFonts: false,
      defaultFontFamily: fonts.title.family,
    },
    background: "rgba(0,0,0,0)",
  });
  return resvg.render().asPng();
}

/**
 * Render one cover.
 * @returns {Promise<{ buffer: Buffer, svg: string, meta: object, warnings: string[] }>}
 */
export async function renderCover(book, opts = {}) {
  const seedBase = opts.seed ? Number(opts.seed) : 0;
  const seed = (hashText(`${book.slug}|${book.title}|${book.author || ""}`) ^ seedBase) >>> 0;
  const rand = rng(seed);

  const index = opts.index ?? 0;
  const palette = opts.palette ? getPalette(opts.palette) : paletteFor(book, index);
  if (!palette) throw new Error(`Unknown palette: ${opts.palette}`);

  const artPath = opts.artPath || findArt(opts.artDir, book.slug);
  const templateId = opts.template || chooseTemplate(index, palette, Boolean(artPath));
  const motifId = opts.motif || chooseMotif(index, book.slug || book.title);

  const { below, above, ...meta } = composeCover({
    book,
    palette,
    motifId,
    templateId,
    fonts: opts.fonts,
    seed,
  });

  const warnings = [];
  for (const [what, value] of [["title", book.title], ["author", book.author || ""]]) {
    const missing = missingGlyphs(value, opts.fonts.title);
    if (missing.length) warnings.push(`${what} uses glyphs missing from the font: ${missing.join(" ")}`);
  }

  // Base canvas: AI artwork when available, transparent otherwise.
  // Everything is composited at the supersampled size first (sharp resizes
  // before it composites, so layers must match the canvas at each step).
  const width = COVER.W * SS;
  const height = COVER.H * SS;
  const basePng = artPath
    ? await sharp(artPath).resize(width, height, { fit: "cover", position: opts.artPosition || "attention" }).toColorspace("srgb").png().toBuffer()
    : await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();

  const composites = [];
  for (const layer of [below, above]) {
    const png = rasterise(layer, opts.fonts);
    if (png) composites.push({ input: png, blend: "over" });
  }
  if (!composites.length) throw new Error("nothing to draw — template produced no layers");

  const composed = await sharp(basePng).composite(composites).png().toBuffer();
  const downscaled = await sharp(composed).resize(COVER.W, COVER.H, { fit: "fill" }).toBuffer();

  let pipeline = sharp(downscaled);
  if (opts.grain !== false) {
    pipeline = pipeline.composite([{ input: await grainBuffer(COVER.W, COVER.H), blend: "overlay" }]);
  }

  const buffer = await pipeline
    .jpeg({ quality: opts.quality ?? 88, progressive: true, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();

  return {
    buffer,
    svg: wrapSvg(`${below}${above || ""}`),
    meta: {
      ...meta,
      templateId,
      motifId,
      palette: palette.id,
      art: artPath ? path.basename(artPath) : null,
      width: COVER.W,
      height: COVER.H,
      bytes: buffer.length,
      seed,
    },
    warnings,
  };
}
