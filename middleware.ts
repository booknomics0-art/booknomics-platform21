export const config = {
  matcher: ["/book/:path*"],
};

/**
 * Preserve legacy inbound links with a real server-side permanent redirect.
 * The matcher scopes this middleware to /book/* only, so normal application
 * requests do not pay a middleware hop.
 */
export default function middleware(request: Request) {
  const incoming = new URL(request.url);
  const legacyPrefix = "/book/";
  const slugPath = incoming.pathname.startsWith(legacyPrefix)
    ? incoming.pathname.slice(legacyPrefix.length)
    : "";

  const destination = new URL(slugPath ? `/books/${slugPath}` : "/browse", incoming.origin);
  destination.search = incoming.search;

  return Response.redirect(destination, 308);
}
