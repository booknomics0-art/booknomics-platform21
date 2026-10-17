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
const requestedSample = Number(env("PARITY_SAMPLE_SIZE", "24"));
const SAMPLE_SIZE = Number.isFinite(requestedSample)
  ? Math.min(Math.max(Math.floor(requestedSample), 2), 100)
  : 24;
const sourceHeaders = { apikey: SOURCE_KEY, authorization: `Bearer ${SOURCE_KEY}` };
const sensitiveSettingKey = /(secret|password|private[_-]?key|service[_-]?role|access[_-]?token|refresh[_-]?token)/i;

const stableHash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const scalar = (value) => value == null
  ? null
  : typeof value === "boolean"
    ? (value ? 1 : 0)
    : typeof value === "object"
      ? JSON.stringify(value)
      : value;

async function d1(sql, params = []) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_ID}/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${CF_API_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ sql, params }),
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(`D1 failed: ${JSON.stringify(payload)?.slice(0, 1000)}`);
  }
  return payload.result?.[0] || payload.result || {};
}

async function sourceCount(table, filters = "") {
  const url = `${SOURCE_URL}/rest/v1/${encodeURIComponent(table)}?select=*${filters ? `&${filters}` : ""}`;
  const response = await fetch(url, {
    headers: { ...sourceHeaders, prefer: "count=exact", range: "0-0" },
  });
  const text = await response.text();
  if (response.status === 404 || (response.status === 400 && /does not exist/i.test(text))) return null;
  if (!response.ok) throw new Error(`${table} source count: ${response.status} ${text.slice(0, 500)}`);
  const range = response.headers.get("content-range") || "";
  const match = range.match(/\/(\d+|\*)$/);
  if (!match || match[1] === "*") {
    throw new Error(`${table}: source count missing Content-Range (${range})`);
  }
  return Number(match[1]);
}

async function sourceRows(table, select, extra = "") {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const url = `${SOURCE_URL}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(select)}&limit=500&offset=${offset}${extra ? `&${extra}` : ""}`;
    const response = await fetch(url, { headers: sourceHeaders });
    const text = await response.text();
    if (response.status === 404 || (response.status === 400 && /does not exist/i.test(text))) return null;
    if (!response.ok) throw new Error(`${table} source rows: ${response.status} ${text.slice(0, 500)}`);
    const batch = JSON.parse(text);
    rows.push(...batch);
    if (batch.length < 500) break;
  }
  return rows;
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
    const response = await fetch(`${SOURCE_URL}/auth/v1/admin/users?page=${page}&per_page=100`, {
      headers: sourceHeaders,
    });
    if (!response.ok) {
      throw new Error(`auth users: ${response.status} ${(await response.text()).slice(0, 500)}`);
    }
    const payload = await response.json();
    const users = Array.isArray(payload) ? payload : (payload.users || []);
    total += users.length;
    if (users.length < 100) break;
  }
  return total;
}

const bookFields = "id,title,author,slug,seo_slug,language,status,overview,key_ideas,deep_analysis";

async function sourceBookQuery(extra, limit) {
  const response = await fetch(
    `${SOURCE_URL}/rest/v1/books?select=${bookFields}&is_draft=eq.false&status=eq.published&order=id.asc&limit=${limit}${extra ? `&${extra}` : ""}`,
    { headers: sourceHeaders },
  );
  if (!response.ok) {
    throw new Error(`book sample: ${response.status} ${(await response.text()).slice(0, 500)}`);
  }
  return response.json();
}

