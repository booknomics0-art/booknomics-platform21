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
const VERIFY_HASHES = env("STORAGE_VERIFY_HASHES") === "YES";
const REQUESTED_CONCURRENCY = Number(env("STORAGE_VERIFY_CONCURRENCY", "5"));
const CONCURRENCY = Number.isFinite(REQUESTED_CONCURRENCY)
  ? Math.max(1, Math.min(20, Math.floor(REQUESTED_CONCURRENCY)))
  : 5;
const SAMPLE_LIMIT = 25;
const R2_HOST = `${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const sourceHeaders = { apikey: SOURCE_KEY, authorization: `Bearer ${SOURCE_KEY}` };

const hash = (value) => createHash("sha256").update(value).digest("hex");
const hmac = (key, value, encoding) => createHmac("sha256", key).update(value).digest(encoding);
const encodeKey = (key) => key.split("/").map(encodeURIComponent).join("/");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, init = {}, label = url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.status !== 429 && response.status < 500) return response;
      lastError = new Error(`${label}: HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 4) await sleep(400 * (2 ** (attempt - 1)));
  }
  throw lastError;
}

async function fetchText(url, init = {}) {
  const response = await fetchWithRetry(url, init, url);
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
    authorization: `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
  };
}

async function r2Probe(bucket, key) {
  const empty = hash(Buffer.alloc(0));
  const url = `https://${R2_HOST}/${encodeURIComponent(bucket)}/${encodeKey(key)}`;
  const head = await fetchWithRetry(url, {
    method: "HEAD",
    headers: signedHeaders("HEAD", bucket, key, empty),
  }, `R2 HEAD ${bucket}/${key}`);

  if (head.status === 404) return { exists: false, size: null };
  if (!head.ok) throw new Error(`R2 HEAD ${bucket}/${key}: ${head.status}`);

  const rawSize = head.headers.get("content-length");
  if (rawSize && Number.isFinite(Number(rawSize))) {
    return { exists: true, size: Number(rawSize) };
  }

  // Some R2/S3 HEAD responses do not expose content-length to fetch().
  // Probe one byte and read the total from Content-Range instead of treating it as a mismatch.
  const ranged = await fetchWithRetry(url, {
    method: "GET",
    headers: { ...signedHeaders("GET", bucket, key, empty), range: "bytes=0-0" },
  }, `R2 range probe ${bucket}/${key}`);
  if (ranged.status === 404) return { exists: false, size: null };
  if (!ranged.ok) throw new Error(`R2 range probe ${bucket}/${key}: ${ranged.status}`);

  const contentRange = ranged.headers.get("content-range") || "";
  const rangeMatch = contentRange.match(/\/(\d+)$/);
  if (rangeMatch) {
    await ranged.arrayBuffer().catch(() => null);
    return { exists: true, size: Number(rangeMatch[1]) };
  }

  const rangedLength = ranged.headers.get("content-length");
  if (ranged.status === 200 && rangedLength && Number.isFinite(Number(rangedLength))) {
    await ranged.arrayBuffer().catch(() => null);
    return { exists: true, size: Number(rangedLength) };
  }

  const body = Buffer.from(await ranged.arrayBuffer());
  if (ranged.status === 200) return { exists: true, size: body.byteLength };
  throw new Error(`R2 size unavailable for ${bucket}/${key}`);
}

async function r2GetHash(bucket, key) {
  const empty = hash(Buffer.alloc(0));
  const response = await fetchWithRetry(
    `https://${R2_HOST}/${encodeURIComponent(bucket)}/${encodeKey(key)}`,
    { method: "GET", headers: signedHeaders("GET", bucket, key, empty) },
    `R2 GET ${bucket}/${key}`,
  );
  if (!response.ok) throw new Error(`R2 GET ${bucket}/${key}: ${response.status}`);
  return hash(Buffer.from(await response.arrayBuffer()));
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
    result.push(...await walkStorage(bucket, full, seen));
  }
  return result;
}

