import { describe, expect, it } from "vitest";
import { mdToHtml, richSection, stripSharedPrefix } from "../scripts/prerender-all-books.mjs";

describe("prerender mdToHtml", () => {
  it("renders paragraphs, bold and headings with a safe outline", () => {
    const html = mdToHtml("# Top\n## Section\n### Sub\n#### Detail\n\nHello **world** and *soft* text.\n\nSecond paragraph line one\nline two.");
    expect(html).toContain("<h3>Top</h3>");
    expect(html).toContain("<h3>Section</h3>");
    expect(html).toContain("<h4>Sub</h4>");
    expect(html).toContain("<h4>Detail</h4>");
    expect(html).toContain("<p>Hello <strong>world</strong> and <em>soft</em> text.</p>");
    expect(html).toContain("<p>Second paragraph line one line two.</p>");
    // No H1/H2 inside article bodies (the section container owns the H2).
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("<h2");
  });

  it("renders ordered and unordered lists", () => {
    const html = mdToHtml("1. First\n2. Second\n\n- a\n- b");
    expect(html).toContain("<ol>\n<li>First</li>\n<li>Second</li>\n</ol>");
    expect(html).toContain("<ul>\n<li>a</li>\n<li>b</li>\n</ul>");
  });

  it("escapes raw HTML and dangerous markup in stored content", () => {
    const html = mdToHtml("<script>alert(1)</script><img src=x onerror='alert(2)' />\n**bold**");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("renders Devanagari with bold markers used by Hindi content", () => {
    const html = mdToHtml("**धार्मिक पाखंड की आलोचना।** कंकाल बार-बार दिखाता है कि धर्म का सार्वजनिक रूप नैतिक आचरण की गारंटी नहीं है।");
    expect(html).toContain("<strong>धार्मिक पाखंड की आलोचना।</strong>");
    expect(html).toContain("कंकाल बार-बार दिखाता है");
  });

  it("renders blockquotes and horizontal rules", () => {
    const html = mdToHtml("> a quote\n\n---\n\nafter");
    expect(html).toContain("<blockquote><p>a quote</p></blockquote>");
    expect(html).toContain("<hr />");
    expect(html).toContain("<p>after</p>");
  });
});

describe("prerender richSection", () => {
  it("returns empty string for empty/whitespace-only content", () => {
    expect(richSection("")).toBe("");
    expect(richSection("   \n\n  ")).toBe("");
  });

  it("caps long text at a word boundary without dangling markers", () => {
    const longText = Array.from({ length: 400 }, (_, i) => `word${i} **bold${i}** more`).join(" ");
    const html = richSection(longText, 5000);
    const boldCount = (html.match(/<strong>/g) || []).length;
    const closeCount = (html.match(/<\/strong>/g) || []).length;
    expect(boldCount).toBe(closeCount);
    expect(html.length).toBeLessThan(5000 * 3); // markup overhead allowed, but text is capped
  });

  it("does not cut inside a bold run at the cap", () => {
    const filler = "a".repeat(4990);
    const html = richSection(`${filler} **cut inside me**`, 5000);
    expect(html).not.toContain("**");
    expect((html.match(/<strong>/g) || []).length).toBe((html.match(/<\/strong>/g) || []).length);
  });
});

describe("prerender stripSharedPrefix", () => {
  const overview =
    "Think and Grow Rich by Napoleon Hill is a personal development book whose central concern is this: " +
    "Hill presents success as a disciplined mental and organizational process built around desire, faith, " +
    "specialized knowledge, planning, persistence, decision, and cooperation. The book is historically influential.";
  const uniqueTail =
    "The argument also has a boundary. Historical scholarship has questioned important parts of Hill's claimed " +
    "relationship with Andrew Carnegie. For that reason the framework works best as a diagnostic model.";

  it("removes the overview duplicated at the start of the detailed summary", () => {
    const deepSummary = `${overview}\n\n${uniqueTail}`;
    const cleaned = stripSharedPrefix(overview, deepSummary);
    expect(cleaned).not.toContain("central concern is this");
    expect(cleaned).toContain(uniqueTail.slice(0, 40));
  });

  it("keeps the text unchanged when there is no meaningful overlap", () => {
    const other = "Completely different opening that only shares a few common English words with the overview text above.";
    expect(stripSharedPrefix(overview, other)).toBe(other);
  });

  it("keeps a markdown heading that follows the duplicated overview", () => {
    const deepSummary = `${overview}\n\n### Critical synthesis\n\n${uniqueTail}`;
    const html = mdToHtml(stripSharedPrefix(overview, deepSummary));
    // ### maps to H4 (one level below the section H2 container).
    expect(html).toContain("<h4>Critical synthesis</h4>");
    expect(html).not.toContain("<p>Critical synthesis</p>");
  });

  it("handles overlap split across newlines in the raw markdown", () => {
    const rawDeep = overview
      .split(" ")
      .reduce((acc, word, idx) => (idx % 6 === 0 ? `${acc}\n${word}` : `${acc} ${word}`), "");
    const deepSummary = `${rawDeep}\n\n${uniqueTail}`;
    const cleaned = stripSharedPrefix(overview, deepSummary);
    expect(cleaned).not.toContain("central concern is this");
    expect(cleaned).toContain("diagnostic model");
  });

  it("returns the raw input for short or empty overviews", () => {
    expect(stripSharedPrefix("short", "anything at all")).toBe("anything at all");
    expect(stripSharedPrefix("", "some deep summary text that is long enough to be interesting on its own.")).toBe(
      "some deep summary text that is long enough to be interesting on its own.",
    );
  });
});
