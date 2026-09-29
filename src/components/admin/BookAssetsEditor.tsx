import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  UploadCloud, Plus, Trash2, GripVertical, Check, Loader2, Save, Image as ImageIcon,
  Headphones, Sparkles, Network, FileText, Wand2,
} from "lucide-react";

type QuizQuestion = { id: string; question: string; options: string[]; correct_option: number; explanation?: string };
type Flashcard = { id: string; front: string; back: string };
type ChapterMarker = { time: number; title: string };

const uid = () => Math.random().toString(36).slice(2, 9);
const PRIVATE_BUCKET_MARKER = "/book-assets/";
const MINDMAP_MAX_SIZE = 5 * 1024 * 1024;
const MINDMAP_ACCEPT = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/svg+xml": [".svg"],
};

function parseTime(s: string): number | null {
  const m = s.trim().match(/^(?:(\d+):)?(\d+):(\d{1,2})$/) || s.trim().match(/^(\d+):(\d{1,2})$/);
  if (!m) return null;
  const parts = s.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function signAssetPath(path: string) {
  const { data, error } = await supabase.storage.from("book-assets").createSignedUrl(path, 60 * 60 * 6);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function signAssetUrl(url: string | null) {
  if (!url) return null;
  const i = url.indexOf(PRIVATE_BUCKET_MARKER);
  if (i === -1) return url;
  const path = url.slice(i + PRIVATE_BUCKET_MARKER.length).split("?")[0];
  return (await signAssetPath(path)) ?? url;
}

async function uploadToBucket(bookId: string, file: File, kind: "audio" | "mindmap") {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${bookId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("book-assets").upload(path, file, {
    cacheControl: "31536000",
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("book-assets").getPublicUrl(path);
  return { publicUrl: data.publicUrl, signedUrl: await signAssetPath(path) };
}

export function BookAssetsEditor({ bookId, bookTitle }: { bookId: string; bookTitle: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mindmapUrl, setMindmapUrl] = useState("");
  const [mindmapPreviewUrl, setMindmapPreviewUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [chapters, setChapters] = useState<ChapterMarker[]>([]);
  const [uploadingMm, setUploadingMm] = useState(false);
  const [uploadingAu, setUploadingAu] = useState(false);
  const [aiBusy, setAiBusy] = useState<"quiz" | "flashcards" | "mindmap" | null>(null);
  const [quizCount, setQuizCount] = useState(10);
  const [cardCount, setCardCount] = useState(12);
  const [diff, setDiff] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [sourceText, setSourceText] = useState("");
  const auInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.from("book_assets").select("*").eq("book_id", bookId).maybeSingle().then(async ({ data }) => {
      if (!active) return;
      if (data) {
        setMindmapUrl(data.mindmap_url ?? "");
        setAudioUrl(data.audio_url ?? "");
        setStatus((data.status as any) ?? "draft");
        setUpdatedAt(data.updated_at);
        setQuiz(Array.isArray(data.quiz_data) ? (data.quiz_data as any) : []);
        setCards(Array.isArray(data.flashcard_data) ? (data.flashcard_data as any) : []);
        setChapters(Array.isArray((data as any).chapter_markers) ? ((data as any).chapter_markers as any) : []);
        const signedMap = await signAssetUrl(data.mindmap_url ?? null);
        if (active) setMindmapPreviewUrl(signedMap ?? "");
      }
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [bookId]);

  const validate = (): string | null => {
    for (const q of quiz) {
      if (!q.question.trim()) return "Every quiz question needs text";
      if (q.options.length < 2) return "Each question needs ≥2 options";
      if (q.options.some((o) => !o.trim())) return "Options can't be empty";
      if (q.correct_option < 0 || q.correct_option >= q.options.length) return "Pick a correct answer for every question";
    }
    for (const c of cards) if (!c.front.trim() || !c.back.trim()) return "Flashcards need both front and back";
    for (const c of chapters) if (!c.title.trim() || !isFinite(c.time) || c.time < 0) return "Each chapter marker needs a valid time + title";
    return null;
  };

  const persistAssets = async (overrides: Record<string, unknown> = {}, successMessage = "Assets saved") => {
    const err = validate();
    if (err) { toast.error(err); return false; }
    setSaving(true);
    const payload: any = {
      book_id: bookId,
      mindmap_url: mindmapUrl || null,
      audio_url: audioUrl || null,
      quiz_data: quiz,
      flashcard_data: cards,
      chapter_markers: chapters,
      status,
      ...overrides,
    };
    const { error, data } = await supabase.from("book_assets").upsert(payload, { onConflict: "book_id" }).select().maybeSingle();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (data) {
      setStatus((data.status as any) ?? "draft");
      setUpdatedAt(data.updated_at);
    }
    toast.success(successMessage);
    return true;
  };

  const save = async (nextStatus?: "draft" | "published") => {
    await persistAssets({ status: nextStatus ?? status });
  };

  const handleAudioUpload = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Max 100MB");
      return;
    }
    try {
      setUploadingAu(true);
      const { publicUrl } = await uploadToBucket(bookId, file, "audio");
      setAudioUrl(publicUrl);
      const a = document.createElement("audio");
      a.src = publicUrl;
      a.addEventListener("loadedmetadata", () => toast.success(`Uploaded · duration ${fmtTime(a.duration)}`), { once: true });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingAu(false);
    }
  };

  const handleMindmapUpload = useCallback(async (file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      toast.error("Use PNG, JPG, JPEG, or SVG only");
      return;
    }
    if (file.size > MINDMAP_MAX_SIZE) {
      toast.error(`Mindmap must be under ${formatBytes(MINDMAP_MAX_SIZE)}`);
      return;
    }
    try {
      setUploadingMm(true);
      const { publicUrl, signedUrl } = await uploadToBucket(bookId, file, "mindmap");
      setMindmapUrl(publicUrl);
      setMindmapPreviewUrl(signedUrl ?? publicUrl);
      toast.success("Mindmap uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingMm(false);
    }
  }, [bookId]);

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    const first = rejections[0]?.errors?.[0];
    if (!first) return toast.error("Upload failed");
    if (first.code === "file-too-large") return toast.error(`Mindmap must be under ${formatBytes(MINDMAP_MAX_SIZE)}`);
    if (first.code === "file-invalid-type") return toast.error("Use PNG, JPG, JPEG, or SVG only");
    toast.error(first.message);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: MINDMAP_ACCEPT,
    maxSize: MINDMAP_MAX_SIZE,
    multiple: false,
    noClick: true,
    onDropAccepted: (files) => { if (files[0]) void handleMindmapUpload(files[0]); },
    onDropRejected,
  });

  const handleMindmapUrlBlur = async () => {
    if (!mindmapUrl) {
      setMindmapPreviewUrl("");
      return;
    }
    const signed = await signAssetUrl(mindmapUrl);
    setMindmapPreviewUrl(signed ?? mindmapUrl);
  };

  const removeMindmap = async () => {
    if (!mindmapUrl) return;
    const ok = window.confirm(`Remove the mindmap for ${bookTitle}?`);
    if (!ok) return;
    setMindmapUrl("");
    setMindmapPreviewUrl("");
    await persistAssets({ mindmap_url: null }, "Mindmap removed");
  };

  const aiGenerate = async (action: "quiz" | "flashcards" | "mindmap") => {
    setAiBusy(action);
    try {
      const body: any = { book_id: bookId, action };
      if (action === "quiz") { body.count = quizCount; body.difficulty = diff; }
      if (action === "flashcards") { body.count = cardCount; if (sourceText.trim()) body.source_text = sourceText; }
      const { data, error } = await supabase.functions.invoke("generate-mastery-assets", { body });
      if (error || data?.error) throw new Error(error?.message || data?.error || "Generation failed");
      if (action === "quiz" && data.quiz?.length) {
        setQuiz(data.quiz);
        toast.success(`Generated ${data.quiz.length} questions`);
      }
      if (action === "flashcards" && data.flashcards?.length) {
        setCards(data.flashcards);
        toast.success(`Generated ${data.flashcards.length} flashcards`);
      }
      if (action === "mindmap" && data.mindmap_url) {
        setMindmapUrl(data.mindmap_url);
        setMindmapPreviewUrl(data.mindmap_url);
        toast.success("Mind map generated");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAiBusy(null);
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading assets…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          <Badge variant={status === "published" ? "default" : "outline"}>{status}</Badge>
          {updatedAt && <span className="ml-2 text-xs">Updated {new Date(updatedAt).toLocaleString()}</span>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => save("draft")} disabled={saving}><Save className="h-3 w-3 mr-1" />Save draft</Button>
          <Button size="sm" onClick={() => save("published")} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />} Publish
          </Button>
        </div>
      </div>

      <Tabs defaultValue="quiz">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="quiz">Quiz ({quiz.length})</TabsTrigger>
          <TabsTrigger value="cards">Flashcards ({cards.length})</TabsTrigger>
          <TabsTrigger value="audio"><Headphones className="h-3 w-3 mr-1" />Audio</TabsTrigger>
          <TabsTrigger value="mindmap"><Network className="h-3 w-3 mr-1" />Mind Map</TabsTrigger>
        </TabsList>

        <TabsContent value="quiz" className="space-y-3 pt-3">
          <Card className="p-3 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <Label className="text-xs">Questions</Label>
                <Input type="number" min={3} max={20} value={quizCount} onChange={(e) => setQuizCount(Number(e.target.value))} className="w-20 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Difficulty</Label>
                <select value={diff} onChange={(e) => setDiff(e.target.value as any)} className="block h-8 text-sm rounded-md border border-input bg-background px-2">
                  <option>Easy</option><option>Medium</option><option>Hard</option>
                </select>
              </div>
              <Button size="sm" onClick={() => aiGenerate("quiz")} disabled={!!aiBusy} className="gap-1">
                {aiBusy === "quiz" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                AI Generate from summary
              </Button>
              <span className="text-[10px] text-muted-foreground">Replaces current questions</span>
            </div>
          </Card>

          {quiz.map((q, qi) => (
            <Card key={q.id} className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Q{qi + 1}</span>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" disabled={qi === 0} onClick={() => { const n = [...quiz]; [n[qi - 1], n[qi]] = [n[qi], n[qi - 1]]; setQuiz(n); }}>↑</Button>
                  <Button size="sm" variant="ghost" disabled={qi === quiz.length - 1} onClick={() => { const n = [...quiz]; [n[qi + 1], n[qi]] = [n[qi], n[qi + 1]]; setQuiz(n); }}>↓</Button>
                  <Button size="sm" variant="ghost" onClick={() => setQuiz(quiz.filter((_, i) => i !== qi))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </div>
              <Textarea value={q.question} onChange={(e) => { const n = [...quiz]; n[qi] = { ...q, question: e.target.value }; setQuiz(n); }} placeholder="Question text" className="text-sm min-h-[60px]" />
              <div className="space-y-1">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input type="radio" name={`correct-${q.id}`} checked={q.correct_option === oi} onChange={() => { const n = [...quiz]; n[qi] = { ...q, correct_option: oi }; setQuiz(n); }} className="accent-primary" />
                    <Input value={opt} onChange={(e) => { const n = [...quiz]; const opts = [...q.options]; opts[oi] = e.target.value; n[qi] = { ...q, options: opts }; setQuiz(n); }} placeholder={`Option ${String.fromCharCode(65 + oi)}`} className="text-xs" />
                    <Button size="sm" variant="ghost" disabled={q.options.length <= 2} onClick={() => { const n = [...quiz]; const opts = q.options.filter((_, i) => i !== oi); n[qi] = { ...q, options: opts, correct_option: Math.min(q.correct_option, opts.length - 1) }; setQuiz(n); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => { const n = [...quiz]; n[qi] = { ...q, options: [...q.options, ""] }; setQuiz(n); }}><Plus className="h-3 w-3 mr-1" />Add option</Button>
              </div>
              <Textarea value={q.explanation ?? ""} onChange={(e) => { const n = [...quiz]; n[qi] = { ...q, explanation: e.target.value }; setQuiz(n); }} placeholder="Explanation (shown after submit)" className="text-xs min-h-[50px]" />
            </Card>
          ))}
          <Button variant="outline" onClick={() => setQuiz([...quiz, { id: uid(), question: "", options: ["", "", "", ""], correct_option: 0, explanation: "" }])}>
            <Plus className="h-3 w-3 mr-1" />Add question manually
          </Button>
        </TabsContent>

        <TabsContent value="cards" className="space-y-3 pt-3">
          <Card className="p-3 bg-gradient-to-br from-primary/5 to-transparent border-primary/20 space-y-2">
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <Label className="text-xs">Cards</Label>
                <Input type="number" min={4} max={30} value={cardCount} onChange={(e) => setCardCount(Number(e.target.value))} className="w-20 h-8 text-sm" />
              </div>
              <Button size="sm" onClick={() => aiGenerate("flashcards")} disabled={!!aiBusy} className="gap-1">
                {aiBusy === "flashcards" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                AI Generate
              </Button>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> Optional: paste PDF/source text for richer cards</summary>
              <Textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)} placeholder="Paste extracted PDF text or book chapter…" className="text-xs min-h-[80px] mt-2" />
              <p className="text-[10px] text-muted-foreground mt-1">If empty, AI uses the book&apos;s own summary fields.</p>
            </details>
          </Card>

          <div className="grid sm:grid-cols-2 gap-3">
            {cards.map((c, ci) => (
              <Card key={c.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Card {ci + 1}</span>
                  <Button size="sm" variant="ghost" onClick={() => setCards(cards.filter((_, i) => i !== ci))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
                <Textarea value={c.front} onChange={(e) => { const n = [...cards]; n[ci] = { ...c, front: e.target.value }; setCards(n); }} placeholder="Front (concept/question)" className="text-xs min-h-[60px]" />
                <Textarea value={c.back} onChange={(e) => { const n = [...cards]; n[ci] = { ...c, back: e.target.value }; setCards(n); }} placeholder="Back (insight/answer)" className="text-xs min-h-[60px]" />
              </Card>
            ))}
          </div>
          <Button variant="outline" onClick={() => setCards([...cards, { id: uid(), front: "", back: "" }])}>
            <Plus className="h-3 w-3 mr-1" />Add flashcard
          </Button>
        </TabsContent>

        <TabsContent value="audio" className="space-y-3 pt-3">
          <Card className="p-4 space-y-2">
            <Label className="flex items-center gap-1"><Headphones className="h-3 w-3" /> Audio Podcast (MP3, max 100MB)</Label>
            <input ref={auInput} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleAudioUpload(f); e.target.value = ""; }} />
            <div className="flex gap-2 items-center flex-wrap">
              <Button size="sm" variant="outline" onClick={() => auInput.current?.click()} disabled={uploadingAu}>
                {uploadingAu ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UploadCloud className="h-3 w-3 mr-1" />} Upload MP3
              </Button>
              <Input value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="…or paste URL" className="flex-1 min-w-[200px] text-xs" />
            </div>
            {audioUrl && <audio src={audioUrl} controls className="w-full mt-2 h-10" preload="none" />}
          </Card>

          <Card className="p-4 space-y-2">
            <Label className="text-xs">Chapter Markers ({chapters.length})</Label>
            <p className="text-[10px] text-muted-foreground">Format: mm:ss or hh:mm:ss. Users can tap to jump.</p>
            {chapters.map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  defaultValue={fmtTime(c.time)}
                  onBlur={(e) => { const t = parseTime(e.target.value); if (t == null) { toast.error("Invalid time"); return; } const n = [...chapters]; n[i] = { ...c, time: t }; setChapters(n); }}
                  placeholder="00:00"
                  className="w-24 text-xs tabular-nums"
                />
                <Input value={c.title} onChange={(e) => { const n = [...chapters]; n[i] = { ...c, title: e.target.value }; setChapters(n); }} placeholder="Chapter title" className="flex-1 text-xs" />
                <Button size="sm" variant="ghost" onClick={() => setChapters(chapters.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setChapters([...chapters, { time: chapters.length ? chapters[chapters.length - 1].time + 60 : 0, title: "" }])}>
              <Plus className="h-3 w-3 mr-1" />Add marker
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="mindmap" className="space-y-3 pt-3">
          <Card className="p-3 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" onClick={() => aiGenerate("mindmap")} disabled={!!aiBusy} className="gap-1">
                {aiBusy === "mindmap" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                AI Generate Mind Map Image
              </Button>
              <span className="text-[10px] text-muted-foreground">Uses Gemini image model · ~10-20s</span>
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Label className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Upload or replace mindmap</Label>
                <p className="text-[11px] text-muted-foreground mt-1">PNG, JPG, JPEG, SVG · max 5MB · recommended 1920×1080+</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={open} disabled={uploadingMm}>
                  {uploadingMm ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UploadCloud className="h-3 w-3 mr-1" />} {mindmapUrl ? "Replace" : "Upload"}
                </Button>
                {mindmapUrl && <Button size="sm" variant="outline" onClick={() => void removeMindmap()} disabled={saving}><Trash2 className="h-3 w-3 mr-1" />Remove</Button>}
              </div>
            </div>

            <div
              {...getRootProps()}
              className={`rounded-lg border border-dashed p-4 transition-colors ${isDragActive ? "border-primary bg-primary/5" : "border-border bg-muted/20"}`}
            >
              <input {...getInputProps()} />
              {mindmapPreviewUrl ? (
                <div className="space-y-3">
                  <div className="aspect-[16/9] overflow-hidden rounded-md border border-border bg-background flex items-center justify-center">
                    <img src={mindmapPreviewUrl} alt={`${bookTitle} mindmap preview`} className="h-full w-full object-contain" />
                  </div>
                  <p className="text-xs text-muted-foreground">{isDragActive ? "Drop to replace the current mindmap" : "Drag and drop a new file here to replace the current mindmap"}</p>
                </div>
              ) : (
                <div className="min-h-40 flex flex-col items-center justify-center text-center gap-2">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm font-medium">{isDragActive ? "Drop your mindmap here" : "Drag & drop mindmap here"}</div>
                  <p className="text-xs text-muted-foreground">Or use the upload button to select a file</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Mindmap URL</Label>
              <Input
                value={mindmapUrl}
                onChange={(e) => {
                  setMindmapUrl(e.target.value);
                  setMindmapPreviewUrl(e.target.value);
                }}
                onBlur={() => void handleMindmapUrlBlur()}
                placeholder="…or paste URL"
                className="text-xs"
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default BookAssetsEditor;
