import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Flame, TrendingUp, Target, Brain, MessageCircle, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const iconMap: Record<string, any> = {
  "trending-up": TrendingUp, flame: Flame, target: Target, brain: Brain,
  "message-circle": MessageCircle, sparkles: Sparkles,
};
const colorMap: Record<string, string> = {
  emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
  orange: "from-orange-500/20 to-orange-500/5 border-orange-500/30",
  blue: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
  purple: "from-purple-500/20 to-purple-500/5 border-purple-500/30",
  rose: "from-rose-500/20 to-rose-500/5 border-rose-500/30",
  amber: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
};

interface PathRow {
  id: string; slug: string; title: string; description: string; theme_color: string; icon: string;
  total: number; completed: number; enrolled: boolean;
}

export default function Paths() {
  const { user } = useAuth();
  const [paths, setPaths] = useState<PathRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "Learning Paths — BookInsight"; }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: lp } = await supabase
        .from("learning_paths")
        .select("id,slug,title,description,theme_color,icon,learning_path_books(book_id)")
        .order("sort_order");

      let completedByBook = new Set<string>();
      let enrolledIds = new Set<string>();
      if (user) {
        const [{ data: prog }, { data: enr }] = await Promise.all([
          supabase.from("reading_progress").select("book_id,completed").eq("user_id", user.id).eq("completed", true),
          supabase.from("path_enrollments").select("path_id").eq("user_id", user.id),
        ]);
        completedByBook = new Set((prog ?? []).map((p: any) => p.book_id));
        enrolledIds = new Set((enr ?? []).map((e: any) => e.path_id));
      }

      setPaths((lp ?? []).map((p: any) => {
        const books = p.learning_path_books ?? [];
        return {
          id: p.id, slug: p.slug, title: p.title, description: p.description,
          theme_color: p.theme_color, icon: p.icon,
          total: books.length,
          completed: books.filter((b: any) => completedByBook.has(b.book_id)).length,
          enrolled: enrolledIds.has(p.id),
        };
      }));
      setLoading(false);
    })();
  }, [user]);

  return (
    <Layout>
      <section className="bg-hero border-b border-border">
        <div className="container py-14">
          <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Curated journeys</div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight">Learning Paths</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">Hand-picked book bundles in a deliberate reading order. Enroll to track progress and transform an area of your life.</p>
        </div>
      </section>

      <section className="container py-10">
        {loading ? (
          <div className="text-center text-muted-foreground py-20">Loading paths…</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paths.map(p => {
              const Icon = iconMap[p.icon] ?? Sparkles;
              const pct = p.total ? Math.round((p.completed / p.total) * 100) : 0;
              return (
                <Link key={p.id} to={`/paths/${p.slug}`} className="group">
                  <Card className={`bg-gradient-to-br ${colorMap[p.theme_color] ?? colorMap.amber} h-full transition-all group-hover:shadow-cover group-hover:-translate-y-0.5`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="h-12 w-12 rounded-xl bg-background grid place-items-center shadow-paper">
                          <Icon className="h-6 w-6 text-foreground" />
                        </div>
                        {p.enrolled && <Badge variant="secondary" className="text-xs">Enrolled</Badge>}
                      </div>
                      <h3 className="font-serif text-xl font-bold mb-2 group-hover:text-primary transition-colors">{p.title}</h3>
                      <p className="text-sm text-muted-foreground mb-5 line-clamp-2">{p.description}</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{p.completed}/{p.total} books</span>
                          <span className="font-semibold">{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                      <div className="mt-4 flex items-center text-sm text-primary font-medium">
                        Explore path <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </Layout>
  );
}
