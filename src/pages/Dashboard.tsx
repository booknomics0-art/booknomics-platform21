import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, BookOpen, Trophy, Target, Sparkles, Clock, CheckSquare, ArrowRight, Route } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePremium } from "@/hooks/usePremium";
import { supabase } from "@/integrations/supabase/client";
import { Milestones } from "@/components/Milestones";
import { KnowledgeMap } from "@/components/KnowledgeMap";
import { NotesArchive } from "@/components/NotesArchive";

interface Stats {
  completed: number;
  inProgress: number;
  totalHabits: number;
  doneHabits: number;
  hoursSaved: number;
  masterBadges: number;
}

interface MasteryRow { book_id: string; quiz_score: number; quiz_total: number; badge_awarded: boolean; books: { title: string; slug: string; cover_color: string; cover_url: string | null } | null }

const Dashboard = () => {
  const { user, loading } = useAuth();
  const { isPremium, plan } = usePremium();
  const [stats, setStats] = useState<Stats>({ completed: 0, inProgress: 0, totalHabits: 0, doneHabits: 0, hoursSaved: 0, masterBadges: 0 });
  const [streak, setStreak] = useState(0);
  const [recent, setRecent] = useState<any[]>([]);
  const [categoryMap, setCategoryMap] = useState<{ category: string; count: number }[]>([]);
  const [badges, setBadges] = useState<MasteryRow[]>([]);

  useEffect(() => { document.title = "Dashboard — BookInsight"; }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: profile } = await supabase.from("profiles").select("streak_count, last_active_date").eq("id", user.id).maybeSingle();

      let s = profile?.streak_count ?? 0;
      const last = profile?.last_active_date;
      if (last !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        s = last === yesterday ? s + 1 : 1;
        await supabase.from("profiles").update({ streak_count: s, last_active_date: today }).eq("id", user.id);
      }
      setStreak(s);

      const [{ data: prog }, { data: habits }, { data: lib }, { data: mastery }] = await Promise.all([
        supabase.from("reading_progress").select("completed, books(reading_time, category)").eq("user_id", user.id),
        supabase.from("habit_entries").select("done").eq("user_id", user.id),
        supabase.from("library").select("books(id,slug,title,author,cover_color,cover_url,category)").eq("user_id", user.id).limit(8),
        supabase.from("user_book_mastery").select("book_id,quiz_score,quiz_total,badge_awarded,books(title,slug,cover_color,cover_url)").eq("user_id", user.id).eq("badge_awarded", true).order("completed_at", { ascending: false }).limit(6),
      ]);

      const completedRows = (prog ?? []).filter((p: any) => p.completed);
      const totalMinSaved = completedRows.reduce((acc: number, r: any) => acc + ((r.books?.reading_time ?? 12) * 25), 0);
      const badgeRows = (mastery ?? []) as any as MasteryRow[];
      setBadges(badgeRows);

      setStats({
        completed: completedRows.length,
        inProgress: (prog ?? []).filter((p: any) => !p.completed).length,
        totalHabits: (habits ?? []).length,
        doneHabits: (habits ?? []).filter((h: any) => h.done).length,
        hoursSaved: Math.round(totalMinSaved / 60),
        masterBadges: badgeRows.length,
      });
      setRecent(((lib ?? []).map((r: any) => r.books).filter(Boolean)).slice(0, 4));

      const counts: Record<string, number> = {};
      (lib ?? []).forEach((r: any) => {
        const c = r.books?.category;
        if (c) counts[c] = (counts[c] ?? 0) + 1;
      });
      completedRows.forEach((r: any) => {
        const c = r.books?.category;
        if (c) counts[c] = (counts[c] ?? 0) + 1;
      });
      setCategoryMap(Object.entries(counts).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count));
    })();
  }, [user]);

  if (loading) return <Layout><div className="container py-20 text-center text-muted-foreground">Loading…</div></Layout>;
  if (!user) return <Layout><div className="container py-20 text-center"><h1 className="font-serif text-3xl mb-4">Sign in to see your dashboard</h1><Button asChild className="bg-gold text-primary-foreground rounded-full"><Link to="/auth">Sign in</Link></Button></div></Layout>;

  const consistency = stats.totalHabits ? Math.round((stats.doneHabits / stats.totalHabits) * 100) : 0;

  return (
    <Layout>
      <section className="bg-hero border-b border-border">
        <div className="container py-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2">Your dashboard</div>
            <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground mt-2">{user.email}</p>
          </div>
          {isPremium ? (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold text-primary-foreground text-sm font-semibold">
              <Sparkles className="h-4 w-4" /> {plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Premium"} member
            </span>
          ) : (
            <Button asChild className="bg-gold text-primary-foreground rounded-full"><Link to="/pricing"><Sparkles className="h-4 w-4 mr-2" /> Upgrade to Premium</Link></Button>
          )}
        </div>
      </section>

      <section className="container py-10 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { icon: Flame, label: "Day streak", value: streak, color: "text-orange-500" },
            { icon: BookOpen, label: "Books read", value: stats.completed, color: "text-primary" },
            { icon: Clock, label: "Hours saved", value: stats.hoursSaved, color: "text-blue-500" },
            { icon: CheckSquare, label: "Actions done", value: stats.doneHabits, color: "text-emerald-600" },
            { icon: Target, label: "Consistency", value: `${consistency}%`, color: "text-purple-600" },
            { icon: Trophy, label: "In progress", value: stats.inProgress, color: "text-gold" },
            { icon: Trophy, label: "Book Master", value: stats.masterBadges, color: "text-gold" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <s.icon className={`h-4 w-4 mb-2 ${s.color}`} />
                <div className="text-2xl font-bold font-serif">{s.value}</div>
                <div className="text-[10px] text-muted-foreground tracking-wide uppercase mt-1">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Milestones userId={user.id} completed={stats.completed} streak={streak} />
            {badges.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="h-5 w-5 text-gold" />
                    <h2 className="font-serif text-2xl font-bold">Book Master badges</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {badges.map((b) => b.books && (
                      <Link key={b.book_id} to={`/books/${b.books.slug}`} className="flex items-center gap-2 p-2 rounded-lg border border-gold/30 bg-gold/5 hover:bg-gold/10 transition">
                        <div className={`h-12 w-9 rounded shadow-paper cover-${b.books.cover_color} grid place-items-center text-[10px] font-serif overflow-hidden shrink-0`}>
                          {b.books.cover_url ? <img src={b.books.cover_url} alt="" className="h-full w-full object-cover" /> : b.books.title.slice(0,2)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{b.books.title}</div>
                          <div className="text-[10px] text-gold">100% · Mastered</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <KnowledgeMap data={categoryMap} />
            <NotesArchive userId={user.id} />
          </div>

          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/10 to-gold/10 border-primary/20">
              <CardContent className="p-6">
                <Route className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-serif text-xl font-bold mb-2">Learning Paths</h3>
                <p className="text-sm text-muted-foreground mb-4">Curated book bundles to transform an area of your life.</p>
                <Button asChild className="w-full rounded-full"><Link to="/paths">Explore paths <ArrowRight className="h-4 w-4 ml-1" /></Link></Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h2 className="font-serif text-2xl font-bold mb-5">Continue reading</h2>
                {recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No books in your library yet. <Link to="/browse" className="text-primary underline">Browse</Link>.</p>
                ) : (
                  <ul className="space-y-3">
                    {recent.map(b => (
                      <li key={b.id}>
                        <Link to={`/books/${b.slug}`} className="flex items-center gap-3 group">
                          <div className={`h-12 w-9 rounded shadow-paper cover-${b.cover_color} grid place-items-center text-[10px] font-serif overflow-hidden`}>
                            {b.cover_url ? <img src={b.cover_url} alt="" className="h-full w-full object-cover" /> : b.title.slice(0,2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate group-hover:text-primary">{b.title}</div>
                            <div className="text-xs text-muted-foreground truncate">{b.author}</div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {!isPremium && (
          <div className="bg-gold rounded-3xl p-10 md:p-14 text-center shadow-cover">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-foreground mb-3">Don't just read. Transform.</h2>
            <p className="text-primary-foreground/80 max-w-lg mx-auto mb-6">Unlock action systems, weekly trackers and AI reflection — from ₹49/month.</p>
            <Button asChild variant="secondary" size="lg" className="rounded-full"><Link to="/pricing">See plans</Link></Button>
          </div>
        )}
      </section>
    </Layout>
  );
};

export default Dashboard;
