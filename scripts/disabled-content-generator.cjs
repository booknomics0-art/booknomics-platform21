// Shared fail-closed entry point for legacy generic content generators.
console.error('This legacy content generator is disabled because it can add generic or unverified prose to book summaries.');
console.error('Use the audit + book-specific, source-verified editorial workflow instead. See scripts/SAFE_CONTENT_FIX_NOTICE.txt.');
process.exitCode = 1;
