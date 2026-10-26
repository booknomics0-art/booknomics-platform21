import { useCallback, useEffect, useState } from "react";
import { apiFetch, normalizeUser, type CloudflareUser } from "@/lib/cloudflareApi";
import { asBooknomicsUser, isPersonalSupabaseEnabled, personalSupabase } from '@/lib/personalSupabase';

export function useAuth() {
  const [user, setUser] = useState<CloudflareUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      if (isPersonalSupabaseEnabled) {
        if (!personalSupabase) throw new Error('Supabase authentication is not configured');
        const { data, error } = await personalSupabase.auth.getUser();
        if (error) throw error;
        setUser(asBooknomicsUser(data.user));
        return;
      }
      const data = await apiFetch<{ user: Omit<CloudflareUser, "user_metadata"> | null }>("/api/auth/session");
      setUser(normalizeUser(data.user));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (isPersonalSupabaseEnabled && personalSupabase) {
      const { data } = personalSupabase.auth.onAuthStateChange((_event, session) => {
        setUser(asBooknomicsUser(session?.user || null));
        setLoading(false);
      });
      return () => data.subscription.unsubscribe();
    }
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      if (isPersonalSupabaseEnabled) {
        if (!personalSupabase) throw new Error('Supabase authentication is not configured');
        const { error } = await personalSupabase.auth.signOut();
        if (error) throw error;
      } else {
        await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
      }
    } finally {
      setUser(null);
    }
  }, []);

  return { user, loading, signOut, refresh };
}
