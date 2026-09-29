import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Share2, Sparkles, Users, Award, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";

const GOAL = 3;

export default function Referrals() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    (async () => {
      setLoading(true);
      const { data: p } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user.id)
        .maybeSingle();
      setCode((p as any)?.referral_code || null);
      const { count: c } = await supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_user_id", user.id);
      setCount(c || 0);
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  const link = code ? `${window.location.origin}/auth?ref=${code}` : "";
  const badge = count >= GOAL;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
  };
  const share = async () => {
    const text = `I'm reading book summaries that actually change how I act. Join me on Booknomics → ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: "Booknomics", text, url: link });
      else { await navigator.clipboard.writeText(text); toast.success("Invite copied"); }
    } catch {}
  };

  if (loading) {
    return <Layout><div className="container py-16 text-center"><Loader2 className="w-6 h-6 animate-spin inline" /></div></Layout>;
  }

  return (
    <Layout>
      <SEO title="Refer friends — Booknomics" description="Invite friends and earn a Premium reader badge." canonical="https://booknomics.com/referrals" noindex />
      <div className="container max-w-2xl py-10 md:py-14">
        <div className="text-center mb-8">
          <div className="bg-gold h-14 w-14 rounded-2xl grid place-items-center mx-auto mb-4 shadow-cover">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">Refer 3 friends, earn a Premium Reader badge</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">Share your link. When 3 friends sign up, the badge unlocks on your profile.</p>
        </div>

        <Card className="p-5 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Users className="w-4 h-4" /> Signups so far</span>
            <span className="font-semibold tabular-nums">{Math.min(count, GOAL)} / {GOAL}</span>
          </div>
          <Progress value={Math.min((count / GOAL) * 100, 100)} className="h-2" />
          {badge ? (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-sm">
              <Award className="w-5 h-5 text-amber-500" />
              <span><strong>Premium Reader Badge unlocked.</strong> Thank you for spreading the word.</span>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              {GOAL - count} more {GOAL - count === 1 ? "signup" : "signups"} until your badge unlocks.
            </p>
          )}
        </Card>

        <Card className="p-5 md:p-6 mb-6">
          <label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Your invite link</label>
          <div className="mt-2 flex gap-2 flex-wrap">
            <input
              readOnly
              value={link}
              className="flex-1 min-w-0 px-3 py-2 rounded-md border border-border bg-background text-sm font-mono"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button onClick={copy} variant="outline" className="gap-1.5"><Copy className="w-4 h-4" /> Copy</Button>
            <Button onClick={share} className="gap-1.5"><Share2 className="w-4 h-4" /> Share</Button>
          </div>
          {code && <p className="text-xs text-muted-foreground mt-3">Your code: <span className="font-mono font-semibold">{code}</span></p>}
        </Card>

        <div className="text-center">
          <Link to="/library" className="text-sm text-primary hover:underline">← Back to your library</Link>
        </div>
      </div>
    </Layout>
  );
}
