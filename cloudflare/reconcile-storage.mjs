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
const APPLY = env("MIGRATION_APPLY") === "YES";
const REQUESTED_CONCURRENCY = Number(env("STORAGE_RECONCILE_CONCURRENCY", "8"));
const CONCURRENCY = Number.isFinite(REQUESTED_CONCURRENCY)
  ? Math.max(1, Math.min(16, Math.floor(REQUESTED_CONCURRENCY)))
  : 8;
const R2_HOST = `${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const sourceHeaders = { apikey: SOURCE_KEY, authorization: `Bearer ${SOURCE_KEY}` };
const SAMPLE_LIMIT = 25;

const hash = (value) => createHash("sha256").update(value).digest("hex");
const hmac = (key, value, encoding) => createHmac("sha256", key).update(value).digest(encoding);
const encodeKey = (key) => key.split("/").map(encodeURIComponent).join("/");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchRetry(url, init = {}, label = "request", attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      const transient = [408, 425, 429, 500, 502, 503, 504].includes(response.status);
      if (!transient || attempt === attempts) return response;
      try { await response.body?.cancel(); } catch {}
      lastError = new Error(`${label}: transient HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
    }
    await sleep(Math.min(10000, 750 * 2 ** (attempt - 1)));
  }
  throw lastError || new Error(`${label}: failed after retries`);
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
    authorization: `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
  };
}

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

async function r2Size(bucket, key) {
  const empty = hash(Buffer.alloc(0));
  const url = `https://${R2_HOST}/${encodeURIComponent(bucket)}/${encodeKey(key)}`;
  const head = await fetchRetry(url, {
    method: "HEAD",
    headers: signedHeaders("HEAD", bucket, key, empty),
  }, `R2 HEAD ${bucket}/${key}`);

  if (head.status === 404) return { exists: false, size: null };
  if (!head.ok) throw new Error(`R2 HEAD ${bucket}/${key}: ${head.status}`);
  const headSize = parseNumber(head.headers.get("content-length"));
  if (headSize != null) return { exists: true, size: headSize };

  const ranged = await fetchRetry(url, {
    method: "GET",
    headers: { ...signedHeaders("GET", bucket, key, empty), range: "bytes=0-0" },
  }, `R2 range GET ${bucket}/${key}`);
  if (ranged.status === 404) return { exists: false, size: null };

  const contentRange = ranged.headers.get("content-range") || "";
  const totalMatch = /\/(\d+)$/.exec(contentRange);
  let size = totalMatch ? parseNumber(totalMatch[1]) : null;
  if (size == null && ranged.ok) size = parseNumber(ranged.headers.get("content-length"));
  if (ranged.status === 416 && size === 0) return { exists: true, size: 0 };
  if (!ranged.ok && ranged.status !== 206) {
    throw new Error(`R2 range GET ${bucket}/${key}: ${ranged.status}`);
  }
  try { await ranged.arrayBuffer(); } catch {}
  return { exists: true, size };
}

