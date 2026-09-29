# Current setup status

Fresh Supabase is provisioned and connected. GitHub/Vercel/domain steps remain pending.
Read [FRESH-SETUP-STATUS.md](FRESH-SETUP-STATUS.md) first; the migration audit below is historical.

# Booknomics

React + TypeScript + Vite frontend with Supabase database, authentication, storage,
18 Edge Functions, Razorpay payments and an OAuth-protected MCP/REST interface.

**Status: prepared migration candidate, not deployed.** No production database,
users, payment history or uploaded media have been copied. See `docs/AUDIT.md`.

The existing visual design, styles, page content and navigation are preserved.
Auth, role checks, payment verification, backend safeguards and deployment setup
have been repaired. New admin MCP tools edit book content, not application code.

## Local setup

1. Install Node.js 22 LTS (Node 24 is also accepted).
2. Run `npm ci`.
3. Copy `.env.example` to `.env` and set the new project's public URL and key.
4. Run `npm run dev`.

Never put service-role keys, payment secrets or provider keys into `VITE_*` variables.

## Validation

```sh
npm test
npm run typecheck
npm run build
npm run lint
npm run books:count        # read-only: repo + production sitemaps + Supabase book counts
```

`docs/CATALOG-COUNT-REPORT.md` records the current catalog evidence, what is
limiting growth, and the fixes ordered by impact.

Production builds fetch the published catalog and stop if it is unavailable or
below `SITEMAP_MIN_BOOKS` (50 by default). `ALLOW_STATIC_SITEMAP=true` is explicitly
for local/CI compilation with a placeholder backend; it is refused when
`VERCEL_ENV=production`. It does not prove that a deployment or database works.

`npm run lint` currently reports 237 errors and 22 warnings inherited or remaining
across the application. Dependencies have six remaining audit advisories. Do not
interpret a successful compilation as a completed security or production review.

## Handoff

- `docs/AUDIT.md`: findings, changes, evidence, access blockers and remaining risks.
- `docs/DEPLOYMENT.md`: migration order, configuration, domain cutover and rollback.
- `docs/API-MCP.md`: the existing REST API plus five MCP tools, including admin edits.
- `docs/FUNCTION-SECRETS.md`: secrets required by each function, extracted from code.
- `docs/CHANGES.json`: original-file hashes and an explicit change inventory.
- `docs/verification/`: actual build, test, lint and dependency-update outputs.

The original uploaded ZIP remains the authoritative untouched source snapshot.
