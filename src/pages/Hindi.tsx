import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Layout } from "@/components/Layout";
import { BookCard, BookCardData } from "@/components/BookCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEO } from "@/components/SEO";
import { apiFetch } from "@/lib/cloudflareApi";
import { trackSearch } from "@/lib/analytics";

const FEATURED_HINDI_BOOKS = [
  { title: "रक्तकरबी", slug: "रक्तकरबी" },
  { title: "ढाई घर", slug: "ढाई-घर-गिरिराज-किशोर-saransh" },
  { title: "अंतराल", slug: "अंतराल-नरेनदर-कोहली-सारांश" },
  { title: "अधिकार", slug: "अधिकार-नरेनदर-कोहली-सारांश" },
  { title: "अँधेरे के जुगनू", slug: "अंधेरे-के-जुगनू-रांगेय-राघव-सारांश" },
  { title: "अभ्युदय", slug: "अभयुदय-नरेनदर-कोहली-सारांश" },
  { title: "अवसर", slug: "अवसर-नरेनदर-कोहली-सारांश" },
  { title: "अहिल्याबाई", slug: "अहिलयाबाई-वृंदावनलाल-वरमा-सारांश" },
] as const;

type ApiBook = BookCardData & { seo_slug?: string | null };

const Hindi = () => {
  const [params, setParams] = useSearchParams();
  const [books, setBooks] = useState<BookCardData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(48);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const category = params.get("category") ?? "सभी";

  // Fetch unique Hindi categories as a compact directory, not 4 serial pages.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await apiFetch<{ data: string[] }>("/api/categories");
        if (!cancelled) setCategories((payload.data ?? []).sort());
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setVisibleCount(48);
  }, [debouncedQuery, category]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const search = new URLSearchParams({
          language: "hi",
          sort: "az",
          limit: String(Math.min(visibleCount, 100)),
          offset: "0",
        });
        if (category !== "सभी") search.set("category", category);
        const q = debouncedQuery.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ").slice(0, 80);
        if (q) search.set("q", q);

        const payload = await apiFetch<{ data: ApiBook[]; count: number }>(`/api/books?${search.toString()}`);
        if (cancelled) return;
        setBooks((payload.data ?? []).map((row) => ({ ...row, slug: row.seo_slug || row.slug })));
        setTotalCount(payload.count ?? 0);
        if (q && visibleCount === 48) trackSearch(q, payload.count ?? 0, "hindi_library");
      } catch (error) {
        if (cancelled) return;
        setBooks([]);
        setTotalCount(0);
        setLoadError(error instanceof Error ? error.message : "Hindi library unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [category, debouncedQuery, visibleCount]);

  const setCategory = (c: string) => {
    const next = new URLSearchParams(params);
    if (c === "सभी") next.delete("category"); else next.set("category", c);
    next.delete("page");
    setParams(next);
  };

  const collectionItems = books.length > 0 ? books : FEATURED_HINDI_BOOKS;
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Booknomics Hindi Library",
    url: "https://www.booknomics.com/hindi",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: collectionItems.slice(0, 30).map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://www.booknomics.com/books/${b.slug}`,
        name: b.title,
      })),
    },
  };

  return (
    <Layout>
      <SEO
        title="हिंदी पुस्तकालय — सभी प्रकाशित हिंदी पुस्तक सारांश | Booknomics"
        description="Booknomics की पूरी हिंदी पुस्तक लाइब्रेरी ब्राउज़ करें — प्रकाशित हिंदी पुस्तक सारांश, लेखक, श्रेणियाँ, मुख्य विचार और गहन विश्लेषण एक जगह।"
        canonical="https://www.booknomics.com/hindi"
        lang="hi"
        jsonLd={collectionLd}
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "Hindi", path: "/hindi" }]}
      />
      <div lang="hi" className="bn-hindi-page">
        <section className="bg-hero border-b border-border">
          <div className="container py-16 md:py-20">
            <div className="text-xs tracking-[0.12em] uppercase text-primary font-semibold mb-3">हिंदी पुस्तकालय</div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">ज्ञान की हिंदी यात्रा</h1>
            <p className="text-muted-foreground max-w-xl mb-8 text-lg leading-relaxed">
              हिंदी में उपयोगी विचार, गहन सारांश और एक्शन प्लान — साहित्य, अध्यात्म, व्यवसाय, विज्ञान और दर्शन से।
            </p>
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="शीर्षक या लेखक खोजें…"
                className="pl-11 h-12 rounded-full bg-background/80 backdrop-blur"
              />
            </div>
          </div>
        </section>

        <section className="container py-6 md:py-9">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-[210px] h-10 rounded-full bg-background text-sm" aria-label="पुस्तक श्रेणी चुनें">
                <SelectValue placeholder="सभी श्रेणियाँ" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="सभी">सभी श्रेणियाँ</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="text-xs md:text-sm text-muted-foreground sm:ml-auto" aria-live="polite">
              {loading ? "हिंदी पुस्तकें लोड हो रही हैं…" : loadError ? "पुस्तकालय अस्थायी रूप से उपलब्ध नहीं है" : `${totalCount} ${totalCount === 1 ? "पुस्तक" : "पुस्तकें"}`}
            </div>
          </div>

          {!query.trim() && category === "सभी" && (
            <div className="rounded-2xl border border-border bg-card/60 p-4 md:p-5 mb-8">
              <h2 className="font-serif text-lg md:text-xl font-semibold mb-3">लोकप्रिय हिंदी पुस्तक सारांश</h2>
              <div className="flex flex-wrap gap-2">
                {FEATURED_HINDI_BOOKS.map((book) => (
                  <Link key={book.slug} to={`/books/${book.slug}`} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs md:text-sm hover:border-primary/50 hover:text-primary transition-colors">
                    {book.title}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-20 text-muted-foreground">हिंदी पुस्तकें लोड हो रही हैं…</div>
          ) : loadError ? (
            <div className="text-center py-20">
              <p className="font-medium">हिंदी पुस्तकें अभी लोड नहीं हो सकीं।</p>
              <p className="text-sm text-muted-foreground mt-1">कृपया दोबारा कोशिश करें।</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>फिर कोशिश करें</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-7">
                {books.map((b, i) => <BookCard key={b.id} book={b} priority={i < 4} />)}
              </div>

              {totalCount === 0 && <div className="text-center py-20 text-muted-foreground">कोई पुस्तक नहीं मिली।</div>}

              {books.length < totalCount && (
                <div className="text-center mt-8">
                  <Button variant="outline" className="rounded-full" onClick={() => setVisibleCount((n) => Math.min(n + 48, 100))} disabled={visibleCount >= 100}>
                    {visibleCount >= 100 ? "और परिणाम खोजने के लिए खोज या श्रेणी का उपयोग करें" : "और पुस्तकें दिखाएँ"}
                  </Button>
                </div>
              )}
            </>
          )}

          <div className="mt-12 rounded-2xl border border-border bg-card p-6 text-center">
            <h2 className="font-serif text-xl md:text-2xl font-bold mb-2">Best Hindi Book Summaries</h2>
            <p className="text-sm text-muted-foreground mb-4">शुरुआत के लिए चुनी हुई हिंदी किताबों की क्यूरेटेड सूची, FAQs और 7-दिन एक्शन प्लान के साथ।</p>
            <Button asChild className="rounded-full bg-gold text-primary-foreground hover:opacity-90">
              <Link to="/best-hindi-book-summaries">पढ़ें: Best Hindi Book Summaries →</Link>
            </Button>
          </div>

          <div className="mt-10 text-center">
            <p className="text-muted-foreground mb-4">अंग्रेज़ी पुस्तकें भी देखें</p>
            <Button asChild variant="outline" className="rounded-full"><Link to="/browse">English Library →</Link></Button>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Hindi;
