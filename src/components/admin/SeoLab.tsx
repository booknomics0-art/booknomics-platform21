import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CheckCircle2, AlertCircle, Globe } from "lucide-react";
import { toast } from "sonner";

const SITE = "https://www.booknomics.com";

type Props = { bookId: string };
type Suggestion = { title: string; description: string; rationale?: string };
type AuditDetails = Record<string, boolean | number | string | null>;
type AiAudit = {
  aeo_score: number | null;
  geo_score: number | null;
  ai_visibility_score: number | null;
  scoring_version: string | null;
  aeo_details: AuditDetails | null;
  geo_details: AuditDetails | null;
  updated_at: string | null;
};

const GAP_LABELS: Record<string, string> = {
  overview_ok: "Book-specific overview",
  key_ideas_ok: "Book-specific key ideas",
  analysis_ok: "Substantive analysis",
  application_ok: "Practical application",
  meta_title_ok: "Meta title",
  meta_description_ok: "Meta description",
  title_description_ok: "Title + description pair",
  identity_ok: "Author/category identity",
  year_present: "Publication year",
  intent_terms_ok: "Intent/query terms",
  cover_ok: "Useful book cover",
  boilerplate_clear: "Remove repeated boilerplate",
  direct_answer_ok: "Direct concise answer",
};

const scoreClass = (score: number | null) => {
  if (score == null) return "border-border bg-muted/30";
  if (score >= 98) return "border-emerald-500/40 bg-emerald-500/10";
  if (score >= 95) return "border-primary/40 bg-primary/10";
  if (score >= 90) return "border-amber-500/40 bg-amber-500/10";
  return "border-destructive/40 bg-destructive/10";
};

