import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, BookOpen, ArrowLeft, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/cloudflareApi";
import { isPersonalSupabaseEnabled } from '@/lib/personalSupabase';
import { isEnrolled, setEnrolled as persistPathEnrollment } from '@/lib/personalData';
import { toast } from "sonner";

export default function PathDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [path, setPath] = useState<any>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!slug) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiFetch<{ path: any; books: any[]; enrolled: boolean }>(
        `/api/learning-paths/${encodeURIComponent(slug)}`,
      );
      setPath(data.path);
      const nextBooks = data.books || [];
      setBooks(nextBooks);
      if (isPersonalSupabaseEnabled && user) {
        const [enrolledInSupabase, progress] = await Promise.all([
          isEnrolled(user.id, String(data.path.id)),
          import('@/lib/personalSupabase').then(async ({ personalSupabase }) => {
            if (!personalSupabase || nextBooks.length === 0) return [];
            const { data: rows, error } = await personalSupabase.from('reading_progress')
              .select('book_id,completed').eq('user_id', user.id)
              .in('book_id', nextBooks.map((book: any) => book.id));
            if (error) throw error;
            return rows || [];
          }),
        ]);
        setEnrolled(enrolledInSupabase);
        const completedIds = new Set(progress.filter(row => row.completed).map(row => row.book_id));
        setCompleted(new Set(nextBooks.filter((book: any) => completedIds.has(book.id)).map((book: any) => book.id)));
      } else {
        setCompleted(new Set(nextBooks.filter((book: any) => book.completed).map((book: any) => book.id)));
        setEnrolled(isPersonalSupabaseEnabled ? false : !!data.enrolled);
      }
      document.title = `${data.path.title} — Learning Path — BookInsight`;
    } catch {
      setPath(null);
      setBooks([]);
      setCompleted(new Set());
      setEnrolled(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug, user]);

  const enroll = async () => {
    if (!user) { toast.error("Sign in to enroll"); return; }
    try {
      if (isPersonalSupabaseEnabled) await persistPathEnrollment(user.id, String(path.id), true);
      else await apiFetch<{ ok: boolean; enrolled: boolean }>(`/api/learning-paths/${encodeURIComponent(path.id)}/enroll`, { method: 'POST' });
      setEnrolled(true);
      toast.success(`Enrolled in ${path.title}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not enroll");
    }
  };

  const unenroll = async () => {
    if (!user) return;
    try {
      if (isPersonalSupabaseEnabled) await persistPathEnrollment(user.id, String(path.id), false);
      else await apiFetch<{ ok: boolean; enrolled: boolean }>(`/api/learning-paths/${encodeURIComponent(path.id)}/enroll`, { method: 'DELETE' });
      setEnrolled(false);
      toast("Left the path");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not leave path");
    }
  };

  if (loading) return <Layout><div className="container py-20 text-center text-muted-foreground">Loading…</div></Layout>;
  if (!path) return <Layout><div className="container py-20 text-center"><h1 className="font-serif text-3xl">Path not found</h1><Button asChild className="mt-4"><Link to="/paths">Browse paths</Link></Button></div></Layout>;

  const doneCount = books.filter(b => completed.has(b.id)).length;
  const pct = books.length ? Math.round((doneCount / books.length) * 100) : 0;

  return (
    <Layout>
      <section className="bg-hero border-b border-border">
        <div className="container py-12">
          <Link to="/paths" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" /> All paths
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2">Learning path</div>
              <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight">{path.title}</h1>
              <p className="text-muted-foreground mt-3">{path.description}</p>
              <div className="mt-5 max-w-md">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-muted-foreground">{doneCount}/{books.length} books completed</span>
                  <span className="font-semibold">{pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            </div>
            {enrolled ? (
              <div className="flex gap-2">
                <Badge className="bg-emerald-500 text-white px-3 py-1.5 text-sm"><Check className="h-3 w-3 mr-1" /> Enrolled</Badge>
                <Button variant="outline" size="sm" onClick={unenroll}>Leave path</Button>
              </div>
            ) : (
              <Button onClick={enroll} className="bg-gold text-primary-foreground rounded-full" size="lg">
                <Sparkles className="h-4 w-4 mr-2" /> Enroll in path
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="container py-10">
        <h2 className="font-serif text-2xl font-bold mb-6">Suggested reading order</h2>
        <ol className="space-y-3">
          {books.map((b, i) => {
            const done = completed.has(b.id);
            return (
              <li key={b.id}>
                <Link to={`/books/${b.slug}`}>
                  <Card className={`transition-all hover:shadow-cover hover:-translate-y-0.5 ${done ? "border-emerald-500/40" : ""}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full grid place-items-center font-serif font-bold flex-shrink-0 ${done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                        {done ? <Check className="h-5 w-5" /> : i + 1}
                      </div>
                      <div className={`h-16 w-12 rounded shadow-paper cover-${b.cover_color} grid place-items-center text-[10px] font-serif overflow-hidden flex-shrink-0`}>
                        {b.cover_url ? <img src={b.cover_url} alt="" className="h-full w-full object-cover" /> : b.title.slice(0,2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{b.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{b.author} · {b.reading_time ?? 12} min read</div>
                        {b.tagline && <div className="text-sm text-muted-foreground mt-1 line-clamp-1">{b.tagline}</div>}
                      </div>
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </Layout>
  );
}
