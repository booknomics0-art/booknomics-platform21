type D1 = any;
export type SocialEnv = { DB?: D1 };
type SafeUser = { id: string; email: string; display_name: string | null; avatar_url: string | null };
const SESSION_COOKIE = "bn_session";
const encoder = new TextEncoder();
const REACTION_TYPES = new Set(["helpful", "powerful", "insightful", "applied"]);

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...init.headers },
  });

const cookies = (request: Request) => {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey) result.set(rawKey, decodeURIComponent(rest.join("=")));
  }
  return result;
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};

async function currentUser(request: Request, db: D1): Promise<SafeUser | null> {
  const token = cookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await db.prepare(
    `SELECT u.id, COALESCE(u.supabase_email, u.email) AS email, u.display_name, u.avatar_url
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now') LIMIT 1`,
  ).bind(tokenHash).first();
  return row ? row as SafeUser : null;
}

async function requireUser(request: Request, env: SocialEnv) {
  if (!env.DB) return { user: null, response: json({ error: "D1 binding not configured" }, { status: 503 }) };
  const user = await currentUser(request, env.DB);
  if (!user) return { user: null, response: json({ error: "Authentication required" }, { status: 401 }) };
  return { user, response: null };
}

const goodUuid = (value: string | null | undefined) => Boolean(value && /^[0-9a-f-]{36}$/i.test(value));

async function reviewsList(request: Request, env: SocialEnv) {
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });
  const bookId = new URL(request.url).searchParams.get("book_id") || "";
  if (!goodUuid(bookId)) return json({ error: "Bad book id" }, { status: 400 });
  const user = await currentUser(request, env.DB);
  const rows = await env.DB.prepare(
    `SELECT br.id, br.book_id, br.user_id, br.rating, br.content, br.upvote_count, br.created_at,
            p.display_name, p.avatar_url
     FROM book_reviews br LEFT JOIN profiles p ON p.id = br.user_id
     WHERE br.book_id = ? ORDER BY br.upvote_count DESC, datetime(br.created_at) DESC LIMIT 100`,
  ).bind(bookId).all();
  let upvoted: string[] = [];
  if (user) {
    const ups = await env.DB.prepare(
      `SELECT ru.review_id FROM review_upvotes ru JOIN book_reviews br ON br.id = ru.review_id
       WHERE ru.user_id = ? AND br.book_id = ?`,
    ).bind(user.id, bookId).all();
    upvoted = (ups.results || []).map((r: any) => String(r.review_id));
  }
  return json({ data: rows.results || [], upvoted });
}

async function reviewSave(request: Request, env: SocialEnv) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { book_id?: string; rating?: number; content?: string } | null;
  const bookId = body?.book_id || ""; const rating = Number(body?.rating || 0); const content = String(body?.content || "").trim().slice(0, 500);
  if (!goodUuid(bookId)) return json({ error: "Bad book id" }, { status: 400 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: "Rating must be 1 to 5" }, { status: 400 });
  const now = new Date().toISOString();
  const existing = await env.DB!.prepare("SELECT id FROM book_reviews WHERE book_id = ? AND user_id = ? LIMIT 1").bind(bookId, auth.user!.id).first();
  const id = existing?.id ? String(existing.id) : crypto.randomUUID();
  if (existing) await env.DB!.prepare("UPDATE book_reviews SET rating = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(rating, content, now, id, auth.user!.id).run();
  else await env.DB!.prepare("INSERT INTO book_reviews (id, book_id, user_id, rating, content, upvote_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)").bind(id, bookId, auth.user!.id, rating, content, now, now).run();
  return json({ data: await env.DB!.prepare("SELECT * FROM book_reviews WHERE id = ? LIMIT 1").bind(id).first() });
}

async function reviewDelete(request: Request, env: SocialEnv) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { id?: string; book_id?: string } | null;
  if (goodUuid(body?.id)) await env.DB!.prepare("DELETE FROM book_reviews WHERE id = ? AND user_id = ?").bind(body!.id, auth.user!.id).run();
  else if (goodUuid(body?.book_id)) await env.DB!.prepare("DELETE FROM book_reviews WHERE book_id = ? AND user_id = ?").bind(body!.book_id, auth.user!.id).run();
  else return json({ error: "Bad review id" }, { status: 400 });
  return json({ ok: true });
}

