import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, BookOpen, Check, Crown, Headphones, ShieldCheck, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { apiFetch } from "@/lib/cloudflareApi";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { PLANS, SELLABLE_PLANS, type SellablePlan } from "@/lib/plans";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const existing = document.querySelector('script[data-bn-razorpay]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.setAttribute("data-bn-razorpay", "true");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const benefits = [
  "Full Hindi & English summary library",
  "Ad-free, distraction-free reading",
  "Book-specific action plans and interactive habit trackers",
  "Audio insights for supported books",
  "Progress, notes and personalised reading tools",
];

export default function Pricing() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isPremium, refresh } = useTier();
  const [selected, setSelected] = useState<SellablePlan>("monthly");
  const [consent, setConsent] = useState(false);
  const [paying, setPaying] = useState(false);
  const plan = PLANS[selected];

  useEffect(() => {
    document.title = "Affordable Premium Plans | Booknomics";
  }, []);

  const subscribe = async () => {
    if (!user) {
      toast.info("Sign in to choose your Premium plan");
      navigate("/auth");
      return;
    }
    if (isPremium) {
      navigate("/account/subscription");
      return;
    }
    if (!consent) {
      toast.error("Please accept the recurring billing terms first");
      return;
    }
    if (paying) return;
    setPaying(true);
    try {
      if (!await loadRazorpay()) throw new Error("Secure checkout could not load");
      const data = await apiFetch<{ subscription_id: string; key_id: string }>("/api/payments/razorpay/subscribe", {
        method: "POST", body: JSON.stringify({ plan: selected }),
      });
      if (!data?.subscription_id || !data?.key_id) throw new Error("Could not start your subscription");
      const rzp = new (window as any).Razorpay({
        key: data.key_id,
        subscription_id: data.subscription_id,
        name: "Booknomics Premium",
        description: plan.label + " auto-renewing membership",
        prefill: { email: user.email || "" },
        theme: { color: "#152d4a" },
        handler: async (resp: any) => {
          try {
            if (resp.razorpay_subscription_id !== data.subscription_id) throw new Error("Subscription mismatch");
            const result = await apiFetch<{ activated: boolean }>("/api/payments/razorpay/confirm", {
              method: "POST",
              body: JSON.stringify({
                razorpay_subscription_id: resp.razorpay_subscription_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              }),
            });
            if (result.activated) {
              await refresh();
              toast.success("Premium activated! Welcome to Booknomics.");
            } else {
              toast.info("Mandate authorised. Premium activates after Razorpay confirms the first charge.");
            }
            navigate("/account/subscription");
          } catch (err: any) {
            toast.error(err?.message || "We are verifying your payment. Check your subscription page.");
            navigate("/account/subscription");
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.on?.("payment.failed", (err: any) => {
        toast.error(err?.error?.description || "Payment failed. No Premium access has been granted.");
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err?.message || "Checkout is unavailable");
    } finally {
      setPaying(false);
    }
  };

  return (
    <Layout>
      <main className="container max-w-6xl py-12 md:py-20">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex gap-2 items-center rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold px-4 py-2 mb-5">
            <Crown className="w-4 h-4" /> BOOKNOMICS PREMIUM
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-tight">
            Read more. Learn deeper. <span className="text-primary">Spend less.</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg mt-5">
            Built for students, curious minds, and lifelong readers. One membership for Hindi and English reading tools.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {SELLABLE_PLANS.map((key) => {
            const entry = PLANS[key];
            const active = selected === key;
            return (
              <button type="button" key={key} onClick={() => { setSelected(key); setConsent(false); }}
                aria-pressed={active}
                className={"relative text-left border-2 rounded-3xl p-6 md:p-8 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary " +
                  (active ? "border-primary bg-primary/5 shadow-xl" : "border-border bg-card hover:border-primary/40")}>
                {key === "monthly" && <span className="absolute -top-3 left-6 rounded-full px-4 py-1 bg-primary text-primary-foreground text-xs font-bold tracking-wide">MOST POPULAR</span>}
                <div className="flex justify-between items-center">
                  <h2 className="font-serif font-bold text-2xl">{entry.label} Premium</h2>
                  <div className={"w-6 h-6 rounded-full grid place-items-center border-2 " + (active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground")}>
                    {active && <Check className="w-4 h-4" />}
                  </div>
                </div>
                <div className="flex items-end gap-2 my-5">
                  <span className="text-5xl font-extrabold tracking-tight">₹{entry.price}</span>
                  <span className="text-muted-foreground pb-2">/{key === "weekly" ? "week" : "month"}</span>
                </div>
                <div className="text-sm text-muted-foreground">{key === "monthly" ? "Just ₹1.63 per day on average. Save compared with weekly." : "A flexible way to try Premium."}</div>
                <div className="mt-5 pt-5 border-t text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Automatically renews. Cancel anytime.
                </div>
              </button>
            );
          })}
        </div>
        <div className="max-w-4xl mx-auto mt-6 rounded-2xl bg-card border p-5 md:p-7">
          <label className="flex items-start gap-3 text-sm leading-relaxed cursor-pointer">
            <Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} className="mt-1" />
            <span>I authorise Booknomics / Razorpay to automatically charge <strong>₹{plan.price} every {selected === "weekly" ? "week" : "month"}</strong> (taxes included), for up to {selected === "weekly" ? "52 weekly" : "12 monthly"} billing cycles unless I cancel earlier. I can cancel future renewals from My Subscription before the next charge. I agree to the <Link className="underline text-primary" to="/terms" onClick={(e) => e.stopPropagation()}>Terms</Link>.</span>
          </label>
          <Button className="w-full mt-5 h-12 rounded-full bg-primary text-primary-foreground text-base" onClick={subscribe}
            disabled={paying || authLoading || (!consent && !isPremium)}>
            {paying ? "Opening secure checkout..." : isPremium ? "Manage your membership" : "Continue with ₹" + plan.price + " " + plan.label}
            {!paying && <ArrowRight className="ml-2 w-4 h-4" />}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-3">Secure checkout by Razorpay. Supported recurring payment methods depend on your bank and Razorpay account.</p>
          {isPremium && <p className="text-center mt-3"><Link to="/account/subscription" className="text-primary underline font-medium">View existing subscription</Link></p>}
        </div>

        <div className="grid lg:grid-cols-2 gap-10 max-w-4xl mx-auto mt-16">
          <section>
            <h2 className="font-serif text-3xl font-bold mb-6">Everything you need to turn reading into action</h2>
            <ul className="space-y-4">
              {benefits.map((item) => <li key={item} className="flex gap-3 items-start"><Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> {item}</li>)}
            </ul>
          </section>
          <section className="rounded-3xl border bg-primary/5 p-7 space-y-5">
            <div className="flex items-center gap-3"><BookOpen className="text-primary w-6 h-6" /><strong>Keep reading free</strong></div>
            <p className="text-sm text-muted-foreground">You can still discover books and read public summaries for free. Premium unlocks enhanced tools where available.</p>
            <div className="flex items-center gap-3"><Headphones className="text-primary w-6 h-6" /><strong>Listen and learn</strong></div>
            <p className="text-sm text-muted-foreground">Audio and other learning experiences are offered on supported book pages. Content availability varies by title.</p>
            <div className="flex items-center gap-3"><Sparkles className="text-primary w-6 h-6" /><strong>No hidden price surprise</strong></div>
            <p className="text-sm text-muted-foreground">See the recurring amount and maximum billing cycles before you authorise the mandate.</p>
          </section>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-12">Refund requests and billing support: <Link className="underline" to="/contact">Contact Booknomics</Link>. For account-level cancellation, visit My Subscription.</p>
      </main>
    </Layout>
  );
}
