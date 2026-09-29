import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, ThumbsUp, Loader2, Pencil, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Review = {
  id: string;
  book_id: string;
  user_id: string;
  rating: number;
  content: string;
  upvote_count: number;
  created_at: string;
};

type Profile = { id: string; display_name: string | null; avatar_url: string | null };

function Stars({
  value,
  onChange,
  size = 16,
  readOnly,
}: { value: number; onChange?: (n: number) => void; size?: number; readOnly?: boolean }) {
  return (
    <div className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={`${readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            style={{ width: size, height: size }}
            className={n <= value ? "fill-amber-400 stroke-amber-400" : "stroke-muted-foreground/40"}
          />
        </button>
      ))}
    </div>
  );
}

export function BookReviews({ bookId }: { bookId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [posting, setPosting] = useState(false);

  const myReview = useMemo(() => reviews.find((r) => user && r.user_id === user.id) || null, [reviews, user]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("book_reviews")
        .select("*")
        .eq("book_id", bookId)
        .order("upvote_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const list = (data as Review[]) || [];
      setReviews(list);

      const ids = Array.from(new Set(list.map((r) => r.user_id)));
      if (ids.length) {
        const { data: ps } = await supabase.from("profiles").select("id,display_name,avatar_url").in("id", ids);
        const pm: Record<string, Profile> = {};
        (ps || []).forEach((p: any) => { pm[p.id] = p; });
        setProfiles(pm);
      } else setProfiles({});

      if (user && list.length) {
        const { data: ups } = await supabase
          .from("review_upvotes")
          .select("review_id")
          .eq("user_id", user.id)
          .in("review_id", list.map((r) => r.id));
        setUpvoted(new Set((ups || []).map((u: any) => u.review_id)));
      } else setUpvoted(new Set());
    } catch {
      toast.error("Could not load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bookId, user?.id]);

  useEffect(() => {
    if (myReview && !editing) {
      setRating(myReview.rating);
      setContent(myReview.content);
    }
  }, [myReview, editing]);

  const submit = async () => {
    if (!user) { navigate("/auth"); return; }
    if (rating < 1) { toast.error("Pick a rating"); return; }
    setPosting(true);
    try {
      const payload = { book_id: bookId, user_id: user.id, rating, content: content.trim() };
      const { error } = await supabase
        .from("book_reviews")
        .upsert(payload, { onConflict: "book_id,user_id" });
      if (error) throw error;
      toast.success(myReview ? "Review updated" : "Review posted");
      setEditing(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not save review");
    } finally {
      setPosting(false);
    }
  };

  const remove = async () => {
    if (!user || !myReview) return;
    if (!confirm("Delete your review?")) return;
    const { error } = await supabase.from("book_reviews").delete().eq("id", myReview.id);
    if (error) { toast.error("Delete failed"); return; }
    setRating(0); setContent(""); setEditing(false); load();
  };

  const toggleUpvote = async (r: Review) => {
    if (!user) { navigate("/auth"); return; }
    if (r.user_id === user.id) { toast.info("Apni review upvote nahi kar sakte"); return; }
    const has = upvoted.has(r.id);
    // optimistic
    setUpvoted((p) => { const n = new Set(p); has ? n.delete(r.id) : n.add(r.id); return n; });
    setReviews((p) => p.map((x) => x.id === r.id ? { ...x, upvote_count: Math.max(0, x.upvote_count + (has ? -1 : 1)) } : x));
    try {
      if (has) {
        const { error } = await supabase.from("review_upvotes").delete().eq("review_id", r.id).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("review_upvotes").insert({ review_id: r.id, user_id: user.id });
        if (error) throw error;
      }
    } catch {
      // revert
      setUpvoted((p) => { const n = new Set(p); has ? n.add(r.id) : n.delete(r.id); return n; });
      setReviews((p) => p.map((x) => x.id === r.id ? { ...x, upvote_count: Math.max(0, x.upvote_count + (has ? 1 : -1)) } : x));
      toast.error("Upvote failed");
    }
  };

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const showForm = !myReview || editing;

  return (
    <section className="py-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-1">Reader Reviews</div>
          <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-tight">What readers say</h2>
        </div>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Stars value={Math.round(avg)} readOnly size={14} />
            <span className="font-semibold tabular-nums">{avg.toFixed(1)}</span>
            <span className="text-muted-foreground">· {reviews.length} review{reviews.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      <Card className="p-4 mb-5 border-border/60 bg-muted/20">
        {showForm ? (
          <>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-muted-foreground">Your rating:</span>
              <Stars value={rating} onChange={setRating} size={22} />
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Iss book ke action plan ne aapko kaise help kiya? (optional)"
              maxLength={500}
              className="min-h-[80px] resize-none border-border/60 bg-background"
            />
            <div className="flex items-center justify-between mt-3 gap-2">
              <span className="text-xs text-muted-foreground">{content.length}/500</span>
              <div className="flex gap-2">
                {myReview && (
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setRating(myReview.rating); setContent(myReview.content); }}>
                    Cancel
                  </Button>
                )}
                <Button onClick={submit} disabled={posting || rating < 1} size="sm" className="rounded-full gap-1.5">
                  {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {myReview ? "Update" : "Post review"}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Stars value={myReview.rating} readOnly size={18} />
              <span className="text-sm text-muted-foreground">Your review is live</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={remove} className="gap-1.5 text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            </div>
          </div>
        )}
      </Card>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Be the first to share what you thought.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const p = profiles[r.user_id];
            const has = upvoted.has(r.id);
            const mine = user?.id === r.user_id;
            return (
              <Card key={r.id} className="p-4 border-border/60">
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={p?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">{(p?.display_name || "R")[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 flex-wrap">
                      <span className="font-semibold text-foreground">{p?.display_name || "Reader"}</span>
                      <Stars value={r.rating} readOnly size={12} />
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                      {mine && <span className="text-primary">· You</span>}
                    </div>
                    {r.content && <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">{r.content}</p>}
                    <div className="mt-2">
                      <button
                        onClick={() => toggleUpvote(r)}
                        disabled={mine}
                        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
                          has ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:bg-muted/50"
                        } ${mine ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${has ? "fill-primary" : ""}`} />
                        <span className="tabular-nums">{r.upvote_count}</span>
                        <span className="hidden sm:inline">Helpful</span>
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
