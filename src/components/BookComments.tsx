import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MessageSquare, Send, ThumbsUp, Reply, Flame, Lightbulb, CheckCircle2, ChevronDown, ChevronRight, Pin, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiFetch } from "@/lib/cloudflareApi";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const REACTIONS = [
  { type: "helpful", label: "Helpful", icon: ThumbsUp, color: "text-blue-600" },
  { type: "powerful", label: "Powerful", icon: Flame, color: "text-orange-500" },
  { type: "insightful", label: "Insightful", icon: Lightbulb, color: "text-amber-500" },
  { type: "applied", label: "Applied", icon: CheckCircle2, color: "text-emerald-600" },
] as const;

type Comment = {
  id: string;
  book_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  helpful_count: number;
  is_pinned: boolean;
  is_solved: boolean;
  created_at: string;
};

type ApiComment = Comment & { display_name?: string | null; avatar_url?: string | null };
type ReactionRow = { comment_id: string | null; type: string; user_id: string };
type Profile = { id: string; display_name: string | null; avatar_url: string | null };
type Sort = "latest" | "top" | "helpful";

const MAX_DEPTH = 3;

const normalizeComment = (row: ApiComment): Comment => ({
  id: row.id,
  book_id: row.book_id,
  user_id: row.user_id,
  parent_comment_id: row.parent_comment_id,
  content: row.content,
  helpful_count: Number(row.helpful_count || 0),
  is_pinned: Boolean(row.is_pinned),
  is_solved: Boolean(row.is_solved),
  created_at: row.created_at,
});

