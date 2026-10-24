import { useEffect, useState } from "react";
import type { QuizQuestion, Flashcard } from "@/components/MasteryTab";
import { apiFetch } from "@/lib/cloudflareApi";

export type ChapterMarker = { time: number; title: string };

export type BookAssets = {
  mindmap_url: string | null;
  audio_url: string | null;
  quiz_data: QuizQuestion[];
  flashcard_data: Flashcard[];
  chapter_markers: ChapterMarker[];
  status: string;
};

const emptyAssets: BookAssets = {
  mindmap_url: null,
  audio_url: null,
  quiz_data: [],
  flashcard_data: [],
  chapter_markers: [],
  status: "draft",
};

export function useBookAssets(bookId: string | undefined) {
  const [assets, setAssets] = useState<BookAssets | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const response = await apiFetch<{ data: BookAssets | null }>(`/api/book-assets/${encodeURIComponent(bookId)}`);
        if (!cancelled) setAssets(response.data ?? emptyAssets);
      } catch {
        if (!cancelled) setAssets(emptyAssets);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [bookId]);

  return { assets, loading };
}
