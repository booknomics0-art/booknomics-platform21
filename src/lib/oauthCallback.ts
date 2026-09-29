import { supabase } from "@/integrations/supabase/client";
import { recordReferralIfPending } from "@/lib/referrals";
let completion: Promise<boolean> | null = null;
export function completeOAuthRedirect(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (!completion) completion = (async () => {
    // The PKCE exchange is performed once by supabase-js during initialization.
    // Never import bearer tokens supplied in query parameters by a third party.
    const isCallback = new URLSearchParams(window.location.search).has('code');
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return false;
    if (isCallback && data.session.user) await recordReferralIfPending(data.session.user.id);
    return true;
  })();
  return completion;
}
