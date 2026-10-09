#!/usr/bin/env node
// Quality gate for generated covers.
//
//   node check.mjs --out covers [--drafts ../../content-drafts]
//
// Verifies: 800x1200 JPEG, progressive, < 300 KB, not blank, no missing
// glyphs for the rendered title/author, no duplicate images, and reports the
// template / palette distribution. Exits non-zero when a hard check fails.

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { fontSetFor, fontFiles, missingGlyphs } from "./src/fonts.mjs";
import { loadBooks } from "./src/books.mjs";

const { values: args } = parseArgs({
  options: {
    out: { type: "string", default: "covers" },
    books: { type: "string" },
    drafts: { type: "string" },
    max: { type: "string", default: "300" }, // KB
    concurrency: { type: "string", default: "6" },
    deep: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
  },
});

const outDir = path.resolve(args.out);
const manifestPath = path.join(outDir, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`No manifest at ${manifestPath}. Run generate.mjs first.`);
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const maxBytes = Number(args.max) * 1024;

const failures = [];
const warnings = [];
const fontsByLang = new Map();
const fingerprint = [];
const stats = { templates: {}, palettes: {}, bytes: [] };
let inkChecks = 0;
const concurrency = Math.max(1, Number(args.concurrency));

/** Measure the real ink width of a rendered line (not the advance-width estimate). */
function inkWidth(line, size, font, fontSet) {
  const pad = Math.ceil(size * 1.6);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pad * 2 + 3000}" height="${pad * 3}" viewBox="${-pad} ${-pad * 2} ${pad * 2 + 3000} ${pad * 3}">` +
    `<rect x="${-pad}" y="${-pad * 2}" width="${pad * 2 + 3000}" height="${pad * 3}" fill="#000"/>` +
    `<text x="0" y="0" font-family="${font.family}" font-size="${size}" font-weight="${font.weight}" fill="#fff" xml:space="preserve" text-anchor="start">${line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</text></svg>`;
  const resvg = new Resvg(svg, {
    font: { fontFiles: fontFiles(fontSet), loadSystemFonts: false, defaultFontFamily: font.family },
    background: "rgba(0,0,0,1)",
  });
  return { png: resvg.render().asPng(), pad };
}

