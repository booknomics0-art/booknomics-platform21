import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { BookCard, BookCardData } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { GlobalSearch } from "@/components/GlobalSearch";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-book.jpg";
import { SocialConnect } from "@/components/SocialConnect";
import { AdBanner } from "@/components/AdBanner";

const Index = () => {
  const [featured, setFeatured] = useState<BookCardData[]>([]);
  const [popular, setPopular] = useState<BookCardData[]>([]);
  // Clean canonical category URLs — never /browse?category=…
  const categories = [
    { label: "Self-Help", path: "/category/self-help" },
    { label: "Philosophy", path: "/category/philosophy" },
    { label: "Business", path: "/category/business" },
    { label: "Psychology", path: "/category/psychology" },
    { label: "Spirituality", path: "/category/spirituality" },
    { label: "History", path: "/category/history" },
  ];
  const outcomes = [
    { label: "Build better habits", desc: "Turn good intentions into a repeatable system.", path: "/category/self-help" },
    { label: "Think more clearly", desc: "Understand behaviour, decisions and your own mind.", path: "/category/psychology" },
    { label: "Grow work & business", desc: "Learn strategy, leadership and execution.", path: "/category/business" },
    { label: "Find meaning", desc: "Explore philosophy without needing hours to spare.", path: "/category/philosophy" },
    { label: "Create inner calm", desc: "Use timeless ideas for reflection and perspective.", path: "/category/spirituality" },
    { label: "Learn from history", desc: "See patterns, people and ideas that shaped the world.", path: "/category/history" },
  ];
  // Trending books link straight to their canonical book pages.
  const trending = [
    { label: "Atomic Habits", path: "/books/atomic-habits" },
    { label: "Bhagavad Gita", path: "/books/bhagavad-gita-hi" },
    { label: "Chanakya Niti", path: "/books/chanakya-niti" },
    { label: "Wings of Fire", path: "/books/wings-of-fire" },
  ];

  useEffect(() => {
    (async () => {
      const { data: feat } = await supabase
        .from("books")
        .select("id,slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time")
        .eq("is_draft", false)
        .eq("status", "published")
        .limit(6);
      const { data: pop } = await supabase
        .from("books")
        .select("id,slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time")
        .eq("is_draft", false)
        .eq("status", "published")
        .range(6, 11);
      setFeatured(feat ?? []);
      setPopular(pop ?? []);
    })();
  }, []);

  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Booknomics",
    url: "https://booknomics.com",
  };
  const siteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Booknomics",
    url: "https://booknomics.com",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://booknomics.com/browse?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <Layout>
      <SEO
        title="Booknomics — Book Summaries in English & Hindi | Read Smarter, Apply Faster"
        description="Get practical book summaries, key insights, 7-day action trackers and reflection prompts in English & Hindi. Free to start."
        canonical="https://booknomics.com/"
        alternates={{ en: "/", hi: "/hindi", xDefault: "/" }}
        jsonLd={[orgLd, siteLd]}
      />
      {/* Hero */}
      <section className="bg-hero relative overflow-hidden">
        <div className="container py-10 md:py-28 grid md:grid-cols-2 gap-6 md:gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-[10px] md:text-xs tracking-[0.2em] uppercase font-medium px-3 py-1.5 rounded-full bg-background/60 backdrop-blur border border-border">
              <Sparkles className="h-3 w-3 text-primary" /> Life-improvement system
            </span>
            <h1 className="font-serif text-[28px] sm:text-4xl md:text-7xl font-bold leading-[1.1] sm:leading-[1.05] tracking-tight mt-4 md:mt-6">
              Read <span className="italic text-gold">→</span> Apply
              <br />
              <span className="italic text-gold">→</span> Transform.
            </h1>
            <p className="mt-4 md:mt-6 text-sm sm:text-base md:text-lg text-muted-foreground max-w-lg leading-relaxed">
              Don't read more just to collect ideas. Pick what you want to improve, learn the useful parts in minutes,
              then apply one idea with a 7-day action plan — in English or Hindi.
            </p>
            <div className="mt-6 md:mt-8 max-w-xl">
              <GlobalSearch placeholder="Search books, authors or topics…" size="lg" />
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                <span className="opacity-70">Trending:</span>
                {trending.map((t, i) => (
                  <span key={t.path} className="inline-flex items-center gap-1.5">
                    {i > 0 && <span>·</span>}
                    <Link to={t.path} className="hover:text-primary underline-offset-2 hover:underline">{t.label}</Link>
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-6 md:mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-gold text-primary-foreground hover:opacity-90 gap-2 rounded-full px-7"
              >
                <Link to="/auth">
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-7">
                <Link to="/browse">Explore books</Link>
              </Button>
            </div>
            <div className="mt-6 md:mt-8 flex flex-wrap items-center gap-4 md:gap-6 text-xs md:text-sm text-muted-foreground">
              <span>🎧 Read or listen</span>
              <span>✅ Action plans, not just summaries</span>
              <span>🇮🇳 English + Hindi</span>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-3xl overflow-hidden shadow-cover">
              <img
                src={heroImage}
                alt="An open book with golden ideas rising from its pages"
                width={1024}
                height={1024}
                fetchPriority="high"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-4 -left-4 bg-card border border-border rounded-2xl p-4 shadow-cover max-w-[240px] hidden md:block">
              <div className="text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-1">Today's idea</div>
              <p className="text-sm font-serif italic">"Small habits, repeated daily, become identity."</p>
            </div>
          </div>
        </div>
      </section>

      {/* Outcome-first discovery */}
      <section className="container py-10 md:py-16" aria-labelledby="outcome-heading">
        <div className="max-w-2xl mb-6 md:mb-8">
          <div className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2">Start with your goal</div>
          <h2 id="outcome-heading" className="font-serif text-3xl md:text-5xl font-bold tracking-tight">
            What do you want to improve?
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-3">
            Choose an outcome first. Booknomics will take you to ideas you can use, instead of asking you to browse thousands of titles.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {outcomes.map((item) => (
            <Link key={item.path} to={item.path} className="rounded-2xl border border-border bg-card p-5 hover:border-primary hover:shadow-paper transition-all">
              <h3 className="font-serif text-lg font-semibold mb-1">{item.label}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Explore <ArrowRight className="h-3 w-3" /></span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="container py-10 md:py-20">
        <div className="flex items-end justify-between mb-6 md:mb-10">
          <div>
            <div className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2 md:mb-3">
              Featured
            </div>
            <h2 className="font-serif text-3xl md:text-5xl font-bold tracking-tight">This week's reading</h2>
          </div>
          <Link
            to="/browse"
            className="text-xs md:text-sm font-medium text-foreground/70 hover:text-primary inline-flex items-center gap-1.5"
          >
            See all <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
          {featured.map((b, i) => (
            <BookCard key={b.id} book={b} priority={i < 2} />
          ))}
        </div>
      </section>

      {/* Ad — below featured books */}
      <div className="container py-4">
        <AdBanner slot="auto" format="horizontal" className="w-full max-w-4xl mx-auto" />
      </div>

      {/* Categories */}
      <section className="container py-6 md:py-12">
        <h2 className="font-serif text-2xl md:text-3xl font-bold mb-4 md:mb-8">Browse by category</h2>
        <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.path}
              to={cat.path}
              className="bg-card border border-border rounded-xl p-3 md:p-5 hover:border-primary hover:shadow-paper transition-all text-center font-serif text-sm md:text-lg"
            >
              {cat.label}
            </Link>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          {[
            { path: "/english", label: "📘 English book summaries" },
            { path: "/best-hindi-book-summaries", label: "🇮🇳 Best Hindi book summaries" },
            { path: "/hindi", label: "हिंदी लाइब्रेरी" },
            { path: "/category/productivity", label: "⚡ Productivity" },
            { path: "/category/finance", label: "💰 Finance" },
            { path: "/category/classic-literature", label: "📚 Classic literature" },
            { path: "/category/hindi-literature", label: "✒️ हिंदी साहित्य" },
          ].map((l) => (
            <Link
              key={l.path}
              to={l.path}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 hover:border-primary hover:text-primary transition"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Free resources — linkable assets */}
      <section className="container py-8 md:py-14" aria-labelledby="free-resources">
        <div className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2 md:mb-3">
          Free resources
        </div>
        <h2 id="free-resources" className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-4 md:mb-6">
          Tools you can use today
        </h2>
        <div className="grid md:grid-cols-3 gap-3 md:gap-4">
          {[
            {
              path: "/resources/7-day-reading-action-tracker",
              title: "7-Day Reading Action Tracker",
              desc: "Turn any book into seven days of small, specific actions.",
            },
            {
              path: "/resources/book-summary-template",
              title: "Book Summary Template",
              desc: "A reusable structure for summarising any book properly.",
            },
            {
              path: "/resources",
              title: "All free resources",
              desc: "Guides, templates and trackers for serious readers.",
            },
          ].map((r) => (
            <Link
              key={r.path}
              to={r.path}
              className="rounded-2xl border border-border bg-card p-5 hover:border-primary hover:shadow-paper transition-all"
            >
              <h3 className="font-serif text-lg font-semibold mb-1">{r.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{r.desc}</p>
            </Link>
          ))}
        </div>
      </section>


      {/* Popular */}
      <section className="container py-10 md:py-20">
        <div className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2 md:mb-3">
          Continue exploring
        </div>
        <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-6 md:mb-10">More to discover</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
          {popular.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      </section>

      {/* Ad — below popular books */}
      <div className="container py-4">
        <AdBanner slot="auto" format="horizontal" className="w-full max-w-4xl mx-auto" />
      </div>

      {/* What is Booknomics — AI/LLM-friendly explainer */}
      <section className="container py-10 md:py-16" aria-labelledby="what-is-booknomics">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">About</div>
          <h2 id="what-is-booknomics" className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-4">
            What is Booknomics?
          </h2>
          <p className="text-muted-foreground leading-relaxed text-base md:text-lg">
            Booknomics is a learning platform that turns books into practical summaries, key insights, reflection
            questions, and action systems. Readers can discover ideas faster and apply them in daily life — across
            productivity, psychology, philosophy, business, and self-growth.
          </p>
        </div>
      </section>

      {/* Connect on socials */}
      <SocialConnect />

      {/* CTA */}
      <section className="container py-10 md:py-20">
        <div className="bg-gold rounded-3xl p-8 md:p-20 text-center shadow-cover">
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-primary-foreground mb-3 md:mb-4">
            Build a thinking library
          </h2>
          <p className="text-primary-foreground/80 max-w-xl mx-auto mb-6 md:mb-8 text-sm md:text-base">
            Save the ideas that move you. Return to them when you need them most.
          </p>
          <Button asChild size="lg" variant="secondary" className="rounded-full px-8">
            <Link to="/auth">Get started — it's free</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
