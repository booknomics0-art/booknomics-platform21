import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCloudflareAuthorBio, parseCloudflareAuthorBio } from "./cloudflareAuthorBio";

const identity = {
  bookId: "12345678-1234-1234-1234-123456789012",
  slug: "alice-in-wonderland",
  title: "Alice's Adventures in Wonderland",
  author: "Lewis Carroll",
};

const essay = `${identity.author} wrote ${identity.title}. ${"His mathematical training informs this unusual work. ".repeat(57)}`;
const valid = {
  data: {
    id: identity.bookId,
    slug: identity.slug,
    title: identity.title,
    author: identity.author,
    status: "published",
    is_draft: 0,
    language: "en",
    author_bio: essay,
    author_bio_status: "reviewed",
    author_bio_sources: JSON.stringify(["https://www.maths.ox.ac.uk/", "https://www.penguinrandomhouse.com/"]),
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare-backed Mastery author biographies", () => {
  it("accepts a matching reviewed 400-word book-specific essay with two sources", () => {
    expect(essay.trim().split(/\s+/u).length).toBeGreaterThanOrEqual(350);
    expect(essay.trim().split(/\s+/u).length).toBeLessThanOrEqual(460);
    expect(parseCloudflareAuthorBio(valid, identity)).toEqual({
      text: essay.trim(),
      language: "en",
      sources: ["https://www.maths.ox.ac.uk/", "https://www.penguinrandomhouse.com/"],
    });
  });

  it("also accepts a reviewed, source-backed 200-word profile for the new cohort", () => {
    const shortEssay = `${identity.author} wrote ${identity.title}. ${"Wonderland puts ordinary language and authority under playful scrutiny. ".repeat(21)}`;
    expect(shortEssay.trim().split(/\s+/u).length).toBeGreaterThanOrEqual(180);
    expect(shortEssay.trim().split(/\s+/u).length).toBeLessThanOrEqual(240);
    expect(parseCloudflareAuthorBio({ data: { ...valid.data, author_bio: shortEssay } }, identity)?.text).toBe(shortEssay.trim());
  });

  it("rejects draft or unreviewed text, even if it is lengthy", () => {
    expect(parseCloudflareAuthorBio({ data: { ...valid.data, author_bio_status: "draft" } }, identity)).toBeNull();
    expect(parseCloudflareAuthorBio({ data: { ...valid.data, author_bio_status: null } }, identity)).toBeNull();
  });

  it("rejects wrong book identity or unpublished rows", () => {
    expect(parseCloudflareAuthorBio({ data: { ...valid.data, id: "other" } }, identity)).toBeNull();
    expect(parseCloudflareAuthorBio({ data: { ...valid.data, author: "Unrelated Writer" } }, identity)).toBeNull();
    expect(parseCloudflareAuthorBio({ data: { ...valid.data, status: "pending" } }, identity)).toBeNull();
  });

  it("rejects short biographies and unsafe, duplicate or missing sources", () => {
    expect(parseCloudflareAuthorBio({ data: { ...valid.data, author_bio: "short bio" } }, identity)).toBeNull();
    expect(parseCloudflareAuthorBio({ data: { ...valid.data, author_bio_sources: '["javascript:alert(1)"]' } }, identity)).toBeNull();
    expect(parseCloudflareAuthorBio({ data: { ...valid.data, author_bio_sources: '["https://a.example", "https://a.example"]' } }, identity)).toBeNull();
    expect(parseCloudflareAuthorBio({ data: { ...valid.data, author_bio_sources: "invalid json" } }, identity)).toBeNull();
  });

  it("fetches the D1-backed book row using its exact stored slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => valid });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchCloudflareAuthorBio(identity)).toEqual(parseCloudflareAuthorBio(valid, identity));
    expect(fetchMock).toHaveBeenCalledWith("/api/books/alice-in-wonderland", expect.objectContaining({ credentials: "omit" }));
  });

  it("does not disrupt the tab when the Worker endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchCloudflareAuthorBio(identity)).toBeNull();
  });
});
