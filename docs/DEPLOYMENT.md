# Deployment and migration runbook

This runbook is prepared, not executed. Do not point booknomics.com at an empty project.

## Proposed targets requiring account setup

- GitHub owner verified: `booknomics0-art`; proposed new private repo: `booknomics-platform`.
- Existing `booknomics0-art/booknomics0-art-booknomics` reports size 0; it was not modified.
- Supabase organization available: `booknomics0-art's Org` (`xuwtgdphbwwvdtjztdll`).
  Ask the owner to select it, obtain the live project cost, then confirm that cost.
  Suggested project name: `booknomics-production`; suggested region: Mumbai (`ap-south-1`).
  Organization currently reports Free; this is not a project cost quote or a guarantee of capacity.
- Vercel: proposed project `booknomics-platform`; no team was returned by the connector.
  Correct owner/team, GitHub integration and domain ownership must be verified.

## 1. Obtain a complete source backup

Old source ref in ZIP: `aszjrlarrutzyripxacw`. The connected Supabase account cannot
access it. The ZIP is code/schema, NOT a database backup.

Request an authorized export from the old Lovable/Supabase owner:

- Database schema + rows for all 33 public tables, plus current schema drift.
- Auth users/identities with original UUIDs using Supabase's supported migration process.
  Preserve UUIDs before importing profiles, library, progress or subscriptions.
- Storage bucket metadata AND object bytes (book-covers and book-assets). A SQL
  dump of storage metadata does not contain the uploaded files.
- Current counts, published/draft book counts, checksums and a timestamp.
- Configure provider secrets directly in the destination secret manager, not in chat or git.
- List current redirects, OAuth clients, scheduled jobs, webhooks and payment configuration.

Do not invent books, customer accounts, payment records or premium entitlements.
Do not treat public anonymous API reads or the old sitemap as a full export.
Use a brief source write freeze / final delta sync to avoid losing new writes.

## 2. Create destination, apply schema, then import data

Use Supabase tooling connected to the confirmed organization. Apply the 41 SQL
migrations in chronological order to a NEW database. The historical migration
`20260508181401...` intentionally no longer grants admin to all imported profiles.
This modified history is for the new installation; do not replay it on the old production project.

The final migration removes the email-based admin bypass, creates the missing
book-assets bucket, enforces unique payment/order IDs and adds private edit auditing.
A source dump may contain changes not represented by these migrations: diff its
schema first, and reconcile rather than blindly importing schema twice.

Import auth identities first, then public data in foreign-key order. Treat
user_roles as privileged data: review every admin and do not blindly preserve the
old blanket grants. Assign only the verified owner/admins after signup/import.
Verify the chosen owner's confirmed email and UUID before granting a role.

The new unique payment indexes intentionally reject duplicate source order/payment
IDs. Investigate duplicates; never discard paid entitlements to make import succeed.

Upload object bytes with their paths/content types intact. Rewrite old Supabase
storage URLs in cover_url, og_image, book_assets and any embedded rich content to
match the new project only after object existence/checksums are verified.

Run real Supabase security/performance advisors and verify RLS using anon, two
distinct ordinary users, an admin and the server role. The local PGlite tests use
mock auth/storage infrastructure and cannot replace these hosted checks.

## 3. Authentication and backend functions

Frontend variables on Vercel (Production and Preview, with the intended backend):

- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY (publishable key or matching anon JWT)
- VITE_SUPABASE_PROJECT_ID (optional supporting metadata)
- SITEMAP_MIN_BOOKS (set from verified migrated catalog, not artificially low to hide loss)

Configure Supabase Site URL as https://booknomics.com. Add exact preview callback
URLs and production callback paths to its redirect allowlist. Configure Google
OAuth client ID/secret in Supabase and the project's callback URL in Google Cloud.
Frontend Google sign-in now uses Supabase PKCE, not the old Lovable broker.

Deploy all 18 function directories. Keep service credentials server-side. Set
CORS_ALLOWED_ORIGINS to exact production/preview origins. Public MCP has
verify_jwt=false at the gateway because the MCP handler verifies OAuth/JWKS.
Other protected functions still validate the user internally; test gateway JWT
compatibility with the project's actual signing-key configuration.

Local config.toml auth settings are not proof of hosted dashboard configuration.
Explicitly set hosted OAuth Server on, authorization path /oauth/consent, dynamic
client registration for MCP, and asymmetric signing keys. Validate the full consent flow.

Several AI/GSC functions STILL depend on Lovable AI/connector gateways. Their keys
may not be portable outside Lovable. Test them, or replace the gateways with direct
provider integrations before claiming full feature parity. Also validate currently
supported Gemini/xAI/TTS model names; archived code uses older model identifiers.

Razorpay: set matching test credentials, enable/verify capture behavior, test order
creation, pending/captured/failed payment, replay and expiry. Captured status,
order ID, amount and currency now must match before activation. No automatic
webhook reconciliation/refund processing was added; plan and test those before
accepting unattended live payments.

## 4. GitHub and Vercel

Create the proposed private repo, push the reviewed files with package-lock.json,
and connect it to the verified Vercel team. Build: npm run build. Output: dist.
Use Node 22 LTS. Do not upload node_modules, dist, .env, backups or secret files.

Run a real-data build locally before deployment and commit generated vercel.json
redirects. Vercel reads project routing configuration before the remote build;
redirects written only during the remote build are not guaranteed to take effect.
The sitemap script writes both _redirects and Vercel redirect rules, but Vercel
itself does not consume _redirects. Rebuild/commit routing when slugs change.

Preview on a Vercel URL first. Verify login/signup/logout, OAuth consent, ordinary
and admin permissions, books/category/search, covers/audio, library save twice,
premium restrictions, payments, mobile layouts, SEO and direct route refreshes.
Old sitemaps are preserved in this package as historical assets; they MUST be
regenerated against the verified destination before release.

## 5. Domain cutover and rollback

Inspect the current booknomics.com and www records/hosting attachment. Add both
domains to the new Vercel project and follow the exact DNS records Vercel returns;
do not invent an IP address. Verify ownership, TLS, root/www canonical redirects,
OAuth URLs, payment callbacks and CORS before moving production traffic.

Keep old hosting/database available until counts, sample records and assets match
and the new system is verified. Record old DNS/hosting configuration. If smoke tests
fail, restore old routing. Account for writes made to the new database before any
rollback; simply restoring DNS does not reconcile divergent data.
