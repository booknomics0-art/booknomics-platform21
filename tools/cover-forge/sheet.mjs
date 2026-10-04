// Contact-sheet helper for visual QA (not part of the pipeline).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const [dir, out, colsArg, ...rest] = process.argv.slice(2);
const cols = Number(colsArg || 5);
const files = (rest.length ? rest.map((s) => `${s}.jpg`) : fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort());
const tw = 260, th = 390, gap = 8;
const rows = Math.ceil(files.length / cols);
const comps = [];
for (let i = 0; i < files.length; i += 1) {
  const x = gap + (i % cols) * (tw + gap), y = gap + Math.floor(i / cols) * (th + gap);
  comps.push({ input: await sharp(path.join(dir, files[i])).resize(tw, th).toBuffer(), left: x, top: y });
}
const canvas = sharp({ create: { width: cols * tw + (cols + 1) * gap, height: rows * th + (rows + 1) * gap, channels: 3, background: '#1b1b1b' } });
fs.writeFileSync(out, await canvas.composite(comps).jpeg({ quality: 88 }).toBuffer());
console.log('wrote', out, files.length, 'covers');
