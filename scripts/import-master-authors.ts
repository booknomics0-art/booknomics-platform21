/**
 * Editorial-only importer for researched Mastery author biographies in D1.
 *
 * Usage (read-only by default):
 *   node --import tsx scripts/import-master-authors.ts ./reviewed-authors.json
 *   node --import tsx scripts/import-master-authors.ts ./reviewed-authors.json --apply
 *
 * Required env for D1 access: CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID,
 * CF_D1_DATABASE_ID. Never put credentials in the input JSON or source code.
 * The importer does not generate prose and refuses to overwrite different text.
 */
import { readFile } from "node:fs/promises";

type Language = "en" | "hi";
interface Biography {
  book_id: string;
  title: string;
  author: string;
  language: Language;
  text: string;
  sources: string[];
}

interface D1Book {
  id: string;
  title: string;
  author: string;
  language: string;
  is_draft: number;
  status: string;
  author_bio: string | null;
  author_bio_status: string | null;
}

const fail = (reason: string): never => { throw new Error(reason); };
const args = process.argv.slice(2);
const filename = args.find(arg => !arg.startsWith("--"));
const apply = args.includes("--apply");
if (!filename || args.some(arg => arg.startsWith("--") && arg !== "--apply")) {
  fail("Provide an editorial JSON file; optional --apply writes to D1 (default is dry-run).");
}

const raw: unknown = JSON.parse(await readFile(filename, "utf8"));
if (!Array.isArray(raw) || raw.length === 0 || raw.length > 500) {
  fail("Input must contain between 1 and 500 individually reviewed biographies.");
}

const entries: Biography[] = [];
const ids = new Set<string>();
for (const item of raw) {
  if (!item || typeof item !== "object") fail("Invalid input entry");
  const row = item as Record<string, unknown>;
  if (typeof row.book_id !== "string" || !/^[0-9a-f-]{36}$/i.test(row.book_id)) fail("Invalid published book ID");
  if (ids.has(row.book_id)) fail(`Duplicate book ID: ${row.book_id}`);
  ids.add(row.book_id);
  if (typeof row.title !== "string" || typeof row.author !== "string" || !row.title.trim() || !row.author.trim()) fail("Book title/author required");
  if (row.language !== "hi" && row.language !== "en") fail(`Invalid language for ${row.title}`);
  if (typeof row.text !== "string") fail(`Missing biography for ${row.title}`);
  const text = row.text.trim();
  const words = text.split(/\s+/u).length;
  const validWordCount = (words >= 180 && words <= 240) || (words >= 350 && words <= 460);
  if (!validWordCount || !text.includes(row.title) || !text.includes(row.author)) {
    fail(`${row.title}: expected 180–240 words (new cohort) or 350–460 (legacy), exact author and book title; received ${words} words`);
  }
  if (!Array.isArray(row.sources) || row.sources.length < 2 || row.sources.length > 12 ||
      !row.sources.every(source => typeof source === "string" && /^https:\/\/[^\s]+$/i.test(source)) ||
      new Set(row.sources).size !== row.sources.length) {
    fail(`${row.title}: provide at least two distinct HTTPS source URLs`);
  }
  entries.push({ book_id: row.book_id, title: row.title, author: row.author, language: row.language, text, sources: row.sources as string[] });
}

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CF_ACCOUNT_ID;
const database = process.env.CF_D1_DATABASE_ID;
if (!token || !account || !database) fail("Set CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID, CF_D1_DATABASE_ID for remote identity preflight");
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(database)}/query`;

type D1Query = { sql: string; params: string[] };
async function query(body: D1Query | { batch: D1Query[] }) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) fail(`Cloudflare API failed with HTTP ${response.status}`);
  const payload = await response.json() as {
    success: boolean;
    result: Array<{ results?: D1Book[]; success?: boolean; meta?: { changes?: number } }>;
    errors?: Array<{ message: string }>;
  };
  if (!payload.success || !Array.isArray(payload.result) || payload.result.some(result => result.success === false)) {
    fail(`D1 query rejected: ${payload.errors?.map(e => e.message).join(", ") || "unknown error"}`);
  }
  return payload.result;
}

// Preflight *all* IDs before any write. A different existing biography is not
// overwritten; this preserves previous editorial work and makes retries safe.
const found = new Map<string, D1Book>();
for (let offset = 0; offset < entries.length; offset += 50) {
  const batch = entries.slice(offset, offset + 50);
  const sql = `SELECT id,title,author,language,is_draft,status,author_bio,author_bio_status FROM books WHERE id IN (${batch.map(() => "?").join(",")})`;
  const result = await query({ sql, params: batch.map(row => row.book_id) });
  for (const row of result[0]?.results || []) found.set(row.id, row);
}

const toWrite: Biography[] = [];
let identical = 0;
for (const entry of entries) {
  const stored = found.get(entry.book_id);
  if (!stored) fail(`Not found in production D1: ${entry.title} (${entry.book_id})`);
  if (stored.title !== entry.title || stored.author !== entry.author || stored.language !== entry.language ||
      stored.is_draft !== 0 || !["published", "published_noindex"].includes(stored.status)) {
    fail(`Live metadata/status mismatch: ${entry.title} (${entry.book_id})`);
  }
  if (stored.author_bio?.trim()) {
    if (stored.author_bio.trim() !== entry.text) fail(`Refusing to overwrite existing biography: ${entry.title}`);
    if (stored.author_bio_status === "reviewed") { identical++; continue; }
  }
  toWrite.push(entry);
}

console.log(`Validated ${entries.length} biographies against published D1 IDs; ${identical} unchanged, ${toWrite.length} eligible; mode=${apply ? "APPLY" : "DRY RUN"}`);
if (!apply) process.exit(0);

const now = new Date().toISOString();
for (let offset = 0; offset < toWrite.length; offset += 20) {
  const batch = toWrite.slice(offset, offset + 20);
  const result = await query({ batch: batch.map(row => ({
    sql: `UPDATE books SET author_bio=?,author_bio_sources=?,author_bio_status='reviewed',author_bio_reviewed_at=? WHERE id=? AND title=? AND author=? AND language=? AND is_draft=0 AND status IN ('published','published_noindex') AND (author_bio_status IS NULL OR author_bio_status='draft')`,
    params: [row.text, JSON.stringify(row.sources), now, row.book_id, row.title, row.author, row.language],
  })) });
  if (result.length !== batch.length || result.some(row => row.meta?.changes !== 1)) {
    fail(`Unexpected D1 change count in batch beginning ${offset}; stop and inspect before retrying`);
  }
  console.log(`Applied ${Math.min(offset + batch.length, toWrite.length)}/${toWrite.length}`);
}
console.log(`Done: ${toWrite.length} new reviewed biographies; ${identical} already identical.`);
