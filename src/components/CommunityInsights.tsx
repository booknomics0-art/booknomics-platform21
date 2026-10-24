import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, MessageSquare, ThumbsUp, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/cloudflareApi";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Discussion = {
  id: string;
  book_id: string;
  user_id: string;
  question: string;
  expert_perspective: string | null;
  helpful_count: number;
  reply_count: number;
  created_at: string;
};

type Reply = {
  id: string;
  discussion_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export const CommunityInsights = ({ bookId }: { bookId: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [replyText, setReplyText] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ data: Discussion[]; votes: string[] }>(`/api/book-discussions?book_id=${encodeURIComponent(bookId)}`);
      setItems(data.data || []);
      setMyVotes(new Set(data.votes || []));
    } catch {
      setItems([]);
      setMyVotes(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bookId, user?.id]);

  const submit = async () => {
    if (!user) { navigate("/auth"); return; }
    if (question.trim().length < 8) { toast.error("Thoda detail me likho"); return; }
    setSubmitting(true);
    try {
      await apiFetch<{ ok: boolean; discussion: Discussion }>("/api/book-discussions/expert", {
        method: "POST",
        body: JSON.stringify({ book_id: bookId, question: question.trim() }),
      });
      setQuestion("");
      toast.success("Expert Perspective generated");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setSubmitting(false); }
  };

  const toggleVote = async (id: string) => {
    if (!user) { navigate("/auth"); return; }
    const voted = myVotes.has(id);
    const next = new Set(myVotes);
    voted ? next.delete(id) : next.add(id);
    setMyVotes(next);
    setItems((prev) => prev.map((d) => d.id === id ? { ...d, helpful_count: Math.max(0, d.helpful_count + (voted ? -1 : 1)) } : d));
    try {
      const result = await apiFetch<{ active: boolean; helpful_count: number }>("/api/book-discussions/vote", {
        method: "POST",
        body: JSON.stringify({ discussion_id: id, active: !voted }),
      });
      setItems((prev) => prev.map((d) => d.id === id ? { ...d, helpful_count: result.helpful_count } : d));
    } catch {
      setMyVotes(myVotes);
      setItems((prev) => prev.map((d) => d.id === id ? { ...d, helpful_count: Math.max(0, d.helpful_count + (voted ? 1 : -1)) } : d));
      toast.error("Vote failed. Please retry.");
    }
  };

  const openReplies = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!replies[id]) {
      try {
        const { data } = await apiFetch<{ data: Reply[] }>(`/api/book-discussion-replies?discussion_id=${encodeURIComponent(id)}`);
        setReplies((p) => ({ ...p, [id]: data || [] }));
      } catch {
        setReplies((p) => ({ ...p, [id]: [] }));
      }
    }
  };

  const sendReply = async (id: string) => {
    if (!user) { navigate("/auth"); return; }
    if (!replyText.trim()) return;
    try {
      const { data } = await apiFetch<{ data: Reply }>("/api/book-discussion-replies", {
        method: "POST",
        body: JSON.stringify({ discussion_id: id, content: replyText.trim() }),
      });
      setReplies((p) => ({ ...p, [id]: [...(p[id] || []), data] }));
      setItems((prev) => prev.map((d) => d.id === id ? { ...d, reply_count: d.reply_count + 1 } : d));
      setReplyText("");
    } catch (e: any) {
      toast.error(e.message || "Reply failed");
    }
  };

  return (
    <section className="py-4">
      <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Community Insights</div>
      <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-2">A living knowledge space</h2>
      <p className="text-muted-foreground mb-8 text-sm">Ask thoughtful questions. Receive an expert perspective. Discuss with fellow readers.</p>

      <Card className="p-5 mb-8 border-border/60 bg-muted/20">
        <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a thoughtful question about this book…" className="min-h-[90px] resize-none border-border/60 bg-background" maxLength={500} />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">{question.length}/500 · An Expert Perspective will be generated</span>
          <Button onClick={submit} disabled={submitting || !question.trim()} className="rounded-full gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {submitting ? "Generating…" : "Ask"}
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center border-dashed bg-muted/10">
          <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No discussions yet. Be the first to ask a thoughtful question.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {items.map((d) => (
            <Card key={d.id} className="p-5 border-border/60">
              <h3 className="font-serif text-xl font-semibold leading-snug mb-4">{d.question}</h3>
              {d.expert_perspective && (
                <div className="border-l-2 border-primary/60 pl-4 py-1 mb-4">
                  <div className="text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-2">Expert Perspective</div>
                  <p className="text-foreground/85 leading-relaxed font-serif whitespace-pre-line">{d.expert_perspective}</p>
                </div>
              )}
              <div className="flex items-center gap-1 text-sm">
                <Button variant="ghost" size="sm" onClick={() => toggleVote(d.id)} className={`gap-1.5 rounded-full ${myVotes.has(d.id) ? "text-primary" : "text-muted-foreground"}`}>
                  <ThumbsUp className={`w-4 h-4 ${myVotes.has(d.id) ? "fill-current" : ""}`} />
                  {d.helpful_count} Helpful
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openReplies(d.id)} className="gap-1.5 rounded-full text-muted-foreground">
                  <MessageSquare className="w-4 h-4" />
                  {d.reply_count} {d.reply_count === 1 ? "Reply" : "Replies"}
                </Button>
              </div>
              {openId === d.id && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                  {(replies[d.id] || []).map((r) => <div key={r.id} className="text-sm bg-muted/30 rounded-lg p-3"><p className="text-foreground/85 whitespace-pre-line">{r.content}</p></div>)}
                  <div className="flex gap-2">
                    <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Share your perspective…" className="min-h-[60px] resize-none text-sm" maxLength={1000} />
                    <Button onClick={() => sendReply(d.id)} size="icon" className="shrink-0"><Send className="w-4 h-4" /></Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};
