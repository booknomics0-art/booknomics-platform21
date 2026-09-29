import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sun, Moon, BookOpen, ArrowUp, Brain, X, ZoomIn, ZoomOut, Download, Maximize2 } from "lucide-react";

type ThemeKey = "light" | "sepia" | "dark";
type SizeKey = "sm" | "md" | "lg" | "xl";

const THEMES: Record<ThemeKey, Record<string, string>> = {
  light: {
    "--rv-bg": "#FBF9F1", "--rv-text": "#2C2416", "--rv-heading": "#1A1410",
    "--rv-muted": "#8B7355", "--rv-accent": "#B8860B", "--rv-divider": "#E8DCC8",
    "--rv-quote-bg": "#F3EFE6", "--rv-highlight-bg": "#FFF3CD",
  },
  sepia: {
    "--rv-bg": "#F4ECD8", "--rv-text": "#3A3020", "--rv-heading": "#1F1810",
    "--rv-muted": "#7A6748", "--rv-accent": "#B8860B", "--rv-divider": "#DDCDA8",
    "--rv-quote-bg": "#EDE3CC", "--rv-highlight-bg": "#F5E5B5",
  },
  dark: {
    "--rv-bg": "#1A1A1A", "--rv-text": "#D4C5B2", "--rv-heading": "#E8DCC8",
    "--rv-muted": "#9A8C76", "--rv-accent": "#DAA520", "--rv-divider": "#2E2A24",
    "--rv-quote-bg": "#222222", "--rv-highlight-bg": "#3A2F12",
  },
};

// Proportional scaling presets — every typographic value derives from --rv-scale.
const SIZE_SCALE: Record<SizeKey, number> = { sm: 0.85, md: 1, lg: 1.18, xl: 1.34 };
const SIZE_LABELS: Record<SizeKey, string> = { sm: "A⁻", md: "A", lg: "A⁺", xl: "A⁺⁺" };
const SIZE_TIPS: Record<SizeKey, string> = {
  sm: "Small (15px)", md: "Default (18px)", lg: "Large (21px)", xl: "Extra Large (24px)",
};

let fontsLoaded = false;
const loadFonts = () => {
  if (fontsLoaded || typeof document === "undefined") return;
  fontsLoaded = true;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Lora:ital,wght@0,400;0,600;1,400&display=swap";
  document.head.appendChild(l);
};

