#!/usr/bin/env node

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
const sourceHeaders = { apikey: SOURCE_KEY, authorization: `Bearer ${SOURCE_KEY}` };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchRetry(url, init = {}, label = "request", attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === attempts) {
        return response;
      }
      try { await response.body?.cancel(); } catch {}
      lastError = new Error(`${label}: transient HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
    }
    await sleep(Math.min(8000, 750 * 2 ** (attempt - 1)));
  }
  throw lastError || new Error(`${label}: failed after retries`);
}

async function d1(sql, params = []) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetchRetry(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_ID}/query`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${CF_API_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ sql, params }),
      },
      "D1 query",
      3,
    );
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.success) return payload.result?.[0] || payload.result || {};
    lastError = new Error(`D1 failed: ${JSON.stringify(payload)?.slice(0, 1000)}`);
    const transient = response.status >= 500 || response.status === 429 || payload?.errors?.some((e) => Number(e?.code) === 7500);
    if (!transient || attempt === 5) throw lastError;
    await sleep(Math.min(10000, 1000 * 2 ** (attempt - 1)));
  }
  throw lastError;
}

async function sourceRows() {
  const response = await fetchRetry(
    `${SOURCE_URL}/rest/v1/library?select=*&order=id.asc`,
    { headers: sourceHeaders },
    "Supabase library",
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase library: ${response.status} ${text.slice(0, 700)}`);
  return JSON.parse(text);
}

const scalar = (value) => value == null ? null : typeof value === "boolean" ? (value ? 1 : 0) : typeof value === "object" ? JSON.stringify(value) : value;

async function upsertSourceRows(rows) {
  if (!rows.length) return;
  const info = await d1("PRAGMA table_info(library)");
  const targetColumns = (info.results || []).map((row) => row.name);
  const sourceKeys = new Set(rows.flatMap(Object.keys));
  const columns = targetColumns.filter((column) => sourceKeys.has(column));
  if (!columns.includes("id")) throw new Error("library target schema is missing id");
  const updateColumns = columns.filter((column) => column !== "id");
  const conflict = updateColumns.length
    ? `DO UPDATE SET ${updateColumns.map((column) => `${column}=excluded.${column}`).join(",")}`
    : "DO NOTHING";
  for (const row of rows) {
    const sql = `INSERT INTO library (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON CONFLICT(id) ${conflict}`;
    if (APPLY) await d1(sql, columns.map((column) => scalar(row[column])));
  }
}

async function targetIds() {
  const result = await d1("SELECT id FROM library ORDER BY id");
  return (result.results || []).map((row) => String(row.id));
}

async function main() {
  const rows = await sourceRows();
  const sourceIds = new Set(rows.map((row) => String(row.id)));
  await upsertSourceRows(rows);

  const before = await targetIds();
  const extras = before.filter((id) => !sourceIds.has(id));
  const missing = [...sourceIds].filter((id) => !before.includes(id));

  if (missing.length) throw new Error(`library reconcile could not upsert ${missing.length} source row(s)`);
  if (extras.length > 25) throw new Error(`library safety guard: refusing to delete ${extras.length} target-only rows`);

  if (APPLY) {
    for (const id of extras) await d1("DELETE FROM library WHERE id = ?", [id]);
  }

  const after = await targetIds();
  const ok = after.length === sourceIds.size && after.every((id) => sourceIds.has(id));
  const report = {
    mode: APPLY ? "apply" : "dry-run",
    source: sourceIds.size,
    targetBefore: before.length,
    targetOnly: extras.length,
    targetAfter: after.length,
    ok,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!ok) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
