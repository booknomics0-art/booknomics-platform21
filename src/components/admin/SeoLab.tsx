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

const SITE = "https://booknomics.com";

type Props = { bookId: string };
type Suggestion = { title: string; description: string; rationale?: string };

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

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("books_admin")
        .select("title, meta_title, meta_description, slug, overview, key_ideas, category")
        .eq("id", bookId).maybeSingle();
      if (data) {
        setTitle(data.meta_title ?? data.title ?? "");
        setDesc(data.meta_description ?? "");
        setSlug(data.slug ?? "");
        setKeyword(data.title ?? "");
        setBody(`${data.overview ?? ""}\n${data.key_ideas ?? ""}`);
      }
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
