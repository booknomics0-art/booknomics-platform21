#!/usr/bin/env node

import { createHash, createHmac } from "node:crypto";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const SOURCE_URL = (process.env.SUPABASE_URL || "https://pbkfewrtdgiagytmcigb.supabase.co").replace(/\/$/, "");
const SOURCE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const CF_ACCOUNT_ID = required("CLOUDFLARE_ACCOUNT_ID");
const CF_API_TOKEN = required("CLOUDFLARE_API_TOKEN");
const D1_DATABASE_ID = required("CLOUDFLARE_D1_DATABASE_ID");
const APPLY = process.env.MIGRATION_APPLY === "YES";
const COPY_STORAGE = process.env.MIGRATE_STORAGE === "YES";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID?.trim();
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY?.trim();
const R2_COVERS_BUCKET = process.env.R2_COVERS_BUCKET?.trim() || "booknomics-covers";
const R2_ASSETS_BUCKET = process.env.R2_ASSETS_BUCKET?.trim() || "booknomics-assets";
const R2_HOST = `${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const PAGE_SIZE = 500;
const D1_BATCH_SIZE = 40;
const STORAGE_CONCURRENCY = 5;

const activeTables = [
  "books",
  "profiles",
  "book_assets",
  "book_catalog",
  "book_sources",
  "book_research_sources",
  "book_quality_audits",
  "book_quality_evidence",
  "seo_audits",
  "seo_indexing_jobs",
  "gsc_page_metrics",
  "gsc_query_metrics",
  "learning_paths",
  "learning_path_books",
  "path_enrollments",
  "subscriptions",
  "user_roles",
  "library",
  "reading_progress",
  "book_notes",
  "book_reviews",
  "review_upvotes",
  "comments",
  "reactions",
  "discussions",
  "discussion_replies",
  "discussion_votes",
  "habit_entries",
  "user_book_mastery",
  "app_settings",
  "url_redirects",
  "affiliate_clicks",
  "book_requests",
  "audio_summary_jobs",
  "backlink_records",
  "social_accounts",
  "social_posts",
  "promotion_logs",
  "admin_access_logs",
];

const excludedSourceTables = [
  "api_audit_log",
  "audit_log",
  "audit_log_entries",
  "books_pre_quality_repair_20261011",
  "adsense_p0_backup_20261011",
  "r2_cover_migration_backup_20261013",
  "r2_og_migration_backup_20261013",
];

const sourceHeaders = {
  apikey: SOURCE_KEY,
  authorization: `Bearer ${SOURCE_KEY}`,
};

const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const hmac = (key, value, encoding) => createHmac("sha256", key).update(value).digest(encoding);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, init = {}, label = url) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${label} failed: ${response.status} ${body.slice(0, 800)}`);
  }
  return response.json();
}

async function d1Query(sql, params = []) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${CF_API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(`D1 query failed (${response.status}): ${JSON.stringify(payload)?.slice(0, 1200)}`);
  }
  return payload.result?.[0] || payload.result || {};
}

async function targetColumns(table) {
  try {
    const result = await d1Query(`PRAGMA table_info(${table})`);
    const rows = result.results || [];
    return {
      columns: rows.map((row) => row.name),
      primaryKey: rows.find((row) => Number(row.pk) === 1)?.name || null,
    };
  } catch (error) {
    if (/no such table/i.test(String(error))) return null;
    throw error;
  }
}

async function sourceRows(table) {
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = `${SOURCE_URL}/rest/v1/${encodeURIComponent(table)}?select=*&limit=${PAGE_SIZE}&offset=${offset}`;
    const response = await fetch(url, { headers: sourceHeaders });
    if (response.status === 404) return null;
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      if (response.status === 400 && /relation .* does not exist/i.test(body)) return null;
      throw new Error(`Source ${table} failed: ${response.status} ${body.slice(0, 800)}`);
    }
    const rows = await response.json();
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

async function sourceUsers() {
  const all = [];
  for (let page = 1; ; page += 1) {
    const payload = await fetchJson(
      `${SOURCE_URL}/auth/v1/admin/users?page=${page}&per_page=100`,
      { headers: sourceHeaders },
      "Supabase auth users",
    );
    const users = Array.isArray(payload) ? payload : payload.users || [];
    all.push(...users);
    if (users.length < 100) break;
  }
  return all;
}

const scalar = (value) => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
};

