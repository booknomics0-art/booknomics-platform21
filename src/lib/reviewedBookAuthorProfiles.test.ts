import { describe, expect, it } from "vitest";
import cohort from "../../reports/quiz-batch-100-20261021.json";
import { findReviewedBookAuthorProfile, reviewedBookAuthorProfiles } from "./reviewedBookAuthorProfiles";

describe("individually reviewed Mastery author essays", () => {
  it("uses exact published-book identities from the verified editorial cohort", () => {
    const known = new Map(cohort.map(book => [book.id, book]));
    const ids = new Set<string>();
    for (const profile of reviewedBookAuthorProfiles) {
      expect(ids.has(profile.bookId)).toBe(false);
      ids.add(profile.bookId);
      const book = known.get(profile.bookId);
      expect(book).toBeDefined();
      expect(profile.title).toBe(book?.title);
      expect(profile.author).toBe(book?.author);
      expect(profile.language).toBe(book?.language);
      expect(findReviewedBookAuthorProfile(profile.bookId)).toBe(profile);
    }
  });

  it("has substantial book-specific editorial writing and traceable sources", () => {
    for (const profile of reviewedBookAuthorProfiles) {
      const wordCount = profile.text.trim().split(/\s+/u).length;
      expect(wordCount, `${profile.title} has ${wordCount} words`).toBeGreaterThanOrEqual(350);
      expect(wordCount, `${profile.title} has ${wordCount} words`).toBeLessThanOrEqual(460);
      expect(profile.text).toContain(profile.title);
      expect(profile.text).toContain(profile.author);
      expect(profile.sources.length).toBeGreaterThanOrEqual(1);
      expect(new Set(profile.sources).size).toBe(profile.sources.length);
      for (const source of profile.sources) expect(source).toMatch(/^https:\/\//);
    }
  });

  it("does not repeat the same biography across different books by one author", () => {
    const premchand = reviewedBookAuthorProfiles.filter(profile => profile.author === "मुंशी प्रेमचंद");
    expect(premchand.length).toBeGreaterThanOrEqual(2);
    expect(new Set(premchand.map(profile => profile.text)).size).toBe(premchand.length);
  });

  it("never claims an unreviewed book has a specific profile", () => {
    expect(findReviewedBookAuthorProfile("00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });
});
