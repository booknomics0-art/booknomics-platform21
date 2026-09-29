import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const SITE = "https://booknomics.com";
const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "twitter", label: "Twitter / X" },
  { id: "youtube", label: "YouTube" },
];

type Captions = { linkedin: string; instagram: string; twitter: string };

export function N8nDispatcher({ bookId }: { bookId: string }) {
  const [book, setBook] = useState<any>(null);
  const [assets, setAssets] = useState<any>(null);
  const [captions, setCaptions] = useState<Captions>({ linkedin: "", instagram: "", twitter: "" });
  const [selected, setSelected] = useState<string[]>(["linkedin", "instagram", "twitter"]);
  const [aiBusy, setAiBusy] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: a }] = await Promise.all([
        supabase.from("books").select("id,title,author,slug,tagline,overview,meta_title,meta_description").eq("id", bookId).maybeSingle(),
        supabase.from("book_assets").select("audio_url,mindmap_url").eq("book_id", bookId).maybeSingle(),
      ]);
      setBook(b);
      setAssets(a);
    })();
  }, [bookId]);

  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const generateCaptions = async () => {
    setAiBusy(true);
    const { data, error } = await supabase.functions.invoke("seo-marketing", {
      body: { book_id: bookId, mode: "captions" },
    });
    setAiBusy(false);
    if (error || data?.error) return toast.error(error?.message || data?.error);
    setCaptions({
      linkedin: data?.linkedin ?? "",
      instagram: data?.instagram ?? "",
      twitter: data?.twitter ?? "",
    });
    toast.success("Captions generated");
  };

  const publish = async () => {
    if (!book) return;
    if (selected.length === 0) return toast.error("Select at least one platform");
    setSending(true);
    const canonical = `${SITE}/books/${book.slug}`;
    const payload = {
      book_id: book.id,
      title: book.title,
      author: book.author,
      short_summary: (book.overview ?? book.tagline ?? "").slice(0, 500),
      canonical_url: canonical,
      meta: { title: book.meta_title, description: book.meta_description },
      assets: { audio: assets?.audio_url ?? null, mindmap: assets?.mindmap_url ?? null },
      social_captions: captions,
      platforms: selected,
      triggered_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase.functions.invoke("dispatch-n8n", {
        body: { book_id: book.id, book_title: book.title, platforms: selected, payload },
      });
      if (error) {
        toast.error(error.message || "Dispatch failed");
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success("Dispatched to n8n");
    } catch (e) {
      toast.error("Webhook failed: " + (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (!book) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <Card className="p-3 border-amber-500/50 bg-amber-500/10 flex items-start gap-2 text-xs">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          Distribution posts to the n8n webhook configured in the <strong>Settings</strong> tab.
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3">Distribution Checklist</h3>
        <div className="grid grid-cols-2 gap-3">
          {PLATFORMS.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
              {p.label}
            </label>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Marketing Copy</h3>
          <Button size="sm" variant="secondary" onClick={generateCaptions} disabled={aiBusy}>
            <Sparkles className="w-4 h-4 mr-1" />{aiBusy ? "Writing…" : "AI Generate"}
          </Button>
        </div>
        {(["linkedin", "instagram", "twitter"] as const).map((k) => (
          <div key={k}>
            <Label className="capitalize text-xs">{k}</Label>
            <Textarea
              value={captions[k]}
              onChange={(e) => setCaptions({ ...captions, [k]: e.target.value })}
              rows={k === "twitter" ? 6 : 4}
              className="text-xs"
            />
          </div>
        ))}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px]">Audio: {assets?.audio_url ? "✓" : "—"}</Badge>
        <Badge variant="outline" className="text-[10px]">Mindmap: {assets?.mindmap_url ? "✓" : "—"}</Badge>
        <div className="flex-1" />
        <Button onClick={publish} disabled={sending} size="lg" className="gap-2">
          <Send className="w-4 h-4" />{sending ? "Dispatching…" : "Publish & Promote"}
        </Button>
      </div>
    </div>
  );
}

export default N8nDispatcher;
