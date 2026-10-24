import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc },
}));

import { isAdminUser } from './isAdmin';

describe('isAdminUser', () => {
  beforeEach(() => rpc.mockReset());

  it('checks the current session using the exposed, role-backed admin RPC', async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(isAdminUser()).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('is_admin_email');
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('does not grant admin access for a regular user or signed-out session', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(isAdminUser()).resolves.toBe(false);
  });

  it('fails closed and reports a role-check error', async () => {
    const error = new Error('admin RPC unavailable');
    rpc.mockResolvedValue({ data: null, error });

    await expect(isAdminUser()).rejects.toThrow('admin RPC unavailable');
  });
});
