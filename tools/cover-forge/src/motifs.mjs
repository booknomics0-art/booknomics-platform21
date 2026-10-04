// Procedural vector motifs. Every motif draws inside an art box of w x h
// (design units, 800x1200 canvas) and only uses colours from the palette, so
// the whole set stays visually coherent. Deterministic: same rng seed -> same
// drawing.
//
// Each motif: (ctx) => svg string, where ctx = { w, h, pal, rand }
// ctx.w / ctx.h are the art box size; the motif draws with origin at (0,0)
// inside that box and is translated by the template.

import { r2, range, int } from "./util.mjs";

const polar = (cx, cy, r, a) => [r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))];

// --- circles / rings ---------------------------------------------------------

function chakra({ w, h, pal, rand }) {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.36;
  const spokes = int(rand, 8, 14);
  const parts = [`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R)}" fill="none" stroke="${pal.art[1]}" stroke-width="3" opacity="0.9"/>`];
  parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R * 0.72)}" fill="none" stroke="${pal.art[2]}" stroke-width="1.4" opacity="0.55"/>`);
  parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R * 0.16)}" fill="${pal.art[2]}" opacity="0.85"/>`);
  for (let i = 0; i < spokes; i += 1) {
    const a = (i / spokes) * Math.PI * 2;
    const [x1, y1] = polar(cx, cy, R * 0.2, a);
    const [x2, y2] = polar(cx, cy, R * 0.68, a);
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${pal.art[1]}" stroke-width="2" opacity="0.75"/>`);
  }
  return parts.join("");
}

function sunArc({ w, h, pal, rand }) {
  const cx = w / 2;
  const cy = h * range(rand, 0.52, 0.62);
  const R = Math.min(w, h) * 0.3;
  const rays = int(rand, 12, 20);
  const parts = [];
  for (let i = 0; i < rays; i += 1) {
    const a = Math.PI + (i / (rays - 1)) * Math.PI;
    const [x1, y1] = polar(cx, cy, R * 1.04, a);
    const [x2, y2] = polar(cx, cy, R * range(rand, 1.18, 1.5), a);
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${pal.art[2]}" stroke-width="2" opacity="0.5"/>`);
  }
  parts.push(`<path d="M ${r2(cx - R)} ${r2(cy)} A ${r2(R)} ${r2(R)} 0 0 1 ${r2(cx + R)} ${r2(cy)} Z" fill="${pal.art[1]}" opacity="0.9"/>`);
  parts.push(`<path d="M ${r2(cx - R * 0.62)} ${r2(cy)} A ${r2(R * 0.62)} ${r2(R * 0.62)} 0 0 1 ${r2(cx + R * 0.62)} ${r2(cy)} Z" fill="${pal.art[2]}" opacity="0.85"/>`);
  parts.push(`<line x1="${r2(w * 0.1)}" y1="${r2(cy)}" x2="${r2(w * 0.9)}" y2="${r2(cy)}" stroke="${pal.art[0]}" stroke-width="2" opacity="0.6"/>`);
  return parts.join("");
}

function mandala({ w, h, pal, rand }) {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.36;
  const petals = int(rand, 8, 14);
  const parts = [`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R * 1.02)}" fill="none" stroke="${pal.art[1]}" stroke-width="1.6" opacity="0.5"/>`];
  for (let i = 0; i < petals; i += 1) {
    const a = (i / petals) * 360;
    parts.push(
      `<ellipse cx="${r2(cx)}" cy="${r2(cy - R * 0.55)}" rx="${r2(R * 0.17)}" ry="${r2(R * 0.42)}" fill="${pal.art[1]}" opacity="0.45" transform="rotate(${r2(a)} ${r2(cx)} ${r2(cy)})"/>`,
    );
  }
  parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R * 0.3)}" fill="${pal.art[2]}" opacity="0.9"/>`);
  parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R * 0.12)}" fill="${pal.bg[0]}" opacity="0.9"/>`);
  return parts.join("");
}

