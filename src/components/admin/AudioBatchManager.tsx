import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Headphones, Loader2, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SourceBook = {
  id: string;
  title: string;
  author: string;
  language: string;
  slug: string;
  overview: string | null;
  deep_summary: string | null;
  deep_analysis: string | null;
  key_ideas: string | null;
  real_life_example: string | null;
  action_system: string | null;
  modules_text?: string;
};

type UrlRow = { book_id: string; url: string };

type Progress = {
  running: boolean;
  done: number;
  total: number;
  failed: number;
  label: string;
};

const PAGE = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function combinedSourceChars(b: SourceBook) {
  return [b.deep_summary, b.overview, b.deep_analysis, b.key_ideas, b.real_life_example, b.action_system]
    .reduce((n, x) => n + (x?.length ?? 0), 0);
}

async function fetchAudioReadyIds() {
  const ready = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("book_assets")
      .select("book_id,audio_url")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      if (row.audio_url?.trim()) ready.add(row.book_id);
    }
    if (rows.length < pageSize) break;
  }
  return ready;
}

async function upsertAudioUrls(rows: UrlRow[]) {
  const payload = rows.map((r) => ({
    book_id: r.book_id,
    audio_url: r.url,
    status: "published",
  }));
  const { error } = await supabase.from("book_assets").upsert(payload, { onConflict: "book_id" });
  if (error) throw error;
}

