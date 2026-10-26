import { describe, expect, it } from 'vitest';
import { asBooknomicsUser } from './personalSupabase';

describe('asBooknomicsUser', () => {
  it('maps the new Supabase identity into existing Booknomics UI shape', () => {
    const result = asBooknomicsUser({
      id: '904d5b3f-544e-4ba3-8a75-8c52eb7ee85d',
      email: 'reader@example.com',
      user_metadata: { full_name: 'A Reader', avatar_url: 'https://example.com/photo.png' },
    } as any);
    expect(result).toMatchObject({
      id: '904d5b3f-544e-4ba3-8a75-8c52eb7ee85d',
      email: 'reader@example.com',
      display_name: 'A Reader',
      user_metadata: { name: 'A Reader' },
    });
  });

  it('never derives admin status from user_metadata', () => {
    const user = asBooknomicsUser({
      id: 'user-1',
      email: 'reader@example.com',
      user_metadata: { role: 'admin', is_admin: true },
    } as any);
    expect(user).not.toHaveProperty('role');
    expect(user).not.toHaveProperty('is_admin');
    expect(user?.display_name).toBeNull();
  });

  it('handles signed-out state', () => {
    expect(asBooknomicsUser(null)).toBeNull();
  });
});
