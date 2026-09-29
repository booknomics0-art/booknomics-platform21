import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ThumbsUp, Flame, Lightbulb, CheckCircle2, Users, MessageSquare, BookmarkPlus, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const REACTIONS = [
  { type: "helpful", label: "Helpful", icon: ThumbsUp, color: "text-blue-600" },
  { type: "powerful", label: "Powerful", icon: Flame, color: "text-orange-500" },
  { type: "insightful", label: "Insightful", icon: Lightbulb, color: "text-amber-500" },
  { type: "applied", label: "Applied", icon: CheckCircle2, color: "text-emerald-600" },
] as const;

type Top = { user_id: string; display_name: string | null; avatar_url: string | null; total_points: number; books_completed: number };

export const CommunitySidebar = ({ bookId }: { bookId: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ readers: 0, comments: 0, saves: 0 });
  const [top, setTop] = useState<Top[]>([]);

  const load = async () => {
    const [{ data: rx }, { data: lib }, { data: disc }, { data: lb }] = await Promise.all([
      supabase.from("reactions").select("type,user_id").eq("book_id", bookId).is("comment_id", null),
      supabase.from("library").select("user_id").eq("book_id", bookId),
      supabase.from("discussions").select("id").eq("book_id", bookId),
      (supabase as any).from("leaderboard_view").select("*").order("total_points", { ascending: false }).limit(5),
    ]);
    const c: Record<string, number> = {};
    (rx || []).forEach((r: any) => { c[r.type] = (c[r.type] || 0) + 1; });
    setCounts(c);
    if (user) setMine(new Set((rx || []).filter((r: any) => r.user_id === user.id).map((r: any) => r.type)));
    setStats({ readers: (lib || []).length, comments: (disc || []).length, saves: (lib || []).length });
    setTop((lb as Top[]) || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bookId, user?.id]);

  const toggle = async (type: string) => {
    if (!user) { navigate("/auth"); return; }
    const has = mine.has(type);
    // Optimistic
    const next = new Set(mine);
    has ? next.delete(type) : next.add(type);
    setMine(next);
    setCounts((p) => ({ ...p, [type]: Math.max(0, (p[type] || 0) + (has ? -1 : 1)) }));

    try {
      if (has) {
        const { error } = await supabase
          .from("reactions").delete()
          .eq("user_id", user.id).eq("book_id", bookId).eq("type", type)
          .is("comment_id", null);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("reactions").insert({ user_id: user.id, book_id: bookId, type });
        if (error) throw error;
      }
    } catch (e: any) {
      // Revert
      const revert = new Set(mine);
      setMine(revert);
      setCounts((p) => ({ ...p, [type]: Math.max(0, (p[type] || 0) + (has ? 1 : -1)) }));
      toast.error("Reaction failed. Please retry.");
    }
  };

  return (
    <aside className="space-y-5">
      <Card className="p-5">
        <div className="text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-3">Reader Reactions</div>
        <div className="grid grid-cols-2 gap-2">
          {REACTIONS.map((r) => {
            const active = mine.has(r.type);
            const Icon = r.icon;
            return (
              <button
                key={r.type}
                onClick={() => toggle(r.type)}
                aria-pressed={active}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all duration-200 active:scale-95 ${active ? "border-primary bg-primary/10 shadow-sm" : "border-border hover:bg-muted/50"}`}
              >
                <Icon className={`w-4 h-4 transition-transform ${active ? `${r.color} scale-110` : r.color + " opacity-70"}`} />
                <span className="flex-1 text-left text-xs font-medium">{r.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{counts[r.type] || 0}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-3">Community Stats</div>
        <div className="space-y-2.5 text-sm">
          <Row icon={Users} label="Readers" value={stats.readers} />
          <Row icon={MessageSquare} label="Discussions" value={stats.comments} />
          <Row icon={BookmarkPlus} label="Saves" value={stats.saves} />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] tracking-[0.2em] uppercase text-primary font-semibold">Top Readers</div>
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
        </div>
        {top.length === 0 ? (
          <p className="text-xs text-muted-foreground">No rankings yet. Start engaging to climb up!</p>
        ) : (
          <ol className="space-y-2.5">
            {top.map((u, i) => (
              <li key={u.user_id} className="flex items-center gap-3">
                <span className={`w-5 text-xs font-bold ${i === 0 ? "text-amber-500" : "text-muted-foreground"}`}>#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.display_name || "Reader"}</div>
                  <div className="text-[10px] text-muted-foreground">{u.books_completed} books</div>
                </div>
                <span className="text-xs font-semibold text-primary">{u.total_points} pts</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </aside>
  );
};

const Row = ({ icon: Icon, label, value }: { icon: any; label: string; value: number }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 text-muted-foreground"><Icon className="w-4 h-4" /><span>{label}</span></div>
    <span className="font-semibold">{value}</span>
  </div>
);
