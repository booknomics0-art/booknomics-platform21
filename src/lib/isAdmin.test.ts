import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('@/lib/cloudflareApi', () => ({ apiFetch }));

import { isAdminUser } from './isAdmin';

describe('isAdminUser', () => {
  beforeEach(() => apiFetch.mockReset());

  it('checks the current session through the Cloudflare role endpoint', async () => {
    apiFetch.mockResolvedValue({ isAdmin: true });

    await expect(isAdminUser()).resolves.toBe(true);
    expect(apiFetch).toHaveBeenCalledWith('/api/me/admin');
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('does not grant admin access for a regular user or signed-out session', async () => {
    apiFetch.mockResolvedValue({ isAdmin: false });

    await expect(isAdminUser()).resolves.toBe(false);
  });

  it('fails closed when the role endpoint omits an explicit admin grant', async () => {
    apiFetch.mockResolvedValue({});

    await expect(isAdminUser()).resolves.toBe(false);
  });
});
