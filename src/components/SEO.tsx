import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";

const SITE = "https://www.booknomics.com";
const DEFAULT_OG = `${SITE}/og-default.svg`;
const ORG_ID = `${SITE}/#organization`;

interface SEOProps {
  title: string;
  description: string;
  /** Either provide a `canonical` absolute URL, or a `path` (will be prefixed with site URL). */
  canonical?: string;
  path?: string;
  ogImage?: string;
  /** Backward-compat alias for ogImage */
  image?: string;
  ogType?: "website" | "article" | "book";
  lang?: "en" | "hi";
  jsonLd?: object | object[];
  /** Auto-build BreadcrumbList JSON-LD. Each item path is relative (e.g. "/browse"). The final item should be the current page. */
  breadcrumbs?: Array<{ name: string; path: string }>;
  noindex?: boolean;
  /**
   * hreflang alternates. Absolute or relative URLs.
   * Only pass verified language counterparts; no alternates are invented automatically.
   */
  alternates?: { en?: string; hi?: string; xDefault?: string };
}

const BOOKNOMICS_HOST_RE = /^https?:\/\/(?:www\.)?booknomics\.com(?=\/|$)/i;

/**
 * Keep every first-party SEO URL on one HTTPS hostname. This intentionally
 * normalizes legacy absolute apex URLs passed by older page components while
 * leaving third-party URLs (for example Supabase-hosted cover images) intact.
 */
const normalizeUrl = (value: string) => {
  if (!value) return value;
  if (value.startsWith("/")) return `${SITE}${value}`;
  if (BOOKNOMICS_HOST_RE.test(value)) return value.replace(BOOKNOMICS_HOST_RE, SITE);
  return value;
};

const canonicalize = (value: string) => {
  const normalized = normalizeUrl(value);
  const withoutHash = normalized.split("#", 1)[0];
  return withoutHash.split("?", 1)[0];
};

/**
 * Normalize first-party URLs and repair Booknomics Organization nodes so every
 * Organization emitted inside Article/publisher markup carries a stable @id and logo.
 */
const normalizeStructuredData = (value: unknown): unknown => {
  if (typeof value === "string") return BOOKNOMICS_HOST_RE.test(value) ? normalizeUrl(value) : value;
  if (Array.isArray(value)) return value.map(normalizeStructuredData);
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const normalized = Object.fromEntries(
      Object.entries(input).map(([key, nested]) => [key, normalizeStructuredData(nested)]),
    ) as Record<string, unknown>;

    if (normalized["@type"] === "Organization" && normalized.name === "Booknomics") {
      if (!normalized["@id"]) normalized["@id"] = ORG_ID;
      if (!normalized.url) normalized.url = `${SITE}/`;
      if (!normalized.logo) {
        normalized.logo = {
          "@type": "ImageObject",
          url: DEFAULT_OG,
        };
      }
    }

    return normalized;
  }
  return value;
};

const getSchemaType = (entry: object) => (entry as Record<string, unknown>)["@type"];

export const SEO = ({
  title,
  description,
  canonical,
  path = "/",
  ogImage,
  image,
  ogType = "website",
  lang = "en",
  jsonLd,
  breadcrumbs,
  noindex = false,
  alternates,
}: SEOProps) => {
  const url = canonicalize(canonical ?? path);
  const ogImg = normalizeUrl(ogImage ?? image ?? DEFAULT_OG);
  const [bookArticlePublishedAt, setBookArticlePublishedAt] = useState<string | null>(null);

  const ld = useMemo(() => {
    const rows: object[] = jsonLd ? (Array.isArray(jsonLd) ? [...jsonLd] : [jsonLd]) : [];

    if (breadcrumbs && breadcrumbs.length > 0) {
      rows.push({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((b, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: b.name,
          item: normalizeUrl(b.path),
        })),
      });
    }

    return rows;
  }, [jsonLd, breadcrumbs]);

  const needsBookArticleDate = useMemo(
    () => ld.some((entry) => {
      const row = entry as Record<string, unknown>;
      return getSchemaType(entry) === "Article" && !row.datePublished;
    }) && url.includes("/books/"),
    [ld, url],
  );

  useEffect(() => {
    let cancelled = false;
    setBookArticlePublishedAt(null);

    if (!needsBookArticleDate) return () => { cancelled = true; };

    let slug = "";
    try {
      const parsed = new URL(url);
      const marker = "/books/";
      const idx = parsed.pathname.indexOf(marker);
      slug = idx >= 0 ? decodeURIComponent(parsed.pathname.slice(idx + marker.length)).replace(/\/$/, "") : "";
    } catch {
      slug = "";
    }
    if (!slug) return () => { cancelled = true; };

    (async () => {
      const bySlug = await supabase
        .from("books")
        .select("created_at")
        .eq("slug", slug)
        .eq("is_draft", false)
        .in("status", ["published", "published_noindex"])
        .maybeSingle();

      let createdAt = bySlug.data?.created_at ?? null;
      if (!createdAt) {
        const bySeoSlug = await supabase
          .from("books")
          .select("created_at")
          .eq("seo_slug", slug)
          .eq("is_draft", false)
          .in("status", ["published", "published_noindex"])
          .maybeSingle();
        createdAt = bySeoSlug.data?.created_at ?? null;
      }

      if (!cancelled && createdAt) setBookArticlePublishedAt(createdAt);
    })();

    return () => { cancelled = true; };
  }, [needsBookArticleDate, url]);

  const normalizedLd = ld
    .map((entry) => {
      const row = normalizeStructuredData(entry) as Record<string, unknown>;
      if (row["@type"] === "Article" && !row.datePublished && bookArticlePublishedAt) {
        row.datePublished = bookArticlePublishedAt;
      }
      return row;
    })
    // Never emit an incomplete book Article while its real publication timestamp
    // is still being resolved. Book + Breadcrumb markup remain available immediately.
    .filter((entry) => entry["@type"] !== "Article" || Boolean(entry.datePublished));

  // hreflang is emitted only for explicit, verified language counterparts.
  // A canonical page without a real translation relationship should not invent one.
  const hrefEn = alternates?.en ? canonicalize(alternates.en) : undefined;
  const hrefHi = alternates?.hi ? canonicalize(alternates.hi) : undefined;
  const hrefDefault = alternates
    ? (alternates.xDefault ? canonicalize(alternates.xDefault) : (hrefEn ?? hrefHi))
    : undefined;

  const robots = noindex
    ? "noindex,follow"
    : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

  return (
    <Helmet>
      <html lang={lang} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <link rel="canonical" href={url} />
      {hrefEn && <link rel="alternate" hrefLang="en" href={hrefEn} />}
      {hrefHi && <link rel="alternate" hrefLang="hi" href={hrefHi} />}
      {hrefDefault && <link rel="alternate" hrefLang="x-default" href={hrefDefault} />}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImg} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Booknomics" />
      <meta property="og:locale" content={lang === "hi" ? "hi_IN" : "en_US"} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImg} />
      {normalizedLd.map((obj, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(obj)}</script>
      ))}
    </Helmet>
  );
};