async function sourceBookSample() {
  const perLanguage = Math.max(1, Math.floor(SAMPLE_SIZE / 2));
  const englishFilter = `or=${encodeURIComponent("(language.eq.en,language.ilike.*english*)")}`;
  const hindiFilter = `or=${encodeURIComponent("(language.eq.hi,language.ilike.*hindi*)")}`;
  const [english, hindi] = await Promise.all([
    sourceBookQuery(englishFilter, perLanguage),
    sourceBookQuery(hindiFilter, perLanguage),
  ]);

  const byId = new Map([...english, ...hindi].map((row) => [row.id, row]));
  if (byId.size < SAMPLE_SIZE) {
    const fallback = await sourceBookQuery("", SAMPLE_SIZE);
    for (const row of fallback) {
      if (byId.size >= SAMPLE_SIZE) break;
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].slice(0, SAMPLE_SIZE);
}

async function targetBookSample(ids) {
  if (!ids.length) return [];
  const marks = ids.map(() => "?").join(",");
  const result = await d1(
    `SELECT id,title,author,slug,seo_slug,language,status,overview,key_ideas,deep_analysis FROM books WHERE id IN (${marks})`,
    ids,
  );
  return result.results || [];
}

function normalizedBook(row) {
  return {
    id: scalar(row?.id),
    title: scalar(row?.title),
    author: scalar(row?.author),
    slug: scalar(row?.slug),
    seo_slug: scalar(row?.seo_slug),
    language: scalar(row?.language),
    status: scalar(row?.status),
    overview: scalar(row?.overview),
    key_ideas: scalar(row?.key_ideas),
    deep_analysis: scalar(row?.deep_analysis),
  };
}

async function appSettingsParity(failures) {
  const source = await sourceRows("app_settings", "key");
  let targetKeys = null;
  try {
    const result = await d1("SELECT key FROM app_settings ORDER BY key");
    targetKeys = (result.results || []).map((row) => String(row.key));
  } catch (error) {
    if (!/no such table/i.test(String(error))) throw error;
  }

  if (targetKeys === null) {
    failures.push("app_settings target table is missing");
    return { source: source?.length ?? 0, sourceSafe: null, target: null, sensitiveTarget: null, match: false };
  }

  const sourceKeys = (source || []).map((row) => String(row.key));
  const safeSourceKeys = sourceKeys.filter((key) => !sensitiveSettingKey.test(key));
  const sensitiveTargetKeys = targetKeys.filter((key) => sensitiveSettingKey.test(key));
  const sourceExpected = source === null ? 0 : safeSourceKeys.length;
  const match = sourceExpected === targetKeys.length && sensitiveTargetKeys.length === 0;

  if (sourceExpected !== targetKeys.length) {
    failures.push(`app_settings safe count mismatch: sourceSafe=${sourceExpected} target=${targetKeys.length}`);
  }
  if (sensitiveTargetKeys.length) {
    failures.push(`app_settings contains ${sensitiveTargetKeys.length} sensitive key(s) in D1`);
  }

  return {
    source: source?.length ?? 0,
    sourceSafe: sourceExpected,
    target: targetKeys.length,
    sensitiveTarget: sensitiveTargetKeys.length,
    match,
  };
}

async function urlLeakCounts() {
  const queries = {
    bookCoverSupabase: `SELECT COUNT(*) AS total FROM books WHERE cover_url LIKE '%supabase.co%' OR og_image LIKE '%supabase.co%'`,
    assetSupabase: `SELECT COUNT(*) AS total FROM book_assets WHERE mindmap_url LIKE '%supabase.co%' OR audio_url LIKE '%supabase.co%'`,
    audioJobSupabase: `SELECT COUNT(*) AS total FROM audio_summary_jobs WHERE audio_url LIKE '%supabase.co%'`,
    fallbackFunction: `SELECT COUNT(*) AS total FROM books WHERE cover_url LIKE '%/functions/v1/book-cover-fallback%'`,
  };
  const out = {};
  for (const [key, sql] of Object.entries(queries)) {
    try {
      const result = await d1(sql);
      out[key] = Number(result.results?.[0]?.total ?? 0);
    } catch (error) {
      out[key] = /no such table/i.test(String(error)) ? null : (() => { throw error; })();
    }
  }
  return out;
}

async function main() {
  const failures = [];
  const counts = {};

  // Mirrors the active business-data list in migrate.mjs. app_settings is checked
  // separately because sensitive setting keys are intentionally excluded on import.
  const tables = [
    "books", "profiles", "book_assets", "book_catalog", "book_sources",
    "book_research_sources", "book_quality_audits", "book_quality_evidence",
    "seo_audits", "seo_indexing_jobs", "gsc_page_metrics", "gsc_query_metrics",
    "learning_paths", "learning_path_books", "path_enrollments", "subscriptions",
    "user_roles", "library", "reading_progress", "book_notes", "book_reviews",
    "review_upvotes", "comments", "reactions", "discussions", "discussion_replies",
    "discussion_votes", "habit_entries", "user_book_mastery", "url_redirects",
    "affiliate_clicks", "book_requests", "audio_summary_jobs", "backlink_records",
    "social_accounts", "social_posts", "promotion_logs", "admin_access_logs",
    "referrals",
  ];

  for (const table of tables) {
    const [source, target] = await Promise.all([sourceCount(table), targetCount(table)]);
    const expected = source ?? 0;
    const match = target !== null && expected === target;
    counts[table] = { source, expected, target, match };
    if (target === null) {
      failures.push(`${table}: target D1 table is missing`);
    } else if (expected !== target) {
      failures.push(`${table} count mismatch: source=${source ?? "absent"} expected=${expected} target=${target}`);
    }
  }

  counts.app_settings = await appSettingsParity(failures);

  const [sourceUsers, targetUsers, sourcePublished, targetPublished] = await Promise.all([
    sourceAuthCount(),
    targetCount("users"),
    sourceCount("books", "is_draft=eq.false&status=eq.published"),
    targetCount("books", "is_draft = 0 AND status = 'published'"),
  ]);
  counts.users = { source: sourceUsers, target: targetUsers, match: targetUsers !== null && sourceUsers === targetUsers };
  counts.publishedBooks = {
    source: sourcePublished,
    target: targetPublished,
    match: targetPublished !== null && sourcePublished === targetPublished,
  };
  if (targetUsers === null) failures.push("users target D1 table is missing");
  else if (sourceUsers !== targetUsers) failures.push(`users count mismatch: source=${sourceUsers} target=${targetUsers}`);
  if (targetPublished === null) failures.push("books target D1 table is missing");
  else if (sourcePublished !== targetPublished) failures.push(`published books mismatch: source=${sourcePublished} target=${targetPublished}`);

  const sourceSample = await sourceBookSample();
  const targetSample = await targetBookSample(sourceSample.map((row) => row.id));
  const targetById = new Map(targetSample.map((row) => [row.id, row]));
  const sample = sourceSample.map((source) => {
    const target = targetById.get(source.id);
    const sourceNormalized = normalizedBook(source);
    const targetNormalized = normalizedBook(target);
    const sourceHash = stableHash(sourceNormalized);
    const targetHash = stableHash(targetNormalized);
    const match = Boolean(target) && sourceHash === targetHash;
    if (!match) failures.push(`book sample mismatch: ${source.id} ${source.title}`);
    return {
      id: source.id,
      title: source.title,
      language: source.language,
      match,
      sourceHash,
      targetHash,
    };
  });

  const leaks = await urlLeakCounts();
  for (const [key, value] of Object.entries(leaks)) {
    if (value === null) failures.push(`${key}: target table unavailable for URL leak check`);
    else if (value !== 0) failures.push(`${key}: ${value} legacy Supabase URL(s) remain in D1`);
  }

  const report = {
    ok: failures.length === 0,
    generatedAt: new Date().toISOString(),
    sampleSize: SAMPLE_SIZE,
    counts,
    sample,
    leaks,
    failures,
  };
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
