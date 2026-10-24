import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BulkAudioUpload from "./BulkAudioUpload";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: "test-supabase-jwt" } }, error: null })) } },
}));

const BOOKS = [
  { id: "00000000-0000-4000-8000-000000000001", title: "White Fang", author: "Jack London", slug: "white-fang", language: "en", audio_url: null },
  { id: "00000000-0000-4000-8000-000000000002", title: "Victory", author: "Joseph Conrad", slug: "victory-a", language: "en", audio_url: null },
  { id: "00000000-0000-4000-8000-000000000003", title: "Victory", author: "Another Author", slug: "victory-b", language: "en", audio_url: null },
];

function mockCatalog() {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ books: BOOKS }) })));
}

afterEach(() => vi.unstubAllGlobals());

describe("BulkAudiobookUpload admin UI", () => {
  it("previews exact title matching and requires explicit review before upload", async () => {
    mockCatalog();
    render(<BulkAudioUpload />);
    await screen.findByText(/3 books for matching/);
    const file = new File([new Uint8Array([0x49, 0x44, 0x33])], "White_Fang.mp3", { type: "audio/mpeg" });
    fireEvent.change(screen.getByLabelText("Select MP3 files"), { target: { files: [file] } });
    expect(screen.getByText(/White Fang — Jack London/)).toBeTruthy();
    const uploadButton = screen.getByRole("button", { name: /Upload 1 MP3 to R2/i });
    expect(uploadButton.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed the book mappings/i }));
    await waitFor(() => expect(uploadButton.hasAttribute("disabled")).toBe(false));
  });

  it("refuses to silently auto-assign an ambiguous title", async () => {
    mockCatalog();
    render(<BulkAudioUpload />);
    await screen.findByText(/3 books for matching/);
    fireEvent.change(screen.getByLabelText("Select MP3 files"), {
      target: { files: [new File(["ID3"], "Victory.mp3", { type: "audio/mpeg" })] },
    });
    expect(screen.getByText(/No book selected/)).toBeTruthy();
    expect(screen.getByText(/Needs review: 1/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Upload 0 MP3s to R2/i }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Match/i }));
    await screen.findByText("Match audiobook with a book");
    expect(screen.getByText(/Joseph Conrad/)).toBeTruthy();
    expect(screen.getByText(/Another Author/)).toBeTruthy();
  });

  it("tracks upload completion separately from playable audio verification", async () => {
    const audioUrl = "/api/admin/audio/stream/00000000-0000-4000-8000-000000000001?expires=100&signature=abc";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => String(url).includes("/api/admin/audio/catalog")
      ? { ok: true, json: async () => ({ books: BOOKS }) }
      : { status: 206, body: null }));

    class FakeXHR {
      upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      onabort: (() => void) | null = null;
      status = 200;
      responseText = JSON.stringify({ audio_url: "r2-private:audiobooks/00000000-0000-4000-8000-000000000001/test.mp3", preview_url: audioUrl });
      timeout = 0;
      withCredentials = false;
      open() { /* captured by the fake */ }
      setRequestHeader() { /* captured by the fake */ }
      send(file: File) {
        this.upload.onprogress?.({ lengthComputable: true, loaded: file.size, total: file.size });
        queueMicrotask(() => this.onload?.());
      }
      abort() { this.onabort?.(); }
    }
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(function (this: HTMLMediaElement) {
      if (!this.hasAttribute("src")) return;
      Object.defineProperty(this, "duration", { configurable: true, value: 150 });
      queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata")));
    });

    try {
      render(<BulkAudioUpload />);
      await screen.findByText(/3 books for matching/);
      fireEvent.change(screen.getByLabelText("Select MP3 files"), {
        target: { files: [new File(["ID3test"], "White_Fang.mp3", { type: "audio/mpeg" })] },
      });
      fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed the book mappings/i }));
      fireEvent.click(screen.getByRole("button", { name: /Upload 1 MP3 to R2/i }));
      expect(await screen.findByText(/1 audiobook uploaded, linked, and passed the browser playback check/)).toBeTruthy();
      expect(screen.getByText(/Private R2 upload/)).toBeTruthy();
    } finally {
      load.mockRestore();
    }
  });
});
