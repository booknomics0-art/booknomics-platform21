#!/usr/bin/env node

import { createHash } from "node:crypto";

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
const SAMPLE_SIZE = Math.min(Math.max(Number(env("PARITY_SAMPLE_SIZE", "25")), 1), 100);
const sourceHeaders = { apikey: SOURCE_KEY, authorization: `Bearer ${SOURCE_KEY}` };

const stableHash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function d1(sql, params = []) {
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

async function sourceCount(table, filters = "") {
  const url = `${SOURCE_URL}/rest/v1/${encodeURIComponent(table)}?select=id${filters ? `&${filters}` : ""}`;
  const response = await fetch(url, {
    headers: { ...sourceHeaders, prefer: "count=exact", range: "0-0" }
  });
  const text = await response.text();
  if (response.status === 404 || (response.status === 400 && /does not exist/i.test(text))) return null;
  if (!response.ok) throw new Error(`${table} source count: ${response.status} ${text.slice(0, 500)}`);
  const range = response.headers.get("content-range") || "";
  const match = range.match(/\/(\d+|\*)$/);
  if (!match || match[1] === "*") throw new Error(`${table}: source count missing Content-Range (${range})`);
  return Number(match[1]);
}

async function targetCount(table, where = "") {
  try {
    const result = await d1(`SELECT COUNT(*) AS total FROM ${table}${where ? ` WHERE ${where}` : ""}`);
    return Number(result.results?.[0]?.total ?? 0);
  } catch (error) {
    if (/no such table/i.test(String(error))) return null;
    throw error;
  }
}

async function sourceAuthCount() {
  let total = 0;
  for (let page = 1; ; page += 1) {
    const response = await fetch(`${SOURCE_URL}/auth/v1/admin/users?page=${page}&per_page=100`, { headers: sourceHeaders });
    if (!response.ok) throw new Error(`auth users: ${response.status} ${(await response.text()).slice(0, 500)}`);
    const payload = await response.json();
    const users = Array.isArray(payload) ? payload : (payload.users || []);
    total += users.length;
    if (users.length < 100) break;
  }
  return total;
}

async function sourceBookSample() {
  const fields = "id,title,author,slug,seo_slug,language,status,overview,key_ideas,deep_analysis";
  const response = await fetch(
    `${SOURCE_URL}/rest/v1/books?select=${fields}&is_draft=eq.false&status=eq.published&order=id.asc&limit=${SAMPLE_SIZE}`,
    { headers: sourceHeaders }
  );
  if (!response.ok) throw new Error(`book sample: ${response.status} ${(await response.text()).slice(0, 500)}`);
  return response.json();
}

async function targetBookSample(ids) {
  if (!ids.length) return [];
  const marks = ids.map(() => "?").join(",");
  const result = await d1(
    `SELECT id,title,author,slug,seo_slug,language,status,overview,key_ideas,deep_analysis FROM books WHERE id IN (${marks})`,
    ids
  );
  return result.results || [];
}

function normalizedBook(row) {
  return {
    id: row?.id ?? null,
    title: row?.title ?? null,
    author: row?.author ?? null,
    slug: row?.slug ?? null,
    seo_slug: row?.seo_slug ?? null,
    language: row?.language ?? null,
    status: row?.status ?? null,
    overview: row?.overview ?? null,
    key_ideas: row?.key_ideas ?? null,
    deep_analysis: row?.deep_analysis ?? null
  };
}

async function urlLeakCounts() {
  const queries = {
    bookCoverSupabase: `SELECT COUNT(*) AS total FROM books WHERE cover_url LIKE '%supabase.co%' OR og_image LIKE '%supabase.co%'`,
    assetSupabase: `SELECT COUNT(*) AS total FROM book_assets WHERE mindmap_url LIKE '%supabase.co%' OR audio_url LIKE '%supabase.co%'`,
    fallbackFunction: `SELECT COUNT(*) AS total FROM books WHERE cover_url LIKE '%/functions/v1/book-cover-fallback%'`
  };
  const out = {};
  for (const [key, sql] of Object.entries(queries)) {
    const result = await d1(sql);
    out[key] = Number(result.results?.[0]?.total ?? 0);
  }
  return out;
}

async function main() {
  const failures = [];
  const counts = {};
  const tables = [
    "books", "profiles", "book_assets", "library", "reading_progress", "book_notes",
    "book_reviews", "review_upvotes", "comments", "reactions", "learning_paths",
    "learning_path_books", "path_enrollments", "subscriptions", "user_roles", "referrals"
  ];

  for (const table of tables) {
    const [source, target] = await Promise.all([sourceCount(table), targetCount(table)]);
    counts[table] = { source, target, match: source === target };
    if (source !== target) failures.push(`${table} count mismatch: source=${source} target=${target}`);
  }

  const [sourceUsers, targetUsers, sourcePublished, targetPublished] = await Promise.all([
    sourceAuthCount(),
    targetCount("users"),
    sourceCount("books", "is_draft=eq.false&status=eq.published"),
    targetCount("books", "is_draft = 0 AND status = 'published'")
  ]);
  counts.users = { source: sourceUsers, target: targetUsers, match: sourceUsers === targetUsers };
  counts.publishedBooks = { source: sourcePublished, target: targetPublished, match: sourcePublished === targetPublished };
  if (sourceUsers !== targetUsers) failures.push(`users count mismatch: source=${sourceUsers} target=${targetUsers}`);
  if (sourcePublished !== targetPublished) failures.push(`published books mismatch: source=${sourcePublished} target=${targetPublished}`);

  const sourceSample = await sourceBookSample();
  const targetSample = await targetBookSample(sourceSample.map((row) => row.id));
  const targetById = new Map(targetSample.map((row) => [row.id, row]));
  const sample = sourceSample.map((source) => {
    const target = targetById.get(source.id);
    const sourceNormalized = normalizedBook(source);
    const targetNormalized = normalizedBook(target);
    const sourceHash = stableHash(sourceNormalized);
    const targetHash = stableHash(targetNormalized);
    const match = sourceHash === targetHash;
    if (!match) failures.push(`book sample mismatch: ${source.id} ${source.title}`);
    return { id: source.id, title: source.title, match, sourceHash, targetHash };
  });

  const leaks = await urlLeakCounts();
  for (const [key, value] of Object.entries(leaks)) {
    if (value !== 0) failures.push(`${key}: ${value} legacy Supabase URLs remain in D1`);
  }

  const report = {
    ok: failures.length === 0,
    generatedAt: new Date().toISOString(),
    counts,
    sample,
    leaks,
    failures
  };
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
