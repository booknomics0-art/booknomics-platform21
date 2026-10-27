import { apiFetch } from "@/lib/cloudflareApi";
import { isPersonalSupabaseEnabled, personalSupabase } from '@/lib/personalSupabase';

/** The Cloudflare Worker checks the signed-in session against its private role table. */
export async function isAdminUser(): Promise<boolean> {
  if (isPersonalSupabaseEnabled) {
    if (!personalSupabase) return false;
    const { data, error } = await personalSupabase.rpc('booknomics_is_admin');
    if (error) return false;
    return data === true;
  }
  const data = await apiFetch<{ isAdmin: boolean }>("/api/me/admin");
  return data.isAdmin === true;
}
