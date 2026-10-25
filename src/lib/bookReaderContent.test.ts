import { describe, expect, it } from "vitest";
import { buildReaderMarkdown, buildReaderSections } from "./bookReaderContent";

describe("public and admin share the same reader sections", () => {
  const content = {
    overview: "Alex Hormozi's $100M Leads explains customer acquisition.",
    key_ideas: [
      "- The Core Four include warm outreach, cold outreach, content, and ads, each with different trade-offs.",
      "- Lead magnets build trust by solving a narrow specific problem before asking for a commitment.",
    ].join("\n"),
    deep_summary: "### The Core Four\n\nEach channel has different economics.",
    deep_analysis: "### Limitations\n\nAn acquisition system also needs retention.",
    daily_application: "Pick one channel and measure its funnel today.",
  };

  it("maps complete D1 fields to all six public sections", () => {
    const sections = buildReaderSections(content, "en");
    expect(sections).toHaveLength(6);
    expect(sections.map((section) => section.field)).toEqual([
      "overview", "key_ideas", "deep_summary", "key_ideas", "deep_analysis", "daily_application",
    ]);
    expect(buildReaderMarkdown(content, "en")).toContain("## Detailed summary\n\n### The Core Four");
  });

  it("does not replace full-depth writing with an old overview", () => {
    const sections = buildReaderSections(content, "en");
    expect(sections.find((section) => section.field === "deep_summary")?.text).toBe(content.deep_summary);
    expect(sections.find((section) => section.field === "deep_analysis")?.text).toBe(content.deep_analysis);
  });

  it("keeps the legacy fallback only for books without deep_summary", () => {
    const sections = buildReaderSections({ ...content, deep_summary: null }, "en");
    expect(sections.find((section) => section.field === "deep_summary")?.text).toContain("### Limitations");
  });

  it("still filters low-signal Hindi takeaways", () => {
    const sections = buildReaderSections({ key_ideas: "यह दिखाता है कि। यह दिखाता है कि। यह दिखाता है कि। यह दिखाता है कि।" }, "hi");
    expect(sections.some((section) => section.field === "key_ideas")).toBe(false);
  });
});
