import { useEffect, useRef } from "react";

/**
 * Google AdSense ad unit component.
 *
 * Only real numeric ad-unit slot IDs are rendered. Before AdSense creates
 * valid units (or when Auto Ads is used), the component returns null instead
 * of showing an empty/invalid advertising container.
 */

interface AdBannerProps {
  /** Numeric ad slot ID from the AdSense dashboard. */
  slot: string;
  /** Ad format — "auto", "horizontal", "vertical", "rectangle", "fluid". */
  format?: "auto" | "horizontal" | "vertical" | "rectangle" | "fluid";
  /** Tailwind class for the wrapper (e.g. "my-6"). */
  className?: string;
  /** Whether this is a responsive ad (default: true). */
  responsive?: boolean;
}

const isValidSlot = (slot?: string | null) => Boolean(slot && /^\d{5,}$/.test(slot));

export const AdBanner = ({
  slot,
  format = "auto",
  className = "",
  responsive = true,
}: AdBannerProps) => {
  const insRef = useRef<HTMLModElement>(null);
  const validSlot = isValidSlot(slot);

  useEffect(() => {
    if (!validSlot || typeof window === "undefined") return;
    if ((window as any).__IS_BOT__) return;
    if (!(window as any).adsbygoogle) return;

    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      // AdSense can reject duplicate/early pushes while a route is changing.
      // It should never interrupt the reading experience.
    }
  }, [slot, validSlot]);

  if (!validSlot) return null;

  return (
    <div className={`ad-container ${className}`} aria-label="Advertisement">
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
 * Optional in-feed unit. It stays disabled until a real slot is provided via
 * VITE_ADSENSE_INFEED_SLOT.
 */
export const InFeedAd = ({ className = "" }: { className?: string }) => {
  const slot = import.meta.env.VITE_ADSENSE_INFEED_SLOT as string | undefined;
  if (!isValidSlot(slot)) return null;
  return <AdBanner slot={slot!} format="fluid" className={`rounded-xl border border-border bg-card overflow-hidden ${className}`} />;
};

/**
 * Optional sidebar unit. It stays disabled until a real slot is provided via
 * VITE_ADSENSE_SIDEBAR_SLOT.
 */
export const SidebarAd = ({ className = "" }: { className?: string }) => {
  const slot = import.meta.env.VITE_ADSENSE_SIDEBAR_SLOT as string | undefined;
  if (!isValidSlot(slot)) return null;
  return <AdBanner slot={slot!} format="vertical" className={`sticky top-20 ${className}`} />;
};
