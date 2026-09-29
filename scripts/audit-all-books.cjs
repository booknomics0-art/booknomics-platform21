const fs = require('fs');
const path = require('path');

const DRAFTS_DIR = path.join(__dirname, '..', 'content-drafts');
const files = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.txt')).sort();

console.log(`🔍 Auditing ${files.length} books...\n`);

const results = {
  pass: [],
  fail: [],
  errors: []
};

files.forEach((filename, idx) => {
  const filepath = path.join(DRAFTS_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf8');
  
  // Extract SUMMARY section
  const summaryMatch = content.match(/## 📚 SUMMARY\n([\s\S]*?)(?=## 🎨 STYLE|$)/);
  
  if (!summaryMatch) {
    results.errors.push({ filename, issue: 'No SUMMARY section found' });
    return;
  }
  
  const summaryText = summaryMatch[1].trim();
  
  // Count words (space-separated tokens, excluding markdown symbols)
  const cleanText = summaryText
    .replace(/[#*_`~]/g, '')
    .replace(/\*\*/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  // Character count (for Hindi, chars are more meaningful)
  const charCount = cleanText.replace(/\s+/g, '').length;
  
  // Check quality indicators
  const hasSubheadings = (summaryText.match(/###/g) || []).length;
  const hasParagraphs = summaryText.split('\n\n').filter(p => p.trim().length > 50).length;
  const hasBookTitle = content.match(/^# .+/m);
  const hasAuthor = content.match(/^## .+/m);
  const hasHook = content.includes('🎯 HOOK');
  const hasBrief = content.includes('📖 BRIEF');
  const hasStyle = content.includes('🎨 STYLE');
  const hasMetadata = content.includes('📊 METADATA');
  
  // Quality score
  let qualityScore = 0;
  qualityScore += wordCount >= 2500 ? 30 : Math.floor((wordCount / 2500) * 30);
  qualityScore += hasSubheadings >= 5 ? 15 : Math.floor((hasSubheadings / 5) * 15);
  qualityScore += hasParagraphs >= 8 ? 15 : Math.floor((hasParagraphs / 8) * 15);
  qualityScore += hasBookTitle ? 5 : 0;
  qualityScore += hasAuthor ? 5 : 0;
  qualityScore += hasHook ? 5 : 0;
  qualityScore += hasBrief ? 5 : 0;
  qualityScore += hasStyle ? 5 : 0;
  qualityScore += hasMetadata ? 5 : 0;
  qualityScore += charCount > 8000 ? 10 : Math.floor((charCount / 8000) * 10);
  
  const entry = {
    filename,
    wordCount,
    charCount,
    subheadings: hasSubheadings,
    paragraphs: hasParagraphs,
    qualityScore,
    passes: wordCount >= 2500 && qualityScore >= 98
  };
  
  if (wordCount >= 2500 && qualityScore >= 98) {
    results.pass.push(entry);
  } else {
    results.fail.push(entry);
  }
  
  // Progress
  if ((idx + 1) % 50 === 0) {
    console.log(`  ...checked ${idx + 1}/${files.length} files`);
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`📊 AUDIT RESULTS`);
console.log(`${'='.repeat(60)}`);
console.log(`\n✅ PASS (2500+ words, 98%+ quality): ${results.pass.length}`);
console.log(`❌ FAIL (below threshold): ${results.fail.length}`);
console.log(`⚠️  ERRORS: ${results.errors.length}`);

if (results.fail.length > 0) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`❌ FAILED BOOKS (need fixing):`);
  console.log(`${'='.repeat(60)}`);
  
  // Sort by word count (worst first)
  results.fail.sort((a, b) => a.wordCount - b.wordCount);
  
  results.fail.forEach((entry, i) => {
    const wordDeficit = 2500 - entry.wordCount;
    console.log(`\n${i+1}. ${entry.filename}`);
    console.log(`   Words: ${entry.wordCount} (need ${wordDeficit > 0 ? '+' + wordDeficit : 'OK'})`);
    console.log(`   Quality: ${entry.qualityScore}% (need 98%)`);
    console.log(`   Subheadings: ${entry.subheadings}, Paragraphs: ${entry.paragraphs}`);
  });
}

if (results.errors.length > 0) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`⚠️  ERRORS:`);
  console.log(`${'='.repeat(60)}`);
  results.errors.forEach(e => {
    console.log(`  ${e.filename}: ${e.issue}`);
  });
}

// Word count distribution
console.log(`\n${'='.repeat(60)}`);
console.log(`📈 WORD COUNT DISTRIBUTION:`);
console.log(`${'='.repeat(60)}`);
const allEntries = [...results.pass, ...results.fail];
const ranges = [
  { label: '< 1000 words', min: 0, max: 999 },
  { label: '1000-1499', min: 1000, max: 1499 },
  { label: '1500-1999', min: 1500, max: 1999 },
  { label: '2000-2499', min: 2000, max: 2499 },
  { label: '2500-2999', min: 2500, max: 2999 },
  { label: '3000-3999', min: 3000, max: 3999 },
  { label: '4000+', min: 4000, max: 999999 }
];

ranges.forEach(r => {
  const count = allEntries.filter(e => e.wordCount >= r.min && e.wordCount <= r.max).length;
  const bar = '█'.repeat(Math.floor(count / 5));
  console.log(`  ${r.label.padEnd(15)} ${count.toString().padStart(4)} ${bar}`);
});

// Summary stats
const avgWords = Math.round(allEntries.reduce((s, e) => s + e.wordCount, 0) / allEntries.length);
const minWords = Math.min(...allEntries.map(e => e.wordCount));
const maxWords = Math.max(...allEntries.map(e => e.wordCount));
console.log(`\n  Average: ${avgWords} words | Min: ${minWords} | Max: ${maxWords}`);

// Save detailed report
const reportPath = path.join(DRAFTS_DIR, 'AUDIT_REPORT.json');
fs.writeFileSync(reportPath, JSON.stringify({ 
  total: files.length,
  pass: results.pass.length,
  fail: results.fail.length,
  errors: results.errors.length,
  failedBooks: results.fail.map(e => ({
    filename: e.filename,
    wordCount: e.wordCount,
    qualityScore: e.qualityScore,
    wordDeficit: Math.max(0, 2500 - e.wordCount)
  })),
  errorBooks: results.errors
}, null, 2));
console.log(`\n📄 Full report saved to: content-drafts/AUDIT_REPORT.json`);
