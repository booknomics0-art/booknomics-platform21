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
const R2_HOST = `${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const sourceHeaders = { apikey: SOURCE_KEY, authorization: `Bearer ${SOURCE_KEY}` };
const SAMPLE_LIMIT = 25;

const hash = (value) => createHash("sha256").update(value).digest("hex");
const hmac = (key, value, encoding) => createHmac("sha256", key).update(value).digest(encoding);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const encodeKey = (key) => key.split("/").map(encodeURIComponent).join("/");
const awsEncode = (value) => encodeURIComponent(String(value)).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

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
    await sleep(Math.min(10000, 600 * 2 ** (attempt - 1)));
  }
  throw lastError || new Error(`${label}: failed after retries`);
}

function signingKey(date) {
  const kd = hmac(Buffer.from(`AWS4${R2_SECRET_ACCESS_KEY}`), date);
  const kr = hmac(kd, "auto");
  const ks = hmac(kr, "s3");
  return hmac(ks, "aws4_request");
}

function signRequest(method, canonicalUri, queryParams, payloadHash) {
  const now = new Date();
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amz.slice(0, 8);
  const canonicalQuery = Object.entries(queryParams || {})
    .filter(([, value]) => value != null)
    .map(([key, value]) => [awsEncode(key), awsEncode(value)])
    .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const canonicalHeaders = `host:${R2_HOST}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amz}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${date}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amz}\n${scope}\n${hash(canonicalRequest)}`;
  const signature = hmac(signingKey(date), stringToSign, "hex");
  return {
    canonicalQuery,
    headers: {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amz,
      authorization: `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

function objectHeaders(method, bucket, key, payloadHash) {
  const canonicalUri = `/${encodeURIComponent(bucket)}/${encodeKey(key)}`;
  return signRequest(method, canonicalUri, {}, payloadHash).headers;
}

function xmlDecode(value = "") {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function listR2(bucket) {
  const objects = new Map();
  let token = null;
  let pages = 0;
  do {
    const query = { "list-type": "2", "max-keys": "1000" };
    if (token) query["continuation-token"] = token;
    const canonicalUri = `/${encodeURIComponent(bucket)}`;
    const empty = hash(Buffer.alloc(0));
    const signed = signRequest("GET", canonicalUri, query, empty);
    const url = `https://${R2_HOST}${canonicalUri}?${signed.canonicalQuery}`;
    const response = await fetchRetry(url, { method: "GET", headers: signed.headers }, `R2 list ${bucket}`);
    const text = await response.text();
    if (!response.ok) throw new Error(`R2 list ${bucket}: ${response.status} ${text.slice(0, 800)}`);

    const contents = text.match(/<Contents>[\s\S]*?<\/Contents>/g) || [];
    for (const block of contents) {
      const keyMatch = block.match(/<Key>([\s\S]*?)<\/Key>/);
      const sizeMatch = block.match(/<Size>(\d+)<\/Size>/);
      if (!keyMatch || !sizeMatch) continue;
      objects.set(xmlDecode(keyMatch[1]), Number(sizeMatch[1]));
    }

    const tokenMatch = text.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/);
    token = tokenMatch ? xmlDecode(tokenMatch[1]) : null;
    pages += 1;
    if (pages > 1000) throw new Error(`R2 list ${bucket}: pagination safety limit exceeded`);
  } while (token);
  console.log(`R2 ${bucket}: ${objects.size} object(s) across ${pages} page(s)`);
  return objects;
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

async function r2Put(bucket, key, body, type) {
  const buffer = Buffer.from(body);
  const response = await fetchRetry(
    `https://${R2_HOST}/${encodeURIComponent(bucket)}/${encodeKey(key)}`,
    {
      method: "PUT",
      headers: {
        ...objectHeaders("PUT", bucket, key, hash(buffer)),
        "content-type": type || "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
      body: buffer,
    },
    `R2 PUT ${bucket}/${key}`,
  );
  if (!response.ok) throw new Error(`R2 PUT ${bucket}/${key}: ${response.status} ${(await response.text()).slice(0, 400)}`);
}

function addSample(report, kind, detail) {
  if (report.samples.length < SAMPLE_LIMIT) report.samples.push({ kind, ...detail });
}

async function reconcileBucket(sourceBucket, targetBucket) {
  const sourceObjects = await walkStorage(sourceBucket);
  console.log(`Supabase ${sourceBucket}: ${sourceObjects.length} object(s)`);
  let target = await listR2(targetBucket);
  const repairs = [];
  const report = {
    sourceBucket,
    targetBucket,
    sourceObjects: sourceObjects.length,
    targetObjects: target.size,
    verified: 0,
    copiedMissing: 0,
    updatedSizeMismatch: 0,
    unresolved: 0,
    errors: 0,
    samples: [],
  };

  for (const item of sourceObjects) {
    let sourceSize = sourceMetadataSize(item);
    if (sourceSize == null) {
      try {
        const source = await fetchSourceObject(sourceBucket, item.name, item);
        sourceSize = source.size;
      } catch (error) {
        report.errors += 1;
        addSample(report, "source-read-error", { key: item.name, message: String(error) });
        continue;
      }
    }
    const targetSize = target.get(item.name);
    if (targetSize === sourceSize) {
      report.verified += 1;
    } else {
      repairs.push({ item, sourceSize, targetSize, missing: targetSize == null });
    }
  }

  console.log(`${sourceBucket}: ${repairs.length} repair candidate(s)`);
  if (repairs.length && !APPLY) {
    report.unresolved += repairs.length;
    for (const repair of repairs.slice(0, SAMPLE_LIMIT)) {
      addSample(report, repair.missing ? "missing" : "size-mismatch", {
        key: repair.item.name,
        sourceSize: repair.sourceSize,
        targetSize: repair.targetSize,
      });
    }
  }

  if (APPLY) {
    for (const repair of repairs) {
      try {
        const source = await fetchSourceObject(sourceBucket, repair.item.name, repair.item);
        await r2Put(targetBucket, repair.item.name, source.buffer, source.type);
        if (repair.missing) report.copiedMissing += 1;
        else report.updatedSizeMismatch += 1;
      } catch (error) {
        report.errors += 1;
        addSample(report, "repair-error", { key: repair.item.name, message: String(error) });
      }
    }

    target = await listR2(targetBucket);
    report.targetObjects = target.size;
    report.verified = 0;
    report.unresolved = 0;
    for (const item of sourceObjects) {
      let sourceSize = sourceMetadataSize(item);
      if (sourceSize == null) {
        try {
          const source = await fetchSourceObject(sourceBucket, item.name, item);
          sourceSize = source.size;
        } catch {
          continue;
        }
      }
      const targetSize = target.get(item.name);
      if (targetSize === sourceSize) report.verified += 1;
      else {
        report.unresolved += 1;
        addSample(report, targetSize == null ? "still-missing" : "still-size-mismatch", {
          key: item.name,
          sourceSize,
          targetSize,
        });
      }
    }
  }

  return report;
}

async function main() {
  console.log(`Booknomics fast storage parity: ${APPLY ? "APPLY" : "DRY RUN"}`);
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
