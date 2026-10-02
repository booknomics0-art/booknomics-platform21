import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Clock3, Loader2, PlayCircle } from "lucide-react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  id: string;
  title: string;
  author: string | null;
  language: string;
  reason: string | null;
  status: string;
  created_at: string;
};

type Group = {
  key: string;
  title: string;
  author: string | null;
  count: number;
  ids: string[];
  languages: Record<string, number>;
  statuses: Record<string, number>;
  latest: string;
  reasons: string[];
};

const norm = (s: string | null) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export default function AdminDemand() {
  return (
    <AdminGuard>
      <AdminShell title="Reader Demand">
        <DemandInner />
      </AdminShell>
    </AdminGuard>
  );
}

function DemandInner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const out: Row[] = [];
    const pageSize = 500;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("book_requests")
        .select("id,title,author,language,reason,status,created_at")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) {
        setLoading(false);
        return toast.error(error.message);
      }
      const batch = (data ?? []) as Row[];
      out.push(...batch);
      if (batch.length < pageSize) break;
    }
    setRows(out);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const r of rows) {
      const key = `${norm(r.title)}::${norm(r.author)}`;
      const g = map.get(key) ?? {
        key,
        title: r.title,
        author: r.author,
        count: 0,
        ids: [],
        languages: {},
        statuses: {},
        latest: r.created_at,
        reasons: [],
      };
      g.count += 1;
      g.ids.push(r.id);
      g.languages[r.language] = (g.languages[r.language] ?? 0) + 1;
      g.statuses[r.status] = (g.statuses[r.status] ?? 0) + 1;
      if (r.created_at > g.latest) g.latest = r.created_at;
      if (r.reason && g.reasons.length < 3) g.reasons.push(r.reason);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest));
  }, [rows]);

  const setStatus = async (g: Group, status: "planned" | "in_progress" | "published") => {
    setBusyKey(g.key);
    const { error } = await supabase.from("book_requests").update({ status }).in("id", g.ids);
    setBusyKey(null);
    if (error) return toast.error(error.message);
    toast.success(`${g.title}: ${status.replace("_", " ")}`);
    await load();
  };

  const unique = groups.length;
  const total = rows.length;
  const hindi = rows.filter(r => r.language === "hi").length;
  const unresolved = rows.filter(r => !["published", "rejected"].includes(r.status)).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Total requests", total],
          ["Unique titles", unique],
          ["Hindi demand", hindi],
          ["Open demand", unresolved],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <BarChart3 className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h2 className="font-semibold">How to use this board</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Prioritise repeated requests first, then cross-check internal search terms, content/source availability and quality readiness. Do not auto-publish a requested title just because demand is high.
            </p>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading demand…</div>
        ) : groups.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No reader requests yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Book</th>
                  <th className="text-center p-3">Requests</th>
                  <th className="text-left p-3">Language</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => {
                  const dominantStatus = Object.entries(g.statuses).sort((a,b) => b[1]-a[1])[0]?.[0] ?? "new";
                  return (
                    <tr key={g.key} className="border-t align-top">
                      <td className="p-3 min-w-[260px]">
                        <div className="font-medium">{g.title}</div>
                        <div className="text-xs text-muted-foreground">{g.author || "Author not specified"}</div>
                        {g.reasons[0] && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">“{g.reasons[0]}”</div>}
                      </td>
                      <td className="p-3 text-center"><Badge>{g.count}</Badge></td>
                      <td className="p-3 text-xs">
                        {g.languages.en ? `EN ${g.languages.en}` : ""}
                        {g.languages.en && g.languages.hi ? " · " : ""}
                        {g.languages.hi ? `HI ${g.languages.hi}` : ""}
                        {g.languages.other ? ` · Other ${g.languages.other}` : ""}
                      </td>
                      <td className="p-3"><Badge variant="secondary">{dominantStatus.replace("_", " ")}</Badge></td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1 flex-wrap min-w-[240px]">
                          <Button size="sm" variant="outline" disabled={busyKey===g.key} onClick={() => setStatus(g,"planned")}><Clock3 className="h-3.5 w-3.5 mr-1" />Plan</Button>
                          <Button size="sm" variant="outline" disabled={busyKey===g.key} onClick={() => setStatus(g,"in_progress")}><PlayCircle className="h-3.5 w-3.5 mr-1" />Start</Button>
                          <Button size="sm" disabled={busyKey===g.key} onClick={() => setStatus(g,"published")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Published</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
