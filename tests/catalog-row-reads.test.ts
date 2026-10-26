import { describe, expect, it, vi } from 'vitest';
import { handleCatalogRoute } from '../worker/catalogRoutes';

function mockDb() {
  const statements: string[] = [];
  const db = {
    prepare: vi.fn((sql: string) => {
      statements.push(sql);
      return { bind: () => ({
        first: async () => ({ total: 5000 }),
        all: async () => ({ results: [{ id: '11111111-1111-4111-8111-111111111111', slug: 'demo' }] }),
      }) };
    }),
  };
  return { db, statements };
}

describe('catalog D1 row-read budget', () => {
  it('does not issue expensive COUNT scans for each SEO prerender page', async () => {
    const { db, statements } = mockDb();
    const result = await handleCatalogRoute(new Request(
      'https://www.booknomics.com/api/catalog/books?view=prerender&fields=id,slug&status=published&sort=id&limit=100',
    ), { DB: db });
    expect(result?.status).toBe(200);
    expect((await result?.json()).count).toBeNull();
    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain('SELECT id,slug FROM books');
  });

  it('retains exact total counts for interactive browse pagination', async () => {
    const { db, statements } = mockDb();
    const result = await handleCatalogRoute(new Request(
      'https://www.booknomics.com/api/catalog/books?limit=24&sort=az',
    ), { DB: db });
    expect(result?.status).toBe(200);
    expect((await result?.json()).count).toBe(5000);
    expect(statements.some(statement => statement.includes('COUNT(*)'))).toBe(true);
  });
});
