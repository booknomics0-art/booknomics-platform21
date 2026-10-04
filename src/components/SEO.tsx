import { Helmet } from "react-helmet-async";

const SITE = "https://www.booknomics.com";
const DEFAULT_OG = `${SITE}/og-default.svg`;

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

const normalizeStructuredDataUrls = (value: unknown): unknown => {
  if (typeof value === "string") return BOOKNOMICS_HOST_RE.test(value) ? normalizeUrl(value) : value;
  if (Array.isArray(value)) return value.map(normalizeStructuredDataUrls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, normalizeStructuredDataUrls(nested)]),
    );
  }
  return value;
};

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
  const ld: object[] = jsonLd ? (Array.isArray(jsonLd) ? [...jsonLd] : [jsonLd]) : [];

  if (breadcrumbs && breadcrumbs.length > 0) {
    ld.push({
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

  const normalizedLd = ld.map((entry) => normalizeStructuredDataUrls(entry) as object);

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