function mountains({ w, h, pal, rand }) {
  const base = h * 0.8;
  const parts = [];
  const sun = { x: w * range(rand, 0.6, 0.78), y: h * range(rand, 0.22, 0.32), r: Math.min(w, h) * 0.11 };
  parts.push(`<circle cx="${r2(sun.x)}" cy="${r2(sun.y)}" r="${r2(sun.r)}" fill="${pal.art[2]}" opacity="0.8"/>`);
  const ridges = 3;
  for (let r = 0; r < ridges; r += 1) {
    const y = base - r * h * 0.08;
    const peak = h * range(rand, 0.2, 0.34);
    const ax = w * range(rand, 0.2, 0.34);
    const bx = w * range(rand, 0.52, 0.72);
    const by = y - peak * range(rand, 0.5, 0.78);
    const opacity = r2(0.32 + r * 0.2);
    parts.push(
      `<path d="M ${r2(-w * 0.05)} ${r2(y)} L ${r2(ax)} ${r2(y - peak)} L ${r2(bx)} ${r2(by)} L ${r2(w * 1.05)} ${r2(y)} Z" fill="${pal.art[r % pal.art.length]}" opacity="${opacity}"/>`,
    );
    parts.push(
      `<path d="M ${r2(-w * 0.05)} ${r2(y)} L ${r2(ax)} ${r2(y - peak)} L ${r2(bx)} ${r2(by)} L ${r2(w * 1.05)} ${r2(y)}" fill="none" stroke="${pal.art[2]}" stroke-width="2" opacity="0.45"/>`,
    );
    // snow cap on the tallest ridge only
    if (r === ridges - 1) {
      const capH = peak * 0.18;
      parts.push(`<path d="M ${r2(ax - peak * 0.22)} ${r2(y - peak + capH)} L ${r2(ax)} ${r2(y - peak)} L ${r2(ax + peak * 0.22)} ${r2(y - peak + capH)} L ${r2(ax + peak * 0.08)} ${r2(y - peak + capH * 0.75)} L ${r2(ax - peak * 0.06)} ${r2(y - peak + capH * 1.05)} Z" fill="${pal.art[2]}" opacity="0.85"/>`);
    }
  }
  parts.push(`<line x1="${r2(w * 0.1)}" y1="${r2(base)}" x2="${r2(w * 0.9)}" y2="${r2(base)}" stroke="${pal.art[2]}" stroke-width="2" opacity="0.5"/>`);
  return parts.join("");
}

function river({ w, h, pal, rand }) {
  const parts = [];
  const bands = int(rand, 4, 7);
  for (let i = 0; i < bands; i += 1) {
    const y = h * (0.25 + i * 0.09);
    const amp = h * range(rand, 0.015, 0.04);
    const d = `M 0 ${r2(y)} C ${r2(w * 0.25)} ${r2(y - amp)} ${r2(w * 0.5)} ${r2(y + amp)} ${r2(w * 0.75)} ${r2(y - amp * 0.6)} S ${r2(w)} ${r2(y + amp * 0.4)} ${r2(w)} ${r2(y)}`;
    parts.push(`<path d="${d}" fill="none" stroke="${pal.art[i % pal.art.length]}" stroke-width="${r2(range(rand, 2, 5))}" opacity="${r2(0.35 + (i / bands) * 0.4)}"/>`);
  }
  return parts.join("");
}

function monolith({ w, h, pal, rand }) {
  const cols = int(rand, 3, 5);
  const parts = [];
  const totalW = w * 0.62;
  const gap = totalW / (cols * 2 - 1);
  const startX = (w - totalW) / 2;
  for (let i = 0; i < cols; i += 1) {
    const x = startX + i * gap * 2;
    const top = h * range(rand, 0.22, 0.4);
    const bottom = h * range(rand, 0.72, 0.82);
    parts.push(`<rect x="${r2(x)}" y="${r2(top)}" width="${r2(gap)}" height="${r2(bottom - top)}" fill="${pal.art[i % pal.art.length]}" opacity="${r2(0.45 + i * 0.16)}"/>`);
  }
  parts.push(`<line x1="${r2(w * 0.14)}" y1="${r2(h * 0.82)}" x2="${r2(w * 0.86)}" y2="${r2(h * 0.82)}" stroke="${pal.art[2]}" stroke-width="2" opacity="0.6"/>`);
  parts.push(`<circle cx="${r2(w * 0.5)}" cy="${r2(h * 0.18)}" r="${r2(w * 0.06)}" fill="${pal.art[2]}" opacity="0.7"/>`);
  return parts.join("");
}