/** Ink bounding box of a rendered text strip, measured on raw pixels. */
async function inkBox(png) {
  const raw = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = raw.info;
  const data = raw.data;
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (data[row + x] <= 40) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function measureInk(item, fonts) {
  const lines = item.text?.titleMeasured || [];
  if (!lines.length || !item.text?.titleBox) return null;
  let widest = 0;
  for (const line of lines) {
    const { png } = inkWidth(line.text, item.text.titleSize, fonts.title, fonts);
    const box = await inkBox(png);
    if (!box) return null; // nothing drawn — handled elsewhere
    widest = Math.max(widest, box.width);
  }
  return { widest, box: item.text.titleBox };
}

async function checkOne(item) {
  const file = path.join(outDir, item.file);
  if (!fs.existsSync(file)) {
    failures.push(`${item.slug}: missing file ${item.file}`);
    return;
  }
  const bytes = fs.statSync(file).size;
  stats.bytes.push(bytes);
  if (bytes > maxBytes) failures.push(`${item.slug}: ${(bytes / 1024).toFixed(0)} KB > ${args.max} KB`);

  const meta = await sharp(file).metadata();
  if (meta.format !== "jpeg") failures.push(`${item.slug}: format ${meta.format}`);
  if (meta.width !== 800 || meta.height !== 1200) failures.push(`${item.slug}: ${meta.width}x${meta.height} != 800x1200`);
  if (!meta.isProgressive) warnings.push(`${item.slug}: not progressive`);

  const { channels } = await sharp(file).greyscale().stats();
  const stdev = channels[0].stdev;
  if (stdev < 8) failures.push(`${item.slug}: image looks blank (stdev ${stdev.toFixed(1)})`);

  // Regression guard: the first version of this tool emitted empty <text/>
  // nodes, so the covers shipped with no title at all. Fail loudly if the
  // manifest does not prove the title reached the SVG.
  const rendered = item.text || {};
  if (!rendered.titleLines?.length) failures.push(`${item.slug}: no title text in the manifest (empty-text regression)`);
  else if (rendered.titleRendered === false) failures.push(`${item.slug}: title "${rendered.titleLines[0]}" was not found in the rendered SVG`);
  if (item.author && !rendered.authorLines?.length) warnings.push(`${item.slug}: author text missing`);

  const lang = (item.language || "Hindi").toLowerCase().startsWith("hi") ? "hi" : "en";
  if (!fontsByLang.has(lang)) fontsByLang.set(lang, fontSetFor(item.language));
  const fonts = fontsByLang.get(lang);
  for (const [what, value] of [["title", item.title], ["author", item.author]]) {
    const missing = missingGlyphs(value || "", fonts.title);
    if (missing.length) failures.push(`${item.slug}: ${what} has glyphs missing from the font: ${missing.join(" ")}`);
  }

  // Perceptual fingerprint: 16x16 greyscale thumbnail. Two covers that differ
  // only in their typography still land within a couple of grey levels of each
  // other, which is exactly the duplication we want flagged.
  const thumb = await sharp(file).resize(16, 16, { fit: "fill" }).greyscale().raw().toBuffer();
  fingerprint.push({ slug: item.slug, palette: item.palette, template: item.templateId, motif: item.motifId, thumb });

  if (args.deep) {
    const ink = await measureInk(item, fonts);
    if (ink && ink.widest > ink.box * 1.02) {
      failures.push(`${item.slug}: title ink ${ink.widest}px overflows its ${ink.box}px box (real rendering is wider than the estimate)`);
    }
    inkChecks += ink ? 1 : 0;
  }
  if (item.text?.titleSaturated) warnings.push(`${item.slug}: title hit the minimum font size and still wrapped`);

  stats.templates[item.templateId] = (stats.templates[item.templateId] || 0) + 1;
  stats.palettes[item.palette] = (stats.palettes[item.palette] || 0) + 1;
}

let cursor = 0;
await Promise.all(
  Array.from({ length: Math.min(concurrency, manifest.books.length) }, async () => {
    while (cursor < manifest.books.length) {
      const item = manifest.books[cursor];
      cursor += 1;
      await checkOne(item);
    }
  }),
);

// Near-duplicate detection across the whole batch.
const MAD_LIMIT = 1.5; // mean absolute grey-level difference (16x16 fingerprint)
for (let i = 0; i < fingerprint.length; i += 1) {
  for (let j = i + 1; j < fingerprint.length; j += 1) {
    const a = fingerprint[i];
    const b = fingerprint[j];
    let sum = 0;
    for (let k = 0; k < a.thumb.length; k += 1) sum += Math.abs(a.thumb[k] - b.thumb[k]);
    const mad = sum / a.thumb.length;
    if (mad <= MAD_LIMIT) {
      warnings.push(`${a.slug}: near-identical to ${b.slug} (mad ${mad.toFixed(2)}, ${a.palette}/${a.template}/${a.motif})`);
    }
  }
}

// Coverage against the source list, when one is provided.
let coverage = null;
if (args.drafts || args.books) {
  const books = await loadBooks({ drafts: args.drafts, books: args.books, limit: 0 });
  const have = new Map(manifest.books.map((b) => [b.slug, b]));
  const missing = books.filter((b) => !have.has(b.slug)).map((b) => b.slug);
  coverage = { total: books.length, generated: books.length - missing.length, missing: missing.slice(0, 40), missingCount: missing.length };

  // The cover must carry the same title the catalog has.
  const norm = (v) => String(v || "").replace(/[\s\u200c\u200d.,'\"|\u0964]/g, "");
  for (const book of books) {
    const item = have.get(book.slug);
    if (!item?.text?.titleLines?.length) continue;
    const renderedTitle = item.text.titleLines.join(" ");
    const a = norm(renderedTitle);
    const b = norm(book.title);
    if (!a.length || !b.length) continue;
    const head = Math.min(4, b.length);
    if (!a.includes(b.slice(0, head)) && !b.includes(a.slice(0, head))) {
      failures.push(`${item.slug}: cover title "${renderedTitle}" does not match catalog title "${book.title}"`);
    }
  }
}

const avgBytes = stats.bytes.reduce((s, v) => s + v, 0) / (stats.bytes.length || 1);
const report = {
  checkedAt: new Date().toISOString(),
  covers: manifest.books.length,
  failures,
  warnings,
  avgBytes: Math.round(avgBytes),
  maxBytes: Math.max(...stats.bytes, 0),
  templates: stats.templates,
  palettes: stats.palettes,
  deepInkChecks: args.deep ? inkChecks : 0,
  coverage,
};

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Cover Forge check — ${report.covers} cover(s)`);
  console.log(`  size: avg ${(avgBytes / 1024).toFixed(0)} KB, max ${(report.maxBytes / 1024).toFixed(0)} KB (limit ${args.max} KB)`);
  console.log(`  templates: ${Object.entries(stats.templates).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  console.log(`  palettes: ${Object.entries(stats.palettes).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  if (args.deep) console.log(`  deep ink checks: ${inkChecks} cover(s) measured against their text box`);
  if (coverage) console.log(`  coverage: ${coverage.generated}/${coverage.total}${coverage.missingCount ? ` (missing ${coverage.missingCount})` : ""}`);
  for (const w of warnings) console.log(`  warn  ${w}`);
  for (const f of failures) console.log(`  FAIL  ${f}`);
  console.log(failures.length ? `\n${failures.length} failure(s).` : "\nAll hard checks passed.");
}

process.exit(failures.length ? 1 : 0);
