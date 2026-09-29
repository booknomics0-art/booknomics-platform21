// Manual social caption templates. Zero AI calls.
import type { BookForAudit } from "./seoScore";
import { bookUrl } from "./seoScore";

export type Platform = "youtube" | "pinterest" | "instagram" | "facebook" | "threads";

export const PLATFORMS: Platform[] = ["youtube", "pinterest", "instagram", "facebook", "threads"];

const tagsFor = (book: BookForAudit) => {
  const cat = (book.category || "").toLowerCase().replace(/\s+/g, "");
  const base = ["booknomics", "booksummary", "readingcommunity", "bookrecommendations"];
  if (cat) base.push(cat);
  if (book.language === "hi") base.push("hindibooks", "hindisummary");
  return base.map(t => `#${t}`).join(" ");
};

const firstIdea = (book: BookForAudit) => {
  const ki = (book.key_ideas || "").split(/\n+/).find(l => l.trim().length > 5) || book.tagline || "";
  return ki.replace(/^[-•*\d.)\s]+/, "").trim().slice(0, 140);
};

export function generatePost(platform: Platform, book: BookForAudit) {
  const url = bookUrl(book.slug);
  const tags = tagsFor(book);
  const idea = firstIdea(book);

  switch (platform) {
    case "youtube":
      return {
        title: `${book.title} — Summary in 3 Minutes (Key Ideas)`,
        description:
          `${book.title} by ${book.author} — full summary, key ideas & action steps.\n\n` +
          `Read the full breakdown: ${url}\n\nChapters:\n0:00 Intro\n0:30 Big Idea\n1:30 Key Ideas\n2:30 Apply Today\n\n${tags}`,
        body:
          `Hook: ${idea}\n\n[Open with the single most surprising idea from the book]\n\n` +
          `Mid: Walk through 3 key ideas with one example each.\n\n` +
          `End: 'Try this today' + link in description.`,
      };
    case "pinterest":
      return {
        title: `${book.title} — 5 Key Ideas`,
        description:
          `${book.title} by ${book.author}. ${idea} Save this pin & read the full summary on Booknomics. ${tags}`,
        body:
          `Pin idea: 1080×1920 portrait. Bold serif title "${book.title}". Subtitle "5 lessons in 60 seconds". Background: muted gold/parchment.`,
      };
    case "instagram":
      return {
        title: `${book.title} carousel`,
        description:
          `${idea}\n\n📖 ${book.title} by ${book.author}\n` +
          `🔗 Full summary in bio link\n\n${tags}`,
        body:
          `Slide 1 (hook): "${idea}"\n` +
          `Slides 2–6: One key idea per slide (15 words max each)\n` +
          `Slide 7: 'Apply today' action\n` +
          `Slide 8: CTA — "Save & share, full summary in bio"`,
      };
    case "facebook":
      return {
        title: `${book.title} post`,
        description:
          `${idea}\n\nWe broke down ${book.title} by ${book.author} into a 3-minute read with the key ideas and one action you can take today.\n\n${url}\n\n${tags}`,
        body: "Use as a Page post and inside relevant book/reading groups.",
      };
    case "threads":
      return {
        title: `${book.title} thread`,
        description:
          `${idea}\n\n— from ${book.title} by ${book.author}.\n` +
          `Full 3-min summary: ${url}`,
        body:
          `Post 1 (hook): ${idea}\n` +
          `Post 2: The core idea in one sentence.\n` +
          `Post 3: 3 key takeaways (bullets).\n` +
          `Post 4: One action to try today.\n` +
          `Post 5: Link + soft CTA to follow @booknomics.`,
      };
  }
}
