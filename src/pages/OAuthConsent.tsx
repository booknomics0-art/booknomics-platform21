import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/cloudflareApi";
import { ShieldCheck } from "lucide-react";
import { SEO } from "@/components/SEO";

type AuthorizationDetails = {
  id: string;
  client_id: string;
  client_name: string;
  redirect_uri: string;
  scope: string;
  resource: string;
  expires_at: string;
};

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      try {
        const session = await apiFetch<{ user: { id: string } | null }>("/api/auth/session");
        if (!session.user) {
          const next = window.location.pathname + window.location.search;
          window.location.href = "/auth?next=" + encodeURIComponent(next);
          return;
        }
        const payload = await apiFetch<{ data: AuthorizationDetails }>(
          `/api/oauth/authorizations/${encodeURIComponent(authorizationId)}`,
        );
        if (active) setDetails(payload.data);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Authorization request failed");
      }
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(decision: "approve" | "deny") {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ redirect_url: string }>(
        `/api/oauth/authorizations/${encodeURIComponent(authorizationId)}/decision`,
        { method: "POST", body: JSON.stringify({ decision }) },
      );
      if (!data.redirect_url) throw new Error("No redirect returned by the authorization server.");
      window.location.href = data.redirect_url;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Authorization request failed");
    }
  }

  const requestedScopes = details?.scope?.split(/\s+/).filter(Boolean) ?? [];
  const canAdmin = requestedScopes.includes("mcp:admin");

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
              <h1 className="font-serif text-2xl font-bold">Connect {details.client_name || "this app"} to your account</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                This app is requesting delegated access to Booknomics through our Cloudflare-hosted OAuth 2.1 server.
                Access is limited to the permissions shown below and can be revoked by invalidating the OAuth token.
              </p>
              <div className="mt-5 rounded-xl border border-border bg-muted/20 p-4 text-sm space-y-2">
                {requestedScopes.includes("mcp:read") && <div>• Search summaries and read your saved library.</div>}
                {requestedScopes.includes("mcp:write") && <div>• Add books to your personal library.</div>}
                {canAdmin && <div className="font-medium text-amber-700 dark:text-amber-300">• Use administrator publishing and generation tools if your Booknomics account is an admin.</div>}
              </div>
              <div className="mt-6 flex gap-3">
                <Button
                  onClick={() => decide("approve")}
                  disabled={busy}
                  className="flex-1 rounded-full bg-gold text-primary-foreground hover:opacity-90"
                >
                  {busy ? "Authorizing…" : "Approve"}
                </Button>
                <Button onClick={() => decide("deny")} disabled={busy} variant="outline" className="flex-1 rounded-full">
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
