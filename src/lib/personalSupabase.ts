import { createClient, type User } from '@supabase/supabase-js';
import type { CloudflareUser } from '@/lib/cloudflareApi';

// Separate from VITE_DATA_BACKEND: public book content must stay on Cloudflare.
export const isPersonalSupabaseEnabled =
  (import.meta.env.VITE_AUTH_BACKEND || 'cloudflare').trim().toLowerCase() === 'supabase';
export const isPersonalBillingEnabled = isPersonalSupabaseEnabled && import.meta.env.VITE_SUPABASE_BILLING_ENABLED === 'true';

const authUrl = (import.meta.env.VITE_AUTH_SUPABASE_URL || '').trim();
const authKey = (import.meta.env.VITE_AUTH_SUPABASE_PUBLISHABLE_KEY || '').trim();

export const personalSupabase = isPersonalSupabaseEnabled && authUrl && authKey
  ? createClient(authUrl, authKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'booknomics-new-supabase-auth',
    },
  })
  : null;

export function asBooknomicsUser(user: User | null): CloudflareUser | null {
  if (!user) return null;
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || null;
  const avatar = user.user_metadata?.avatar_url || null;
  return {
    id: user.id,
    email: user.email || '',
    display_name: typeof fullName === 'string' ? fullName : null,
    avatar_url: typeof avatar === 'string' ? avatar : null,
    user_metadata: {
      name: typeof fullName === 'string' ? fullName : undefined,
      full_name: typeof fullName === 'string' ? fullName : undefined,
      avatar_url: typeof avatar === 'string' ? avatar : undefined,
    },
  };
}

export async function personalBillingFetch<T>(
  action: 'subscribe' | 'confirm' | 'manage' | 'subscription',
  init: RequestInit = {},
): Promise<T> {
  if (!isPersonalBillingEnabled || !personalSupabase || !authUrl || !authKey) {
    throw new Error('The new billing service is not enabled');
  }
  const { data, error } = await personalSupabase.auth.getSession();
  if (error || !data.session) throw new Error('Sign in again before managing billing');
  const response = await fetch(`${authUrl.replace(/\/$/, '')}/functions/v1/booknomics-billing/${action}`, {
    ...init,
    method: init.method || (action === 'subscription' ? 'GET' : 'POST'),
    headers: {
      accept: 'application/json',
      apikey: authKey,
      authorization: `Bearer ${data.session.access_token}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Billing is unavailable');
  return payload as T;
}
