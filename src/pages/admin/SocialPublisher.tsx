import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { generatePost, PLATFORMS, Platform } from "@/lib/socialTemplates";
import type { BookForAudit } from "@/lib/seoScore";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

type SocialPost = { id: string; book_id: string; platform: string; status: string; content: string | null; published_at: string | null };

export default function SocialPublisherPage() {
  return (
    <AdminGuard>
      <AdminShell title="Social Publisher">
        <Inner />
      </AdminShell>
    </AdminGuard>
  );
}

function Inner() {
  const [params] = useSearchParams();
  const focusId = params.get("book");
  const [books, setBooks] = useState<BookForAudit[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(focusId);

  useEffect(() => { (async () => {
    const { data } = await supabase.from("books_admin")
      .select("id,slug,title,author,category,language,tagline,overview,key_ideas,action_system,daily_application")
      .eq("is_draft", false).order("created_at", { ascending: false }).limit(500);
    setBooks((data || []) as any);
    if (!focusId && data?.[0]) setSelectedId(data[0].id);
    const { data: p } = await supabase.from("social_posts").select("id,book_id,platform,status,content,published_at");
    setPosts((p || []) as any);
  })(); }, [focusId]);

  const book = useMemo(() => books.find(b => b.id === selectedId) || null, [books, selectedId]);
  const term = q.trim().toLowerCase();
  const list = books.filter(b => !term || `${b.title} ${b.author}`.toLowerCase().includes(term));

  const platformStatus = (bookId: string) => {
    const m = {} as Record<Platform, boolean>;
    for (const p of PLATFORMS) m[p] = posts.some(x => x.book_id === bookId && x.platform === p && x.status === "published");
    return m;
  };

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4">
      <Card className="p-3 max-h-[75vh] overflow-y-auto">
        <Input placeholder="Search books" value={q} onChange={e => setQ(e.target.value)} className="mb-2" />
        <ul className="space-y-1">
          {list.map(b => {
            const st = platformStatus(b.id);
            const count = PLATFORMS.filter(p => st[p]).length;
            return (
              <li key={b.id}>
                <button
                  onClick={() => setSelectedId(b.id)}
                  className={`w-full text-left p-2 rounded text-sm hover:bg-muted ${selectedId === b.id ? "bg-muted" : ""}`}
                >
                  <div className="line-clamp-1">{b.title}</div>
                  <div className="text-[10px] text-muted-foreground">{count}/{PLATFORMS.length} posted</div>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
      <div>
        {!book && <div className="text-muted-foreground">Select a book.</div>}
        {book && <BookPanel book={book} posts={posts.filter(p => p.book_id === book.id)}
                            onChange={async () => {
                              const { data } = await supabase.from("social_posts").select("id,book_id,platform,status,content,published_at");
                              setPosts((data || []) as any);
                            }} />}
      </div>
    </div>
  );
}

function BookPanel({ book, posts, onChange }: { book: BookForAudit; posts: SocialPost[]; onChange: () => void }) {
  return (
    <Card className="p-4">
      <div className="mb-3">
        <div className="text-xs text-muted-foreground">{book.author}</div>
        <h2 className="text-lg font-bold">{book.title}</h2>
      </div>
      <Tabs defaultValue="youtube">
        <TabsList className="flex-wrap">
          {PLATFORMS.map(p => <TabsTrigger key={p} value={p} className="capitalize">{p}</TabsTrigger>)}
        </TabsList>
        {PLATFORMS.map(p => (
          <TabsContent key={p} value={p}>
            <PlatformBlock platform={p} book={book} existing={posts.find(x => x.platform === p)} onChange={onChange} />
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}

function PlatformBlock({ platform, book, existing, onChange }: {
  platform: Platform; book: BookForAudit; existing: SocialPost | undefined; onChange: () => void;
}) {
  const tpl = generatePost(platform, book)!;
  const [content, setContent] = useState(existing?.content || `${tpl.title}\n\n${tpl.description}\n\n---\n${tpl.body}`);
  const [status, setStatus] = useState(existing?.status || "draft");
  const [saving, setSaving] = useState(false);

  const save = async (newStatus = status) => {
    setSaving(true);
    try {
      const payload = {
        book_id: book.id, platform, content, status: newStatus,
        published_at: newStatus === "published" ? new Date().toISOString() : null,
        post_type: "manual",
      };
      if (existing?.id) {
        const { error } = await supabase.from("social_posts").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("social_posts").insert(payload);
        if (error) throw error;
      }
      setStatus(newStatus);
      toast.success(newStatus === "published" ? "Marked as posted" : "Draft saved");
      onChange();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const copy = () => { navigator.clipboard.writeText(content); toast.success("Copied"); };

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center gap-2">
        <Badge variant={status === "published" ? "default" : "outline"} className={status === "published" ? "bg-emerald-600" : ""}>{status}</Badge>
        {existing?.published_at && <span className="text-xs text-muted-foreground">on {new Date(existing.published_at).toLocaleDateString()}</span>}
      </div>
      <Textarea value={content} onChange={e => setContent(e.target.value)} className="min-h-[220px] font-mono text-sm" />
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={copy}><Copy className="h-3 w-3 mr-1" /> Copy</Button>
        <Button size="sm" variant="outline" onClick={() => save("draft")} disabled={saving}>Save draft</Button>
        <Button size="sm" onClick={() => save("published")} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
          <Check className="h-3 w-3 mr-1" /> Mark as posted
        </Button>
      </div>
    </div>
  );
}
