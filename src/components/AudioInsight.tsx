import { useEffect, useRef, useState } from "react";
import { Headphones, Loader2, Pause, Play, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase, SUPABASE_URL, SUPABASE_KEY } from "@/integrations/supabase/client";
import { usePremium } from "@/hooks/usePremium";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function AudioInsightButton({ bookId, lang }: { bookId: string; lang: "en" | "hi" }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full gap-2 border-gold/40 text-primary hover:bg-gold/10"
          title={lang === "hi" ? "ऑडियो सुनें" : "Listen to audio"}
        >
          <Headphones className="h-4 w-4" />
          <span className="hidden sm:inline">{lang === "hi" ? "ऑडियो" : "Audio"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-0 border-0 bg-transparent shadow-none">
        <AudioInsight bookId={bookId} lang={lang} />
      </PopoverContent>
    </Popover>
  );
}

export function AudioInsight({ bookId, lang }: { bookId: string; lang: "en" | "hi" }) {
  const { isPremium } = usePremium();
  const { user } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { setUrl(null); setPlaying(false); }, [bookId, lang]);

  const generate = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/book-audio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ book_id: bookId, lang }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Audio failed" }));
        throw new Error(err.error || "Audio generation failed");
      }
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      setUrl(u);
      setTimeout(() => audioRef.current?.play(), 50);
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't generate audio");
    } finally { setLoading(false); }
  };

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play();
  };

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-gold/10 p-5 my-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-full bg-gold/20 flex items-center justify-center">
          <Headphones className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif font-semibold text-lg leading-tight">
            {lang === "hi" ? "ऑडियो इनसाइट" : "Audio Insight"}
          </div>
          <div className="text-xs text-muted-foreground">
            {isPremium
              ? (lang === "hi" ? "पूरा 4 मिनट का सारांश" : "Full 4-minute summary")
              : (lang === "hi" ? "60 सेकंड का प्रीव्यू • Premium में 4 मिनट" : "60-second preview • 4 min on Premium")}
          </div>
        </div>
        {!isPremium && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {!url ? (
        <Button onClick={generate} disabled={loading} className="w-full bg-gold text-primary-foreground hover:opacity-90 rounded-full gap-2">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {lang === "hi" ? "तैयार हो रहा है…" : "Generating…"}</> : <><Play className="h-4 w-4" /> {lang === "hi" ? "सुनें" : "Listen now"}</>}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button size="icon" onClick={toggle} aria-label={playing ? (lang === "hi" ? "ऑडियो रोकें" : "Pause audio") : (lang === "hi" ? "ऑडियो चलाएं" : "Play audio")} className="rounded-full bg-gold text-primary-foreground hover:opacity-90 h-11 w-11">
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <audio
              ref={audioRef}
              src={url}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              controls
              className="flex-1 h-10"
            />
          </div>
          {!isPremium && (
            <button
              onClick={() => nav(user ? "/pricing" : "/auth")}
              className="text-xs text-primary hover:underline w-full text-center"
            >
              {lang === "hi" ? "पूरा सुनने के लिए Premium लें →" : "Unlock the full 4-minute version →"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
