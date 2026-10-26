import { describe, expect, it } from 'vitest';
import { blocksLegacyPersonalRouteForSupabase } from '../worker/newAuthIsolation';

const req = (route: string, method: string, bearer: boolean) => new Request(`https://www.booknomics.com${route}`, {
  method,
  headers: bearer ? { authorization: 'Bearer new-supabase-access-token' } : {},
});

describe('new Supabase account never mutates legacy D1 personal records', () => {
  it('blocks old personalized reads/writes with a Supabase bearer', () => {
    for (const route of ['/api/mastery', '/api/referrals/me', '/api/book-requests', '/api/payments/razorpay/subscribe', '/api/library']) {
      expect(blocksLegacyPersonalRouteForSupabase(req(route, 'POST', true))).toBe(true);
    }
    for (const route of ['/api/book-discussions/vote', '/api/book-reaction', '/api/community/posts']) {
      expect(blocksLegacyPersonalRouteForSupabase(req(route, 'POST', true))).toBe(true);
    }
  });
  it('preserves legacy cookie users and public content reads', () => {
    expect(blocksLegacyPersonalRouteForSupabase(req('/api/mastery', 'POST', false))).toBe(false);
    expect(blocksLegacyPersonalRouteForSupabase(req('/api/book-discussions', 'GET', true))).toBe(false);
    expect(blocksLegacyPersonalRouteForSupabase(req('/api/catalog/books', 'GET', true))).toBe(false);
    expect(blocksLegacyPersonalRouteForSupabase(req('/api/premium-summary/123', 'GET', true))).toBe(false);
    expect(blocksLegacyPersonalRouteForSupabase(req('/api/audio/123', 'GET', true))).toBe(false);
  });
});
