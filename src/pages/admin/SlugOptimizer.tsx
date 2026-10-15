import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminListBooks, adminPutUrlRedirect, adminUpdateBook } from "@/lib/adminApi";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { analyzeSlug } from "@/lib/slugTools";
import { scoreColor, scoreBg, bookUrl } from "@/lib/seoScore";
import { toast } from "sonner";

type B = { id: string; slug: string; title: string; author: string; is_draft: boolean };

export default function SlugOptimizerPage() {
  return (
    <AdminGuard>
      <AdminShell title="Slug Optimizer">
        <Inner />
      </AdminShell>
    </AdminGuard>
  );
}

function Inner() {
  const [books, setBooks] = useState<B[]>([]);
  const [q, setQ] = useState("");
  const [params] = useSearchParams();
  const focus = params.get("book");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminListBooks<B>({ view: "full", limit: 500, offset: 0 })
      .then((data) => { if (active) setBooks(data); })
      .catch((error) => { if (active) toast.error(error instanceof Error ? error.message : "Could not load slugs"); });
    return () => { active = false; };
  }, []);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = books.filter(b =>
      !term || `${b.title} ${b.slug} ${b.author}`.toLowerCase().includes(term)
    );
    return filtered.map(b => ({ b, a: analyzeSlug(b.slug, b.title) }))
      .sort((x, y) => (x.b.id === focus ? -1 : y.b.id === focus ? 1 : x.a.score - y.a.score));
  }, [books, q, focus]);

  const applyNew = async (b: B, newSlug: string) => {
    if (!newSlug || newSlug === b.slug) return;
    if (!confirm(`Change slug "${b.slug}" → "${newSlug}"? A 301 redirect from the old URL will be added.`)) return;
    setSavingId(b.id);
    try {
      const oldPath = `/books/${b.slug}`;
      const newPath = `/books/${newSlug}`;
      await adminPutUrlRedirect({
        old_path: oldPath,
        new_path: newPath,
        status_code: 301,
        notes: `slug change for ${b.title}`,
      });
      await adminUpdateBook(b.id, { slug: newSlug });
      setBooks(prev => prev.map(x => x.id === b.id ? { ...x, slug: newSlug } : x));
      toast.success("Slug updated and redirect saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setSavingId(null); }
  };

  return (
    <div className="space-y-4">
      <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
      <div className="text-xs text-muted-foreground">Showing worst-scoring slugs first. Changing a slug creates a 301 redirect from the old path.</div>
      <div className="space-y-3">
        {rows.map(({ b, a }) => (
          <Card key={b.id} className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-medium line-clamp-1">{b.title}</div>
                <div className="text-xs text-muted-foreground">{b.author}</div>
                <div className="mt-1 text-xs font-mono">{bookUrl(b.slug)}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-2xl font-bold ${scoreColor(a.score)} tabular-nums`}>{a.score}</div>
                <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${scoreBg(a.score)}`} style={{ width: `${a.score}%` }} />
                </div>
              </div>
            </div>
            {a.issues.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {a.issues.map((i, idx) => <Badge key={idx} variant="destructive" className="text-[10px]">{i}</Badge>)}
              </div>
            )}
            {a.suggestions.length > 0 && (
              <div className="mt-3">
                <div className="text-xs uppercase text-muted-foreground mb-1">Suggestions</div>
                <div className="flex flex-wrap gap-2">
                  {a.suggestions.map(s => (
                    <Button key={s} size="sm" variant="outline" disabled={savingId === b.id}
                            onClick={() => applyNew(b, s)}>
                      <span className="font-mono text-xs">{s}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