export function AudioBatchManager() {
  const mp3Input = useRef<HTMLInputElement>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<Progress>({ running: false, done: 0, total: 0, failed: 0, label: "" });
  const [lastExportCount, setLastExportCount] = useState<number | null>(null);

  const exportMissingManifest = async () => {
    setExporting(true);
    try {
      const audioReady = await fetchAudioReadyIds();
      const books: SourceBook[] = [];
      let scanned = 0;

      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("books")
          .select("id,title,author,language,slug,overview,deep_summary,deep_analysis,key_ideas,real_life_example,action_system")
          .order("created_at", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = (data ?? []) as SourceBook[];
        scanned += batch.length;
        books.push(...batch.filter((b) => !audioReady.has(b.id)));
        setProgress({ running: true, done: scanned, total: 0, failed: 0, label: `Reading source text · ${scanned} books` });
        if (batch.length < PAGE) break;
      }

      const thinIds = books.filter((b) => combinedSourceChars(b) < 6000).map((b) => b.id);
      if (thinIds.length) {
        const { data: modules, error: modulesError } = await supabase
          .from("book_modules")
          .select("book_id,content,part_number")
          .in("book_id", thinIds)
          .order("part_number", { ascending: true });
        if (modulesError) throw modulesError;
        const grouped = new Map<string, string[]>();
        for (const m of modules ?? []) {
          const list = grouped.get(m.book_id) ?? [];
          if (m.content?.trim()) list.push(m.content);
          grouped.set(m.book_id, list);
        }
        for (const b of books) b.modules_text = (grouped.get(b.id) ?? []).join("\n\n");
      }

      downloadJson("booknomics-audio-manifest.json", {
        version: 1,
        exported_at: new Date().toISOString(),
        audio_ready_skipped: audioReady.size,
        books,
      });
      setLastExportCount(books.length);
      setProgress({ running: false, done: books.length, total: books.length, failed: 0, label: "Manifest exported" });
      toast.success(`${books.length} missing-audio books exported`);
    } catch (e: any) {
      setProgress((p) => ({ ...p, running: false, failed: p.failed + 1, label: "Export failed" }));
      toast.error(e?.message ?? "Audio manifest export failed");
    } finally {
      setExporting(false);
    }
  };

  const uploadMp3Files = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".mp3"));
    if (!list.length) return toast.error("Select MP3 files generated by the Booknomics audio engine");
    setProgress({ running: true, done: 0, total: list.length, failed: 0, label: "Uploading MP3s to Supabase" });
    let done = 0;
    let failed = 0;

    for (const file of list) {
      const bookId = file.name.replace(/\.mp3$/i, "");
      try {
        if (!UUID_RE.test(bookId)) throw new Error(`Invalid engine filename: ${file.name}`);
        if (file.size > 100 * 1024 * 1024) throw new Error(`${file.name} is over 100MB`);
        const path = `${bookId}/audio.mp3`;
        const { error: uploadError } = await supabase.storage.from("book-assets").upload(path, file, {
          upsert: true,
          contentType: "audio/mpeg",
          cacheControl: "31536000",
        });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("book-assets").getPublicUrl(path);
        await upsertAudioUrls([{ book_id: bookId, url: data.publicUrl }]);
        done += 1;
      } catch (e: any) {
        failed += 1;
        console.error("[audio-batch] upload failed", file.name, e);
      }
      setProgress({ running: true, done, total: list.length, failed, label: "Uploading MP3s to Supabase" });
    }

    setProgress({ running: false, done, total: list.length, failed, label: "MP3 upload finished" });
    if (failed) toast.warning(`${done} uploaded · ${failed} failed`);
    else toast.success(`${done} audio files linked to books`);
  };

  const importUrlManifest = async (file: File) => {
    setProgress({ running: true, done: 0, total: 0, failed: 0, label: "Importing hosted audio URLs" });
    try {
      const parsed = JSON.parse(await file.text());
      const raw = Array.isArray(parsed) ? parsed : parsed?.files;
      if (!Array.isArray(raw)) throw new Error("URL manifest needs a files[] array");
      const rows: UrlRow[] = raw
        .map((x: any) => ({ book_id: String(x?.book_id ?? ""), url: String(x?.url ?? x?.audio_url ?? "") }))
        .filter((x: UrlRow) => UUID_RE.test(x.book_id) && /^https?:\/\//i.test(x.url));
      if (!rows.length) throw new Error("No valid book_id + URL rows found");

      let done = 0;
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        await upsertAudioUrls(batch);
        done += batch.length;
        setProgress({ running: true, done, total: rows.length, failed: 0, label: "Importing hosted audio URLs" });
      }
      setProgress({ running: false, done, total: rows.length, failed: 0, label: "URL import finished" });
      toast.success(`${done} hosted audio URLs linked to Booknomics books`);
    } catch (e: any) {
      setProgress((p) => ({ ...p, running: false, failed: p.failed + 1, label: "URL import failed" }));
      toast.error(e?.message ?? "URL manifest import failed");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 font-semibold"><Headphones className="h-4 w-4" /> Local Audio Engine</div>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Export existing Booknomics summaries, generate English/Hindi MP3s locally, then link them back by exact book UUID. No paid AI/TTS API is required.
            </p>
          </div>
          <Badge variant="outline">UUID-safe matching</Badge>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <Card className="p-3 space-y-2">
            <Label>1. Export missing-audio books</Label>
            <p className="text-[11px] text-muted-foreground">Exports content only for books that do not already have an audio URL.</p>
            <Button size="sm" onClick={exportMissingManifest} disabled={exporting || progress.running}>
              {exporting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
              Export audio manifest
            </Button>
            {lastExportCount !== null && <div className="text-[11px] text-muted-foreground">Last export: {lastExportCount} books</div>}
          </Card>

          <Card className="p-3 space-y-2">
            <Label>2A. Small test: upload MP3s here</Label>
            <p className="text-[11px] text-muted-foreground">For a test batch. Files must be named &lt;book-uuid&gt;.mp3.</p>
            <input
              ref={mp3Input}
              type="file"
              accept=".mp3,audio/mpeg"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploadMp3Files(e.target.files);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => mp3Input.current?.click()} disabled={progress.running}>
              <UploadCloud className="h-3 w-3 mr-1" /> Select generated MP3s
            </Button>
          </Card>

          <Card className="p-3 space-y-2">
            <Label>2B. Full library: import hosted URLs</Label>
            <p className="text-[11px] text-muted-foreground">Use the engine's S3 uploader for large libraries, then import its URL manifest here.</p>
            <input
              ref={urlInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importUrlManifest(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => urlInput.current?.click()} disabled={progress.running}>
              <UploadCloud className="h-3 w-3 mr-1" /> Import audio URL manifest
            </Button>
          </Card>
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex items-center gap-2 text-sm">
          {progress.running ? <Loader2 className="h-4 w-4 animate-spin" /> : progress.failed ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <span>{progress.label || "Ready"}</span>
          {(progress.total > 0 || progress.done > 0) && <Badge variant="outline">{progress.done}/{progress.total || "?"}{progress.failed ? ` · ${progress.failed} failed` : ""}</Badge>}
        </div>
        {progress.total > 0 && (
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, ((progress.done + progress.failed) / progress.total) * 100)}%` }} />
          </div>
        )}
      </Card>

      <Card className="p-3 border-amber-500/30">
        <div className="flex gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span>
            Do not store the entire 3,000+ book library in a small file-storage quota. Use direct Supabase upload only for testing; for the full library, host the compressed MP3s in object storage and import their URLs.
          </span>
        </div>
      </Card>
    </div>
  );
}

export default AudioBatchManager;
