import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { adminGetBook, adminUpdateBook } from "@/lib/adminApi";
import { changedBookFields, type EditableBook, type EditableBookField } from "@/lib/adminBookEditing";
import { buildReaderMarkdown } from "@/lib/bookReaderContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookAssetsEditor } from "@/components/admin/BookAssetsEditor";
import { ChevronLeft, ChevronRight, FileText, Package, Search, Send, ExternalLink, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

const SeoLab = lazy(() => import("@/components/admin/SeoLab"));
const N8nDispatcher = lazy(() => import("@/components/admin/N8nDispatcher"));
const ReadingView = lazy(() => import("@/components/ReadingView"));

export type EditState = { id: string; title: string };

const STEPS = [
  { id: 1, label: "Content", icon: FileText },
  { id: 2, label: "Assets", icon: Package },
  { id: 3, label: "SEO", icon: Search },
  { id: 4, label: "Launch", icon: Send },
];

type TextField = { key: EditableBookField; label: string; description: string; minHeight?: number };
const CONTENT_GROUPS: { id: string; label: string; fields: TextField[] }[] = [
  { id: "essential", label: "Start & insights", fields: [
    { key: "tagline", label: "Book hook / tagline", description: "Shown beneath the title on the book page." },
    { key: "overview", label: "Start here · Understand it in 2 minutes", description: "The book at a glance; opening section of the live reader.", minHeight: 180 },
    { key: "key_ideas", label: "Worth keeping · Key insights and core ideas", description: "Drives BOTH '5 ideas worth keeping' and 'What really matters' on the live page. Write distinct, book-specific ideas.", minHeight: 260 },
  ] },
  { id: "depth", label: "Deep reading", fields: [
    { key: "deep_summary", label: "See the full picture · The full journey", description: "Full narrative, arguments, scenes and explanation. If empty, the reader derives a short version from Deep analysis.", minHeight: 380 },
    { key: "deep_analysis", label: "One layer deeper · What most readers miss", description: "Critique, tensions, context, limitations and interpretation.", minHeight: 380 },
  ] },
  { id: "practice", label: "Action & mastery", fields: [
    { key: "daily_application", label: "Make it yours · Put it to work today", description: "Final section of the summary reader. If empty, a generic fallback appears.", minHeight: 170 },
    { key: "action_system", label: "Action · Step-by-step plan", description: "Displayed on the signed-in Action tab.", minHeight: 250 },
    { key: "practice_tracker", label: "Tracker · Suggested weekly plan", description: "Displayed with the interactive tracker.", minHeight: 220 },
    { key: "reflection_questions", label: "Reflection questions", description: "Stored premium reflection content.", minHeight: 180 },
    { key: "real_life_example", label: "Real-life example", description: "Stored companion example; distinguish hypothetical examples from verified events.", minHeight: 180 },
  ] },
];

const wordCount = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().split(/\s+/).length : 0;

export function PublishingWizard({
  initial, onSaved, onClose, onDirtyChange,
}: { initial: EditState; onSaved: () => void; onClose: () => void; onDirtyChange?: (dirty: boolean) => void }) {
  const [step, setStep] = useState(1);
  const [edit, setEdit] = useState<EditableBook | null>(null);
  const [original, setOriginal] = useState<EditableBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const { patch, expected } = useMemo(() => original && edit
    ? changedBookFields(original, edit)
    : { patch: {}, expected: {} }, [original, edit]);
  const changedCount = Object.keys(patch).length;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    // Fetch all D1 fields for this book; catalog metadata is not an editing source.
    adminGetBook<EditableBook>(initial.id).then((book) => {
      if (!active) return;
      if (!book) throw new Error("Book not found in Cloudflare D1");
      setEdit(book);
      setOriginal(book);
    }).catch((error) => {
      if (active) setLoadError(error instanceof Error ? error.message : "Could not load book");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initial.id, loadVersion]);

  useEffect(() => { onDirtyChange?.(changedCount > 0); }, [changedCount, onDirtyChange]);

  const changeField = (field: EditableBookField, value: string) => {
    setEdit((current) => current ? { ...current, [field]: value } : null);
  };

  const saveContent = async () => {
    if (!edit || !original || !changedCount || saving) return;
    if (!edit.title?.toString().trim() || !edit.author?.toString().trim() || !edit.category?.toString().trim() || !edit.slug?.toString().trim() || !["en", "hi"].includes(String(edit.language))) {
      toast.error("Title, author, category, slug, and en/hi language are required.");
      return;
    }
    const cleared = Object.keys(patch).filter((key) =>
      patch[key as EditableBookField] === "" && String(original[key as EditableBookField] ?? "").trim());
    if (cleared.length && !window.confirm(`You cleared existing content in: ${cleared.join(", ")}. Save these deletions?`)) return;

    setSaving(true);
    try {
      const updated = await adminUpdateBook<EditableBook>(edit.id, patch, { expected });
      if (!updated || Object.entries(patch).some(([key, value]) => updated[key as EditableBookField] !== value)) {
        throw new Error("Save response did not match edited content; reload and verify before continuing.");
      }
      setEdit(updated);
      setOriginal(updated);
      toast.success(`${changedCount} field${changedCount > 1 ? "s" : ""} saved to Cloudflare D1`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save content");
    } finally {
      setSaving(false);
    }
  };

  const fallback = <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  const siteUrl = edit ? `https://www.booknomics.com/books/${encodeURIComponent(String(edit.seo_slug || edit.slug))}` : "";

  const renderField = ({ key, label, description, minHeight }: TextField) => (
    <div key={key} className="rounded-xl border p-4 bg-background space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor={`book-${key}`} className="font-semibold text-sm">{label}</Label>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">{wordCount(edit?.[key])} words</Badge>
      </div>
      <Textarea id={`book-${key}`} value={String(edit?.[key] ?? "")}
        onChange={(event) => changeField(key, event.target.value)}
        className="font-mono text-sm leading-relaxed resize-y" style={{ minHeight: minHeight ?? 94 }}
        placeholder={`Write ${label.toLowerCase()} in Markdown…`} />
      {Object.prototype.hasOwnProperty.call(patch, key) && <span className="text-xs text-amber-700">Unsaved edit</span>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 overflow-x-auto">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return <div key={s.id} className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setStep(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${step === s.id ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
              <Icon className="w-3 h-3" /> {s.id}. {s.label}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          </div>;
        })}
      </div>

      {step === 1 && (loading ? fallback : loadError ? (
        <Card className="p-5 space-y-3">
          <p className="text-destructive">Unable to load actual book content: {loadError}</p>
          <Button variant="outline" onClick={() => setLoadVersion((n) => n + 1)}><RefreshCcw className="w-4 h-4 mr-2" />Retry</Button>
        </Card>
      ) : edit ? (
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/40 p-3 flex justify-between gap-3 flex-wrap items-center">
            <div>
              <div className="flex gap-2 flex-wrap items-center"><Badge>Cloudflare D1 · actual book</Badge><Badge variant="outline">{edit.language === "hi" ? "Hindi" : "English"}</Badge></div>
              <p className="text-sm text-muted-foreground mt-2">All fields load from the same book row as the website. The preview uses the website's reader sections.</p>
            </div>
            <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary inline-flex items-center gap-1 underline">Open live book <ExternalLink className="h-3 w-3" /></a>
          </div>
          <Tabs defaultValue="essential" className="space-y-3">
            <TabsList className="flex h-auto flex-wrap justify-start gap-1">
              {CONTENT_GROUPS.map((g) => <TabsTrigger key={g.id} value={g.id}>{g.label}</TabsTrigger>)}
              <TabsTrigger value="details">Book details</TabsTrigger>
              <TabsTrigger value="preview">Reader preview</TabsTrigger>
            </TabsList>
            {CONTENT_GROUPS.map((group) => <TabsContent key={group.id} value={group.id} className="space-y-3">
              {group.fields.map(renderField)}
            </TabsContent>)}
            <TabsContent value="details" className="space-y-3">
              {(["title", "author", "category", "language", "slug", "affiliate_link", "cover_url"] as EditableBookField[]).map((key) => (
                <div key={key}><Label htmlFor={`book-${key}`} className="capitalize">{key.replace(/_/g, " ")}</Label>
                  <Input id={`book-${key}`} value={String(edit[key] ?? "")} onChange={(event) => changeField(key, event.target.value)} />
                </div>
              ))}
              <div className="grid sm:grid-cols-3 gap-3">
                {(["reading_time", "rating", "year"] as EditableBookField[]).map((key) => <div key={key}>
                  <Label htmlFor={`book-${key}`} className="capitalize">{key.replace(/_/g, " ")}</Label>
                  <Input id={`book-${key}`} inputMode="decimal" type="number" value={edit[key] ?? ""}
                    onChange={(event) => setEdit((current) => current ? { ...current, [key]: event.target.value === "" ? null : Number(event.target.value) } : null)} />
                </div>)}
              </div>
              <p className="text-xs text-muted-foreground">SEO fields and media uploads are available in steps 2 and 3.</p>
            </TabsContent>
            <TabsContent value="preview" className="space-y-3">
              <p className="text-xs text-muted-foreground">Local preview includes unsaved edits. The live page changes only after Save. Reader headings, takeaways, and fallbacks use the same code as the public page.</p>
              <div className="border rounded-xl overflow-hidden">
                <Suspense fallback={fallback}>
                  <ReadingView title={String(edit.title)} author={String(edit.author)} category={String(edit.category)}
                    language={edit.language === "hi" ? "hi" : "en"} content={buildReaderMarkdown(edit, edit.language === "hi" ? "hi" : "en")} />
                </Suspense>
              </div>
            </TabsContent>
          </Tabs>
          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-lg bg-background border shadow-sm p-3">
            <span className="text-xs text-muted-foreground">{changedCount ? `${changedCount} unsaved field${changedCount === 1 ? "" : "s"}` : "No unsaved changes"}</span>
            <Button disabled={saving || !changedCount} onClick={saveContent}>{saving ? "Saving…" : "Save to live book"}</Button>
          </div>
        </div>
      ) : null)}

      {step === 2 && <BookAssetsEditor bookId={initial.id} bookTitle={edit?.title?.toString() || initial.title} />}
      {step === 3 && <Suspense fallback={fallback}><SeoLab bookId={initial.id} /></Suspense>}
      {step === 4 && <Suspense fallback={fallback}><N8nDispatcher bookId={initial.id} /></Suspense>}

      <Card className="p-3 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
          <ChevronLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <Badge variant="outline" className="text-[10px]">Step {step} of {STEPS.length}</Badge>
        {step < STEPS.length ? <Button size="sm" onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}>
          Next<ChevronRight className="w-4 h-4 ml-1" />
        </Button> : <Button size="sm" variant="outline" onClick={onClose}>Done</Button>}
      </Card>
    </div>
  );
}

export default PublishingWizard;
