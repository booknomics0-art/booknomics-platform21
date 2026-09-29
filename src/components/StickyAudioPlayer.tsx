import { useEffect, useRef, useState } from "react";
import { Play, Pause, X, Volume2, Gauge, Rewind, FastForward, ListMusic, AlertCircle } from "lucide-react";
import type { ChapterMarker } from "@/hooks/useBookAssets";

const SPEEDS = [1, 1.25, 1.5, 2];

export function StickyAudioPlayer({
  src, title, onClose, chapters = [], artwork,
}: {
  src: string;
  title: string;
  onClose: () => void;
  chapters?: ChapterMarker[];
  artwork?: string | null;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(true);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [err, setErr] = useState(false);
  const [showChapters, setShowChapters] = useState(false);

  useEffect(() => {
    const a = ref.current; if (!a) return;
    a.playbackRate = speed;
    a.volume = vol;
    a.play().catch(() => setPlaying(false));
    if ("mediaSession" in navigator) {
      const meta: MediaMetadataInit = { title, artist: "Booknomics", album: "Book Summary" };
      if (artwork) meta.artwork = [{ src: artwork, sizes: "512x512", type: "image/png" }];
      navigator.mediaSession.metadata = new MediaMetadata(meta);
      navigator.mediaSession.setActionHandler("play", () => a.play());
      navigator.mediaSession.setActionHandler("pause", () => a.pause());
      navigator.mediaSession.setActionHandler("seekbackward", () => { a.currentTime = Math.max(0, a.currentTime - 15); });
      navigator.mediaSession.setActionHandler("seekforward", () => { a.currentTime = Math.min(a.duration || 0, a.currentTime + 15); });
    }
    const key = `audio-pos:${src}`;
    const saved = Number(localStorage.getItem(key) || 0);
    if (saved > 5 && saved < (a.duration || Infinity) - 5) a.currentTime = saved;
    const interval = setInterval(() => { if (a && !a.paused) localStorage.setItem(key, String(a.currentTime || 0)); }, 5000);
    return () => { clearInterval(interval); localStorage.setItem(key, String(a.currentTime || 0)); };
  }, [src]); // eslint-disable-line

  useEffect(() => { if (ref.current) ref.current.playbackRate = speed; }, [speed]);
  useEffect(() => { if (ref.current) ref.current.volume = vol; }, [vol]);

  const toggle = () => { const a = ref.current; if (!a) return; if (a.paused) a.play(); else a.pause(); };
  const seek = (delta: number) => { const a = ref.current; if (!a) return; a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + delta)); };
  const jumpTo = (t: number) => { const a = ref.current; if (!a) return; a.currentTime = t; setShowChapters(false); a.play(); };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const lower = (src || "").toLowerCase().split("?")[0];
  const isM4A = lower.endsWith(".m4a") || lower.endsWith(".mp4") || lower.endsWith(".aac");
  const mime = isM4A ? "audio/mp4" : "audio/mpeg";

  if (err) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-destructive/40 shadow-cover">
        <div className="container py-3 flex items-center gap-3 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">Unable to stream this audio</div>
            <div className="text-xs text-muted-foreground truncate">Download the file to listen offline.</div>
          </div>
          <a href={src} download className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gold text-primary-foreground hover:opacity-90">📥 Download</a>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center text-muted-foreground hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border shadow-cover">
      {showChapters && chapters.length > 0 && (
        <div className="container py-2 border-b border-border max-h-48 overflow-y-auto">
          <div className="text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-2">Chapters</div>
          <ul className="space-y-1">
            {chapters.map((c, i) => (
              <li key={i}>
                <button onClick={() => jumpTo(c.time)} className="text-left w-full text-xs px-2 py-1 rounded hover:bg-muted flex gap-2">
                  <span className="tabular-nums text-muted-foreground w-12">{fmt(c.time)}</span>
                  <span className="flex-1">{c.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="container py-2 md:py-3 flex items-center gap-2 md:gap-3">
        <button onClick={() => seek(-15)} className="hidden sm:grid h-8 w-8 place-items-center text-muted-foreground hover:text-foreground" aria-label="Back 15s">
          <Rewind className="h-4 w-4" />
        </button>
        <button onClick={toggle} className="shrink-0 h-10 w-10 md:h-11 md:w-11 rounded-full bg-gold text-primary-foreground grid place-items-center hover:opacity-90">
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button onClick={() => seek(15)} className="hidden sm:grid h-8 w-8 place-items-center text-muted-foreground hover:text-foreground" aria-label="Forward 15s">
          <FastForward className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate">{title}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground tabular-nums w-9">{fmt(cur)}</span>
            <input
              type="range" min={0} max={dur || 0} value={cur} step={0.1}
              onChange={(e) => { const v = Number(e.target.value); setCur(v); if (ref.current) ref.current.currentTime = v; }}
              className="flex-1 accent-gold h-1"
              aria-label="Seek"
            />
            <span className="text-[10px] text-muted-foreground tabular-nums w-9 text-right">{fmt(dur)}</span>
          </div>
        </div>
        {chapters.length > 0 && (
          <button onClick={() => setShowChapters((s) => !s)} className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-border hover:border-primary" aria-label="Chapters">
            <ListMusic className="h-3 w-3" /> {chapters.length}
          </button>
        )}
        <button
          onClick={() => { const i = SPEEDS.indexOf(speed); setSpeed(SPEEDS[(i + 1) % SPEEDS.length]); }}
          className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-border hover:border-primary"
          aria-label="Playback speed"
        >
          <Gauge className="h-3 w-3" /> {speed}x
        </button>
        <div className="hidden md:flex items-center gap-1 w-24">
          <Volume2 className="h-3 w-3 text-muted-foreground" />
          <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => setVol(Number(e.target.value))} className="flex-1 accent-gold h-1" aria-label="Volume" />
        </div>
        <button onClick={onClose} aria-label="Close player" className="shrink-0 h-8 w-8 grid place-items-center text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <audio
          ref={ref}
          preload="auto"
          playsInline
          crossOrigin="anonymous"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setCur((e.target as HTMLAudioElement).currentTime)}
          onLoadedMetadata={(e) => setDur((e.target as HTMLAudioElement).duration)}
          onError={(e) => { console.error("[StickyAudioPlayer] audio error", src, (e.target as HTMLAudioElement)?.error); setErr(true); }}
          className="hidden"
        >
          <source src={src} type={mime} />
        </audio>
      </div>
    </div>
  );
}
