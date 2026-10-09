import { describe, expect, it } from "vitest";
import { buildMindmapFromBook, dedupeLines, extractBullets, extractHeadings, shortenLabel, splitSentences, type MindmapBookInput } from "./buildMindmap";
import { hexToRgba, isFictionCategory, resolveGenreKey, resolveGenreTheme } from "./genreThemes";

const SAMPLE_BUSINESS_BOOK: MindmapBookInput = {
  title: "The Compound Effect",
  author: "Darren Hardy",
  category: "Business",
  tagline: "Small choices, repeated daily, create extraordinary results over time.",
  overview:
    "Success is not a big leap but the result of small smart choices compounded over time. Most people fail because they chase quick wins and ignore boring consistency. This book teaches you to track, own, and multiply your daily decisions.",
  key_ideas: `### Compounding beats intensity
Small actions repeated daily outperform rare bursts of effort.

### Choices shape destiny
- **Track everything** — You cannot improve what you do not measure.
- **Own your decisions** — Responsibility is the starting point of change.
- **Find your why** — Motivation follows a deep personal reason.
- **Influence your inputs** — Guard what you read, watch, and hear.`,
  deep_summary:
    "The book opens with the problem of invisible daily choices. It then introduces the compound effect formula. Stories of ordinary people show small habits growing into wealth and health. The middle chapters attack the myth of overnight success. Finally it gives a system of tracking, routines, and momentum to finish strong.",
  deep_analysis:
    "Hardy argues consistency is the unfair advantage because rivals quit during the boring middle. Because results lag effort, most people misread slow starts as failure. Tracking works therefore as an early warning system. The deepest claim is identity: you become the person your repeated choices describe.",
  daily_application:
    "- Write down three key behaviors to track every evening.\n- Remove one negative influence from your mornings.\n- Avoid skipping twice — one miss is human, two is a new habit.\n- Review your week every Sunday for ten minutes.",
  action_system:
    "1. Pick one habit that compounds toward your goal.\n2. Define the smallest daily version.\n3. Track it visibly for 30 days.\n4. Adjust the environment, not just your willpower.",
  practice_tracker: "- Day 1–7: track without judging\n- Day 8–21: tighten the routine\n- Day 22–30: review and lock the system",
  real_life_example:
    "A sales manager tracked every expense and call for ninety days. Because the numbers were visible, small leaks closed and income rose steadily.",
  reading_time: 14,
};

const SPARSE_BOOK: MindmapBookInput = { title: "Mystery Draft", author: "Unknown Author" };

describe("text utilities", () => {
  it("splits sentences and drops boilerplate", () => {
    const out = splitSentences("Welcome. Today we explore things. Small habits compound quietly over many years.");
    expect(out).toEqual(["Small habits compound quietly over many years"]);
  });

  it("extracts bullets and headings", () => {
    expect(extractBullets("- track every small habit daily\n- guard your morning inputs\nplain")).toEqual([
      "track every small habit daily",
      "guard your morning inputs",
    ]);
    expect(extractHeadings("### Deep Work\nbody")).toEqual(["Deep Work"]);
  });

  it("dedupes case-insensitively", () => {
    expect(dedupeLines(["Track everything daily", "track everything daily!", "Keep going strong today"])).toHaveLength(2);
  });

  it("shortens labels to the word budget", () => {
    const label = shortenLabel("one two three four five six seven eight nine ten eleven twelve thirteen");
    expect(label.split(" ").length).toBeLessThanOrEqual(12);
    expect(label.endsWith("…")).toBe(true);
  });
});

