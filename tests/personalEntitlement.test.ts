import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumePersonalQuota, getPersonalEntitlement, PersonalAuthError } from '../worker/personalEntitlement';

const env = {
  AUTH_SUPABASE_URL: 'https://otmjrtigeiuzktunodmb.supabase.co',
  AUTH_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only',
};
const request = () => new Request('https://www.booknomics.com/api/premium-summary/book', {
  headers: { authorization: 'Bearer test.jwt.token' },
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('new Supabase server entitlement', () => {
  it('ignores client-reported plans and checks verified user + active subscription', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'a1c8c316-11ba-4895-a888-76c639cbf5aa', email: 'reader@example.com' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'paid-record' }]), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    const result = await getPersonalEntitlement(request(), env);
    expect(result?.premium).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toContain('user_id=eq.a1c8c316-11ba-4895-a888-76c639cbf5aa');
    expect(fetcher.mock.calls[1][1].headers.authorization).toBe('Bearer test.jwt.token');
  });

  it('rejects unverifiable tokens and never treats them as legacy D1 users', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(getPersonalEntitlement(request(), env)).rejects.toMatchObject({ status: 401 });
  });

  it('fails closed when Worker publishable key is not configured', async () => {
    await expect(getPersonalEntitlement(request(), { AUTH_SUPABASE_URL: env.AUTH_SUPABASE_URL }))
      .rejects.toMatchObject({ status: 503 });
  });

  it('uses the old Cloudflare cookie path only when the new Authorization header is absent', async () => {
    expect(await getPersonalEntitlement(new Request('https://www.booknomics.com/'), env)).toBeNull();
  });

  it('never accepts a non-array membership response as paid', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'a1c8c316-11ba-4895-a888-76c639cbf5aa' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 })));
    await expect(getPersonalEntitlement(request(), env)).rejects.toBeInstanceOf(PersonalAuthError);
  });

  it('consumes a fixed, server-owned quota through the authenticated Supabase RPC', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('true', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await consumePersonalQuota(request(), env, 'audio')).toBe(true);
    expect(fetcher.mock.calls[0][0]).toMatch(/booknomics_consume_feature_quota$/);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ p_feature: 'audio' });
    expect(fetcher.mock.calls[0][1].headers.authorization).toBe('Bearer test.jwt.token');
  });

  it('fails closed instead of allowing paid AI traffic when quota RPC errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    await expect(consumePersonalQuota(request(), env, 'action_plan'))
      .rejects.toMatchObject({ status: 503 });
  });
});