async function reviewUpvote(request: Request, env: SocialEnv) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { review_id?: string; active?: boolean } | null;
  const reviewId = body?.review_id || ""; if (!goodUuid(reviewId)) return json({ error: "Bad review id" }, { status: 400 });
  const review = await env.DB!.prepare("SELECT user_id FROM book_reviews WHERE id = ? LIMIT 1").bind(reviewId).first();
  if (!review) return json({ error: "Review not found" }, { status: 404 });
  if (String(review.user_id) === auth.user!.id) return json({ error: "Cannot upvote your own review" }, { status: 400 });
  const existing = await env.DB!.prepare("SELECT id FROM review_upvotes WHERE review_id = ? AND user_id = ? LIMIT 1").bind(reviewId, auth.user!.id).first();
  const active = typeof body?.active === "boolean" ? body.active : !existing;
  if (active && !existing) await env.DB!.prepare("INSERT INTO review_upvotes (id, review_id, user_id, created_at) VALUES (?, ?, ?, ?)").bind(crypto.randomUUID(), reviewId, auth.user!.id, new Date().toISOString()).run();
  else if (!active && existing) await env.DB!.prepare("DELETE FROM review_upvotes WHERE review_id = ? AND user_id = ?").bind(reviewId, auth.user!.id).run();
  const count = await env.DB!.prepare("SELECT COUNT(*) AS n FROM review_upvotes WHERE review_id = ?").bind(reviewId).first();
  await env.DB!.prepare("UPDATE book_reviews SET upvote_count = ? WHERE id = ?").bind(Number(count?.n || 0), reviewId).run();
  return json({ active, count: Number(count?.n || 0) });
}

async function profilesList(request: Request, env: SocialEnv) {
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });
  const url = new URL(request.url); const raw = (url.searchParams.get("ids") || url.searchParams.get("id") || "").split(",").filter(goodUuid).slice(0, 90);
  if (!raw.length) return json({ data: [] });
  const rows = await env.DB.prepare(`SELECT id, display_name, avatar_url, daily_goal_minutes FROM profiles WHERE id IN (${raw.map(() => "?").join(",")})`).bind(...raw).all();
  return json({ data: rows.results || [] });
}

async function profileGoal(request: Request, env: SocialEnv) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  if (request.method === "GET") {
    const row = await env.DB!.prepare("SELECT daily_goal_minutes FROM profiles WHERE id = ? LIMIT 1").bind(auth.user!.id).first();
    return json({ daily_goal_minutes: Number(row?.daily_goal_minutes || 15) });
  }
  const body = await request.json().catch(() => null) as { daily_goal_minutes?: number } | null;
  const goal = Math.max(5, Math.min(60, Math.round(Number(body?.daily_goal_minutes || 15) / 5) * 5));
  await env.DB!.prepare("UPDATE profiles SET daily_goal_minutes = ? WHERE id = ?").bind(goal, auth.user!.id).run();
  return json({ daily_goal_minutes: goal });
}

async function commentsList(request: Request, env: SocialEnv) {
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });
  const bookId = new URL(request.url).searchParams.get("book_id") || ""; if (!goodUuid(bookId)) return json({ error: "Bad book id" }, { status: 400 });
  const comments = await env.DB.prepare(
    `SELECT c.id, c.book_id, c.user_id, c.parent_comment_id, c.content, c.helpful_count, c.is_pinned, c.is_solved, c.created_at,
            p.display_name, p.avatar_url FROM comments c LEFT JOIN profiles p ON p.id = c.user_id
     WHERE c.book_id = ? ORDER BY datetime(c.created_at) DESC LIMIT 200`,
  ).bind(bookId).all();
  const reactions = await env.DB.prepare("SELECT comment_id, type, user_id FROM reactions WHERE book_id = ? AND comment_id IS NOT NULL").bind(bookId).all();
  return json({ data: comments.results || [], reactions: reactions.results || [] });
}

