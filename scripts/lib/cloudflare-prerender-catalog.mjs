// Read-only Cloudflare D1 catalog bridge for existing SEO prerender scripts.
// The scripts currently express queries in PostgREST's URL syntax. Translate
// just the supported safe subset; reject anything unexpected rather than
// silently generating incomplete or incorrectly indexed pages.
export const cloudflarePrerender = (process.env.VITE_DATA_BACKEND || "cloudflare").trim().toLowerCase() === "cloudflare";

const API = (process.env.PRERENDER_CATALOG_API || process.env.VITE_API_BASE || "").trim().replace(/\/$/, "");

export async function fetchCloudflarePrerenderBooks(path) {
  if (!cloudflarePrerender) throw new Error("Cloudflare catalog bridge used in Supabase rollback mode");
  if (!API || !/^https:\/\//.test(API)) throw new Error("PRERENDER_CATALOG_API must be set to a verified HTTPS Cloudflare Worker origin");
  const input = new URL(path, "https://catalog.internal/");
  if (input.pathname !== "/books") throw new Error(`Unsupported prerender resource: ${input.pathname}`);
  const params = input.searchParams;
  if (params.get("is_draft") !== "eq.false") throw new Error("Prerender query must exclude drafts");
  const statuses = params.get("status");
  // PostgREST emits in.(published) for one-item arrays (as used by fetchPaged).
  const status = statuses === "eq.published" || statuses === "in.(published)" ? "published"
    : statuses === "in.(published,published_noindex)" ? "all" : null;
  if (!status) throw new Error(`Unsupported prerender statuses: ${statuses}`);
  const languageFilter = params.get("language");
  if (languageFilter && !["eq.en", "eq.hi"].includes(languageFilter)) throw new Error(`Unsupported language filter: ${languageFilter}`);
  const sortFilter = params.get("order") || "title.asc";
  const sort = sortFilter === "id.asc" || sortFilter === "id" ? "id"
    : sortFilter === "category.asc,title.asc" ? "category" : sortFilter === "title.asc" ? "az" : null;
  if (!sort) throw new Error(`Unsupported prerender sort: ${sortFilter}`);
  const fields = params.get("select");
  if (!fields || !/^[a-z_,]+$/.test(fields)) throw new Error("Prerender field list missing or unsupported");
  const out = new URLSearchParams({ view: "prerender", fields, status, sort,
    limit: params.get("limit") || "200" });
  if (languageFilter) out.set("language", languageFilter.slice(3));
  if (params.has("offset")) out.set("offset", params.get("offset"));
  const afterId = params.get("id");
  if (afterId) {
    if (sort !== "id" || !/^gt\.[0-9a-f-]{36}$/i.test(afterId)) throw new Error("Unsupported catalog keyset pagination");
    out.set("after_id", afterId.slice(3));
  }
  const response = await fetch(`${API}/api/catalog/books?${out.toString()}`, {
    headers: { accept: "application/json" },
    signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(30_000) : undefined,
  });
  if (!response.ok) throw new Error(`Cloudflare prerender catalog HTTP ${response.status}: ${(await response.text()).slice(0, 250)}`);
  const payload = await response.json();
  if (!Array.isArray(payload?.data)) throw new Error("Cloudflare prerender catalog must return data array");
  if (payload.data.length > Number(out.get("limit"))) throw new Error("Cloudflare catalog returned too many rows");
  const keys = fields.split(",");
  if (payload.data.some(row => !row || typeof row !== "object" || keys.some(key => !Object.prototype.hasOwnProperty.call(row, key)))) {
    throw new Error("Cloudflare prerender catalog is missing required fields; deploy the upgraded Worker before SEO generation");
  }
  return payload.data;
}
