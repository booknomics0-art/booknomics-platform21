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
      body: JSON.stringify({ sql, params }),
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) throw new Error(`D1 failed: ${JSON.stringify(payload)?.slice(0, 1000)}`);
  return payload.result?.[0] || payload.result || {};
}

async function sourceRows() {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const response = await fetch(
      `${SOURCE_URL}/rest/v1/book_modules?select=*&limit=500&offset=${offset}&order=created_at.asc`,
      { headers: sourceHeaders },
    );
    const text = await response.text();
    if (response.status === 404 || (response.status === 400 && /does not exist/i.test(text))) return [];
    if (!response.ok) throw new Error(`book_modules: ${response.status} ${text.slice(0, 700)}`);
    const batch = JSON.parse(text);
    rows.push(...batch);
    if (batch.length < 500) break;
  }
  return rows;
}

async function mapLimit(items, limit, fn) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) break;
      await fn(items[index], index);
    }
  });
  await Promise.all(workers);
}

async function verifyIds(rows) {
  const missing = [];
  for (let offset = 0; offset < rows.length; offset += 80) {
    const batch = rows.slice(offset, offset + 80).filter((row) => row?.id);
    if (!batch.length) continue;
    const placeholders = batch.map(() => "?").join(",");
    const result = await d1(`SELECT id FROM book_modules WHERE id IN (${placeholders})`, batch.map((row) => row.id));
    const found = new Set((result.results || []).map((row) => row.id));
    for (const row of batch) if (!found.has(row.id)) missing.push(row.id);
  }
  return missing;
}

async function main() {
  const rows = await sourceRows();
  const report = {
    source: rows.length,
    written: 0,
    destination: 0,
    missing_ids: [],
    mode: APPLY ? "apply" : "dry-run",
  };

  if (!APPLY) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  await mapLimit(rows, 8, async (row) => {
    if (!row?.id || !row?.book_id || !row?.part_number || !row?.part_key) return;
    const now = new Date().toISOString();
    await d1(
      `INSERT INTO book_modules
        (id,book_id,language,part_number,part_key,title,content,is_premium,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         book_id=excluded.book_id,
         language=excluded.language,
         part_number=excluded.part_number,
         part_key=excluded.part_key,
         title=excluded.title,
         content=excluded.content,
         is_premium=excluded.is_premium,
         created_at=excluded.created_at,
         updated_at=excluded.updated_at`,
      [
        row.id,
        row.book_id,
        row.language === "hi" ? "hi" : "en",
        Number(row.part_number),
        String(row.part_key),
        String(row.title || ""),
        String(row.content || ""),
        row.is_premium ? 1 : 0,
        row.created_at || now,
        row.updated_at || row.created_at || now,
      ],
    );
    report.written++;
  });

  const count = await d1("SELECT COUNT(*) AS total FROM book_modules");
  report.destination = Number(count.results?.[0]?.total || 0);
  report.missing_ids = await verifyIds(rows);

  console.log(JSON.stringify(report, null, 2));
  if (report.missing_ids.length || report.destination < report.source) {
    throw new Error(`book_modules parity failed: source=${report.source}, destination=${report.destination}, missing=${report.missing_ids.length}`);
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
