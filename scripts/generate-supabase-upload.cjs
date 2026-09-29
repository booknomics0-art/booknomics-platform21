/**
 * 🚀 450 Hindi Books → Supabase Upload Files Generator
 * 
 * Generates:
 *   1. INSERT_450_HINDI_BOOKS.sql  (full SQL, 18 MB)
 *   2. BOOKS_450_HINDI.json        (JSON array, 17 MB)
 *   3. sql-chunks/chunk-01.sql ... chunk-09.sql (50 books each)
 * 
 * Usage: node scripts/generate-supabase-upload.cjs
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'content-drafts');
const OUT_SQL = path.join(DIR, 'INSERT_450_HINDI_BOOKS.sql');
const OUT_JSON = path.join(DIR, 'BOOKS_450_HINDI.json');
const CHUNK_DIR = path.join(DIR, 'sql-chunks');

const colors = ['amber','red','green','blue','purple','orange','teal','pink','indigo','cyan','rose','emerald','violet','fuchsia','slate'];

// Get all book .txt files
const files = fs.readdirSync(DIR)
  .filter(f => f.endsWith('.txt') && !f.match(/AUDIT|BATCH|BRIEF|GUIDE|MASTER|INSERT/))
  .sort();

console.log(`\n🚀 Generating Supabase upload files for ${files.length} books...\n`);

function esc(s) { return (s || '').replace(/'/g, "''").replace(/\\/g, '\\\\'); }

const inserts = [];
const booksJson = [];

files.forEach((fn, i) => {
  const content = fs.readFileSync(path.join(DIR, fn), 'utf8');
  const isOld = content.includes('#BOOK_START');
  
  let title, author, category, slug, hook, summary, keyIdeas, applyToday, reflection, year;
  
  if (isOld) {
    title = (content.match(/^Title:\s*(.+)$/m) || [])[1] || fn.replace('.txt', '');
    author = (content.match(/^Author:\s*(.+)$/m) || [])[1] || '';
    category = (content.match(/^Category:\s*(.+)$/m) || [])[1] || 'साहित्य';
    slug = (content.match(/^Slug:\s*(.+)$/m) || [])[1] || fn.replace('.txt', '') + '-saransh';
    hook = (content.match(/#HOOK\n([\s\S]*?)(?=#\w)/) || [])[1] || '';
    summary = (content.match(/#SUMMARY\n([\s\S]*?)(?=#\w|$)/) || [])[1] || '';
    keyIdeas = (content.match(/#KEY_INSIGHTS\n([\s\S]*?)(?=#\w|$)/) || [])[1] || '';
    applyToday = (content.match(/#APPLY_TODAY\n([\s\S]*?)(?=#\w|$)/) || [])[1] || '';
    reflection = (content.match(/#REFLECTION\n([\s\S]*?)(?=#\w|$)/) || [])[1] || '';
  } else {
    title = (content.match(/^# (.+)$/m) || [])[1] || fn.replace('.txt', '');
    author = ((content.match(/^## (.+?)\s*\(/m) || [])[1] || '').trim();
    year = parseInt((content.match(/\((\d{4})\)/) || [])[1]) || null;
    category = (content.match(/\*\*श्रेणी\*\*:\s*(.+)$/m) || [])[1] || 'साहित्य';
    slug = fn.replace('.txt', '') + '-saransh';
    hook = ((content.match(/## 🎯 HOOK\n([\s\S]*?)(?=\n---)/) || [])[1] || '').replace(/"/g, '').trim();
    summary = ((content.match(/## 📚 SUMMARY\n([\s\S]*?)(?=\n---\n\n## 🎨|$)/) || [])[1] || '').trim();
    keyIdeas = ''; applyToday = ''; reflection = '';
  }
  
  if (!year) {
    const ym = (summary || '').match(/(\d{4})\s*(?:में)/);
    year = ym ? parseInt(ym[1]) : null;
    if (year && (year < 1000 || year > 2026)) year = null;
  }
  
  hook = hook.trim();
  if (!hook) hook = `${title} — ${author} की एक महत्वपूर्ण रचना।`;
  
  const wordCount = summary.trim().split(/\s+/).filter(w => w.length > 0).length;
  const readingTime = Math.max(8, Math.ceil(wordCount / 200));
  const overview = summary.substring(0, 800);
  
  // SQL INSERT
  inserts.push(`-- Book ${i + 1}: ${title} — ${author} (${wordCount} words)
INSERT INTO books (
  slug, title, author, category, cover_color, tagline, overview,
  key_ideas, deep_analysis, daily_application, reflection_questions,
  action_system, language, reading_time, rating, year
) VALUES (
  '${esc(slug)}',
  '${esc(title)}',
  '${esc(author)}',
  '${esc(category)}',
  '${colors[i % 15]}',
  '${esc(hook)}',
  '${esc(overview)}',
  '${esc(keyIdeas.trim())}',
  '${esc(summary)}',
  '${esc(applyToday.trim())}',
  '${esc(reflection.trim())}',
  '',
  'hi',
  ${readingTime},
  4.8,
  ${year || 'NULL'}
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, author = EXCLUDED.author, category = EXCLUDED.category,
  tagline = EXCLUDED.tagline, overview = EXCLUDED.overview, key_ideas = EXCLUDED.key_ideas,
  deep_analysis = EXCLUDED.deep_analysis, daily_application = EXCLUDED.daily_application,
  reflection_questions = EXCLUDED.reflection_questions, reading_time = EXCLUDED.reading_time,
  year = EXCLUDED.year;`);
  
  // JSON object
  booksJson.push({
    slug, title, author, category,
    cover_color: colors[i % 10],
    tagline: hook, overview,
    key_ideas: keyIdeas.trim(),
    deep_analysis: summary.trim(),
    daily_application: applyToday.trim(),
    reflection_questions: reflection.trim(),
    action_system: '',
    language: 'hi', reading_time: readingTime, rating: 4.8, year
  });
  
  if ((i + 1) % 100 === 0) console.log(`  ...${i + 1}/${files.length}`);
});

// === Write SQL file ===
let sql = `-- ============================================================================
-- 📚 HINDI BOOKS BULK INSERT — ${inserts.length} BOOKS
-- Generated: ${new Date().toISOString().split('T')[0]}
-- 
-- HOW TO UPLOAD:
--   Option A: Supabase Dashboard → SQL Editor → Paste each chunk file → Run
--   Option B: psql "CONNECTION_STRING" -f INSERT_450_HINDI_BOOKS.sql
-- 
-- VERIFY: SELECT COUNT(*) FROM books WHERE language = 'hi';
-- ============================================================================

BEGIN;

`;
sql += inserts.join('\n\n');
sql += '\n\nCOMMIT;\n';
fs.writeFileSync(OUT_SQL, sql);
console.log(`\n✅ SQL file: INSERT_450_HINDI_BOOKS.sql (${(fs.statSync(OUT_SQL).size / 1024 / 1024).toFixed(1)} MB)`);

// === Write JSON file ===
fs.writeFileSync(OUT_JSON, JSON.stringify(booksJson, null, 2));
console.log(`✅ JSON file: BOOKS_450_HINDI.json (${(fs.statSync(OUT_JSON).size / 1024 / 1024).toFixed(1)} MB)`);

// === Write SQL chunks ===
fs.mkdirSync(CHUNK_DIR, { recursive: true });
for (let i = 0; i < inserts.length; i += 50) {
  const chunk = inserts.slice(i, i + 50);
  const n = Math.floor(i / 50) + 1;
  const s = i + 1, e = Math.min(i + 50, inserts.length);
  let out = `-- 📚 Chunk ${n} (Books ${s}-${e})\n\nBEGIN;\n\n${chunk.join('\n\n')}\n\nCOMMIT;\n`;
  const fname = `chunk-${String(n).padStart(2, '0')}.sql`;
  fs.writeFileSync(path.join(CHUNK_DIR, fname), out);
  console.log(`✅ ${fname}: Books ${s}-${e}`);
}

console.log(`\n🎉 All done! Upload files ready in content-drafts/`);
console.log(`\n📋 Upload steps:`);
console.log(`   1. Open Supabase Dashboard → SQL Editor`);
console.log(`   2. Open sql-chunks/chunk-01.sql → Select All → Copy → Paste → Run`);
console.log(`   3. Repeat for chunk-02 through chunk-09`);
console.log(`   4. Verify: SELECT COUNT(*) FROM books WHERE language = 'hi';`);
console.log(`   Expected: 450\n`);
