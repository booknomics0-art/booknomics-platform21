import { lazy, Suspense, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookAssetsEditor } from "@/components/admin/BookAssetsEditor";
import { ChevronLeft, ChevronRight, FileText, Package, Search, Send } from "lucide-react";
import { toast } from "sonner";

const SeoLab = lazy(() => import("@/components/admin/SeoLab"));
const N8nDispatcher = lazy(() => import("@/components/admin/N8nDispatcher"));

export type EditState = {
  id: string; title: string; author: string; category: string; language: string;
  slug: string; affiliate_link: string | null;
  overview?: string | null;
};

const STEPS = [
  { id: 1, label: "Content", icon: FileText },
  { id: 2, label: "Assets",  icon: Package },
  { id: 3, label: "SEO",     icon: Search },
  { id: 4, label: "Launch",  icon: Send },
];

export function PublishingWizard({
  initial, onSaved, onClose,
}: { initial: EditState; onSaved: () => void; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [edit, setEdit] = useState<EditState>(initial);
  const [saving, setSaving] = useState(false);

  const saveContent = async () => {
    setSaving(true);
    const { id, ...patch } = edit;
    const { error } = await supabase.from("books").update(patch).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Content saved");
    onSaved();
  };

  const fallback = <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div>
      {/* Stepper */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = step === s.id;
          const done = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  active ? "bg-primary text-primary-foreground border-primary"
                  : done ? "bg-secondary text-secondary-foreground border-secondary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{s.id}. {s.label}</span>
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      {/* Steps */}
      {step === 1 && (
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          </div>
          <div>
            <Label>Author</Label>
            <Input value={edit.author} onChange={(e) => setEdit({ ...edit, author: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Category</Label>
              <Input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
            </div>
            <div>
              <Label>Language</Label>
              <Input value={edit.language} onChange={(e) => setEdit({ ...edit, language: e.target.value })} placeholder="en | hi" />
            </div>
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
          </div>
          <div>
            <Label>Affiliate Link</Label>
            <Input value={edit.affiliate_link ?? ""}
              onChange={(e) => setEdit({ ...edit, affiliate_link: e.target.value || null })}
              placeholder="https://amzn.to/…" />
          </div>
          <div>
            <Label>Premium Summary (A+)</Label>
            <Textarea value={edit.overview ?? ""}
              onChange={(e) => setEdit({ ...edit, overview: e.target.value })}
              className="min-h-[180px] font-mono text-xs" />
          </div>
          <Button onClick={saveContent} disabled={saving}>{saving ? "Saving…" : "Save Content"}</Button>
        </div>
      )}

      {step === 2 && <BookAssetsEditor bookId={edit.id} bookTitle={edit.title} />}

      {step === 3 && (
        <Suspense fallback={fallback}><SeoLab bookId={edit.id} /></Suspense>
      )}

      {step === 4 && (
        <Suspense fallback={fallback}><N8nDispatcher bookId={edit.id} /></Suspense>
      )}

      {/* Footer nav */}
      <Card className="p-3 mt-4 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
          <ChevronLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <Badge variant="outline" className="text-[10px]">Step {step} of {STEPS.length}</Badge>
        {step < STEPS.length ? (
          <Button size="sm" onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}>
            Next<ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onClose}>Done</Button>
        )}
      </Card>
    </div>
  );
}

export default PublishingWizard;
