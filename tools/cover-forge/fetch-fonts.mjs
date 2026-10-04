#!/usr/bin/env node
// Copy the font files this tool needs out of node_modules into ./fonts.
//
// The TTFs are committed so generation never needs the network (this sandbox,
// for example, cannot reach fonts.gstatic.com or the Google Fonts CDN). Run
// "npm install" first; then "node fetch-fonts.mjs".

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FONTS = path.join(HERE, "fonts");

const WANTED = [
  ["@expo-google-fonts/noto-serif-devanagari", "700Bold/NotoSerifDevanagari_700Bold.ttf"],
  ["@expo-google-fonts/noto-serif-devanagari", "500Medium/NotoSerifDevanagari_500Medium.ttf"],
  ["@expo-google-fonts/noto-sans-devanagari", "700Bold/NotoSansDevanagari_700Bold.ttf"],
  ["@expo-google-fonts/noto-sans-devanagari", "600SemiBold/NotoSansDevanagari_600SemiBold.ttf"],
  ["@expo-google-fonts/fraunces", "600SemiBold/Fraunces_600SemiBold.ttf"],
  ["@expo-google-fonts/eb-garamond", "500Medium/EBGaramond_500Medium.ttf"],
  ["@expo-google-fonts/inter", "700Bold/Inter_700Bold.ttf"],
  ["@expo-google-fonts/inter", "600SemiBold/Inter_600SemiBold.ttf"],
];

fs.mkdirSync(FONTS, { recursive: true });
let copied = 0;
for (const [pkg, rel] of WANTED) {
  const src = path.join(HERE, "node_modules", pkg, rel);
  const dst = path.join(FONTS, path.basename(rel));
  if (!fs.existsSync(src)) {
    console.error(`missing ${src}\n  -> run "npm install" inside tools/cover-forge first`);
    process.exitCode = 1;
    continue;
  }
  fs.copyFileSync(src, dst);
  copied += 1;
  console.log(`  ${path.basename(rel)}  ${(fs.statSync(dst).size / 1024).toFixed(0)} KB`);
}

fs.writeFileSync(
  path.join(FONTS, "LICENSES.md"),
  [
    "# Fonts",
    "",
    "All eight files below are Google Fonts, released under the SIL Open Font",
    "License 1.1 (OFL). They are copied out of the matching",
    "`@expo-google-fonts/*` npm packages by `node fetch-fonts.mjs` and committed",
    "here so cover generation works offline.",
    "",
    "| File | Font | License |",
    "| --- | --- | --- |",
    "| NotoSerifDevanagari_700Bold.ttf | Noto Serif Devanagari | OFL 1.1 |",
    "| NotoSerifDevanagari_500Medium.ttf | Noto Serif Devanagari | OFL 1.1 |",
    "| NotoSansDevanagari_700Bold.ttf | Noto Sans Devanagari | OFL 1.1 |",
    "| NotoSansDevanagari_600SemiBold.ttf | Noto Sans Devanagari | OFL 1.1 |",
    "| Fraunces_600SemiBold.ttf | Fraunces | OFL 1.1 |",
    "| EBGaramond_500Medium.ttf | EB Garamond | OFL 1.1 |",
    "| Inter_700Bold.ttf | Inter | OFL 1.1 |",
    "| Inter_600SemiBold.ttf | Inter | OFL 1.1 |",
    "",
  ].join("\n"),
);

console.log(`\n${copied}/${WANTED.length} fonts ready in ${path.relative(process.cwd(), FONTS)}`);
if (copied !== WANTED.length) process.exitCode = 1;