const storagePathFromUrl = (value, bucket) => {
  if (typeof value !== "string") return null;
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/render/image/public/${bucket}/`,
  ];
  for (const marker of markers) {
    const index = value.indexOf(marker);
    if (index !== -1) return decodeURIComponent(value.slice(index + marker.length).split("?")[0]);
  }
  return null;
};

const normalizeRow = (table, row) => {
  const copy = { ...row };

  if (table === "books") {
    if (
      typeof copy.cover_url === "string" &&
      copy.cover_url.includes("pbkfewrtdgiagytmcigb.supabase.co/functions/v1/book-cover-fallback")
    ) {
      copy.cover_url = `/api/covers/${copy.id}.svg`;
    }
    if (!copy.cover_url) copy.cover_url = `/api/covers/${copy.id}.svg`;

    for (const field of ["cover_url", "og_image"]) {
      const path = storagePathFromUrl(copy[field], "book-covers");
      if (path) copy[field] = `/media/covers/${path}`;
    }
  }

  if (table === "book_assets") {
    for (const field of ["mindmap_url", "audio_url"]) {
      const path = storagePathFromUrl(copy[field], "book-assets");
      if (path) copy[field] = `/media/assets/${path}`;
    }
  }

  if (table === "app_settings") {
    const key = String(copy.key || "");
    if (/(secret|password|private[_-]?key|service[_-]?role|access[_-]?token|refresh[_-]?token)/i.test(key)) {
      return null;
    }
  }

  return copy;
};

async function upsertRows(table, rawRows) {
  const info = await targetColumns(table);
  if (!info) {
    console.log(`SKIP ${table}: no target table`);
    return { source: rawRows.length, written: 0 };
  }
  if (!info.primaryKey) throw new Error(`Target table ${table} has no single-column primary key`);

  const rows = rawRows.map((row) => normalizeRow(table, row)).filter(Boolean);
  if (!rows.length) return { source: rawRows.length, written: 0 };

  const sourceKeys = new Set(rows.flatMap((row) => Object.keys(row)));
  const columns = info.columns.filter((column) => sourceKeys.has(column));
  if (!columns.includes(info.primaryKey)) {
    throw new Error(`Source rows for ${table} do not contain target primary key ${info.primaryKey}`);
  }

  let written = 0;
  for (let start = 0; start < rows.length; start += D1_BATCH_SIZE) {
    const batch = rows.slice(start, start + D1_BATCH_SIZE);
    const placeholders = batch.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
    const updateColumns = columns.filter((column) => column !== info.primaryKey);
    const conflict = updateColumns.length
      ? `DO UPDATE SET ${updateColumns.map((column) => `${column}=excluded.${column}`).join(",")}`
      : "DO NOTHING";
    const sql = `INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders} ON CONFLICT(${info.primaryKey}) ${conflict}`;
    const params = batch.flatMap((row) => columns.map((column) => scalar(row[column])));
    if (APPLY) await d1Query(sql, params);
    written += batch.length;
    if (APPLY && start > 0 && start % 1000 === 0) await sleep(150);
  }

  return { source: rawRows.length, written };
}

async function importUsers() {
  const source = await sourceUsers();
  const rows = source
    .filter((user) => user.id && user.email)
    .map((user) => {
      const googleIdentity = (user.identities || []).find((identity) => identity.provider === "google");
      const metadata = user.user_metadata || {};
      return {
        id: user.id,
        email: user.email,
        password_hash: null,
        email_verified: user.email_confirmed_at ? 1 : 0,
        provider: googleIdentity ? "google" : "email",
        created_at: user.created_at || new Date().toISOString(),
        updated_at: user.updated_at || user.created_at || new Date().toISOString(),
        google_sub: googleIdentity?.identity_data?.sub || googleIdentity?.id || null,
        display_name: metadata.full_name || metadata.name || null,
        avatar_url: metadata.avatar_url || metadata.picture || null,
        last_sign_in_at: user.last_sign_in_at || null,
      };
    });
  const result = await upsertRows("users", rows);
  console.log(`users: ${result.written}/${result.source}`);
  return result;
}

async function importDatabase() {
  const summary = {};
  summary.users = await importUsers();

  for (const table of activeTables) {
    const rows = await sourceRows(table);
    if (rows === null) {
      console.log(`SKIP ${table}: source table not found/exposed`);
      continue;
    }
    const result = await upsertRows(table, rows);
    summary[table] = result;
    console.log(`${table}: ${result.written}/${result.source}`);
  }

  return summary;
}

function amzDate(now = new Date()) {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function encodeKey(key) {
  return key.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function r2SignedHeaders(method, bucket, key, payloadHash, extraHeaders = {}) {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error("R2 credentials are required for storage migration");
  const now = new Date();
  const xAmzDate = amzDate(now);
  const dateStamp = xAmzDate.slice(0, 8);
  const canonicalUri = `/${encodeURIComponent(bucket)}/${encodeKey(key)}`;
  const canonicalHeaders = `host:${R2_HOST}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${xAmzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${xAmzDate}\n${scope}\n${sha256Hex(canonicalRequest)}`;
  const kDate = hmac(Buffer.from(`AWS4${R2_SECRET_ACCESS_KEY}`), dateStamp);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return {
    ...extraHeaders,
    host: R2_HOST,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": xAmzDate,
    authorization,
  };
}

async function r2Head(bucket, key) {
  const payloadHash = sha256Hex(Buffer.alloc(0));
  const headers = r2SignedHeaders("HEAD", bucket, key, payloadHash);
  const response = await fetch(`https://${R2_HOST}/${encodeURIComponent(bucket)}/${encodeKey(key)}`, { method: "HEAD", headers });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`R2 HEAD ${bucket}/${key} failed: ${response.status}`);
  return true;
}

