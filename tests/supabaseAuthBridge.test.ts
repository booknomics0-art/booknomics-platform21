import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { handleSupabaseAuthBridge } from '../worker/supabaseAuthBridge';

const projectUrl = 'https://otmjrtigeiuzktunodmb.supabase.co';
const id = 'ec7e0771-3795-4874-99ca-6b7468695111';
const token = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 300 })) + '.signature';

function makeDb(legacyId?: string) {
  const calls: { sql: string; values: unknown[] }[] = [];
  return {
    calls,
    prepare(sql: string) {
      const call = { sql, values: [] as unknown[] };
      calls.push(call);
      const statement = {
        bind(...values: unknown[]) { call.values = values; return statement; },
        async first() { return legacyId ? { id: legacyId } : null; },
        async run() { return { success: true }; },
      };
      return statement;
    },
  };
}

function makeRequest(accessToken = token, origin = 'https://www.booknomics.com') {
  return new Request('https://www.booknomics.com/api/auth/supabase/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ access_token: accessToken }),
  });
}

const env = (db: ReturnType<typeof makeDb>) => ({
  DB: db,
  AUTH_MODE: 'supabase',
  AUTH_SUPABASE_URL: projectUrl,
  AUTH_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
});

describe('Supabase to Cloudflare session bridge', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  it('rejects requests from another origin', async () => {
    const response = await handleSupabaseAuthBridge(makeRequest(token, 'https://evil.example'), env(makeDb()));
    expect(response?.status).toBe(403);
  });

  it('does not issue sessions unless the new Supabase integration is enabled', async () => {
    const db = makeDb();
    const response = await handleSupabaseAuthBridge(makeRequest(), { ...env(db), AUTH_MODE: 'cloudflare' });
    expect(response?.status).toBe(503);
    expect(db.calls).toHaveLength(0);
  });

  it('rejects invalid Supabase tokens without writing users', async () => {
    const db = makeDb();
    const fetchUser = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetchUser);
    const response = await handleSupabaseAuthBridge(makeRequest(), env(db));
    expect(response?.status).toBe(401);
    expect(fetchUser).toHaveBeenCalledWith(`${projectUrl}/auth/v1/user`, expect.objectContaining({
      headers: expect.objectContaining({ apikey: 'sb_publishable_test', authorization: `Bearer ${token}` }),
    }));
    expect(db.calls).toHaveLength(0);
  });

  it('does not silently reconnect a legacy account by matching email', async () => {
    const db = makeDb('old-cloudflare-user-id');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      id, email: 'reader@example.com', email_confirmed_at: new Date().toISOString(),
    })));
    const response = await handleSupabaseAuthBridge(makeRequest(), env(db));
    expect(response?.status).toBe(409);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].sql).toContain('SELECT id FROM users');
  });

  it('creates a short-lived HttpOnly D1 session for a verified new user', async () => {
    const db = makeDb();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      id,
      email: 'reader@example.com',
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { full_name: 'Reader' },
    })));
    const response = await handleSupabaseAuthBridge(makeRequest(), env(db));
    expect(response?.status).toBe(200);
    const body = await response?.json();
    expect(body.user).toMatchObject({ id, email: 'reader@example.com', display_name: 'Reader' });
    const cookie = response?.headers.get('set-cookie') || '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toMatch(/Max-Age=\d+/);
    expect(db.calls.some(call => call.sql.includes('INSERT INTO sessions'))).toBe(true);
    expect(db.calls.some(call => call.sql.includes('INTO profiles'))).toBe(true);
  });
});
