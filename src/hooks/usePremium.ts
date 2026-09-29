import { useTier } from "@/hooks/useTier";

/**
 * Premium access is derived from the real subscription tier resolved
 * server-side (my_active_tier RPC). Never trust client-only flags.
 */
export function usePremium() {
  const { isPremium, tier, loading, refresh } = useTier();
  return {
    isPremium,
    plan: tier === "free" ? null : tier,
    loading,
    refresh,
  };
}
