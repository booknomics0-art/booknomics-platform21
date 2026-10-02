import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Layout } from "@/components/Layout";
import { BookCard, BookCardData } from "@/components/BookCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";

const Hindi = () => {
  const [params, setParams] = useSearchParams();
  const [books, setBooks] = useState<BookCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(48);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const category = params.get("category") ?? "सभी";

  useEffect(() => {
    // Inject Devanagari font
    if (!document.getElementById("noto-hindi-font")) {
      const link = document.createElement("link");
      link.id = "noto-hindi-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Tiro+Devanagari+Hindi&display=swap";
      document.head.appendChild(link);
    }
    setLoading(true);
    setLoadError(null);
    supabase.from("books")
      .select("id,slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time")
      .eq("language", "hi")
      .eq("is_draft", false)
      .order("title")
      .then(({ data, error }) => {
        if (error) {
          setBooks([]);
          setLoadError(error.message);
        } else {
          setBooks(data ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ["सभी", ...Array.from(new Set(books.map(b => b.category))).sort()],
    [books]
  );

  const filtered = books.filter(b => {
    const matchCat = category === "सभी" || b.category === category;
    const q = query.toLowerCase();
    const matchQ = !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  useEffect(() => {
    setVisibleCount(48);
  }, [query, category]);

  const visibleBooks = filtered.slice(0, visibleCount);

  const setCategory = (c: string) => {
    const next = new URLSearchParams(params);
    if (c === "सभी") next.delete("category"); else next.set("category", c);
    setParams(next);
  };

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Hindi Book Summaries",
    url: "https://booknomics.com/hindi",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: filtered.slice(0, 30).map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://booknomics.com/books/${b.slug}`,
        name: b.title,
      })),
    },
  };

  return (
    <Layout>
      <SEO
        title="हिंदी पुस्तक सारांश — Best Hindi Book Summaries | Booknomics"
        description="ओशो, चाणक्य, प्रेमचंद, महादेवी वर्मा और अन्य लेखकों की किताबों के विस्तृत सारांश और मुख्य विचार।"
        canonical="https://booknomics.com/hindi"
        lang="hi"
        alternates={{ en: "/browse", hi: "/hindi", xDefault: "/browse" }}
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
              बीस चुनी हुई कालजयी पुस्तकों के गहन सारांश — साहित्य, अध्यात्म, व्यवसाय, विज्ञान और दर्शन से।
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

          <div className="text-sm text-muted-foreground mb-6">
            {filtered.length} {filtered.length === 1 ? "पुस्तक" : "पुस्तकें"}
          </div>

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
                {visibleBooks.map((b, i) => <BookCard key={b.id} book={b} priority={i < 4} />)}
              </div>

              {filtered.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">कोई पुस्तक नहीं मिली।</div>
              )}

              {visibleCount < filtered.length && (
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
