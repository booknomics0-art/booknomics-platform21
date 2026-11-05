import { describe, expect, it } from "vitest";
import {
  auditBooks,
  normalizeText,
  splitSentences,
  splitParagraphs,
  toCsv,
} from "../scripts/audit-template-content.mjs";

// Shared template fragments. Each shared sentence is 48+ chars / 6+ words so
// it survives the splitSentences filter; each shared paragraph is 120+ chars
// after normalization.
const SHARED_SENTENCE =
  "The reading separates the author's recommendation from evidence and implementation in every chapter.";
const PARAGRAPH_A =
  "Each principle is treated as a testable lens whose usefulness depends on constraints, incentives, timing, and feedback. " +
  "The emphasis is on reader usefulness, specificity, and intellectual independence rather than keyword repetition.";
// Sentence shared by only 4 books — below the default min of 5, must NOT count.
const SENTENCE_FOUR_BOOKS =
  "A secondary observation appears in four of the generated summaries and nowhere else at all here.";
const HINDI_PARAGRAPH =
  "हर पात्र, हर घटना, हर संवाद यहाँ पुनः परखा गया है ताकि पाठक को पुस्तक की अंतरात्मा तक पहुँच सके। " +
  "यह स्वतंत्र अध्ययन सारांश किसी भी उद्धरण को नहीं बनाता, बल्कि विचारों की रीति को समझाता है।";
const HINDI_SENTENCE =
  "पुस्तक के प्रत्येक अध्याय को पाठक-उपयोगिता, विशिष्टता और बौद्धिक स्वातंत्र्य के नाप से परखा गया है।";

const makeBook = (n: number, extra: Partial<Record<string, unknown>> = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  slug: `book-${n}`,
  seo_slug: `book-${n}`,
  title: `Book Number ${n}`,
  author: `Author ${n}`,
  category: "Business",
  language: "en",
  tagline: `Tagline for book ${n} that is different every single time across the corpus.`,
  overview: `Book Number ${n} tells its own distinct story about an unrelated subject, ${n}.`,
  deep_summary: `The deep summary of book ${n} covers chapters that no other book in this test corpus mentions, ${n}.`,
  key_ideas: `A unique first idea specific to book ${n} and nothing else in this synthetic corpus.`,
  deep_analysis: `Analysis for book ${n} discussing points that are entirely original to that single book, ${n}.`,
  daily_application: `Apply the distinctive lesson of book ${n} in a way that no other book suggests at all, ${n}.`,
  meta_title: `Book ${n} Summary | Test`,
  meta_description: `A unique description for book ${n} that does not repeat any template language from anywhere.`,
  ...extra,
});

// Six English template books: shared sentence + shared paragraph (2 sentences)
// + two signature phrases in the overview. Three of them share an identical
// overview fingerprint (>= 3 → group bonus).
// Under 120 chars so it does NOT also count as a shared paragraph — it must
// be caught by the exact-overview fingerprint group instead.
const TEMPLATE_OVERVIEW =
  "this Booknomics summary explains how the elements connect. Key anchors include planning and execution.";
const templateBooks = [1, 2, 3, 4, 5, 6].map((n) =>
  makeBook(n, {
    overview:
      n <= 3
        ? TEMPLATE_OVERVIEW
        : `Same style as the others: this Booknomics summary explains the elements, plus book ${n} specifics.`,
    deep_summary: `Opening line unique to book ${n} before the shared block begins. \n\n${SHARED_SENTENCE} \n\n${PARAGRAPH_A} \n\nClosing line unique to book ${n} after the shared block.`,
    key_ideas: `Key anchors include planning, execution, and review for book ${n}.`,
    deep_analysis:
      n <= 4
        ? `Unique analysis opener ${n}. ${SENTENCE_FOUR_BOOKS}`
        : `Unique analysis text for book ${n} with no shared material in it at all.`,
  })
);

// Five "medium" books sharing exactly one sentence (reaches the min of 5).
// One of them also has a signature phrase → score 4 + 6 = 10 → review band.
const MEDIUM_SENTENCE =
  "The middle band sentence repeated across five medium books to reach the shared minimum count.";
const mediumBooks = [7, 8, 9, 10, 11].map((n) =>
  makeBook(n, {
    key_ideas:
      n === 7
        ? `Idea ${n}. This piece offers a particular way of seeing the problem that few others attempt. ${MEDIUM_SENTENCE}`
        : `Idea ${n}. Different surrounding words here. ${MEDIUM_SENTENCE}`,
  })
);

