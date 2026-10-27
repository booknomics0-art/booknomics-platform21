import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { BookCard, BookCardData } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { Bookmark, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/cloudflareApi";
import { isPersonalSupabaseEnabled, personalSupabase } from '@/lib/personalSupabase';

type LibBook = BookCardData & { read: boolean };

const Library = () => {
  const { user, loading } = useAuth();
  const [books, setBooks] = useState<LibBook[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  useEffect(() => {
    if (!user) {
      setBooks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (isPersonalSupabaseEnabled) {
          if (!personalSupabase) throw new Error('Supabase authentication is not configured');
          const { data: saved, error: savedError } = await personalSupabase
            .from('library')
            .select('book_id,book_title,book_slug,book_author,book_category,book_cover_color,book_cover_url')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(100);
          if (savedError) throw savedError;
          const ids = (saved || []).map(row => row.book_id);
          const { data: completed, error: completedError } = ids.length
            ? await personalSupabase.from('reading_progress').select('book_id,completed').eq('user_id', user.id).in('book_id', ids)
            : { data: [], error: null };
          if (completedError) throw completedError;
          const readIds = new Set((completed || []).filter(row => row.completed).map(row => row.book_id));
          const rows: LibBook[] = (saved || []).map(row => ({
            id: row.book_id,
            title: row.book_title,
            slug: row.book_slug,
            author: row.book_author,
            category: row.book_category,
            cover_color: row.book_cover_color,
            cover_url: row.book_cover_url,
            tagline: null,
            rating: null,
            reading_time: null,
            read: readIds.has(row.book_id),
          }));
          if (!cancelled) setBooks(rows);
          return;
        }
        const payload = await apiFetch<{ data: LibBook[] }>("/api/library");
        if (!cancelled) setBooks(payload.data ?? []);
      } catch (error: any) {
        if (!cancelled) {
          setBooks([]);
          toast.error(error?.message || "Could not load your library");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const toggleRead = async (book: LibBook) => {
    if (!user) return;
    const next = !book.read;
    setBooks(prev => prev.map(b => b.id === book.id ? { ...b, read: next } : b));
    try {
      if (isPersonalSupabaseEnabled) {
        if (!personalSupabase) throw new Error('Supabase authentication is not configured');
        const { error } = await personalSupabase.from('reading_progress').upsert({
          user_id: user.id,
          book_id: book.id,
          completed: next,
          last_read_at: new Date().toISOString(),
        }, { onConflict: 'user_id,book_id' });
        if (error) throw error;
        toast.success(next ? 'Marked as read' : 'Marked as unread');
        return;
      }
      await apiFetch<{ ok: boolean; completed: boolean }>("/api/reading-progress", {
        method: "POST",
        body: JSON.stringify({ book_id: book.id, completed: next }),
      });
      toast.success(next ? "Marked as read" : "Marked as unread");
    } catch (error: any) {
      setBooks(prev => prev.map(b => b.id === book.id ? { ...b, read: !next } : b));
      toast.error(error?.message || "Could not update status");
    }
  };

  if (loading) return <Layout><div className="container py-20 text-center text-muted-foreground">Loading…</div></Layout>;

  if (!user) return (
    <Layout>
      <div className="container py-20 text-center max-w-md">
        <Bookmark className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="font-serif text-4xl font-bold mb-3">Your library awaits</h1>
        <p className="text-muted-foreground mb-6">Sign in to save the books that move you.</p>
        <Button asChild className="bg-gold text-primary-foreground hover:opacity-90 rounded-full"><Link to="/auth">Sign in</Link></Button>
      </div>
    </Layout>
  );

  const filtered = books.filter(b => filter === "all" ? true : filter === "read" ? b.read : !b.read);
  const readCount = books.filter(b => b.read).length;

  return (
    <Layout>
      <SEO
        title="My Library | Booknomics"
        description="Your saved book summaries on Booknomics. Pick up where you left off and build your personal reading collection."
        path="/library"
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "My Library", path: "/library" }]}
      />
      <section className="bg-hero border-b border-border">
        <div className="container py-16">
          <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Your collection</div>
          <h1 className="font-serif text-5xl md:text-6xl font-bold tracking-tight">My Library</h1>
          <p className="text-muted-foreground mt-3 text-lg">
            {books.length} saved · {readCount} read · {books.length - readCount} unread
          </p>
        </div>
      </section>
      <section className="container py-12">
        {books.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">Your library is empty.</p>
            <Button asChild variant="outline" className="rounded-full"><Link to="/browse">Discover books</Link></Button>
          </div>
        ) : (
          <>
            <div className="inline-flex rounded-full border border-border p-1 bg-background/60 backdrop-blur mb-8">
              {(["all", "unread", "read"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 text-sm rounded-full transition capitalize ${
                    filter === f ? "bg-gold text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filtered.map(b => (
                <div key={b.id} className="space-y-2">
                  <BookCard book={b} />
                  <button
                    onClick={() => toggleRead(b)}
                    className={`w-full inline-flex items-center justify-center gap-1.5 rounded-full border text-xs font-medium px-3 py-1.5 transition ${
                      b.read
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                        : "border-border hover:border-primary hover:text-primary"
                    }`}
                    aria-pressed={b.read}
                  >
                    {b.read ? <><CheckCircle2 className="h-3.5 w-3.5" /> Read</> : <><Circle className="h-3.5 w-3.5" /> Mark as read</>}
                  </button>
                </div>
              ))}
            </div>
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-12">No {filter} books yet.</p>
            )}
          </>
        )}
      </section>
    </Layout>
  );
};

export default Library;
