import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck } from "lucide-react";
import { SEO } from "@/components/SEO";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "this app";

  return (
    <Layout>
      <SEO title="Authorize app — Booknomics" description="Authorize an app to access your Booknomics account." noindex />
      <div className="container max-w-md py-16">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-paper">
          <div className="bg-gold h-12 w-12 rounded-xl grid place-items-center mb-4">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          {error ? (
            <>
              <h1 className="font-serif text-2xl font-bold">Authorization failed</h1>
              <p className="text-muted-foreground mt-2 text-sm">{error}</p>
            </>
          ) : !details ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <>
              <h1 className="font-serif text-2xl font-bold">Connect {clientName} to your account</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                {clientName} will be able to search Booknomics summaries and read or update your personal library on your
                behalf. If your account is an administrator, it can also edit public book content. You can revoke access at any time.
              </p>
              <div className="mt-6 flex gap-3">
                <Button
                  onClick={() => decide(true)}
                  disabled={busy}
                  className="flex-1 rounded-full bg-gold text-primary-foreground hover:opacity-90"
                >
                  Approve
                </Button>
                <Button onClick={() => decide(false)} disabled={busy} variant="outline" className="flex-1 rounded-full">
                  Deny
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