function moonPhases({ w, h, pal, rand }) {
  const n = int(rand, 4, 6);
  const cy = h * 0.5;
  const r = Math.min(w * 0.09, h * 0.09);
  const gap = (w * 0.78) / n;
  const startX = w * 0.11 + gap / 2;
  const parts = [];
  for (let i = 0; i < n; i += 1) {
    const x = startX + i * gap;
    parts.push(`<circle cx="${r2(x)}" cy="${r2(cy)}" r="${r2(r)}" fill="${pal.art[1]}" opacity="0.85"/>`);
    const off = (i / (n - 1)) * r * 1.7;
    parts.push(`<circle cx="${r2(x - r * 0.55 + off)}" cy="${r2(cy)}" r="${r2(r)}" fill="${pal.bg[0]}" opacity="0.92"/>`);
  }
  parts.push(`<line x1="${r2(w * 0.08)}" y1="${r2(cy + r * 1.7)}" x2="${r2(w * 0.92)}" y2="${r2(cy + r * 1.7)}" stroke="${pal.art[2]}" stroke-width="1.4" opacity="0.5"/>`);
  return parts.join("");
}

function diya({ w, h, pal, rand }) {
  const cx = w / 2;
  const cy = h * range(rand, 0.5, 0.6);
  const R = Math.min(w, h) * 0.24;
  const parts = [];
  parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy - R * 0.75)}" r="${r2(R * 1.5)}" fill="${pal.art[2]}" opacity="0.14"/>`);
  parts.push(`<path d="M ${r2(cx - R)} ${r2(cy)} Q ${r2(cx)} ${r2(cy + R * 1.05)} ${r2(cx + R)} ${r2(cy)} Z" fill="${pal.art[1]}" opacity="0.95"/>`);
  parts.push(`<path d="M ${r2(cx)} ${r2(cy - R * 1.25)} C ${r2(cx + R * 0.34)} ${r2(cy - R * 0.75)} ${r2(cx + R * 0.22)} ${r2(cy - R * 0.2)} ${r2(cx)} ${r2(cy - R * 0.08)} C ${r2(cx - R * 0.22)} ${r2(cy - R * 0.2)} ${r2(cx - R * 0.34)} ${r2(cy - R * 0.75)} ${r2(cx)} ${r2(cy - R * 1.25)} Z" fill="${pal.art[2]}" opacity="0.95"/>`);
  parts.push(`<line x1="${r2(w * 0.12)}" y1="${r2(cy + R * 0.75)}" x2="${r2(w * 0.88)}" y2="${r2(cy + R * 0.75)}" stroke="${pal.art[2]}" stroke-width="1.6" opacity="0.45"/>`);
  return parts.join("");
}

function lotus({ w, h, pal, rand }) {
  const cx = w / 2;
  const cy = h * 0.62;
  const R = Math.min(w, h) * 0.3;
  const petals = int(rand, 5, 8);
  const parts = [`<line x1="${r2(cx)}" y1="${r2(cy + R * 0.2)}" x2="${r2(cx)}" y2="${r2(h * 0.92)}" stroke="${pal.art[0]}" stroke-width="2.4" opacity="0.6"/>`];
  for (let i = 0; i < petals; i += 1) {
    const a = -90 - (i - (petals - 1) / 2) * 26;
    parts.push(
      `<ellipse cx="${r2(cx)}" cy="${r2(cy - R * 0.5)}" rx="${r2(R * 0.16)}" ry="${r2(R * 0.5)}" fill="${pal.art[i % 2 ? 1 : 2]}" opacity="0.8" transform="rotate(${r2(a)} ${r2(cx)} ${r2(cy)})"/>`,
    );
  }
  parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy - R * 0.2)}" r="${r2(R * 0.16)}" fill="${pal.art[2]}" opacity="0.95"/>`);
  return parts.join("");
}

function inkRibbon({ w, h, pal, rand }) {
  const y = h * range(rand, 0.38, 0.58);
  const amp = h * range(rand, 0.1, 0.2);
  const parts = [
    `<path d="M ${r2(-w * 0.1)} ${r2(y)} C ${r2(w * 0.3)} ${r2(y - amp)} ${r2(w * 0.55)} ${r2(y + amp)} ${r2(w * 1.1)} ${r2(y - amp * 0.5)} L ${r2(w * 1.1)} ${r2(y + amp * 0.5)} C ${r2(w * 0.55)} ${r2(y + amp * 1.5)} ${r2(w * 0.3)} ${r2(y - amp * 0.2)} ${r2(-w * 0.1)} ${r2(y + amp * 0.6)} Z" fill="${pal.art[1]}" opacity="0.85"/>`,
  ];
  parts.push(`<path d="M ${r2(-w * 0.1)} ${r2(y + amp * 1.5)} C ${r2(w * 0.35)} ${r2(y + amp * 0.5)} ${r2(w * 0.6)} ${r2(y + amp * 2.2)} ${r2(w * 1.1)} ${r2(y + amp * 1.1)}" fill="none" stroke="${pal.art[2]}" stroke-width="2.4" opacity="0.6"/>`);
  parts.push(`<circle cx="${r2(w * range(rand, 0.2, 0.8))}" cy="${r2(y - amp * range(rand, 0.8, 1.4))}" r="${r2(w * 0.045)}" fill="${pal.art[2]}" opacity="0.8"/>`);
  return parts.join("");
}

