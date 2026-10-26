import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('production Worker cutover safety', () => {
  it('keeps the existing API/media routes without taking over the Vercel frontend', () => {
    const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8')) as {
      name: string;
      routes: { pattern: string; zone_name: string }[];
    };
    expect(wrangler.name).toBe('booknomics');
    expect(wrangler.routes.map(route => route.pattern).sort()).toEqual([
      'booknomics.com/api/*',
      'booknomics.com/media/*',
      'www.booknomics.com/api/*',
      'www.booknomics.com/media/*',
    ]);
    expect(wrangler.routes.every(route => route.zone_name === 'booknomics.com')).toBe(true);
  });
});
