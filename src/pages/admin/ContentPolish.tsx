import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { auditPolish, auditHumanized, scoreColor, scoreBg, BookForAudit } from "@/lib/seoScore";
import { toast } from "sonner";

const FIELDS = ["tagline","overview","key_ideas","daily_application","action_system","reflection_questions","deep_analysis"] as const;
type Field = typeof FIELDS[number];

const PAGE_SIZE = 500;
const MAX_ADMIN_BOOKS = 5000;

async function fetchBooksForPolish() {
  const rows: BookForAudit[] = [];
  for (let from = 0; from < MAX_ADMIN_BOOKS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("books_admin")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as any[];
    rows.push(...(page as BookForAudit[]));
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export default function ContentPolishPage() {
  return (
    <AdminGuard>
      <AdminShell title="Content Polish (manual mode — zero AI credits)">
        <Inner />
      </AdminShell>
    </AdminGuard>
  );
}

function Inner() {
  const [params] = useSearchParams();
  const focusId = params.get("book");
  const [books, setBooks] = useState<BookForAudit[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(focusId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBooksForPolish();
        if (cancelled) return;
        setBooks(data);
        if (!focusId && data[0]) setSelectedId(data[0].id);
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || "Could not load books for content audit");
      }
    })();
    return () => { cancelled = true; };
  }, [focusId]);

  const book = books.find(b => b.id === selectedId) || null;
  const term = q.trim().toLowerCase();
  const list = books.filter(b => !term || b.title.toLowerCase().includes(term));

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4">
      <Card className="p-3 max-h-[75vh] overflow-y-auto">
        <Input placeholder="Search" value={q} onChange={e => setQ(e.target.value)} className="mb-2" />
        <div className="mb-2 text-[11px] text-muted-foreground">{list.length} books loaded for audit</div>
        <ul className="space-y-1">
          {list.map(b => (
            <li key={b.id}>
              <button onClick={() => setSelectedId(b.id)}
                      className={`w-full text-left text-sm p-2 rounded hover:bg-muted ${selectedId === b.id ? "bg-muted" : ""}`}>
                {b.title}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <div>{book && <PolishPanel key={book.id} initial={book} />}</div>
    </div>
  );
}

function PolishPanel({ initial }: { initial: BookForAudit }) {
  const [draft, setDraft] = useState<BookForAudit>(initial);
  const [saving, setSaving] = useState(false);

  const polish = useMemo(() => auditPolish(draft), [draft]);
  const human = useMemo(() => auditHumanized(draft), [draft]);

  const save = async () => {
    setSaving(true);
    try {
      const patch = {
        tagline: draft.tagline ?? null,
        overview: draft.overview ?? null,
        key_ideas: draft.key_ideas ?? null,
        daily_application: draft.daily_application ?? null,
        action_system: draft.action_system ?? null,
        reflection_questions: draft.reflection_questions ?? null,
        deep_analysis: draft.deep_analysis ?? null,
      };
      const { error } = await supabase.from("books").update(patch).eq("id", draft.id);
      if (error) throw error;
      toast.success("Saved");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const setField = (f: Field, v: string) => setDraft(d => ({ ...d, [f]: v }));

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">{draft.title}</h2>
          <div className="text-xs text-muted-foreground">{draft.author}</div>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ScoreBlock label="Polishing" score={polish.score} />
        <ScoreBlock label="Humanized" score={human.score} />
      </div>

      <Card className="p-3 bg-muted/30">
        <div className="text-xs font-semibold uppercase mb-2">Humanization checklist</div>
        <ul className="text-xs space-y-1">
          {human.checks.map(c => (
            <li key={c.id} className={c.passed ? "text-emerald-600" : "text-amber-700 dark:text-amber-400"}>
              {c.passed ? "✓" : "•"} {c.label}{c.detail ? ` — ${c.detail}` : ""}
              {!c.passed && c.fix && <span className="block text-muted-foreground pl-3">→ {c.fix}</span>}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-3 bg-muted/30">
        <div className="text-xs font-semibold uppercase mb-2">Polishing checklist</div>
        <ul className="text-xs space-y-1">
          {polish.checks.map(c => (
            <li key={c.id} className={c.passed ? "text-emerald-600" : "text-amber-700 dark:text-amber-400"}>
              {c.passed ? "✓" : "•"} {c.label}{c.detail ? ` — ${c.detail}` : ""}
              {!c.passed && c.fix && <span className="block text-muted-foreground pl-3">→ {c.fix}</span>}
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-3">
        {FIELDS.map(f => (
          <div key={f}>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{f.replace(/_/g, " ")}</label>
            <Textarea value={(draft as any)[f] || ""} onChange={e => setField(f, e.target.value)} className="min-h-[110px] mt-1" />
          </div>
        ))}
      </div>

      <Templates />
    </Card>
  );
}

function ScoreBlock({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`text-3xl font-bold tabular-nums ${scoreColor(score)}`}>{score}</div>
      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${scoreBg(score)}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function Templates() {
  const items = [
    ["Meta title formula", "{{Book Title}} Summary, Key Ideas & Lessons | Booknomics"],
    ["Meta description formula", "Full summary of {{Book Title}} by {{Author}} — key ideas, action steps, and a {{minutes}}-minute read. Free on Booknomics."],
    ["Hook opener", "Most readers miss the single biggest idea in {{Book Title}}: {{idea}}."],
    ["Intro humanizer", "Here's the part most summaries skip — and the one thing that actually changed how I {{verb}}."],
    ["CTA closer", "Try this for the next 7 days and notice what shifts."],
  ];
  return (
    <Card className="p-3">
      <div className="text-xs font-semibold uppercase mb-2">Templates</div>
      <ul className="space-y-2 text-sm">
        {items.map(([k, v]) => (
          <li key={k}>
            <div className="text-xs font-medium">{k}</div>
            <div className="text-xs font-mono bg-muted rounded p-2 mt-1 cursor-pointer"
                 onClick={() => { navigator.clipboard.writeText(v); toast.success("Copied"); }}
                 title="Click to copy">{v}</div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
