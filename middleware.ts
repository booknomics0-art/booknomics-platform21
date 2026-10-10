import { SERVER_SLUG_REDIRECTS } from "./src/lib/serverSlugRedirects";

export const config = {
  // Match only requests that always redirect. This avoids adding a middleware
  // hop to normal book traffic and does not require a pass-through helper.
  matcher: [
    "/book/:path*",
    "/books/design-of-machine-elements-merhyle-franklin-spotts-merhyle-f-spotts-terry-e-shoup-summary",
    "/books/economics-an-introductory-analysis-paul-anthony-samuelson-nordhaus-william-d-william-d-nordhaus-summary",
    "/books/guitarmaking-tradition-and-technology-william-r-cumpiano-jonsthan-d-natelson-william-cumpiano-summary",
    "/books/atlas-shrugged-centennial-ed-hc-ayn-rand-sophie-bastide-foltz-adrian-rand-summary",
    "/books/mary-shelley-s-frankenstein-or-the-modern-prometheus-1818-text-mary-shelley-summary",
    "/books/don-t-make-me-think-revisited-steve-krug-summary",
    "/books/hospitals-facility-planning-and-management-g-d-kunders-summary",
  ],
};

export default function middleware(request: Request) {
  const incoming = new URL(request.url);

  if (incoming.pathname.startsWith("/book/")) {
    const slugPath = incoming.pathname.slice("/book/".length);
    const destination = new URL(slugPath ? `/books/${slugPath}` : "/browse", incoming.origin);
    destination.search = incoming.search;
    return Response.redirect(destination, 308);
  }

  if (incoming.pathname.startsWith("/books/")) {
    const rawSlug = incoming.pathname.slice("/books/".length);
    const slug = decodeURIComponent(rawSlug);
    const target = SERVER_SLUG_REDIRECTS[slug];
    if (target) {
      const destination = new URL(`/books/${target}`, incoming.origin);
      destination.search = incoming.search;
      return Response.redirect(destination, 308);
    }
  }

  // The matcher is deliberately restricted to redirect-only routes, so this
  // branch should be unreachable. Avoid redirecting unrelated traffic.
  return new Response("Not found", { status: 404 });
}
