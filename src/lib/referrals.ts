import { apiFetch } from "@/lib/cloudflareApi";
import { isPersonalSupabaseEnabled, personalSupabase } from '@/lib/personalSupabase';

const KEY = "bn_ref_code";

export function capturePendingReferral() {
  if (typeof window === "undefined") return;
  try {
    const u = new URL(window.location.href);
    const code = u.searchParams.get("ref");
    if (code && /^[A-Z0-9]{4,16}$/i.test(code)) {
      localStorage.setItem(KEY, code.toUpperCase());
    }
  } catch {}
}

export function getPendingReferral(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function clearPendingReferral() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

/** Records a pending referral using the currently selected, authenticated backend. */
export async function recordReferralIfPending() {
  const code = getPendingReferral();
  if (!code) return;
  try {
    if (isPersonalSupabaseEnabled) {
      if (!personalSupabase) return;
      const { error } = await personalSupabase.rpc('booknomics_claim_referral', { p_code: code });
      if (error) return; // Preserve attribution until the SQL/RPC is ready.
      clearPendingReferral();
      return;
    }
    await apiFetch<{ ok: boolean; claimed: boolean }>("/api/referrals/claim", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    clearPendingReferral();
  } catch {
    // Referral attribution must never block sign-in. The D1 unique constraint
    // keeps repeated claims idempotent for users who already have a referrer.
  }
}
