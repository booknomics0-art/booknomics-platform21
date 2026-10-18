import { supabase } from "@/integrations/supabase/client";

/** Small, RLS-respecting server-side category directory. Never fetch all book rows in a browser. */
export type PublicCategoryInfo = {
  categories: string[];
  category: string | null;
  published_count: number;
  picks: Record<string, string>;
};

type Options = {
  slug?: string | null;
  alias?: string | null;
  language?: string | null;
  publishedOnly?: boolean;
  pickLabels?: string[];
};

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expires: number; pending: Promise<PublicCategoryInfo> }>();

export function getPublicCategoryInfo(options: Options = {}): Promise<PublicCategoryInfo> {
  const args = {
    p_slug: options.slug ?? null,
    p_alias: options.alias ?? null,
    p_language: options.language ?? null,
    p_published_only: options.publishedOnly ?? false,
    p_pick_labels: options.pickLabels ?? [],
  };
  const key = JSON.stringify(args);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.pending;

  const pending = (async () => {
    // The migration adds this read-only RPC. Keep its response validation local
    // rather than regenerating unrelated Supabase types in a performance patch.
    const { data, error } = await (supabase as any).rpc("get_public_category_info", args);
    if (error) throw error;
    if (!data || !Array.isArray(data.categories)) throw new Error("Invalid category directory response");

    return {
      categories: data.categories.filter((s: unknown): s is string => typeof s === "string"),
      category: typeof data.category === "string" ? data.category : null,
      published_count: Number(data.published_count) || 0,
      picks: data.picks && typeof data.picks === "object" ? data.picks as Record<string, string> : {},
    };
  })();

  // Evict failed promises; retry on the next navigation rather than caching an outage.
  cache.set(key, { expires: Date.now() + TTL_MS, pending });
  if (cache.size > 80) {
    for (const [k, entry] of cache) if (entry.expires <= Date.now()) cache.delete(k);
  }
  void pending.catch(() => { if (cache.get(key)?.pending === pending) cache.delete(key); });
  return pending;
}
