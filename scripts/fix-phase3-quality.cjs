const fs = require('fs');
const path = require('path');

// IMPORTANT: This script is intentionally audit-only.
// The previous version auto-generated generic APPLY_TODAY / REFLECTION prose and
// inserted generic headings into book drafts. That behavior could make unrelated
// books look complete while lowering factual and editorial quality.
//
// Missing narrative sections must be written from book-specific, source-verified
// material. This script now only reports what needs editorial work and never
// modifies a draft.

const DRAFTS_DIR = path.join(__dirname, '..', 'content-drafts');
const REPORT_PATH = path.join(DRAFTS_DIR, 'AUDIT_REPORT_FINAL.json');

if (!fs.existsSync(REPORT_PATH)) {
  console.error('AUDIT_REPORT_FINAL.json not found. Run the content audit first.');
  process.exitCode = 1;
} else {
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const failedBooks = Array.isArray(report.failedBooks) ? report.failedBooks : [];
  const candidates = failedBooks.filter((book) => Number(book.wordCount || 0) >= 2500 && book.format === 'old');

  const genericMarkers = [
    'आत्म-चिंतन का महत्व',
    'रिश्तों की कीमत',
    'सामाजिक जिम्मेदारी',
    'नैतिक मूल्यों का पालन',
    'परिवर्तन को स्वीकार करना',
    'particular way of seeing',
    'raises a basic methodological question',
    'evidence matters as well',
  ];

  const rows = [];
  for (const book of candidates) {
    const filepath = path.join(DRAFTS_DIR, book.filename || '');
    let content = '';
    try {
      content = fs.readFileSync(filepath, 'utf8');
    } catch {
      rows.push({ filename: book.filename, issue: 'file-missing' });
      continue;
    }

    const missing = [];
    for (const tag of ['#SUMMARY', '#KEY_INSIGHTS', '#APPLY_TODAY', '#REFLECTION', '#AUDIO_SCRIPT']) {
      if (!content.includes(tag)) missing.push(tag.slice(1));
    }

    const markerHits = genericMarkers.filter((marker) => content.toLowerCase().includes(marker.toLowerCase()));
    if (missing.length || markerHits.length) {
      rows.push({
        filename: book.filename,
        title: (content.match(/^Title:\s*(.+)$/m) || [])[1] || null,
        wordCount: book.wordCount,
        missing,
        genericMarkers: markerHits,
        issue: markerHits.length ? 'generic-template-content' : 'missing-book-specific-sections',
      });
    }
  }

  console.log('Booknomics Phase 3 quality audit (read-only)');
  console.log(`Candidates checked: ${candidates.length}`);
  console.log(`Drafts needing editorial work: ${rows.length}`);
  console.log('No files were modified. Automatic generic filler generation is disabled.');

  if (rows.length) {
    console.table(rows.map((row) => ({
      file: row.filename,
      issue: row.issue,
      missing: (row.missing || []).join(', '),
      genericMarkers: (row.genericMarkers || []).length,
    })));
    console.error('\nUse book-specific, source-verified writing for the flagged drafts before import/publishing.');
    process.exitCode = 1;
  }
}
