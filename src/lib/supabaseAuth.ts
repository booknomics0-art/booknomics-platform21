import { createClient } from '@supabase/supabase-js';

// Auth is deliberately independent of VITE_DATA_BACKEND. The book catalog,
// library and all media continue using Cloudflare even when Auth uses Supabase.
const mode = (import.meta.env.VITE_AUTH_BACKEND || 'cloudflare').trim().toLowerCase();
const url = (import.meta.env.VITE_AUTH_SUPABASE_URL || '').trim();
const key = (import.meta.env.VITE_AUTH_SUPABASE_PUBLISHABLE_KEY || '').trim();

export const isSupabaseAuthBackend = mode === 'supabase';

export const supabaseAuthClient = isSupabaseAuthBackend && url && key
  ? createClient(url, key, {
      auth: {
        storageKey: 'booknomics-auth-billing-v1',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;

let pendingBridge: { token: string; request: Promise<unknown> } | null = null;
let lastBridge: { token: string; user: unknown; at: number } | null = null;

export function clearCloudflareAuthCache() {
  lastBridge = null;
  pendingBridge = null;
}

export async function connectCloudflareSession(accessToken: string) {
  if (!supabaseAuthClient || !accessToken) throw new Error('Supabase Auth is not configured');
  if (lastBridge?.token === accessToken && Date.now() - lastBridge.at < 5000) return lastBridge.user;
  if (pendingBridge?.token === accessToken) return pendingBridge.request;
  const request = (async () => {
    const response = await fetch(`${(import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')}/api/auth/supabase/session`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    });
    const payload = await response.json().catch(() => null) as { user?: unknown; error?: string } | null;
    if (!response.ok) throw new Error(payload?.error || 'Unable to connect your Booknomics session');
    lastBridge = { token: accessToken, user: payload?.user, at: Date.now() };
    return payload?.user;
  })();
  pendingBridge = { token: accessToken, request };
  try { return await request; }
  finally { if (pendingBridge?.request === request) pendingBridge = null; }
}
