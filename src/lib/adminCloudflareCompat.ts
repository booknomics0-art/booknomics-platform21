import {
  adminCreateBookAssetsBulk,
  adminCreateBooks,
  adminCreateSocialPost,
  adminDeleteBook,
  adminGenerateContent,
  adminGenerateCover,
  adminGenerateMastery,
  adminGetBook,
  adminGsc,
  adminListBooksPaged,
  adminListIndexingJobs,
  adminListSocialPosts,
  adminLogAccess,
  adminPolishContent,
  adminPublishedTodayCount,
  adminSubmitIndexNow,
  adminUpdateBook,
  adminUpdateIndexingJob,
  adminUpdateSocialPost,
  adminUploadObject,
} from "@/lib/adminApi";

type CompatError = { message: string; code?: string };
type CompatResult<T> = { data: T | null; error: CompatError | null };
type Operation = "select" | "insert" | "update" | "delete";
type Filter = { op: "eq" | "neq"; column: string; value: unknown };

const uploadedUrls = new Map<string, string>();

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Admin request failed");
}

function projectRow<T extends Record<string, any>>(row: T, columns: string) {
  if (!row || columns.trim() === "*" || !columns.trim()) return row;
  const out: Record<string, unknown> = {};
  for (const raw of columns.split(",")) {
    const key = raw.trim();
    if (!key) continue;
    if (key in row) out[key] = row[key];
  }
  return out;
}

function projectRows(rows: any[], columns: string) {
  return rows.map((row) => projectRow(row, columns));
}

function same(a: unknown, b: unknown) {
  if (typeof a === "boolean") return a === Boolean(b);
  if (typeof b === "boolean") return Boolean(a) === b;
  return a === b;
}

class AdminQueryBuilder implements PromiseLike<CompatResult<any>> {
  private operation: Operation = "select";
  private payload: any = null;
  private columns = "*";
  private filters: Filter[] = [];
  private offset = 0;
  private maxRows = 500;

  constructor(private readonly table: string) {}

  select(columns = "*") { this.columns = columns; return this; }
  insert(payload: any) { this.operation = "insert"; this.payload = payload; return this; }
  update(payload: any) { this.operation = "update"; this.payload = payload; return this; }
  delete() { this.operation = "delete"; return this; }
  eq(column: string, value: unknown) { this.filters.push({ op: "eq", column, value }); return this; }
  neq(column: string, value: unknown) { this.filters.push({ op: "neq", column, value }); return this; }
  order(_column: string, _options?: { ascending?: boolean }) { return this; }
  limit(count: number) { this.maxRows = Math.max(1, Math.min(Number(count) || 1, 2000)); return this; }
  range(from: number, to: number) { this.offset = Math.max(0, from); this.maxRows = Math.max(1, to - from + 1); return this; }

  private filterValue(column: string, op: "eq" | "neq" = "eq") {
    return this.filters.find((filter) => filter.column === column && filter.op === op)?.value;
  }

  private applyFilters(rows: any[]) {
    return rows.filter((row) => this.filters.every((f) => f.op === "eq" ? same(row?.[f.column], f.value) : !same(row?.[f.column], f.value)));
  }

  private async executeSelect(): Promise<any> {
    if (this.table === "social_posts") {
      const rows = this.applyFilters(await adminListSocialPosts<any>());
      return projectRows(rows.slice(this.offset, this.offset + this.maxRows), this.columns);
    }
    if (this.table === "seo_indexing_jobs") {
      const rows = this.applyFilters(await adminListIndexingJobs<any>(Math.max(200, this.offset + this.maxRows)));
      return projectRows(rows.slice(this.offset, this.offset + this.maxRows), this.columns);
    }

    if (!["books", "books_admin", "admin_book_catalog"].includes(this.table)) {
      throw new Error(`Unsupported admin select table: ${this.table}`);
    }

    const id = this.filterValue("id");
    if (typeof id === "string" && id && this.filterValue("id", "neq") === undefined) {
      const row = await adminGetBook<any>(id);
      const rows = row ? this.applyFilters([row]) : [];
      return projectRows(rows, this.columns);
    }

    const wanted = Math.min(2000, Math.max(this.offset + this.maxRows, 500));
    let rows = await adminListBooksPaged<any>(wanted, this.table === "admin_book_catalog" ? "catalog" : "full");
    rows = this.applyFilters(rows);
    return projectRows(rows.slice(this.offset, this.offset + this.maxRows), this.columns);
  }

