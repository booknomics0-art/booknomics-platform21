import crypto from "node:crypto";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const hmac = (key, value, encoding) => crypto.createHmac("sha256", key).update(value).digest(encoding);
const encodePath = (value) => value.split("/").map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join("/");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function extFor(contentType, sourceUrl) {
  const type = (contentType || "").split(";")[0].trim().toLowerCase();
  if (type === "image/webp") return "webp";
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/avif") return "avif";
  if (type === "image/gif") return "gif";
  try {
    const pathname = new URL(sourceUrl).pathname.toLowerCase();
    const match = pathname.match(/\.(webp|jpe?g|png|avif|gif)$/);
    if (match) return match[1] === "jpeg" ? "jpg" : match[1];
  } catch {}
  return "img";
}

async function putR2({ key, body, contentType }) {
  const endpoint = required("R2_ENDPOINT").replace(/\/$/, "");
  const bucket = required("R2_BUCKET_NAME");
  const accessKey = required("R2_ACCESS_KEY_ID");
  const secretKey = required("R2_SECRET_ACCESS_KEY");

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const host = new URL(endpoint).host;
  const canonicalUri = `/${encodePath(bucket)}/${encodePath(key)}`;
  const cacheControl = "public, max-age=31536000, immutable";
  const canonicalHeaders = `cache-control:${cacheControl}\ncontent-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "cache-control;content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
  const kDate = hmac(Buffer.from(`AWS4${secretKey}`, "utf8"), dateStamp);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`${endpoint}${canonicalUri}`, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Cache-Control": cacheControl,
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate
    },
    body
  });
  if (!response.ok) throw new Error(`R2 PUT failed ${response.status}: ${(await response.text()).slice(0, 250)}`);
}

function supabaseHeaders() {
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function supabaseStoragePattern() {
  const base = required("SUPABASE_URL").replace(/\/$/, "");
  const host = new URL(base).host;
  return `*${host}/storage/v1/*`;
}

async function getBooks(limit) {
  const base = required("SUPABASE_URL").replace(/\/$/, "");
  const params = new URLSearchParams();
  params.set("select", "id,title,cover_url,og_image");
  params.set("cover_url", `like.${supabaseStoragePattern()}`);
  params.set("order", "id.asc");
  params.set("limit", String(limit));
  const response = await fetch(`${base}/rest/v1/books?${params}`, { headers: supabaseHeaders() });
  if (!response.ok) throw new Error(`Supabase list failed ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

async function remainingCount() {
  const base = required("SUPABASE_URL").replace(/\/$/, "");
  const params = new URLSearchParams();
  params.set("select", "id");
  params.set("cover_url", `like.${supabaseStoragePattern()}`);
  const response = await fetch(`${base}/rest/v1/books?${params}`, {
    headers: { ...supabaseHeaders(), Prefer: "count=exact", Range: "0-0" }
  });
  if (!response.ok) return null;
  const range = response.headers.get("content-range") || "";
  const match = range.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function patchBook(book, publicUrl) {
  const base = required("SUPABASE_URL").replace(/\/$/, "");
  const params = new URLSearchParams();
  params.set("id", `eq.${book.id}`);
  params.set("cover_url", `eq.${book.cover_url}`);
  const body = { cover_url: publicUrl };
  if (typeof book.og_image === "string" && book.og_image.includes("/storage/v1/")) body.og_image = publicUrl;

  const response = await fetch(`${base}/rest/v1/books?${params}`, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Supabase update failed ${response.status}: ${(await response.text()).slice(0, 250)}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("Supabase guarded update did not match exactly one row");
}

async function migrateBook(book, publicBase, updateDb) {
  const source = await fetch(book.cover_url, { headers: { "User-Agent": "Booknomics-R2-Migration/1.0" } });
  if (!source.ok) throw new Error(`Source fetch failed ${source.status}`);
  const contentType = (source.headers.get("content-type") || "application/octet-stream").split(";")[0];
  if (!contentType.startsWith("image/")) throw new Error(`Unexpected source content-type: ${contentType}`);
  const body = Buffer.from(await source.arrayBuffer());
  if (!body.length) throw new Error("Source image was empty");
  if (body.length > 25 * 1024 * 1024) throw new Error(`Source image too large: ${body.length} bytes`);

  const ext = extFor(contentType, book.cover_url);
  const key = `covers/${book.id}.${ext}`;
  await putR2({ key, body, contentType });
  const publicUrl = `${publicBase}/${key}`;
  const verify = await fetch(publicUrl, { method: "HEAD", cache: "no-store" });
  if (!verify.ok) throw new Error(`R2 public verification failed ${verify.status}`);
  if (updateDb) await patchBook(book, publicUrl);
  return { id: book.id, title: book.title, bytes: body.length, publicUrl, updated: updateDb };
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      try {
        results[index] = { ok: true, ...(await worker(items[index])) };
      } catch (error) {
        results[index] = {
          ok: false,
          id: items[index]?.id,
          title: items[index]?.title,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
  return results;
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "https://booknomics.local");
    if (url.searchParams.get("token") !== process.env.R2_MIGRATION_TOKEN) return res.status(401).json({ ok: false });

    const requested = Number.parseInt(url.searchParams.get("limit") || "100", 10);
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(requested, 300)) : 100;
    const updateDb = url.searchParams.get("update") !== "0";
    const publicBase = required("R2_PUBLIC_URL").replace(/\/$/, "");

    const before = await remainingCount();
    const books = await getBooks(limit);
    const results = await runPool(books, 10, (book) => migrateBook(book, publicBase, updateDb));
    const success = results.filter((item) => item?.ok).length;
    const failed = results.length - success;
    const after = updateDb ? await remainingCount() : before;

    return res.status(failed === 0 ? 200 : 207).json({
      ok: failed === 0,
      selected: books.length,
      success,
      failed,
      remainingBefore: before,
      remainingAfter: after,
      updateDb,
      failures: results.filter((item) => !item?.ok).slice(0, 50),
      samples: results.filter((item) => item?.ok).slice(0, 10)
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
