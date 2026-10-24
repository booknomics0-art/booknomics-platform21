import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudUpload, Headphones, Loader2, Pencil, Search, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { matchAudioFilename, normalizedAudioTitle, type AudioCatalogBook, type AudioFileMatch } from "@/lib/audioBulkMatcher";
import { supabase } from "@/integrations/supabase/client";

const MAX_AUDIO_BYTES = 95 * 1024 * 1024;
const MAX_BATCH_FILES = 500;

type UploadStatus = "ready" | "uploading" | "linking" | "verifying" | "verified" | "unverified" | "failed";
type Row = {
  key: string;
  file: File;
  bookId: string | null;
  match: AudioFileMatch;
  excluded: boolean;
  replace: boolean;
  progress: number;
  status: UploadStatus;
  error: string | null;
  audioUrl: string | null;
  duration: number | null;
};

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function adminToken(): Promise<string> {
  // A browser session is only a source of the token. The Worker verifies it
  // independently with Supabase Auth and checks D1 admin role + exact email.
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in with booknomics0@gmail.com to use Bulk Audio");
  return data.session.access_token;
}

function uploadMp3(file: File, bookId: string, replace: boolean, token: string,
  onProgress: (percent: number) => void, activeRequests: Set<XMLHttpRequest>): Promise<{ audioUrl: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    activeRequests.add(xhr);
    xhr.open("POST", `/api/admin/audio/upload?bookId=${encodeURIComponent(bookId)}&replace=${replace}`, true);
    xhr.withCredentials = false;
    xhr.timeout = 20 * 60 * 1000;
    xhr.setRequestHeader("Content-Type", "audio/mpeg");
    xhr.setRequestHeader("X-Booknomics-Audio-Upload", "1");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      activeRequests.delete(xhr);
      let response: { error?: string; audio_url?: string; preview_url?: string } = {};
      try { response = JSON.parse(xhr.responseText); } catch { /* report HTTP status below */ }
      if (xhr.status >= 200 && xhr.status < 300 && response.audio_url && response.preview_url) {
        resolve({ audioUrl: response.audio_url, previewUrl: response.preview_url });
      }
      else reject(new Error(response.error || `Upload failed (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => { activeRequests.delete(xhr); reject(new Error("Network error during MP3 upload")); };
    xhr.ontimeout = () => { activeRequests.delete(xhr); reject(new Error("Upload timed out; check the book before retrying")); };
    xhr.onabort = () => { activeRequests.delete(xhr); reject(new Error("Upload cancelled; check its book link before retrying")); };
    xhr.send(file);
  });
}

async function verifyPlayback(url: string): Promise<number> {
  // HTTP range support catches broken/redirected media URLs before loading the player.
  const response = await fetch(url, { headers: { Range: "bytes=0-1" }, credentials: "same-origin", cache: "no-store" });
  if (response.status !== 200 && response.status !== 206) throw new Error(`Audio stream returned HTTP ${response.status}`);
  await response.body?.cancel();
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    const cleanup = () => { clearTimeout(timeout); audio.removeAttribute("src"); audio.load(); };
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error("Audio metadata did not load within 20 seconds")); }, 20_000);
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      cleanup();
      if (Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error("Audio loaded without a valid duration"));
    };
    audio.onerror = () => { cleanup(); reject(new Error("Browser could not decode this MP3")); };
    audio.src = url;
    audio.load();
  });
}

export default function BulkAudioUpload() {
  const [catalog, setCatalog] = useState<AudioCatalogBook[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [running, setRunning] = useState(false);
  const [reviewKey, setReviewKey] = useState<string | null>(null);
  const [bookSearch, setBookSearch] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const activeRequests = useRef(new Set<XMLHttpRequest>());
  const stopRequested = useRef(false);

  useEffect(() => {
    const abort = new AbortController();
    const requests = activeRequests.current;
    adminToken().then((token) => fetch("/api/admin/audio/catalog", {
      headers: { Authorization: `Bearer ${token}` }, credentials: "omit", signal: abort.signal,
    }))
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.books)) throw new Error(data.error || "Cloudflare catalog is unavailable");
        setCatalog(data.books);
      })
      .catch((error: Error) => { if (!abort.signal.aborted) setCatalogError(error.message); })
      .finally(() => { if (!abort.signal.aborted) setCatalogLoading(false); });
    return () => { abort.abort(); stopRequested.current = true; for (const request of requests) request.abort(); };
  }, []);

  const patchRow = useCallback((key: string, patch: Partial<Row>) => {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }, []);

  const onFiles = (files: FileList | null) => {
    if (!files || running) return;
    const selected = Array.from(files).slice(0, MAX_BATCH_FILES);
    setRows(selected.map((file, index) => {
      const match = matchAudioFilename(file.name, catalog);
      const error = !file.name.toLowerCase().endsWith(".mp3") ? "Only .mp3 files are supported"
        : file.size <= 0 || file.size > MAX_AUDIO_BYTES ? "MP3 must be between 1 byte and 95 MB" : null;
      return {
        key: `${file.name}-${file.size}-${file.lastModified}-${index}`, file,
        bookId: match.bookId, match, excluded: Boolean(error), replace: false, progress: 0,
        status: error ? "failed" : "ready", error, audioUrl: null, duration: null,
      };
    }));
    setReviewed(false);
    setCancelled(false);
    stopRequested.current = false;
  };

  const selectedBookIds = useMemo(() => rows.filter((row) => !row.excluded && row.bookId).map((row) => row.bookId), [rows]);
  const duplicateIds = useMemo(() => new Set(selectedBookIds.filter((id, index) => selectedBookIds.indexOf(id) !== index)), [selectedBookIds]);
  const ready = rows.filter((row) => !row.excluded && row.bookId && !duplicateIds.has(row.bookId)
    && (row.status === "ready" || row.status === "failed")
    && (!catalog.find((book) => book.id === row.bookId)?.audio_url || row.replace)
    && !row.error?.startsWith("MP3") && row.error !== "Only .mp3 files are supported");
  const pending = rows.filter((row) => !row.excluded && !row.audioUrl && (!row.bookId || duplicateIds.has(row.bookId)
    || (catalog.find((book) => book.id === row.bookId)?.audio_url && !row.replace)));
  const reviewRow = rows.find((row) => row.key === reviewKey) ?? null;
  const possible = useMemo(() => {
    const query = normalizedAudioTitle(bookSearch);
    if (!query) return reviewRow?.match.suggestions.map(({ book }) => book) ?? [];
    return catalog.filter((book) => normalizedAudioTitle(`${book.title} ${book.author}`).includes(query)
      || normalizedAudioTitle(book.slug).includes(query)).slice(0, 40);
  }, [bookSearch, catalog, reviewRow]);

  const startUpload = async () => {
    if (running || !reviewed || ready.length === 0 || pending.length > 0) return;
    try { await adminToken(); }
    catch (error) { setCatalogError(error instanceof Error ? error.message : "You must sign in again"); return; }
    setRunning(true);
    setCancelled(false);
    stopRequested.current = false;
    let cursor = 0;
    const queue = [...ready];
    const worker = async () => {
      while (cursor < queue.length && !stopRequested.current) {
        const row = queue[cursor++];
        if (!row.bookId) continue;
        patchRow(row.key, { status: "uploading", progress: 0, error: null });
        let uploadedUrl: string | null = null;
        try {
          const token = await adminToken(); // refreshed per file for long batches
          const uploaded = await uploadMp3(row.file, row.bookId, row.replace, token,
            (progress) => patchRow(row.key, { progress, status: progress >= 100 ? "linking" : "uploading" }), activeRequests.current);
          uploadedUrl = uploaded.previewUrl;
          setCatalog((current) => current.map((book) => book.id === row.bookId ? { ...book, audio_url: uploaded.audioUrl } : book));
          patchRow(row.key, { status: "verifying", progress: 100, audioUrl: uploadedUrl });
          const duration = await verifyPlayback(uploadedUrl);
          patchRow(row.key, { status: "verified", duration });
        } catch (error) {
          patchRow(row.key, {
            status: uploadedUrl ? "unverified" : "failed", audioUrl: uploadedUrl,
            error: error instanceof Error ? error.message : "Unknown upload error",
          });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, queue.length) }, () => worker()));
    setRunning(false);
  };

  const stop = () => {
    stopRequested.current = true;
    setCancelled(true);
    for (const xhr of activeRequests.current) xhr.abort();
  };

  const verifiedCount = rows.filter((row) => row.status === "verified").length;
  const unverifiedCount = rows.filter((row) => row.status === "unverified").length;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex gap-3 items-start">
          <CloudUpload className="h-6 w-6 text-primary shrink-0" />
          <div className="flex-1">
            <h2 className="font-semibold text-lg">Cloudflare R2 · Bulk Audiobook Upload</h2>
            <p className="text-sm text-muted-foreground">Select up to 500 MP3 files. Review every book before starting; replacements require confirmation. MP3s remain private in Cloudflare R2 until public/premium playback permissions are configured.</p>
          </div>
        </div>
        {catalogLoading ? (
          <p className="text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading book catalog…</p>
        ) : catalogError ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-medium">Admin audiobook service unavailable: {catalogError}</p>
            <p className="mt-1">Use your verified booknomics0@gmail.com Google login. The dedicated Cloudflare Worker must be configured. No files have been uploaded.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{catalog.length.toLocaleString()} books for matching · {catalog.filter((book) => book.audio_url?.startsWith("r2-private:")).length} private R2 audiobooks stored (separate from legacy Audio Ready count). Storage: <code>booknomics-private-audio</code>.</p>
            <Input aria-label="Select MP3 files" type="file" accept=".mp3,audio/mpeg" multiple disabled={running} onChange={(event) => { onFiles(event.target.files); event.target.value = ""; }} />
          </>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="font-medium">Batch · {rows.length} files</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Ready: {ready.length}</Badge>
              <Badge variant="outline">Needs review: {pending.length}</Badge>
              <Badge variant="secondary">Verified: {verifiedCount}</Badge>
              {unverifiedCount > 0 && <Badge variant="destructive">Unverified: {unverifiedCount}</Badge>}
            </div>
          </div>
          {pending.length > 0 && <p role="alert" className="text-xs text-amber-700 dark:text-amber-400">Resolve or skip unmatched, duplicate, and existing-audio files before uploading.</p>}
          <div className="max-h-[540px] overflow-y-auto border rounded-lg divide-y">
            {rows.map((row) => {
              const book = catalog.find((candidate) => candidate.id === row.bookId);
              const conflict = row.bookId && duplicateIds.has(row.bookId);
              const exists = Boolean(book?.audio_url);
              return (
                <div key={row.key} className={`p-3 space-y-2 text-sm ${row.excluded ? "opacity-55" : ""}`}>
                  <div className="flex gap-2 items-center justify-between flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-all">{row.file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(row.file.size)} · {book ? `${book.title} — ${book.author} (${book.language})` : "No book selected"}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      {row.status === "verified" ? <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Playable</Badge>
                        : row.status === "unverified" ? <Badge variant="destructive">Playback check failed</Badge>
                          : row.status === "failed" ? <Badge variant="destructive">Issue</Badge>
                            : row.status === "uploading" || row.status === "linking" || row.status === "verifying" ? <Badge variant="secondary">{row.status}</Badge>
                              : row.bookId && !conflict && !exists ? <Badge variant="outline">Matched</Badge> : <Badge variant="outline">Review</Badge>}
                      <Button type="button" size="sm" variant="outline" disabled={running || Boolean(row.audioUrl)} onClick={() => { setReviewKey(row.key); setBookSearch(""); }}>
                        <Pencil className="h-3 w-3 mr-1" />Match
                      </Button>
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <Checkbox checked={row.excluded} disabled={running || Boolean(row.audioUrl)} onCheckedChange={(value) => { patchRow(row.key, { excluded: value === true }); setReviewed(false); }} />Skip
                      </label>
                    </div>
                  </div>
                  {conflict && !row.excluded && <p role="alert" className="text-xs text-destructive flex gap-1"><AlertTriangle className="h-3 w-3" />Two files point to the same book; choose a different title or skip one.</p>}
                  {exists && !row.excluded && !row.audioUrl && (
                    <label className="flex gap-2 items-center text-xs text-amber-700 dark:text-amber-400">
                      <Checkbox checked={row.replace} disabled={running} onCheckedChange={(value) => { patchRow(row.key, { replace: value === true }); setReviewed(false); }} />
                      I reviewed this book and want to replace its existing audio link (old MP3 is retained in storage).
                    </label>
                  )}
                  {(row.status === "uploading" || row.status === "linking" || row.status === "verifying" || row.status === "verified") && <Progress value={row.progress} className="h-2" />}
                  {row.error && <p role="alert" className="text-xs text-destructive flex items-start gap-1"><XCircle className="h-3 w-3 shrink-0" />{row.error}</p>}
                  {row.audioUrl && (
                    <div className="space-y-1">
                      <audio controls preload="none" src={row.audioUrl} className="w-full h-9" aria-label={`Playback ${row.file.name}`} />
                      <p className="text-xs text-muted-foreground">Private R2 upload · {row.duration ? `${Math.round(row.duration / 60)} minute audio` : "browser verification pending or failed"}. This preview link expires in 60 minutes.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={reviewed} disabled={running} onCheckedChange={(value) => setReviewed(value === true)} />
            I reviewed the book mappings, languages, and any replacements. Only non-skipped files will upload.
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!reviewed || running || ready.length === 0 || pending.length > 0} onClick={() => void startUpload()}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Headphones className="h-4 w-4 mr-2" />}
              Upload {ready.length} MP3{ready.length === 1 ? "" : "s"} to R2
            </Button>
            {running && <Button variant="destructive" onClick={stop}>Stop remaining uploads</Button>}
          </div>
          {cancelled && <p className="text-xs text-muted-foreground">Stopped. Check each affected book before retrying a partly completed upload.</p>}
          {verifiedCount > 0 && <p role="status" className="text-sm text-green-700 dark:text-green-400">{verifiedCount} audiobook{verifiedCount === 1 ? "" : "s"} uploaded, linked, and passed the browser playback check.</p>}
        </Card>
      )}

      <Dialog open={Boolean(reviewRow)} onOpenChange={(open) => { if (!open) setReviewKey(null); }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Match audiobook with a book</DialogTitle></DialogHeader>
          <DialogDescription className="break-all">Choose the exact Booknomics title for {reviewRow?.file.name}. No approximate match is saved automatically.</DialogDescription>
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" autoFocus placeholder="Search title, author or slug…" value={bookSearch} onChange={(event) => setBookSearch(event.target.value)} />
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {possible.length ? possible.map((book) => (
              <button type="button" key={book.id} className="w-full text-left rounded-lg border p-3 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring" onClick={() => {
                if (reviewRow) { patchRow(reviewRow.key, { bookId: book.id, replace: false, error: null, status: "ready" }); setReviewed(false); }
                setReviewKey(null);
              }}>
                <div className="font-medium text-sm">{book.title}</div>
                <div className="text-xs text-muted-foreground">{book.author} · {book.language}{book.audio_url ? " · Already has audio" : ""}</div>
              </button>
            )) : <p className="text-sm text-muted-foreground">No match found. Try another spelling; never assign an uncertain file.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
