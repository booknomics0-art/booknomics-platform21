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

async function r2Exists(bucket, key) {
  const empty = hash(Buffer.alloc(0));
  const response = await fetch(`https://${R2_HOST}/${encodeURIComponent(bucket)}/${encodeKey(key)}`, {
    method: "HEAD",
    headers: signedHeaders("HEAD", bucket, key, empty)
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

async function copyBucket(sourceBucket, targetBucket) {
  console.log(`Scanning ${sourceBucket} recursively...`);
  const objects = await walkStorage(sourceBucket);
  const report = { source: objects.length, copied: 0, skippedExisting: 0, bytes: 0 };
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
      if (await r2Exists(targetBucket, key)) {
        report.skippedExisting++;
      } else {
        const source = await fetch(
          `${SOURCE_URL}/storage/v1/object/public/${encodeURIComponent(sourceBucket)}/${encodeKey(key)}`,
          { headers: sourceHeaders }
        );
        if (!source.ok) throw new Error(`source object ${sourceBucket}/${key}: ${source.status}`);
        const body = await source.arrayBuffer();
        await r2Put(targetBucket, key, body, source.headers.get("content-type") || item.metadata?.mimetype);
        report.copied++;
        report.bytes += body.byteLength;
      }
      const done = report.copied + report.skippedExisting;
      if (done % 100 === 0 || done === objects.length) {
        console.log(`${sourceBucket}: ${done}/${objects.length} processed; copied=${report.copied}; existing=${report.skippedExisting}`);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return report;
}

async function main() {
  console.log(`Booknomics storage migration mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  const covers = await copyBucket("book-covers", R2_COVERS_BUCKET);
  const assets = await copyBucket("book-assets", R2_ASSETS_BUCKET);
  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", covers, assets }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
