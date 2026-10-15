import { apiFetch, apiRawFetch } from "@/lib/cloudflareApi";

export type AdminApiResult<T> = { data: T };

export type AdminBookListParams = {
  view?: "catalog" | "full";
  id?: string;
  limit?: number;
  offset?: number;
  status?: string;
  isDraft?: boolean;
};

function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}

export async function adminListBooks<T = any>(params: AdminBookListParams = {}) {
  const result = await apiFetch<AdminApiResult<T[]>>(`/api/admin/books${query({
    view: params.view,
    id: params.id,
    limit: params.limit,
    offset: params.offset,
    status: params.status,
    is_draft: params.isDraft,
  })}`);
  return result.data || [];
}

export async function adminGetBook<T = any>(id: string) {
  const rows = await adminListBooks<T>({ view: "full", id, limit: 1 });
  return rows[0] ?? null;
}

export async function adminCreateBooks<T = any>(rows: unknown[]) {
  const result = await apiFetch<AdminApiResult<T[]>>("/api/admin/books", {
    method: "POST",
    body: JSON.stringify(rows),
  });
  return result.data || [];
}

export async function adminUpdateBook<T = any>(id: string, patch: Record<string, unknown>) {
  const result = await apiFetch<AdminApiResult<T>>(`/api/admin/books/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return result.data;
}

export async function adminDeleteBook(id: string) {
  return apiFetch<{ ok: true }>(`/api/admin/books/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function adminGetBookAssets<T = any>(bookId: string) {
  const result = await apiFetch<AdminApiResult<T | null>>(`/api/admin/book-assets/${encodeURIComponent(bookId)}`);
  return result.data ?? null;
}

export async function adminPutBookAssets<T = any>(bookId: string, payload: Record<string, unknown>) {
  const result = await apiFetch<AdminApiResult<T>>(`/api/admin/book-assets/${encodeURIComponent(bookId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return result.data;
}

export async function adminCreateBookAssetsBulk<T = any>(rows: unknown[]) {
  const result = await apiFetch<AdminApiResult<T[]>>("/api/admin/book-assets", {
    method: "POST",
    body: JSON.stringify(rows),
  });
  return result.data || [];
}

export async function adminUploadObject(
  bucket: "covers" | "assets",
  path: string,
  file: File,
): Promise<{ path: string; publicUrl: string }> {
  const form = new FormData();
  form.set("path", path);
  form.set("file", file);
  const response = await apiRawFetch(`/api/admin/storage/${bucket}`, { method: "POST", body: form });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok) throw new Error(payload?.error || `Upload failed (${response.status})`);
  return payload.data;
}

export async function adminLogAccess() {
  return apiFetch<{ ok: true }>("/api/admin/access-log", {
    method: "POST",
    body: JSON.stringify({ user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null }),
  });
}

export async function adminSubmitIndexNow(urls: string[]) {
  return apiFetch<{ submitted: number; results: unknown[] }>("/api/admin/indexnow", {
    method: "POST",
    body: JSON.stringify({ urls }),
  });
}

export async function adminGenerateCover(bookId: string) {
  return apiFetch<any>("/api/admin/ai/generate-cover", {
    method: "POST",
    body: JSON.stringify({ book_id: bookId }),
  });
}

export async function adminGenerateContent(bookId: string, language: "en" | "hi") {
  return apiFetch<any>("/api/admin/ai/generate-content", {
    method: "POST",
    body: JSON.stringify({ book_id: bookId, language }),
  });
}

export async function adminPolishContent(bookId: string) {
  return apiFetch<any>("/api/admin/ai/polish-content", {
    method: "POST",
    body: JSON.stringify({ book_id: bookId }),
  });
}

export async function adminGenerateMastery(payload: Record<string, unknown>) {
  return apiFetch<any>("/api/admin/ai/mastery", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminGetN8nSetting<T = any>() {
  const result = await apiFetch<AdminApiResult<T | null>>("/api/admin/settings/n8n");
  return result.data ?? null;
}

export async function adminPutN8nSetting(url: string) {
  const result = await apiFetch<AdminApiResult<any>>("/api/admin/settings/n8n", {
    method: "PUT",
    body: JSON.stringify({ url }),
  });
  return result.data;
}

export async function adminListPromotions<T = any>(limit = 100) {
  const result = await apiFetch<AdminApiResult<T[]>>(`/api/admin/promotions?limit=${encodeURIComponent(String(limit))}`);
  return result.data || [];
}

export async function adminDispatchN8n(payload: Record<string, unknown>) {
  return apiFetch<any>("/api/admin/dispatch-n8n", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminGetSeoAudit<T = any>(bookId: string) {
  const result = await apiFetch<AdminApiResult<T | null>>(`/api/admin/seo-audits/${encodeURIComponent(bookId)}`);
  return result.data ?? null;
}