export function SeoLab({ bookId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [slug, setSlug] = useState("");
  const [keyword, setKeyword] = useState("");
  const [body, setBody] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [audit, setAudit] = useState<AiAudit | null>(null);

  useEffect(() => {
    (async () => {
      const [bookResult, auditResult] = await Promise.all([
        supabase
          .from("books_admin")
          .select("title, meta_title, meta_description, slug, overview, key_ideas, category")
          .eq("id", bookId)
          .maybeSingle(),
        supabase
          .from("seo_audits")
          .select("aeo_score, geo_score, ai_visibility_score, scoring_version, aeo_details, geo_details, updated_at")
          .eq("book_id", bookId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const data = bookResult.data;
      if (data) {
        setTitle(data.meta_title ?? data.title ?? "");
        setDesc(data.meta_description ?? "");
        setSlug(data.slug ?? "");
        setKeyword(data.title ?? "");
        setBody(`${data.overview ?? ""}\n${data.key_ideas ?? ""}`);
      }
      if (auditResult.data) setAudit(auditResult.data as unknown as AiAudit);
      setLoading(false);
    })();
  }, [bookId]);

  const titleLen = title.length;
  const descLen = desc.length;
  const canonical = `${SITE}/books/${slug}`;

  const density = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return { first100: false, count: 0, total: 0, pct: 0 };
    const text = body.toLowerCase();
    const words = text.split(/\s+/).filter(Boolean);
    const first100 = words.slice(0, 100).join(" ").includes(kw);
    const count = (text.match(new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")) || []).length;
    const pct = words.length ? +(count / words.length * 100).toFixed(2) : 0;
    return { first100, count, total: words.length, pct };
  }, [keyword, body]);

  const readinessGaps = useMemo(() => {
    if (!audit) return [] as string[];
    const keys = new Set<string>();
    [audit.aeo_details, audit.geo_details].forEach((details) => {
      Object.entries(details ?? {}).forEach(([key, value]) => {
        if (value === false && GAP_LABELS[key]) keys.add(key);
      });
    });
    return Array.from(keys).map((key) => GAP_LABELS[key]);
  }, [audit]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("books").update({
      meta_title: title || null,
      meta_description: desc || null,
      slug: slug || undefined,
    }).eq("id", bookId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("SEO saved");
  };

  const runAi = async () => {
    setAiBusy(true);
    const { data, error } = await supabase.functions.invoke("seo-marketing", {
      body: { book_id: bookId, mode: "seo" },
    });
    setAiBusy(false);
    if (error || data?.error) return toast.error(error?.message || data?.error);
    setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* SERP Preview */}
      <Card className="p-4 bg-background border-l-4 border-l-primary">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Live Google SERP Preview</h3>
        </div>
        <div className="rounded border p-4 bg-white dark:bg-slate-900">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 truncate">{canonical}</div>
          <div className="text-[#1a0dab] dark:text-[#8ab4f8] text-lg leading-snug truncate mt-0.5">
            {title || "Untitled — add a meta title"}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">
            {desc || "No meta description yet."}
          </div>
        </div>
      </Card>

      {/* AEO / GEO readiness */}
      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-sm">SEO + AEO/GEO Readiness</h3>
            <p className="text-xs text-muted-foreground mt-1">Internal readiness score — not a ranking or AI-citation guarantee.</p>
          </div>
          {audit?.scoring_version && <Badge variant="outline" className="text-[10px]">{audit.scoring_version}</Badge>}
        </div>

        {audit ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={`rounded-xl border p-4 ${scoreClass(audit.aeo_score)}`}>
                <div className="text-xs text-muted-foreground">AEO</div>
                <div className="text-3xl font-bold mt-1">{audit.aeo_score ?? "—"}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
                <div className="text-[11px] text-muted-foreground mt-1">Answer-engine extractability</div>
              </div>
              <div className={`rounded-xl border p-4 ${scoreClass(audit.geo_score)}`}>
                <div className="text-xs text-muted-foreground">GEO</div>
                <div className="text-3xl font-bold mt-1">{audit.geo_score ?? "—"}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
                <div className="text-[11px] text-muted-foreground mt-1">Generative citation readiness</div>
              </div>
              <div className={`rounded-xl border p-4 ${scoreClass(audit.ai_visibility_score)}`}>
                <div className="text-xs text-muted-foreground">AI Visibility</div>
                <div className="text-3xl font-bold mt-1">{audit.ai_visibility_score ?? "—"}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
                <div className="text-[11px] text-muted-foreground mt-1">Combined internal readiness</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium mb-2">Highest-impact gaps</div>
              {readinessGaps.length ? (
                <div className="flex flex-wrap gap-2">
                  {readinessGaps.map((gap) => <Badge key={gap} variant="outline" className="text-[10px]">{gap}</Badge>)}
                </div>
              ) : (
                <div className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> No failed signals in the latest rubric.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">No AEO/GEO audit has been stored for this page yet.</div>
        )}
      </Card>

      {/* Editors */}
      <Card className="p-4 space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <Label>Meta Title</Label>
            <Badge variant={titleLen > 60 ? "destructive" : titleLen < 30 ? "outline" : "secondary"} className="text-[10px]">
              {titleLen}/60
            </Badge>
          </div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label>Meta Description</Label>
            <Badge variant={descLen > 160 ? "destructive" : descLen < 80 ? "outline" : "secondary"} className="text-[10px]">
              {descLen}/160
            </Badge>
          </div>
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={200} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Canonical / Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
            <p className="text-[10px] text-muted-foreground mt-1">{canonical}</p>
          </div>
          <div>
            <Label>Primary Keyword</Label>
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. atomic habits" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save SEO"}</Button>
          <Button size="sm" variant="secondary" onClick={runAi} disabled={aiBusy}>
            <Sparkles className="w-4 h-4 mr-1" />{aiBusy ? "Thinking…" : "AI CTR Optimizer"}
          </Button>
        </div>
      </Card>

      {/* Keyword density */}
      <Card className="p-4">
        <h4 className="font-semibold text-sm mb-2">Keyword Density Map</h4>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={density.first100 ? "secondary" : "destructive"} className="gap-1">
            {density.first100 ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            In first 100 words
          </Badge>
          <Badge variant="outline">Occurrences: {density.count}</Badge>
          <Badge variant="outline">Total words: {density.total}</Badge>
          <Badge variant={density.pct > 3 ? "destructive" : density.pct >= 0.5 ? "secondary" : "outline"}>
            Density: {density.pct}%
          </Badge>
        </div>
      </Card>

      {/* AI suggestions */}
      {suggestions.length > 0 && (
        <Card className="p-4 space-y-3">
          <h4 className="font-semibold text-sm">AI Suggestions</h4>
          {suggestions.map((s, i) => (
            <div key={i} className="border rounded p-3 space-y-2">
              <div className="text-sm font-medium">{s.title}</div>
              <div className="text-xs text-muted-foreground">{s.description}</div>
              {s.rationale && <div className="text-[10px] italic text-muted-foreground/80">{s.rationale}</div>}
              <Button size="sm" variant="outline" onClick={() => { setTitle(s.title); setDesc(s.description); toast.success("Applied"); }}>
                Apply
              </Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

export default SeoLab;