const ReadingView = ({
  content, title, author, category, mindmapUrl,
}: {
  content: string;
  title?: string;
  author?: string;
  category?: string;
  mindmapUrl?: string | null;
}) => {
  const [theme, setTheme] = useState<ThemeKey>(
    () => (typeof window !== "undefined" && (localStorage.getItem("rv-theme") as ThemeKey)) || "light",
  );
  const [size, setSize] = useState<SizeKey>(
    () => (typeof window !== "undefined" && (localStorage.getItem("rv-size") as SizeKey)) || "md",
  );
  const [mapOpen, setMapOpen] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem("rv-mindmap") === "1",
  );
  const [mapFull, setMapFull] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapErr, setMapErr] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { loadFonts(); }, []);
  useEffect(() => { localStorage.setItem("rv-theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("rv-size", size); }, [size]);
  useEffect(() => { localStorage.setItem("rv-mindmap", mapOpen ? "1" : "0"); }, [mapOpen]);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current; if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      setProgress(Math.min(100, (scrolled / Math.max(total, 1)) * 100));
      setShowTop(window.scrollY > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const readingTime = useMemo(() => {
    const words = (content || "").trim().split(/\s+/).length;
    return Math.max(1, Math.round(words / 230));
  }, [content]);

  const processed = useMemo(() => {
    if (!content) return "";
    return content.split("\n").map((ln) => {
      const m = ln.match(/^\s*★\s*(.*)$/);
      return m ? `> ★KEY★ ${m[1]}` : ln;
    }).join("\n");
  }, [content]);

  const chapterCounter = useRef(0);
  const lastHeadingKey = useRef<string | null>(null);
  chapterCounter.current = 0;
  lastHeadingKey.current = null;

  const styleVars = { ...THEMES[theme], "--rv-scale": String(SIZE_SCALE[size]) } as React.CSSProperties;
  const hasMap = !!mindmapUrl && !mapErr;
  const sideBySide = hasMap && mapOpen && !mapFull;

  const Toolbar = (
    <div className="rv-toolbar flex flex-wrap items-center justify-end gap-2 mb-6" style={{ color: "var(--rv-muted)" }}>
      {hasMap && (
        <button
          onClick={() => setMapOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
          style={{
            borderColor: mapOpen ? "var(--rv-accent)" : "var(--rv-divider)",
            background: mapOpen ? "var(--rv-accent)" : "transparent",
            color: mapOpen ? "#fff" : "var(--rv-muted)",
          }}
          aria-pressed={mapOpen}
        >
          <Brain className="h-3.5 w-3.5" />
          {mapOpen ? "Hide Mind Map" : "View Mind Map"}
        </button>
      )}
      <div className="inline-flex rounded-full border overflow-hidden" style={{ borderColor: "var(--rv-divider)" }}>
        {(["sm", "md", "lg", "xl"] as SizeKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSize(k)}
            title={SIZE_TIPS[k]}
            className="px-2.5 py-1 text-xs font-semibold transition-colors"
            style={{
              background: size === k ? "var(--rv-accent)" : "transparent",
              color: size === k ? "#fff" : "var(--rv-muted)",
            }}
          >
            {SIZE_LABELS[k]}
          </button>
        ))}
      </div>
      <div className="inline-flex rounded-full border" style={{ borderColor: "var(--rv-divider)" }}>
        <button onClick={() => setTheme("light")} aria-label="Light" className="px-2.5 py-1" style={{ opacity: theme === "light" ? 1 : 0.55 }}><Sun className="h-3.5 w-3.5" /></button>
        <button onClick={() => setTheme("sepia")} aria-label="Sepia" className="px-2.5 py-1" style={{ opacity: theme === "sepia" ? 1 : 0.55 }}><BookOpen className="h-3.5 w-3.5" /></button>
        <button onClick={() => setTheme("dark")} aria-label="Dark" className="px-2.5 py-1" style={{ opacity: theme === "dark" ? 1 : 0.55 }}><Moon className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );

  const Article = (
    <article className="rv-article mx-auto">
      {(title || author) && (
        <header className="text-center mb-10">
          {title && (
            <h1 className="rv-h1" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--rv-heading)", fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.5px", margin: 0 }}>
              {title}
            </h1>
          )}
          {author && <p style={{ color: "var(--rv-muted)", fontStyle: "italic", marginTop: 8 }}>by {author}</p>}
          <p style={{ color: "var(--rv-accent)", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, marginTop: 12 }}>
            {readingTime} min read{category ? `  ·  ${category}` : ""}
          </p>
          <div aria-hidden style={{ height: 1, background: "var(--rv-divider)", margin: "24px auto 0", width: "60%" }} />
        </header>
      )}

      <div className="rv-prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children, ...props }) => {
              chapterCounter.current += 1;
              lastHeadingKey.current = String(children);
              return (
                <div className="rv-chapter">
                  <div className="rv-eyebrow">Chapter {chapterCounter.current}</div>
                  <h2 {...props} className="rv-h2" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--rv-heading)", fontWeight: 700, lineHeight: 1.3, margin: 0 }}>
                    {children}
                  </h2>
                </div>
              );
            },
            h3: ({ children, ...props }) => (
              <h3 {...props} className="rv-h3" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--rv-heading)", fontWeight: 600, lineHeight: 1.3 }}>
                {children}
              </h3>
            ),
            p: ({ children }) => {
              const isDrop = lastHeadingKey.current !== null;
              if (isDrop) lastHeadingKey.current = null;
              return <p className={isDrop ? "rv-p rv-dropcap" : "rv-p"} style={{ color: "var(--rv-text)" }}>{children}</p>;
            },
            strong: ({ children }) => <strong className="rv-bold" style={{ color: "var(--rv-heading)", fontWeight: 600 }}>{children}</strong>,
            em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
            hr: () => <div aria-hidden className="rv-divider">✦ ✦ ✦</div>,
            blockquote: ({ children }) => {
              const raw = JSON.stringify(children);
              if (raw.includes("★KEY★")) {
                return (
                  <div className="rv-key-card">
                    <span style={{ fontSize: "1.4em", lineHeight: 1 }}>💡</span>
                    <div className="rv-key">{children}</div>
                  </div>
                );
              }
              return <blockquote className="rv-quote">{children}</blockquote>;
            },
            a: ({ children, href }) => <a href={href} style={{ color: "var(--rv-accent)", textDecoration: "underline", textUnderlineOffset: 3 }}>{children}</a>,
            ul: ({ children }) => <ul className="rv-ul">{children}</ul>,
            ol: ({ children }) => <ol className="rv-ol">{children}</ol>,
            li: ({ children }) => <li className="rv-li">{children}</li>,
          }}
        >
          {processed}
        </ReactMarkdown>
      </div>
    </article>
  );

  const MapPanel = hasMap && mapOpen ? (
    <aside className="rv-map-panel" style={{ borderColor: "var(--rv-divider)", background: "var(--rv-quote-bg)" }}>
      <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: "var(--rv-divider)" }}>
        <div className="text-[10px] tracking-[0.2em] uppercase font-bold" style={{ color: "var(--rv-accent)" }}>Mind Map</div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMapZoom((z) => Math.max(0.5, z - 0.2))} className="p-1.5 rounded hover:opacity-70" aria-label="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></button>
          <button onClick={() => setMapZoom((z) => Math.min(3, z + 0.2))} className="p-1.5 rounded hover:opacity-70" aria-label="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></button>
          <a href={mindmapUrl!} download className="p-1.5 rounded hover:opacity-70" aria-label="Download"><Download className="h-3.5 w-3.5" /></a>
          <button onClick={() => setMapFull(true)} className="p-1.5 rounded hover:opacity-70" aria-label="Full screen"><Maximize2 className="h-3.5 w-3.5" /></button>
          <button onClick={() => setMapOpen(false)} className="p-1.5 rounded hover:opacity-70 lg:hidden" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="rv-map-scroll">
        <img
          src={mindmapUrl!}
          alt={`${title || "Book"} mind map`}
          style={{ width: `${100 * mapZoom}%`, height: "auto", display: "block", transition: "width .2s ease" }}
          loading="lazy"
          crossOrigin="anonymous"
          onError={() => { console.error("[ReadingView] mindmap failed to load", mindmapUrl); setMapErr(true); }}
        />
      </div>
    </aside>
  ) : null;

  return (
    <div ref={ref} className="rv-root relative rounded-2xl" style={styleVars}>
      <div aria-hidden className="rv-progress-wrap">
        <div className="rv-progress" style={{ width: `${progress}%` }} />
      </div>

      {Toolbar}

      {sideBySide ? (
        <div className="rv-grid">
          <div className="min-w-0">{Article}</div>
          <div className="rv-map-sticky">{MapPanel}</div>
        </div>
      ) : (
        Article
      )}

      {/* Mobile / full-screen overlay */}
      {hasMap && (mapFull || (mapOpen && typeof window !== "undefined" && window.innerWidth < 1024)) && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between p-3 text-white">
            <div className="text-xs tracking-[0.25em] uppercase">Mind Map</div>
            <div className="flex items-center gap-2">
              <a href={mindmapUrl!} download className="p-2 rounded hover:bg-white/10"><Download className="h-4 w-4" /></a>
              <button onClick={() => { setMapFull(false); setMapOpen(false); }} className="p-2 rounded hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <img src={mindmapUrl!} alt={`${title || "Book"} mind map`} className="mx-auto max-w-none" style={{ width: "100%", maxWidth: 1400 }} />
          </div>
        </div>
      )}

      {showTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top" className="rv-top">
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

      <style>{`
        .rv-root {
          background: var(--rv-bg);
          color: var(--rv-text);
          font-family: 'Lora', Georgia, serif;
          padding: clamp(20px, 4vw, 48px);
          transition: background .3s ease, color .3s ease;
        }
        .rv-progress-wrap { position: sticky; top: 0; left: 0; height: 3px; background: transparent; margin-bottom: 8px; z-index: 5; }
        .rv-progress { height: 100%; background: var(--rv-accent); border-radius: 2px; transition: width 120ms linear; }
        .rv-article { max-width: calc(680px + (var(--rv-scale) - 1) * 120px); transition: max-width .3s ease; }
        .rv-h1 { font-size: calc(30px * var(--rv-scale)); }
        .rv-chapter { margin-top: calc(48px * var(--rv-scale)); margin-bottom: calc(16px * var(--rv-scale)); }
        .rv-eyebrow { color: var(--rv-accent); font-size: 12px; letter-spacing: .25em; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; }
        .rv-h2 { font-size: calc(26px * var(--rv-scale)); }
        .rv-h3 { font-size: calc(20px * var(--rv-scale)); margin-top: calc(32px * var(--rv-scale)); margin-bottom: calc(10px * var(--rv-scale)); }
        .rv-prose { font-size: calc(18px * var(--rv-scale)); line-height: calc(1.85 - (var(--rv-scale) - 1) * 0.25); transition: font-size .3s ease, line-height .3s ease; }
        .rv-prose p, .rv-prose li { font-family: 'Lora', Georgia, serif; }
        .rv-p { margin-bottom: calc(20px * var(--rv-scale)); }
        .rv-dropcap::first-letter {
          font-family: 'Playfair Display', Georgia, serif;
          float: left; font-size: 3.4em; line-height: 0.9;
          padding: 4px 10px 0 0; color: var(--rv-accent); font-weight: 800;
        }
        .rv-bold { transition: color .2s ease; }
        @media (hover:hover) { .rv-bold:hover { box-shadow: inset 0 -2px 0 var(--rv-accent); } }
        .rv-divider { text-align: center; margin: calc(48px * var(--rv-scale)) 0; color: var(--rv-accent); letter-spacing: .6em; font-size: 14px; }
        .rv-quote {
          border-left: 4px solid var(--rv-accent);
          background: var(--rv-quote-bg);
          padding: calc(20px * var(--rv-scale)) calc(24px * var(--rv-scale));
          margin: calc(28px * var(--rv-scale)) 0;
          border-radius: 0 8px 8px 0; font-style: italic;
          font-size: 1.08em; color: var(--rv-heading);
        }
        .rv-key-card {
          background: var(--rv-highlight-bg);
          border-radius: 10px;
          padding: calc(16px * var(--rv-scale)) calc(18px * var(--rv-scale));
          margin: calc(24px * var(--rv-scale)) 0;
          display: flex; gap: 12px; align-items: flex-start;
          color: var(--rv-heading); font-weight: 500;
        }
        .rv-ul, .rv-ol { padding-left: 22px; margin: 12px 0 calc(20px * var(--rv-scale)); }
        .rv-ul { list-style: disc; } .rv-ol { list-style: decimal; }
        .rv-li { margin-bottom: 6px; }
        .rv-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,420px); gap: 24px; align-items: start; }
        .rv-map-sticky { position: sticky; top: 80px; }
        .rv-map-panel { border: 1px solid; border-radius: 12px; overflow: hidden; }
        .rv-map-scroll { max-height: 70vh; overflow: auto; }
        @media (max-width: 1023px) {
          .rv-grid { grid-template-columns: 1fr; }
          .rv-map-sticky { display: none; }
        }
        @media (max-width: 768px) {
          .rv-prose { font-size: calc(16px * var(--rv-scale)) !important; line-height: calc(1.75 - (var(--rv-scale) - 1) * 0.2) !important; }
        }
        .rv-top {
          position: fixed; bottom: 24px; right: 24px;
          width: 44px; height: 44px; border-radius: 999px;
          background: var(--rv-accent); color: #fff;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 10px 30px rgba(0,0,0,.25); z-index: 40;
        }
        @media print {
          .rv-root { background: #fff !important; color: #000 !important; padding: 0 !important; }
          .rv-toolbar, .rv-top, .rv-map-panel, .rv-progress-wrap { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default ReadingView;
