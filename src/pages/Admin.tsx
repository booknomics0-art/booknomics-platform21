import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { parseBulkBooks, ParsedBook } from "@/lib/bookParser";
import { toast } from "sonner";
import { trackAdminAddBook } from "@/lib/analytics";
import {
  Upload, CheckCircle2, Trash2, Image as ImageIcon,
  Sparkles, Languages, Pencil, EyeOff, Eye, UploadCloud, Library as LibraryIcon,
  Search as SearchIcon, Copy, ExternalLink, AlertTriangle,
  Settings as SettingsIcon, Send, Wand2,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { PublishingWizard } from "@/components/admin/PublishingWizard";




const SettingsPanel = lazy(() => import("@/components/admin/SettingsPanel"));
const PromotionHistory = lazy(() => import("@/components/admin/PromotionHistory"));

async function logAdminAccess(opts: { user_id?: string | null; attempted_email: string | null; outcome: "allowed" | "denied"; reason: string }) {
  try {
    await supabase.from("admin_access_logs").insert({
      attempted_email: opts.attempted_email,
      user_id: opts.user_id ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      outcome: opts.outcome,
      reason: opts.reason,
    });
  } catch { /* never block UI on logging */ }
}

async function pingIndexNow(urls: string[]) {
  try {
    await supabase.functions.invoke("indexnow-submit", { body: { urls } });
  } catch (e) { console.warn("[indexnow] ping failed", e); }
}

const SAMPLE = `#BOOK_START
Title: Atomic Habits
Author: James Clear
Language: English
Category: Productivity

#HOOK
Most habits fail because systems are weak.

#SUMMARY
Tiny changes, remarkable results...

#KEY_INSIGHTS
- 1% better every day compounds
- Identity-based habits stick
- Make it obvious, attractive, easy, satisfying

#APPLY_TODAY
Remove one distraction from your workspace today.

#REFLECTION
What habit controls your future?

#ACTION_SYSTEM
1. Pick a keystone habit
2. Stack onto existing routine
3. Track for 30 days

#AUDIO_SCRIPT
Welcome. Today we explore Atomic Habits...
#BOOK_END`;

type AdminBook = {
  id: string;
  title: string;
  author: string;
  category: string;
  language: string;
  is_draft: boolean;
  cover_url: string | null;
  status: string;
  slug: string;
  affiliate_link: string | null;
};

type EditState = Pick<AdminBook, "id" | "title" | "author" | "category" | "language" | "slug" | "affiliate_link"> & { overview?: string | null };

export default function Admin() {
  const { user, loading, isAdmin } = useAdmin();
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedBook[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [allBooks, setAllBooks] = useState<AdminBook[]>([]);
  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [coverBusyId, setCoverBusyId] = useState<string | null>(null);
  const [uploadBusyId, setUploadBusyId] = useState<string | null>(null);
  const [genBusyId, setGenBusyId] = useState<string | null>(null);
  const [polishBusyId, setPolishBusyId] = useState<string | null>(null);
  const [polishedIds, setPolishedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("polished_book_ids") || "[]")); }
    catch { return new Set(); }
  });
  const [bulkPolish, setBulkPolish] = useState<{ running: boolean; done: number; total: number; failed: number }>({ running: false, done: 0, total: 0, failed: 0 });
  const [editing, setEditing] = useState<EditState | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  

  useEffect(() => {
    if (loading || !user) return;
    void logAdminAccess({ user_id: user.id, attempted_email: user.email ?? null,
      outcome: isAdmin ? 'allowed' : 'denied', reason: isAdmin ? 'admin_role' : 'missing_admin_role' });
  }, [user, loading, isAdmin]);

  const loadBooks = async () => {
    const { data, error } = await supabase
      .from("books")
      .select("id,title,author,category,language,is_draft,cover_url,status,slug,affiliate_link")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setAllBooks((data as AdminBook[]) || []);
  };

  useEffect(() => {
    if (isAdmin) loadBooks();
  }, [isAdmin]);

  if (loading || isAdmin === null) {
    return <Layout><div className="p-8">Loading…</div></Layout>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleParse = () => {
    const { books, errors } = parseBulkBooks(raw);
    setParsed(books);
    setErrors(errors);
    if (books.length) toast.success(`${books.length} books parsed`);
    if (errors.length) toast.warning(`${errors.length} issue(s)`);
  };

  const handleImport = async () => {
    if (!parsed.length) return;
    setBusy(true);
    // Strip asset-only fields from the books insert payload
    const rows = parsed.map(({ audio_url, mindmap_url, quiz_data, flashcard_data, asset_status, missing_assets, ...b }) => ({
      ...b, is_draft: true, status: "done",
    }));
    const { data: inserted, error } = await supabase.from("books").insert(rows).select("id,slug,title");
    if (error) { setBusy(false); return toast.error(error.message); }

    // Insert linked assets where any of audio/mindmap/quiz/flashcards exist
    const assetRows = (inserted ?? []).map((row, i) => {
      const p = parsed[i];
      if (!p) return null;
      if (!p.audio_url && !p.mindmap_url && !(p.quiz_data?.length) && !(p.flashcard_data?.length)) return null;
      return {
        book_id: row.id,
        audio_url: p.audio_url,
        mindmap_url: p.mindmap_url,
        quiz_data: (p.quiz_data ?? []) as any,
        flashcard_data: (p.flashcard_data ?? []) as any,
        status: "published",
      };
    }).filter(Boolean) as any[];
    if (assetRows.length) {
      const { error: ae } = await supabase.from("book_assets").insert(assetRows);
      if (ae) toast.warning("Books imported, but some assets failed: " + ae.message);
    }

    setBusy(false);
    (inserted ?? []).forEach((r: any) => {
      const src = parsed.find((p) => p.slug === r.slug);
      trackAdminAddBook(
        { title: r.title, slug: r.slug, category: src?.category ?? "" },
        "csv_import",
      );
    });
    toast.success(`${rows.length} drafts created${assetRows.length ? ` · ${assetRows.length} with assets` : ""}`);
    setParsed([]); setRaw(""); loadBooks();
  };

  const handleTogglePublish = async (b: AdminBook) => {
    const wasPublishing = b.is_draft;
    // Daily publish cap removed — unlimited publishing.

    const patch: Partial<AdminBook> = { is_draft: !b.is_draft };
    if (b.is_draft && b.status !== "done") (patch as any).status = "done";
    const { error } = await supabase
      .from("books")
      .update(patch)
      .eq("id", b.id);
    if (error) return toast.error(error.message);
    if (wasPublishing) {
      trackAdminAddBook(
        { title: b.title, slug: b.slug, category: b.category },
        "manual_upload"
      );
      // Auto-submit to IndexNow (Bing, Yandex, Seznam, Naver) + Google sitemap ping.
      pingIndexNow([`https://booknomics.com/books/${b.slug}`]);
      
    }
    toast.success(b.is_draft ? "Published · indexing submitted" : "Unpublished (draft)");
    loadBooks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this book permanently?")) return;
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    loadBooks();
  };

  const handleAICover = async (id: string) => {
    setCoverBusyId(id);
    const { data, error } = await supabase.functions.invoke("generate-book-cover", { body: { book_id: id } });
    setCoverBusyId(null);
    if (error || data?.error) return toast.error(error?.message || data?.error || "Cover failed");
    toast.success("AI cover generated");
    loadBooks();
  };

  const handleUploadCover = async (id: string, file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Image file only");
    if (file.size > 8 * 1024 * 1024) return toast.error("Max 8MB");
    setUploadBusyId(id);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${id}/${Date.now()}.${ext}`;
      const { error: ue } = await supabase.storage.from("book-covers").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (ue) throw ue;
      const { data: pub } = supabase.storage.from("book-covers").getPublicUrl(path);
      const { error: be } = await supabase.from("books").update({ cover_url: pub.publicUrl }).eq("id", id);
      if (be) throw be;
      toast.success("HD cover uploaded");
      loadBooks();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadBusyId(null);
    }
  };

  const handleGenerate = async (id: string, language: "en" | "hi") => {
    setGenBusyId(id);
    const { data, error } = await supabase.functions.invoke("generate-book-content", {
      body: { book_id: id, language },
    });
    setGenBusyId(null);
    if (error || data?.error) return toast.error(error?.message || data?.error || "Generate failed");
    toast.success(`Generated (${language.toUpperCase()})`);
    loadBooks();
  };

  const markPolished = (id: string) => {
    setPolishedIds(prev => {
      const next = new Set(prev); next.add(id);
      try { localStorage.setItem("polished_book_ids", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const polishOne = async (id: string): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke("polish-book-content", { body: { book_id: id } });
    if (error || data?.error) return false;
    markPolished(id);
    return true;
  };

  const handlePolish = async (id: string) => {
    setPolishBusyId(id);
    const ok = await polishOne(id);
    setPolishBusyId(null);
    if (ok) toast.success("Polished");
    else toast.error("Polish failed");
  };

  const handlePolishAll = async () => {
    const targets = allBooks.filter(b => !polishedIds.has(b.id));
    if (targets.length === 0) return toast.info("All books already polished. Clear localStorage 'polished_book_ids' to redo.");
    if (!confirm(`Polish ${targets.length} books? Runs 3 at a time. You can leave this tab open.`)) return;
    setBulkPolish({ running: true, done: 0, total: targets.length, failed: 0 });
    const CONCURRENCY = 3;
    let idx = 0, done = 0, failed = 0;
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (idx < targets.length) {
        const my = idx++;
        const ok = await polishOne(targets[my].id);
        if (ok) done++; else failed++;
        setBulkPolish({ running: true, done, total: targets.length, failed });
        // small spacing to dodge rate limits
        await new Promise(r => setTimeout(r, 250));
      }
    });
    await Promise.all(workers);
    setBulkPolish({ running: false, done, total: targets.length, failed });
    toast.success(`Polish complete · ${done} ok · ${failed} failed`);
  };



  const saveEdit = async () => {
    if (!editing) return;
    const { id, ...patch } = editing;
    const { error } = await supabase.from("books").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    loadBooks();
  };

  const filtered = allBooks
    .filter((b) =>
      filter === "all" ? true : filter === "draft" ? b.is_draft : !b.is_draft
    )
    .filter((b) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
    });

  const draftCount = allBooks.filter((b) => b.is_draft).length;
  const pubCount = allBooks.length - draftCount;

  return (
    <Layout>
      <Helmet>
        <title>Admin · Booknomics</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="container mx-auto p-4 md:p-8 max-w-5xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-1">Admin Portal</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Bulk upload · AI generate · HD covers · Edit / Republish / Delete
        </p>




        <Tabs defaultValue="books">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="books">
              <LibraryIcon className="w-4 h-4 mr-1" />Books ({allBooks.length})
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="w-4 h-4 mr-1" />Upload
            </TabsTrigger>
            <TabsTrigger value="indexing">
              <SearchIcon className="w-4 h-4 mr-1" />Indexing
            </TabsTrigger>
            <TabsTrigger value="promotions">
              <Send className="w-4 h-4 mr-1" />Promotions
            </TabsTrigger>
            <TabsTrigger value="settings">
              <SettingsIcon className="w-4 h-4 mr-1" />Settings
            </TabsTrigger>
          </TabsList>

          {/* ============ BOOKS TAB ============ */}
          <TabsContent value="books" className="space-y-3">
            <Card className="p-3 flex flex-col md:flex-row gap-3 md:items-center">
              <Input
                placeholder="Search title or author…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="md:max-w-xs"
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={filter === "all" ? "default" : "outline"}
                  onClick={() => setFilter("all")}
                >All ({allBooks.length})</Button>
                <Button
                  size="sm"
                  variant={filter === "draft" ? "default" : "outline"}
                  onClick={() => setFilter("draft")}
                >Drafts ({draftCount})</Button>
                <Button
                  size="sm"
                  variant={filter === "published" ? "default" : "outline"}
                  onClick={() => setFilter("published")}
                >Published ({pubCount})</Button>
              </div>
              <div className="md:ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handlePolishAll}
                  disabled={bulkPolish.running}
                  title="Grammar + flow polish for every book via Lovable AI. Tracks progress in localStorage so re-runs only hit new books."
                >
                  <Wand2 className="w-4 h-4 mr-1" />
                  {bulkPolish.running
                    ? `Polishing… ${bulkPolish.done}/${bulkPolish.total}${bulkPolish.failed ? ` (${bulkPolish.failed} failed)` : ""}`
                    : `Polish All (${allBooks.length - polishedIds.size} left)`}
                </Button>
              </div>
            </Card>

            {filtered.length === 0 && (
              <Card className="p-6 text-center text-muted-foreground">No books</Card>
            )}

            {filtered.map((d) => (
              <Card key={d.id} className="p-3 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  {d.cover_url ? (
                    <img src={d.cover_url} alt="" className="w-14 h-20 object-cover rounded shrink-0" />
                  ) : (
                    <div className="w-14 h-20 rounded bg-muted grid place-items-center text-[10px] text-muted-foreground shrink-0">
                      No cover
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate flex items-center gap-2 flex-wrap">
                      {d.title}
                      <Badge
                        variant={d.is_draft ? "outline" : "default"}
                        className="text-[10px]"
                      >
                        {d.is_draft ? "Draft" : "Live"}
                      </Badge>
                      <Badge
                        variant={d.status === "done" ? "secondary" : d.status === "failed" ? "destructive" : "outline"}
                        className="text-[10px]"
                      >
                        {d.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase">{d.language}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {d.author} · {d.category}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 truncate">/{d.slug}</div>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {/* Hidden file input for HD upload */}
                  <input
                    ref={(el) => (fileInputs.current[d.id] = el)}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadCover(d.id, f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputs.current[d.id]?.click()}
                    disabled={uploadBusyId === d.id}
                  >
                    <UploadCloud className="w-4 h-4 mr-1" />
                    {uploadBusyId === d.id ? "Uploading…" : "HD Cover"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAICover(d.id)}
                    disabled={coverBusyId === d.id}
                  >
                    <ImageIcon className="w-4 h-4 mr-1" />
                    {coverBusyId === d.id ? "…" : "AI Cover"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleGenerate(d.id, "en")}
                    disabled={genBusyId === d.id}
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    {genBusyId === d.id ? "…" : "Gen EN"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleGenerate(d.id, "hi")}
                    disabled={genBusyId === d.id}
                  >
                    <Languages className="w-4 h-4 mr-1" />Gen HI
                  </Button>
                  <Button
                    size="sm"
                    variant={polishedIds.has(d.id) ? "outline" : "secondary"}
                    onClick={() => handlePolish(d.id)}
                    disabled={polishBusyId === d.id}
                    title="Polish grammar, syntax & flow (keeps meaning, language, tags)"
                  >
                    <Wand2 className="w-4 h-4 mr-1" />
                    {polishBusyId === d.id ? "…" : polishedIds.has(d.id) ? "Polished" : "Polish"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const { data } = await supabase.from("books_admin").select("overview").eq("id", d.id).maybeSingle();
                      setEditing({
                        id: d.id,
                        title: d.title,
                        author: d.author,
                        category: d.category,
                        language: d.language,
                        slug: d.slug,
                        affiliate_link: d.affiliate_link,
                        overview: (data as any)?.overview ?? "",
                      });
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-1" />Edit
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleTogglePublish(d)}
                    variant={d.is_draft ? "default" : "outline"}
                    disabled={false}
                    title=""
                  >
                    {d.is_draft ? (
                      <><CheckCircle2 className="w-4 h-4 mr-1" />Publish</>
                    ) : (
                      <><EyeOff className="w-4 h-4 mr-1" />Unpublish</>
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(d.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                  {!d.is_draft && (
                    <Button size="sm" variant="ghost" asChild>
                      <a href={`/books/${d.slug}`} target="_blank" rel="noreferrer">
                        <Eye className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* ============ UPLOAD TAB ============ */}
          <TabsContent value="upload" className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Structured Content</h2>
                <Button size="sm" variant="outline" onClick={() => setRaw(SAMPLE)}>Load sample</Button>
              </div>
              <Textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="Paste structured book content (#BOOK_START ... #BOOK_END)"
                className="min-h-[300px] font-mono text-xs"
              />
              <div className="flex gap-2 mt-3">
                <Button onClick={handleParse} disabled={!raw.trim()}>Parse</Button>
                <Button onClick={handleImport} disabled={!parsed.length || busy} variant="secondary">
                  {busy ? "Importing…" : `Import ${parsed.length} as drafts`}
                </Button>
              </div>
            </Card>

            {errors.length > 0 && (
              <Card className="p-4 border-destructive">
                <h3 className="font-semibold text-destructive mb-2">Issues</h3>
                <ul className="text-sm space-y-1">
                  {errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </Card>
            )}

            {parsed.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Validation Preview ({parsed.length})</h3>
                  <div className="flex gap-2 text-[10px]">
                    <Badge variant="secondary">✓ {parsed.filter(b => b.asset_status === "complete").length} complete</Badge>
                    <Badge variant="outline">◐ {parsed.filter(b => b.asset_status === "partial").length} partial</Badge>
                    <Badge variant="destructive">✗ {parsed.filter(b => b.asset_status === "missing").length} missing</Badge>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b">
                        <th className="text-left p-2">Title</th>
                        <th className="text-left p-2">Category</th>
                        <th className="text-left p-2">Lang</th>
                        <th className="text-left p-2">Audio</th>
                        <th className="text-left p-2">Mind</th>
                        <th className="text-left p-2">Quiz</th>
                        <th className="text-left p-2">Cards</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((b, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="p-2 font-medium">{b.title}<div className="text-[10px] text-muted-foreground">{b.author}</div></td>
                          <td className="p-2">{b.category}</td>
                          <td className="p-2 uppercase">{b.language}</td>
                          <td className="p-2">{b.audio_url ? "✓" : "—"}</td>
                          <td className="p-2">{b.mindmap_url ? "✓" : "—"}</td>
                          <td className="p-2">{b.quiz_data?.length ?? 0}</td>
                          <td className="p-2">{b.flashcard_data?.length ?? 0}</td>
                          <td className="p-2">
                            <Badge
                              variant={b.asset_status === "complete" ? "secondary" : b.asset_status === "partial" ? "outline" : "destructive"}
                              className="text-[10px]"
                            >
                              {b.asset_status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <Card className="p-4 bg-muted/40">
              <h3 className="font-semibold mb-2 text-sm">Required Format</h3>
              <pre className="text-xs overflow-x-auto">{`#BOOK_START
Title: Book Name
Author: Author Name
Language: English | Hindi
Category: Productivity

#HOOK ...
#SUMMARY ...
#KEY_INSIGHTS ...
#APPLY_TODAY ...
#REFLECTION ...
#ACTION_SYSTEM ...
#AUDIO_SCRIPT ...
#BOOK_END`}</pre>
            </Card>
          </TabsContent>

          {/* ============ INDEXING TAB ============ */}
          <TabsContent value="indexing" className="space-y-4">
            <IndexingPanel books={allBooks} />
          </TabsContent>

          {/* ============ PROMOTIONS TAB ============ */}
          <TabsContent value="promotions" className="space-y-4">
            <Suspense fallback={<Card className="p-6 text-sm text-muted-foreground">Loading promotions…</Card>}>
              <PromotionHistory />
            </Suspense>
          </TabsContent>

          {/* ============ SETTINGS TAB ============ */}
          <TabsContent value="settings" className="space-y-4">
            <Suspense fallback={<Card className="p-6 text-sm text-muted-foreground">Loading settings…</Card>}>
              <SettingsPanel />
            </Suspense>
          </TabsContent>
        </Tabs>

        {/* ============ EDIT DIALOG (4-step wizard) ============ */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Publishing Wizard{editing ? ` — ${editing.title}` : ""}</DialogTitle>
            </DialogHeader>
            {editing && (
              <PublishingWizard
                initial={editing}
                onSaved={() => { loadBooks(); }}
                onClose={() => setEditing(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

/* ============ INDEXING PANEL ============ */
function IndexingPanel({ books }: { books: AdminBook[] }) {
  const SITE = "https://booknomics.com";
  const published = books.filter((b) => !b.is_draft);
  const [thin, setThin] = useState<Record<string, number>>({});
  const [loadingThin, setLoadingThin] = useState(false);

  const allUrls = published.map((b) => `${SITE}/books/${b.slug}`).join("\n");

  const copy = (text: string, label = "Copied") => {
    navigator.clipboard.writeText(text).then(() => toast.success(label));
  };

  const checkThinContent = async () => {
    setLoadingThin(true);
    const { data } = await supabase
      .from("books_admin")
      .select("id,overview,key_ideas")
      .eq("is_draft", false);
    const map: Record<string, number> = {};
    (data ?? []).forEach((b: any) => {
      const len = (b.overview ?? "").length + (b.key_ideas ?? "").length;
      map[b.id] = len;
    });
    setThin(map);
    setLoadingThin(false);
    toast.success("Content audit complete");
  };

  return (
    <>
      <Card className="p-4">
        <h2 className="font-semibold mb-1">SEO Indexing Helper</h2>
        <p className="text-xs text-muted-foreground mb-3">
          {published.length} published books · canonical pattern: <code>/books/{`{slug}`}</code>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => copy(allUrls, `Copied ${published.length} URLs`)}>
            <Copy className="w-4 h-4 mr-1" />Copy all URLs
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={`${SITE}/sitemap.xml`} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" />Open sitemap.xml
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href="https://search.google.com/search-console/sitemaps" target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" />Submit in GSC
            </a>
          </Button>
          <Button size="sm" variant="secondary" onClick={checkThinContent} disabled={loadingThin}>
            <AlertTriangle className="w-4 h-4 mr-1" />
            {loadingThin ? "Auditing…" : "Audit thin content"}
          </Button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs sticky top-0">
              <tr>
                <th className="text-left p-2">Title</th>
                <th className="text-left p-2 hidden md:table-cell">URL</th>
                {Object.keys(thin).length > 0 && <th className="text-left p-2">Chars</th>}
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {published.map((b) => {
                const url = `${SITE}/books/${b.slug}`;
                const len = thin[b.id];
                const isThin = len !== undefined && len < 600;
                return (
                  <tr key={b.id} className="border-t hover:bg-muted/30">
                    <td className="p-2">
                      <div className="font-medium truncate max-w-[200px]">{b.title}</div>
                      <div className="text-[10px] text-muted-foreground">{b.category}</div>
                    </td>
                    <td className="p-2 hidden md:table-cell">
                      <code className="text-[10px] text-muted-foreground">/books/{b.slug}</code>
                    </td>
                    {Object.keys(thin).length > 0 && (
                      <td className="p-2">
                        <Badge variant={isThin ? "destructive" : "secondary"} className="text-[10px]">
                          {len ?? 0}
                        </Badge>
                      </td>
                    )}
                    <td className="p-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => copy(url, "URL copied")}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a
                          href={`https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent("sc-domain:booknomics.com")}&url=${encodeURIComponent(url)}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Inspect in Search Console"
                        >
                          <SearchIcon className="w-3 h-3" />
                        </a>
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href={url} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
