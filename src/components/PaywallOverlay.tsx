import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePricingModal } from "@/components/PricingModal";

export const PaywallOverlay = ({
  title = "Unlock Action Trackers & Interactive Checklists",
  description = "Transform what you read into daily habits. Premium members get full access to interactive execution boards, audio summaries, and AI assistants.",
  ctaLabel = "Unlock Premium — Starts at ₹19",
  children,
}: {
  title?: string;
  description?: string;
  ctaLabel?: string;
  children: React.ReactNode;
}) => {
  const open = usePricingModal();
  return (
    <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
      <div
        aria-hidden
        className="select-none pointer-events-none"
        style={{ filter: "blur(8px)" }}
      >
        {children}
      </div>
      <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center rounded-2xl border border-border bg-card/95 backdrop-blur p-6 md:p-8 shadow-cover">
          <div className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase font-semibold text-primary mb-3">
            <Lock className="h-3 w-3" /> Premium feature
          </div>
          <h3 className="font-serif text-2xl md:text-3xl font-bold mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground mb-5">{description}</p>
          <Button
            onClick={open}
            size="lg"
            className="rounded-full gap-2 bg-gradient-to-r from-amber-500 to-violet-600 text-white hover:opacity-90 shadow-md"
          >
            <Sparkles className="h-4 w-4" /> {ctaLabel}
          </Button>
          <div className="mt-3 text-[11px] text-muted-foreground">Cancel anytime · Secure payment via Razorpay</div>
        </div>
      </div>
    </div>
  );
};
