import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";
import { trackLogin, trackSignup } from "@/lib/analytics";
import { SEO } from "@/components/SEO";
import { apiFetch, apiRawFetch, googleSignInUrl, type CloudflareUser } from "@/lib/cloudflareApi";
import { recordReferralIfPending } from "@/lib/referrals";

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewBackendMissing, setPreviewBackendMissing] = useState(false);

  const rawNext = params.get("next") ?? "";
  const next = safeRedirectPath(rawNext);
  const afterAuth = next || "/";

  useEffect(() => {
    document.title = "Sign in — Booknomics";
    let cancelled = false;

    (async () => {
      try {
        const response = await apiRawFetch("/api/auth/session");
        if (response.status === 404 && window.location.hostname.endsWith(".vercel.app")) {
          if (!cancelled) setPreviewBackendMissing(true);
          return;
        }
        if (!response.ok) return;
        const data = await response.json() as { user: Omit<CloudflareUser, "user_metadata"> | null };
        if (!cancelled && data.user) {
          await recordReferralIfPending();
          navigate(afterAuth, { replace: true });
        }
      } catch {
        // Signed-out state is valid on the auth page.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [afterAuth, navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewBackendMissing) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        await apiFetch<{ user: Omit<CloudflareUser, "user_metadata"> }>("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({ email, password, name }),
        });
        trackSignup("email");
        toast.success("Account created successfully");
      } else {
        await apiFetch<{ user: Omit<CloudflareUser, "user_metadata"> }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        trackLogin("email");
        toast.success("Welcome back");
      }
      await recordReferralIfPending();
      navigate(afterAuth, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (previewBackendMissing) return;
    setLoading(true);
    try {
      // Static Vercel previews do not host the Cloudflare Worker auth routes.
      // Check availability before navigating away to a dead OAuth URL.
      const response = await apiRawFetch("/api/auth/session");
      if (response.status === 404 && window.location.hostname.endsWith(".vercel.app")) {
        setPreviewBackendMissing(true);
        toast.error("This preview has no authentication backend. Use an isolated Cloudflare staging deployment to test sign-in.");
        return;
      }
      if (!response.ok) throw new Error("Authentication service is unavailable");
      trackLogin("google");
      const authReturn = `/auth?next=${encodeURIComponent(afterAuth)}`;
      window.location.href = googleSignInUrl(authReturn);
    } catch {
      toast.error("Could not reach the authentication service. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <SEO
        title="Sign In — Booknomics"
        description="Sign in to Booknomics."
        canonical="https://booknomics.com/auth"
        noindex
      />
      <div className="container max-w-md py-16">
        <div className="text-center mb-8">
          <div className="bg-gold h-14 w-14 rounded-2xl grid place-items-center mx-auto mb-4 shadow-cover">
            <BookOpen className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-serif text-4xl font-bold tracking-tight">{mode === "signin" ? "Welcome back" : "Begin reading"}</h1>
          <p className="text-muted-foreground mt-2">{mode === "signin" ? "Sign in to your library" : "Create your free account"}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-paper">
          {previewBackendMissing && (
            <p role="alert" className="mb-5 rounded-lg border border-amber-300/50 bg-amber-100/50 p-3 text-sm text-foreground">
              This Vercel preview shows the interface only. Sign-in and account data need the Cloudflare Worker backend, which is not deployed on this preview. No account changes were made.
            </p>
          )}
          <Button disabled={loading || previewBackendMissing} onClick={handleGoogle} variant="outline" className="w-full rounded-full gap-2" size="lg">
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />OR<div className="h-px flex-1 bg-border" /></div>

          <form onSubmit={handleEmail} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required className="mt-1.5" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="mt-1.5" />
            </div>
            <Button type="submit" disabled={loading || previewBackendMissing} className="w-full bg-gold text-primary-foreground hover:opacity-90 rounded-full" size="lg">
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-primary font-medium hover:underline">
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Auth;
