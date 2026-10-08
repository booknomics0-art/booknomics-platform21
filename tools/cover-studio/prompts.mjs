#!/usr/bin/env node
// Builds the text-free artwork prompt for each manifest entry, so every batch uses the same recipe.
//   node prompts.mjs                 → next 10 pending books as JSON lines {key, slug, title, art, prompt}
//   node prompts.mjs --limit 25      → next 25
//   node prompts.mjs --key godan     → one specific entry (pending or not)
//   node prompts.mjs --stats         → done / pending counts
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MANIFEST = path.join(HERE, "../../content-drafts/covers/hindi/manifest.json");
export const ART_DIR = path.join(process.env.HOME || "/tmp", ".cache/cover-art");

/** @param {{concept:string, palette:string, mode?:string, style?:string}} b */
export function buildPrompt(b) {
  const light = b.mode === "light";
  const opening =
    b.style === "pulp"
      ? "Vertical 2:3 portrait painting, artwork only, no typography. Classic Indian pulp-thriller cover painting with moody noir lighting; danger is implied, never gory."
      : "Vertical 2:3 portrait painting, artwork only, no typography.";
  const finish =
    b.style === "pulp"
      ? "Painterly, cinematic and richly textured, high contrast."
      : "Painterly, cinematic and richly textured, emotionally resonant light.";
  const top = light
    ? "Keep the top third pale, calm and uncluttered — soft light sky or plain light background — for a title added later."
    : "Keep the top third calm, dark and uncluttered — soft sky or shadowed background — for a title added later.";
  return [
    opening,
    b.concept,
    `Palette: ${b.palette}${light ? " — a light, airy painting" : ""}.`,
    finish,
    top,
    "The background must continue naturally to the top edge: no flat colour block, frame or hard horizontal edge.",
    "No text, letters, numbers, logos, signature or watermark.",
  ].join(" ");
}

export async function loadManifest(p = DEFAULT_MANIFEST) {
  return JSON.parse(await fs.readFile(p, "utf8"));
}

async function main() {
  const argv = process.argv.slice(2);
  const get = (k) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const manifestPath = path.resolve(get("--manifest") || DEFAULT_MANIFEST);
  const m = await loadManifest(manifestPath);
  if (argv.includes("--stats")) {
    const done = m.books.filter((b) => b.status === "done").length;
    console.log(`${done} done, ${m.books.length - done} pending, ${m.books.length} total`);
    return;
  }
  const key = get("--key");
  const limit = Number(get("--limit") || 10);
  const list = key ? m.books.filter((b) => b.key === key) : m.books.filter((b) => b.status !== "done").slice(0, limit);
  for (const b of list)
    console.log(JSON.stringify({ key: b.key, slug: b.slug, title: b.title, art: path.join(ART_DIR, `${b.key}.png`), prompt: buildPrompt(b) }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
