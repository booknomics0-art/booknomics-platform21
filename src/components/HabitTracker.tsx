import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pencil, Save, Trophy, X } from "lucide-react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface Entry { day_number: number; done: boolean; score: number; notes: string | null }

function ReflectionEditor({ day, entry, onSave }: { day: number; entry?: Entry; onSave: (patch: Partial<Entry>) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry?.notes ?? "");
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing) setDraft(entry?.notes ?? "");
  }, [editing, entry?.notes]);

  const handleSave = () => {
    onSave({ notes: draft });
    setEditing(false);
    setSaved(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  const handleCancel = () => {
    setDraft(entry?.notes ?? "");
    setEditing(false);
  };

  if (!editing) {
    const hasNote = (entry?.notes ?? "").trim().length > 0;
    return (
      <div className="flex items-center justify-between gap-2">
        <p className={`text-sm leading-relaxed ${hasNote ? "text-foreground" : "text-muted-foreground italic"} flex-1`}>
          {hasNote ? entry!.notes : "What did you try? What worked?"}
        </p>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Edit day ${day} reflection`}
        >
          <Pencil className="h-3.5 w-3.5" />
          {hasNote ? "Edit" : "Add"}
        </button>
        {saved && (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="What did you try? What worked?"
        rows={2}
        autoFocus
        className="min-h-[56px] py-2 text-sm resize-y"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} className="h-7 text-xs bg-gold text-primary-foreground hover:opacity-90">
          <Save className="h-3.5 w-3.5 mr-1" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCancel} className="h-7 text-xs">
          <X className="h-3.5 w-3.5 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

export const HabitTracker = ({ bookId }: { bookId: string }) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Record<number, Entry>>({});
  const [loading, setLoading] = useState(true);
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("habit_entries").select("*").eq("user_id", user.id).eq("book_id", bookId);
      const map: Record<number, Entry> = {};
      (data ?? []).forEach(e => { map[e.day_number] = e as any; });
      setEntries(map);
      const allDone = [1,2,3,4,5,6,7].every(d => map[d]?.done);
      if (allDone) celebratedRef.current = true; // don't re-celebrate on first load
      setLoading(false);
    })();
  }, [user, bookId]);

  if (!user) return <p className="text-muted-foreground text-sm">Sign in to track your 7-day practice.</p>;
  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const fireConfetti = () => {
    const end = Date.now() + 800;
    const colors = ["#f5b400", "#10b981", "#3b82f6", "#ec4899"];
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  };

  const upsert = async (day: number, patch: Partial<Entry>) => {
    const current = entries[day] ?? { day_number: day, done: false, score: 0, notes: "" };
    const next = { ...current, ...patch };
    const nextMap = { ...entries, [day]: next };
    setEntries(nextMap);
    const { error } = await supabase.from("habit_entries").upsert({
      user_id: user.id, book_id: bookId, day_number: day,
      done: next.done, score: next.score, notes: next.notes,
    }, { onConflict: "user_id,book_id,day_number" });
    if (error) { toast.error("Save failed"); return; }
    const allDone = [1,2,3,4,5,6,7].every(d => nextMap[d]?.done);
    if (allDone && !celebratedRef.current) {
      celebratedRef.current = true;
      fireConfetti();
      toast.success("🏆 7-day practice complete! Beautiful work.");
      // Mark book as completed for retention/library status
      await supabase.from("reading_progress").upsert(
        { user_id: user.id, book_id: bookId, completed: true, last_read_at: new Date().toISOString() },
        { onConflict: "user_id,book_id" } as any
      );
    }
  };

  const streak = (() => {
    let s = 0;
    for (let d = 1; d <= 7; d++) if (entries[d]?.done) s++; else break;
    return s;
  })();

  const doneCount = [1,2,3,4,5,6,7].filter(d => entries[d]?.done).length;
  const pct = Math.round((doneCount / 7) * 100);
  const allDone = doneCount === 7;

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${allDone ? "bg-emerald-500/5 border-emerald-500/30" : "bg-muted/30 border-border"}`}>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold flex items-center gap-1.5">
            {allDone ? <><Trophy className="h-4 w-4 text-emerald-600" /> 7-day practice complete!</> : <>Progress · {doneCount}/7 days</>}
          </span>
          <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 font-semibold text-xs">🔥 Streak: {streak}</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>
      <div className="overflow-hidden border border-border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="text-left">
              <th className="p-3 w-16">Day</th>
              <th className="p-3 w-16">Done</th>
              <th className="p-3 w-24">Score</th>
              <th className="p-3">Daily Reflection</th>
            </tr>
          </thead>
          <tbody>
            {[1,2,3,4,5,6,7].map(day => {
              const e = entries[day];
              return (
                <tr key={day} className="border-t border-border">
                  <td className="p-3 font-serif font-semibold">{day}</td>
                  <td className="p-3">
                    <button
                      onClick={() => upsert(day, { done: !e?.done })}
                      className={`h-7 w-7 rounded-md border-2 grid place-items-center transition ${e?.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-primary"}`}
                      aria-label={`Mark day ${day}`}
                    >
                      {e?.done && <Check className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="p-3">
                    <select
                      value={e?.score ?? 0}
                      onChange={ev => upsert(day, { score: Number(ev.target.value) })}
                      className="h-8 px-2 rounded border border-input bg-background"
                    >
                      {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <ReflectionEditor day={day} entry={e} onSave={patch => upsert(day, patch)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const BookNotes = ({ bookId }: { bookId: string }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("book_notes").select("*").eq("user_id", user.id).eq("book_id", bookId).order("created_at", { ascending: false })
      .then(({ data }) => setNotes(data ?? []));
  }, [user, bookId]);

  if (!user) return <p className="text-muted-foreground text-sm">Sign in to save personal notes.</p>;

  const add = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("book_notes").insert({ user_id: user.id, book_id: bookId, content }).select().single();
    setSaving(false);
    if (error) { toast.error("Failed"); return; }
    setNotes([data, ...notes]);
    setContent("");
  };

  const del = async (id: string) => {
    await supabase.from("book_notes").delete().eq("id", id);
    setNotes(notes.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={content} onChange={e => setContent(e.target.value)} placeholder="Write a personal note…" onKeyDown={e => e.key === "Enter" && add()} />
        <Button onClick={add} disabled={saving} className="bg-gold text-primary-foreground hover:opacity-90">Add</Button>
      </div>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No notes yet. Capture an insight as you read.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map(n => (
            <li key={n.id} className="flex items-start justify-between gap-3 p-4 rounded-lg bg-muted/40 border border-border">
              <div className="flex-1">
                <p className="text-sm">{n.content}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => del(n.id)} className="text-xs text-muted-foreground hover:text-destructive">Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
