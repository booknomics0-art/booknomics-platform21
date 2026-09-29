import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
    if (!user) { setDbTier("free"); setLoading(false); return; }
    const { data } = await supabase.rpc("my_active_tier");
    setDbTier(((data as Tier) ?? "free") as Tier);
    setLoading(false);
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
