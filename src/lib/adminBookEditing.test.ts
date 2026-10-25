import { describe, expect, it } from "vitest";
import { changedBookFields, type EditableBook } from "./adminBookEditing";

const base = {
  id: "176b3e49-c7a8-462a-95cb-9c756bbf4c1b",
  title: "$100M Leads", author: "Alex Hormozi", category: "Marketing", language: "en",
  slug: "100m-leads-alex-hormozi-summary", tagline: null,
  overview: "The real short summary", key_ideas: "Five real ideas",
  deep_summary: "The full journey in great detail", deep_analysis: "What most readers miss",
  daily_application: "Start with one channel", action_system: null,
  practice_tracker: null, reflection_questions: null, real_life_example: null,
  affiliate_link: null, cover_url: null, reading_time: 7, rating: 4.5, year: null,
} satisfies EditableBook;

describe("editor sends only actual changes", () => {
  it("does not overwrite deep sections when editing only an overview", () => {
    const { patch, expected } = changedBookFields(base, { ...base, overview: "Improved intro" });
    expect(patch).toEqual({ overview: "Improved intro" });
    expect(expected).toEqual({ overview: "The real short summary" });
  });

  it("preserves literal Markdown and supports intentional content removal", () => {
    const edited = { ...base, deep_analysis: "### Theme\n\n**This stays bold**", daily_application: "" };
    const { patch, expected } = changedBookFields(base, edited);
    expect(patch).toEqual({ deep_analysis: "### Theme\n\n**This stays bold**", daily_application: "" });
    expect(expected).toEqual({ deep_analysis: "What most readers miss", daily_application: "Start with one channel" });
  });

  it("has no patch for a newly loaded, unchanged book", () => {
    expect(changedBookFields(base, { ...base })).toEqual({ patch: {}, expected: {} });
  });
});
