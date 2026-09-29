import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, ThumbsUp, Trophy, Flame, TrendingUp, Sparkles, Loader2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Top = { user_id: string; display_name: string | null; avatar_url: string | null; total_points: number; books_completed: number; comments_count: number; streak_count: number };
type FeedItem = { id: string; kind: "question" | "reply" | "completed"; user_id: string; created_at: string; question?: string; content?: string; book?: { slug: string; title: string } | null };
type Trending = { id: string; question: string; helpful_count: number; reply_count: number; book_id: string; book?: { slug: string; title: string } | null };

const since = (range: "today" | "week" | "month" | "all") => {
  const d = new Date();
  if (range === "today") d.setHours(0, 0, 0, 0);
  else if (range === "week") d.setDate(d.getDate() - 7);
  else if (range === "month") d.setDate(d.getDate() - 30);
  else return null;
  return d.toISOString();
};

const Community = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"feed" | "leaderboard" | "trending" | "mine">("feed");
  const [range, setRange] = useState<"today" | "week" | "month" | "all">("week");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [leaders, setLeaders] = useState<Top[]>([]);
  const [trending, setTrending] = useState<Trending[]>([]);
  const [mine, setMine] = useState<{ questions: any[]; replies: any[]; rank: number | null }>({ questions: [], replies: [], rank: null });
  const [loading, setLoading] = useState(true);

  // page title handled via SEO component below

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: q }, { data: r }, { data: c }] = await Promise.all([
        supabase.from("discussions").select("id,user_id,created_at,question,book_id,books(slug,title)").order("created_at", { ascending: false }).limit(10),
        supabase.from("discussion_replies").select("id,user_id,created_at,content,discussion_id,discussions(book_id,books(slug,title))").order("created_at", { ascending: false }).limit(10),
        supabase.from("reading_progress").select("user_id,book_id,last_read_at,books(slug,title)").eq("completed", true).order("last_read_at", { ascending: false }).limit(10),
      ]);
      const items: FeedItem[] = [
        ...((q || []) as any[]).map((x) => ({ id: x.id, kind: "question" as const, user_id: x.user_id, created_at: x.created_at, question: x.question, book: x.books })),
        ...((r || []) as any[]).map((x) => ({ id: x.id, kind: "reply" as const, user_id: x.user_id, created_at: x.created_at, content: x.content, book: x.discussions?.books })),
        ...((c || []) as any[]).map((x) => ({ id: `${x.user_id}-${x.book_id}`, kind: "completed" as const, user_id: x.user_id, created_at: x.last_read_at, book: x.books })),
      ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 25);
      setFeed(items);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const cutoff = since(range);
      let query = (supabase as any).from("leaderboard_view").select("*").order("total_points", { ascending: false }).limit(20);
      if (cutoff) {
        // Period-scoped totals
        const { data: pts } = await supabase.from("community_points").select("user_id, points").gte("created_at", cutoff);
        const totals = new Map<string, number>();
        (pts || []).forEach((p: any) => totals.set(p.user_id, (totals.get(p.user_id) || 0) + p.points));
        const ids = [...totals.keys()];
        if (ids.length === 0) { setLeaders([]); return; }
        const { data: users } = await (supabase as any).from("leaderboard_view").select("*").in("user_id", ids);
        const ranked = ((users || []) as Top[])
          .map((u) => ({ ...u, total_points: totals.get(u.user_id) || 0 }))
          .sort((a, b) => b.total_points - a.total_points).slice(0, 20);
        setLeaders(ranked);
        return;
      }
      const { data } = await query;
      setLeaders((data as Top[]) || []);
    })();
  }, [range]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("discussions").select("id,question,helpful_count,reply_count,book_id,books(slug,title)")
        .order("helpful_count", { ascending: false }).limit(10);
      setTrending((data as any) || []);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: qs }, { data: rps }, { data: lb }] = await Promise.all([
        supabase.from("discussions").select("id,question,created_at,book_id,books(slug,title)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("discussion_replies").select("id,content,created_at,discussion_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        (supabase as any).from("leaderboard_view").select("user_id,total_points").order("total_points", { ascending: false }).limit(500),
      ]);
      const idx = (lb as any[] || []).findIndex((u) => u.user_id === user.id);
      setMine({ questions: qs || [], replies: rps || [], rank: idx >= 0 ? idx + 1 : null });
    })();
  }, [user]);

  return (
    <Layout>
      <SEO
        title="Reader Community | Booknomics"
        description="Join the Booknomics community: ask questions, share insights, follow trending discussions, and climb the reader leaderboard."
        path="/community"
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "Community", path: "/community" }]}
      />
      <section className="bg-hero border-b border-border">
        <div className="container py-6 md:py-10">
          <div className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2">Community</div>
          <h1 className="font-serif text-2xl md:text-5xl font-bold tracking-tight">Where readers think together</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-xl">Discover what your fellow readers are asking, sharing, and applying.</p>
        </div>
      </section>

      <section className="container py-6 md:py-8">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-4 w-full max-w-2xl text-xs md:text-sm">
            <TabsTrigger value="feed">Feed</TabsTrigger>
            <TabsTrigger value="leaderboard"><span className="hidden sm:inline">Leaderboard</span><span className="sm:hidden">Ranks</span></TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="mine"><span className="hidden sm:inline">My Activity</span><span className="sm:hidden">Mine</span></TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="mt-6 space-y-3">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> :
              feed.length === 0 ? <Empty msg="No activity yet." /> :
              feed.map((f) => (
                <Card key={`${f.kind}-${f.id}`} className="p-4">
                  <div className="flex items-start gap-3">
                    <Badge kind={f.kind} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {f.kind === "question" && <>asked <strong className="font-serif">"{f.question}"</strong></>}
                        {f.kind === "reply" && <>replied: <span className="text-muted-foreground">{f.content?.slice(0, 140)}{(f.content?.length || 0) > 140 ? "…" : ""}</span></>}
                        {f.kind === "completed" && <>completed a book</>}
                      </p>
                      {f.book && <Link to={`/books/${f.book.slug}`} className="text-xs text-primary hover:underline mt-1 inline-block">{f.book.title} →</Link>}
                      <div className="text-[11px] text-muted-foreground mt-1">{new Date(f.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                </Card>
              ))
            }
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-6">
            <div className="flex gap-2 mb-4 flex-wrap">
              {(["today", "week", "month", "all"] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 text-xs rounded-full border ${range === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                  {r === "all" ? "All Time" : r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            {leaders.length === 0 ? <Empty msg="No rankings for this period yet." /> : (
              <Card className="divide-y divide-border">
                {leaders.map((u, i) => (
                  <div key={u.user_id} className="flex items-center gap-4 p-4">
                    <span className={`w-8 text-lg font-bold font-serif ${i < 3 ? "text-amber-500" : "text-muted-foreground"}`}>#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{u.display_name || "Reader"}</div>
                      <div className="text-xs text-muted-foreground">{u.books_completed ?? 0} books · {u.comments_count ?? 0} comments · {u.streak_count ?? 0}🔥</div>
                    </div>
                    <span className="text-lg font-bold text-primary">{u.total_points}</span>
                  </div>
                ))}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="trending" className="mt-6 space-y-3">
            {trending.length === 0 ? <Empty msg="No trending discussions yet." /> :
              trending.map((t) => (
                <Card key={t.id} className="p-4">
                  <h3 className="font-serif text-lg font-semibold leading-snug mb-1">{t.question}</h3>
                  {t.book && <Link to={`/books/${t.book.slug}`} className="text-xs text-primary hover:underline">{t.book.title}</Link>}
                  <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                    <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{t.helpful_count}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{t.reply_count}</span>
                  </div>
                </Card>
              ))
            }
          </TabsContent>

          <TabsContent value="mine" className="mt-6">
            {!user ? <Empty msg="Sign in to see your activity." /> : (
              <div className="space-y-6">
                <Card className="p-5 bg-gradient-to-br from-primary/5 to-amber-100/20">
                  <div className="text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-1">Your Rank</div>
                  <div className="text-4xl font-bold font-serif">{mine.rank ? `#${mine.rank}` : "—"}</div>
                </Card>
                <div>
                  <h3 className="font-serif text-xl font-semibold mb-3">My Questions</h3>
                  {mine.questions.length === 0 ? <p className="text-sm text-muted-foreground">No questions yet.</p> :
                    <div className="space-y-2">{mine.questions.map((q) => (
                      <Card key={q.id} className="p-3">
                        <p className="text-sm">{q.question}</p>
                        {q.books && <Link to={`/books/${q.books.slug}`} className="text-xs text-primary hover:underline">{q.books.title}</Link>}
                      </Card>
                    ))}</div>
                  }
                </div>
                <div>
                  <h3 className="font-serif text-xl font-semibold mb-3">My Replies</h3>
                  {mine.replies.length === 0 ? <p className="text-sm text-muted-foreground">No replies yet.</p> :
                    <div className="space-y-2">{mine.replies.map((r) => (
                      <Card key={r.id} className="p-3"><p className="text-sm text-foreground/85">{r.content}</p></Card>
                    ))}</div>
                  }
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </Layout>
  );
};

const Empty = ({ msg }: { msg: string }) => (
  <Card className="p-10 text-center border-dashed bg-muted/10">
    <Sparkles className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
    <p className="text-sm text-muted-foreground">{msg}</p>
  </Card>
);

const Badge = ({ kind }: { kind: "question" | "reply" | "completed" }) => {
  const map = {
    question: { icon: MessageSquare, c: "bg-blue-100 text-blue-600" },
    reply: { icon: MessageSquare, c: "bg-purple-100 text-purple-600" },
    completed: { icon: Trophy, c: "bg-amber-100 text-amber-600" },
  } as const;
  const { icon: Icon, c } = map[kind];
  return <div className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${c}`}><Icon className="w-4 h-4" /></div>;
};

export default Community;
