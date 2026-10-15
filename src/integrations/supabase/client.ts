import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { apiFetch } from '@/lib/cloudflareApi';

const backend = (import.meta.env.VITE_DATA_BACKEND || 'supabase').trim().toLowerCase();
export const isCloudflareBackend = backend === 'cloudflare';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const SUPABASE_URL = configuredUrl || '';
export const SUPABASE_KEY = configuredKey || '';
export const isSupabaseConfigured = Boolean(configuredUrl && configuredKey);

const disabledMessage = 'Supabase runtime is disabled while Booknomics is using the Cloudflare backend.';
const disabledError = { message: disabledMessage };

type Filter = { op: 'eq' | 'neq' | 'in' | 'not' | 'contains' | 'or'; field?: string; value: any; extra?: any };

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
  };

  const builder: any = {
    select(_columns?: string, options?: any) {
      state.mode = 'select';
      state.countRequested = options?.count === 'exact';
      return builder;
    },
    eq(field: string, value: any) { state.filters.push({ op: 'eq', field, value }); return builder; },
    neq(field: string, value: any) { state.filters.push({ op: 'neq', field, value }); return builder; },
    in(field: string, value: any[]) { state.filters.push({ op: 'in', field, value }); return builder; },
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

async function executeBooksQuery(state: any) {
  const filters = state.filters as Filter[];
  const slug = filterValue(filters, 'eq', 'slug') ?? filterValue(filters, 'eq', 'seo_slug');
  if (slug) {
    try {
      const payload = await apiFetch<{ data: any }>(`/api/books/${encodeURIComponent(String(slug))}`);
      return { data: state.single ? payload.data : [payload.data], error: null, count: payload.data ? 1 : 0 };
    } catch (error: any) {
      if (/404|not found/i.test(error?.message || '')) return { data: state.single ? null : [], error: null, count: 0 };
      return { data: state.single ? null : [], error: { message: error?.message || 'Book query failed' }, count: 0 };
    }
  }

  const slugList = filterValue(filters, 'in', 'slug');
  if (Array.isArray(slugList) && slugList.length) {
    const rows = (await Promise.all(slugList.slice(0, 100).map(async (item) => {
      try { return (await apiFetch<{ data: any }>(`/api/books/${encodeURIComponent(String(item))}`)).data; }
      catch { return null; }
    }))).filter(Boolean);
    return { data: state.single ? (rows[0] ?? null) : rows, error: null, count: rows.length };
  }

  const language = filterValue(filters, 'eq', 'language');
  const category = filterValue(filters, 'eq', 'category');
  let q = '';
  const orFilter = filters.find((f) => f.op === 'or')?.value as string | undefined;
  if (orFilter) {
    const match = orFilter.match(/ilike\.%(.*?)%/i);
    if (match?.[1]) q = match[1].replace(/%/g, ' ').trim();
  }

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
    }
    return { data: state.single ? (rows[0] ?? null) : rows, error: null, count: state.countRequested ? payload.count : rows.length };
  } catch (error: any) {
    return { data: state.single ? null : [], error: { message: error?.message || 'Book query failed' }, count: 0 };
  }
}

async function executeLibraryQuery(state: any) {
  const filters = state.filters as Filter[];
  const bookId = filterValue(filters, 'eq', 'book_id') ?? state.payload?.book_id;
  if (!bookId) return { data: state.single ? null : [], error: disabledError, count: 0 };
  try {
    if (state.mode === 'insert') {
      const payload = await apiFetch<{ saved: boolean }>("/api/library/toggle", {
        method: 'POST', body: JSON.stringify({ book_id: bookId, saved: true }),
      });
      return { data: payload, error: null, count: 1 };
    }
    if (state.mode === 'delete') {
      const payload = await apiFetch<{ saved: boolean }>("/api/library/toggle", {
        method: 'POST', body: JSON.stringify({ book_id: bookId, saved: false }),
      });
      return { data: payload, error: null, count: 1 };
    }
    const payload = await apiFetch<{ saved: boolean }>(`/api/library/status?book_id=${encodeURIComponent(String(bookId))}`);
    const row = payload.saved ? { id: `saved:${bookId}` } : null;
    return { data: state.single ? row : (row ? [row] : []), error: null, count: row ? 1 : 0 };
  } catch (error: any) {
    return { data: state.single ? null : [], error: { message: error?.message || 'Library query failed' }, count: 0 };
  }
}

async function executeReadingProgressQuery(state: any) {
  const filters = state.filters as Filter[];
  const bookId = state.payload?.book_id ?? filterValue(filters, 'eq', 'book_id');
  if (!bookId || !['upsert', 'insert', 'update'].includes(state.mode)) {
    return { data: state.single ? null : [], error: disabledError, count: 0 };
  }
  try {
    const payload = await apiFetch<{ ok: boolean; completed: boolean }>("/api/reading-progress", {
      method: 'POST',
      body: JSON.stringify({ book_id: bookId, completed: Boolean(state.payload?.completed) }),
    });
    return { data: payload, error: null, count: 1 };
  } catch (error: any) {
    return { data: null, error: { message: error?.message || 'Progress update failed' }, count: 0 };
  }
}

async function executeCloudflareQuery(table: string, state: any) {
  if (table === 'books') return executeBooksQuery(state);
  if (table === 'library') return executeLibraryQuery(state);
  if (table === 'reading_progress') return executeReadingProgressQuery(state);
  return { data: state.single ? null : [], error: disabledError, count: 0, status: 503, statusText: 'Supabase disabled' };
}

function makeDisabledSupabase() {
  const storageBucket = {
    upload: async () => ({ data: null, error: disabledError }),
    update: async () => ({ data: null, error: disabledError }),
    remove: async () => ({ data: null, error: disabledError }),
    list: async () => ({ data: [], error: disabledError }),
    download: async () => ({ data: null, error: disabledError }),
    getPublicUrl: () => ({ data: { publicUrl: '' } }),
    createSignedUrl: async () => ({ data: null, error: disabledError }),
  };

  const channel = {
    on() { return channel; },
    subscribe() { return channel; },
    unsubscribe() { return Promise.resolve('ok'); },
  };

  return {
    from: (table: string) => makeCloudflareQuery(table),
    rpc: async () => ({ data: null, error: disabledError }),
    functions: { invoke: async () => ({ data: null, error: disabledError }) },
    storage: { from: () => storageBucket },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: disabledError }),
      signUp: async () => ({ data: { user: null, session: null }, error: disabledError }),
      signInWithOAuth: async () => ({ data: null, error: disabledError }),
      exchangeCodeForSession: async () => ({ data: { user: null, session: null }, error: disabledError }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    channel: () => channel,
    removeChannel: async () => 'ok',
  } as any;
}

if (!isSupabaseConfigured && !isCloudflareBackend) {
  throw new Error('Booknomics configuration missing: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

export const supabase: any = isSupabaseConfigured
  ? createClient<Database>(configuredUrl!, configuredKey!, {
      auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce', detectSessionInUrl: true },
    })
  : makeDisabledSupabase();
