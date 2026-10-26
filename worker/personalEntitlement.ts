// Secure paid entitlement for the NEW Supabase account. The browser never
// provides a tier: Supabase Auth validates its access token, and PostgREST
// checks the server-owned subscriptions table under that user's RLS policy.
// Configure these public (non-secret) bindings on the catalog Worker before
// switching VITE_AUTH_BACKEND to supabase:
// AUTH_SUPABASE_URL=https://otmjrtigeiuzktunodmb.supabase.co
// AUTH_SUPABASE_PUBLISHABLE_KEY=<the NEW project's publishable key>
export type PersonalEntitlementEnv = {
  AUTH_SUPABASE_URL?: string;
  AUTH_SUPABASE_PUBLISHABLE_KEY?: string;
};

export type PersonalEntitlement = { userId: string; email: string; premium: boolean };

export class PersonalAuthError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function getPersonalEntitlement(
  request: Request,
  env: PersonalEntitlementEnv,
): Promise<PersonalEntitlement | null> {
  const header = request.headers.get('authorization');
  if (!header) return null; // Existing Cloudflare-cookie users stay on legacy auth.
  if (!/^Bearer\s+\S+$/i.test(header)) throw new PersonalAuthError(401, 'Invalid authentication');

  const base = (env.AUTH_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.AUTH_SUPABASE_PUBLISHABLE_KEY || '';
  if (base !== 'https://otmjrtigeiuzktunodmb.supabase.co' || !key.startsWith('sb_publishable_')) {
    // Fail closed. Never substitute the old D1 session when the new token is present.
    throw new PersonalAuthError(503, 'Personal authentication is not configured on the Worker');
  }

  const headers = { apikey: key, authorization: header, accept: 'application/json' };
  const response = await fetch(`${base}/auth/v1/user`, { headers });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new PersonalAuthError(401, 'Sign in again');
    throw new PersonalAuthError(503, 'Authentication provider is unavailable');
  }
  const user = await response.json() as { id?: unknown; email?: unknown };
  if (typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id))
    throw new PersonalAuthError(401, 'Invalid account');

  const search = new URLSearchParams({
    select: 'id', user_id: `eq.${user.id}`, status: 'eq.active',
    expires_at: `gt.${new Date().toISOString()}`, limit: '1',
  });
  const entitlement = await fetch(`${base}/rest/v1/subscriptions?${search.toString()}`, { headers });
  if (!entitlement.ok) throw new PersonalAuthError(503, 'Membership could not be verified');
  const subscriptions = await entitlement.json();
  if (!Array.isArray(subscriptions)) throw new PersonalAuthError(503, 'Unexpected membership response');
  return { userId: user.id, email: typeof user.email === 'string' ? user.email : '', premium: subscriptions.length > 0 };
}
