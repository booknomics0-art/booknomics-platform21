// Hosting-level canonical redirects that are handled by Vercel Routing Middleware.
// Keep this small: these are only current canonical migrations not already present
// in vercel.json. All values are unencoded book slugs.
export const SERVER_SLUG_REDIRECTS: Record<string, string> = {
  "design-of-machine-elements-merhyle-franklin-spotts-merhyle-f-spotts-terry-e-shoup-summary":
    "design-of-machine-elements-merhyle-f-spotts-summary",
  "economics-an-introductory-analysis-paul-anthony-samuelson-nordhaus-william-d-william-d-nordhaus-summary":
    "economics-paul-samuelson-william-nordhaus-summary",
  "guitarmaking-tradition-and-technology-william-r-cumpiano-jonsthan-d-natelson-william-cumpiano-summary":
    "guitarmaking-william-cumpiano-summary",
  "atlas-shrugged-centennial-ed-hc-ayn-rand-sophie-bastide-foltz-adrian-rand-summary":
    "atlas-shrugged-ayn-rand-summary",
  "mary-shelley-s-frankenstein-or-the-modern-prometheus-1818-text-mary-shelley-summary":
    "frankenstein-1818-mary-shelley-summary",
};
