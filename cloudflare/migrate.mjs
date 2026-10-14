#!/usr/bin/env node

import { createHash, createHmac } from "node:crypto";

const env = (name, fallback = "") => (process.env[name] || fallback).trim();
const need = (name) => {
  const value = env(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const SOURCE_URL = env("SUPABASE_URL", "https://pbkfewrtdgiagytmcigb.supabase.co").replace(/\/$/, "");
const SOURCE_KEY = need("SUPABASE_SERVICE_ROLE_KEY");
const CF_ACCOUNT_ID = need("CLOUDFLARE_ACCOUNT_ID");
const CF_API_TOKEN = need("CLOUDFLARE_API_TOKEN");
const D1_ID = need("CLOUDFLARE_D1_DATABASE_ID");
const APPLY = env("MIGRATION_APPLY") === "YES";
const COPY_STORAGE = env("MIGRATE_STORAGE") === "YES";
const R2_ACCESS_KEY_ID = env("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = env("R2_SECRET_ACCESS_KEY");
const R2_COVERS_BUCKET = env("R2_COVERS_BUCKET", "booknomics-covers");
const R2_ASSETS_BUCKET = env("R2_ASSETS_BUCKET", "booknomics-assets");
const R2_HOST = `${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const SOURCE_PAGE = 500;
const MAX_D1_PARAMS = 96; // keep under Cloudflare D1's documented 100-parameter ceiling

const sourceHeaders = { apikey: SOURCE_KEY, authorization: `Bearer ${SOURCE_KEY}` };

const tables = [
  "books", "profiles", "book_assets", "book_catalog", "book_sources",
  "book_research_sources", "book_quality_audits", "book_quality_evidence",
  "seo_audits", "seo_indexing_jobs", "gsc_page_metrics", "gsc_query_metrics",
  "learning_paths", "learning_path_books", "path_enrollments", "subscriptions",
  "user_roles", "library", "reading_progress", "book_notes", "book_reviews",
  "review_upvotes", "comments", "reactions", "discussions", "discussion_replies",
  "discussion_votes", "habit_entries", "user_book_mastery", "app_settings",
  "url_redirects", "affiliate_clicks", "book_requests", "audio_summary_jobs",
  "backlink_records", "social_accounts", "social_posts", "promotion_logs",
  "admin_access_logs"
];

const excluded = [
  "api_audit_log", "audit_log", "audit_log_entries", "books_pre_quality_repair_20261011",
  "adsense_p0_backup_20261011", "r2_cover_migration_backup_20261013",
  "r2_og_migration_backup_20261013"
];

const hash = (v) => createHash("sha256").update(v).digest("hex");
const hmac = (key, value, encoding) => createHmac("sha256", key).update(value).digest(encoding);
const scalar = (v) => v == null ? null : typeof v === "boolean" ? (v ? 1 : 0) : typeof v === "object" ? JSON.stringify(v) : v;
const encodeKey = (key) => key.split("/").map(encodeURIComponent).join("/");

async function fetchText(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${url}: ${text.slice(0, 700)}`);
  return text;
}

async function d1(sql, params = []) {
  if (params.length > 100) throw new Error(`D1 parameter guard: ${params.length} > 100`);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_ID}/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${CF_API_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ sql, params })
    }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) throw new Error(`D1 failed: ${JSON.stringify(payload)?.slice(0, 1000)}`);
  return payload.result?.[0] || payload.result || {};
}

async function targetInfo(table) {
  try {
    const result = await d1(`PRAGMA table_info(${table})`);
    const rows = result.results || [];
    if (!rows.length) return null;
    return {
      columns: rows.map((r) => r.name),
      pk: rows.find((r) => Number(r.pk) === 1)?.name || null
    };
  } catch (error) {
    if (/no such table/i.test(String(error))) return null;
    throw error;
  }
}

async function sourceRows(table) {
  const all = [];
  for (let offset = 0; ; offset += SOURCE_PAGE) {
    const response = await fetch(
      `${SOURCE_URL}/rest/v1/${encodeURIComponent(table)}?select=*&limit=${SOURCE_PAGE}&offset=${offset}`,
      { headers: sourceHeaders }
    );
    if (response.status === 404) return null;
    const text = await response.text();
    if (!response.ok) {
      if (response.status === 400 && /does not exist/i.test(text)) return null;
      throw new Error(`${table}: ${response.status} ${text.slice(0, 700)}`);
    }
    const rows = JSON.parse(text);
    all.push(...rows);
    if (rows.length < SOURCE_PAGE) break;
  }
  return all;
}

