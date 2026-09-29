// Regression guard for public/robots.txt.
//
// Why this test exists: the live production robots.txt announced only
// sitemap.xml and image-sitemap.xml, so the dedicated book sitemap — the file
// that carries the actual money pages — was never announced to crawlers.
// This test fails loudly if a future edit drops a sitemap or starts blocking
// the public catalog for normal crawlers.
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const robots = readFileSync(resolve(process.cwd(), "public/robots.txt"), "utf8");

type Group = { agents: string[]; rules: string[] };

function parseGroups(text: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.split("#")[0].trim();
    if (!line.includes(":")) continue;
    const field = line.slice(0, line.indexOf(":")).trim().toLowerCase();
    const value = line.slice(line.indexOf(":") + 1).trim();
    if (field === "user-agent") {
      // A new user-agent line after rules starts a new group (per spec).
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && current) {
      current.rules.push(`${field}:${value}`);
    }
  }
  return groups;
}

const groups = parseGroups(robots);
const groupFor = (agent: string) => groups.find((g) => g.agents.includes(agent));

describe("public/robots.txt", () => {
  it("announces all three sitemaps", () => {
    for (const path of ["/sitemap.xml", "/books-sitemap.xml", "/image-sitemap.xml"]) {
      expect(robots).toContain(`Sitemap: https://booknomics.com${path}`);
    }
  });

  it("keeps the public catalog crawlable for every crawler", () => {
    const wildcard = groupFor("*");
    expect(wildcard, "a `User-agent: *` group is required").toBeDefined();

    const disallows = wildcard!.rules
      .filter((r) => r.startsWith("disallow:"))
      .map((r) => r.replace("disallow:", ""));

    expect(disallows).not.toContain("/");
    expect(disallows).not.toContain("/books");
    expect(disallows.some((r) => r.startsWith("/books"))).toBe(false);
  });

  it("keeps AI answer engines allowed while blocking SEO scrapers", () => {
    for (const bot of ["gptbot", "perplexitybot", "claudebot"]) {
      const group = groupFor(bot);
      expect(group, `${bot} group missing`).toBeDefined();
      expect(group!.rules).toContain("allow:/");
    }
    for (const bot of ["ahrefsbot", "semrushbot"]) {
      const group = groupFor(bot);
      expect(group, `${bot} group missing`).toBeDefined();
      expect(group!.rules).toContain("disallow:/");
    }
  });
});
