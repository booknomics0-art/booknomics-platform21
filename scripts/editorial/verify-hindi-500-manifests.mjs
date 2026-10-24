// Read-only validator for the exact 2026-10-20 Hindi published-book audit snapshot.
// Run: node scripts/editorial/verify-hindi-500-manifests.mjs
import fs from 'node:fs';
import path from 'node:path';

const base = path.resolve('reports/hindi-editorial-20261020');
const expectedLengths = [500, 500, 500, 68];
const flagFields = [
  'generic_regional_ideas','generic_autobiography_ideas','generic_spiritual_ideas',
  'generic_action','generic_tracker','generic_reflections',
  'short_summary_field','short_analysis_field','short_practical_field','short_overview_field',
];
const genericFields = flagFields.filter(x => x.startsWith('generic_'));
const found = new Set();
const tally = Object.fromEntries(flagFields.map(x => [x,0]));
let flagged = 0;
for (let batch = 1; batch <= 4; batch++) {
  const manifest = JSON.parse(fs.readFileSync(path.join(base,`batch-${batch}-manifest.json`), 'utf8'));
  const count = expectedLengths[batch - 1], start = (batch - 1) * 500 + 1;
  if (manifest.batch !== batch || manifest.count !== count || manifest.books.length !== count)
    throw new Error(`Batch ${batch}: wrong count or batch ID`);
  let flaggedInBatch = 0;
  for (const [i, book] of manifest.books.entries()) {
    if (book.rn !== start+i || typeof book.id !== 'string' || found.has(book.id))
      throw new Error(`Batch ${batch}, row ${i}: order/identity duplicate`);
    if (!book.title || !book.author || !book.slug) throw new Error(`Book identity incomplete: ${book.id}`);
    found.add(book.id);
    for (const f of flagFields) {
      if (typeof book[f] !== 'boolean') throw new Error(`Expected boolean ${f}: ${book.id}`);
      if (book[f]) tally[f]++;
    }
    if (genericFields.some(f => book[f])) { flagged++; flaggedInBatch++; }
  }
  const expectedFlagged = [454,215,227,29][batch-1];
  if (flaggedInBatch !== expectedFlagged) throw new Error(`Batch ${batch} flagged ${flaggedInBatch} vs ${expectedFlagged}`);
  process.stdout.write(`Batch ${batch}: ${count} records, ${flaggedInBatch} obvious generic-flag books.\n`);
}
if (found.size !== 1568 || flagged !== 925 ||
 tally.generic_action !== 925 || tally.generic_tracker !== 917 ||
 tally.generic_reflections !== 317 || tally.generic_regional_ideas !== 317 ||
 tally.short_summary_field !== 290) throw new Error('Snapshot totals inconsistent');
process.stdout.write(JSON.stringify({books:found.size,flagged,fields:tally},null,2)+'\n');