async function commentCreate(request: Request, env: SocialEnv) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { book_id?: string; parent_comment_id?: string | null; content?: string } | null;
  const bookId = body?.book_id || ""; const parentId = body?.parent_comment_id || null; const content = String(body?.content || "").trim().slice(0, 1000);
  if (!goodUuid(bookId)) return json({ error: "Bad book id" }, { status: 400 }); if (content.length < 2) return json({ error: "Comment is too short" }, { status: 400 });
  if (parentId) { const parent = goodUuid(parentId) && await env.DB!.prepare("SELECT 1 AS ok FROM comments WHERE id = ? AND book_id = ? LIMIT 1").bind(parentId, bookId).first(); if (!parent) return json({ error: "Parent comment not found" }, { status: 404 }); }
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  await env.DB!.prepare("INSERT INTO comments (id, book_id, user_id, parent_comment_id, content, helpful_count, is_pinned, is_solved, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)").bind(id, bookId, auth.user!.id, parentId, content, now, now).run();
  return json({ data: await env.DB!.prepare("SELECT * FROM comments WHERE id = ? LIMIT 1").bind(id).first() }, { status: 201 });
}

async function commentReaction(request: Request, env: SocialEnv) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { book_id?: string; comment_id?: string; type?: string; active?: boolean } | null;
  const bookId = body?.book_id || ""; const commentId = body?.comment_id || ""; const type = body?.type || "";
  if (!goodUuid(bookId) || !goodUuid(commentId) || !REACTION_TYPES.has(type)) return json({ error: "Bad reaction" }, { status: 400 });
  const existing = await env.DB!.prepare("SELECT id FROM reactions WHERE user_id = ? AND comment_id = ? AND type = ? LIMIT 1").bind(auth.user!.id, commentId, type).first();
  const active = typeof body?.active === "boolean" ? body.active : !existing;
  if (active && !existing) await env.DB!.prepare("INSERT INTO reactions (id, book_id, user_id, type, created_at, comment_id) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), bookId, auth.user!.id, type, new Date().toISOString(), commentId).run();
  else if (!active && existing) await env.DB!.prepare("DELETE FROM reactions WHERE user_id = ? AND comment_id = ? AND type = ?").bind(auth.user!.id, commentId, type).run();
  const count = await env.DB!.prepare("SELECT COUNT(*) AS n FROM reactions WHERE comment_id = ? AND type = ?").bind(commentId, type).first();
  if (type === "helpful") await env.DB!.prepare("UPDATE comments SET helpful_count = ? WHERE id = ?").bind(Number(count?.n || 0), commentId).run();
  return json({ active, count: Number(count?.n || 0) });
}

async function habits(request: Request, env: SocialEnv) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const url = new URL(request.url);
  if (request.method === "GET") {
    const bookId = url.searchParams.get("book_id") || ""; if (!goodUuid(bookId)) return json({ error: "Bad book id" }, { status: 400 });
    const rows = await env.DB!.prepare("SELECT day_number, done, score, notes FROM habit_entries WHERE user_id = ? AND book_id = ? ORDER BY day_number ASC").bind(auth.user!.id, bookId).all();
    return json({ data: (rows.results || []).map((r: any) => ({ ...r, done: Boolean(r.done) })) });
  }
  const body = await request.json().catch(() => null) as { book_id?: string; day_number?: number; done?: boolean; score?: number; notes?: string | null } | null;
  const bookId = body?.book_id || ""; const day = Number(body?.day_number || 0); if (!goodUuid(bookId) || !Number.isInteger(day) || day < 1 || day > 7) return json({ error: "Bad habit entry" }, { status: 400 });
  const done = body?.done ? 1 : 0; const score = Math.max(0, Math.min(5, Number(body?.score || 0))); const note = body?.notes == null ? null : String(body.notes).slice(0, 2000); const now = new Date().toISOString();
  const existing = await env.DB!.prepare("SELECT id FROM habit_entries WHERE user_id = ? AND book_id = ? AND day_number = ? LIMIT 1").bind(auth.user!.id, bookId, day).first();
  if (existing) await env.DB!.prepare("UPDATE habit_entries SET done = ?, score = ?, notes = ?, updated_at = ? WHERE id = ?").bind(done, score, note, now, existing.id).run();
  else await env.DB!.prepare("INSERT INTO habit_entries (id, user_id, book_id, day_number, done, score, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), auth.user!.id, bookId, day, done, score, note, now, now).run();
  return json({ ok: true, day_number: day, done: Boolean(done), score, notes: note });
}

