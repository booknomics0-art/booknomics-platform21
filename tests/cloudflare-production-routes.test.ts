import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Cloudflare production Worker routes", () => {
  it("only handles API and media requests; Vercel keeps the website", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "wrangler.jsonc"), "utf8"));
    const routes = config.routes.map((route: { pattern: string }) => route.pattern).sort();

    expect(routes).toEqual([
      "booknomics.com/api/*",
      "booknomics.com/media/*",
      "www.booknomics.com/api/*",
      "www.booknomics.com/media/*",
    ]);
    expect(routes).not.toContain("booknomics.com/*");
    expect(routes).not.toContain("www.booknomics.com/*");
  });
});
