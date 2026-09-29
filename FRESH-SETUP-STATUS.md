# Fresh Supabase setup — current status

The user chose a fresh start; old database migration is explicitly cancelled.

## Completed and verified
- Project: booknomics-production, ref pbkfewrtdgiagytmcigb.
- Organization: booknomics0-art's Org (xuwtgdphbwwvdtjztdll).
- Region: ap-south-1 (Mumbai). Quoted creation cost: USD 0/month.
- Status: ACTIVE_HEALTHY at creation.
- 33 public tables, all with RLS enabled; books=0 and users=0.
- Public book-covers and book-assets buckets created.
- 41 prepared migrations installed as one baseline, plus secure_admin_books_view.
- Local migration filenames now match the hosted migration history. Original
  individual migrations are archived under docs/schema-history; do not replay them.
- books_admin now uses a security-invoker view over a private, authenticated,
  admin-guarded function. Security advisor no longer reports the definer-view error.
- Frontend configured for the fresh project; real catalog build succeeds with
  SITEMAP_MIN_BOOKS=0. Public catalog REST request returns HTTP 200 and [].
- No old customer/book/payment data was copied or fabricated.

## Deployed functions (ACTIVE)
admin-gsc, generate-book-content, generate-book-cover, generate-sitemap, mcp.

ACTIVE deployment does not mean external services are configured. AI/GSC provider
secrets were not available or set. Hosted Google OAuth/OAuth Server configuration
and the complete ChatGPT authorization flow remain unverified.

## Blocked / not complete
- No new GitHub repo was created, no code uploaded, no Vercel deployment created.
- booknomics.com DNS/hosting is unchanged.
- GitHub browser reached sign-in. A subsequent browser action was automatically
  rejected because it targeted Google account access without explicit permission.
  Do not bypass the block; obtain authorization for the required account sign-in.
- Automatic approval review rejected book-audio (ElevenLabs content transfer/cost),
  dispatch-n8n (configurable webhook data transfer) and generate-action-plan
  (Lovable AI content transfer/cost). These were not deployed. Get explicit approval
  for the named destinations/data and any usage costs before retrying.
- Other undeployed functions remain pending; payment and email functions are not live.
- Admin role must be granted to the verified owner after the first account exists.
- Earlier dependency/lint findings remain; read docs/AUDIT.md as the prior audit snapshot.

## Next
Complete GitHub/Vercel authentication through secure browser sign-in, create the
new repo, import on Vercel, set the public VITE variables from .env.example and
SITEMAP_MIN_BOOKS=0, then deploy/test before touching the domain. Resolve provider
permissions/secrets separately; never paste passwords or secret API keys into chat.