async function notes(request: Request, env: SocialEnv) {
  const auth = await requireUser(request, env); if (auth.response) return auth.response;
  const url = new URL(request.url);
  if (request.method === "GET") {
    const bookId = url.searchParams.get("book_id") || ""; if (bookId && !goodUuid(bookId)) return json({ error: "Bad book id" }, { status: 400 });
    const rows = bookId
      ? await env.DB!.prepare("SELECT id, book_id, content, created_at, updated_at FROM book_notes WHERE user_id = ? AND book_id = ? ORDER BY datetime(created_at) DESC LIMIT 100").bind(auth.user!.id, bookId).all()
      : await env.DB!.prepare("SELECT n.id, n.book_id, n.content, n.created_at, n.updated_at, COALESCE(b.seo_slug, b.slug) AS slug, b.title, b.author FROM book_notes n JOIN books b ON b.id = n.book_id WHERE n.user_id = ? ORDER BY datetime(n.updated_at) DESC LIMIT 50").bind(auth.user!.id).all();
    return json({ data: rows.results || [] });
  }
  if (request.method === "DELETE") { const body = await request.json().catch(() => null) as { id?: string } | null; if (!goodUuid(body?.id)) return json({ error: "Bad note id" }, { status: 400 }); await env.DB!.prepare("DELETE FROM book_notes WHERE id = ? AND user_id = ?").bind(body!.id, auth.user!.id).run(); return json({ ok: true }); }
  const body = await request.json().catch(() => null) as { book_id?: string; content?: string } | null; const bookId = body?.book_id || ""; const content = String(body?.content || "").trim().slice(0, 5000);
  if (!goodUuid(bookId) || !content) return json({ error: "Book and note are required" }, { status: 400 });
  const id = crypto.randomUUID(); const now = new Date().toISOString(); await env.DB!.prepare("INSERT INTO book_notes (id, user_id, book_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, auth.user!.id, bookId, content, now, now).run();
  return json({ data: await env.DB!.prepare("SELECT * FROM book_notes WHERE id = ? LIMIT 1").bind(id).first() }, { status: 201 });
}

function cutoffFor(range: string) { const d = new Date(); if (range === "today") d.setHours(0, 0, 0, 0); else if (range === "week") d.setDate(d.getDate() - 7); else if (range === "month") d.setDate(d.getDate() - 30); else return null; return d.toISOString(); }

async function community(request: Request, env: SocialEnv) {
  if (!env.DB) return json({ error: "D1 binding not configured" }, { status: 503 });
  const url = new URL(request.url); const range = ["today", "week", "month", "all"].includes(url.searchParams.get("range") || "") ? (url.searchParams.get("range") || "week") : "week"; const cutoff = cutoffFor(range); const user = await currentUser(request, env.DB);
  const [questions, replies, completed, trending, profiles] = await Promise.all([
    env.DB.prepare("SELECT d.id, d.user_id, d.created_at, d.question, d.book_id, COALESCE(b.seo_slug,b.slug) AS slug, b.title FROM discussions d LEFT JOIN books b ON b.id=d.book_id ORDER BY datetime(d.created_at) DESC LIMIT 10").all(),
    env.DB.prepare("SELECT r.id, r.user_id, r.created_at, r.content, d.book_id, COALESCE(b.seo_slug,b.slug) AS slug, b.title FROM discussion_replies r JOIN discussions d ON d.id=r.discussion_id LEFT JOIN books b ON b.id=d.book_id ORDER BY datetime(r.created_at) DESC LIMIT 10").all(),
    env.DB.prepare("SELECT rp.user_id, rp.book_id, rp.last_read_at, COALESCE(b.seo_slug,b.slug) AS slug, b.title FROM reading_progress rp JOIN books b ON b.id=rp.book_id WHERE rp.completed=1 ORDER BY datetime(rp.last_read_at) DESC LIMIT 10").all(),
    env.DB.prepare("SELECT d.id,d.question,d.helpful_count,d.reply_count,d.book_id,COALESCE(b.seo_slug,b.slug) AS slug,b.title FROM discussions d LEFT JOIN books b ON b.id=d.book_id ORDER BY d.helpful_count DESC,d.reply_count DESC,datetime(d.created_at) DESC LIMIT 10").all(),
    env.DB.prepare("SELECT id,display_name,avatar_url,streak_count FROM profiles LIMIT 500").all(),
  ]);
  const feed = [...(questions.results||[]).map((x:any)=>({id:x.id,kind:"question",user_id:x.user_id,created_at:x.created_at,question:x.question,book:x.slug?{slug:x.slug,title:x.title}:null})),...(replies.results||[]).map((x:any)=>({id:x.id,kind:"reply",user_id:x.user_id,created_at:x.created_at,content:x.content,book:x.slug?{slug:x.slug,title:x.title}:null})),...(completed.results||[]).map((x:any)=>({id:`${x.user_id}-${x.book_id}`,kind:"completed",user_id:x.user_id,created_at:x.last_read_at,book:x.slug?{slug:x.slug,title:x.title}:null}))].sort((a:any,b:any)=>+new Date(b.created_at)-+new Date(a.created_at)).slice(0,25);
  const leaders:any[]=[];
  for (const p of (profiles.results||[]) as any[]) {
    const args=cutoff?[p.id,cutoff]:[p.id]; const tw=cutoff?" AND datetime(%COL%) >= datetime(?)":"";
    const [bc,cc,qc,rc]=await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS n FROM reading_progress WHERE user_id=? AND completed=1${tw.replace("%COL%","last_read_at")}`).bind(...args).first(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM comments WHERE user_id=?${tw.replace("%COL%","created_at")}`).bind(...args).first(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM discussions WHERE user_id=?${tw.replace("%COL%","created_at")}`).bind(...args).first(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM discussion_replies WHERE user_id=?${tw.replace("%COL%","created_at")}`).bind(...args).first(),
    ]);
    const books=Number(bc?.n||0), comments=Number(cc?.n||0), qs=Number(qc?.n||0), rs=Number(rc?.n||0), streak=Number(p.streak_count||0), points=books*10+comments*2+qs*3+rs+(range==="all"?streak:0);
    if(points>0||range==="all") leaders.push({user_id:p.id,display_name:p.display_name,avatar_url:p.avatar_url,total_points:points,books_completed:books,comments_count:comments,streak_count:streak});
  }
  leaders.sort((a,b)=>b.total_points-a.total_points);
  let mine={questions:[] as any[],replies:[] as any[],rank:null as number|null};
  if(user){const [qs,rps]=await Promise.all([env.DB.prepare("SELECT d.id,d.question,d.created_at,d.book_id,COALESCE(b.seo_slug,b.slug) AS slug,b.title FROM discussions d LEFT JOIN books b ON b.id=d.book_id WHERE d.user_id=? ORDER BY datetime(d.created_at) DESC LIMIT 10").bind(user.id).all(),env.DB.prepare("SELECT id,content,created_at,discussion_id FROM discussion_replies WHERE user_id=? ORDER BY datetime(created_at) DESC LIMIT 10").bind(user.id).all()]);mine={questions:(qs.results||[]).map((x:any)=>({...x,books:x.slug?{slug:x.slug,title:x.title}:null})),replies:rps.results||[],rank:(()=>{const i=leaders.findIndex(x=>x.user_id===user.id);return i>=0?i+1:null;})()};}
  return json({feed,leaders:leaders.slice(0,20),trending:(trending.results||[]).map((x:any)=>({...x,book:x.slug?{slug:x.slug,title:x.title}:null})),mine});
}

