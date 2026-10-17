import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { apiFetch } from '@/lib/cloudflareApi';

const backend = (import.meta.env.VITE_DATA_BACKEND || 'supabase').trim().toLowerCase();
export const isCloudflareBackend = backend === 'cloudflare';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const configuredApiBase = (import.meta.env.VITE_API_BASE || '').trim().replace(/\/$/, '');

export const SUPABASE_URL = configuredUrl || '';
export const SUPABASE_KEY = configuredKey || '';
export const isSupabaseConfigured = Boolean(configuredUrl && configuredKey);

const disabledMessage = 'Supabase runtime is disabled while Booknomics is using the Cloudflare backend.';
const disabledError = { message: disabledMessage };

type Filter = { op: 'eq' | 'neq' | 'in' | 'not' | 'contains' | 'or' | 'gte'; field?: string; value: any; extra?: any };

function makeCloudflareQuery(table: string) {
  const state: any = {
    mode: 'select',
    filters: [] as Filter[],
    order: null as null | { field: string; ascending: boolean },
    limit: null as number | null,
    offset: 0,
    countRequested: false,
    payload: null as any,
    single: false,
    columns: '*',
  };

  const builder: any = {
    select(columns = '*', options?: any) {
      state.columns = columns;
      if (state.mode === 'select') state.mode = 'select';
      state.countRequested = options?.count === 'exact';
      return builder;
    },
    eq(field: string, value: any) { state.filters.push({ op: 'eq', field, value }); return builder; },
    neq(field: string, value: any) { state.filters.push({ op: 'neq', field, value }); return builder; },
    in(field: string, value: any[]) { state.filters.push({ op: 'in', field, value }); return builder; },
    gte(field: string, value: any) { state.filters.push({ op: 'gte', field, value }); return builder; },
    not(field: string, op: string, value: any) { state.filters.push({ op: 'not', field, value, extra: op }); return builder; },
    contains(field: string, value: any) { state.filters.push({ op: 'contains', field, value }); return builder; },
    or(value: string) { state.filters.push({ op: 'or', value }); return builder; },
    order(field: string, options?: any) { state.order = { field, ascending: options?.ascending !== false }; return builder; },
    limit(value: number) { state.limit = value; return builder; },
    range(from: number, to: number) { state.offset = from; state.limit = Math.max(0, to - from + 1); return builder; },
    maybeSingle() { state.single = true; return builder; },
    single() { state.single = true; return builder; },
    insert(payload: any) { state.mode = 'insert'; state.payload = payload; return builder; },
    delete() { state.mode = 'delete'; return builder; },
    update(payload: any) { state.mode = 'update'; state.payload = payload; return builder; },
    upsert(payload: any) { state.mode = 'upsert'; state.payload = payload; return builder; },
    then(resolve: any, reject?: any) { return executeCloudflareQuery(table, state).then(resolve, reject); },
    catch(reject: any) { return executeCloudflareQuery(table, state).catch(reject); },
    finally(handler: any) { return executeCloudflareQuery(table, state).finally(handler); },
  };
  return builder;
}

const filterValue = (filters: Filter[], op: Filter['op'], field: string) =>
  filters.find((f) => f.op === op && f.field === field)?.value;

const ok = (data: any, single = false, count?: number) => ({ data: single ? (Array.isArray(data) ? (data[0] ?? null) : data) : data, error: null, count: count ?? (Array.isArray(data) ? data.length : data ? 1 : 0) });
const fail = (message: string, single = false) => ({ data: single ? null : [], error: { message }, count: 0 });

function adminBookSelect(state: any, view: 'catalog' | 'full') {
  const filters = state.filters as Filter[];
  const params = new URLSearchParams({
    view,
    limit: String(Math.min(Math.max(Number(state.limit ?? 100), 1), 500)),
    offset: String(Math.max(Number(state.offset || 0), 0)),
  });
  const id = filterValue(filters, 'eq', 'id');
  const status = filterValue(filters, 'eq', 'status');
  const draft = filterValue(filters, 'eq', 'is_draft');
  if (id) params.set('id', String(id));
  if (status != null) params.set('status', String(status));
  if (typeof draft === 'boolean') params.set('is_draft', String(draft));
  return params;
}

