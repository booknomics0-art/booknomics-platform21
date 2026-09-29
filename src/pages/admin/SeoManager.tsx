import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  generateSeoSlug, generateSeoTitle, generateSeoDescription,
  suggestLongTailKeywords, auditSeoSlug, type BookLike,
} from "@/lib/seoSlugTools";
import { AlertTriangle, CheckCircle2, Sparkles, ExternalLink, Wand2, Save } from "lucide-react";

type BookRow = {
  id: string;
  slug: string;
  title: string;
  author: string;
  category: string | null;
  language: string;
  is_draft: boolean;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  seo_slug: string | null;
  seo_keywords: string[] | null;
  old_slugs: string[] | null;
  overview: string | null;
};

const SITE = "https://booknomics.com";

type Issue = "broken_slug" | "no_keyword" | "no_meta_title" | "no_meta_desc" | "dup_title" | "dup_desc" | "long_title" | "long_desc" | "thin_content";

function scoreBook(b: BookRow, dupTitles: Set<string>, dupDescs: Set<string>) {
  const issues: Issue[] = [];
  const preferred = b.seo_slug || b.slug;
  const audit = auditSeoSlug(preferred, b);
  if (audit.score < 40) issues.push("broken_slug");
  if (!/summary|hindi|saransh|lessons/.test(preferred)) issues.push("no_keyword");
  if (!b.meta_title) issues.push("no_meta_title");
  else if (b.meta_title.length > 65) issues.push("long_title");
  if (!b.meta_description) issues.push("no_meta_desc");
  else if (b.meta_description.length > 160) issues.push("long_desc");
  if (b.meta_title && dupTitles.has(b.meta_title.toLowerCase())) issues.push("dup_title");
  if (b.meta_description && dupDescs.has(b.meta_description.toLowerCase())) issues.push("dup_desc");
  if ((b.overview?.length ?? 0) < 300) issues.push("thin_content");
  const score = Math.max(0, 100 - issues.length * 12);
  return { issues, score };
}

const ISSUE_LABEL: Record<Issue, string> = {
  broken_slug: "Broken slug",
  no_keyword: "No SEO keyword in URL",
  no_meta_title: "Missing meta title",
  no_meta_desc: "Missing meta description",
  dup_title: "Duplicate meta title",
  dup_desc: "Duplicate meta description",
  long_title: "Title >65 chars",
  long_desc: "Description >160 chars",
  thin_content: "Thin content (<300 chars)",
};

export default function SeoManagerPage() {
  return (
    <AdminGuard>
      <AdminShell title="SEO Manager — Long-Tail Keywords">
        <Inner />
      </AdminShell>
    </AdminGuard>
  );
}

