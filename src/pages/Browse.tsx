import { useEffect, useState, type ReactNode } from "react";
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
  const [categories, setCategories] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // Fetch only the small category column in batches. This keeps the filter
  // complete even after the catalog grows beyond Supabase's 1,000-row cap.
  useEffect(() => {
    if (categoryFilter) return;
    let cancelled = false;
    (async () => {
      const values = new Set<string>();
      const batchSize = 500;
      for (let from = 0; ; from += batchSize) {
        const { data, error } = await supabase
          .from("books")
          .select("category")
          .eq("is_draft", false)
          .in("status", ["published", "published_noindex"])
          .order("category")
          .range(from, from + batchSize - 1);
        if (error || cancelled) return;
        const batch = data ?? [];
        batch.forEach((row: any) => { if (row.category) values.add(row.category); });
        if (batch.length < batchSize) break;
      }
      if (!cancelled) setCategories(Array.from(values).sort());
    })();
    return () => { cancelled = true; };
  }, [categoryFilter]);

  // Server-side filtering + pagination keeps the public library light. We no
  // longer download hundreds/thousands of book cards just to render 24.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      let request = supabase
        .from("books")
        .select("id,slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time,language,created_at", { count: "exact" })
        .eq("is_draft", false)
        .in("status", ["published", "published_noindex"]);

      if (category !== "All") request = request.eq("category", category);
      if (language !== "all") request = request.eq("language", language);

      const q = debouncedQuery.trim().replace(/[,%()]/g, " ").slice(0, 80);
      if (q) request = request.or(`title.ilike.%${q}%,author.ilike.%${q}%,category.ilike.%${q}%`);

      if (sort === "latest") request = request.order("created_at", { ascending: false });
      else if (sort === "za") request = request.order("title", { ascending: false });
      else if (sort === "category") request = request.order("category").order("title");
      else request = request.order("title");

      const from = (page - 1) * PER_PAGE;
      const { data, error, count } = await request.range(from, from + PER_PAGE - 1);
      if (cancelled) return;
      if (error) {
        setBooks([]);
        setTotalCount(0);
        setLoadError(error.message);
      } else {
        setBooks((data ?? []) as any);
        setTotalCount(count ?? 0);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [category, language, sort, page, debouncedQuery]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      trackSearch(q, totalCount, categoryFilter ? "category_page" : "browse_page");
    }, 800);
    return () => clearTimeout(t);
  }, [query, totalCount, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const pageBooks = books;

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
      ? "Book Summaries in English & Hindi | Booknomics"
      : `${category} Book Summaries — Key Insights & Action Plans | Booknomics`;
  const seoDesc = category === "All"
    ? "Browse practical book summaries in English and Hindi with key insights, action systems, audio, and reflection prompts. Read smarter, apply faster."
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
        position: (page - 1) * PER_PAGE + i + 1,
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
      {!skipSeo && <SEO title={seoTitle} description={seoDesc} path={seoPath} jsonLd={collectionLd} breadcrumbs={[{ name: "Home", path: "/" }, { name: "Browse", path: "/browse" }]} />}

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
            {totalCount} {totalCount === 1 ? "book" : "books"}
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
        ) : loadError ? (
          <div className="text-center py-16">
            <p className="font-medium">We couldn't load the library.</p>
            <p className="text-sm text-muted-foreground mt-1">Please refresh and try again.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
              {pageBooks.map((b, i) => <BookCard key={b.id} book={b} priority={i < 4} />)}
            </div>

            {totalCount === 0 && (
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
