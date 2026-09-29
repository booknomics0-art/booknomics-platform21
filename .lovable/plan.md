## Current State (verified, not from audit)
- Book pages **already** emit per-page `<title>`, canonical, OG, Book/BreadcrumbList/FAQ JSON-LD via `react-helmet-async` (SEO.tsx + BookDetail.tsx). Googlebot sees them correctly. The audit's "canonical → homepage" claim is only true in the raw pre-JS HTML — you accepted client-side rendering, so this is expected and OK.
- Sitemap script exists and writes 175 URLs. Broken Hindi slugs like `/books/-etkl` are a **data issue** (bad slugs stored in DB), not a sitemap-generator bug — the current slugify strips Devanagari to empty and appends random suffix.
- `slugRedirects.ts` provides hardcoded alias→canonical map used by both `_redirects` and `BookDetail`.

## What I'll Build

### 1. DB migration (new columns on `books`)
- `seo_slug text unique` — long-tail slug (nullable; falls back to `slug`)
- `seo_keywords text[]`
- `old_slugs text[]` — every prior slug for 301 redirects
- Reuse existing `meta_title` / `meta_description` (already exist).
- Backfill trigger: when `seo_slug` changes, push previous value into `old_slugs`.

### 2. Slug tooling (`src/lib/slugTools.ts` — extended)
- `transliterateDevanagari()` — ITRANS-style map (मधुशाला→madhushala, हरिवंश→harivansh).
- `generateSeoSlug(book)` — picks formula by language/category, caps at 70 chars:
  - English: `{title}-summary-key-lessons`
  - Hindi-summary variant: `{title}-summary-in-hindi`
  - Hindi classic: `{title}-{author}-saransh`
- `generateSeoTitle/Description(book)` — templates with length caps.
- `suggestLongTailKeywords(book)` — 5-8 modifiers combined with title/author.
- `auditSeoSlug(slug)` — flags `-etkl` garbage, missing keyword, too long, etc.

### 3. Fix broken sitemap slugs
- `scripts/generate-sitemap.ts`: prefer `seo_slug` when present, else `slug`, and **skip** any slug that fails `auditSeoSlug` (garbage `-xxxx` pattern). Log skipped count.
- Update `slugify` in the script to call the new transliterator so future entries never emit empty slugs.

### 4. Redirects (client-side 301-style)
- `BookDetail.tsx`: on mount, if `params.slug` matches any book's `old_slugs`, `navigate(newUrl, { replace: true })`. Existing `slugRedirects.ts` map stays for hosting-level `_redirects`.
- `scripts/generate-sitemap.ts`: emit `_redirects` lines for every `old_slug → seo_slug` pair (real HTTP 301 on Lovable hosting isn't guaranteed, but the file is generated for parity).

### 5. Admin SEO Manager (new route `/admin/seo-manager`)
Three tabs in one page (`src/pages/admin/SeoManager.tsx`):
- **Editor** (per-book, opens from dashboard): slug + title + description + keywords + og-image + FAQ editor; live SERP preview + char counters + uniqueness check against other books.
- **Health Dashboard**: table of all books with per-book SEO score (reuses existing `seoScore.ts`), flags: broken slug, no keyword, missing meta, dup title/desc, thin content. Row actions: "Auto-fix" (fills from templates), "Open editor".
- **Bulk Auto-Generate**: button that runs template generator for every book missing `seo_slug`/`meta_title`/`meta_description`, pushes old slug into `old_slugs`, shows preview diff table, then commits on confirm.
- **Long-tail Suggester**: inline chip list in editor from `suggestLongTailKeywords`; click to add to `seo_keywords`.

Link added to existing admin navigation.

### 6. On-page (small tweaks)
- BookDetail H1: use `seo_title || meta_title || title` so long-tail keyword flows into H1.
- Sitemap regenerates automatically via existing `prebuild` hook — no extra job needed.

## Out of Scope (per your choices)
- Prerendering / SSR (client-side Helmet only).
- Hosting-level HTTP 301 for renamed slugs — using client redirect + `_redirects` file (Lovable hosting may ignore `_redirects` but Vercel/Netlify won't; harmless either way).
- Automatic slug rename of all 126 existing books — bulk generator will **preview** and require your click before writing. Nothing renames silently.

## Delivery order (single turn if you approve)
1. Migration → 2. slug tooling → 3. sitemap fix → 4. BookDetail old-slug redirect → 5. Admin SEO Manager page + route. Then you review the dashboard and hit "Bulk auto-generate" yourself.
