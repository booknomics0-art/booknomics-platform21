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

async function sourceRows() {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const response = await fetch(`${SOURCE_URL}/rest/v1/referrals?select=*&limit=500&offset=${offset}&order=created_at.asc`, { headers: sourceHeaders });
    const text = await response.text();
    if (response.status === 404 || (response.status === 400 && /does not exist/i.test(text))) return [];
    if (!response.ok) throw new Error(`referrals: ${response.status} ${text.slice(0, 700)}`);
    const batch = JSON.parse(text);
    rows.push(...batch);
    if (batch.length < 500) break;
  }
  return rows;
}

async function main() {
  const rows = await sourceRows();
  const report = { source: rows.length, written: 0, mode: APPLY ? "apply" : "dry-run" };
  if (!APPLY) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  for (const row of rows) {
    if (!row?.id || !row?.referrer_user_id || !row?.referred_user_id) continue;
    await d1(
      `INSERT INTO referrals (id, referrer_user_id, referred_user_id, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         referrer_user_id = excluded.referrer_user_id,
         referred_user_id = excluded.referred_user_id,
         created_at = excluded.created_at`,
      [row.id, row.referrer_user_id, row.referred_user_id, row.created_at || new Date().toISOString()]
    );
    report.written++;
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