async function authUsers() {
  const all = [];
  for (let page = 1; ; page += 1) {
    const payload = JSON.parse(await fetchText(
      `${SOURCE_URL}/auth/v1/admin/users?page=${page}&per_page=100`,
      { headers: sourceHeaders }
    ));
    const users = Array.isArray(payload) ? payload : (payload.users || []);
    all.push(...users);
    if (users.length < 100) break;
  }
  return all.map((user) => {
    const google = (user.identities || []).find((i) => i.provider === "google");
    const meta = user.user_metadata || {};
    return {
      id: user.id,
      email: user.email,
      password_hash: null,
      email_verified: user.email_confirmed_at ? 1 : 0,
      provider: google ? "google" : "email",
      created_at: user.created_at,
      updated_at: user.updated_at || user.created_at,
      google_sub: google?.identity_data?.sub || google?.id || null,
      display_name: meta.full_name || meta.name || null,
      avatar_url: meta.avatar_url || meta.picture || null,
      last_sign_in_at: user.last_sign_in_at || null
    };
  }).filter((u) => u.id && u.email);
}

function storagePath(url, bucket) {
  if (typeof url !== "string") return null;
  for (const marker of [`/storage/v1/object/public/${bucket}/`, `/storage/v1/render/image/public/${bucket}/`]) {
    const i = url.indexOf(marker);
    if (i >= 0) return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  }
  return null;
}

function normalize(table, row) {
  const out = { ...row };
  if (table === "books") {
    if (!out.cover_url || String(out.cover_url).includes("/functions/v1/book-cover-fallback")) {
      out.cover_url = `/api/covers/${out.id}.svg`;
    }
    for (const field of ["cover_url", "og_image"]) {
      const path = storagePath(out[field], "book-covers");
      if (path) out[field] = `/media/covers/${path}`;
    }
  }
  if (table === "book_assets") {
    for (const field of ["mindmap_url", "audio_url"]) {
      const path = storagePath(out[field], "book-assets");
      if (path) out[field] = `/media/assets/${path}`;
    }
  }
  if (table === "app_settings" && /(secret|password|private[_-]?key|service[_-]?role|access[_-]?token|refresh[_-]?token)/i.test(String(out.key || ""))) {
    return null;
  }
  return out;
}

async function upsert(table, source) {
  const info = await targetInfo(table);
  if (!info) return { source: source.length, written: 0, skipped: "missing target table" };
  if (!info.pk) throw new Error(`${table}: no single-column primary key`);
  const rows = source.map((r) => normalize(table, r)).filter(Boolean);
  if (!rows.length) return { source: source.length, written: 0 };

  const keys = new Set(rows.flatMap(Object.keys));
  const columns = info.columns.filter((c) => keys.has(c));
  if (!columns.includes(info.pk)) throw new Error(`${table}: primary key ${info.pk} missing from source`);

  const rowsPerBatch = Math.max(1, Math.floor(MAX_D1_PARAMS / columns.length));
  const updateColumns = columns.filter((c) => c !== info.pk);
  let written = 0;

  for (let i = 0; i < rows.length; i += rowsPerBatch) {
    const batch = rows.slice(i, i + rowsPerBatch);
    const values = batch.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
    const conflict = updateColumns.length
      ? `DO UPDATE SET ${updateColumns.map((c) => `${c}=excluded.${c}`).join(",")}`
      : "DO NOTHING";
    const sql = `INSERT INTO ${table} (${columns.join(",")}) VALUES ${values} ON CONFLICT(${info.pk}) ${conflict}`;
    const params = batch.flatMap((row) => columns.map((c) => scalar(row[c])));
    if (APPLY) await d1(sql, params);
    written += batch.length;
  }
  return { source: source.length, written, rowsPerBatch };
}

async function migrateDatabase() {
  const report = {};
  report.users = await upsert("users", await authUsers());
  console.log("users", report.users);
  for (const table of tables) {
    const rows = await sourceRows(table);
    if (rows === null) {
      console.log(`skip ${table}: source unavailable`);
      continue;
    }
    report[table] = await upsert(table, rows);
    console.log(table, report[table]);
  }
  return report;
}