function bauhaus({ w, h, pal, rand }) {
  const cols = 4;
  const cell = w / cols;
  const parts = [];
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = c * cell;
      const y = h * 0.2 + r * cell;
      const kind = Math.floor(rand() * 3);
      const col = pal.art[(r + c) % pal.art.length];
      const op = r2(range(rand, 0.3, 0.8));
      if (kind === 0) parts.push(`<circle cx="${r2(x + cell / 2)}" cy="${r2(y + cell / 2)}" r="${r2(cell * 0.34)}" fill="${col}" opacity="${op}"/>`);
      else if (kind === 1) parts.push(`<rect x="${r2(x + cell * 0.14)}" y="${r2(y + cell * 0.14)}" width="${r2(cell * 0.72)}" height="${r2(cell * 0.72)}" fill="none" stroke="${col}" stroke-width="2.4" opacity="${op}"/>`);
      else parts.push(`<path d="M ${r2(x + cell * 0.1)} ${r2(y + cell * 0.9)} A ${r2(cell * 0.8)} ${r2(cell * 0.8)} 0 0 1 ${r2(x + cell * 0.9)} ${r2(y + cell * 0.9)} Z" fill="${col}" opacity="${op}"/>`);
    }
  }
  return parts.join("");
}

function tree({ w, h, pal, rand }) {
  const cx = w / 2;
  const baseY = h * 0.82;
  const trunkH = h * range(rand, 0.3, 0.4);
  const parts = [
    `<path d="M ${r2(cx - w * 0.016)} ${r2(baseY)} L ${r2(cx - w * 0.006)} ${r2(baseY - trunkH)} L ${r2(cx + w * 0.006)} ${r2(baseY - trunkH)} L ${r2(cx + w * 0.016)} ${r2(baseY)} Z" fill="${pal.art[0]}" opacity="0.95"/>`,
  ];
  const blobs = int(rand, 3, 5);
  for (let i = 0; i < blobs; i += 1) {
    const bx = cx + range(rand, -w * 0.14, w * 0.14);
    const by = baseY - trunkH - range(rand, 0, h * 0.1);
    parts.push(`<circle cx="${r2(bx)}" cy="${r2(by)}" r="${r2(Math.min(w, h) * range(rand, 0.08, 0.14))}" fill="${pal.art[1]}" opacity="${r2(range(rand, 0.4, 0.75))}"/>`);
  }
  parts.push(`<line x1="${r2(w * 0.1)}" y1="${r2(baseY)}" x2="${r2(w * 0.9)}" y2="${r2(baseY)}" stroke="${pal.art[2]}" stroke-width="2" opacity="0.5"/>`);
  return parts.join("");
}

function peacockFeather({ w, h, pal, rand }) {
  const cx = w * 0.5;
  const cy = h * 0.44;
  const parts = [`<path d="M ${r2(cx)} ${r2(cy + h * 0.34)} C ${r2(cx - w * 0.03)} ${r2(cy + h * 0.16)} ${r2(cx - w * 0.02)} ${r2(cy + h * 0.06)} ${r2(cx)} ${r2(cy)}" fill="none" stroke="${pal.art[0]}" stroke-width="3" opacity="0.7"/>`];
  const R = Math.min(w, h) * 0.2;
  parts.push(`<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(R * 0.85)}" ry="${r2(R * 1.15)}" fill="${pal.art[1]}" opacity="0.75"/>`);
  parts.push(`<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(R * 0.55)}" ry="${r2(R * 0.75)}" fill="${pal.art[2]}" opacity="0.9"/>`);
  parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R * 0.3)}" fill="${pal.bg[0]}" opacity="0.9"/>`);
  parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R * 0.12)}" fill="${pal.art[2]}" opacity="0.95"/>`);
  const barb = int(rand, 8, 14);
  for (let i = 0; i < barb; i += 1) {
    const yy = cy - R + (i / barb) * R * 2.4;
    const dx = Math.abs(yy - cy) / R;
    parts.push(`<line x1="${r2(cx - R * 0.9 - dx * R * 0.4)}" y1="${r2(yy)}" x2="${r2(cx - R * 0.4)}" y2="${r2(yy)}" stroke="${pal.art[1]}" stroke-width="1.2" opacity="0.4"/>`);
    parts.push(`<line x1="${r2(cx + R * 0.4)}" y1="${r2(yy)}" x2="${r2(cx + R * 0.9 + dx * R * 0.4)}" y2="${r2(yy)}" stroke="${pal.art[1]}" stroke-width="1.2" opacity="0.4"/>`);
  }
  return parts.join("");
}

