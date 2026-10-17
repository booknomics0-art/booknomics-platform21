#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const env = (name, fallback = "") => (process.env[name] || fallback).trim();
const need = (name) => {
  const value = env(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const CF_ACCOUNT_ID = need("CLOUDFLARE_ACCOUNT_ID");
const CF_API_TOKEN = need("CLOUDFLARE_API_TOKEN");
const D1_ID = need("CLOUDFLARE_D1_DATABASE_ID");
const APPLY = env("MIGRATION_APPLY") === "YES";
const file = process.argv[2];

if (!file) {
  throw new Error("Usage: node cloudflare/apply-d1-sql.mjs <migration.sql>");
}

function stripLineComments(sql) {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

function splitStatements(sql) {
  const input = stripLineComments(sql);
  const statements = [];
  let current = "";
  let quote = null;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (quote) {
      current += char;
      if (char === quote) {
        if (next === quote) {
          current += next;
          i += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }

    if (char === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);
  return statements;
}

async function d1(sql) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_ID}/query`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${CF_API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ sql }),
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(`D1 statement failed: ${JSON.stringify(payload)?.slice(0, 1200)}`);
  }
  return payload;
}

async function main() {
  const sql = await readFile(file, "utf8");
  const statements = splitStatements(sql);
  if (!statements.length) throw new Error(`${file}: no SQL statements found`);

  console.log(`${file}: ${statements.length} statement(s); mode=${APPLY ? "apply" : "dry-run"}`);
  if (!APPLY) return;

  for (let index = 0; index < statements.length; index += 1) {
    await d1(statements[index]);
    console.log(`applied ${index + 1}/${statements.length}`);
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
