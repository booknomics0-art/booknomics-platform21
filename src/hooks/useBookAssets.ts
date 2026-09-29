import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { QuizQuestion, Flashcard } from "@/components/MasteryTab";

export type ChapterMarker = { time: number; title: string };

export type BookAssets = {
  mindmap_url: string | null;
  audio_url: string | null;
  quiz_data: QuizQuestion[];
  flashcard_data: Flashcard[];
  chapter_markers: ChapterMarker[];
  status: string;
};

// Convert any URL pointing to the private `book-assets` bucket into a
// short-lived signed URL so the browser can actually load it.
async function toSignedIfPrivate(url: string | null): Promise<string | null> {
  if (!url) return null;
  const marker = "/book-assets/";
  const i = url.indexOf(marker);
  if (i === -1) return url;
  // strip everything up to and including `/book-assets/`
  const path = url.slice(i + marker.length).split("?")[0];
  const { data, error } = await supabase.storage
    .from("book-assets")
    .createSignedUrl(path, 60 * 60 * 6); // 6h
  if (error || !data?.signedUrl) return url; // fall back to original
  return data.signedUrl;
}

export function useBookAssets(bookId: string | undefined) {
  const [assets, setAssets] = useState<BookAssets | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("book_assets")
        .select("mindmap_url,audio_url,quiz_data,flashcard_data,chapter_markers,status")
        .eq("book_id", bookId)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        setAssets({ mindmap_url: null, audio_url: null, quiz_data: [], flashcard_data: [], chapter_markers: [], status: "draft" });
      } else {
        const [signedAudio, signedMap] = await Promise.all([
          toSignedIfPrivate(data.audio_url),
          toSignedIfPrivate(data.mindmap_url),
        ]);
        if (cancelled) return;
        setAssets({
          mindmap_url: signedMap,
          audio_url: signedAudio,
          quiz_data: Array.isArray(data.quiz_data) ? (data.quiz_data as any) : [],
          flashcard_data: Array.isArray(data.flashcard_data) ? (data.flashcard_data as any) : [],
          chapter_markers: Array.isArray((data as any).chapter_markers) ? ((data as any).chapter_markers as any) : [],
          status: data.status,
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  return { assets, loading };
}
