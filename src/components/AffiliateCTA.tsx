import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  bookId: string;
  link?: string | null;
  title: string;
  placement?: string;
  variant?: "primary" | "inline";
  label?: string;
}

const AMAZON_SEARCH = (q: string) =>
  `https://www.amazon.in/s?k=${encodeURIComponent(q)}&tag=bookinsight-21`;

export const AffiliateCTA = ({ bookId, link, title, placement = "detail", variant = "primary", label }: Props) => {
  const { user } = useAuth();
  const href = link || AMAZON_SEARCH(title);

  const onClick = () => {
    supabase.from("affiliate_clicks").insert({
      book_id: bookId,
      user_id: user?.id ?? null,
      source: "amazon",
      placement,
    }).then(() => {});
  };

  if (variant === "inline") {
    return (
      <a href={href} target="_blank" rel="nofollow sponsored noopener noreferrer" onClick={onClick}
        className="inline-flex items-center gap-1.5 text-primary font-semibold hover:underline">
        {label || "Read full book on Amazon"} <ExternalLink className="h-3.5 w-3.5" />
      </a>
    );
  }

  return (
    <div className="my-10 p-6 md:p-8 rounded-2xl border border-border bg-muted/40 text-center">
      <p className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2">Go deeper</p>
      <h3 className="font-serif text-2xl md:text-3xl font-bold mb-2">Want the full experience?</h3>
      <p className="text-muted-foreground mb-5 max-w-md mx-auto text-sm">
        Summaries spark the idea — the full book builds the depth. Support the author and own a copy.
      </p>
      <Button asChild size="lg" className="bg-gold text-primary-foreground hover:opacity-90 rounded-full gap-2">
        <a href={href} target="_blank" rel="nofollow sponsored noopener noreferrer" onClick={onClick}>
          📘 {label || "Read Full Book on Amazon"} <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
      <p className="text-[11px] text-muted-foreground mt-4">
        Affiliate disclosure: We may earn a commission from qualifying purchases.
      </p>
    </div>
  );
};
