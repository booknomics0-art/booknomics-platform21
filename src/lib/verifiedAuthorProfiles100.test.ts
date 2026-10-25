import { describe, expect, it } from "vitest";
import {
  findVerifiedAuthorProfile100,
  verifiedAuthorProfiles100Batch20261023,
} from "./verifiedAuthorProfiles100";

describe("verified 100-word author profiles", () => {
  it("contains uniquely identified, individually sourced author biographies", () => {
    const names = new Set<string>();
    for (const profile of verifiedAuthorProfiles100Batch20261023) {
      const normalized = profile.author.normalize("NFC").toLocaleLowerCase("und");
      expect(names.has(normalized)).toBe(false);
      names.add(normalized);
      const wordCount = profile.biography.trim().split(/\s+/u).length;
      expect(wordCount, `${profile.author} word count`).toBeGreaterThanOrEqual(90);
      expect(wordCount, `${profile.author} word count`).toBeLessThanOrEqual(110);
      expect(profile.sources.length).toBeGreaterThanOrEqual(2);
      expect(profile.sources.every((source) => /^https:\/\//u.test(source))).toBe(true);
      expect(new Set(profile.sources).size).toBe(profile.sources.length);
      expect(profile.famousBooks.length).toBeGreaterThanOrEqual(3);
      expect(new Set(profile.famousBooks).size).toBe(profile.famousBooks.length);
      expect(profile.biography).not.toMatch(/editorial review|pending editorial|इस पुस्तक के रचनाकार/u);
    }
  });

  it("finds exact names despite harmless spacing/casing differences", () => {
    expect(findVerifiedAuthorProfile100("  Stephen  KING ")?.author).toBe("Stephen King");
    expect(findVerifiedAuthorProfile100(" कृष्णा   सोबती ")?.author).toBe("कृष्णा सोबती");
  });

  it("does not misattribute an unknown or similarly named author", () => {
    expect(findVerifiedAuthorProfile100("Stephen King Jr.")).toBeUndefined();
    expect(findVerifiedAuthorProfile100("कृष्णा")).toBeUndefined();
  });
});
