import { apiFetch } from "@/lib/cloudflareApi";

type Filter = { kind: "eq" | "neq" | "in" | "contains"; field: string; value: any };
type Bundle = {
  book: any;
  match: "slug" | "seo_slug" | "old_slugs";
  canonical_slug: string;
  related: any[];
  sameLang: any[];
  reviews: any[];
  linkTargets: any[];
  counterpart: any | null;
};

const bundlesBySlug = new Map<string, Promise<Bundle>>();
const bundlesByBookId = new Map<string, Bundle>();
const booksById = new Map<string, any>();

async function loadBundle(slug: string): Promise<Bundle> {
  const key = slug.trim();
  let pending = bundlesBySlug.get(key);
  if (!pending) {
    pending = apiFetch<Bundle>(`/api/book-detail-data/${encodeURIComponent(key)}`);
    bundlesBySlug.set(key, pending);
  }
  try {
    const bundle = await pending;
    bundlesByBookId.set(String(bundle.book.id), bundle);
    booksById.set(String(bundle.book.id), bundle.book);
    if (bundle.counterpart?.id) booksById.set(String(bundle.counterpart.id), bundle.counterpart);
    return bundle;
  } finally {
    // Deduplicate only simultaneous requests, not every visit for the lifetime
    // of a tab. Admin edits must appear after returning to a book page.
    if (bundlesBySlug.get(key) === pending) bundlesBySlug.delete(key);
  }
}

const message = (error: unknown) => error instanceof Error ? error.message : String(error || "Request failed");
const ok = (data: any) => ({ data, error: null });
const fail = (error: unknown) => ({ data: null, error: { message: message(error) } });

class QueryBuilder {
  private filters: Filter[] = [];
  private operation: "select" | "delete" = "select";
  private selected = "*";

  constructor(private table: string) {}

  select(fields = "*") { this.selected = fields; return this; }
  delete() { this.operation = "delete"; return this; }
  eq(field: string, value: any) { this.filters.push({ kind: "eq", field, value }); return this; }
  neq(field: string, value: any) { this.filters.push({ kind: "neq", field, value }); return this; }
  in(field: string, value: any[]) { this.filters.push({ kind: "in", field, value }); return this; }
  contains(field: string, value: any) { this.filters.push({ kind: "contains", field, value }); return this; }
  order(_field: string, _options?: any) { return this; }
  limit(_limit: number) { return this; }

  async insert(value: any) {
    if (this.table !== "library") return fail(`Unsupported insert table: ${this.table}`);
    try {
      const bookId = Array.isArray(value) ? value[0]?.book_id : value?.book_id;
      if (!bookId) return fail("book_id required");
      const data = await apiFetch<{ saved: boolean }>("/api/library/toggle", {
        method: "POST",
        body: JSON.stringify({ book_id: bookId, saved: true }),
      });
      return ok(data);
    } catch (error) {
      return fail(error);
    }
  }

  maybeSingle() { return this.execute(true); }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute(false).then(onfulfilled as any, onrejected as any);
  }

  private filter(kind: Filter["kind"], field: string) {
    return this.filters.find((item) => item.kind === kind && item.field === field)?.value;
  }

  private async execute(single: boolean): Promise<any> {
    try {
      if (this.table === "library") return await this.executeLibrary(single);
      if (this.table === "book_reviews") return await this.executeReviews();
      if (this.table === "books") return await this.executeBooks(single);
      return fail(`Unsupported BookDetail table: ${this.table}`);
    } catch (error) {
      return fail(error);
    }
  }

  private async executeLibrary(single: boolean) {
    const bookId = this.filter("eq", "book_id");
    if (!bookId) return fail("book_id required");
    if (this.operation === "delete") {
      const data = await apiFetch<{ saved: boolean }>("/api/library/toggle", {
        method: "POST",
        body: JSON.stringify({ book_id: bookId, saved: false }),
      });
      return ok(data);
    }
    if (!single) return fail("Library list query is not supported by this adapter");
    const data = await apiFetch<{ saved: boolean }>(`/api/library/status?book_id=${encodeURIComponent(String(bookId))}`);
    return ok(data.saved ? { id: `saved:${bookId}` } : null);
  }

  private async executeReviews() {
    const bookId = String(this.filter("eq", "book_id") || "");
    const bundle = bundlesByBookId.get(bookId);
    return ok(bundle?.reviews || []);
  }

  private async executeBooks(single: boolean) {
    if (single) {
      const byId = this.filter("eq", "id");
      if (byId) return ok(booksById.get(String(byId)) || null);

      const slug = this.filter("eq", "slug");
      const seoSlug = this.filter("eq", "seo_slug");
      const oldSlugs = this.filter("contains", "old_slugs");
      const candidate = slug || seoSlug || (Array.isArray(oldSlugs) ? oldSlugs[0] : null);
      if (!candidate) return ok(null);
      const bundle = await loadBundle(String(candidate));
      if (slug && bundle.match !== "slug") return ok(null);
      if (seoSlug && bundle.match !== "seo_slug") return ok(null);
      if (oldSlugs && bundle.match !== "old_slugs") return ok(null);
      return ok(bundle.book);
    }

    const excludedId = String(this.filter("neq", "id") || "");
    const bundle = bundlesByBookId.get(excludedId);
    if (!bundle) return ok([]);

    const category = this.filter("eq", "category");
    const language = this.filter("eq", "language");
    const excludedCategory = this.filter("neq", "category");
    if (category) return ok(bundle.related);
    if (language && excludedCategory) return ok(bundle.sameLang);
    if (language && this.selected.includes("title") && this.selected.includes("slug")) return ok(bundle.linkTargets);
    return ok([]);
  }
}

export const supabase: any = {
  from(table: string) {
    return new QueryBuilder(table);
  },
  async rpc(name: string, args: Record<string, any>) {
    if (name !== "get_premium_summary") return fail(`Unsupported RPC: ${name}`);
    try {
      const bookId = args?.p_book_id;
      const payload = await apiFetch<{ data: any }>(`/api/premium-summary/${encodeURIComponent(String(bookId || ""))}`);
      return ok(payload.data);
    } catch (error) {
      return fail(error);
    }
  },
  functions: {
    async invoke(name: string, options: { body?: any; headers?: Record<string, string> } = {}) {
      const routes: Record<string, string> = {
        "translate-to-hindi": "/api/book-ai/translate-to-hindi",
        "generate-action-plan": "/api/book-ai/generate-action-plan",
      };
      const path = routes[name];
      if (!path) return fail(`Unsupported function: ${name}`);
      try {
        const data = await apiFetch<any>(path, {
          method: "POST",
          body: JSON.stringify(options.body || {}),
        });
        return ok(data);
      } catch (error) {
        return fail(error);
      }
    },
  },
  auth: {
    async getSession() {
      try {
        const payload = await apiFetch<{ user: any | null }>("/api/auth/session");
        return {
          data: { session: payload.user ? { access_token: "cloudflare-cookie-session" } : null },
          error: null,
        };
      } catch (error) {
        return { data: { session: null }, error: { message: message(error) } };
      }
    },
  },
};
