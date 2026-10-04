import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pencil, Save, Trophy, X, ArrowRight, Lightbulb } from "lucide-react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface Entry { day_number: number; done: boolean; score: number; notes: string | null }
type Language = "en" | "hi";

const copy = (hi: boolean, en: string, hindi: string) => hi ? hindi : en;

function ReflectionEditor({
  day, entry, onSave, language,
}: {
  day: number;
  entry?: Entry;
  onSave: (patch: Partial<Entry>) => void;
  language: Language;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry?.notes ?? "");
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hi = language === "hi";
  const placeholder = copy(hi, "What changed when you tried it?", "आजमाने पर क्या बदला?");

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
          {hasNote ? entry!.notes : placeholder}
        </p>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          aria-label={copy(hi, `Edit day ${day} reflection`, `दिन ${day} का चिंतन लिखें`)}
        >
          <Pencil className="h-3.5 w-3.5" />
          {hasNote ? copy(hi, "Edit", "बदलें") : copy(hi, "Add", "लिखें")}
        </button>
        {saved && (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <Check className="h-3.5 w-3.5" /> {copy(hi, "Saved", "सहेजा")}
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
        placeholder={placeholder}
        rows={2}
        autoFocus
        className="min-h-[56px] py-2 text-sm resize-y"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} className="h-7 text-xs bg-gold text-primary-foreground hover:opacity-90">
          <Save className="h-3.5 w-3.5 mr-1" /> {copy(hi, "Save", "सहेजें")}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCancel} className="h-7 text-xs">
          <X className="h-3.5 w-3.5 mr-1" /> {copy(hi, "Cancel", "रद्द करें")}
        </Button>
      </div>
    </div>
  );
}

