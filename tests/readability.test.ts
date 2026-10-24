import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Rgb = [number, number, number];

const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const saturation = s / 100;
  const lightness = l / 100;
  const amplitude = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return lightness - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
};

const hexToRgb = (hex: string): Rgb => {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16) / 255) as Rgb;
};

const luminance = (rgb: Rgb) => rgb
  .map((component) => component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4)
  .reduce((sum, component, index) => sum + component * [0.2126, 0.7152, 0.0722][index], 0);

const contrast = (a: Rgb, b: Rgb) => {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
};

const themeCss = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const pageSpeedCss = readFileSync(resolve(process.cwd(), "src/pagespeed.css"), "utf8");
const readingView = readFileSync(resolve(process.cwd(), "src/components/ReadingView.tsx"), "utf8");
const editorialCss = readFileSync(resolve(process.cwd(), "src/editorial.css"), "utf8");

const cssColor = (scope: string, variable: string): Rgb => {
  const match = scope.match(new RegExp(`--${variable}:\\s*(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)%\\s+(\\d+(?:\\.\\d+)?)%`));
  if (!match) throw new Error(`Missing HSL token: ${variable}`);
  return hslToRgb(Number(match[1]), Number(match[2]), Number(match[3]));
};

const readerColor = (theme: "light" | "sepia" | "dark", variable: string): Rgb => {
  const section = readingView.match(new RegExp(`\\b${theme}: \\{([\\s\\S]*?)\\n  \\},`))?.[1];
  const hex = section?.match(new RegExp(`"--rv-${variable}": "(#[0-9a-fA-F]{6})"`))?.[1];
  if (!hex) throw new Error(`Missing ${theme} reader color ${variable}`);
  return hexToRgb(hex);
};

describe("readable Booknomics palette", () => {
  const light = themeCss.split(".dark {")[0];
  const dark = themeCss.split(".dark {")[1];

  it("keeps muted body text comfortably readable on paper and cards", () => {
    const ink = cssColor(light, "muted-foreground");
    expect(contrast(ink, cssColor(light, "background"))).toBeGreaterThanOrEqual(7);
    expect(contrast(ink, cssColor(light, "card"))).toBeGreaterThanOrEqual(7);
  });

  it("keeps small amber labels AA-readable on paper and cards", () => {
    const accent = cssColor(light, "primary");
    // pagespeed.css is imported after index.css and must not silently override
    // the palette with a different color in the actual rendered site.
    expect(cssColor(pageSpeedCss, "primary")).toEqual(accent);
    expect(contrast(accent, cssColor(light, "background"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(accent, cssColor(light, "card"))).toBeGreaterThanOrEqual(4.5);
  });

  it("preserves accessible dark-theme secondary copy", () => {
    expect(contrast(cssColor(dark, "muted-foreground"), cssColor(dark, "background"))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["light", "sepia", "dark"] as const)("keeps %s reader labels readable", (theme) => {
    for (const surface of ["bg", "quote-bg"]) {
      for (const text of ["muted", "accent"]) {
        expect(contrast(readerColor(theme, text), readerColor(theme, surface))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(["light", "sepia", "dark"] as const)("keeps %s reader body ink high contrast", (theme) => {
    expect(contrast(readerColor(theme, "text"), readerColor(theme, "bg"))).toBeGreaterThanOrEqual(10);
  });

  it("uses real medium-weight book fonts and stronger homepage copy", () => {
    expect(readingView).toContain("Lora:ital,wght@0,400;0,500;0,600");
    expect(readingView).toMatch(/\.rv-prose \{[^}]*font-weight: 500;/);
    expect(readingView).toMatch(/\.rv-hi \.rv-eyebrow \{[^}]*font-size: 15px;/);
    expect(editorialCss).toMatch(/\.bn-home-lede,\s*\.bn-section-heading p,[\s\S]*?font-weight: 500;/);
  });
});
