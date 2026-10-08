import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Languages, Search, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { BookCard, type BookCardData } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { GlobalSearch } from "@/components/GlobalSearch";
import { supabase } from "@/integrations/supabase/client";
import { SocialConnect } from "@/components/SocialConnect";
import { HomepageHero } from "@/components/HomepageHero";
import { ScrollTypographyStory } from "@/components/ScrollTypographyStory";

const HERO_SLUGS = [
  "atomic-habits-james-clear-summary",
  "deep-work-cal-newport-summary",
  "the-psychology-of-money-morgan-housel-summary",
  "thinking-fast-and-slow-daniel-kahneman-summary",
  "godan-munshi-premchand-saransh",
  "nirmala-munshi-premchand-saransh",
  "gaban-munshi-premchand-saransh",
] as const;

const Index = () => {
  const [heroBooks, setHeroBooks] = useState<BookCardData[]>([]);
  const [featured, setFeatured] = useState<BookCardData[]>([]);
  const [popular, setPopular] = useState<BookCardData[]>([]);

  const categories = [
    { label: "Self-Help", path: "/category/self-help", desc: "Habits, focus and personal systems" },
    { label: "Psychology", path: "/category/psychology", desc: "Behaviour, decisions and the mind" },
    { label: "Business", path: "/category/business", desc: "Strategy, leadership and execution" },
    { label: "Philosophy", path: "/category/philosophy", desc: "Timeless ideas for clearer thinking" },
    { label: "Finance", path: "/category/finance", desc: "Money, investing and better decisions" },
    { label: "Literature", path: "/category/classic-literature", desc: "Stories that stay with you" },
  ];

  const outcomes = [
    { label: "Build better habits", desc: "Turn good intentions into a repeatable system.", path: "/category/self-help", number: "01" },
    { label: "Think more clearly", desc: "Understand behaviour, decisions and your own mind.", path: "/category/psychology", number: "02" },
    { label: "Grow work & business", desc: "Learn strategy, leadership and execution.", path: "/category/business", number: "03" },
    { label: "Find perspective", desc: "Use philosophy and history to see the bigger picture.", path: "/category/philosophy", number: "04" },
    { label: "Make better money decisions", desc: "Learn finance without drowning in jargon.", path: "/category/finance", number: "05" },
    { label: "Read great literature", desc: "Explore enduring stories in English and Hindi.", path: "/category/classic-literature", number: "06" },
  ];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fields = "id,slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time";

      const [{ data: hero }, { data: feat }, { data: pop }] = await Promise.all([
        supabase
          .from("books")
          .select(fields)
          .eq("is_draft", false)
          .eq("status", "published")
          .in("slug", [...HERO_SLUGS]),
        supabase
          .from("books")
          .select(fields)
          .eq("is_draft", false)
          .eq("status", "published")
          .not("cover_url", "is", null)
          .order("rating", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("books")
          .select(fields)
          .eq("is_draft", false)
          .eq("status", "published")
          .not("cover_url", "is", null)
          .order("created_at", { ascending: false })
          .range(6, 13),
      ]);

      if (cancelled) return;
      const heroRows = (hero ?? []) as BookCardData[];
      const order = new Map(HERO_SLUGS.map((slug, index) => [slug, index]));
      heroRows.sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99));
      setHeroBooks(heroRows);
      setFeatured((feat ?? []) as BookCardData[]);
      setPopular((pop ?? []) as BookCardData[]);
    })();
    return () => { cancelled = true; };
  }, []);

  const visualBooks = heroBooks.length >= 4 ? heroBooks : featured;

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
        description="Get practical book summaries, key insights, action systems and reflection prompts in English & Hindi. Discover ideas worth applying."
        canonical="https://booknomics.com/"
        jsonLd={[orgLd, siteLd]}
      />

      <HomepageHero books={visualBooks} />

      <section className="container bn-search-section" aria-labelledby="home-search-title">
        <div className="bn-search-copy">
          <span className="bn-section-label"><Search className="h-3.5 w-3.5" /> Find your next idea</span>
          <h2 id="home-search-title">Search by book, author or topic.</h2>
          <p>Go directly to what you need, or keep scrolling and discover something unexpected.</p>
        </div>
        <div className="bn-search-box">
          <GlobalSearch placeholder="Try Atomic Habits, Premchand, money, focus…" size="lg" />
        </div>
      </section>

      <ScrollTypographyStory books={visualBooks} />

      <section className="container bn-section" aria-labelledby="outcome-heading">
        <div className="bn-section-heading">
          <span className="bn-section-label"><Sparkles className="h-3.5 w-3.5" /> Start with your goal</span>
          <h2 id="outcome-heading">What do you want to change?</h2>
          <p>Choose an outcome first. We will take you to ideas you can actually use.</p>
        </div>
        <div className="bn-outcome-grid">
          {outcomes.map((item) => (
            <Link key={item.path} to={item.path} className="bn-outcome-card">
              <span className="bn-card-number">{item.number}</span>
              <div>
                <h3>{item.label}</h3>
                <p>{item.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 bn-card-arrow" />
            </Link>
          ))}
        </div>
      </section>

      <section className="container bn-section" aria-labelledby="featured-heading">
        <div className="bn-section-heading bn-section-heading-row">
          <div>
            <span className="bn-section-label">Curated this week</span>
            <h2 id="featured-heading">Worth your attention.</h2>
          </div>
          <Link to="/browse" className="bn-text-link">See the full library <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-7">
          {featured.map((book, index) => <BookCard key={book.id} book={book} priority={index < 2} />)}
        </div>
      </section>

      <section className="bn-language-band" aria-labelledby="language-title">
        <div className="container">
          <div className="bn-language-heading">
            <span className="bn-section-label"><Languages className="h-3.5 w-3.5" /> Two languages. One library.</span>
            <h2 id="language-title">Great ideas should not stop at language.</h2>
          </div>
          <div className="bn-language-grid">
            <Link to="/english" className="bn-language-card bn-language-card-en">
              <span>English</span>
              <h3>Read the world's best ideas with practical depth.</h3>
              <p>Summaries, key ideas, reflection and action — designed for clarity.</p>
              <strong>Explore English <ArrowRight className="h-4 w-4" /></strong>
            </Link>
            <Link to="/hindi" className="bn-language-card bn-language-card-hi" lang="hi">
              <span>हिंदी</span>
              <h3>बेहतरीन किताबें, साफ़ भाषा में, काम की सीख के साथ।</h3>
              <p>सारांश से आगे — मुख्य विचार, समझ, चिंतन और लागू करने योग्य कदम।</p>
              <strong>हिंदी लाइब्रेरी देखें <ArrowRight className="h-4 w-4" /></strong>
            </Link>
          </div>
        </div>
      </section>

      <section className="container bn-section" aria-labelledby="categories-heading">
        <div className="bn-section-heading">
          <span className="bn-section-label">Browse by subject</span>
          <h2 id="categories-heading">Follow your curiosity.</h2>
        </div>
        <div className="bn-category-grid">
          {categories.map((category, index) => (
            <Link key={category.path} to={category.path} className="bn-category-card">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{category.label}</h3>
              <p>{category.desc}</p>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      </section>

      <section className="container bn-section" aria-labelledby="resources-heading">
        <div className="bn-section-heading">
          <span className="bn-section-label">Free resources</span>
          <h2 id="resources-heading">Tools for better reading.</h2>
          <p>Simple frameworks that help you remember, reflect and act on what you learn.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { path: "/resources/7-day-reading-action-tracker", title: "7-Day Reading Action Tracker", desc: "Turn any book into seven days of small, specific actions." },
            { path: "/resources/book-summary-template", title: "Book Summary Template", desc: "A reusable structure for summarising any book properly." },
            { path: "/resources", title: "All free resources", desc: "Guides, templates and trackers for serious readers." },
          ].map((resource) => (
            <Link key={resource.path} to={resource.path} className="bn-resource-card">
              <h3>{resource.title}</h3>
              <p>{resource.desc}</p>
              <span>Open resource <ArrowRight className="h-4 w-4" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container bn-section" aria-labelledby="more-heading">
        <div className="bn-section-heading bn-section-heading-row">
          <div>
            <span className="bn-section-label">Continue exploring</span>
            <h2 id="more-heading">More to discover.</h2>
          </div>
          <Link to="/browse" className="bn-text-link">Browse everything <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-7">
          {popular.map((book) => <BookCard key={book.id} book={book} />)}
        </div>
      </section>

      <section className="container bn-about-panel" aria-labelledby="what-is-booknomics">
        <span className="bn-section-label">Booknomics</span>
        <h2 id="what-is-booknomics">A reading platform built for the part after “I finished the book.”</h2>
        <p>
          Booknomics turns books into practical summaries, key insights, reflection questions and action systems.
          The goal is not to collect more information. It is to understand better, remember longer and apply what matters.
        </p>
        <div className="bn-about-actions">
          <Button asChild className="bn-primary-cta"><Link to="/about">How Booknomics works</Link></Button>
          <Link to="/paths" className="bn-text-link">Explore learning paths <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <SocialConnect />

      <section className="container bn-final-cta">
        <div className="bn-final-cta-inner">
          <span className="bn-section-label">Start with one book</span>
          <h2>One useful idea can change a week.</h2>
          <p>Choose a book. Keep what matters. Put one idea into practice.</p>
          <div className="bn-home-actions bn-final-actions">
            <Button asChild size="lg" className="bn-primary-cta">
              <Link to="/browse">Explore Booknomics <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bn-secondary-cta">
              <Link to="/auth">Create a free account</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
