import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: string; slug: string; title: string; author: string; category: string; language: string };

let cache: Row[] | null = null;
let inflight: Promise<Row[]> | null = null;
const loadBooks = (): Promise<Row[]> => {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("books")
      .select("id,slug,title,author,category,language")
      .eq("is_draft", false);
    cache = (data ?? []) as Row[];
    return cache;
  })();
  return inflight;
};

export const GlobalSearch = ({
  placeholder = "Search books, authors, or topics…",
  size = "md",
  autoFocus = false,
}: {
  placeholder?: string;
  size?: "md" | "lg";
  autoFocus?: boolean;
}) => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [books, setBooks] = useState<Row[]>([]);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadBooks().then(setBooks); }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return books
      .filter(b =>
        b.title.toLowerCase().includes(term) ||
        b.author.toLowerCase().includes(term) ||
        (b.category ?? "").toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [q, books]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results[0]) {
      navigate(`/books/${results[0].slug}`);
      setOpen(false);
      setQ("");
    } else if (q.trim()) {
      navigate(`/browse?q=${encodeURIComponent(q.trim())}`);
      setOpen(false);
    }
  };

  const h = size === "lg" ? "h-14 text-base" : "h-11 text-sm";

  return (
    <div ref={wrapRef} className="relative w-full">
      <form onSubmit={onSubmit}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          autoFocus={autoFocus}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          aria-label="Search books"
          className={`pl-11 pr-10 ${h} rounded-full bg-background/90 backdrop-blur border-border shadow-paper focus-visible:ring-primary`}
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(""); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {open && q.trim() && (
        <div className="absolute z-50 left-0 right-0 mt-2 rounded-2xl border border-border bg-popover shadow-cover overflow-hidden">
          {results.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No matches. Press Enter to browse.</div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {results.map(r => (
                <li key={r.id}>
                  <Link
                    to={`/books/${r.slug}`}
                    onClick={() => { setOpen(false); setQ(""); }}
                    className="flex items-start gap-3 px-4 py-2.5 hover:bg-accent transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm line-clamp-1">{r.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {r.author} · {r.category}{r.language === "hi" ? " · हिंदी" : ""}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
              <li className="border-t border-border">
                <Link
                  to={`/browse?q=${encodeURIComponent(q.trim())}`}
                  onClick={() => { setOpen(false); setQ(""); }}
                  className="block px-4 py-2.5 text-xs text-primary hover:bg-accent"
                >
                  See all results for "{q.trim()}" →
                </Link>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
