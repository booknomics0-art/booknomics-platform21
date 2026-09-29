const fs = require('fs');
const path = require('path');

const DRAFTS_DIR = path.join(__dirname, '..', 'content-drafts');
const files = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.txt')).sort();

console.log(`🔍 Final Audit with Adjusted Quality Scoring...\n`);

const results = {
  pass: [],
  fail: [],
  errors: []
};

files.forEach((filename, idx) => {
  const filepath = path.join(DRAFTS_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf8');
  
  // Extract SUMMARY section from both formats
  let summaryText = '';
  let format = 'unknown';
  
  // Old format
  const oldFormatMatch = content.match(/#SUMMARY\n([\s\S]*?)(?=#\w+|$)/);
  if (oldFormatMatch) {
    summaryText = oldFormatMatch[1].trim();
    format = 'old';
  }
  
  // New format
  if (!summaryText) {
    const newFormatMatch = content.match(/## 📚 SUMMARY\n([\s\S]*?)(?=## 🎨|$)/);
    if (newFormatMatch) {
      summaryText = newFormatMatch[1].trim();
      format = 'new';
    }
  }
  
  if (!summaryText) {
    results.errors.push({ filename, issue: 'No SUMMARY section' });
    return;
  }
  
  // Count words
  const cleanText = summaryText.replace(/[#*_`~]/g, '').replace(/\*\*/g, '').trim();
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const charCount = cleanText.replace(/\s+/g, '').length;
  
  // Quality indicators
  const hasSubheadings = (summaryText.match(/###/g) || []).length;
  const hasParagraphs = summaryText.split('\n\n').filter(p => p.trim().length > 50).length;
  
  // Adjusted quality scoring for old format
  let qualityScore = 0;
  
  // Word count (30 points)
  qualityScore += wordCount >= 2500 ? 30 : Math.floor((wordCount / 2500) * 30);
  
  // Structure (15 points)
  qualityScore += hasSubheadings >= 5 ? 15 : Math.floor((hasSubheadings / 5) * 15);
  
  // Content depth (15 points)
  qualityScore += hasParagraphs >= 8 ? 15 : Math.floor((hasParagraphs / 8) * 15);
  
  // Basic metadata (10 points)
  const hasBookTitle = content.match(/^#\s+.+/m) || content.match(/^Title:/m);
  const hasAuthor = content.match(/^##\s+.+/m) || content.match(/^Author:/m);
  qualityScore += hasBookTitle ? 5 : 0;
  qualityScore += hasAuthor ? 5 : 0;
  
  // Format-specific sections (20 points)
  if (format === 'old') {
    // Old format has different sections
    const hasHook = content.includes('#HOOK');
    const hasInsights = content.includes('#KEY_INSIGHTS');
    const hasApply = content.includes('#APPLY_TODAY');
    const hasReflection = content.includes('#REFLECTION');
    qualityScore += hasHook ? 5 : 0;
    qualityScore += hasInsights ? 5 : 0;
    qualityScore += hasApply ? 5 : 0;
    qualityScore += hasReflection ? 5 : 0;
  } else {
    // New format
    const hasHook = content.includes('🎯 HOOK');
    const hasBrief = content.includes('📖 BRIEF');
    const hasStyle = content.includes('🎨 STYLE');
    const hasMetadata = content.includes('📊 METADATA');
    qualityScore += hasHook ? 5 : 0;
    qualityScore += hasBrief ? 5 : 0;
    qualityScore += hasStyle ? 5 : 0;
    qualityScore += hasMetadata ? 5 : 0;
  }
  
  // Character count (10 points)
  qualityScore += charCount > 8000 ? 10 : Math.floor((charCount / 8000) * 10);
  
  const entry = {
    filename,
    format,
    wordCount,
    charCount,
    qualityScore,
    passes: wordCount >= 2500 && qualityScore >= 98
  };
  
  if (entry.passes) {
    results.pass.push(entry);
  } else {
    results.fail.push(entry);
  }
  
  if ((idx + 1) % 50 === 0) {
    console.log(`  ...checked ${idx + 1}/${files.length} files`);
  }
});

console.log(`\n${'='.repeat(70)}`);
console.log(`📊 FINAL AUDIT RESULTS (Adjusted Quality Scoring)`);
console.log(`${'='.repeat(70)}`);
console.log(`\n✅ PASS (2500+ words, 98%+ quality): ${results.pass.length}`);
console.log(`❌ FAIL (below threshold): ${results.fail.length}`);
console.log(`⚠️  ERRORS: ${results.errors.length}`);

if (results.fail.length > 0) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`❌ FAILED BOOKS (need fixing):`);
  console.log(`${'='.repeat(70)}`);
  
  results.fail.sort((a, b) => a.wordCount - b.wordCount);
  
  console.log(`\nShowing all ${results.fail.length} failed books:\n`);
  results.fail.forEach((entry, i) => {
    const wordDeficit = 2500 - entry.wordCount;
    console.log(`${i+1}. ${entry.filename}`);
    console.log(`   Words: ${entry.wordCount} (need ${wordDeficit > 0 ? '+' + wordDeficit : 'OK'}) | Quality: ${entry.qualityScore}%`);
  });
}

// Word count distribution
console.log(`\n${'='.repeat(70)}`);
console.log(`📈 WORD COUNT DISTRIBUTION:`);
console.log(`${'='.repeat(70)}`);
const allEntries = [...results.pass, ...results.fail];
const ranges = [
  { label: '< 1500 words', min: 0, max: 1499 },
  { label: '1500-1999', min: 1500, max: 1999 },
  { label: '2000-2499', min: 2000, max: 2499 },
  { label: '2500-2999', min: 2500, max: 2999 },
  { label: '3000+', min: 3000, max: 999999 }
];

ranges.forEach(r => {
  const count = allEntries.filter(e => e.wordCount >= r.min && e.wordCount <= r.max).length;
  const bar = '█'.repeat(Math.floor(count / 10));
  console.log(`  ${r.label.padEnd(15)} ${count.toString().padStart(4)} ${bar}`);
});

const avgWords = Math.round(allEntries.reduce((s, e) => s + e.wordCount, 0) / allEntries.length);
console.log(`\n  Average: ${avgWords} words`);
console.log(`  Total: ${(allEntries.reduce((s, e) => s + e.wordCount, 0) / 1000000).toFixed(2)} million words`);

// Save report
const reportPath = path.join(DRAFTS_DIR, 'AUDIT_REPORT_FINAL.json');
fs.writeFileSync(reportPath, JSON.stringify({ 
  total: files.length,
  pass: results.pass.length,
  fail: results.fail.length,
  errors: results.errors.length,
  failedBooks: results.fail.map(e => ({
    filename: e.filename,
    format: e.format,
    wordCount: e.wordCount,
    qualityScore: e.qualityScore,
    wordDeficit: Math.max(0, 2500 - e.wordCount)
  }))
}, null, 2));
console.log(`\n📄 Report saved to: content-drafts/AUDIT_REPORT_FINAL.json`);