function Inner() {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [issueFilter, setIssueFilter] = useState<Issue | "all">("all");
  const [editing, setEditing] = useState<BookRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("books")
      .select("id,slug,title,author,category,language,is_draft,meta_title,meta_description,og_image,seo_slug,seo_keywords,old_slugs,overview")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) toast.error(error.message);
    else setBooks((data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const { dupTitles, dupDescs } = useMemo(() => {
    const tc = new Map<string, number>(), dc = new Map<string, number>();
    for (const b of books) {
      if (b.meta_title) tc.set(b.meta_title.toLowerCase(), (tc.get(b.meta_title.toLowerCase()) ?? 0) + 1);
      if (b.meta_description) dc.set(b.meta_description.toLowerCase(), (dc.get(b.meta_description.toLowerCase()) ?? 0) + 1);
    }
    return {
      dupTitles: new Set(Array.from(tc.entries()).filter(([, n]) => n > 1).map(([k]) => k)),
      dupDescs: new Set(Array.from(dc.entries()).filter(([, n]) => n > 1).map(([k]) => k)),
    };
  }, [books]);

  const scored = useMemo(() => books.map((b) => ({ b, ...scoreBook(b, dupTitles, dupDescs) })), [books, dupTitles, dupDescs]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scored.filter(({ b, issues }) => {
      if (term && !`${b.title} ${b.author} ${b.slug} ${b.seo_slug ?? ""}`.toLowerCase().includes(term)) return false;
      if (issueFilter !== "all" && !issues.includes(issueFilter)) return false;
      return true;
    });
  }, [scored, q, issueFilter]);

  const stats = useMemo(() => {
    const total = books.length;
    const withSeoSlug = books.filter((b) => !!b.seo_slug).length;
    const brokenSlugs = scored.filter((s) => s.issues.includes("broken_slug")).length;
    const missingMeta = scored.filter((s) => s.issues.includes("no_meta_title") || s.issues.includes("no_meta_desc")).length;
    const avg = total ? Math.round(scored.reduce((a, r) => a + r.score, 0) / total) : 0;
    return { total, withSeoSlug, brokenSlugs, missingMeta, avg };
  }, [books, scored]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Books" value={stats.total} />
        <Stat label="Have keyword URL" value={`${stats.withSeoSlug}/${stats.total}`} />
        <Stat label="Broken slugs" value={stats.brokenSlugs} intent={stats.brokenSlugs > 0 ? "danger" : "ok"} />
        <Stat label="Missing meta" value={stats.missingMeta} intent={stats.missingMeta > 0 ? "warn" : "ok"} />
        <Stat label="Avg SEO score" value={`${stats.avg}%`} />
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Input placeholder="Search title / slug / author" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <select
          value={issueFilter}
          onChange={(e) => setIssueFilter(e.target.value as any)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">All issues</option>
          {(Object.keys(ISSUE_LABEL) as Issue[]).map((k) => (
            <option key={k} value={k}>{ISSUE_LABEL[k]}</option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setBulkOpen(true)} className="gap-1">
            <Wand2 className="h-4 w-4" /> Bulk auto-generate SEO
          </Button>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/40">
            <tr>
              <th className="p-3">Book</th>
              <th className="p-3">Current URL</th>
              <th className="p-3">Proposed keyword URL</th>
              <th className="p-3 text-center">Score</th>
              <th className="p-3">Issues</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No matches.</td></tr>}
            {filtered.map(({ b, issues, score }) => {
              const proposed = b.seo_slug || generateSeoSlug(b);
              return (
                <tr key={b.id} className="border-t hover:bg-muted/30 align-top">
                  <td className="p-3 max-w-[220px]">
                    <div className="font-medium line-clamp-1">{b.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{b.author}</div>
                  </td>
                  <td className="p-3 text-xs font-mono text-muted-foreground max-w-[180px] truncate">/books/{b.slug}</td>
                  <td className="p-3 text-xs font-mono max-w-[220px] truncate">
                    {b.seo_slug
                      ? <span className="text-emerald-600">{proposed}</span>
                      : <span className="text-amber-600">{proposed}</span>}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`font-semibold ${score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-rose-600"}`}>{score}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {issues.slice(0, 3).map((i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{ISSUE_LABEL[i]}</Badge>
                      ))}
                      {issues.length > 3 && <span className="text-[10px] text-muted-foreground">+{issues.length - 3}</span>}
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(b)}>Edit</Button>
                    <a href={`${SITE}/books/${b.seo_slug || b.slug}`} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost" className="h-7"><ExternalLink className="h-3 w-3" /></Button>
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {editing && (
        <EditorDialog book={editing} onClose={() => setEditing(null)} onSaved={load} />
      )}
      {bulkOpen && (
        <BulkDialog books={books} onClose={() => setBulkOpen(false)} onDone={load} />
      )}
    </div>
  );
}

function Stat({ label, value, intent }: { label: string; value: string | number; intent?: "ok" | "warn" | "danger" }) {
  const color = intent === "danger" ? "text-rose-600" : intent === "warn" ? "text-amber-600" : "";
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </Card>
  );
}

function EditorDialog({ book, onClose, onSaved }: { book: BookRow; onClose: () => void; onSaved: () => void }) {
  const [seoSlug, setSeoSlug] = useState(book.seo_slug ?? generateSeoSlug(book));
  const [metaTitle, setMetaTitle] = useState(book.meta_title ?? generateSeoTitle(book));
  const [metaDesc, setMetaDesc] = useState(book.meta_description ?? generateSeoDescription(book));
  const [ogImage, setOgImage] = useState(book.og_image ?? "");
  const [keywords, setKeywords] = useState<string[]>(book.seo_keywords ?? []);
  const [saving, setSaving] = useState(false);
  const [slugTaken, setSlugTaken] = useState(false);

  const suggestions = useMemo(() => suggestLongTailKeywords(book), [book]);
  const audit = useMemo(() => auditSeoSlug(seoSlug, book), [seoSlug, book]);

  useEffect(() => {
    if (!seoSlug || seoSlug === book.seo_slug) { setSlugTaken(false); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("books").select("id").eq("seo_slug", seoSlug).neq("id", book.id).maybeSingle();
      setSlugTaken(!!data);
    }, 350);
    return () => clearTimeout(t);
  }, [seoSlug, book.seo_slug, book.id]);

  const save = async () => {
    if (slugTaken) return toast.error("SEO slug already used by another book");
    setSaving(true);
    const { error } = await supabase.from("books").update({
      seo_slug: seoSlug || null,
      meta_title: metaTitle || null,
      meta_description: metaDesc || null,
      og_image: ogImage || null,
      seo_keywords: keywords,
    }).eq("id", book.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("SEO saved");
    onSaved();
    onClose();
  };

  const canonical = `${SITE}/books/${seoSlug || book.slug}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="line-clamp-1">SEO — {book.title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* SERP Preview */}
            <Card className="p-4">
              <div className="text-xs text-emerald-700 dark:text-emerald-400 truncate">{canonical}</div>
              <div className="text-[#1a0dab] dark:text-[#8ab4f8] text-lg leading-snug truncate mt-0.5">{metaTitle || book.title}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">{metaDesc || "—"}</div>
            </Card>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>SEO slug (long-tail keyword URL)</Label>
                <div className="flex items-center gap-2 text-[10px]">
                  <Badge variant={audit.score >= 80 ? "secondary" : audit.score >= 60 ? "outline" : "destructive"}>
                    Slug score {audit.score}
                  </Badge>
                  {slugTaken && <Badge variant="destructive">Taken</Badge>}
                </div>
              </div>
              <Input value={seoSlug} onChange={(e) => setSeoSlug(e.target.value)} placeholder="atomic-habits-summary-in-hindi" />
              <div className="text-[11px] text-muted-foreground mt-1">Old slug ({book.slug}) will auto-redirect. Length: {seoSlug.length}/70</div>
              {audit.issues.length > 0 && (
                <div className="text-[11px] text-amber-600 mt-1">{audit.issues.join(" · ")}</div>
              )}
              <Button size="sm" variant="ghost" className="h-7 mt-1 text-xs" onClick={() => setSeoSlug(generateSeoSlug(book))}>
                <Sparkles className="h-3 w-3 mr-1" /> Regenerate from template
              </Button>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Meta title</Label>
                <Badge variant={metaTitle.length > 60 ? "destructive" : metaTitle.length < 30 ? "outline" : "secondary"} className="text-[10px]">
                  {metaTitle.length}/60
                </Badge>
              </div>
              <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} maxLength={90} />
              <Button size="sm" variant="ghost" className="h-7 mt-1 text-xs" onClick={() => setMetaTitle(generateSeoTitle(book))}>
                <Sparkles className="h-3 w-3 mr-1" /> Auto-fill
              </Button>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Meta description</Label>
                <Badge variant={metaDesc.length > 160 ? "destructive" : metaDesc.length < 80 ? "outline" : "secondary"} className="text-[10px]">
                  {metaDesc.length}/155
                </Badge>
              </div>
              <Textarea value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} rows={3} maxLength={200} />
              <Button size="sm" variant="ghost" className="h-7 mt-1 text-xs" onClick={() => setMetaDesc(generateSeoDescription(book))}>
                <Sparkles className="h-3 w-3 mr-1" /> Auto-fill
              </Button>
            </div>

            <div>
              <Label>OG image URL (optional)</Label>
              <Input value={ogImage} onChange={(e) => setOgImage(e.target.value)} placeholder="https://…" />
            </div>

            <div>
              <Label>Target keywords ({keywords.length})</Label>
              <div className="flex flex-wrap gap-1 mt-1 mb-2">
                {keywords.map((k) => (
                  <Badge key={k} variant="secondary" className="text-[10px] cursor-pointer" onClick={() => setKeywords(keywords.filter((x) => x !== k))}>
                    {k} ✕
                  </Badge>
                ))}
                {keywords.length === 0 && <span className="text-xs text-muted-foreground">No keywords yet.</span>}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-2 mb-1">Suggestions (click to add)</div>
              <div className="flex flex-wrap gap-1">
                {suggestions.filter((s) => !keywords.includes(s)).map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px] cursor-pointer hover:bg-primary/10" onClick={() => setKeywords([...keywords, s])}>
                    + {s}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || slugTaken} className="gap-1">
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save SEO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkDialog({ books, onClose, onDone }: { books: BookRow[]; onClose: () => void; onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [scope, setScope] = useState<"missing" | "all">("missing");

  const preview = useMemo(() => {
    const rows: Array<{ id: string; title: string; oldSlug: string; newSeoSlug: string; newTitle: string; newDesc: string }> = [];
    for (const b of books) {
      const needsSlug = scope === "all" || !b.seo_slug;
      const needsTitle = scope === "all" || !b.meta_title;
      const needsDesc = scope === "all" || !b.meta_description;
      if (!needsSlug && !needsTitle && !needsDesc) continue;
      const newSlug = generateSeoSlug(b as BookLike);
      const audit = auditSeoSlug(newSlug, b);
      if (!newSlug || audit.score < 40) continue;
      rows.push({
        id: b.id,
        title: b.title,
        oldSlug: b.seo_slug || b.slug,
        newSeoSlug: needsSlug ? newSlug : (b.seo_slug || ""),
        newTitle: needsTitle ? generateSeoTitle(b as BookLike) : (b.meta_title || ""),
        newDesc: needsDesc ? generateSeoDescription(b as BookLike) : (b.meta_description || ""),
      });
    }
    return rows;
  }, [books, scope]);

  const run = async () => {
    setRunning(true);
    let ok = 0, fail = 0;
    // Enforce uniqueness within the batch itself.
    const taken = new Set<string>();
    for (const r of preview) {
      const patch: Record<string, any> = {};
      if (r.newSeoSlug && !taken.has(r.newSeoSlug)) { patch.seo_slug = r.newSeoSlug; taken.add(r.newSeoSlug); }
      if (r.newTitle) patch.meta_title = r.newTitle;
      if (r.newDesc) patch.meta_description = r.newDesc;
      if (Object.keys(patch).length === 0) continue;
      const { error } = await supabase.from("books").update(patch as any).eq("id", r.id);
      if (error) { fail++; console.warn("bulk seo update failed", r.title, error.message); }
      else ok++;
    }
    setRunning(false);
    toast.success(`Bulk SEO: ${ok} updated${fail ? `, ${fail} failed` : ""}`);
    onDone();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk auto-generate SEO ({preview.length} books)</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3 pb-2">
          <Label className="text-xs">Scope</Label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as any)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="missing">Only books missing SEO fields</option>
            <option value="all">All books (overwrite)</option>
          </select>
          <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            Old slugs are auto-preserved for 301 redirects.
          </div>
        </div>
        <ScrollArea className="flex-1 border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-2">Book</th>
                <th className="p-2">From</th>
                <th className="p-2">New keyword URL</th>
                <th className="p-2">New meta title</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-2 max-w-[180px] truncate">{r.title}</td>
                  <td className="p-2 font-mono text-[10px] text-muted-foreground max-w-[140px] truncate">{r.oldSlug}</td>
                  <td className="p-2 font-mono text-[10px] text-emerald-600 max-w-[220px] truncate">{r.newSeoSlug}</td>
                  <td className="p-2 max-w-[280px] truncate">{r.newTitle}</td>
                </tr>
              ))}
              {preview.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nothing to auto-generate <CheckCircle2 className="inline h-3 w-3 text-emerald-500 ml-1" /></td></tr>
              )}
            </tbody>
          </table>
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={run} disabled={running || preview.length === 0} className="gap-1">
            <Wand2 className="h-4 w-4" /> {running ? "Applying…" : `Apply to ${preview.length} books`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
