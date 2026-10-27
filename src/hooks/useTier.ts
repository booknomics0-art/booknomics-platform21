import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/cloudflareApi";
import { isPersonalSupabaseEnabled, personalSupabase } from '@/lib/personalSupabase';

export type Tier = "free" | "weekly" | "monthly" | "quarterly";

const SIM_KEY = "bn_simulated_tier";

function readSimulated(): Tier | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const v = window.localStorage.getItem(SIM_KEY);
  if (v === "free" || v === "weekly" || v === "monthly" || v === "quarterly") return v;
  return null;
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

export function setSimulatedTier(tier: Tier | null) {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  if (tier) window.localStorage.setItem(SIM_KEY, tier);
  else window.localStorage.removeItem(SIM_KEY);
  notify();
}

export function useTier() {
  const { user, loading: authLoading } = useAuth();
  const [dbTier, setDbTier] = useState<Tier>("free");
  const [sim, setSim] = useState<Tier | null>(readSimulated());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setDbTier("free");
      setLoading(false);
      return;
    }
    try {
      if (isPersonalSupabaseEnabled) {
        if (!personalSupabase) throw new Error('Supabase authentication is not configured');
        const { data, error } = await personalSupabase.from('subscriptions')
          .select('plan,expires_at')
          .eq('user_id', user.id).eq('status', 'active')
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: false }).limit(1);
        if (error) throw error;
        const plan = data?.[0]?.plan;
        setDbTier(plan === 'weekly' || plan === 'monthly' ? plan : 'free');
        return;
      }
      const data = await apiFetch<{ tier: Tier }>("/api/me/tier");
      setDbTier(data.tier || "free");
    } catch {
      setDbTier("free");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const l = () => setSim(readSimulated());
    listeners.add(l);
    const storage = (e: StorageEvent) => { if (e.key === SIM_KEY) l(); };
    window.addEventListener("storage", storage);
    return () => { listeners.delete(l); window.removeEventListener("storage", storage); };
  }, []);

  useEffect(() => { if (!authLoading) refresh(); }, [authLoading, refresh]);

  const tier: Tier = sim ?? dbTier;
  const isPremium = tier !== "free";
  return { tier, dbTier, simulatedTier: sim, isPremium, loading: loading || authLoading, refresh };
}
