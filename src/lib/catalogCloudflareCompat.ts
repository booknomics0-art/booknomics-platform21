import { apiFetch } from "@/lib/cloudflareApi";

type CatalogPayload = { data: any[]; count: number; limit: number; offset: number };
type Filter = { kind: "eq" | "in"; field: string; value: any };

const errorResult = (error: unknown) => ({
  data: null,
  error: { message: error instanceof Error ? error.message : String(error || "Catalog request failed") },
});

class CatalogQuery {
  private fields = "*";
  private filters: Filter[] = [];
  private requestedLimit: number | null = null;
  private requestedRange: [number, number] | null = null;
  private sortField: string | null = null;
  private ascending = true;

  constructor(private table: string) {}

  select(fields = "*") { this.fields = fields; return this; }
  eq(field: string, value: any) { this.filters.push({ kind: "eq", field, value }); return this; }
  in(field: string, value: any[]) { this.filters.push({ kind: "in", field, value }); return this; }
  order(field: string, options?: { ascending?: boolean }) {
    this.sortField = field;
    this.ascending = options?.ascending !== false;
    return this;
  }
  limit(value: number) { this.requestedLimit = Math.max(1, Math.floor(value)); return this; }
  range(from: number, to: number) {
    this.requestedRange = [Math.max(0, Math.floor(from)), Math.max(0, Math.floor(to))];
    return this;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }

  private find(kind: Filter["kind"], field: string) {
    return this.filters.find((item) => item.kind === kind && item.field === field)?.value;
  }

  private async execute() {
    if (this.table !== "books") return errorResult(`Unsupported catalog table: ${this.table}`);
    try {
      const params = new URLSearchParams();
      const language = this.find("eq", "language");
      const category = this.find("eq", "category");
      const statusEq = this.find("eq", "status");
      const slugs = this.find("in", "slug");
      const metaView = ["category", "status", "title", "slug", "seo_slug"].every((field) => this.fields.includes(field))
        && !this.fields.includes("cover_url")
        && !this.fields.includes("author");

      if (language) params.set("language", String(language));
      if (category) params.set("category", String(category));
      if (statusEq === "published" || statusEq === "published_noindex") params.set("status", String(statusEq));
      if (Array.isArray(slugs) && slugs.length) params.set("slugs", slugs.map(String).join(","));
      if (metaView) params.set("view", "meta");
      if (this.sortField === "created_at") params.set("sort", this.ascending ? "az" : "latest");
      else if (this.sortField === "title") params.set("sort", this.ascending ? "az" : "za");

      const explicitOffset = this.requestedRange?.[0] ?? 0;
      const explicitLimit = this.requestedRange
        ? Math.max(1, this.requestedRange[1] - this.requestedRange[0] + 1)
        : this.requestedLimit;

      if (explicitLimit != null || Array.isArray(slugs)) {
        params.set("limit", String(Math.min(explicitLimit ?? 100, 500)));
        params.set("offset", String(explicitOffset));
        const payload = await apiFetch<CatalogPayload>(`/api/catalog/books?${params.toString()}`);
        return { data: payload.data || [], error: null };
      }

      const rows: any[] = [];
      let offset = 0;
      for (;;) {
        const page = new URLSearchParams(params);
        page.set("limit", "500");
        page.set("offset", String(offset));
        const payload = await apiFetch<CatalogPayload>(`/api/catalog/books?${page.toString()}`);
        rows.push(...(payload.data || []));
        offset += payload.limit || 500;
        if (rows.length >= payload.count || !(payload.data || []).length) break;
      }
      return { data: rows, error: null };
    } catch (error) {
      return errorResult(error);
    }
  }
}

export const supabase: any = {
  from(table: string) {
    return new CatalogQuery(table);
  },
};
