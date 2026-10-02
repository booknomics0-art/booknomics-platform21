import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { trackSearch } from "@/lib/analytics";

type Row = { id: string; slug: string; title: string; author: string; category: string; language: string };

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
  const [results, setResults] = useState<Row[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const safe = term.replace(/[,%()]/g, " ").slice(0, 80);
      const { data, error } = await supabase
        .from("books")
        .select("id,slug,title,author,category,language")
        .eq("is_draft", false)
        .or(`title.ilike.%${safe}%,author.ilike.%${safe}%,category.ilike.%${safe}%`)
        .order("title")
        .limit(8);

      if (cancelled) return;
      setResults(error ? [] : ((data ?? []) as Row[]));
      setSearching(false);
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    trackSearch(term, results.length, "global_search");
    if (results[0]) {
      navigate(`/books/${results[0].slug}`);
      setOpen(false);
      setQ("");
    } else {
      navigate(`/browse?q=${encodeURIComponent(term)}`);
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
          {searching ? (
            <div className="p-4 text-sm text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              <div>No matches. Press Enter to browse.</div>
              <Link
                to={`/request-book?title=${encodeURIComponent(q.trim())}`}
                onClick={() => setOpen(false)}
                className="inline-block mt-2 text-primary hover:underline"
              >
                Can't find it? Request this book →
              </Link>
            </div>
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