function spiral({ w, h, pal, rand }) {
  const cx = w / 2;
  const cy = h * 0.5;
  const turns = range(rand, 2.6, 4.2);
  const R = Math.min(w, h) * 0.36;
  const steps = 220;
  let d = "";
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2 * turns;
    const r = (i / steps) * R;
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    d += `${i === 0 ? "M" : "L"} ${r2(x)} ${r2(y)} `;
  }
  const parts = [
    `<path d="${d}" fill="none" stroke="${pal.art[1]}" stroke-width="3" opacity="0.85"/>`,
    `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R * 0.06)}" fill="${pal.art[2]}" opacity="0.9"/>`,
    `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R * 1.08)}" fill="none" stroke="${pal.art[2]}" stroke-width="1.2" opacity="0.4"/>`,
  ];
  return parts.join("");
}

function seigaiha({ w, h, pal, rand }) {
  const rows = int(rand, 5, 8);
  const R = w * 0.13;
  const stepX = R * 1.6;
  const stepY = R * 0.62;
  const startY = h * 0.22;
  const parts = [];
  for (let r = 0; r < rows; r += 1) {
    const y = startY + r * stepY;
    const offset = r % 2 ? stepX / 2 : 0;
    for (let x = -stepX; x < w + stepX; x += stepX) {
      parts.push(
        `<path d="M ${r2(x + offset - R)} ${r2(y)} A ${r2(R)} ${r2(R)} 0 0 1 ${r2(x + offset + R)} ${r2(y)}" fill="none" stroke="${pal.art[r % pal.art.length]}" stroke-width="2" opacity="${r2(0.5 - r * 0.05)}"/>`,
      );
    }
  }
  return parts.join("");
}

function starburst({ w, h, pal, rand }) {
  const cx = w * range(rand, 0.4, 0.6);
  const cy = h * range(rand, 0.4, 0.6);
  const n = int(rand, 18, 34);
  const R = Math.min(w, h) * 0.44;
  const parts = [`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R * 0.18)}" fill="${pal.art[1]}" opacity="0.9"/>`];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const [x2, y2] = polar(cx, cy, R * range(rand, 0.5, 1), a);
    parts.push(`<line x1="${r2(cx)}" y1="${r2(cy)}" x2="${x2}" y2="${y2}" stroke="${pal.art[i % 2]} " stroke-width="1.6" opacity="0.55"/>`);
  }
  return parts.join("");
}

function halftone({ w, h, pal, rand }) {
  const cols = int(rand, 7, 10);
  const rows = int(rand, 12, 16);
  const cw = w / cols;
  const ch = (h * 0.7) / rows;
  const parts = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = c * cw + cw / 2;
      const y = h * 0.18 + r * ch + ch / 2;
      const rr = Math.max(0.4, cw * 0.42 * (1 - r / rows) * range(rand, 0.7, 1.15));
      parts.push(`<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(rr)}" fill="${pal.art[1]} " opacity="${r2(0.35 + (r / rows) * 0.5)}"/>`);
    }
  }
  return parts.join("");
}

