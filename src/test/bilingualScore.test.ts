import { describe, it, expect } from "vitest";
import {
  splitSentences,
  countWords,
  auditPolish,
  auditHumanized,
  type BookForAudit,
} from "@/lib/seoScore";

const HINDI_PARAGRAPH = [
  "चित्रांगदा मणिपुर की राजकुमारी थी। उसे पुत्र की तरह पाला गया।",
  "उदाहरण के लिए, वह धनुष चलाना जानती थी और सेना का नेतृत्व करती थी।",
  "आप सोचिए कि सात दिन तक कोई अपना असली रूप छिपाए तो क्या होगा?",
  "मान लीजिए वरदान एक साल का है। तब भी वह लौटाना पड़ेगा।",
].join(" ");

const hindiBook = (overrides: Partial<BookForAudit> = {}): BookForAudit => ({
  id: "hi-1",
  slug: "chitra-saransh-in-hindi",
  title: "चित्रा",
  author: "रवींद्रनाथ ठाकुर",
  category: "साहित्य",
  language: "hi",
  overview: HINDI_PARAGRAPH.repeat(12),
  key_ideas: "- मुखौटा पहनकर मिला प्रेम अधूरा है\n- सौंदर्य उधार है\n- चरित्र संपत्ति है",
  deep_analysis: HINDI_PARAGRAPH.repeat(6),
  daily_application: "आज एक जगह चुनिए जहाँ आप अभिनय करते हैं और वहाँ एक सच कह दीजिए।",
  action_system: "1. सूची बनाइए\n2. एक सच कहिए\n3. सात दिन तक दोहराइए",
  reflection_questions: "आपका असली रूप कौन जानता है?",
  ...overrides,
});

describe("splitSentences", () => {
  it("treats the Hindi danda as a sentence boundary", () => {
    // Regression: splitting on [.!?] only saw one giant sentence, so a 2,600
    // word Hindi summary was scored as "2 words".
    expect(splitSentences("पहला वाक्य। दूसरा वाक्य। तीसरा वाक्य।")).toHaveLength(3);
    expect(splitSentences("श्लोक एक॥ श्लोक दो॥")).toHaveLength(2);
  });

  it("still splits English punctuation", () => {
    expect(splitSentences("One. Two! Three?")).toHaveLength(3);
  });
});

describe("countWords", () => {
  it("counts Devanagari words", () => {
    expect(countWords("यह एक वाक्य है")).toBe(4);
  });
});

describe("auditPolish on Hindi content", () => {
  it("measures real length instead of reporting near-zero", () => {
    const result = auditPolish(hindiBook());
    const length = result.checks.find((c) => c.id === "length_ok");
    expect(length?.passed).toBe(true);
    expect(Number(length?.detail?.replace(/\D/g, ""))).toBeGreaterThan(400);
  });

  it("computes a sane average sentence length", () => {
    const variety = auditPolish(hindiBook()).checks.find((c) => c.id === "sentence_variety");
    expect(variety?.passed).toBe(true);
  });
});

describe("auditHumanized on Hindi content", () => {
  it("recognises Hindi second-person address", () => {
    const check = auditHumanized(hindiBook()).checks.find((c) => c.id === "second_person");
    expect(check?.passed).toBe(true);
  });

  it("recognises Hindi example markers", () => {
    const check = auditHumanized(hindiBook()).checks.find((c) => c.id === "examples");
    expect(check?.passed).toBe(true);
  });

  it("recognises Hindi time spans as concrete numbers", () => {
    const check = auditHumanized(hindiBook()).checks.find((c) => c.id === "concrete_numbers");
    expect(check?.passed).toBe(true);
  });

  it("still flags Hindi AI clichés", () => {
    const book = hindiBook({ overview: "आज की तेज़-रफ़्तार दुनिया में सब बदल रहा है। " + HINDI_PARAGRAPH });
    const check = auditHumanized(book).checks.find((c) => c.id === "ai_cliches");
    expect(check?.passed).toBe(false);
  });
});

describe("English scoring is unchanged", () => {
  const englishBook: BookForAudit = {
    id: "en-1",
    slug: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    category: "Self-Help",
    language: "en",
    overview:
      "You want change. For example, consider a runner who improves one percent each day for 30 days. " +
      "Habits hold because the environment cues them, not because motivation arrives on time. ".repeat(30),
    key_ideas: "- Make it obvious\n- Make it easy\n- Identity precedes behaviour",
    deep_analysis: "Imagine your phone on the desk. It quietly costs you 20 minutes every day.",
    daily_application: "Remove one distraction from your desk today and notice what changes.",
    action_system: "1. Pick a habit\n2. Stack it onto a routine\n3. Track it for 30 days",
    reflection_questions: "Which habit is quietly deciding your future?",
  };

  it("passes the humanness cues it passed before", () => {
    const result = auditHumanized(englishBook);
    for (const id of ["second_person", "examples", "concrete_numbers", "ai_cliches"]) {
      expect(result.checks.find((c) => c.id === id)?.passed).toBe(true);
    }
  });

  it("keeps English sentence splitting intact", () => {
    const variety = auditPolish(englishBook).checks.find((c) => c.id === "sentence_variety");
    expect(variety?.passed).toBe(true);
  });
});
