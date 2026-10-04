#!/usr/bin/env node
// Cover Forge — batch cover generator.
//
//   node generate.mjs --drafts ../../content-drafts --out out --limit 24
//   node generate.mjs --from-db --out out --all --concurrency 6
//   node generate.mjs --books books.json --art-dir ai-art --out out
//
// Output: <out>/<slug>.jpg (800x1200, progressive JPEG) + <out>/manifest.json

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { renderCover } from "./src/render.mjs";
import { loadBooks } from "./src/books.mjs";
import { fontSetFor } from "./src/fonts.mjs";
import { paletteIds, getPalette } from "./src/palettes.mjs";
import { TEMPLATE_IDS } from "./src/layouts.mjs";
import { motifIds } from "./src/motifs.mjs";

const { values: args } = parseArgs({
  options: {
    drafts: { type: "string" },
    books: { type: "string" },
    "from-db": { type: "boolean", default: false },
    out: { type: "string", default: "covers" },
    limit: { type: "string" },
    offset: { type: "string", default: "0" },
    only: { type: "string" },
    all: { type: "boolean", default: false },
    concurrency: { type: "string", default: "4" },
    template: { type: "string" },
    palette: { type: "string" },
    motif: { type: "string" },
    seed: { type: "string", default: "0" },
    "art-dir": { type: "string" },
    "art-position": { type: "string" },
    quality: { type: "string", default: "88" },
    "no-grain": { type: "boolean", default: false },
    resume: { type: "boolean", default: false },
    "emit-prompts": { type: "string" },
    "emit-svg": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

if (args.help) {
  console.log(`Cover Forge

Usage: node generate.mjs [options]

  --drafts <dir>        read book metadata from content-drafts/*.txt
  --books <file>        read a JSON array or CSV of books
  --from-db             read the books table via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
  --out <dir>           output directory (default: covers)
  --limit <n>           generate at most n covers
  --offset <n>          skip the first n books (sharding)
  --only <slugs>        comma-separated slug filter
  --all                 ignore --limit (used with --from-db)
  --concurrency <n>     parallel renders (default 4)
  --template <id>       force a template: ${TEMPLATE_IDS.join(", ")}
  --palette <id>        force a palette: ${paletteIds().join(", ")}
  --motif <id>          force a motif: ${motifIds().join(", ")}
  --seed <n>            shift every seed (regenerate a fresh set)
  --art-dir <dir>       per-book AI artwork, <slug>.jpg|png|webp -> photo template
  --quality <n>         JPEG quality (default 88)
  --no-grain            disable the paper-grain overlay
  --resume              skip books whose output file already exists
  --emit-prompts <file> write image-model prompts (AI artwork track)
  --emit-svg            also write <slug>.svg next to each cover (debugging)
  --dry-run             list what would be generated, render nothing
  --help                show this help
`);
  process.exit(0);
}

const outDir = path.resolve(args.out);
const limit = args.limit ? Number(args.limit) : args.all ? 0 : 24;
const offset = Number(args.offset || 0);
const concurrency = Math.max(1, Math.min(16, Number(args.concurrency)));
const only = args.only ? new Set(args.only.split(",").map((s) => s.trim()).filter(Boolean)) : null;

if (args.palette && !getPalette(args.palette)) {
  console.error(`Unknown palette "${args.palette}". Available: ${paletteIds().join(", ")}`);
  process.exit(2);
}
if (args.template && !TEMPLATE_IDS.includes(args.template)) {
  console.error(`Unknown template "${args.template}". Available: ${TEMPLATE_IDS.join(", ")}`);
  process.exit(2);
}

const books = await loadBooks({
  drafts: args.drafts,
  books: args.books,
  fromDb: args["from-db"],
  limit,
  all: args.all,
});

// Stable position in the full source list: drives the template cycle so runs
// are reproducible and sharded batches stay consistent with a full run.
const indexOf = new Map(books.map((b, i) => [b.slug, i]));
let queue = books.slice(offset);
if (only) queue = queue.filter((b) => only.has(b.slug));
if (!args.all && limit) queue = queue.slice(0, limit);

if (!queue.length) {
  console.error("No books matched.");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

if (args["emit-prompts"]) {
  const prompts = queue.map((b) => ({
    slug: b.slug,
    prompt: artPrompt(b),
  }));
  fs.writeFileSync(path.resolve(args["emit-prompts"]), JSON.stringify(prompts, null, 2));
  console.log(`Wrote ${prompts.length} artwork prompts -> ${args["emit-prompts"]}`);
}

if (args["dry-run"]) {
  for (const b of queue) console.log(`${b.slug}\t${b.title}\t${b.author}\t${b.category || "-"}\t${b.language}`);
  console.log(`\n${queue.length} book(s) — dry run, nothing rendered.`);
  process.exit(0);
}

const fontsCache = new Map();
const items = [];
const failures = [];
let done = 0;
const startedAt = Date.now();

async function worker(list, index) {
  for (let i = index; i < list.length; i += concurrency) {
    const book = list[i];
    const file = path.join(outDir, `${book.slug}.jpg`);
    if (args.resume && fs.existsSync(file)) {
      done += 1;
      continue;
    }
    try {
      const lang = (book.language || "Hindi").toLowerCase().startsWith("hi") ? "hi" : "en";
      if (!fontsCache.has(lang)) fontsCache.set(lang, fontSetFor(book.language));
      const { buffer, svg, meta, warnings } = await renderCover(book, {
        fonts: fontsCache.get(lang),
        index: indexOf.get(book.slug) ?? 0,
        template: args.template,
        palette: args.palette,
        motif: args.motif,
        seed: args.seed,
        artDir: args["art-dir"],
        artPosition: args["art-position"],
        quality: Number(args.quality),
        grain: !args["no-grain"],
      });
      fs.writeFileSync(file, buffer);
      if (args["emit-svg"]) fs.writeFileSync(path.join(outDir, `${book.slug}.svg`), svg);
      items.push({ slug: book.slug, title: book.title, author: book.author, category: book.category || "", language: book.language || "", file: path.basename(file), ...meta });
      for (const w of warnings) console.warn(`  ! ${book.slug}: ${w}`);
      done += 1;
      if (done % 25 === 0 || done === queue.length) {
        const rate = done / ((Date.now() - startedAt) / 1000);
        console.log(`  ${done}/${queue.length} covers (${rate.toFixed(1)}/s)`);
      }
    } catch (err) {
      failures.push({ slug: book.slug, error: String(err && err.message ? err.message : err) });
      console.error(`  x ${book.slug}: ${err.message}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, (_, i) => worker(queue, i)));

// A partial run (--limit / --offset / --only / --resume) merges into the
// existing manifest instead of replacing it: sharded batches and top-ups must
// not silently drop the covers an earlier run recorded.
const partial = Boolean(args.limit || Number(args.offset) > 0 || args.only || args.resume);
const manifestPath = path.join(outDir, "manifest.json");
const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : null;
const merged = new Map();
if (partial && previous?.books?.length) for (const b of previous.books) merged.set(b.slug, b);
for (const b of items) merged.set(b.slug, b);
const manifestBooks = [...merged.values()].sort((a, b) => a.slug.localeCompare(b.slug));

const manifest = {
  generatedAt: new Date().toISOString(),
  count: manifestBooks.length,
  generatedThisRun: items.length,
  mergedFromPreviousManifest: Boolean(partial && previous?.books?.length),
  failures,
  books: manifestBooks,
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const totalBytes = items.reduce((sum, i) => sum + i.bytes, 0);
console.log(
  `\nDone: ${items.length} cover(s) this run, ${manifest.count} in the manifest, ${failures.length} failure(s), ` +
    `${(totalBytes / 1024 / 1024).toFixed(1)} MB written, ${((Date.now() - startedAt) / 1000).toFixed(1)}s` +
    `${manifest.mergedFromPreviousManifest ? " (merged with the previous manifest)" : ""}\nManifest: ${manifestPath}`,
);

function artPrompt(book) {
  const lang = (book.language || "Hindi").toLowerCase().startsWith("hi") ? "Hindi" : "English";
  return [
    `Vertical 2:3 fine-art book-cover illustration for the ${lang} book "${book.title}" by ${book.author}`,
    book.category ? `(category: ${book.category}).` : ".",
    "Mood: literary, timeless, editorial. Composition: single strong symbolic subject, generous negative space,",
    "calm empty area in the lower third for typography, subtle paper texture, dramatic but soft light.",
    "Absolutely no text, no letters, no words, no numbers, no logos, no watermark, no book mockup.",
    "Colour palette: muted, two or three colours, print-like. High detail, 2K, matte finish.",
  ].join(" ");
}
