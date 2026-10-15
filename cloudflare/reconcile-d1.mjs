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

const HOMEPAGE_SLUGS = new Set([
  "atomic-habits-james-clear-summary",
  "deep-work-cal-newport-summary",
  "the-psychology-of-money-morgan-housel-summary",
  "thinking-fast-and-slow-daniel-kahneman-summary",
  "godan-munshi-premchand-saransh",
  "nirmala-munshi-premchand-saransh",
  "gaban-munshi-premchand-saransh",
  "rich-dad-poor-dad-robert-t-kiyosaki-with-sharon-lechter-summary",
  "the-7-habits-of-highly-effective-people-stephen-r-covey-summary",
  "how-to-win-friends-and-influence-people-dale-carnegie-summary",
  "the-power-of-habit-charles-duhigg-summary",
]);

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

const isFallbackCover = (value) => !value || String(value).startsWith("/api/covers/") || String(value).includes("/functions/v1/book-cover-fallback");
const isRealCover = (value) => Boolean(value) && !isFallbackCover(value);

async function sourceBookCovers() {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const response = await fetch(
      `${SOURCE_URL}/rest/v1/books?select=id,slug,seo_slug,title,cover_url&order=id.asc&limit=500&offset=${offset}`,
      { headers: sourceHeaders },
    );
    const text = await response.text();
    if (!response.ok) throw new Error(`books cover source: ${response.status} ${text.slice(0, 500)}`);
    const batch = JSON.parse(text);
    rows.push(...batch);
    if (batch.length < 500) break;
  }
  return rows;
}

async function reconcileRealCoverUrls() {
  const source = await sourceBookCovers();
  const targetResult = await d1("SELECT id, slug, seo_slug, title, cover_url FROM books ORDER BY id");
  const target = targetResult.results || [];
  const targetById = new Map(target.map((row) => [String(row.id), row]));

  const changes = [];
  for (const row of source) {
    const current = targetById.get(String(row.id));
    if (!current) continue;
    if (isFallbackCover(current.cover_url) && isRealCover(row.cover_url)) {
      changes.push({
        id: String(row.id),
        slug: String(row.seo_slug || row.slug || ""),
        title: String(row.title || ""),
        from: current.cover_url || null,
        to: String(row.cover_url),
      });
    }
  }

  const homepageChanges = changes.filter((row) => HOMEPAGE_SLUGS.has(row.slug));
  console.log(JSON.stringify({ coverUrlReconcile: { mode: APPLY ? "apply" : "dry-run", changes: changes.length, homepageChanges } }, null, 2));

  if (APPLY) {
    for (let i = 0; i < changes.length; i += 30) {
      const batch = changes.slice(i, i + 30);
      const cases = batch.map(() => "WHEN ? THEN ?").join(" ");
      const marks = batch.map(() => "?").join(",");
      const params = [...batch.flatMap((row) => [row.id, row.to]), ...batch.map((row) => row.id)];
      await d1(`UPDATE books SET cover_url = CASE id ${cases} ELSE cover_url END WHERE id IN (${marks})`, params);
    }
  }

  const verify = await d1("SELECT id, slug, seo_slug, title, cover_url FROM books ORDER BY id");
  const verifyById = new Map((verify.results || []).map((row) => [String(row.id), row]));
  const failures = [];
  const homepageVerification = [];
  for (const row of source) {
    const slug = String(row.seo_slug || row.slug || "");
    if (!HOMEPAGE_SLUGS.has(slug) || !isRealCover(row.cover_url)) continue;
    const current = verifyById.get(String(row.id));
    const ok = Boolean(current) && String(current.cover_url || "") === String(row.cover_url);
    homepageVerification.push({ slug, title: row.title, cover_url: current?.cover_url || null, ok });
    if (!ok) failures.push(slug);
  }

  console.log(JSON.stringify({ coverUrlVerification: { homepageVerification, failures } }, null, 2));
  if (failures.length) throw new Error(`Homepage cover URL reconciliation failed for: ${failures.join(", ")}`);
}

async function main() {
  await reconcileById("library", 10);
  await reconcileRealCoverUrls();
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
