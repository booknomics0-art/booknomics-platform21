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
const R2_ACCESS_KEY_ID = need("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = need("R2_SECRET_ACCESS_KEY");
const R2_COVERS_BUCKET = env("R2_COVERS_BUCKET", "booknomics-covers");
const R2_ASSETS_BUCKET = env("R2_ASSETS_BUCKET", "booknomics-assets");
const APPLY = env("MIGRATION_APPLY") === "YES" && env("MIGRATE_STORAGE") === "YES";
const VERIFY_EXISTING = env("MIGRATION_VERIFY_EXISTING") === "YES";
const R2_HOST = `${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const sourceHeaders = { apikey: SOURCE_KEY, authorization: `Bearer ${SOURCE_KEY}` };

const hash = (v) => createHash("sha256").update(v).digest("hex");
const hmac = (key, value, encoding) => createHmac("sha256", key).update(value).digest(encoding);
const encodeKey = (key) => key.split("/").map(encodeURIComponent).join("/");

async function fetchText(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${url}: ${text.slice(0, 700)}`);
  return text;
}

function signedHeaders(method, bucket, key, payloadHash) {
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

async function r2Head(bucket, key) {
  const empty = hash(Buffer.alloc(0));
  const response = await fetch(`https://${R2_HOST}/${encodeURIComponent(bucket)}/${encodeKey(key)}`, {
    method: "HEAD",
    headers: signedHeaders("HEAD", bucket, key, empty)
  });
  if (response.status === 404) return { exists: false, size: null, lastModified: null };
  if (!response.ok) throw new Error(`R2 HEAD ${bucket}/${key}: ${response.status}`);
  const rawSize = response.headers.get("content-length");
  const rawModified = response.headers.get("last-modified");
  return {
    exists: true,
    size: rawSize && Number.isFinite(Number(rawSize)) ? Number(rawSize) : null,
    lastModified: rawModified ? Date.parse(rawModified) : null
  };
}

async function r2GetHash(bucket, key) {
  const empty = hash(Buffer.alloc(0));
  const response = await fetch(`https://${R2_HOST}/${encodeURIComponent(bucket)}/${encodeKey(key)}`, {
    method: "GET",
    headers: signedHeaders("GET", bucket, key, empty)
  });
  if (!response.ok) throw new Error(`R2 GET ${bucket}/${key}: ${response.status}`);
  return hash(Buffer.from(await response.arrayBuffer()));
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

async function listPrefix(bucket, prefix = "") {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const page = JSON.parse(await fetchText(
      `${SOURCE_URL}/storage/v1/object/list/${encodeURIComponent(bucket)}`,
      {
        method: "POST",
        headers: { ...sourceHeaders, "content-type": "application/json" },
        body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } })
      }
    ));
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function walkStorage(bucket, prefix = "", seen = new Set()) {
  const result = [];
  const rows = await listPrefix(bucket, prefix);
  for (const item of rows) {
    const name = item?.name;
    if (!name) continue;
    const full = prefix ? `${prefix}/${name}` : name;
    const isFile = Boolean(item.id || item.metadata || item.updated_at || item.created_at);
    if (isFile) {
      if (!seen.has(full)) {
        seen.add(full);
        result.push({ ...item, name: full });
      }
      continue;
    }
    const nested = await walkStorage(bucket, full, seen);
    result.push(...nested);
  }
  return result;
}

function sourceSize(item) {
  const candidates = [item?.metadata?.size, item?.metadata?.contentLength, item?.metadata?.content_length];
  for (const candidate of candidates) {
    const n = Number(candidate);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function sourceModified(item) {
  const raw = item?.updated_at || item?.created_at;
  if (!raw) return null;
  const value = Date.parse(raw);
  return Number.isFinite(value) ? value : null;
}

async function fetchSourceObject(sourceBucket, key, item) {
  const source = await fetch(
    `${SOURCE_URL}/storage/v1/object/public/${encodeURIComponent(sourceBucket)}/${encodeKey(key)}`,
    { headers: sourceHeaders }
  );
  if (!source.ok) throw new Error(`source object ${sourceBucket}/${key}: ${source.status}`);
  const body = await source.arrayBuffer();
  return {
    body,
    type: source.headers.get("content-type") || item.metadata?.mimetype || "application/octet-stream"
  };
}

async function classifyObject(sourceBucket, targetBucket, item) {
  const key = item.name;
  const target = await r2Head(targetBucket, key);
  if (!target.exists) return { action: "copy", source: null };

  const srcSize = sourceSize(item);
  const srcModified = sourceModified(item);
  if (srcSize != null && target.size != null && srcSize !== target.size) return { action: "update", source: null };
  // Supabase timestamps have millisecond precision while HTTP Last-Modified is second precision.
  if (srcModified != null && target.lastModified != null && srcModified > target.lastModified + 1500) {
    return { action: "update", source: null };
  }

  if (!VERIFY_EXISTING) return { action: "skip", source: null };
  const source = await fetchSourceObject(sourceBucket, key, item);
  const sourceHash = hash(Buffer.from(source.body));
  const targetHash = await r2GetHash(targetBucket, key);
  return sourceHash === targetHash ? { action: "skip", source } : { action: "update", source };
}

async function copyBucket(sourceBucket, targetBucket) {
  console.log(`Scanning ${sourceBucket} recursively...`);
  const objects = await walkStorage(sourceBucket);
  const report = {
    source: objects.length,
    copiedNew: 0,
    updatedChanged: 0,
    skippedUnchanged: 0,
    verifiedExisting: 0,
    bytes: 0
  };
  console.log(`${sourceBucket}: ${objects.length} file objects found`);
  if (!APPLY) return report;

  let cursor = 0;
  const concurrency = 5;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= objects.length) return;
      const item = objects[index];
      const key = item.name;
      const classified = await classifyObject(sourceBucket, targetBucket, item);
      if (classified.action === "skip") {
        report.skippedUnchanged++;
        if (VERIFY_EXISTING && classified.source) report.verifiedExisting++;
      } else {
        const source = classified.source || await fetchSourceObject(sourceBucket, key, item);
        await r2Put(targetBucket, key, source.body, source.type);
        if (classified.action === "copy") report.copiedNew++;
        else report.updatedChanged++;
        report.bytes += source.body.byteLength;
      }
      const done = report.copiedNew + report.updatedChanged + report.skippedUnchanged;
      if (done % 100 === 0 || done === objects.length) {
        console.log(`${sourceBucket}: ${done}/${objects.length} processed; new=${report.copiedNew}; updated=${report.updatedChanged}; unchanged=${report.skippedUnchanged}`);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return report;
}

async function main() {
  console.log(`Booknomics storage migration mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Existing-object verification: ${VERIFY_EXISTING ? "FULL SHA-256" : "SIZE + MODIFIED-TIME DELTA"}`);
  const covers = await copyBucket("book-covers", R2_COVERS_BUCKET);
  const assets = await copyBucket("book-assets", R2_ASSETS_BUCKET);
  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", verifyExisting: VERIFY_EXISTING, covers, assets }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