async function executeAdminBooksQuery(table: string, state: any) {
  const filters = state.filters as Filter[];
  const id = filterValue(filters, 'eq', 'id');
  try {
    if (table === 'books' && state.mode === 'insert') {
      const payload = await apiFetch<{ data: any[] }>('/api/admin/books', { method: 'POST', body: JSON.stringify(state.payload) });
      return ok(state.single ? (payload.data?.[0] ?? null) : (payload.data ?? []), state.single);
    }
    if (table === 'books' && state.mode === 'update') {
      if (!id) return fail('Admin book update requires id', state.single);
      const payload = await apiFetch<{ data: any }>(`/api/admin/books/${encodeURIComponent(String(id))}`, { method: 'PATCH', body: JSON.stringify(state.payload || {}) });
      return ok(payload.data, state.single);
    }
    if (table === 'books' && state.mode === 'delete') {
      if (!id) return fail('Admin book delete requires id', state.single);
      const payload = await apiFetch<any>(`/api/admin/books/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
      return ok(payload, state.single);
    }

    const view: 'catalog' | 'full' = table === 'admin_book_catalog' ? 'catalog' : 'full';
    const payload = await apiFetch<{ data: any[] }>(`/api/admin/books?${adminBookSelect(state, view).toString()}`);
    const rows = payload.data ?? [];
    return ok(state.single ? (rows[0] ?? null) : rows, state.single, rows.length);
  } catch (e: any) {
    return fail(e?.message || 'Admin book query failed', state.single);
  }
}

async function executeBookAssetsAdminQuery(state: any) {
  const filters = state.filters as Filter[];
  const payloadBookId = Array.isArray(state.payload) ? null : state.payload?.book_id;
  const bookId = payloadBookId ?? filterValue(filters, 'eq', 'book_id');
  try {
    if (state.mode === 'insert') {
      const payload = await apiFetch<{ data: any[] }>('/api/admin/book-assets', { method: 'POST', body: JSON.stringify(state.payload) });
      return ok(state.single ? (payload.data?.[0] ?? null) : (payload.data ?? []), state.single);
    }
    if (state.mode === 'upsert' || state.mode === 'update') {
      if (!bookId) return fail('Book asset write requires book_id', state.single);
      const payload = await apiFetch<{ data: any }>(`/api/admin/book-assets/${encodeURIComponent(String(bookId))}`, { method: 'PUT', body: JSON.stringify(state.payload || {}) });
      return ok(payload.data, state.single);
    }
    if (!bookId) return fail('Book asset query requires book_id', state.single);
    const payload = await apiFetch<{ data: any | null }>(`/api/admin/book-assets/${encodeURIComponent(String(bookId))}`);
    return ok(state.single ? payload.data : (payload.data ? [payload.data] : []), state.single);
  } catch (e: any) {
    return fail(e?.message || 'Book assets query failed', state.single);
  }
}

async function executeAdminAccessLogQuery(state: any) {
  if (state.mode !== 'insert') return fail(disabledMessage, state.single);
  try {
    const payload = await apiFetch<any>('/api/admin/access-log', { method: 'POST', body: JSON.stringify(state.payload || {}) });
    return ok(payload, state.single);
  } catch (e: any) {
    return fail(e?.message || 'Admin access log failed', state.single);
  }
}

function needsAdminBookSelect(state: any) {
  if (state.mode !== 'select') return true;
  const columns = String(state.columns || '');
  return /overview|key_ideas|deep_analysis|meta_title|meta_description|affiliate_link|is_draft|status/i.test(columns);
}

async function executeBooksQuery(state: any) {
  if (needsAdminBookSelect(state)) return executeAdminBooksQuery('books', state);
  const filters = state.filters as Filter[];
  const id = filterValue(filters, 'eq', 'id');
  if (id) {
    try {
      const payload = await apiFetch<{ data: any | null }>(`/api/social/book-meta?id=${encodeURIComponent(String(id))}`);
      return ok(payload.data ? (state.single ? payload.data : [payload.data]) : (state.single ? null : []), state.single);
    } catch (e: any) { return fail(e?.message || 'Book query failed', state.single); }
  }
  if (filters.some((f) => f.op === 'contains')) return ok(state.single ? null : [], state.single, 0);

  const slug = filterValue(filters, 'eq', 'slug') ?? filterValue(filters, 'eq', 'seo_slug');
  if (slug) {
    try {
      const payload = await apiFetch<{ data: any }>(`/api/books/${encodeURIComponent(String(slug))}`);
      return ok(state.single ? payload.data : [payload.data], state.single, payload.data ? 1 : 0);
    } catch (error: any) {
      if (/404|not found/i.test(error?.message || '')) return ok(state.single ? null : [], state.single, 0);
      return fail(error?.message || 'Book query failed', state.single);
    }
  }

  const slugList = filterValue(filters, 'in', 'slug');
  if (Array.isArray(slugList) && slugList.length) {
    const rows = (await Promise.all(slugList.slice(0, 100).map(async (item) => {
      try { return (await apiFetch<{ data: any }>(`/api/books/${encodeURIComponent(String(item))}`)).data; }
      catch { return null; }
    }))).filter(Boolean);
    return ok(state.single ? (rows[0] ?? null) : rows, state.single, rows.length);
  }

  const language = filterValue(filters, 'eq', 'language');
  const category = filterValue(filters, 'eq', 'category');
  let q = '';
  const titleEq = filterValue(filters, 'eq', 'title');
  const authorEq = filterValue(filters, 'eq', 'author');
  if (titleEq) q = String(titleEq); else if (authorEq) q = String(authorEq);
  const orFilter = filters.find((f) => f.op === 'or')?.value as string | undefined;
  if (!q && orFilter) { const match = orFilter.match(/ilike\.%(.*?)%/i); if (match?.[1]) q = match[1].replace(/%/g, ' ').trim(); }

  let sort = 'az';
  if (state.order?.field === 'created_at') sort = state.order.ascending ? 'az' : 'latest';
  else if (state.order?.field === 'title') sort = state.order.ascending ? 'az' : 'za';
  else if (state.order?.field === 'category') sort = 'category';

  const limit = Math.min(Math.max(Number(state.limit ?? 100), 1), 100);
  const params = new URLSearchParams({ limit: String(limit), offset: String(state.offset || 0), sort });
  if (language) params.set('language', String(language));
  if (category) params.set('category', String(category));
  if (q) params.set('q', q);

  try {
    const payload = await apiFetch<{ data: any[]; count: number }>(`/api/books?${params.toString()}`);
    let rows = payload.data ?? [];
    for (const filter of filters) {
      if (filter.op === 'neq' && filter.field) rows = rows.filter((row) => row?.[filter.field!] !== filter.value);
      if (filter.op === 'not' && filter.field && filter.extra === 'is' && filter.value === null) rows = rows.filter((row) => row?.[filter.field!] != null);
      if (filter.op === 'eq' && filter.field === 'title') rows = rows.filter((row) => row?.title === filter.value);
      if (filter.op === 'eq' && filter.field === 'author') rows = rows.filter((row) => row?.author === filter.value);
    }
    return ok(state.single ? (rows[0] ?? null) : rows, state.single, state.countRequested ? payload.count : rows.length);
  } catch (error: any) { return fail(error?.message || 'Book query failed', state.single); }
}

async function executeLibraryQuery(state: any) {
  const filters = state.filters as Filter[]; const bookId = filterValue(filters, 'eq', 'book_id') ?? state.payload?.book_id;
  if (!bookId) return fail(disabledMessage, state.single);
  try {
    if (state.mode === 'insert' || state.mode === 'delete') {
      const payload = await apiFetch<{ saved: boolean }>("/api/library/toggle", { method: 'POST', body: JSON.stringify({ book_id: bookId, saved: state.mode === 'insert' }) });
      return ok(payload, state.single);
    }
    const payload = await apiFetch<{ saved: boolean }>(`/api/library/status?book_id=${encodeURIComponent(String(bookId))}`);
    const row = payload.saved ? { id: `saved:${bookId}` } : null;
    return ok(state.single ? row : (row ? [row] : []), state.single);
  } catch (e: any) { return fail(e?.message || 'Library query failed', state.single); }
}

async function executeReadingProgressQuery(state: any) {
  const filters = state.filters as Filter[]; const bookId = state.payload?.book_id ?? filterValue(filters, 'eq', 'book_id');
  if (!bookId || !['upsert', 'insert', 'update'].includes(state.mode)) return fail(disabledMessage, state.single);
  try {
    const payload = await apiFetch<any>("/api/reading-progress", { method: 'POST', body: JSON.stringify({ book_id: bookId, completed: Boolean(state.payload?.completed) }) });
    return ok(payload, state.single);
  } catch (e: any) { return fail(e?.message || 'Progress update failed', state.single); }
}

async function executeProfilesQuery(state: any) {
  const filters = state.filters as Filter[];
  try {
    if (state.mode === 'update' && state.payload?.daily_goal_minutes != null) {
      const data = await apiFetch<any>('/api/profile/reading-goal', { method: 'POST', body: JSON.stringify({ daily_goal_minutes: state.payload.daily_goal_minutes }) });
      return ok(data, state.single);
    }
    const one = filterValue(filters, 'eq', 'id'); const many = filterValue(filters, 'in', 'id'); const ids = Array.isArray(many) ? many : one ? [one] : [];
    if (!ids.length) return ok(state.single ? null : [], state.single, 0);
    const payload = await apiFetch<{ data: any[] }>(`/api/social/profiles?ids=${encodeURIComponent(ids.slice(0, 90).join(','))}`);
    return ok(state.single ? (payload.data[0] ?? null) : payload.data, state.single);
  } catch (e: any) { return fail(e?.message || 'Profile query failed', state.single); }
}

async function executeBookReviewsQuery(state: any) {
  const filters = state.filters as Filter[]; const bookId = state.payload?.book_id ?? filterValue(filters, 'eq', 'book_id');
  try {
    if (state.mode === 'upsert' || state.mode === 'insert' || state.mode === 'update') {
      const payload = await apiFetch<{ data: any }>('/api/social/reviews', { method: 'POST', body: JSON.stringify({ book_id: bookId, rating: state.payload?.rating, content: state.payload?.content || '' }) });
      return ok(payload.data, state.single);
    }
    if (state.mode === 'delete') {
      const id = filterValue(filters, 'eq', 'id');
      const payload = await apiFetch<any>('/api/social/reviews', { method: 'DELETE', body: JSON.stringify({ id, book_id: bookId }) });
      return ok(payload, state.single);
    }
    if (!bookId) return ok(state.single ? null : [], state.single, 0);
    const payload = await apiFetch<{ data: any[] }>(`/api/social/reviews?book_id=${encodeURIComponent(String(bookId))}`);
    return ok(state.single ? (payload.data[0] ?? null) : payload.data, state.single);
  } catch (e: any) { return fail(e?.message || 'Review query failed', state.single); }
}

async function executeReviewUpvotesQuery(state: any) {
  const filters = state.filters as Filter[]; const reviewId = state.payload?.review_id ?? filterValue(filters, 'eq', 'review_id');
  try {
    if (state.mode === 'insert' || state.mode === 'delete') {
      const payload = await apiFetch<any>('/api/social/review-upvote', { method: 'POST', body: JSON.stringify({ review_id: reviewId, active: state.mode === 'insert' }) });
      return ok(payload, state.single);
    }
    const ids = filterValue(filters, 'in', 'review_id'); if (!Array.isArray(ids) || !ids.length) return ok([], state.single, 0);
    const payload = await apiFetch<{ data: any[] }>(`/api/social/review-upvotes?ids=${encodeURIComponent(ids.slice(0, 90).join(','))}`);
    return ok(payload.data, state.single);
  } catch (e: any) { return fail(e?.message || 'Upvote query failed', state.single); }
}

async function executeCommentsQuery(state: any) {
  const filters = state.filters as Filter[]; const bookId = state.payload?.book_id ?? filterValue(filters, 'eq', 'book_id');
  try {
    if (state.mode === 'insert') {
      const payload = await apiFetch<{ data: any }>('/api/social/comments', { method: 'POST', body: JSON.stringify({ book_id: bookId, parent_comment_id: state.payload?.parent_comment_id ?? null, content: state.payload?.content || '' }) });
      return ok(payload.data, state.single);
    }
    if (!bookId) return ok(state.single ? null : [], state.single, 0);
    const payload = await apiFetch<{ data: any[] }>(`/api/social/comments?book_id=${encodeURIComponent(String(bookId))}`);
    return ok(state.single ? (payload.data[0] ?? null) : payload.data, state.single);
  } catch (e: any) { return fail(e?.message || 'Comment query failed', state.single); }
}

async function executeReactionsQuery(state: any) {
  const filters = state.filters as Filter[]; const commentId = state.payload?.comment_id ?? filterValue(filters, 'eq', 'comment_id'); const type = state.payload?.type ?? filterValue(filters, 'eq', 'type'); const bookId = state.payload?.book_id;
  try {
    if (state.mode === 'insert' || state.mode === 'delete') {
      const payload = await apiFetch<any>('/api/social/comment-reaction', { method: 'POST', body: JSON.stringify({ book_id: bookId, comment_id: commentId, type, active: state.mode === 'insert' }) });
      return ok(payload, state.single);
    }
    const ids = filterValue(filters, 'in', 'comment_id'); if (!Array.isArray(ids) || !ids.length) return ok([], state.single, 0);
    const payload = await apiFetch<{ data: any[] }>(`/api/social/reactions?comment_ids=${encodeURIComponent(ids.slice(0, 90).join(','))}`);
    return ok(payload.data, state.single);
  } catch (e: any) { return fail(e?.message || 'Reaction query failed', state.single); }
}

async function executeHabitEntriesQuery(state: any) {
  const filters = state.filters as Filter[]; const bookId = state.payload?.book_id ?? filterValue(filters, 'eq', 'book_id');
  try {
    if (state.mode === 'upsert' || state.mode === 'insert' || state.mode === 'update') {
      const payload = await apiFetch<any>('/api/habits', { method: 'POST', body: JSON.stringify(state.payload) });
      return ok(payload, state.single);
    }
    if (!bookId) return ok([], state.single, 0);
    const payload = await apiFetch<{ data: any[] }>(`/api/habits?book_id=${encodeURIComponent(String(bookId))}`);
    return ok(payload.data, state.single);
  } catch (e: any) { return fail(e?.message || 'Habit query failed', state.single); }
}

async function executeBookNotesQuery(state: any) {
  const filters = state.filters as Filter[]; const bookId = state.payload?.book_id ?? filterValue(filters, 'eq', 'book_id');
  try {
    if (state.mode === 'insert') {
      const payload = await apiFetch<{ data: any }>('/api/notes', { method: 'POST', body: JSON.stringify({ book_id: bookId, content: state.payload?.content || '' }) });
      return ok(payload.data, state.single);
    }
    if (state.mode === 'delete') {
      const id = filterValue(filters, 'eq', 'id'); const payload = await apiFetch<any>('/api/notes', { method: 'DELETE', body: JSON.stringify({ id }) }); return ok(payload, state.single);
    }
    const payload = await apiFetch<{ data: any[] }>(bookId ? `/api/notes?book_id=${encodeURIComponent(String(bookId))}` : '/api/notes');
    const rows = bookId ? payload.data : payload.data.map((r: any) => ({ ...r, books: r.slug ? { slug: r.slug, title: r.title, author: r.author } : null }));
    return ok(state.single ? (rows[0] ?? null) : rows, state.single);
  } catch (e: any) { return fail(e?.message || 'Notes query failed', state.single); }
}

async function executeCloudflareQuery(table: string, state: any) {
  if (table === 'admin_book_catalog' || table === 'books_admin') return executeAdminBooksQuery(table, state);
  if (table === 'books') return executeBooksQuery(state);
  if (table === 'book_assets') return executeBookAssetsAdminQuery(state);
  if (table === 'admin_access_logs') return executeAdminAccessLogQuery(state);
  if (table === 'library') return executeLibraryQuery(state);
  if (table === 'reading_progress') return executeReadingProgressQuery(state);
  if (table === 'profiles') return executeProfilesQuery(state);
  if (table === 'book_reviews') return executeBookReviewsQuery(state);
  if (table === 'review_upvotes') return executeReviewUpvotesQuery(state);
  if (table === 'comments') return executeCommentsQuery(state);
  if (table === 'reactions') return executeReactionsQuery(state);
  if (table === 'habit_entries') return executeHabitEntriesQuery(state);
  if (table === 'book_notes') return executeBookNotesQuery(state);
  return { data: state.single ? null : [], error: disabledError, count: 0, status: 503, statusText: 'Supabase disabled' };
}

function mediaUrl(bucketName: string, path: string) {
  const kind = bucketName === 'book-covers' ? 'covers' : 'assets';
  const safePath = path.split('/').map((part) => encodeURIComponent(part)).join('/');
  const origin = configuredApiBase || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}/media/${kind}/${safePath}`;
}

function makeCloudflareStorageBucket(bucketName: string) {
  const supported = bucketName === 'book-covers' || bucketName === 'book-assets';
  const kind = bucketName === 'book-covers' ? 'covers' : 'assets';
  const upload = async (path: string, file: File) => {
    if (!supported) return { data: null, error: disabledError };
    try {
      const form = new FormData();
      form.set('path', path);
      form.set('file', file);
      const payload = await apiFetch<{ data: { path: string; publicUrl: string } }>(`/api/admin/storage/${kind}`, { method: 'POST', body: form });
      return { data: { path: payload.data.path }, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message || 'Upload failed' } };
    }
  };
  return {
    upload,
    update: upload,
    remove: async () => ({ data: null, error: disabledError }),
    list: async () => ({ data: [], error: disabledError }),
    download: async () => ({ data: null, error: disabledError }),
    getPublicUrl: (path: string) => ({ data: { publicUrl: supported ? mediaUrl(bucketName, path) : '' } }),
    createSignedUrl: async (path: string) => supported
      ? ({ data: { signedUrl: mediaUrl(bucketName, path) }, error: null })
      : ({ data: null, error: disabledError }),
  };
}

function makeDisabledSupabase() {
  const channel = { on() { return channel; }, subscribe() { return channel; }, unsubscribe() { return Promise.resolve('ok'); } };
  return {
    from: (table: string) => makeCloudflareQuery(table),
    rpc: async (name: string, args?: any) => {
      if (name === 'get_premium_summary' && args?.p_book_id) {
        try { const payload = await apiFetch<{ data: any }>(`/api/premium-summary/${encodeURIComponent(String(args.p_book_id))}`); return { data: [payload.data], error: null }; }
        catch (e: any) { return { data: null, error: { message: e?.message || 'Premium data unavailable' } }; }
      }
      return { data: null, error: disabledError };
    },
    functions: { invoke: async () => ({ data: null, error: disabledError }) },
    storage: { from: (bucketName: string) => makeCloudflareStorageBucket(bucketName) },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }), getUser: async () => ({ data: { user: null }, error: null }), signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: disabledError }), signUp: async () => ({ data: { user: null, session: null }, error: disabledError }),
      signInWithOAuth: async () => ({ data: null, error: disabledError }), exchangeCodeForSession: async () => ({ data: { user: null, session: null }, error: disabledError }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    channel: () => channel, removeChannel: async () => 'ok',
  } as any;
}

if (!isSupabaseConfigured && !isCloudflareBackend) throw new Error('Booknomics configuration missing: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');

export const supabase: any = isCloudflareBackend
  ? makeDisabledSupabase()
  : isSupabaseConfigured
    ? createClient<Database>(configuredUrl!, configuredKey!, { auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce', detectSessionInUrl: true } })
    : makeDisabledSupabase();
