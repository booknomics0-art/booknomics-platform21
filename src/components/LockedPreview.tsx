import { useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthPromptModal } from "./AuthPromptModal";

export const LockedPreview = ({
  eyebrow,
  title,
  sample,
  ctaLabel = "Unlock Full Action Plan",
  modalTitle,
  modalDescription,
}: {
  eyebrow: string;
  title: string;
  sample: React.ReactNode;
  ctaLabel?: string;
  modalTitle?: string;
  modalDescription?: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <section className="py-4">
      <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">{eyebrow}</div>
      <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-6">{title}</h2>

      <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
        <div
          aria-hidden
          className="p-6 md:p-8 select-none pointer-events-none"
          style={{ filter: "blur(5px)", maskImage: "linear-gradient(180deg, #000 0%, #000 55%, transparent 100%)", WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 55%, transparent 100%)" }}
        >
          <div className="prose prose-lg max-w-none font-serif leading-relaxed">
            {sample}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-6 md:p-10 text-center">
          <div className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase font-semibold text-primary mb-3">
            <Lock className="h-3 w-3" /> Members-only preview
          </div>
          <h3 className="font-serif text-2xl md:text-3xl font-bold mb-2">Sign up free to read it all</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
            Personalised action steps, 7-day tracker, and reflection prompts — built around this book.
          </p>
          <Button
            onClick={() => setOpen(true)}
            size="lg"
            className="bg-gold text-primary-foreground hover:opacity-90 rounded-full gap-2 shadow-cover"
          >
            <Sparkles className="h-4 w-4" /> {ctaLabel}
          </Button>
          <div className="mt-3 text-[11px] text-muted-foreground">Free forever · No credit card</div>
        </div>
      </div>

      <AuthPromptModal
        open={open}
        onOpenChange={setOpen}
        title={modalTitle}
        description={modalDescription}
      />
    </section>
  );
};
