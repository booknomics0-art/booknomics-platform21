#!/usr/bin/env node
// Uniqueness QA for composed covers.
//   node qa.mjs [dir-or-files...] [--top 8] [--hash-max 12] [--de-min 10]
// For every pair of covers it reports
//   • artwork similarity: 64-bit dHash of the art region (below the title band) → Hamming distance
//   • theme-colour similarity: ΔE (CIE76, Lab) between the covers' two dominant hue clusters
//     (chroma-weighted, so a cobalt-and-gold cover reads as cobalt+gold, not as grey)
// and exits 1 if any pair looks like a duplicate (hash distance ≤ --hash-max AND ΔE < --de-min).
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = { top: 8, hashMax: 12, deMin: 10 };
const inputs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--top") opt.top = Number(args[++i]);
  else if (args[i] === "--hash-max") opt.hashMax = Number(args[++i]);
  else if (args[i] === "--de-min") opt.deMin = Number(args[++i]);
  else inputs.push(args[i]);
}
if (inputs.length === 0) inputs.push(path.join(HERE, "../../content-drafts/covers/hindi"));

const files = [];
for (const p of inputs) {
  const st = await fs.stat(p);
  if (st.isDirectory()) {
    for (const f of (await fs.readdir(p)).sort()) if (/\.(webp|jpe?g|png)$/i.test(f) && !f.startsWith("_")) files.push(path.join(p, f));
  } else files.push(p);
}

function srgbToLab([r, g, b]) {
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

function labToHex([L, a, b]) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const rgb = [X * 3.2406 - Y * 1.5372 - Z * 0.4986, -X * 0.9689 + Y * 1.8758 + Z * 0.0415, X * 0.0557 - Y * 0.204 + Z * 1.057];
  const g = (c) => Math.round(Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)) * 255);
  return "#" + rgb.map((c) => g(c).toString(16).padStart(2, "0")).join("");
}

async function features(file) {
  const img = sharp(file).resize(800, 1200, { fit: "cover" });
  const buf = await img.toBuffer();
  // Art region only: skip the title band (top 36%) and the wordmark strip.
  const art = await sharp(buf).extract({ left: 0, top: 430, width: 800, height: 690 }).toBuffer();
  const { data } = await sharp(art).greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let hash = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) hash = (hash << 1n) | (data[y * 9 + x] > data[y * 9 + x + 1] ? 1n : 0n);
  // Palette = the two strongest hue clusters (chroma-weighted, 30° bins, ≥90° apart).
  const { data: px } = await sharp(buf).resize(48, 72, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const bins = Array.from({ length: 12 }, () => ({ w: 0, L: 0, a: 0, b: 0 }));
  let ml = 0, ma = 0, mb = 0;
  for (let i = 0; i < px.length; i += 3) {
    const [L, a, b] = srgbToLab([px[i], px[i + 1], px[i + 2]]);
    ml += L, ma += a, mb += b;
    const wt = Math.max(0, Math.hypot(a, b) - 6);
    if (!wt) continue;
    const k = Math.floor((((Math.atan2(b, a) * 180) / Math.PI + 360) % 360) / 30) % 12;
    const bin = bins[k];
    bin.w += wt, bin.L += L * wt, bin.a += a * wt, bin.b += b * wt;
  }
  const n = px.length / 3;
  const near = (k) => [11, 0, 1].map((d) => bins[(k + d) % 12]);
  const cw = bins.map((_, k) => near(k).reduce((s, x) => s + x.w, 0));
  const colourOf = (k) => {
    const g = near(k), w = g.reduce((s, x) => s + x.w, 0);
    return w > 1 ? [g.reduce((s, x) => s + x.L, 0) / w, g.reduce((s, x) => s + x.a, 0) / w, g.reduce((s, x) => s + x.b, 0) / w] : [ml / n, ma / n, mb / n];
  };
  const k1 = cw.indexOf(Math.max(...cw));
  const far = cw.map((w, k) => (Math.min((k - k1 + 12) % 12, (k1 - k + 12) % 12) >= 3 ? w : -1));
  const k2c = far.indexOf(Math.max(...far));
  const k2 = far[k2c] >= cw[k1] * 0.25 ? k2c : k1;
  const p1 = colourOf(k1), p2 = colourOf(k2);
  return { file, hash, p1, p2, theme: k1 === k2 ? labToHex(p1) : `${labToHex(p1)}+${labToHex(p2)}` };
}

const ham = (a, b) => {
  let x = a ^ b, n = 0;
  while (x) (n += Number(x & 1n)), (x >>= 1n);
  return n;
};
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const paletteDist = (x, y) => Math.min((dE(x.p1, y.p1) + dE(x.p2, y.p2)) / 2, (dE(x.p1, y.p2) + dE(x.p2, y.p1)) / 2);

const feats = await Promise.all(files.map(features));
const pairs = [];
for (let i = 0; i < feats.length; i++)
  for (let j = i + 1; j < feats.length; j++) pairs.push({ a: feats[i], b: feats[j], h: ham(feats[i].hash, feats[j].hash), e: paletteDist(feats[i], feats[j]) });

const name = (f) => path.basename(f.file).replace(/\.(webp|jpe?g|png)$/i, "");
console.log(`${feats.length} covers, ${pairs.length} pairs\n`);
console.log("Closest artwork (dHash distance, 0 = identical, >20 ≈ unrelated):");
for (const p of [...pairs].sort((x, y) => x.h - y.h).slice(0, opt.top)) console.log(`  ${String(p.h).padStart(2)}  ${name(p.a)}  ↔  ${name(p.b)}`);
console.log("\nClosest theme palettes (mean ΔE of the two dominant colours, <10 = very similar):");
for (const p of [...pairs].sort((x, y) => x.e - y.e).slice(0, opt.top))
  console.log(`  ${p.e.toFixed(1).padStart(5)}  ${name(p.a)} ${p.a.theme}  ↔  ${name(p.b)} ${p.b.theme}`);

const dups = pairs.filter((p) => p.h <= opt.hashMax && p.e < opt.deMin);
if (dups.length) {
  console.log(`\n⚠ ${dups.length} possible duplicate(s):`);
  for (const p of dups) console.log(`  ${name(p.a)} ↔ ${name(p.b)}  (hash ${p.h}, ΔE ${p.e.toFixed(1)})`);
  process.exit(1);
}
console.log("\n✓ no near-duplicates");
