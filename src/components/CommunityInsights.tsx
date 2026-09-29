import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, MessageSquare, ThumbsUp, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
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
    const { data } = await supabase
      .from("discussions")
      .select("*")
      .eq("book_id", bookId)
      .order("helpful_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as Discussion[]) || []);
    if (user && data?.length) {
      const ids = data.map((d) => d.id);
      const { data: votes } = await supabase
        .from("discussion_votes")
        .select("discussion_id")
        .eq("user_id", user.id)
        .in("discussion_id", ids);
      setMyVotes(new Set((votes || []).map((v) => v.discussion_id)));
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bookId, user?.id]);

  const submit = async () => {
    if (!user) { navigate("/auth"); return; }
    if (question.trim().length < 8) { toast.error("Thoda detail me likho"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-expert-perspective", {
        body: { book_id: bookId, question: question.trim() },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setQuestion("");
      toast.success("Expert Perspective generated");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setSubmitting(false); }
  };

  const toggleVote = async (id: string) => {
    if (!user) { navigate("/auth"); return; }
    const voted = myVotes.has(id);
    // optimistic
    const next = new Set(myVotes);
    voted ? next.delete(id) : next.add(id);
    setMyVotes(next);
    setItems((prev) => prev.map((d) => d.id === id ? { ...d, helpful_count: d.helpful_count + (voted ? -1 : 1) } : d));
    if (voted) {
      await supabase.from("discussion_votes").delete().eq("user_id", user.id).eq("discussion_id", id);
    } else {
      await supabase.from("discussion_votes").insert({ user_id: user.id, discussion_id: id });
    }
  };

  const openReplies = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!replies[id]) {
      const { data } = await supabase
        .from("discussion_replies").select("*").eq("discussion_id", id).order("created_at");
      setReplies((p) => ({ ...p, [id]: (data as Reply[]) || [] }));
    }
  };

  const sendReply = async (id: string) => {
    if (!user) { navigate("/auth"); return; }
    if (!replyText.trim()) return;
    const { data, error } = await supabase.from("discussion_replies")
      .insert({ discussion_id: id, user_id: user.id, content: replyText.trim() })
      .select("*").single();
    if (error) { toast.error(error.message); return; }
    setReplies((p) => ({ ...p, [id]: [...(p[id] || []), data as Reply] }));
    setItems((prev) => prev.map((d) => d.id === id ? { ...d, reply_count: d.reply_count + 1 } : d));
    setReplyText("");
  };

  return (
    <section className="py-4">
      <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Community Insights</div>
      <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-2">A living knowledge space</h2>
      <p className="text-muted-foreground mb-8 text-sm">Ask thoughtful questions. Receive an expert perspective. Discuss with fellow readers.</p>

      <Card className="p-5 mb-8 border-border/60 bg-muted/20">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a thoughtful question about this book…"
          className="min-h-[90px] resize-none border-border/60 bg-background"
          maxLength={500}
        />
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
                <Button
                  variant="ghost" size="sm"
                  onClick={() => toggleVote(d.id)}
                  className={`gap-1.5 rounded-full ${myVotes.has(d.id) ? "text-primary" : "text-muted-foreground"}`}
                >
                  <ThumbsUp className={`w-4 h-4 ${myVotes.has(d.id) ? "fill-current" : ""}`} />
                  {d.helpful_count} Helpful
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => openReplies(d.id)}
                  className="gap-1.5 rounded-full text-muted-foreground"
                >
                  <MessageSquare className="w-4 h-4" />
                  {d.reply_count} {d.reply_count === 1 ? "Reply" : "Replies"}
                </Button>
              </div>
              {openId === d.id && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                  {(replies[d.id] || []).map((r) => (
                    <div key={r.id} className="text-sm bg-muted/30 rounded-lg p-3">
                      <p className="text-foreground/85 whitespace-pre-line">{r.content}</p>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Share your perspective…"
                      className="min-h-[60px] resize-none text-sm"
                      maxLength={1000}
                    />
                    <Button onClick={() => sendReply(d.id)} size="icon" className="shrink-0">
                      <Send className="w-4 h-4" />
                    </Button>
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
