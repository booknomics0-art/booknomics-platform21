# Legacy batch generator policy

The historical `generate-batch*.cjs` scripts are not approved for production content generation. They contain prewritten literary claims that can be inaccurate for specific books. All such scripts must fail closed. New content must be book-specific, source-verified, and pass the parser plus database quality guards before indexing.
