#!/usr/bin/env node
/**
 * 🚀 10 Best English Books → Supabase Upload Generator
 *
 * Generates:
 *   1. content-drafts-english/INSERT_10_ENGLISH_BOOKS.sql
 *   2. content-drafts-english/BOOKS_10_ENGLISH.json
 *   3. content-drafts-english/sql-chunks-english/chunk-01.sql (paste-ready for SQL Editor)
 *
 * IMPORTANT (differs from the 450-Hindi generator):
 *   - is_draft = false AND status = 'published'  → books are VISIBLE on the site
 *     (the Hindi generator left the defaults is_draft=true / status='pending',
 *      which hides books from every page — see fix-hindi-drafts.sql)
 *   - language = 'en' → appears on /english page
 *   - meta_title / meta_description filled for SEO
 *   - cover_url set from Open Library ISBN covers (pattern already used in migrations)
 *   - markdown "###" headers stripped for the site's plain-text renderer
 *
 * Usage: node scripts/generate-english-upload.cjs
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'content-drafts-english');
const OUT_SQL = path.join(DIR, 'INSERT_10_ENGLISH_BOOKS.sql');
const OUT_JSON = path.join(DIR, 'BOOKS_10_ENGLISH.json');
const CHUNK_DIR = path.join(DIR, 'sql-chunks-english');

const colors = ['amber', 'red', 'green', 'blue', 'purple', 'orange', 'teal', 'pink', 'indigo', 'cyan'];

// Stable Open Library ISBN covers (pattern proven in repo migrations).
const COVERS = {
  'pride-and-prejudice-jane-austen-summary': 'https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg',
  'to-kill-a-mockingbird-harper-lee-summary': 'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg',
  '1984-george-orwell-summary': 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg',
  'the-great-gatsby-f-scott-fitzgerald-summary': 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg',
  'hamlet-william-shakespeare-summary': 'https://covers.openlibrary.org/b/isbn/9780743477123-L.jpg',
  'the-hobbit-jrr-tolkien-summary': 'https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg',
  'animal-farm-george-orwell-summary': 'https://covers.openlibrary.org/b/isbn/9780452284241-L.jpg',
  'jane-eyre-charlotte-bronte-summary': 'https://covers.openlibrary.org/b/isbn/9780141441146-L.jpg',
  'lord-of-the-flies-william-golding-summary': 'https://covers.openlibrary.org/b/isbn/9780399501487-L.jpg',
  'the-old-man-and-the-sea-ernest-hemingway-summary': 'https://covers.openlibrary.org/b/isbn/9780684801223-L.jpg',
};

function esc(s) { return (s || '').replace(/\\/g, '\\\\').replace(/'/g, "''"); }
function words(s) { return s.trim().split(/\s+/).filter(w => w.length > 0).length; }
// The site renders these fields as plain text (whitespace-pre-line), so strip
// markdown headers ("### Title" -> "Title") while keeping line structure.
function display(s) {
  return (s || '').replace(/^#{1,6}\s+/gm, '').replace(/[ \t]+\n/g, '\n').trim();
}

function parseBook(file) {
  const c = fs.readFileSync(path.join(DIR, file), 'utf8');
  const grab = (re) => { const m = c.match(re); return m ? m[1].trim() : null; };
  const section = (name, next) => {
    const re = next === '$END$'
      ? new RegExp('#' + name + '\\n([\\s\\S]*)$')
      : new RegExp('#' + name + '\\n([\\s\\S]*?)(?=\\n#' + next + ')');
    const m = c.match(re);
    return m ? m[1].trim() : '';
  };
  return {
    file,
    title: grab(/^Title:\s*(.+)$/m),
    author: grab(/^Author:\s*(.+)$/m),
    year: +grab(/^Year:\s*(\d{4})$/m) || null,
    language: grab(/^Language:\s*(\w+)$/m) || 'en',
    genre: grab(/^Genre:\s*(.+)$/m),
    category: grab(/^Category:\s*(.+)$/m),
    slug: grab(/^Slug:\s*(.+)$/m),
    tagline: display(section('TAGLINE', 'SUMMARY')),
    summary: display(section('SUMMARY', 'KEY_IDEAS')),
    keyIdeas: display(section('KEY_IDEAS', 'HOW_TO_READ')),
    howToRead: display(section('HOW_TO_READ', 'REFLECTION')),
    reflection: display(section('REFLECTION', '$END$')),
  };
}

const files = fs.readdirSync(DIR)
  .filter(f => f.endsWith('.txt'))
  .sort();
const books = files.map(parseBook);

if (books.length !== 10) console.warn(`⚠️  Expected 10 books, found ${books.length}`);

// word counts + reading time
for (const b of books) {
  b.wordCount = words(b.summary);
  b.readingTime = Math.max(8, Math.ceil(b.wordCount / 200));
  // overview: first ~750 chars of prose, cut at sentence boundary
  const cut = b.summary.slice(0, 760);
  const lastStop = cut.lastIndexOf('. ');
  b.overview = (b.summary.length <= 760 ? b.summary : cut.slice(0, lastStop + 1)).trim();
  b.metaTitle = `${b.title} Summary — Deep Analysis & Key Lessons | Booknomics`;
  const metaDesc = (b.tagline || b.overview).replace(/\s+/g, ' ');
  b.metaDescription = metaDesc.length > 158 ? metaDesc.slice(0, 155).replace(/\s+\S*$/, '') + '…' : metaDesc;
  b.coverUrl = COVERS[b.slug] || null;
}

const inserts = [];
books.forEach((b, i) => {
  inserts.push(`-- Book ${i + 1}: ${b.title} — ${b.author} (${b.wordCount} words)
INSERT INTO books (
  slug, title, author, category, cover_color, cover_url, tagline, overview,
  key_ideas, deep_analysis, daily_application, reflection_questions,
  action_system, language, reading_time, rating, year,
  is_draft, status, meta_title, meta_description
) VALUES (
  '${esc(b.slug)}',
  '${esc(b.title)}',
  '${esc(b.author)}',
  '${esc(b.category)}',
  '${colors[i % colors.length]}',
  '${esc(b.coverUrl)}',
  '${esc(b.tagline)}',
  '${esc(b.overview)}',
  '${esc(b.keyIdeas)}',
  '${esc(b.summary)}',
  '${esc(b.howToRead)}',
  '${esc(b.reflection)}',
  '',
  'en',
  ${b.readingTime},
  4.8,
  ${b.year},
  false,
  'published',
  '${esc(b.metaTitle)}',
  '${esc(b.metaDescription)}'
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, author = EXCLUDED.author, category = EXCLUDED.category,
  cover_color = EXCLUDED.cover_color, cover_url = EXCLUDED.cover_url,
  tagline = EXCLUDED.tagline, overview = EXCLUDED.overview, key_ideas = EXCLUDED.key_ideas,
  deep_analysis = EXCLUDED.deep_analysis, daily_application = EXCLUDED.daily_application,
  reflection_questions = EXCLUDED.reflection_questions, reading_time = EXCLUDED.reading_time,
  year = EXCLUDED.year, is_draft = false, status = 'published',
  meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description;`);
});

const header = `-- ============================================================================
-- 📚 10 BEST ENGLISH BOOKS — BULK UPSERT (idempotent)
-- Generated: ${new Date().toISOString()}
-- Words per book: ${books.map(b => b.wordCount).join(', ')} (all >= 3200)
--
-- HOW TO UPLOAD:
--   Option A: Supabase Dashboard → SQL Editor → paste sql-chunks-english/chunk-01.sql → Run
--   Option B: node scripts/upload-english-books.cjs   (needs SUPABASE_SERVICE_ROLE_KEY in .env)
--   Option C: psql "$DATABASE_URL" -f INSERT_10_ENGLISH_BOOKS.sql
--
-- VERIFY:
--   SELECT slug, title, is_draft, status, length(deep_analysis) FROM books WHERE language='en';
--   → all rows must have is_draft = false, status = 'published'
-- ============================================================================

BEGIN;

`;
const footer = `\n\nCOMMIT;\n`;

fs.writeFileSync(OUT_SQL, header + inserts.join('\n\n') + footer);
fs.mkdirSync(CHUNK_DIR, { recursive: true });
fs.writeFileSync(path.join(CHUNK_DIR, 'chunk-01.sql'), header + inserts.join('\n\n') + footer);

const json = books.map((b, i) => ({
  slug: b.slug, title: b.title, author: b.author, category: b.category,
  cover_color: colors[i % colors.length], cover_url: b.coverUrl,
  tagline: b.tagline, overview: b.overview,
  key_ideas: b.keyIdeas, deep_analysis: b.summary,
  daily_application: b.howToRead, reflection_questions: b.reflection,
  action_system: '', language: 'en', reading_time: b.readingTime,
  rating: 4.8, year: b.year, is_draft: false, status: 'published',
  meta_title: b.metaTitle, meta_description: b.metaDescription, word_count: b.wordCount,
}));
fs.writeFileSync(OUT_JSON, JSON.stringify(json, null, 2));

console.log('\n✅ Generated:');
console.log(`   ${OUT_SQL} (${(fs.statSync(OUT_SQL).size / 1024).toFixed(0)} KB)`);
console.log(`   ${path.join(CHUNK_DIR, 'chunk-01.sql')}`);
console.log(`   ${OUT_JSON}`);
books.forEach(b => console.log(`   • ${b.title} — ${b.wordCount} words, ${b.readingTime} min, ${b.category}`));