  private async executeInsert(): Promise<any> {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    if (this.table === "books" || this.table === "books_admin") {
      const data = await adminCreateBooks<any>(rows);
      return projectRows(data, this.columns);
    }
    if (this.table === "book_assets") {
      const data = await adminCreateBookAssetsBulk<any>(rows);
      return projectRows(data, this.columns);
    }
    if (this.table === "admin_access_logs") {
      await adminLogAccess();
      return null;
    }
    if (this.table === "social_posts") {
      const data = [];
      for (const row of rows) data.push(await adminCreateSocialPost<any>(row));
      return Array.isArray(this.payload) ? projectRows(data, this.columns) : projectRow(data[0], this.columns);
    }
    throw new Error(`Unsupported admin insert table: ${this.table}`);
  }

  private async executeUpdate(): Promise<any> {
    const id = this.filterValue("id");
    if (typeof id !== "string" || !id) throw new Error("Row id is required");
    if (this.table === "books" || this.table === "books_admin") {
      const row = await adminUpdateBook<any>(id, this.payload || {});
      return projectRow(row, this.columns);
    }
    if (this.table === "social_posts") {
      const row = await adminUpdateSocialPost<any>(id, this.payload || {});
      return projectRow(row, this.columns);
    }
    if (this.table === "seo_indexing_jobs") {
      const row = await adminUpdateIndexingJob<any>(id, this.payload || {});
      return projectRow(row, this.columns);
    }
    throw new Error(`Unsupported admin update table: ${this.table}`);
  }

  private async executeDelete(): Promise<any> {
    if (this.table !== "books") throw new Error(`Unsupported admin delete table: ${this.table}`);
    const id = this.filterValue("id");
    if (typeof id !== "string" || !id) throw new Error("Book id is required");
    await adminDeleteBook(id);
    return null;
  }

  private async execute(): Promise<CompatResult<any>> {
    try {
      let data: any;
      if (this.operation === "select") data = await this.executeSelect();
      else if (this.operation === "insert") data = await this.executeInsert();
      else if (this.operation === "update") data = await this.executeUpdate();
      else data = await this.executeDelete();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: errorMessage(error) } };
    }
  }

  async maybeSingle(): Promise<CompatResult<any>> {
    const result = await this.execute();
    if (result.error) return result;
    const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
    return { data, error: null };
  }

  async single(): Promise<CompatResult<any>> { return this.maybeSingle(); }

  then<TResult1 = CompatResult<any>, TResult2 = never>(
    onfulfilled?: ((value: CompatResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

function mediaUrl(bucket: "covers" | "assets", path: string) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `/media/${bucket}/${encoded}`;
}

export const adminCloudflareCompat = {
  from(table: string) { return new AdminQueryBuilder(table); },

  async rpc(name: string): Promise<CompatResult<any>> {
    try {
      if (name === "published_today_count_ist") return { data: await adminPublishedTodayCount(), error: null };
      throw new Error(`Unsupported admin RPC: ${name}`);
    } catch (error) {
      return { data: null, error: { message: errorMessage(error) } };
    }
  },

  storage: {
    from(bucket: string) {
      const kind = bucket === "book-covers" ? "covers" : bucket === "book-assets" ? "assets" : null;
      return {
        async upload(path: string, file: File, _options?: Record<string, unknown>): Promise<CompatResult<{ path: string }>> {
          if (!kind) return { data: null, error: { message: `Unsupported storage bucket: ${bucket}` } };
          try {
            const result = await adminUploadObject(kind, path, file);
            uploadedUrls.set(`${bucket}:${path}`, result.publicUrl);
            return { data: { path: result.path }, error: null };
          } catch (error) {
            return { data: null, error: { message: errorMessage(error) } };
          }
        },
        getPublicUrl(path: string) {
          const publicUrl = uploadedUrls.get(`${bucket}:${path}`) || (kind ? mediaUrl(kind, path) : path);
          return { data: { publicUrl } };
        },
      };
    },
  },

  functions: {
    async invoke(name: string, options: { body?: any } = {}): Promise<CompatResult<any>> {
      const body = options.body || {};
      try {
        let data: any;
        if (name === "indexnow-submit") data = await adminSubmitIndexNow(Array.isArray(body.urls) ? body.urls : []);
        else if (name === "generate-book-cover") data = await adminGenerateCover(String(body.book_id || ""));
        else if (name === "generate-book-content") data = await adminGenerateContent(String(body.book_id || ""), body.language === "hi" ? "hi" : "en");
        else if (name === "polish-book-content") data = await adminPolishContent(String(body.book_id || ""));
        else if (name === "generate-mastery-assets") data = await adminGenerateMastery(body);
        else if (name === "admin-gsc") data = await adminGsc(body);
        else throw new Error(`Unsupported admin function: ${name}`);
        return { data, error: null };
      } catch (error) {
        return { data: null, error: { message: errorMessage(error) } };
      }
    },
  },
};
