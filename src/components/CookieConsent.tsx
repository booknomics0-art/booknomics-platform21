import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const KEY = "bn-cookie-consent";

type ConsentChoice = "accepted" | "rejected";

type ConsentWindow = Window & {
  __bnOnConsent?: (value: ConsentChoice) => void;
};

export const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      // Storage may be unavailable. Keep the banner visible so the visitor can
      // still make an explicit choice for this page view.
      setVisible(true);
    }

    const reopen = () => setVisible(true);
    window.addEventListener("bn-open-cookie-settings", reopen);
    return () => window.removeEventListener("bn-open-cookie-settings", reopen);
  }, []);

  const decide = (value: ConsentChoice) => {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* consent still applies to the current page view */
    }

    (window as ConsentWindow).__bnOnConsent?.(value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-2 right-2 md:left-auto md:right-4 z-50 md:max-w-md" role="dialog" aria-labelledby="bn-cookie-title" aria-describedby="bn-cookie-copy">
      <div className="rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg p-4">
        <h2 id="bn-cookie-title" className="font-serif text-sm font-bold mb-1.5">Cookies on Booknomics</h2>
        <p id="bn-cookie-copy" className="text-xs text-muted-foreground leading-relaxed">
          Essential cookies keep core features working. With your permission, we also use Google Analytics
          to understand site usage and Google AdSense to support free content. You can accept or reject all
          non-essential cookies and change your choice later from the footer.{" "}
          <Link to="/privacy" className="text-primary underline">
            Privacy Policy
          </Link>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => decide("accepted")}>
            Accept non-essential
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide("rejected")}>
            Reject non-essential
          </Button>
        </div>
      </div>
    </div>
  );
};
