import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { auditOnPage, auditPolish, auditHumanized, scoreColor, scoreBg, BookForAudit, bookUrl } from "@/lib/seoScore";
import { ExternalLink, ArrowRight } from "lucide-react";

type Row = BookForAudit & { is_draft: boolean; created_at: string; status?: string | null };

type Filter = "all" | "low_seo" | "needs_polish" | "draft" | "published" | "noindex" | "recent";

export default function SeoDashboardPage() {
  return (
    <AdminGuard>
      <AdminShell title="SEO Dashboard">
        <Inner />
      </AdminShell>
    </AdminGuard>
  );
}

function Inner() {
  const [books, setBooks] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const pageSize = 500;
      const rows: Row[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("books_admin")
          .select("id,slug,title,author,category,language,is_draft,status,created_at,meta_title,meta_description,og_image,cover_url,tagline,overview,key_ideas,deep_analysis,daily_application,action_system,reflection_questions,affiliate_link")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) break;
        const batch = (data ?? []) as unknown as Row[];
        rows.push(...batch);
        if (batch.length < pageSize) break;
      }
      setBooks(rows);
      setLoading(false);
    })();
  }, []);

  const scored = useMemo(() => books.map(b => {
    const on = auditOnPage(b);
    const po = auditPolish(b);
    const hu = auditHumanized(b);
    return { b, on: on.score, po: po.score, hu: hu.score, failed: on.failed.length };
  }), [books]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const oneWeekAgo = Date.now() - 7 * 86400000;
    return scored.filter(({ b, on, po }) => {
      if (term && !`${b.title} ${b.author} ${b.slug}`.toLowerCase().includes(term)) return false;
      if (filter === "draft" && !b.is_draft) return false;
      if (filter === "published" && (b.is_draft || b.status !== "published")) return false;
      if (filter === "noindex" && (b.is_draft || b.status !== "published_noindex")) return false;
      if (filter === "low_seo" && on >= 60) return false;
      if (filter === "needs_polish" && po >= 60) return false;
      if (filter === "recent" && new Date(b.created_at).getTime() < oneWeekAgo) return false;
      return true;
    });
  }, [scored, q, filter]);

  const avg = (k: "on" | "po" | "hu") =>
    scored.length ? Math.round(scored.reduce((a, r) => a + r[k], 0) / scored.length) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Books" value={books.length} />
        <Stat label="Avg On-page" value={avg("on")} pct />
        <Stat label="Avg Polish" value={avg("po")} pct />
        <Stat label="Avg Humanized" value={avg("hu")} pct />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search title / author / slug" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs" />
        {(["all","published","noindex","draft","low_seo","needs_polish","recent"] as Filter[]).map(f => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f.replace("_", " ")}
          </Button>
        ))}
        <div className="ml-auto text-sm text-muted-foreground">{filtered.length} pages</div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/40">
            <tr>
              <th className="p-3">Title</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center">On-page</th>
              <th className="p-3 text-center">Polish</th>
              <th className="p-3 text-center">Humanized</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No matches.</td></tr>}
            {filtered.map(({ b, on, po, hu }) => (
              <tr key={b.id} className="border-t hover:bg-muted/30">
                <td className="p-3">
                  <div className="font-medium line-clamp-1">{b.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{b.author}</div>
                </td>
                <td className="p-3 max-w-[220px]">
                  <span className="text-xs font-mono text-muted-foreground line-clamp-1">{b.slug}</span>
                </td>
                <td className="p-3">
                  {b.is_draft
                    ? <Badge variant="outline">Draft</Badge>
                    : b.status === "published"
                      ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Indexable</Badge>
                      : <Badge variant="secondary">Live · noindex</Badge>}
                </td>
                <ScoreCell score={on} />
                <ScoreCell score={po} />
                <ScoreCell score={hu} />
                <td className="p-3 whitespace-nowrap">
                  <Link to={`/admin/seo/page/${b.id}`}>
                    <Button size="sm" variant="ghost" className="h-7 gap-1">Audit <ArrowRight className="h-3 w-3" /></Button>
                  </Link>
                  <a href={bookUrl(b.slug)} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost" className="h-7"><ExternalLink className="h-3 w-3" /></Button>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value, pct }: { label: string; value: number; pct?: boolean }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${pct ? scoreColor(value) : ""}`}>{value}{pct ? "" : ""}</div>
    </Card>
  );
}

function ScoreCell({ score }: { score: number }) {
  return (
    <td className="p-3 text-center">
      <div className={`inline-flex items-center gap-2`}>
        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${scoreBg(score)}`} style={{ width: `${score}%` }} />
        </div>
        <span className={`text-xs font-semibold tabular-nums ${scoreColor(score)}`}>{score}</span>
      </div>
    </td>
  );
}
