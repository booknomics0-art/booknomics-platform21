import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Award, Lock, Bell, BellOff, Target, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Milestone { id: string; label: string; threshold: number; icon: string; }
const MILESTONES: Milestone[] = [
  { id: "beginner", label: "Beginner", threshold: 1, icon: "🌱" },
  { id: "curious", label: "Curious Mind", threshold: 3, icon: "📖" },
  { id: "reader", label: "Avid Reader", threshold: 7, icon: "📚" },
  { id: "scholar", label: "Scholar", threshold: 15, icon: "🎓" },
  { id: "polymath", label: "Polymath", threshold: 20, icon: "🧠" },
  { id: "sage", label: "Sage", threshold: 35, icon: "🏆" },
];

export function Milestones({ userId, completed, streak }: { userId: string; completed: number; streak: number }) {
  const [goal, setGoal] = useState(10);
  const [notif, setNotif] = useState<NotificationPermission>(typeof Notification !== "undefined" ? Notification.permission : "default");

  useEffect(() => {
    supabase.from("profiles").select("daily_goal_minutes").eq("id", userId).maybeSingle()
      .then(({ data }) => { if (data?.daily_goal_minutes) setGoal(data.daily_goal_minutes); });
  }, [userId]);

  const saveGoal = async (v: number) => {
    setGoal(v);
    await supabase.from("profiles").update({ daily_goal_minutes: v }).eq("id", userId);
  };

  const enableNotif = async () => {
    if (typeof Notification === "undefined") { toast.error("Notifications not supported"); return; }
    const p = await Notification.requestPermission();
    setNotif(p);
    if (p === "granted") {
      new Notification("🔥 Streak reminder set!", { body: `We'll keep your ${streak}-day streak alive.` });
      toast.success("Reminders enabled");
    }
  };

  const nextMilestone = MILESTONES.find(m => completed < m.threshold);
  const prevThreshold = [...MILESTONES].reverse().find(m => completed >= m.threshold)?.threshold ?? 0;
  const progressPct = nextMilestone
    ? Math.min(100, Math.round(((completed - prevThreshold) / (nextMilestone.threshold - prevThreshold)) * 100))
    : 100;

  return (
    <Card className="relative overflow-hidden border-gold/20 bg-gradient-to-br from-card via-card to-gold/[0.04] shadow-[0_8px_30px_-12px_hsl(var(--gold)/0.25)]">
      <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-gold/10 blur-3xl" aria-hidden />
      <CardContent className="relative p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-2xl font-bold flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gold to-amber-600 text-primary-foreground shadow-md">
              <Award className="h-4 w-4" />
            </span>
            Milestones
          </h2>
          <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground bg-muted/40 border border-border rounded-full px-2.5 py-1">
            {completed} {completed === 1 ? "book" : "books"} read
          </span>
        </div>

        {nextMilestone && (
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Next: <span className="font-semibold text-foreground">{nextMilestone.label}</span></span>
              <span className="font-mono tabular-nums text-muted-foreground">{completed}/{nextMilestone.threshold}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-gold to-amber-500 transition-all duration-700" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-6">
          {MILESTONES.map(m => {
            const unlocked = completed >= m.threshold;
            const isNext = !unlocked && m.id === nextMilestone?.id;
            return (
              <div
                key={m.id}
                className={`group relative rounded-xl p-3 text-center border transition-all duration-300 ${
                  unlocked
                    ? "bg-gradient-to-br from-gold/15 to-gold/5 border-gold/40 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
                    : isNext
                      ? "bg-muted/40 border-dashed border-gold/40"
                      : "bg-muted/20 border-border opacity-70"
                }`}
              >
                {unlocked && <Sparkles className="absolute top-1.5 right-1.5 h-2.5 w-2.5 text-gold/70" />}
                <div className="text-2xl mb-1 leading-none">{unlocked ? m.icon : <Lock className="h-5 w-5 mx-auto text-muted-foreground" />}</div>
                <div className={`text-[10px] font-semibold tracking-wide uppercase ${unlocked ? "text-foreground" : "text-muted-foreground"}`}>{m.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{m.threshold} {m.threshold === 1 ? "book" : "books"}</div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border/70 pt-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Target className="h-3.5 w-3.5" />
                </span>
                Daily reading goal
              </label>
              <span className="text-sm font-bold tabular-nums bg-primary/10 text-primary rounded-full px-2.5 py-0.5">{goal} min</span>
            </div>
            <Slider value={[goal]} min={5} max={60} step={5} onValueChange={(v) => setGoal(v[0])} onValueCommit={(v) => saveGoal(v[0])} />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
            <div>
              <div className="text-sm font-medium">Streak reminders</div>
              <div className="text-xs text-muted-foreground">Browser notifications to keep your streak alive</div>
            </div>
            <Button variant={notif === "granted" ? "secondary" : "outline"} size="sm" onClick={enableNotif} className="flex-shrink-0 rounded-full">
              {notif === "granted" ? <><Bell className="h-4 w-4 mr-1" /> On</> : <><BellOff className="h-4 w-4 mr-1" /> Enable</>}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
