import { useEffect, useRef } from "react";

/**
 * Google AdSense ad unit component.
 *
 * Usage:
 *   <AdBanner slot="1234567890" format="horizontal" />
 *
 * The AdSense script is already loaded via the deferred third-parties block
 * in index.html (after cookie consent). This component just inserts the
 * <ins> element and pushes the ad request.
 */

interface AdBannerProps {
  /** Ad slot ID from your AdSense dashboard. */
  slot: string;
  /** Ad format — "auto", "horizontal", "vertical", "rectangle", "fluid". */
  format?: "auto" | "horizontal" | "vertical" | "rectangle" | "fluid";
  /** Tailwind class for the wrapper (e.g. "my-6"). */
  className?: string;
  /** Whether this is a responsive ad (default: true). */
  responsive?: boolean;
}

export const AdBanner = ({
  slot,
  format = "auto",
  className = "",
  responsive = true,
}: AdBannerProps) => {
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    // Only push the ad if AdSense is loaded and we're not a bot
    if (typeof window === "undefined") return;
    if ((window as any).__IS_BOT__) return;
    if (!(window as any).adsbygoogle) return;

    try {
      // Push the ad request — AdSense handles the rest
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      // Ignore AdSense errors
    }
  }, [slot]);

  return (
    <div className={`ad-container ${className}`}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", textAlign: "center" }}
        data-ad-client="ca-pub-3415243304589225"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
};

/**
 * A styled in-feed ad that blends with the card grid on browse/index pages.
 */
export const InFeedAd = ({ className = "" }: { className?: string }) => (
  <div className={`rounded-xl border border-border bg-card overflow-hidden ${className}`}>
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client="ca-pub-3415243304589225"
      data-ad-slot="auto"
      data-ad-format="fluid"
      data-ad-layout-key="-6t+ed+2i-1n-4w"
      data-full-width-responsive="true"
    />
  </div>
);

/**
 * A sidebar/sticky ad for the right column on detail pages.
 */
export const SidebarAd = ({ className = "" }: { className?: string }) => (
  <div className={`sticky top-20 ${className}`}>
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client="ca-pub-3415243304589225"
      data-ad-slot="auto"
      data-ad-format="vertical"
      data-full-width-responsive="true"
    />
  </div>
);