function archWindow({ w, h, pal, rand }) {
  const cx = w / 2;
  const width = w * 0.5;
  const top = h * 0.18;
  const bottom = h * 0.84;
  const r = width / 2;
  const d = `M ${r2(cx - r)} ${r2(bottom)} L ${r2(cx - r)} ${r2(top + r)} A ${r2(r)} ${r2(r)} 0 0 1 ${r2(cx + r)} ${r2(top + r)} L ${r2(cx + r)} ${r2(bottom)}`;
  const parts = [
    `<path d="${d}" fill="${pal.art[0]}" opacity="0.35"/>`,
    `<path d="${d}" fill="none" stroke="${pal.art[2]}" stroke-width="3" opacity="0.85"/>`,
    `<circle cx="${r2(cx)}" cy="${r2(top + r * 1.25)}" r="${r2(r * 0.3)}" fill="${pal.art[2]}" opacity="0.7"/>`,
  ];
  const inner = Math.min(w, h) * 0.1;
  parts.push(`<circle cx="${r2(cx)}" cy="${r2(h * 0.62)}" r="${r2(inner)}" fill="none" stroke="${pal.art[1]}" stroke-width="2" opacity="0.6"/>`);
  parts.push(`<circle cx="${r2(cx)}" cy="${r2(h * 0.62)}" r="${r2(inner * 0.5)}" fill="${pal.art[1]}" opacity="0.6"/>`);
  parts.push(`<line x1="${r2(w * 0.12)}" y1="${r2(bottom)}" x2="${r2(w * 0.88)}" y2="${r2(bottom)}" stroke="${pal.art[2]}" stroke-width="2" opacity="0.6"/>`);
  return parts.join("");
}

function eye({ w, h, pal, rand }) {
  const cx = w / 2;
  const cy = h * 0.48;
  const EW = w * 0.36;
  const EH = h * 0.16;
  const d = `M ${r2(cx - EW)} ${r2(cy)} C ${r2(cx - EW * 0.5)} ${r2(cy - EH)} ${r2(cx + EW * 0.5)} ${r2(cy - EH)} ${r2(cx + EW)} ${r2(cy)} C ${r2(cx + EW * 0.5)} ${r2(cy + EH)} ${r2(cx - EW * 0.5)} ${r2(cy + EH)} ${r2(cx - EW)} ${r2(cy)} Z`;
  const parts = [
    `<path d="${d}" fill="${pal.art[0]}" opacity="0.4"/>`,
    `<path d="${d}" fill="none" stroke="${pal.art[2]}" stroke-width="2.4" opacity="0.9"/>`,
    `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(EH * 0.62)}" fill="${pal.art[1]}" opacity="0.95"/>`,
    `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(EH * 0.26)}" fill="${pal.bg[0]}" opacity="0.9"/>`,
  ];
  const rays = int(rand, 10, 18);
  for (let i = 0; i < rays; i += 1) {
    const a = Math.PI + (i / (rays - 1)) * Math.PI;
    const [x1, y1] = polar(cx, cy, EW * 1.05, a);
    const [x2, y2] = polar(cx, cy, EW * range(rand, 1.2, 1.45), a);
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${pal.art[2]}" stroke-width="1.6" opacity="0.45"/>`);
  }
  return parts.join("");
}

function houses({ w, h, pal, rand }) {
  const baseY = h * 0.78;
  const parts = [];
  let x = w * 0.12;
  while (x < w * 0.9) {
    const bw = w * range(rand, 0.08, 0.14);
    const bh = h * range(rand, 0.1, 0.24);
    const col = pal.art[Math.floor(rand() * pal.art.length)];
    parts.push(`<rect x="${r2(x)}" y="${r2(baseY - bh)}" width="${r2(bw)}" height="${r2(bh)}" fill="${col}" opacity="${r2(range(rand, 0.45, 0.85))}"/>`);
    parts.push(`<path d="M ${r2(x - bw * 0.08)} ${r2(baseY - bh)} L ${r2(x + bw / 2)} ${r2(baseY - bh - h * 0.05)} L ${r2(x + bw * 1.08)} ${r2(baseY - bh)} Z" fill="${pal.art[2]}" opacity="0.8"/>`);
    x += bw * 1.15;
  }
  parts.push(`<circle cx="${r2(w * 0.74)}" cy="${r2(h * 0.2)}" r="${r2(w * 0.08)}" fill="${pal.art[2]}" opacity="0.7"/>`);
  parts.push(`<line x1="${r2(w * 0.08)}" y1="${r2(baseY)}" x2="${r2(w * 0.92)}" y2="${r2(baseY)}" stroke="${pal.art[2]}" stroke-width="2.4" opacity="0.7"/>`);
  return parts.join("");
}

export const MOTIFS = {
  chakra,
  sunArc,
  mandala,
  mountains,
  river,
  monolith,
  moonPhases,
  diya,
  lotus,
  inkRibbon,
  bauhaus,
  tree,
  peacockFeather,
  spiral,
  seigaiha,
  starburst,
  halftone,
  archWindow,
  eye,
  houses,
};

export const motifIds = () => Object.keys(MOTIFS);
