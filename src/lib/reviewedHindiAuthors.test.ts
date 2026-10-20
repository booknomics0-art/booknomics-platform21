import { describe, expect, it } from "vitest";
import { findReviewedAuthorProfile } from "./reviewedHindiAuthors";

describe("reviewed Hindi author biographies", () => {
  const cases: Array<[string,string]> = [
    ["जयशंकर प्रसाद", "कामायनी"],
    ["हरिवंश राय बच्चन", "मधुशाला"],
    ["श्रीलाल शुक्ल", "राग दरबारी"],
    ["भीष्म साहनी", "तमस"],
    ["रामधारी सिंह दिनकर", "रश्मिरथी"],
    ["फणीश्वर नाथ 'रेणु'", "मैला आँचल"],
    ["धर्मवीर भारती", "गुनाहों का देवता"],
  ];
  it.each(cases)("%s has a sourced, book-specific biography", (name, notableWork) => {
    const profile = findReviewedAuthorProfile(name);
    expect(profile).toBeDefined();
    expect(profile?.hi).toContain(notableWork);
    expect(profile?.hi.length).toBeGreaterThan(120);
    expect(profile?.source).toMatch(/^https:\/\//);
    expect(profile?.en.length).toBeGreaterThan(120);
  });
  it("does not invent a biography for an unreviewed author", () => {
    expect(findReviewedAuthorProfile("Unknown Writer")).toBeUndefined();
  });
});
