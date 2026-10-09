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
export const ART_DIR = process.env.COVER_ART_DIR || path.join(process.env.HOME || "/tmp", "cover-art-raw");

/**
 * Prompt for text-free artwork in the style of the covers already on the site: a cinematic,
 * photorealistic painting of the story's characters in a key moment, with room for the title.
 * @param {{concept:string, palette:string, mode?:string, style?:string, layout?:string}} b
 */
export function buildPrompt(b) {
  if (b.layout === "classic") return classicPrompt(b);
  const light = b.mode === "light";
  return [
    "Photorealistic cinematic film still, vertical 2:3 book cover photograph.",
    b.style === "pulp" ? "Gritty Indian crime-thriller film look with low-key noir lighting; danger is implied, never gory." : null,
    b.concept,
    `Colour theme: ${b.palette}.`,
    "Shot on 35mm film with a 50mm lens, natural light only, true-to-life colours, real skin texture with pores and wrinkles, unretouched faces, natural hands, real fabric weave, dust and wear, shallow depth of field, subtle film grain.",
    "It must look like a real photograph from a film — not a painting, not an illustration, not CGI; no glossy skin, no glow, no fantasy effects.",
    light
      ? "Keep the people in the lower two-thirds; the top third is soft, bright sky or plain light background with nothing in it, for a title added later."
      : "Keep the people in the lower two-thirds; the top third is calm, dark sky or shadowed background with nothing in it, for a title added later.",
    "No text, letters, numbers, logos, signature or watermark.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The first (symbolic, painterly) recipe, kept for entries marked layout: "classic". */
function classicPrompt(b) {
  const light = b.mode === "light";
  return [
    "Vertical 2:3 portrait painting, artwork only, no typography.",
    b.style === "pulp" ? "Classic Indian pulp-thriller cover painting with moody noir lighting; danger is implied, never gory." : null,
    b.concept,
    `Palette: ${b.palette}${light ? " — a light, airy painting" : ""}.`,
    "Painterly, cinematic and richly textured.",
    light
      ? "Keep the top third pale, calm and uncluttered for a title added later."
      : "Keep the top third calm, dark and uncluttered for a title added later.",
    "No text, letters, numbers, logos, signature or watermark.",
  ]
    .filter(Boolean)
    .join(" ");
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
    const redo = m.books.filter((b) => b.status === "redo").length;
    console.log(`${done} done, ${redo} to redo, ${m.books.length - done - redo} pending, ${m.books.length} total`);
    return;
  }
  const key = get("--key");
  const limit = Number(get("--limit") || 10);
  const list = key ? m.books.filter((b) => b.key === key) : m.books.filter((b) => b.status !== "done").slice(0, limit);
  for (const b of list)
    console.log(JSON.stringify({ key: b.key, slug: b.slug, title: b.title, art: path.join(ART_DIR, `${b.key}.png`), prompt: buildPrompt(b) }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
