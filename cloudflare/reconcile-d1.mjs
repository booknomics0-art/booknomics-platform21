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

async function d1(sql, params = []) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_ID}/query`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${CF_API_TOKEN}`, "content-type": "application/json" },
          body: JSON.stringify({ sql, params }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.success) return payload.result?.[0] || payload.result || {};
      lastError = new Error(`D1 failed: ${JSON.stringify(payload)?.slice(0, 1000)}`);
      const retryable = response.status === 429 || response.status >= 500 || payload?.errors?.some((e) => Number(e?.code) === 7500);
      if (!retryable) throw lastError;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 4) await sleep(500 * (2 ** (attempt - 1)));
  }
  throw lastError;
}

async function sourceIds(table) {
  const ids = [];
  for (let offset = 0; ; offset += 500) {
    const response = await fetch(
      `${SOURCE_URL}/rest/v1/${encodeURIComponent(table)}?select=id&order=id.asc&limit=500&offset=${offset}`,
      { headers: sourceHeaders },
    );
    const text = await response.text();
    if (!response.ok) throw new Error(`${table} source ids: ${response.status} ${text.slice(0, 500)}`);
    const batch = JSON.parse(text);
    ids.push(...batch.map((row) => String(row.id)));
    if (batch.length < 500) break;
  }
  return ids;
}

async function reconcileById(table, maxStale = 10) {
  const source = await sourceIds(table);
  const result = await d1(`SELECT id FROM ${table} ORDER BY id`);
  const target = (result.results || []).map((row) => String(row.id));
  const sourceSet = new Set(source);
  const stale = target.filter((id) => !sourceSet.has(id));

  if (stale.length > maxStale) {
    throw new Error(`${table}: refusing to delete ${stale.length} stale rows; safety limit=${maxStale}`);
  }

  if (APPLY && stale.length) {
    const marks = stale.map(() => "?").join(",");
    await d1(`DELETE FROM ${table} WHERE id IN (${marks})`, stale);
  }

  const after = Number((await d1(`SELECT COUNT(*) AS total FROM ${table}`)).results?.[0]?.total ?? 0);
  const ok = after === source.length;
  const report = { table, source: source.length, targetBefore: target.length, stale, deleted: APPLY ? stale.length : 0, targetAfter: after, ok, mode: APPLY ? "apply" : "dry-run" };
  console.log(JSON.stringify(report, null, 2));
  if (!ok) throw new Error(`${table}: count still differs after reconciliation`);
  return report;
}

async function main() {
  // D1 is not production yet; Supabase is the authoritative source during cutover.
  // Keep this deliberately narrow: only remove stale library rows from previous migration attempts.
  await reconcileById("library", 10);
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
