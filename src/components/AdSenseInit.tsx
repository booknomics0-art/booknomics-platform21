import { useEffect } from "react";

/**
 * Call this once (e.g. in Layout) to ensure the `adsbygoogle` array exists
 * so that <ins class="adsbygoogle"> elements can push to it later.
 */
export const AdSenseInit = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).__IS_BOT__) return;
    // Ensure the array exists — the actual script push happens in each <AdBanner>
    (window as any).adsbygoogle = (window as any).adsbygoogle || [];
  }, []);
  return null;
};
