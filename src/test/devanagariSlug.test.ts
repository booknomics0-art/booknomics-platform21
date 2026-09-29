import { describe, it, expect } from "vitest";
import { parseBulkBooks } from "@/lib/bookParser";
import { toKebab, transliterateDevanagari, auditSeoSlug } from "@/lib/seoSlugTools";

const slugFor = (title: string, language = "Hindi") =>
  parseBulkBooks(
    `#BOOK_START\nTitle: ${title}\nAuthor: X\nLanguage: ${language}\n#HOOK\nh\n#BOOK_END`,
  ).books[0]?.slug ?? "";

/** parseBulkBooks appends a random 4-char suffix; strip it for comparisons. */
const withoutSuffix = (slug: string) => slug.replace(/-[a-z0-9]{4}$/, "");

describe("transliterateDevanagari", () => {
  it("keeps the inherent vowel inside words", () => {
    // Regression: मधुशाला used to become "mdhushala" because consonants never
    // received their inherent "a".
    expect(transliterateDevanagari("मधुशाला")).toBe("madhushala");
    expect(toKebab("कामायनी")).toBe("kamayani");
    expect(toKebab("रश्मिरथी")).toBe("rashmirathi");
  });

  it("drops the silent word-final schwa", () => {
    expect(toKebab("गोदान")).toBe("godan");
    expect(toKebab("गबन")).toBe("gaban");
    expect(toKebab("तमस")).toBe("tamas");
  });

  it("keeps the vowel before anusvara and after a final conjunct", () => {
    expect(toKebab("पंचतंत्र")).toBe("panchatantra");
    expect(toKebab("कुरुक्षेत्र")).toBe("kurukshetra");
    expect(toKebab("चित्रांगदा")).toBe("chitrangada");
  });

  it("leaves ASCII input untouched", () => {
    expect(toKebab("Atomic Habits")).toBe("atomic-habits");
    expect(toKebab("Zero to One & Beyond")).toBe("zero-to-one-and-beyond");
  });
});

describe("bookParser slug generation", () => {
  it("produces a real slug for Devanagari titles", () => {
    // Regression: these used to collapse to garbage like "-kwqk" / "--zkeh",
    // which generate-sitemap.ts then dropped, hiding the book from search.
    for (const title of ["चित्रा", "गोदान", "मधुशाला", "रश्मिरथी", "कामायनी", "आधा गाँव"]) {
      const slug = slugFor(title);
      expect(slug).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
      expect(slug.startsWith("-")).toBe(false);
      expect(slug).not.toMatch(/^-{1,2}[a-z0-9]{4}$/);
    }
    expect(withoutSuffix(slugFor("चित्रा"))).toBe("chitra");
    expect(withoutSuffix(slugFor("गोदान"))).toBe("godan");
  });

  it("leaves English slugs byte-identical to the previous behaviour", () => {
    const cases: [string, string][] = [
      ["Atomic Habits", "atomic-habits"],
      ["The 7 Habits of Highly Effective People", "the-7-habits-of-highly-effective-people"],
      ["Can't Hurt Me", "cant-hurt-me"],
      ["1984", "1984"],
      ["The Subtle Art of Not Giving a F*ck", "the-subtle-art-of-not-giving-a-fck"],
      ["Bhagavad Gita / Geeta", "bhagavad-gita-geeta"],
    ];
    for (const [title, expected] of cases) {
      expect(withoutSuffix(slugFor(title, "English"))).toBe(expected);
    }
  });

  it("never returns an empty base slug", () => {
    expect(withoutSuffix(slugFor("!!!", "English"))).toBe("book");
  });
});

describe("live sitemap safety", () => {
  // generate-sitemap.ts drops any slug whose audit score is below 30. These are
  // the slugs currently published on booknomics.com — none may regress.
  const LIVE_SLUGS = [
    "meghdutam", "srikant", "premashram", "rangbhumi", "sursagar", "kabir-beejak",
    "the-count-of-monte-cristo", "anna-karenina", "moby-dick", "war-and-peace",
    "chandrakanta-hi", "rashmirathi-hi", "mitro-marjani-hi", "parineeta-hi",
    "shekhar-ek-jeevani-hi", "devdas-hi", "panchatantra-hi", "hitopadesha-hi",
    "madhushala-hi", "anandmath-hi", "gandhi-autobiography-hi", "bhagavad-gita-hi",
    "tamas-bhisham-sahni-saransh-in-hindi", "aansu-jaishankar-prasad-saransh-in-hindi",
    "black-swan-summary-key-lessons", "atomic-habits", "deep-work", "godan", "gaban",
    "kamayani", "nirmala", "maila-anchal", "chanakya-niti", "kurukshetra", "aadha-gaon",
  ];

  it("keeps every published slug above the sitemap cutoff", () => {
    const dropped = LIVE_SLUGS.filter((slug) => {
      const audit = auditSeoSlug(slug);
      return !audit.ok && audit.score < 30;
    });
    expect(dropped).toEqual([]);
  });
});