async function r2Put(bucket, key, body, type) {
  const buffer = Buffer.from(body);
  const response = await fetchRetry(
    `https://${R2_HOST}/${encodeURIComponent(bucket)}/${encodeKey(key)}`,
    {
      method: "PUT",
      headers: {
        ...signedHeaders("PUT", bucket, key, hash(buffer)),
        "content-type": type || "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
      body: buffer,
    },
    `R2 PUT ${bucket}/${key}`,
  );
  if (!response.ok) throw new Error(`R2 PUT ${bucket}/${key}: ${response.status} ${(await response.text()).slice(0, 400)}`);
}

async function fetchText(url, init = {}, label = "request") {
  const response = await fetchRetry(url, init, label);
  const text = await response.text();
  if (!response.ok) throw new Error(`${label}: ${response.status} ${text.slice(0, 700)}`);
  return text;
}

async function listPrefix(bucket, prefix = "") {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const page = JSON.parse(await fetchText(
      `${SOURCE_URL}/storage/v1/object/list/${encodeURIComponent(bucket)}`,
      {
        method: "POST",
        headers: { ...sourceHeaders, "content-type": "application/json" },
        body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
      },
      `Supabase list ${bucket}/${prefix}`,
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
    } else {
      result.push(...await walkStorage(bucket, full, seen));
    }
  }
  return result;
}

function sourceMetadataSize(item) {
  for (const candidate of [item?.metadata?.size, item?.metadata?.contentLength, item?.metadata?.content_length]) {
    const value = parseNumber(candidate);
    if (value != null) return value;
  }
  return null;
}

async function fetchSourceObject(sourceBucket, key, item) {
  const response = await fetchRetry(
    `${SOURCE_URL}/storage/v1/object/public/${encodeURIComponent(sourceBucket)}/${encodeKey(key)}`,
    { headers: sourceHeaders },
    `Supabase object ${sourceBucket}/${key}`,
  );
  if (!response.ok) throw new Error(`Supabase object ${sourceBucket}/${key}: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    size: buffer.byteLength,
    type: response.headers.get("content-type") || item?.metadata?.mimetype || "application/octet-stream",
  };
}

function addSample(report, kind, detail) {
  if (report.samples.length < SAMPLE_LIMIT) report.samples.push({ kind, ...detail });
}

async function reconcileBucket(sourceBucket, targetBucket) {
  console.log(`Scanning ${sourceBucket} -> ${targetBucket}...`);
  const objects = await walkStorage(sourceBucket);
  const report = {
    sourceBucket,
    targetBucket,
    sourceObjects: objects.length,
    verified: 0,
    copiedMissing: 0,
    updatedSizeMismatch: 0,
    unresolved: 0,
    errors: 0,
    samples: [],
  };

  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= objects.length) return;
      const item = objects[index];
      const key = item.name;
      try {
        let source = null;
        let sourceSize = sourceMetadataSize(item);
        if (sourceSize == null) {
          source = await fetchSourceObject(sourceBucket, key, item);
          sourceSize = source.size;
        }

        const target = await r2Size(targetBucket, key);
        if (target.exists && target.size === sourceSize) {
          report.verified++;
        } else if (!APPLY) {
          report.unresolved++;
          addSample(report, target.exists ? "size-mismatch" : "missing", { key, sourceSize, targetSize: target.size });
        } else {
          source ||= await fetchSourceObject(sourceBucket, key, item);
          await r2Put(targetBucket, key, source.buffer, source.type);
          const after = await r2Size(targetBucket, key);
          if (!after.exists || after.size !== source.size) {
            report.unresolved++;
            addSample(report, "post-write-mismatch", { key, sourceSize: source.size, targetSize: after.size });
          } else {
            if (target.exists) report.updatedSizeMismatch++;
            else report.copiedMissing++;
            report.verified++;
          }
        }
      } catch (error) {
        report.errors++;
        addSample(report, "error", { key, message: error instanceof Error ? error.message : String(error) });
      }

      const processed = report.verified + report.unresolved + report.errors;
      if (processed % 250 === 0 || processed === objects.length) {
        console.log(`${sourceBucket}: ${processed}/${objects.length}; verified=${report.verified}; copied=${report.copiedMissing}; updated=${report.updatedSizeMismatch}; unresolved=${report.unresolved}; errors=${report.errors}`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return report;
}

async function main() {
  console.log(`Booknomics storage reconciler: ${APPLY ? "APPLY" : "DRY RUN"}; concurrency=${CONCURRENCY}`);
  const covers = await reconcileBucket("book-covers", R2_COVERS_BUCKET);
  const assets = await reconcileBucket("book-assets", R2_ASSETS_BUCKET);
  const totalFailures = covers.unresolved + covers.errors + assets.unresolved + assets.errors;
  const result = { ok: totalFailures === 0, mode: APPLY ? "apply" : "dry-run", totalFailures, covers, assets };
  console.log(JSON.stringify(result, null, 2));
  if (totalFailures > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
