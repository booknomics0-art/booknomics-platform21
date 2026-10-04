import { describe, expect, it } from "vitest";
import { parseBulkBooks } from "@/lib/bookParser";

const wrap = (sections: string) => `#BOOK_START
Title: Example Book
Author: Example Author
Language: English
Category: History
#HOOK
A specific book hook
${sections}
#BOOK_END`;

describe("English content quality gate", () => {
  it("rejects repeated generic methodological boilerplate", () => {
    const raw = wrap(`#SUMMARY
A book-specific overview.

#KEY_INSIGHTS
Purpose and audience helps identify what the author treats as linguistic evidence.

#AUDIO_SCRIPT
### Purpose and Audience
This section raises a basic methodological question about description and prescription.

Evidence matters as well when evaluating the claim.

### Historical Context
This section raises a basic methodological question about description and prescription.

Evidence matters as well when evaluating the claim.

#APPLY_TODAY
Record one period assumption that should not be universalized.`);

    const result = parseBulkBooks(raw);
    expect(result.books).toHaveLength(0);
    expect(result.errors.join(" ")).toContain("English content looks like repeated/generic template text");
  });

  it("allows book-specific English analysis", () => {
    const raw = wrap(`#SUMMARY
The book follows a political coalition as it moves from reform to internal conflict, showing how institutional incentives change individual choices.

#KEY_INSIGHTS
- The central tension is between short-term stability and long-term legitimacy.
- The author uses two contrasting leaders to show how incentives shape judgment.

#APPLY_TODAY
Choose one decision in the book and list the immediate benefit, delayed cost, and alternative the character rejected.

#AUDIO_SCRIPT
### Institutional Pressure
The strongest part of the argument is the way the author connects formal rules with the private calculations of the main actors.

### Limits of the Argument
The book is less convincing when it treats one elite faction as representative of the wider public.`);

    const result = parseBulkBooks(raw);
    expect(result.errors).toEqual([]);
    expect(result.books).toHaveLength(1);
    expect(result.books[0].language).toBe("en");
  });

  it("normalizes literal line breaks and removes deep-analysis bold markup", () => {
    const raw = wrap(`#SUMMARY
A specific overview.

#KEY_INSIGHTS
- A specific insight.

#APPLY_TODAY
Test one claim against a concrete example.

#AUDIO_SCRIPT
### Analysis\\n\\nThe **important phrase** should remain readable without excessive inline bold.`);

    const result = parseBulkBooks(raw);
    expect(result.errors).toEqual([]);
    expect(result.books[0].deep_analysis).toBe("### Analysis\n\nThe important phrase should remain readable without excessive inline bold.");
  });
});
