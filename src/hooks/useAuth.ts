import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { completeOAuthRedirect } from "@/lib/oauthCallback";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    (async () => {
      // Complete any in-flight OAuth redirect (e.g. "Continue with Google")
      // before reading the session, so the user isn't shown as signed out.
      try {
        await completeOAuthRedirect();
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user ?? null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading, signOut: () => supabase.auth.signOut() };
}
