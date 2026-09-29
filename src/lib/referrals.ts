import { supabase } from "@/integrations/supabase/client";

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

/** Records a referral for the freshly-signed-up user, if a pending code exists. */
export async function recordReferralIfPending(referredUserId: string) {
  const code = getPendingReferral();
  if (!code) return;
  try {
    const { data: refProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!refProfile || refProfile.id === referredUserId) {
      clearPendingReferral();
      return;
    }
    await supabase.from("referrals").insert({
      referrer_user_id: refProfile.id,
      referred_user_id: referredUserId,
    });
  } catch {
    // ignore; unique constraint will prevent dupes
  } finally {
    clearPendingReferral();
  }
}
