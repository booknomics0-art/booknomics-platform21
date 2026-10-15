#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { extname, relative } from "node:path";

const ROOT = new URL("../src/", import.meta.url);
const extensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
const allowedPrefixes = [
  "integrations/supabase/",
];
const rules = [
  {
    label: "Supabase browser client import",
    regex: /(?:from\s*["'][^"']*integrations\/supabase\/client["']|import\s*\(\s*["'][^"']*integrations\/supabase\/client["']\s*\))/g,
  },
  {
    label: "Direct Supabase project URL",
    regex: /https?:\/\/[^\s"'`]+\.supabase\.co/gi,
  },
  {
    label: "Browser Supabase environment variable",
    regex: /VITE_SUPABASE_(?:URL|PUBLISHABLE_KEY|PROJECT_ID)/g,
  },
];

async function walk(dirUrl, files = []) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dirUrl);
    if (entry.isDirectory()) {
      await walk(child, files);
    } else if (extensions.has(extname(entry.name))) {
      files.push(child);
    }
  }
  return files;
}

function lineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

function isTestFixture(rel) {
  return /(^|\/)__tests__\//.test(rel) || /\.(?:test|spec)\.[^.]+$/.test(rel);
}

async function main() {
  const files = await walk(ROOT);
  const violations = [];

  for (const fileUrl of files) {
    const filePath = fileUrl.pathname;
    const rel = relative(new URL("../src/", import.meta.url).pathname, filePath).replaceAll("\\", "/");
    if (allowedPrefixes.some((prefix) => rel.startsWith(prefix)) || isTestFixture(rel)) continue;

    const text = await readFile(fileUrl, "utf8");
    for (const rule of rules) {
      rule.regex.lastIndex = 0;
      for (const match of text.matchAll(rule.regex)) {
        violations.push({
          file: `src/${rel}`,
          line: lineNumber(text, match.index ?? 0),
          rule: rule.label,
          match: match[0].slice(0, 180),
        });
      }
    }
  }

  if (!violations.length) {
    console.log("Browser Supabase guard passed: no direct Supabase runtime dependency found outside src/integrations/supabase/.");
    return;
  }

  console.error(`Browser Supabase guard failed with ${violations.length} violation(s):`);
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} [${violation.rule}] ${violation.match}`);
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
