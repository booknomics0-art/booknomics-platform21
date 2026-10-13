import { describe, expect, it } from "vitest";
import { buildBookFaqs } from "./BookFAQ";

describe("buildBookFaqs", () => {
  it("covers high-intent Hindi author, work-type and summary questions", () => {
    const faqs = buildBookFaqs({
      title: "कंकाल",
      author: "जयशंकर प्रसाद",
      category: "उपन्यास",
      readingTime: 12,
      isHindi: true,
      tagline: "एक सामाजिक उपन्यास",
    });

    const questions = faqs.map((faq) => faq.q).join(" ");
    const answers = faqs.map((faq) => faq.a).join(" ");

    expect(questions).toContain("किसकी रचना है");
    expect(questions).toContain("लेखक कौन हैं");
    expect(questions).toContain("किस विधा");
    expect(questions).toContain("का सारांश क्या है");
    expect(answers).toContain("जयशंकर प्रसाद");
    expect(answers).toContain("उपन्यास");
  });

  it("keeps the English FAQ shape unchanged", () => {
    const faqs = buildBookFaqs({
      title: "Atomic Habits",
      author: "James Clear",
      category: "Self Help",
      readingTime: 12,
      isHindi: false,
    });

    expect(faqs).toHaveLength(4);
    expect(faqs[0].q).toBe("What is Atomic Habits about?");
  });
});
