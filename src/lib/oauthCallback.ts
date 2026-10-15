import { apiFetch, type CloudflareUser } from "@/lib/cloudflareApi";
import { recordReferralIfPending } from "@/lib/referrals";

let completion: Promise<boolean> | null = null;

export function completeOAuthRedirect(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!completion) completion = (async () => {
    try {
      const { user } = await apiFetch<{ user: Omit<CloudflareUser, "user_metadata"> | null }>("/api/auth/session");
      if (!user) return false;
      await recordReferralIfPending();
      return true;
    } catch {
      return false;
    }
  })();
  return completion;
}