// Four Hindi template books sharing a paragraph (2 sentences) + a sentence +
// one Hindi signature marker.
const hindiBooks = [13, 14, 15, 16].map((n) =>
  makeBook(n, {
    language: "hi",
    title: `हिंदी पुस्तक ${n}`,
    overview: `हिंदी सारांश ${n}: हिंदी साहित्य की एक अनमोल धरोहर पर आधारित यह स्वतंत्र अध्ययन है, ${n}।`,
    deep_summary: `प्रस्तावना ${n}। \n\n${HINDI_PARAGRAPH} \n\nसमापन ${n}।`,
    key_ideas: `विचार ${n}: पुस्तक की प्रमुख बातें यहाँ दी गई हैं, ${n}। ${HINDI_SENTENCE}`,
  })
);

const uniqueBooks = [12, 17].map((n) => makeBook(n));

const corpus = [...templateBooks, ...mediumBooks, ...hindiBooks, ...uniqueBooks];

describe("audit-template-content", () => {
  it("normalizes markdown and case", () => {
    expect(normalizeText("### Heading **Bold** &amp; <b>x</b> Text")).toBe("heading bold x text");
    expect(normalizeText("A  B\tC")).toBe(normalizeText("A B C"));
  });

  it("filters short sentences and keeps long ones", () => {
    const parts = splitSentences(
      "Too short. " + "This one is long enough to survive the filter because it has plenty of words in it. " + PARAGRAPH_A
    );
    expect(parts).not.toContain("Too short.");
    expect(parts).toContain("This one is long enough to survive the filter because it has plenty of words in it.");
  });

  it("extracts only 120+ char paragraphs", () => {
    const paragraphs = splitParagraphs(`short block\n\n${PARAGRAPH_A}`);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toContain("testable lens");
  });

  it("flags the template batches as noindex and uniques as keep", () => {
    const { results, summary } = auditBooks(corpus as never[]);
    const byId = new Map(results.map((r) => [r.id, r]));
    const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

    // Six EN template books: shared paragraph + 3 shared sentences; sig hits
    // are 2-5 (the shared block itself contains template phrases). Books 1-3
    // additionally share the exact overview fingerprint.
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const row = byId.get(id(n))!;
      expect(row.recommendation).toBe("noindex");
      expect(row.shared_paragraphs).toBe(1);
      expect(row.shared_sentences).toBe(3);
      expect(row.signature_hits).toBeGreaterThanOrEqual(2);
    }
    for (const n of [1, 2, 3]) expect(byId.get(id(n))!.overview_group_size).toBe(3);
    for (const n of [4, 5, 6]) expect(byId.get(id(n))!.overview_group_size).toBe(1);

    // Hindi template batch: shared paragraph + 2 shared sentences + 1 marker.
    for (const n of [13, 14, 15, 16]) {
      const row = byId.get(id(n))!;
      expect(row.recommendation).toBe("noindex");
      expect(row.shared_paragraphs).toBe(1);
      expect(row.language).toBe("hi");
    }

    // Medium band: book 7 has sig + shared sentence = review; 8-11 keep.
    expect(byId.get(id(7))!.recommendation).toBe("review");
    for (const n of [8, 9, 10, 11]) expect(byId.get(id(n))!.recommendation).toBe("keep");

    // Unique books: zero signals.
    for (const n of [12, 17]) {
      const row = byId.get(id(n))!;
      expect(row.score).toBe(0);
      expect(row.recommendation).toBe("keep");
    }

    // SENTENCE_FOUR_BOOKS is shared by only 4 books — below the threshold, so
    // books 1-4 do not count it (their shared_sentences stays at 3, not 4).
    expect(summary.by_recommendation.noindex).toBeGreaterThanOrEqual(10);
    expect(summary.total_books).toBe(corpus.length);
  });

  it("reports shared fragments and excludes below-threshold ones", () => {
    const { fragments } = auditBooks(corpus as never[]);
    const shared = fragments.filter((f) => f.type === "paragraph" && f.books >= 3);
    expect(shared.some((f) => f.text.includes("testable lens"))).toBe(true);
    expect(fragments.some((f) => f.text.includes("four of the generated summaries"))).toBe(false);
  });

  it("csv output quotes commas, quotes and newlines", () => {
    const csv = toCsv(["a", "b"], [{ a: 'has,comma', b: 'has "quotes"' }, { a: "line\nbreak", b: "plain" }]);
    expect(csv.split("\n")).toHaveLength(4); // line break stays inside one quoted field
    expect(csv).toContain('"has,comma"');
    expect(csv).toContain('"has ""quotes"""');
    expect(csv).toContain('"line\nbreak"');
  });
});
