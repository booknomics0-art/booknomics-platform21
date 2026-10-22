// Pricing is now a full, accessible route. Keep the old open() contract so
// existing Premium buttons continue to work without maintaining two checkouts.
import { createContext, useContext, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

type PricingContextValue = { open: () => void };
const Context = createContext<PricingContextValue | null>(null);

export function usePricingModal() {
  const ctx = useContext(Context);
  return ctx?.open ?? (() => window.location.assign("/pricing"));
}

export function PricingModalProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const ctx = useMemo(() => ({ open: () => navigate("/pricing") }), [navigate]);
  useEffect(() => {
    const handler = () => navigate("/pricing");
    window.addEventListener("booknomics:open-pricing", handler);
    return () => window.removeEventListener("booknomics:open-pricing", handler);
  }, [navigate]);
  return <Context.Provider value={ctx}>{children}</Context.Provider>;
}
