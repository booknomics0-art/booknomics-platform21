import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Check, Crown, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier, type Tier } from "@/hooks/useTier";
import { PLANS, FEATURES, type PaidPlan } from "@/lib/plans";
import { useNavigate } from "react-router-dom";

type Ctx = { open: () => void };
const PricingCtx = createContext<Ctx | null>(null);

export function usePricingModal() {
  const ctx = useContext(PricingCtx);
  return ctx?.open ?? (() => window.dispatchEvent(new CustomEvent("booknomics:open-pricing")));
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function PricingModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo<Ctx>(() => ({ open: () => setOpen(true) }), []);

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("booknomics:open-pricing", h);
    return () => window.removeEventListener("booknomics:open-pricing", h);
  }, []);

  return (
    <PricingCtx.Provider value={value}>
      {children}
      <PricingDialog open={open} onOpenChange={setOpen} />
    </PricingCtx.Provider>
  );
}

function PricingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const { tier, refresh } = useTier();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<PaidPlan>("monthly");
  const [paying, setPaying] = useState(false);

  const handlePay = useCallback(async () => {
    if (!user) {
      onOpenChange(false);
      toast.info("Please sign in to subscribe");
      navigate("/auth");
      return;
    }
    setPaying(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) { toast.error("Could not load Razorpay. Check your internet."); return; }

      const { data, error } = await supabase.functions.invoke("razorpay-create-order", {
        body: { plan: selected },
      });
      if (error || !data?.order_id || !data?.key_id) {
        toast.error(error?.message || data?.error || "Could not start payment");
        return;
      }

      const plan = PLANS[selected];
      const rzp = new (window as any).Razorpay({
        key: data.key_id,
        order_id: data.order_id,
        amount: plan.amountPaise,
        currency: "INR",
        name: "Booknomics Premium",
        description: `${plan.label} subscription`,
        prefill: { email: user.email ?? "", name: user.user_metadata?.display_name ?? "" },
        theme: { color: "#8B5CF6" },
        handler: async (resp: any) => {
          const { data: vdata, error: verr } = await supabase.functions.invoke("razorpay-verify", {
            body: {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            },
          });
          if (verr || !vdata?.ok) { toast.error(verr?.message || vdata?.error || "Payment verification failed"); return; }
          toast.success(`Welcome to ${plan.label} Premium!`);
          await refresh();
          onOpenChange(false);
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.on?.("payment.failed", (r: any) => { toast.error(r?.error?.description || "Payment failed"); setPaying(false); });
      onOpenChange(false);
      rzp.open();
    } catch (e: any) {
      toast.error(e?.message || "Could not start payment");
    } finally {
      setPaying(false);
    }
  }, [selected, user, navigate, onOpenChange, refresh]);

  const plan = PLANS[selected];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl md:text-3xl flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" /> Elevate your reading with Booknomics Premium
          </DialogTitle>
          <DialogDescription>
            Unlock action trackers, AI summaries, audio, and exports. Save up to 40% on the quarterly plan.
            {tier !== "free" && <span className="block mt-1 text-primary font-medium">You're currently on the {PLANS[tier as PaidPlan]?.label ?? tier} plan.</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-3 md:gap-4 mt-2">
          {(Object.keys(PLANS) as PaidPlan[]).map((key) => {
            const p = PLANS[key];
            const isSel = selected === key;
            const ring =
              p.highlight === "best"    ? "ring-2 ring-amber-500"  :
              p.highlight === "popular" ? "ring-2 ring-violet-500" :
              "ring-1 ring-border";
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`text-left rounded-2xl p-5 transition-all bg-card hover:shadow-cover ${ring} ${isSel ? "scale-[1.02] shadow-cover" : ""}`}
              >
                {p.highlight === "popular" && (
                  <div className="inline-block text-[10px] font-bold tracking-[0.18em] uppercase bg-violet-600 text-white px-2 py-1 rounded mb-2">Most popular</div>
                )}
                {p.highlight === "best" && (
                  <div className="inline-block text-[10px] font-bold tracking-[0.18em] uppercase bg-amber-500 text-white px-2 py-1 rounded mb-2">Best value · Save 40%</div>
                )}
                <div className="font-serif text-xl font-bold">{p.label}</div>
                <div className="mt-1 text-3xl font-bold">₹{p.price}<span className="text-sm font-normal text-muted-foreground">/{key === "weekly" ? "wk" : key === "monthly" ? "mo" : "qtr"}</span></div>
                <p className="text-xs text-muted-foreground mt-1">{p.tagline}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <Button
            size="lg"
            onClick={handlePay}
            disabled={paying}
            className="w-full rounded-full bg-gradient-to-r from-amber-500 to-violet-600 text-white hover:opacity-90 gap-2 shadow-md"
          >
            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {paying ? "Opening Razorpay..." : `Proceed to Pay ₹${plan.price}`}
          </Button>
          <div className="text-center text-[11px] text-muted-foreground mt-2">Secure payment via Razorpay · Cancel anytime</div>
        </div>

        <div className="mt-6 rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-5 text-xs font-medium bg-muted/40">
            <div className="p-3">Feature</div>
            <div className="p-3 text-center">Free</div>
            <div className="p-3 text-center">Weekly</div>
            <div className="p-3 text-center">Monthly</div>
            <div className="p-3 text-center">Quarterly</div>
          </div>
          {FEATURES.map((f) => (
            <div key={f.label} className="grid grid-cols-5 text-sm border-t border-border">
              <div className="p-3">{f.label}</div>
              {(["free", "weekly", "monthly", "quarterly"] as Tier[]).map((t) => (
                <div key={t} className="p-3 text-center">
                  {(f as any)[t] ? <Check className="h-4 w-4 text-green-500 inline" /> : <span className="text-muted-foreground">—</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
