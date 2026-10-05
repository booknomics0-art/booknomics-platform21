// Contact-sheet helper for visual QA (not part of the pipeline).
//
//   node sheet.mjs <dir> <out.jpg> <cols> [slug ...]
//
// If <dir>/manifest.json exists each tile is captioned with the title, the
// author and the theme the engine chose — that is what makes a sheet reviewable
// at a glance: you can see the decision next to the picture.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { FONT_DIR } from './src/fonts.mjs';

const ALL_FONTS = fs.readdirSync(FONT_DIR).filter((f) => f.endsWith('.ttf')).map((f) => path.join(FONT_DIR, f));

const [dir, out, colsArg, ...rest] = process.argv.slice(2);
if (!dir || !out) {
  console.error('usage: node sheet.mjs <dir> <out.jpg> [cols] [slug ...]');
  process.exit(2);
}

const cols = Math.max(1, Number(colsArg || 5));
const files = (rest.length ? rest.map((s) => `${s}.jpg`) : fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort());
if (!files.length) {
  console.error(`no .jpg files in ${dir}`);
  process.exit(2);
}

const manifestPath = path.join(dir, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
const bySlug = new Map((manifest?.books || []).map((b) => [b.slug, b]));

const TW = 300;
const TH = 450;
const CAP = 108;
const GAP = 10;

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function captionSvg(book, slug) {
  const title = book?.title || slug;
  const author = book?.author || '';
  const theme = book?.themeLabel ? `${book.themeLabel} · ${book.palette || ''} · ${book.templateId || ''} · ${book.motifId || ''}` : '';
  const sans = 'NotoSansDevanagari';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${CAP}" viewBox="0 0 ${TW} ${CAP}">
  <rect width="${TW}" height="${CAP}" fill="#1b1b1b"/>
  <text x="0" y="26" font-family="${sans}" font-size="21" font-weight="700" fill="#f5f5f4">${esc(title.length > 26 ? `${title.slice(0, 25)}…` : title)}</text>
  <text x="0" y="54" font-family="${sans}" font-size="17" fill="#a8a29e">${esc(author.length > 34 ? `${author.slice(0, 33)}…` : author)}</text>
  <text x="0" y="82" font-family="${sans}" font-size="14" fill="#fbbf24">${esc(theme.length > 46 ? `${theme.slice(0, 45)}…` : theme)}</text>
  <text x="0" y="100" font-family="Inter" font-size="11" fill="#78716c">${esc(slug)}</text>
</svg>`;
}

function captionPng(book, slug) {
  const resvg = new Resvg(captionSvg(book, slug), {
    font: { fontFiles: ALL_FONTS, loadSystemFonts: false, defaultFontFamily: 'NotoSansDevanagari' },
    background: 'rgba(0,0,0,0)',
  });
  return resvg.render().asPng();
}

const cellH = TH + CAP;
const rows = Math.ceil(files.length / cols);
const comps = [];
for (let i = 0; i < files.length; i += 1) {
  const slug = files[i].replace(/\.jpg$/, '');
  const x = GAP + (i % cols) * (TW + GAP);
  const y = GAP + Math.floor(i / cols) * (cellH + GAP);
  comps.push({ input: await sharp(path.join(dir, files[i])).resize(TW, TH, { fit: 'cover' }).toBuffer(), left: x, top: y });
  comps.push({ input: captionPng(bySlug.get(slug), slug), left: x, top: y + TH });
}

const canvas = sharp({ create: { width: cols * TW + (cols + 1) * GAP, height: rows * cellH + (rows + 1) * GAP, channels: 3, background: '#1b1b1b' } });
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, await canvas.composite(comps).jpeg({ quality: 90 }).toBuffer());
console.log('wrote', out, files.length, 'covers');
