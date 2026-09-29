import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const KEY = "bn-cookie-consent";

export const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      /* storage blocked — stay hidden */
    }
  }, []);

  const decide = (value: "accepted" | "rejected") => {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignore */
    }
    setVisible(false);
    if (value === "accepted") {
      const load = (window as unknown as { __bnLoadThirdParties?: () => void }).__bnLoadThirdParties;
      load?.();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-2 right-2 md:left-auto md:right-4 z-50 md:max-w-md">
      <div className="rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg p-4">
        <h2 className="font-serif text-sm font-bold mb-1.5">Cookies on Booknomics</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          We use cookies to keep you logged in, measure anonymous usage via Google Analytics, and
          show ads via Google AdSense. You can accept or reject non-essential cookies.{" "}
          <Link to="/privacy" className="text-primary underline">
            Privacy Policy
          </Link>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => decide("accepted")}>
            Accept all
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide("rejected")}>
            Reject non-essential
          </Button>
        </div>
      </div>
    </div>
  );
};
