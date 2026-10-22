#!/usr/bin/env node
// Turns a manually authored, editorially approved bilingual book into D1 SQL.
// This script NEVER generates or translates text and makes ZERO network calls.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const FIELDS = ['overview', 'deep_summary', 'key_ideas', 'deep_analysis', 'daily_application',
  'action_system', 'practice_tracker', 'reflection_questions', 'real_life_example'];
const FREE = FIELDS.slice(0, 5);
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sqlText = (value) => `'${String(value).replaceAll("'", "''")}'`;
const die = (message) => { throw new Error(message); };

export function prepareReviewedTranslation(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) die('Input must be a JSON object');
  const { bookId, sourceLanguage, targetLanguage, accessTier, sourceSections, translatedSections, reviewedBy } = document;
  if (typeof bookId !== 'string' || !ID.test(bookId)) die('Valid bookId UUID is required');
  if (!['en', 'hi'].includes(sourceLanguage) || !['en', 'hi'].includes(targetLanguage)
    || sourceLanguage === targetLanguage) die('sourceLanguage and targetLanguage must differ and be en/hi');
  if (!['free', 'premium'].includes(accessTier)) die('accessTier must be free or premium');
  if (typeof reviewedBy !== 'string' || reviewedBy.trim().length < 3) die('An editorial reviewer is required');
  if (document.approved !== true) die('An explicit approved: true editorial decision is required');
  if (!sourceSections || !translatedSections || typeof sourceSections !== 'object'
    || typeof translatedSections !== 'object' || Array.isArray(sourceSections) || Array.isArray(translatedSections)) {
    die('sourceSections and translatedSections must be key-value objects');
  }

  // This exact order matches the Worker hash, and must be based on the latest
  // D1 source fields—not copied from a stale summary or generated placeholders.
  const allowed = accessTier === 'premium' ? FIELDS : FREE;
  const sections = {};
  const translations = {};
  const warnings = [];
  for (const field of allowed) {
    const source = sourceSections[field];
    const translated = translatedSections[field];
    if (source == null || source === '') {
      if (translated != null && translated !== '') die(`${field}: no source, but a translation was supplied`);
      continue;
    }
    if (typeof source !== 'string' || !source.trim()) die(`${field}: source must be a nonempty string`);
    if (typeof translated !== 'string' || !translated.trim()) die(`${field}: translated text missing`);
    if (source.trim() === translated.trim()) die(`${field}: untranslated source was copied verbatim`);
    if (translated.length < Math.max(20, source.length * 0.25)) die(`${field}: suspiciously short; rejected to prevent summarization`);
    if (targetLanguage === 'hi') {
      const devanagari = (translated.match(/[\u0900-\u097f]/g) || []).length;
      if (devanagari / translated.length < 0.20) die(`${field}: too little Devanagari for a Hindi translation`);
    }
    const sourceHeadings = (source.match(/^#{1,4} /gm) || []).length;
    const translatedHeadings = (translated.match(/^#{1,4} /gm) || []).length;
    if (sourceHeadings !== translatedHeadings) warnings.push(`${field}: Markdown heading count ${sourceHeadings}→${translatedHeadings}; review structure`);
    sections[field] = source;
    translations[field] = translated;
  }
  if (!Object.keys(sections).length) die('No nonempty source sections were supplied');
  for (const field of Object.keys(translatedSections)) {
    if (!allowed.includes(field)) die(`Unauthorized or unknown field: ${field}`);
  }

  const sourceHash = createHash('sha256')
    .update(JSON.stringify({ source: sourceLanguage, sections })).digest('hex');
  const now = new Date().toISOString();
  const sql = `INSERT INTO book_translations
  (book_id, target_language, access_tier, source_hash, content_json, review_status, reviewed_by, reviewed_at, updated_at)
  VALUES (${[bookId, targetLanguage, accessTier, sourceHash, JSON.stringify(translations), 'approved', reviewedBy.trim(), now, now]
    .map(sqlText).join(', ')})
  ON CONFLICT(book_id, target_language, access_tier) DO UPDATE SET
    source_hash=excluded.source_hash, content_json=excluded.content_json,
    review_status=excluded.review_status, reviewed_by=excluded.reviewed_by,
    reviewed_at=excluded.reviewed_at, updated_at=excluded.updated_at;`;
  return { sql, sourceHash, fields: Object.keys(translations), warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) die('Usage: node scripts/prepare-reviewed-translation.mjs <reviewed.json> <output.sql>');
  const doc = JSON.parse(readFileSync(input, 'utf8'));
  const result = prepareReviewedTranslation(doc);
  writeFileSync(output, `-- Editorially reviewed translation. Generated from ${JSON.stringify(input)}; no model/API calls.\n${result.sql}\n`);
  process.stdout.write(JSON.stringify({ output, hash: result.sourceHash, fields: result.fields, warnings: result.warnings }) + '\n');
}