export async function handleSocialRoute(request: Request, env: SocialEnv): Promise<Response | null> {
  const p = new URL(request.url).pathname;
  if (p === "/api/social/reviews" && request.method === "GET") return reviewsList(request, env);
  if (p === "/api/social/reviews" && request.method === "POST") return reviewSave(request, env);
  if (p === "/api/social/reviews" && request.method === "DELETE") return reviewDelete(request, env);
  if (p === "/api/social/review-upvote" && request.method === "POST") return reviewUpvote(request, env);
  if (p === "/api/social/profiles" && request.method === "GET") return profilesList(request, env);
  if (p === "/api/profile/reading-goal" && (request.method === "GET" || request.method === "POST")) return profileGoal(request, env);
  if (p === "/api/social/comments" && request.method === "GET") return commentsList(request, env);
  if (p === "/api/social/comments" && request.method === "POST") return commentCreate(request, env);
  if (p === "/api/social/comment-reaction" && request.method === "POST") return commentReaction(request, env);
  if (p === "/api/habits" && (request.method === "GET" || request.method === "POST")) return habits(request, env);
  if (p === "/api/notes" && ["GET", "POST", "DELETE"].includes(request.method)) return notes(request, env);
  if (p === "/api/community" && request.method === "GET") return community(request, env);
  return null;
}