export const BookComments = ({ bookId }: { bookId: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [sort, setSort] = useState<Sort>("latest");
  const [reactionCounts, setReactionCounts] = useState<Record<string, Record<string, number>>>({});
  const [myReactions, setMyReactions] = useState<Record<string, Set<string>>>({});

  const load = async () => {
    setLoading(true);
    try {
      const payload = await apiFetch<{ data: ApiComment[]; reactions: ReactionRow[] }>(
        `/api/social/comments?book_id=${encodeURIComponent(bookId)}`,
      );
      const rows = payload.data || [];
      const list = rows.map(normalizeComment);
      setComments(list);

      const pmap: Record<string, Profile> = {};
      for (const row of rows) {
        pmap[row.user_id] = {
          id: row.user_id,
          display_name: row.display_name ?? null,
          avatar_url: row.avatar_url ?? null,
        };
      }
      setProfiles(pmap);

      const counts: Record<string, Record<string, number>> = {};
      const mine: Record<string, Set<string>> = {};
      for (const reaction of payload.reactions || []) {
        if (!reaction.comment_id) continue;
        counts[reaction.comment_id] = counts[reaction.comment_id] || {};
        counts[reaction.comment_id][reaction.type] = (counts[reaction.comment_id][reaction.type] || 0) + 1;
        if (user && reaction.user_id === user.id) {
          mine[reaction.comment_id] = mine[reaction.comment_id] || new Set();
          mine[reaction.comment_id].add(reaction.type);
        }
      }
      setReactionCounts(counts);
      setMyReactions(mine);
    } catch {
      toast.error("Could not load discussions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bookId, user?.id]);

  const post = async (parentId: string | null, content: string, onDone?: () => void) => {
    if (!user) { navigate("/auth"); return; }
    if (content.trim().length < 2) { toast.error("Thoda aur likho"); return; }
    if (parentId === null) setPosting(true);
    try {
      const result = await apiFetch<{ data: ApiComment }>("/api/social/comments", {
        method: "POST",
        body: JSON.stringify({ book_id: bookId, parent_comment_id: parentId, content: content.trim() }),
      });
      setComments((p) => [normalizeComment(result.data), ...p]);
      if (!profiles[user.id]) {
        const profilePayload = await apiFetch<{ data: Profile[] }>(`/api/social/profiles?id=${encodeURIComponent(user.id)}`);
        const profile = profilePayload.data?.[0];
        if (profile) setProfiles((prev) => ({ ...prev, [user.id]: profile }));
      }
      onDone?.();
    } catch {
      toast.error("Comment could not be posted");
    } finally {
      if (parentId === null) setPosting(false);
    }
  };

  const toggleReaction = async (commentId: string, type: string) => {
    if (!user) { navigate("/auth"); return; }
    const has = myReactions[commentId]?.has(type) || false;

    setMyReactions((p) => {
      const next = { ...p };
      const set = new Set(next[commentId] || []);
      has ? set.delete(type) : set.add(type);
      next[commentId] = set;
      return next;
    });
    setReactionCounts((p) => {
      const next = { ...p };
      next[commentId] = { ...(next[commentId] || {}) };
      next[commentId][type] = Math.max(0, (next[commentId][type] || 0) + (has ? -1 : 1));
      return next;
    });
    if (type === "helpful") {
      setComments((p) => p.map((c) => c.id === commentId ? { ...c, helpful_count: Math.max(0, c.helpful_count + (has ? -1 : 1)) } : c));
    }

    try {
      const result = await apiFetch<{ active: boolean; count: number }>("/api/social/comment-reaction", {
        method: "POST",
        body: JSON.stringify({ book_id: bookId, comment_id: commentId, type, active: !has }),
      });
      setMyReactions((p) => {
        const next = { ...p };
        const set = new Set(next[commentId] || []);
        result.active ? set.add(type) : set.delete(type);
        next[commentId] = set;
        return next;
      });
      setReactionCounts((p) => ({
        ...p,
        [commentId]: { ...(p[commentId] || {}), [type]: result.count },
      }));
      if (type === "helpful") {
        setComments((p) => p.map((c) => c.id === commentId ? { ...c, helpful_count: result.count } : c));
      }
    } catch {
      setMyReactions((p) => {
        const next = { ...p };
        const set = new Set(next[commentId] || []);
        has ? set.add(type) : set.delete(type);
        next[commentId] = set;
        return next;
      });
      setReactionCounts((p) => {
        const next = { ...p };
        next[commentId] = { ...(next[commentId] || {}) };
        next[commentId][type] = Math.max(0, (next[commentId][type] || 0) + (has ? 1 : -1));
        return next;
      });
      if (type === "helpful") {
        setComments((p) => p.map((c) => c.id === commentId ? { ...c, helpful_count: Math.max(0, c.helpful_count + (has ? 1 : -1)) } : c));
      }
      toast.error("Reaction failed. Please retry.");
    }
  };

  const { roots, childrenMap } = useMemo(() => {
    const childrenMap: Record<string, Comment[]> = {};
    const roots: Comment[] = [];
    comments.forEach((c) => {
      if (c.parent_comment_id) {
        (childrenMap[c.parent_comment_id] = childrenMap[c.parent_comment_id] || []).push(c);
      } else {
        roots.push(c);
      }
    });
    Object.keys(childrenMap).forEach((k) => childrenMap[k].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)));
    const sorter = (a: Comment, b: Comment) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (sort === "latest") return +new Date(b.created_at) - +new Date(a.created_at);
      if (sort === "helpful") return b.helpful_count - a.helpful_count;
      const ar = (childrenMap[a.id]?.length || 0) + a.helpful_count;
      const br = (childrenMap[b.id]?.length || 0) + b.helpful_count;
      return br - ar;
    };
    roots.sort(sorter);
    return { roots, childrenMap };
  }, [comments, sort]);

  return (
    <section className="py-4">
      <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Community Discussion</div>
      <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-2">Ask. Answer. Discuss.</h2>
      <p className="text-muted-foreground mb-6 text-sm">Threaded conversations with fellow readers.</p>

      <Card className="p-4 md:p-5 mb-6 border-border/60 bg-muted/20">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask something about this book..."
          className="min-h-[90px] resize-none border-border/60 bg-background"
          maxLength={1000}
        />
        <div className="flex items-center justify-between mt-3 gap-2">
          <span className="text-xs text-muted-foreground">{text.length}/1000</span>
          <Button
            onClick={() => post(null, text, () => setText(""))}
            disabled={posting || !text.trim()}
            className="rounded-full gap-2"
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {posting ? "Posting…" : "Post"}
          </Button>
        </div>
      </Card>

      <div className="flex items-center gap-2 mb-4 text-xs">
        {(["latest", "top", "helpful"] as Sort[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`px-3 py-1.5 rounded-full border transition ${sort === s ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border text-muted-foreground hover:bg-muted/50"}`}
          >
            {s === "latest" ? "Latest" : s === "top" ? "Top" : "Most Helpful"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : roots.length === 0 ? (
        <Card className="p-10 text-center border-dashed bg-muted/10">
          <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No discussions yet. Be the first to start one.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {roots.map((c) => (
            <CommentNode
              key={c.id}
              comment={c}
              depth={0}
              childrenMap={childrenMap}
              profiles={profiles}
              reactionCounts={reactionCounts}
              myReactions={myReactions}
              onReact={toggleReaction}
              onReply={(content, onDone) => post(c.id, content, onDone)}
              onReplyTo={(parentId, content, onDone) => post(parentId, content, onDone)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

function CommentNode({
  comment, depth, childrenMap, profiles, reactionCounts, myReactions, onReact, onReply, onReplyTo,
}: {
  comment: Comment;
  depth: number;
  childrenMap: Record<string, Comment[]>;
  profiles: Record<string, Profile>;
  reactionCounts: Record<string, Record<string, number>>;
  myReactions: Record<string, Set<string>>;
  onReact: (id: string, type: string) => void;
  onReply: (content: string, onDone: () => void) => void;
  onReplyTo: (parentId: string, content: string, onDone: () => void) => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const profile = profiles[comment.user_id];
  const kids = childrenMap[comment.id] || [];
  const counts = reactionCounts[comment.id] || {};
  const mine = myReactions[comment.id] || new Set();
  const canNest = depth < MAX_DEPTH - 1;

  return (
    <Card className={`p-4 border-border/60 ${depth > 0 ? "bg-muted/10" : ""}`}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="text-xs">{(profile?.display_name || "R")[0].toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 flex-wrap">
            <span className="font-semibold text-foreground">{profile?.display_name || "Reader"}</span>
            {comment.is_pinned && <Pin className="w-3 h-3 text-amber-500" />}
            {comment.is_solved && <BadgeCheck className="w-3 h-3 text-emerald-600" />}
            <span>·</span>
            <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">{comment.content}</p>

          <div className="flex items-center gap-1 mt-3 flex-wrap">
            {REACTIONS.map((r) => {
              const Icon = r.icon;
              const active = mine.has(r.type);
              const count = counts[r.type] || 0;
              return (
                <button
                  key={r.type}
                  onClick={() => onReact(comment.id, r.type)}
                  aria-pressed={active}
                  className={`group inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all duration-200 active:scale-95 ${
                    active ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:bg-muted/50"
                  }`}
                  title={r.label}
                >
                  <Icon className={`w-3.5 h-3.5 transition-transform ${active ? "scale-110" : ""} ${active ? r.color : ""}`} />
                  {count > 0 && <span className="tabular-nums">{count}</span>}
                </button>
              );
            })}
            {canNest && (
              <button
                onClick={() => setReplyOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-border/60 text-muted-foreground hover:bg-muted/50"
              >
                <Reply className="w-3.5 h-3.5" /> Reply
              </button>
            )}
            {kids.length > 0 && (
              <button
                onClick={() => setCollapsed((v) => !v)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 text-muted-foreground hover:text-foreground"
              >
                {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {kids.length} {kids.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>

          {replyOpen && (
            <div className="mt-3 flex gap-2">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Share your perspective…"
                className="min-h-[60px] resize-none text-sm"
                maxLength={1000}
              />
              <Button
                size="icon"
                className="shrink-0"
                onClick={() => onReply(reply, () => { setReply(""); setReplyOpen(false); })}
                disabled={!reply.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}

          {!collapsed && kids.length > 0 && (
            <div className={`mt-3 space-y-3 ${depth < MAX_DEPTH - 1 ? "border-l-2 border-border/60 pl-3 md:pl-4" : ""}`}>
              {kids.map((k) => (
                <CommentNode
                  key={k.id}
                  comment={k}
                  depth={depth + 1}
                  childrenMap={childrenMap}
                  profiles={profiles}
                  reactionCounts={reactionCounts}
                  myReactions={myReactions}
                  onReact={onReact}
                  onReply={(content, onDone) => onReplyTo(k.id, content, onDone)}
                  onReplyTo={onReplyTo}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
