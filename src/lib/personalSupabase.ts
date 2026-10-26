import { createClient, type User } from '@supabase/supabase-js';
import type { CloudflareUser } from '@/lib/cloudflareApi';

// Separate from VITE_DATA_BACKEND: public book content must stay on Cloudflare.
export const isPersonalSupabaseEnabled =
  (import.meta.env.VITE_AUTH_BACKEND || 'cloudflare').trim().toLowerCase() === 'supabase';

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
