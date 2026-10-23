import { test } from "node:test";
import assert from "node:assert/strict";
import { getGscSeoPilot, pilotRows } from "../scripts/gsc-seo-pilot.mjs";

test("SEO pilot stays small, unique and editorially explicit", () => {
  assert.ok(pilotRows.length > 0 && pilotRows.length <= 15);
  assert.equal(new Set(pilotRows.map((row) => row.slug)).size, pilotRows.length);
  for (const row of pilotRows) {
    assert.ok(["hi", "en"].includes(row.language), row.slug);
    assert.ok(row.slug && row.bookTitle && row.author && row.query, row.slug);
    assert.ok(row.h1.includes(row.bookTitle), `${row.slug}: H1 must identify book`);
    assert.ok(row.intro.includes(row.author), `${row.slug}: intro must identify author`);
    assert.ok(row.intro.length >= 90 && row.intro.length <= 420, row.slug);
    assert.ok(row.description.length >= 70 && row.description.length <= 180, row.slug);
    if (row.title) assert.ok(row.title.length <= 68, row.slug);
    assert.ok(!/top\s*3|#1|guaranteed|best book summary/i.test(row.description), row.slug);
    assert.ok(!Object.keys(row).some((key) => /canonical|noindex|redirect|seo_slug/i.test(key)), row.slug);
  }
});

test("SEO pilot only matches the exact canonical book edition", () => {
  for (const row of pilotRows) {
    const book = { title: row.bookTitle, author: row.author, language: row.language, status: "published" };
    assert.equal(getGscSeoPilot(row.slug, book)?.slug, row.slug);
    assert.equal(getGscSeoPilot(`${row.slug}-other`, book), null);
    assert.equal(getGscSeoPilot(row.slug, { ...book, author: "Another Author" }), null);
    assert.equal(getGscSeoPilot(row.slug, { ...book, title: "Another Book" }), null);
    assert.equal(getGscSeoPilot(row.slug, { ...book, language: row.language === "hi" ? "en" : "hi" }), null);
    assert.equal(getGscSeoPilot(row.slug, { ...book, status: "published_noindex" }), null);
  }
});
