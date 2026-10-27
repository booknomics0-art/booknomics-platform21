// Never let a new Supabase user's bearer token fall through to an unrelated
// legacy D1 cookie-backed PERSONAL endpoint. The new identity lives only in
// Supabase, even when an old bn_session cookie remains in the browser.
const personalPrefixes = [
  '/api/auth/', '/api/library', '/api/reading-progress', '/api/progress',
  '/api/notes', '/api/bookmarks', '/api/referrals', '/api/book-requests',
  '/api/mastery', '/api/payments/', '/api/razorpay/', '/api/account/',
];
const personalMutationPrefixes = [
  '/api/community', '/api/book-discussions', '/api/book-discussion-replies',
  '/api/book-reaction', '/api/comments', '/api/reactions', '/api/reviews',
];

export function blocksLegacyPersonalRouteForSupabase(request: Request): boolean {
  if (!/^Bearer\s+\S+$/i.test(request.headers.get('authorization') || '')) return false;
  const path = new URL(request.url).pathname;
  if (personalPrefixes.some(prefix => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`))) return true;
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return false;
  return personalMutationPrefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}