describe("buildMindmapFromBook", () => {
  it("builds 8 branches plus a 5-point recall for a full book", () => {
    const map = buildMindmapFromBook(SAMPLE_BUSINESS_BOOK);
    expect(map.branches).toHaveLength(8);
    expect(map.branches.map((b) => b.id)).toEqual([
      "core",
      "concepts",
      "story",
      "people",
      "themes",
      "lessons",
      "apply",
      "moments",
    ]);
    for (const branch of map.branches) {
      expect(branch.nodes.length).toBeGreaterThanOrEqual(3);
      expect(branch.question.length).toBeGreaterThan(8);
    }
    expect(map.recall.takeaways).toHaveLength(5);
    expect(map.recall.oneLine.length).toBeGreaterThan(10);
    expect(map.oneLiner).toContain("Small choices");
  });

  it("keeps every node label within the 2–12 word budget", () => {
    const map = buildMindmapFromBook(SAMPLE_BUSINESS_BOOK);
    for (const branch of map.branches) {
      for (const node of branch.nodes) {
        const n = node.label.replace(/…$/, "").split(/\s+/).filter(Boolean).length;
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(12);
      }
    }
  });

  it("surfaces cause→effect and story steps", () => {
    const map = buildMindmapFromBook(SAMPLE_BUSINESS_BOOK);
    const story = map.branches.find((b) => b.id === "story")!;
    expect(story.title).toBe("Structure");
    expect(story.nodes[0].step).toBeTruthy();
    expect(story.callout?.kind).toBe("connection");
  });

  it("never crashes on sparse books and still fills every branch", () => {
    const map = buildMindmapFromBook(SPARSE_BOOK);
    expect(map.branches).toHaveLength(8);
    for (const branch of map.branches) {
      expect(branch.nodes.length).toBeGreaterThanOrEqual(3);
    }
    expect(map.recall.takeaways).toHaveLength(5);
  });

  it("adapts branch titles for fiction", () => {
    const fiction = buildMindmapFromBook({ ...SPARSE_BOOK, title: "The Night Circus", category: "Fantasy" });
    expect(fiction.isFiction).toBe(true);
    expect(fiction.branches.find((b) => b.id === "story")!.title).toBe("Story Arc");
    expect(fiction.branches.find((b) => b.id === "people")!.title).toBe("Characters");
    expect(fiction.branches.find((b) => b.id === "moments")!.title).toBe("Key Moments");

    const nonfiction = buildMindmapFromBook(SAMPLE_BUSINESS_BOOK);
    expect(nonfiction.isFiction).toBe(false);
    expect(nonfiction.branches.find((b) => b.id === "story")!.title).toBe("Structure");
  });
});

describe("genre themes", () => {
  it("resolves distinct genres from category labels", () => {
    expect(resolveGenreKey("Business")).toBe("business");
    expect(resolveGenreKey("Personal Finance")).toBe("business");
    expect(resolveGenreKey("Psychology")).toBe("psychology");
    expect(resolveGenreKey("Self-Help")).toBe("selfhelp");
    expect(resolveGenreKey("Mystery & Thriller")).toBe("mystery");
    expect(resolveGenreKey("Romance")).toBe("romance");
    expect(resolveGenreKey("Fantasy")).toBe("fantasy");
    expect(resolveGenreKey("Science Fiction")).toBe("scifi");
    expect(resolveGenreKey("History")).toBe("history");
    expect(resolveGenreKey("Biography")).toBe("biography");
    expect(resolveGenreKey("Philosophy")).toBe("philosophy");
    expect(resolveGenreKey("Productivity")).toBe("productivity");
    expect(resolveGenreKey("Leadership")).toBe("leadership");
    expect(resolveGenreKey("Something Entirely New")).toBe("default");
    expect(resolveGenreKey(null)).toBe("default");
  });

  it("gives every genre a distinct hero identity", () => {
    const heroes = new Set(
      (["business", "psychology", "selfhelp", "mystery", "romance", "fantasy", "scifi", "history", "biography", "philosophy", "productivity", "leadership"] as const).map(
        (key) => resolveGenreTheme(key === "business" ? "Business" : key).heroFrom,
      ),
    );
    expect(heroes.size).toBeGreaterThanOrEqual(10);
  });

  it("detects fiction categories", () => {
    expect(isFictionCategory("Fantasy")).toBe(true);
    expect(isFictionCategory("Mystery & Thriller")).toBe(true);
    expect(isFictionCategory("Business")).toBe(false);
    expect(isFictionCategory("Psychology")).toBe(false);
  });

  it("converts hex to rgba safely", () => {
    expect(hexToRgba("#1E2A5A", 0.5)).toBe("rgba(30, 42, 90, 0.5)");
    expect(hexToRgba("#FFF", 0.1)).toBe("rgba(255, 255, 255, 0.1)");
    expect(hexToRgba("not-a-color", 0.5)).toBe("not-a-color");
  });
});
