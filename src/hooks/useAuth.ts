import { useCallback, useEffect, useState } from "react";
import { apiFetch, normalizeUser, type CloudflareUser } from "@/lib/cloudflareApi";
import { clearCloudflareAuthCache, connectCloudflareSession, isSupabaseAuthBackend, supabaseAuthClient } from "@/lib/supabaseAuth";

export function useAuth() {
  const [user, setUser] = useState<CloudflareUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      if (isSupabaseAuthBackend) {
        if (!supabaseAuthClient) throw new Error('Supabase authentication is not configured');
        const { data, error } = await supabaseAuthClient.auth.getSession();
        if (error || !data.session) {
          setUser(null);
          return;
        }
        const cloudflare = await apiFetch<{ user: Omit<CloudflareUser, "user_metadata"> | null }>("/api/auth/session").catch(() => ({ user: null }));
        if (cloudflare.user?.id === data.session.user.id) {
          setUser(normalizeUser(cloudflare.user));
          return;
        }
        const verified = await connectCloudflareSession(data.session.access_token);
        setUser(normalizeUser(verified as Omit<CloudflareUser, "user_metadata"> | null));
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
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      if (isSupabaseAuthBackend && supabaseAuthClient) await supabaseAuthClient.auth.signOut();
    } finally {
      try {
        await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
      } finally {
        clearCloudflareAuthCache();
        setUser(null);
      }
    }
  }, []);

  return { user, loading, signOut, refresh };
}
