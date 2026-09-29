import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, BookOpen, ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
    setLoading(true);
    const { data: p } = await supabase.from("learning_paths").select("*").eq("slug", slug!).maybeSingle();
    if (!p) { setLoading(false); return; }
    setPath(p);
    document.title = `${p.title} — Learning Path — BookInsight`;

    const { data: lpb } = await supabase
      .from("learning_path_books")
      .select("position,books(id,slug,title,author,cover_color,cover_url,tagline,reading_time)")
      .eq("path_id", p.id)
      .order("position");
    setBooks((lpb ?? []).map((r: any) => ({ ...r.books, position: r.position })).filter(b => b.id));

    if (user) {
      const [{ data: prog }, { data: enr }] = await Promise.all([
        supabase.from("reading_progress").select("book_id").eq("user_id", user.id).eq("completed", true),
        supabase.from("path_enrollments").select("id").eq("user_id", user.id).eq("path_id", p.id).maybeSingle(),
      ]);
      setCompleted(new Set((prog ?? []).map((x: any) => x.book_id)));
      setEnrolled(!!enr);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug, user]);

  const enroll = async () => {
    if (!user) { toast.error("Sign in to enroll"); return; }
    const { error } = await supabase.from("path_enrollments").insert({ user_id: user.id, path_id: path.id });
    if (error) { toast.error(error.message); return; }
    setEnrolled(true);
    toast.success(`Enrolled in ${path.title}`);
  };

  const unenroll = async () => {
    if (!user) return;
    await supabase.from("path_enrollments").delete().eq("user_id", user.id).eq("path_id", path.id);
    setEnrolled(false);
    toast("Left the path");
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
