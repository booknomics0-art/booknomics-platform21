// node probe-prompts.mjs <outDir> <key>... — writes <outDir>/<key>.txt with the FLUX prompt of each manifest entry.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fluxPrompt } from "./flux-prompt.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const m = JSON.parse(fs.readFileSync(path.join(HERE, "../../../content-drafts/covers/hindi/manifest.json"), "utf8"));
const [out, ...keys] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
for (const k of keys) {
  const b = m.books.find((x) => x.key === k);
  if (!b) throw new Error("no manifest entry " + k);
  const p = fluxPrompt(b);
  fs.writeFileSync(path.join(out, k + ".txt"), p);
  console.log(k, p.split(/\s+/).length, "words");
}
