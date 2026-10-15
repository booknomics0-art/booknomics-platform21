import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const backend = (import.meta.env.VITE_DATA_BACKEND || 'supabase').trim().toLowerCase();
export const isCloudflareBackend = backend === 'cloudflare';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const SUPABASE_URL = configuredUrl || '';
export const SUPABASE_KEY = configuredKey || '';
export const isSupabaseConfigured = Boolean(configuredUrl && configuredKey);

const disabledMessage = 'Supabase runtime is disabled while Booknomics is using the Cloudflare backend.';
const disabledError = { message: disabledMessage };

function makeDisabledQuery() {
  const result = { data: null, error: disabledError, count: 0, status: 503, statusText: 'Supabase disabled' };
  let proxy: any;
  proxy = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject);
      }
      if (prop === 'catch') return (reject: (reason: unknown) => unknown) => Promise.resolve(result).catch(reject);
      if (prop === 'finally') return (handler: () => void) => Promise.resolve(result).finally(handler);
      return () => proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
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
    from: () => makeDisabledQuery(),
    rpc: async () => ({ data: null, error: disabledError }),
    functions: {
      invoke: async () => ({ data: null, error: disabledError }),
    },
    storage: {
      from: () => storageBucket,
    },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: disabledError }),
      signUp: async () => ({ data: { user: null, session: null }, error: disabledError }),
      signInWithOAuth: async () => ({ data: null, error: disabledError }),
      exchangeCodeForSession: async () => ({ data: { user: null, session: null }, error: disabledError }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
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
