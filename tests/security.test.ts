import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeRedirectPath } from '@/lib/safeRedirect';
describe('post-login redirects', () => {
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/\nevil.example', 'javascript:alert(1)'])('rejects external or ambiguous path %s', path => {
    expect(safeRedirectPath(path)).toBe('/');
  });
  it('preserves local OAuth consent continuation', () => {
    expect(safeRedirectPath('/oauth/consent?authorization_id=abc')).toBe('/oauth/consent?authorization_id=abc');
  });
});
describe('rate limits and CORS', () => {
  beforeEach(() => {
    vi.resetModules(); vi.useFakeTimers();
    vi.stubGlobal('Deno', { env: { get: () => undefined } });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('keeps an hour limit across minute-based cleanup', async () => {
    const { checkRateLimit, maybePruneRateLimits } = await import('../supabase/functions/_shared/security');
    expect(checkRateLimit('user', 1, 3600).ok).toBe(true);
    vi.advanceTimersByTime(120000); maybePruneRateLimits();
    expect(checkRateLimit('user', 1, 3600).ok).toBe(false);
    vi.advanceTimersByTime(3600000); maybePruneRateLimits();
    expect(checkRateLimit('user', 1, 3600).ok).toBe(true);
  });
  it('does not trust arbitrary hosting tenants', async () => {
    const { corsHeaders } = await import('../supabase/functions/_shared/security');
    expect(corsHeaders(new Request('https://example.com', {headers:{Origin:'https://attacker.lovable.app'}}))['Access-Control-Allow-Origin']).toBe('');
    expect(corsHeaders(new Request('https://example.com', {headers:{Origin:'https://booknomics.com'}}))['Access-Control-Allow-Origin']).toBe('https://booknomics.com');
  });
});
