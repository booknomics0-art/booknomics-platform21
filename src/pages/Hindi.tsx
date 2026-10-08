import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Layout } from "@/components/Layout";
import { BookCard, BookCardData } from "@/components/BookCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
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

const Hindi = () => {
  const [params, setParams] = useSearchParams();
  const [books, setBooks] = useState<BookCardData[]>([]);
  const [categories, setCategories] = useState<string[]>(["सभी"]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(48);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const category = params.get("category") ?? "सभी";

  useEffect(() => {
    if (!document.getElementById("noto-hindi-font")) {
      const link = document.createElement("link");
      link.id = "noto-hindi-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Tiro+Devanagari+Hindi&display=swap";
      document.head.appendChild(link);
    }

    let cancelled = false;
    (async () => {
      const values = new Set<string>();
      const batchSize = 500;
      for (let from = 0; ; from += batchSize) {
        const { data, error } = await supabase
          .from("books")
          .select("category")
          .eq("language", "hi")
          .eq("is_draft", false)
          .eq("status", "published")
          .order("category")
          .range(from, from + batchSize - 1);
        if (error || cancelled) return;
        const batch = data ?? [];
        batch.forEach((row: any) => { if (row.category) values.add(row.category); });
        if (batch.length < batchSize) break;
      }
      if (!cancelled) setCategories(["सभी", ...Array.from(values).sort()]);
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
      let request = supabase
        .from("books")
        .select("id,slug,seo_slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time", { count: "exact" })
        .eq("language", "hi")
        .eq("is_draft", false)
        .eq("status", "published");

      if (category !== "सभी") request = request.eq("category", category);

      const q = debouncedQuery.trim().replace(/[,%()]/g, " ").slice(0, 80);
      if (q) request = request.or(`title.ilike.%${q}%,author.ilike.%${q}%`);

      const { data, error, count } = await request
        .order("title")
        .range(0, visibleCount - 1);

      if (cancelled) return;
      if (error) {
        setBooks([]);
        setTotalCount(0);
        setLoadError(error.message);
      } else {
        setBooks((data ?? []).map((row: any) => ({ ...row, slug: row.seo_slug || row.slug })));
        setTotalCount(count ?? 0);
        if (q && visibleCount === 48) trackSearch(q, count ?? 0, "hindi_library");
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [category, debouncedQuery, visibleCount]);

  const setCategory = (c: string) => {
    const next = new URLSearchParams(params);
    if (c === "सभी") next.delete("category"); else next.set("category", c);
    next.delete("page");
    setParams(next);
  };

  // Keep meaningful crawl targets in the initial HTML/JSON-LD while the
  // client-side Supabase request is still resolving. Featured fallback books
  // are kept in sync with the current published/indexable Hindi set.
  const collectionItems = books.length > 0 ? books : FEATURED_HINDI_BOOKS;
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Hindi Book Summaries",
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
        title="हिंदी पुस्तक सारांश — Best Hindi Book Summaries | Booknomics"
        description="हिंदी में चुनी हुई किताबों के विस्तृत सारांश, मुख्य विचार, गहन विश्लेषण और व्यावहारिक सीख Booknomics पर पढ़ें।"
        canonical="https://www.booknomics.com/hindi"
        lang="hi"
        jsonLd={collectionLd}
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "Hindi", path: "/hindi" }]}
      />
      <div style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif" }}>
        <section className="bg-hero border-b border-border">
          <div className="container py-16">
            <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">हिंदी पुस्तकालय 🇮🇳</div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6" style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}>
              ज्ञान की हिंदी यात्रा
            </h1>
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

        <section className="container py-10">
          <div className="flex flex-wrap gap-2 mb-10">
            {categories.map(c => (
              <Button
                key={c}
                variant={category === c ? "default" : "outline"}
                onClick={() => setCategory(c)}
                className={`rounded-full ${category === c ? "bg-gold text-primary-foreground" : ""}`}
                size="sm"
              >
                {c}
              </Button>
            ))}
          </div>

          <div className="text-sm text-muted-foreground mb-6" aria-live="polite">
            {loading
              ? "हिंदी पुस्तकें लोड हो रही हैं…"
              : loadError
                ? "पुस्तकालय अस्थायी रूप से उपलब्ध नहीं है"
                : `${totalCount} ${totalCount === 1 ? "पुस्तक" : "पुस्तकें"}`}
          </div>

          {!query.trim() && category === "सभी" && (
            <div className="rounded-xl border border-border bg-card/60 p-4 md:p-5 mb-8">
              <h2 className="font-serif text-lg md:text-xl font-semibold mb-3">लोकप्रिय हिंदी पुस्तक सारांश</h2>
              <div className="flex flex-wrap gap-2">
                {FEATURED_HINDI_BOOKS.map((book) => (
                  <Link
                    key={book.slug}
                    to={`/books/${book.slug}`}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs md:text-sm hover:border-primary/50 hover:text-primary transition-colors"
                  >
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {books.map((b, i) => <BookCard key={b.id} book={b} priority={i < 4} />)}
              </div>

              {totalCount === 0 && (
                <div className="text-center py-20 text-muted-foreground">कोई पुस्तक नहीं मिली।</div>
              )}

              {books.length < totalCount && (
                <div className="text-center mt-8">
                  <Button variant="outline" className="rounded-full" onClick={() => setVisibleCount((n) => n + 48)}>
                    और पुस्तकें दिखाएँ
                  </Button>
                </div>
              )}
            </>
          )}

          <div className="mt-12 rounded-2xl border border-border bg-card p-6 text-center">
            <h2 className="font-serif text-xl md:text-2xl font-bold mb-2">Best Hindi Book Summaries</h2>
            <p className="text-sm text-muted-foreground mb-4">
              शुरुआत के लिए चुनी हुई हिंदी किताबों की क्यूरेटेड सूची, FAQs और 7-दिन एक्शन प्लान के साथ।
            </p>
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