export const HabitTracker = ({ bookId }: { bookId: string }) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Record<number, Entry>>({});
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>("en");
  const celebratedRef = useRef(false);
  const hi = language === "hi";

  useEffect(() => {
    let alive = true;
    supabase.from("books").select("language").eq("id", bookId).maybeSingle()
      .then(({ data }) => {
        if (alive && data?.language === "hi") setLanguage("hi");
      });
    return () => { alive = false; };
  }, [bookId]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("habit_entries").select("*").eq("user_id", user.id).eq("book_id", bookId);
      const map: Record<number, Entry> = {};
      (data ?? []).forEach(e => { map[e.day_number] = e as any; });
      setEntries(map);
      const allDone = [1,2,3,4,5,6,7].every(d => map[d]?.done);
      if (allDone) celebratedRef.current = true;
      setLoading(false);
    })();
  }, [user, bookId]);

  if (!user) return <p className="text-muted-foreground text-sm">{copy(hi, "Sign in to track your 7-day practice.", "7-दिन की प्रैक्टिस ट्रैक करने के लिए साइन इन करें।")}</p>;
  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const fireConfetti = () => {
    const end = Date.now() + 800;
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 } });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 } });
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
    if (error) { toast.error(copy(hi, "Save failed", "सेव नहीं हो पाया")); return; }
    const allDone = [1,2,3,4,5,6,7].every(d => nextMap[d]?.done);
    if (allDone && !celebratedRef.current) {
      celebratedRef.current = true;
      fireConfetti();
      toast.success(copy(hi, "7-day practice complete — keep the one idea that worked best.", "7-दिन की प्रैक्टिस पूरी — अब वही एक सीख रखें जो सबसे काम आई।"));
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
  const nextDay = [1,2,3,4,5,6,7].find(d => !entries[d]?.done);

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${allDone ? "bg-emerald-500/5 border-emerald-500/30" : "bg-muted/30 border-border"}`}>
        <div className="flex items-center justify-between gap-3 text-sm mb-2 flex-wrap">
          <span className="font-semibold flex items-center gap-1.5">
            {allDone
              ? <><Trophy className="h-4 w-4 text-emerald-600" /> {copy(hi, "7-day practice complete", "7-दिन की प्रैक्टिस पूरी")}</>
              : <>{copy(hi, "Practice progress", "प्रैक्टिस प्रगति")} · {doneCount}/7</>}
          </span>
          <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 font-semibold text-xs">
            {copy(hi, "Current run", "लगातार दिन")}: {streak}
          </span>
        </div>
        <Progress value={pct} className="h-2" />
        {!allDone && nextDay && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-background/70 border border-border/70 p-3 text-sm">
            <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <p>
              <strong>{copy(hi, `Next move: Day ${nextDay}.`, `अगला कदम: दिन ${nextDay}।`)}</strong>{" "}
              {copy(hi, "Keep it small: do the practice, then write one sentence about what changed.", "इसे छोटा रखें: अभ्यास करें, फिर सिर्फ एक वाक्य लिखें—क्या बदला?")}
            </p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-muted/60">
            <tr className="text-left">
              <th className="p-3 w-16">{copy(hi, "Day", "दिन")}</th>
              <th className="p-3 w-16">{copy(hi, "Done", "पूरा")}</th>
              <th className="p-3 w-24">{copy(hi, "Impact", "असर")}</th>
              <th className="p-3">{copy(hi, "One-line reflection", "एक-पंक्ति चिंतन")}</th>
            </tr>
          </thead>
          <tbody>
            {[1,2,3,4,5,6,7].map(day => {
              const e = entries[day];
              return (
                <tr key={day} className="border-t border-border align-top">
                  <td className="p-3 font-serif font-semibold">{day}</td>
                  <td className="p-3">
                    <button
                      onClick={() => upsert(day, { done: !e?.done })}
                      className={`h-7 w-7 rounded-md border-2 grid place-items-center transition ${e?.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-primary"}`}
                      aria-label={copy(hi, `Mark day ${day}`, `दिन ${day} पूरा करें`)}
                    >
                      {e?.done && <Check className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="p-3">
                    <select
                      value={e?.score ?? 0}
                      onChange={ev => upsert(day, { score: Number(ev.target.value) })}
                      className="h-8 px-2 rounded border border-input bg-background"
                      aria-label={copy(hi, `Impact score for day ${day}`, `दिन ${day} का असर`)}
                    >
                      {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <ReflectionEditor day={day} entry={e} language={language} onSave={patch => upsert(day, patch)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {copy(hi, "Impact is your own 0–5 signal, not a performance score. Zero is allowed; the point is to notice what actually works.", "असर 0–5 आपका अपना संकेत है, कोई performance score नहीं। 0 भी ठीक है—मकसद सिर्फ यह देखना है कि सच में क्या काम करता है।")}
      </p>
    </div>
  );
};

export const BookNotes = ({ bookId }: { bookId: string }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const hi = language === "hi";

  useEffect(() => {
    supabase.from("books").select("language").eq("id", bookId).maybeSingle()
      .then(({ data }) => data?.language === "hi" && setLanguage("hi"));
  }, [bookId]);

  useEffect(() => {
    if (!user) return;
    supabase.from("book_notes").select("*").eq("user_id", user.id).eq("book_id", bookId).order("created_at", { ascending: false })
      .then(({ data }) => setNotes(data ?? []));
  }, [user, bookId]);

  if (!user) return <p className="text-muted-foreground text-sm">{copy(hi, "Sign in to save personal notes.", "अपने नोट्स सहेजने के लिए साइन इन करें।")}</p>;

  const prompts = hi
    ? ["मुझे सबसे ज्यादा चौंकाने वाली बात…", "मैं इससे असहमत हूँ क्योंकि…", "मैं इसे इस हफ्ते ऐसे आजमाऊँगा…"]
    : ["What surprised me most…", "I disagree with this because…", "This week I want to test…"];

  const add = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("book_notes").insert({ user_id: user.id, book_id: bookId, content: content.trim() }).select().single();
    setSaving(false);
    if (error) { toast.error(copy(hi, "Could not save note", "नोट सेव नहीं हो पाया")); return; }
    setNotes([data, ...notes]);
    setContent("");
  };

  const del = async (id: string) => {
    await supabase.from("book_notes").delete().eq("id", id);
    setNotes(notes.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-muted/25 p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <Lightbulb className="h-4 w-4 text-primary" />
          {copy(hi, "Turn reading into your own thinking", "पढ़ी हुई बात को अपनी सोच में बदलें")}
        </div>
        <div className="flex flex-wrap gap-2">
          {prompts.map(prompt => (
            <button
              key={prompt}
              onClick={() => setContent(prev => prev.trim() ? prev : `${prompt} `)}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:border-primary/50 transition"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={copy(hi, "Capture one thought worth returning to…", "एक ऐसी बात लिखें जिस पर आप फिर लौटना चाहेंगे…")}
          onKeyDown={e => e.key === "Enter" && add()}
        />
        <Button onClick={add} disabled={saving || !content.trim()} className="bg-gold text-primary-foreground hover:opacity-90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : copy(hi, "Save thought", "सोच सहेजें")}
        </Button>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{copy(hi, "No notes yet. Save one idea you want to remember tomorrow.", "अभी कोई नोट नहीं। एक ऐसी सीख लिखें जिसे आप कल भी याद रखना चाहेंगे।")}</p>
      ) : (
        <ul className="space-y-2">
          {notes.map(n => (
            <li key={n.id} className="flex items-start justify-between gap-3 p-4 rounded-xl bg-muted/35 border border-border">
              <div className="flex-1">
                <p className="text-sm leading-relaxed">{n.content}</p>
                <p className="text-[11px] text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString(hi ? "hi-IN" : undefined)}</p>
              </div>
              <button onClick={() => del(n.id)} className="text-xs text-muted-foreground hover:text-destructive">{copy(hi, "Delete", "हटाएँ")}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