async function r2Put(bucket, key, body, contentType) {
  const buffer = Buffer.from(body);
  const payloadHash = sha256Hex(buffer);
  const headers = r2SignedHeaders("PUT", bucket, key, payloadHash, {
    "content-type": contentType || "application/octet-stream",
    "cache-control": "public, max-age=31536000, immutable",
  });
  const response = await fetch(`https://${R2_HOST}/${encodeURIComponent(bucket)}/${encodeKey(key)}`, {
    method: "PUT",
    headers,
    body: buffer,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`R2 PUT ${bucket}/${key} failed: ${response.status} ${text.slice(0, 500)}`);
  }
}

async function listStorageObjects(bucket) {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = await fetchJson(
      `${SOURCE_URL}/storage/v1/object/list/${encodeURIComponent(bucket)}`,
      {
        method: "POST",
        headers: { ...sourceHeaders, "content-type": "application/json" },
        body: JSON.stringify({ prefix: "", limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
      },
      `storage list ${bucket}`,
    );
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

async function mapConcurrent(items, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (next < items.length) {
      const index = next++;
      await fn(items[index], index);
    }
  });
  await Promise.all(workers);
}

async function copyBucket(sourceBucket, targetBucket) {
  const objects = await listStorageObjects(sourceBucket);
  const stats = { source: objects.length, copied: 0, skipped: 0, bytes: 0 };
  console.log(`${sourceBucket}: ${objects.length} source objects`);

  if (!COPY_STORAGE) return stats;
  if (!APPLY) {
    console.log(`${sourceBucket}: MIGRATE_STORAGE=YES but dry-run mode; no writes performed`);
    return stats;
  }

  await mapConcurrent(objects, STORAGE_CONCURRENCY, async (object, index) => {
    const key = object.name;
    if (!key) return;
    if (await r2Head(targetBucket, key)) {
      stats.skipped += 1;
      return;
    }

    const sourceUrl = `${SOURCE_URL}/storage/v1/object/public/${encodeURIComponent(sourceBucket)}/${encodeKey(key)}`;
    const source = await fetch(sourceUrl, { headers: sourceHeaders });
    if (!source.ok) throw new Error(`Source object failed ${source.status}: ${sourceBucket}/${key}`);
    const bytes = await source.arrayBuffer();
    await r2Put(targetBucket, key, bytes, source.headers.get("content-type") || object.metadata?.mimetype);
    stats.copied += 1;
    stats.bytes += bytes.byteLength;
    if (index > 0 && index % 250 === 0) console.log(`${sourceBucket}: processed ${index}/${objects.length}`);
  });

  return stats;
}

async function verifyCoreCounts() {
  const sourceBooks = await sourceRows("books");
  const targetBooks = await d1Query("SELECT COUNT(*) AS total, SUM(CASE WHEN is_draft = 0 AND status = 'published' THEN 1 ELSE 0 END) AS published FROM books");
  const sourcePublished = (sourceBooks || []).filter((row) => row.is_draft === false && row.status === "published").length;
  const target = targetBooks.results?.[0] || {};
  return {
    source: { total: sourceBooks?.length || 0, published: sourcePublished },
    target: { total: Number(target.total || 0), published: Number(target.published || 0) },
  };
}

async function main() {
  console.log(`Booknomics Cloudflare migration: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Source: ${SOURCE_URL}`);
  console.log(`Excluded primary-D1 tables: ${excludedSourceTables.join(", ")}`);

  const database = await importDatabase();
  const storage = {
    covers: await copyBucket("book-covers", R2_COVERS_BUCKET),
    assets: await copyBucket("book-assets", R2_ASSETS_BUCKET),
  };
  const counts = APPLY ? await verifyCoreCounts() : null;

  const report = { mode: APPLY ? "apply" : "dry-run", database, storage, counts };
  console.log(JSON.stringify(report, null, 2));

  if (APPLY && counts && (counts.source.total !== counts.target.total || counts.source.published !== counts.target.published)) {
    throw new Error(`Book count parity failed: ${JSON.stringify(counts)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
