#!/usr/bin/env node
// Contact sheet for quick visual QA of composed covers (.png or .jpg output).
//   node sheet.mjs out.jpg cover1.webp cover2.webp ...   [--cols 5] [--w 300]
import sharp from "sharp";

const args = process.argv.slice(2);
let cols = 5, w = 300;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--cols") cols = Number(args[++i]);
  else if (args[i] === "--w") w = Number(args[++i]);
  else files.push(args[i]);
}
const [out, ...inputs] = files;
if (!out || inputs.length === 0) {
  console.error("usage: node sheet.mjs out.png in1 in2 ... [--cols 5] [--w 300]");
  process.exit(1);
}

const h = Math.round(w * 1.5), gap = 12;
const rows = Math.ceil(inputs.length / cols);
const W = cols * w + (cols + 1) * gap;
const H = rows * h + (rows + 1) * gap;

const composites = await Promise.all(
  inputs.map(async (f, i) => ({
    input: await sharp(f).resize(w, h, { fit: "cover" }).toBuffer(),
    left: gap + (i % cols) * (w + gap),
    top: gap + Math.floor(i / cols) * (h + gap),
  })),
);

await sharp({ create: { width: W, height: H, channels: 3, background: "#e9e6df" } })
  .composite(composites)
  [/\.jpe?g$/i.test(out) ? "jpeg" : "png"](/\.jpe?g$/i.test(out) ? { quality: 80, mozjpeg: true } : {})
  .toFile(out);
console.log(`${out}  ${W}x${H}  (${inputs.length} covers)`);
