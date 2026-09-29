import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Layout } from "@/components/Layout";
import { BookCard, BookCardData } from "@/components/BookCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/SEO";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { trackSearch } from "@/lib/analytics";
import { slugifyCategory } from "@/lib/categorySlug";
import { AdBanner } from "@/components/AdBanner";

type SortKey = "latest" | "az" | "za" | "category";
const PER_PAGE = 24;

type BrowseProps = {
  categoryFilter?: string;
  titleOverride?: string;
  introText?: string;
  skipSeo?: boolean;
  /** Rendered directly under the hero (used by category pages for editorial intros). */
  aboveContent?: ReactNode;
  /** Rendered after the book grid (related links, FAQs, CTAs). */
  belowContent?: ReactNode;
  /** Optional breadcrumb trail rendered above the hero. */
  breadcrumb?: ReactNode;
};

const Browse = ({ categoryFilter, titleOverride, introText, skipSeo, aboveContent, belowContent, breadcrumb }: BrowseProps = {}) => {
  const [params, setParams] = useSearchParams();
  const [books, setBooks] = useState<(BookCardData & { language?: string; created_at?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);
  const category = categoryFilter ?? (params.get("category") ?? "All");
  const language = params.get("lang") ?? "all";
  const sort = (params.get("sort") as SortKey) || "az";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);

  useEffect(() => {
    setLoading(true);
    supabase.from("books")
      .select("id,slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time,language,created_at")
      .eq("is_draft", false)
      .order("title")
      .then(({ data }) => { setBooks((data ?? []) as any); setLoading(false); });
  }, []);

  const categories = useMemo(() => Array.from(new Set(books.map(b => b.category).filter(Boolean))).sort(), [books]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    let list = books.filter(b => {
      const matchCat = category === "All" || b.category?.toLowerCase() === category.toLowerCase();
      const matchLang = language === "all" || b.language === language;
      const matchQ = !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.category?.toLowerCase().includes(q);
      return matchCat && matchLang && matchQ;
    });
    if (sort === "az") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "za") list = [...list].sort((a, b) => b.title.localeCompare(a.title));
    if (sort === "latest") list = [...list].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    if (sort === "category") list = [...list].sort((a, b) => (a.category ?? "").localeCompare(b.category ?? ""));
    return list;
  }, [books, debouncedQuery, category, language, sort]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      trackSearch(q, filtered.length, categoryFilter ? "category_page" : "browse_page");
    }, 800);
    return () => clearTimeout(t);
  }, [query, filtered.length, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageBooks = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const update = (key: string, val: string | null) => {
    const next = new URLSearchParams(params);
    if (!val || val === "All" || val === "all") next.delete(key); else next.set(key, val);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  const clearAll = () => {
    setQuery("");
    const next = new URLSearchParams();
    setParams(next);
  };

  const hasActiveFilters = (!categoryFilter && category !== "All") || language !== "all" || sort !== "az" || query.trim().length > 0;

  const heading = titleOverride ?? (category === "All" ? "Browse all books" : `${category} book summaries`);
  const seoTitle = titleOverride
    ? `${titleOverride} | Booknomics`
    : category === "All"
      ? "Browse 80+ Book Summaries in English & Hindi | Booknomics"
      : `${category} Book Summaries — Key Insights & Action Plans | Booknomics`;
  const seoDesc = category === "All"
    ? "Browse 80+ practical book summaries in English and Hindi. Key insights, action systems, audio scripts, and reflection prompts. Read smarter, apply faster."
    : `Explore ${category} book summaries with key insights, practical lessons, and step-by-step action plans on Booknomics — in English and Hindi.`;

  // Parameter URLs (/browse?category=…&q=…) must never compete with clean URLs:
  // point their canonical at the matching /category/* page, else at /browse.
  const paramCategory = !categoryFilter && category !== "All" ? category : null;
  const seoPath = categoryFilter
    ? `/category/${slugifyCategory(categoryFilter)}`
    : paramCategory
      ? `/category/${slugifyCategory(paramCategory)}`
      : "/browse";
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: heading,
    url: `https://booknomics.com${seoPath}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: pageBooks.slice(0, 30).map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://booknomics.com/books/${b.slug}`,
        name: b.title,
      })),
    },
  };

  const sortLabel: Record<SortKey, string> = {
    az: "A–Z",
    za: "Z–A",
    latest: "Newest",
    category: "Category",
  };

  return (
    <Layout>
      {!skipSeo && <SEO title={seoTitle} description={seoDesc} path={seoPath} alternates={seoPath === "/browse" ? { en: "/browse", hi: "/hindi", xDefault: "/browse" } : undefined} jsonLd={collectionLd} breadcrumbs={[{ name: "Home", path: "/" }, { name: "Browse", path: "/browse" }]} />}

      {breadcrumb}

      {/* Compact header */}
      <section className="border-b border-border bg-hero">
        <div className="container py-6 md:py-10">
          <div className="text-[10px] md:text-xs tracking-[0.25em] uppercase text-primary font-semibold mb-2">The library</div>
          <h1 className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-2">{heading}</h1>
          <p className="text-muted-foreground max-w-2xl text-sm md:text-base mb-4 md:mb-5">
            {introText ?? "A curated library of book summaries, insights, and action plans."}
          </p>
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="book-search" className="sr-only">Search books</label>
            <Input
              id="book-search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search books, authors, or topics…"
              className="pl-11 h-11 rounded-full bg-background/80 backdrop-blur"
            />
          </div>

          {/* Language toggle */}
          <div className="mt-3 inline-flex rounded-full border border-border p-1 bg-background/60 backdrop-blur">
            {[
              { v: "all", l: "All" },
              { v: "en", l: "English" },
              { v: "hi", l: "हिंदी" },
            ].map(opt => (
              <button
                key={opt.v}
                onClick={() => update("lang", opt.v)}
                className={`px-3.5 py-1 text-xs md:text-sm rounded-full transition ${language === opt.v ? "bg-gold text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
              >
                {opt.l}
              </button>
            ))}
          </div>

        </div>
      </section>

      {/* Compact filter bar */}
      <section className="container py-4 md:py-5">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {!categoryFilter && (
            <Select value={category} onValueChange={(v) => update("category", v)}>
              <SelectTrigger className="w-auto min-w-[140px] h-9 rounded-full text-xs md:text-sm">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="All">All categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={language} onValueChange={(v) => update("lang", v)}>
            <SelectTrigger className="w-auto min-w-[130px] h-9 rounded-full text-xs md:text-sm">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All languages</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="hi">हिंदी</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v) => update("sort", v)}>
            <SelectTrigger className="w-auto min-w-[120px] h-9 rounded-full text-xs md:text-sm">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="az">Sort: A–Z</SelectItem>
              <SelectItem value="za">Sort: Z–A</SelectItem>
              <SelectItem value="latest">Sort: Newest</SelectItem>
              <SelectItem value="category">Sort: Category</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 rounded-full text-xs text-muted-foreground hover:text-foreground">
              Clear filters
            </Button>
          )}

          <span className="text-xs md:text-sm text-muted-foreground ml-auto">
            {filtered.length} {filtered.length === 1 ? "book" : "books"}
          </span>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {query.trim() && (
              <button
                onClick={() => setQuery("")}
                className="inline-flex items-center gap-1 text-[11px] rounded-full bg-muted px-2.5 py-1 hover:bg-muted/70"
              >
                "{query.trim()}" <X className="h-3 w-3" />
              </button>
            )}
            {!categoryFilter && category !== "All" && (
              <button
                onClick={() => update("category", null)}
                className="inline-flex items-center gap-1 text-[11px] rounded-full bg-muted px-2.5 py-1 hover:bg-muted/70"
              >
                {category} <X className="h-3 w-3" />
              </button>
            )}
            {language !== "all" && (
              <button
                onClick={() => update("lang", null)}
                className="inline-flex items-center gap-1 text-[11px] rounded-full bg-muted px-2.5 py-1 hover:bg-muted/70"
              >
                {language === "hi" ? "हिंदी" : "English"} <X className="h-3 w-3" />
              </button>
            )}
            {sort !== "az" && (
              <button
                onClick={() => update("sort", null)}
                className="inline-flex items-center gap-1 text-[11px] rounded-full bg-muted px-2.5 py-1 hover:bg-muted/70"
              >
                {sortLabel[sort]} <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </section>

      {aboveContent}

      <section className="container pb-12">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[2/3] w-full rounded-md" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
              {pageBooks.map((b, i) => <BookCard key={b.id} book={b} priority={i < 4} />)}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-20 text-muted-foreground">
                <p className="mb-3">No books found.</p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearAll}>Clear filters</Button>
                )}
              </div>
            )}

            {totalPages > 1 && (
              <nav aria-label="Pagination" className="flex justify-center items-center gap-2 mt-10">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => update("page", String(page - 1))}>Prev</Button>
                <span className="text-sm text-muted-foreground px-2">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => update("page", String(page + 1))}>Next</Button>
              </nav>
            )}
          </>
        )}

        {/* Ad below book grid */}
        <div className="mt-8">
          <AdBanner slot="auto" format="horizontal" className="w-full max-w-4xl mx-auto" />
        </div>
      </section>

      {belowContent}
    </Layout>
  );
};

export default Browse;
