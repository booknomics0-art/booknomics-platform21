const fs = require('fs');

function patch(path, replacements) {
  let text = fs.readFileSync(path, 'utf8');
  for (const { from, to, count = 1 } of replacements) {
    const parts = text.split(from);
    const found = parts.length - 1;
    if (found !== count) {
      throw new Error(`${path}: expected ${count} occurrence(s), found ${found}: ${from.slice(0, 120)}`);
    }
    text = parts.join(to);
  }
  fs.writeFileSync(path, text);
}

patch('src/pages/Browse.tsx', [
  {
    from: '.select("id,slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time,language,created_at", { count: "exact" })',
    to: '.select("id,slug,seo_slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time,language,created_at", { count: "exact" })',
  },
  {
    from: '        setBooks(rows);',
    to: '        setBooks(rows.map((row: any) => ({ ...row, slug: row.seo_slug || row.slug })));',
  },
  {
    from: '    url: `https://booknomics.com${seoPath}`,',
    to: '    url: `https://www.booknomics.com${seoPath}`,',
  },
  {
    from: '        url: `https://booknomics.com/books/${b.slug}`,',
    to: '        url: `https://www.booknomics.com/books/${b.slug}`,',
  },
]);

patch('src/pages/Hindi.tsx', [
  {
    from: '.select("id,slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time", { count: "exact" })',
    to: '.select("id,slug,seo_slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time", { count: "exact" })',
  },
  {
    from: '        setBooks(data ?? []);',
    to: '        setBooks((data ?? []).map((row: any) => ({ ...row, slug: row.seo_slug || row.slug })));',
  },
]);

patch('src/pages/English.tsx', [
  {
    from: 'import { supabase } from "@/integrations/supabase/client";',
    to: 'import { supabase } from "@/integrations/supabase/client";\nimport { slugifyCategory } from "@/lib/categorySlug";',
  },
  {
    from: `const FEATURED_SLUGS = [
  "atomic-habits",
  "deep-work",
  "thinking-fast-and-slow",
  "the-7-habits",
  "sapiens",
  "man-search-meaning",
  "the-power-of-now",
  "rich-dad-poor-dad",
  "wings-of-fire",
  "the-alchemist",
];`,
    to: `const FEATURED_SLUGS = [
  "atomic-habits-james-clear-summary",
  "deep-work-cal-newport-summary",
  "thinking-fast-and-slow-daniel-kahneman-summary",
  "the-7-habits-of-highly-effective-people-stephen-r-covey-summary",
  "man-s-search-for-meaning-viktor-e-frankl-summary",
  "rich-dad-poor-dad-robert-t-kiyosaki-with-sharon-lechter-summary",
  "wings-of-fire-a-p-j-abdul-kalam-summary",
];`,
  },
  {
    from: 'const PAGE_URL = "https://booknomics.com/english";',
    to: 'const PAGE_URL = "https://www.booknomics.com/english";',
  },
  {
    from: '    const fields = "id,slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time" as const;',
    to: '    const fields = "id,slug,seo_slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time" as const;',
  },
  {
    from: '      const all = [...(featuredResult.data ?? []), ...(fallbackResult.data ?? [])] as BookCardData[];',
    to: '      const all = [...(featuredResult.data ?? []), ...(fallbackResult.data ?? [])].map((b: any) => ({ ...b, slug: b.seo_slug || b.slug })) as BookCardData[];',
  },
  {
    from: '{ "@type": "ListItem", position: 1, name: "Home", item: "https://booknomics.com/" },',
    to: '{ "@type": "ListItem", position: 1, name: "Home", item: "https://www.booknomics.com/" },',
  },
  {
    from: '        url: `https://booknomics.com/books/${b.slug}`,',
    to: '        url: `https://www.booknomics.com/books/${b.slug}`,',
  },
  {
    from: '              to={`/browse?category=${encodeURIComponent(cat)}&lang=en`}',
    to: '              to={`/category/${slugifyCategory(cat)}`}',
  },
]);

patch('src/pages/BookDetail.tsx', [
  {
    from: '.select("id,slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time")',
    to: '.select("id,slug,seo_slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time")',
    count: 2,
  },
  {
    from: '      .then(({ data }) => setRelated(data ?? []));',
    to: '      .then(({ data }) => setRelated((data ?? []).map((row: any) => ({ ...row, slug: row.seo_slug || row.slug }))));',
  },
  {
    from: '      .then(({ data }) => setSameLang(data ?? []));',
    to: '      .then(({ data }) => setSameLang((data ?? []).map((row: any) => ({ ...row, slug: row.seo_slug || row.slug }))));',
  },
  {
    from: '.select("title,slug")',
    to: '.select("title,slug,seo_slug")',
  },
  {
    from: '      .then(({ data }) => setLinkTargets((data ?? []) as LinkTarget[]));',
    to: '      .then(({ data }) => setLinkTargets((data ?? []).map((row: any) => ({ title: row.title, slug: row.seo_slug || row.slug })) as LinkTarget[]));',
  },
  {
    from: '  const canonical = `https://booknomics.com${seoPath}`;',
    to: '  const canonical = `https://www.booknomics.com${seoPath}`;',
  },
  {
    from: ': `https://booknomics.com${book.cover_url.startsWith("/") ? "" : "/"}${book.cover_url}`)',
    to: ': `https://www.booknomics.com${book.cover_url.startsWith("/") ? "" : "/"}${book.cover_url}`)',
  },
  {
    from: 'author: { "@type": "Organization", name: "Booknomics", url: "https://booknomics.com" },',
    to: 'author: { "@type": "Organization", name: "Booknomics", url: "https://www.booknomics.com" },',
  },
  {
    from: 'publisher: { "@type": "Organization", name: "Booknomics", url: "https://booknomics.com" },',
    to: 'publisher: { "@type": "Organization", name: "Booknomics", url: "https://www.booknomics.com" },',
  },
  {
    from: '  const categoryCrumb = `https://booknomics.com/category/${slugifyCategory(book.category)}`;',
    to: '  const categoryCrumb = `https://www.booknomics.com/category/${slugifyCategory(book.category)}`;',
  },
  {
    from: '{ "@type": "ListItem", position: 1, name: "Home", item: "https://booknomics.com/" },',
    to: '{ "@type": "ListItem", position: 1, name: "Home", item: "https://www.booknomics.com/" },',
  },
  {
    from: '{ "@type": "ListItem", position: 2, name: isHi ? "Hindi" : "Browse", item: isHi ? "https://booknomics.com/hindi" : "https://booknomics.com/browse" },',
    to: '{ "@type": "ListItem", position: 2, name: isHi ? "Hindi" : "Browse", item: isHi ? "https://www.booknomics.com/hindi" : "https://www.booknomics.com/browse" },',
  },
  {
    from: '  const counterpartUrl = counterpart ? `https://booknomics.com/books/${counterpart.slug}` : null;',
    to: '  const counterpartUrl = counterpart ? `https://www.booknomics.com/books/${counterpart.slug}` : null;',
  },
  {
    from: '                <Link to={`/browse?category=${encodeURIComponent(book.category)}`} className="hover:text-primary">',
    to: '                <Link to={`/category/${slugifyCategory(book.category)}`} className="hover:text-primary">',
  },
]);

console.log('Canonical internal-link cleanup applied.');