function metadataSize(item) {
  const candidates = [item?.metadata?.size, item?.metadata?.contentLength, item?.metadata?.content_length];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

async function fetchSourceObject(sourceBucket, key, item) {
  const response = await fetchWithRetry(
    `${SOURCE_URL}/storage/v1/object/public/${encodeURIComponent(sourceBucket)}/${encodeKey(key)}`,
    { headers: sourceHeaders },
    `source object ${sourceBucket}/${key}`,
  );
  if (!response.ok) throw new Error(`source object ${sourceBucket}/${key}: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    size: buffer.byteLength,
    type: response.headers.get("content-type") || item?.metadata?.mimetype || "application/octet-stream",
  };
}

function addSample(report, kind, detail) {
  if (report.samples.length >= SAMPLE_LIMIT) return;
  report.samples.push({ kind, ...detail });
}

async function verifyBucket(sourceBucket, targetBucket) {
  console.log(`Scanning source bucket ${sourceBucket}...`);
  const objects = await walkStorage(sourceBucket);
  const report = {
    sourceBucket,
    targetBucket,
    sourceObjects: objects.length,
    present: 0,
    sizeMatched: 0,
    hashMatched: 0,
    missing: 0,
    sizeMismatch: 0,
    hashMismatch: 0,
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
        const target = await r2Probe(targetBucket, key);
        if (!target.exists) {
          report.missing++;
          addSample(report, "missing", { key });
          continue;
        }
        report.present++;

        let source = null;
        let sourceSize = metadataSize(item);
        if (sourceSize == null || VERIFY_HASHES) {
          source = await fetchSourceObject(sourceBucket, key, item);
          sourceSize = source.size;
        }

        if (sourceSize !== target.size) {
          report.sizeMismatch++;
          addSample(report, "size-mismatch", { key, sourceSize, targetSize: target.size });
          continue;
        }
        report.sizeMatched++;

        if (VERIFY_HASHES) {
          const sourceHash = hash(source.buffer);
          const targetHash = await r2GetHash(targetBucket, key);
          if (sourceHash !== targetHash) {
            report.hashMismatch++;
            addSample(report, "hash-mismatch", { key, sourceHash, targetHash });
          } else {
            report.hashMatched++;
          }
        }
      } catch (error) {
        report.errors++;
        addSample(report, "error", { key, message: error instanceof Error ? error.message : String(error) });
      }

      const processed = report.present + report.missing + report.errors;
      if (processed % 100 === 0 || processed === objects.length) {
        console.log(`${sourceBucket}: ${processed}/${objects.length}; missing=${report.missing}; sizeMismatch=${report.sizeMismatch}; hashMismatch=${report.hashMismatch}; errors=${report.errors}`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return report;
}

function failures(report) {
  return report.missing + report.sizeMismatch + report.hashMismatch + report.errors;
}

async function main() {
  console.log("Booknomics storage parity verifier: READ ONLY");
  console.log(`Verification mode: ${VERIFY_HASHES ? "SIZE + SHA-256" : "SIZE"}`);
  console.log(`Concurrency: ${CONCURRENCY}`);

  const covers = await verifyBucket("book-covers", R2_COVERS_BUCKET);
  const assets = await verifyBucket("book-assets", R2_ASSETS_BUCKET);
  const totalFailures = failures(covers) + failures(assets);
  const result = {
    ok: totalFailures === 0,
    verifyHashes: VERIFY_HASHES,
    totalFailures,
    covers,
    assets,
  };
  console.log(JSON.stringify(result, null, 2));

  if (totalFailures > 0) {
    console.error(`Storage parity FAILED with ${totalFailures} mismatch/error(s). Supabase must remain enabled.`);
    process.exitCode = 2;
  } else {
    console.log("Storage parity PASSED for all source objects. No data was written or deleted.");
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
