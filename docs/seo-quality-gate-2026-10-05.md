# SEO quality-gate verification — 2026-10-05

This branch fixes category editorial links by resolving curated book labels against the current published catalog at runtime.

Checks performed:
- only `published` books can become curated category targets;
- `draft` and `published_noindex` books are filtered from curated picks;
- category hubs with fewer than 3 indexable books receive `noindex`;
- current canonical `seo_slug || slug` is used instead of stale hard-coded slugs;
- Tyagpatra uses `tyagpatra` as both canonical slug fields, so no new hosting redirect is required for the recovered page.

The comparison-resource experiment was reverted after it exposed the build gate; production content for that resource remains unchanged on this branch.
