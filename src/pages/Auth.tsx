import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";
import { trackLogin, trackSignup } from "@/lib/analytics";
import { SEO } from "@/components/SEO";
import { recordReferralIfPending } from "@/lib/referrals";
import { completeOAuthRedirect } from "@/lib/oauthCallback";

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // Same-origin relative path to return to after auth (used by the OAuth consent flow).
  const rawNext = params.get("next") ?? "";
  const next = safeRedirectPath(rawNext);
  const afterAuth = next || "/";
  // Always return through the auth page so OAuth/email-confirmation callbacks
  // are completed in one predictable place before continuing to the target page.
  const returnUrl = `${window.location.origin}/auth?next=${encodeURIComponent(afterAuth)}`;

  useEffect(() => {
    document.title = "Sign in — Booknomics";

    const errorMessage = params.get("error_description") || params.get("error");
    if (errorMessage) {
      toast.error(errorMessage);
    }

    let cancelled = false;
    (async () => {
      try {
        await completeOAuthRedirect();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!cancelled && data.session?.user) {
          await recordReferralIfPending(data.session.user.id);
          navigate(afterAuth, { replace: true });
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Could not complete sign in");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [afterAuth, navigate, params]);


  const sendWelcomeWebhook = async (u: { email?: string | null; user_metadata?: any } | null) => {
    if (!u?.email) return;
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) return;
      await fetch(
        `${SUPABASE_URL}/functions/v1/welcome-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: u.email,
            name: u.user_metadata?.name || u.user_metadata?.full_name || u.email.split("@")[0],
          }),
        }
      );
    } catch (error) {
      console.error("Welcome email webhook failed:", error);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: returnUrl, data: { display_name: name } },
      });
      if (error) toast.error(error.message);
      else {
        trackSignup("email");

        // If email confirmation is disabled, Supabase returns a session immediately.
        // Otherwise the callback through /auth will finish referral/welcome handling.
        if (data.session?.user) {
          await recordReferralIfPending(data.session.user.id);
          await sendWelcomeWebhook(data.session.user);
          toast.success("Account created successfully");
          navigate(afterAuth, { replace: true });
          return;
        }

        toast.success("Check your email to confirm your account");
      }

    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else {
        trackLogin("email");
        if (data.user) {
          await recordReferralIfPending(data.user.id);
        }
        toast.success("Welcome back");
        if (next) window.location.href = next;
        else navigate("/");
      }
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: returnUrl,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
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
          <Button disabled={loading} onClick={handleGoogle} variant="outline" className="w-full rounded-full gap-2" size="lg">
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
              <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="mt-1.5" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gold text-primary-foreground hover:opacity-90 rounded-full" size="lg">
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