function signedHeaders(method, bucket, key, payloadHash) {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error("R2 credentials missing");
  const now = new Date();
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amz.slice(0, 8);
  const uri = `/${encodeURIComponent(bucket)}/${encodeKey(key)}`;
  const canonicalHeaders = `host:${R2_HOST}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amz}\n`;
  const signed = "host;x-amz-content-sha256;x-amz-date";
  const canonical = [method, uri, "", canonicalHeaders, signed, payloadHash].join("\n");
  const scope = `${date}/auto/s3/aws4_request`;
  const toSign = `AWS4-HMAC-SHA256\n${amz}\n${scope}\n${hash(canonical)}`;
  const kd = hmac(Buffer.from(`AWS4${R2_SECRET_ACCESS_KEY}`), date);
  const kr = hmac(kd, "auto");
  const ks = hmac(kr, "s3");
  const ksign = hmac(ks, "aws4_request");
  const signature = hmac(ksign, toSign, "hex");
  return {
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
    authorization: `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signed}, Signature=${signature}`
  };
}

async function r2Exists(bucket, key) {
  const empty = hash(Buffer.alloc(0));
  const response = await fetch(`https://${R2_HOST}/${encodeURIComponent(bucket)}/${encodeKey(key)}`, {
    method: "HEAD", headers: signedHeaders("HEAD", bucket, key, empty)
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`R2 HEAD ${bucket}/${key}: ${response.status}`);
  return true;
}

async function r2Put(bucket, key, body, type) {
  const buffer = Buffer.from(body);
  const response = await fetch(`https://${R2_HOST}/${encodeURIComponent(bucket)}/${encodeKey(key)}`, {
    method: "PUT",
    headers: {
      ...signedHeaders("PUT", bucket, key, hash(buffer)),
      "content-type": type || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable"
    },
    body: buffer
  });
  if (!response.ok) throw new Error(`R2 PUT ${bucket}/${key}: ${response.status} ${(await response.text()).slice(0, 400)}`);
}

async function storageObjects(bucket) {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = JSON.parse(await fetchText(
      `${SOURCE_URL}/storage/v1/object/list/${encodeURIComponent(bucket)}`,
      {
        method: "POST",
        headers: { ...sourceHeaders, "content-type": "application/json" },
        body: JSON.stringify({ prefix: "", limit: 1000, offset, sortBy: { column: "name", order: "asc" } })
      }
    ));
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

async function copyStorage(sourceBucket, targetBucket) {
  const objects = await storageObjects(sourceBucket);
  const report = { source: objects.length, copied: 0, skippedExisting: 0, bytes: 0 };
  if (!COPY_STORAGE || !APPLY) return report;

  let cursor = 0;
  const worker = async () => {
    while (cursor < objects.length) {
      const item = objects[cursor++];
      const key = item.name;
      if (!key) continue;
      if (await r2Exists(targetBucket, key)) {
        report.skippedExisting++;
        continue;
      }
      const source = await fetch(`${SOURCE_URL}/storage/v1/object/public/${encodeURIComponent(sourceBucket)}/${encodeKey(key)}`, { headers: sourceHeaders });
      if (!source.ok) throw new Error(`source object ${sourceBucket}/${key}: ${source.status}`);
      const body = await source.arrayBuffer();
      await r2Put(targetBucket, key, body, source.headers.get("content-type") || item.metadata?.mimetype);
      report.copied++;
      report.bytes += body.byteLength;
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  return report;
}

async function verify() {
  const source = await sourceRows("books");
  const target = await d1("SELECT COUNT(*) total, SUM(CASE WHEN is_draft=0 AND status='published' THEN 1 ELSE 0 END) published FROM books");
  const row = target.results?.[0] || {};
  const result = {
    sourceTotal: source.length,
    sourcePublished: source.filter((b) => b.is_draft === false && b.status === "published").length,
    targetTotal: Number(row.total || 0),
    targetPublished: Number(row.published || 0)
  };
  if (result.sourceTotal !== result.targetTotal || result.sourcePublished !== result.targetPublished) {
    throw new Error(`book parity failed: ${JSON.stringify(result)}`);
  }
  return result;
}

async function main() {
  console.log(`Booknomics migration mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Excluded from primary D1: ${excluded.join(", ")}`);
  const database = await migrateDatabase();
  const storage = {
    covers: await copyStorage("book-covers", R2_COVERS_BUCKET),
    assets: await copyStorage("book-assets", R2_ASSETS_BUCKET)
  };
  const parity = APPLY ? await verify() : null;
  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", database, storage, parity }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
