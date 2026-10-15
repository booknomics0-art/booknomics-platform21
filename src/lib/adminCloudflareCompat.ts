import {
  adminCreateBookAssetsBulk,
  adminCreateBooks,
  adminDeleteBook,
  adminGenerateContent,
  adminGenerateCover,
  adminGenerateMastery,
  adminGetBook,
  adminListBooks,
  adminLogAccess,
  adminPolishContent,
  adminSubmitIndexNow,
  adminUpdateBook,
  adminUploadObject,
} from "@/lib/adminApi";

type CompatError = { message: string };
type CompatResult<T> = { data: T | null; error: CompatError | null };
type Operation = "select" | "insert" | "update" | "delete";
type Filter = { column: string; value: unknown };

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

class AdminQueryBuilder implements PromiseLike<CompatResult<any>> {
  private operation: Operation = "select";
  private payload: any = null;
  private columns = "*";
  private filters: Filter[] = [];
  private offset = 0;
  private limit = 500;

  constructor(private readonly table: string) {}

  select(columns = "*") {
    this.columns = columns;
    return this;
  }

  insert(payload: any) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: any) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(_column: string, _options?: { ascending?: boolean }) {
    // Worker admin list is already ordered newest-first, matching the portal.
    return this;
  }

  range(from: number, to: number) {
    this.offset = Math.max(0, from);
    this.limit = Math.max(1, to - from + 1);
    return this;
  }

  private filterValue(column: string) {
    return this.filters.find((filter) => filter.column === column)?.value;
  }

  private async executeSelect(): Promise<any> {
    const id = this.filterValue("id");
    if (typeof id === "string" && id) {
      const row = await adminGetBook<any>(id);
      return row ? [projectRow(row, this.columns)] : [];
    }

    const status = this.filterValue("status");
    const draft = this.filterValue("is_draft");
    const rows = await adminListBooks<any>({
      view: this.table === "admin_book_catalog" ? "catalog" : "full",
      limit: this.limit,
      offset: this.offset,
      status: typeof status === "string" ? status : undefined,
      isDraft: typeof draft === "boolean" ? draft : undefined,
    });
    return projectRows(rows, this.columns);
  }

  private async executeInsert(): Promise<any> {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    if (this.table === "books") {
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
    throw new Error(`Unsupported admin insert table: ${this.table}`);
  }

  private async executeUpdate(): Promise<any> {
    if (this.table !== "books") throw new Error(`Unsupported admin update table: ${this.table}`);
    const id = this.filterValue("id");
    if (typeof id !== "string" || !id) throw new Error("Book id is required");
    const row = await adminUpdateBook<any>(id, this.payload || {});
    return projectRow(row, this.columns);
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
  from(table: string) {
    return new AdminQueryBuilder(table);
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
        else throw new Error(`Unsupported admin function: ${name}`);
        return { data, error: null };
      } catch (error) {
        return { data: null, error: { message: errorMessage(error) } };
      }
    },
  },
};
