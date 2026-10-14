import { useCallback, useEffect, useState } from "react";
import { apiFetch, normalizeUser, type CloudflareUser } from "@/lib/cloudflareApi";

export function useAuth() {
  const [user, setUser] = useState<CloudflareUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
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
      await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }, []);

  return { user, loading, signOut, refresh };
}
