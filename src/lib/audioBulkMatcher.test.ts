import { describe, expect, it } from "vitest";
import { matchAudioFilename, normalizedAudioTitle, type AudioCatalogBook } from "./audioBulkMatcher";

const makeBook = (id: string, title: string, language = "en", audio_url: string | null = null): AudioCatalogBook => ({
  id, title, author: "Author", slug: title.toLowerCase().replace(/\s+/g, "-"), language, audio_url,
});

describe("audiobook filename matching", () => {
  it("normalizes underscores, punctuation and common audio suffixes", () => {
    expect(normalizedAudioTitle("The_Three_Musketeers-Hindi_Audio.mp3")).toBe("the three musketeers");
    expect(normalizedAudioTitle("White_Fang (2).MP3")).toBe("white fang");
  });

  it("autoselects a single exact title, never an approximate one", () => {
    const books = [makeBook("1", "White Fang"), makeBook("2", "The Three Musketeers")];
    expect(matchAudioFilename("White_Fang.mp3", books)).toMatchObject({ bookId: "1", reason: "exact" });
    expect(matchAudioFilename("Three_Musketters.mp3", books)).toMatchObject({ bookId: null, reason: "suggestion" });
  });

  it("matches Unicode Hindi names without discarding vowel marks", () => {
    const title = "गोदान";
    expect(normalizedAudioTitle(`${title}.mp3`)).toBe(title);
    expect(matchAudioFilename(`${title}.mp3`, [makeBook("hi1", title, "hi")])).toMatchObject({ bookId: "hi1", reason: "exact" });
  });

  it("requires manual choice for multiple exact matches or existing audio", () => {
    const books = [makeBook("en1", "Victory", "en"), makeBook("en2", "Victory", "en")];
    expect(matchAudioFilename("victory.mp3", books)).toMatchObject({ bookId: null, reason: "ambiguous" });
    expect(matchAudioFilename("She.mp3", [makeBook("3", "She", "en", "https://example.com/old.mp3")]))
      .toMatchObject({ bookId: null, reason: "existing-audio" });
  });

  it("honors explicit language hints", () => {
    const books = [makeBook("hi", "Godan", "hi"), makeBook("en", "Godan", "en")];
    expect(matchAudioFilename("Godan_Hindi.mp3", books)).toMatchObject({ bookId: "hi", reason: "exact" });
    expect(matchAudioFilename("Godan.mp3", books)).toMatchObject({ bookId: null, reason: "ambiguous" });
  });

  it("does not guess short or unrelated names", () => {
    expect(matchAudioFilename("123.mp3", [makeBook("1", "Treasure Island")])).toMatchObject({ bookId: null, reason: "none" });
  });
});
