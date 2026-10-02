import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Sparkles, Brain, Check } from "lucide-react";
import { Layout } from "@/components/Layout";
import { BookCard, BookCardData } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";

const FEATURED_SLUGS = [
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
];

const CATEGORIES = ["Self-Help", "Philosophy", "Business", "Psychology", "Spirituality", "History"];
const PAGE_URL = "https://booknomics.com/english";

const FAQS = [
  {
    q: "Are English book summaries a replacement for the full book?",
    a: "No. A summary helps you decide and act quickly; the full book gives depth and nuance. Use the summary to test whether a book answers a question you actually have, then buy the original when it does.",
  },
  {
    q: "How long does one Booknomics English summary take to read?",
    a: "Most summaries take 12–15 minutes. That includes the introduction, key insights, deep analysis, daily practice section, and a 7-day action plan.",
  },
  {
    q: "Which English book should I start with?",
    a: "Start with Atomic Habits if you want behaviour change, Deep Work for focus, Thinking, Fast and Slow for better decisions, and Rich Dad Poor Dad or Zero to One for money and business thinking.",
  },
  {
    q: "Do you also publish Hindi summaries?",
    a: "Yes. Booknomics is bilingual — the Hindi library covers spiritual classics, Hindi literature, and self-growth titles alongside the English collection.",
  },
];

const English = () => {
  const [books, setBooks] = useState<BookCardData[]>([]);

  useEffect(() => {
    const fields = "id,slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time";
    Promise.all([
      supabase
        .from("books")
        .select(fields)
        .eq("language", "en")
        .eq("is_draft", false)
        .in("status", ["published", "published_noindex"])
        .in("slug", FEATURED_SLUGS),
      supabase
        .from("books")
        .select(fields)
        .eq("language", "en")
        .eq("is_draft", false)
        .in("status", ["published", "published_noindex"])
        .order("title")
        .limit(24),
    ]).then(([featuredResult, fallbackResult]) => {
      const all = [...(featuredResult.data ?? []), ...(fallbackResult.data ?? [])] as BookCardData[];
      const bySlug = new Map(all.map((b) => [b.slug, b]));
      const featured = FEATURED_SLUGS.map((slug) => bySlug.get(slug)).filter(Boolean) as BookCardData[];
      const rest = all.filter((b) => !FEATURED_SLUGS.includes(b.slug));
      const deduped = [...featured, ...rest].filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i);
      setBooks(deduped.slice(0, 12));
    });
  }, []);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://booknomics.com/" },
      { "@type": "ListItem", position: 2, name: "English Book Summaries", item: PAGE_URL },
    ],
  };
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "English Book Summaries",
    url: PAGE_URL,
    inLanguage: "en",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: books.slice(0, 20).map((b, i) => ({
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
        title="English Book Summaries — Key Insights & Action Plans | Booknomics"
        description="Read the best English book summaries on Booknomics — practical insights, 7-day action trackers and reflection prompts across self-help, business, psychology, and philosophy."
        canonical={PAGE_URL}
        lang="en"
        jsonLd={[collectionLd, breadcrumbLd]}
      />

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="container pt-6 text-xs md:text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link to="/" className="hover:text-primary">Home</Link></li>
          <li aria-hidden>›</li>
          <li className="text-foreground">English Book Summaries</li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="bg-hero border-b border-border">
        <div className="container py-12 md:py-20 max-w-4xl">
          <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">
            For English readers
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
            English Book Summaries
          </h1>
          <p className="text-base md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
            Practical summaries of the most important English books — with key insights, deep analysis,
            a 7-day action plan and reflection prompts so ideas actually translate into change.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gold text-primary-foreground hover:opacity-90 rounded-full gap-2 px-7">
              <Link to="/auth">Start Free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <Link to="/browse?lang=en">Browse all English books</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Intro copy */}
      <section className="container py-12 md:py-16 max-w-3xl">
        <div className="prose prose-lg max-w-none text-foreground/90 font-serif leading-relaxed space-y-4">
          <p>
            Most readers don't suffer from a shortage of good books — they suffer from a shortage of
            time. Between work, family, and the noise of daily life, finishing five books a month is
            unrealistic for almost everyone. Booknomics English summaries solve that problem without
            cheating you of depth: every summary is built to give you the core ideas, the reasoning
            behind them, and the practical steps to apply them — in about the time it takes to drink
            a cup of coffee.
          </p>
          <p>
            We don't treat summaries as bullet-point shortcuts. For every English book in the library,
            we work across four layers — a clear introduction that sets context, the key ideas that
            anchor the author's argument, a deep analysis that explains why those ideas matter today,
            and a daily-practice section that turns thinking into doing. A 7-day action tracker and
            reflection prompts come built in so the book actually leaves a mark on how you live.
          </p>
          <p>
            The English library is intentionally diverse. On one shelf you'll find modern productivity
            classics like <em>Atomic Habits</em> and <em>Deep Work</em>, alongside foundational
            psychology like <em>Thinking, Fast and Slow</em>. On another you'll find timeless
            self-leadership in <em>The 7 Habits of Highly Effective People</em>, history reframed in
            <em> Sapiens</em>, and philosophy of meaning in <em>Man's Search for Meaning</em>. Whether
            you want to build a business, think clearer, or simply live with more intention, there's
            a starting point here.
          </p>
          <p>
            Each summary is written by people who have actually read and used these books — not
            generated as filler. Our goal is simple: change the way you think, and make that change
            stick through small, repeatable daily actions. Pick any book below to begin, and after a
            week of practice you'll feel the difference yourself.
          </p>
        </div>
      </section>

      {/* Featured English books */}
      <section className="container py-6 md:py-10" aria-labelledby="featured-english-books">
        <div className="flex items-end justify-between mb-6 md:mb-8">
          <div>
            <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2">Featured</div>
            <h2 id="featured-english-books" className="font-serif text-3xl md:text-4xl font-bold tracking-tight">
              Top English books to start with
            </h2>
          </div>
          <Link to="/browse?lang=en" className="text-xs md:text-sm font-medium text-foreground/70 hover:text-primary inline-flex items-center gap-1.5">
            See all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
          {books.slice(0, 12).map((b) => <BookCard key={b.id} book={b} />)}
        </div>
      </section>

      {/* Category shortcuts */}
      <section className="container py-10 md:py-14">
        <h2 className="font-serif text-2xl md:text-3xl font-bold mb-5 md:mb-7">Browse by category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              to={`/browse?category=${encodeURIComponent(cat)}&lang=en`}
              className="bg-card border border-border rounded-xl p-3 md:p-5 hover:border-primary hover:shadow-paper transition-all text-center font-serif text-sm md:text-lg"
            >
              {cat}
            </Link>
          ))}
        </div>
      </section>

      {/* Long-form guide */}
      <section className="container py-12 md:py-16 max-w-3xl" aria-labelledby="english-guide">
        <h2 id="english-guide" className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-6">
          A reader's guide to English book summaries
        </h2>
        <div className="prose prose-lg max-w-none text-foreground/90 font-serif leading-relaxed space-y-8">
          <div>
            <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">Why English book summaries help busy readers</h3>
            <p>
              A good non-fiction book usually contains three or four genuinely load-bearing ideas
              surrounded by evidence and storytelling. A well-made summary preserves those ideas and the
              reasoning behind them, then hands you a way to test them this week. For a reader with a job
              and a family, that is the difference between owning a book and using one.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">Best English summaries for productivity</h3>
            <p>
              Begin with <Link to="/books/atomic-habits" className="text-primary hover:underline">Atomic Habits</Link>{" "}
              for the mechanics of small, repeatable change, then{" "}
              <Link to="/books/deep-work" className="text-primary hover:underline">Deep Work</Link> for protecting
              the long, uninterrupted blocks that real output requires. More in{" "}
              <Link to="/category/productivity" className="text-primary hover:underline">Productivity</Link>.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">Best English summaries for business</h3>
            <p>
              <Link to="/books/zero-to-one" className="text-primary hover:underline">Zero to One</Link> reframes how
              to build something genuinely new, while{" "}
              <Link to="/books/rich-dad-poor-dad" className="text-primary hover:underline">Rich Dad Poor Dad</Link>{" "}
              changes how you think about assets and income. Browse the full{" "}
              <Link to="/category/business" className="text-primary hover:underline">Business</Link> shelf.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">Best English summaries for psychology</h3>
            <p>
              <Link to="/books/thinking-fast-and-slow" className="text-primary hover:underline">
                Thinking, Fast and Slow
              </Link>{" "}
              is the foundation for understanding your own judgment errors, and{" "}
              <Link to="/books/sapiens" className="text-primary hover:underline">Sapiens</Link> explains the shared
              stories that shape group behaviour. See more in{" "}
              <Link to="/category/psychology" className="text-primary hover:underline">Psychology</Link>.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">Best English summaries for personal growth</h3>
            <p>
              <Link to="/books/the-7-habits" className="text-primary hover:underline">
                The 7 Habits of Highly Effective People
              </Link>{" "}
              builds character before tactics, and{" "}
              <Link to="/books/the-power-of-now" className="text-primary hover:underline">The Power of Now</Link>{" "}
              addresses the anxious mind that undermines every plan. Explore{" "}
              <Link to="/category/self-help" className="text-primary hover:underline">Self-Help</Link> for the wider
              collection.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-xl md:text-2xl font-bold mb-2">How to apply a book summary in 7 days</h3>
            <p>
              Read the summary once, pick exactly one idea, and practise it daily for a week — then write
              down what changed. Our free{" "}
              <Link to="/resources/7-day-reading-action-tracker" className="text-primary hover:underline">
                7-Day Reading Action Tracker
              </Link>{" "}
              and{" "}
              <Link to="/resources/book-summary-template" className="text-primary hover:underline">
                Book Summary Template
              </Link>{" "}
              make that loop repeatable; everything else lives on the{" "}
              <Link to="/resources" className="text-primary hover:underline">Resources</Link> page.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container pb-4 md:pb-8 max-w-3xl" aria-labelledby="faq-heading">
        <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">FAQ</div>
        <h2 id="faq-heading" className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-8">
          English book summaries — FAQs
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left font-serif text-base md:text-lg">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Why read here */}
      <section className="container py-12 md:py-16 max-w-4xl">
        <h2 className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-8">
          Why read English summaries here?
        </h2>
        <div className="grid md:grid-cols-2 gap-5">
          {[
            { icon: Sparkles, title: "Fast comprehension", desc: "Core ideas in 12–15 minutes, with zero filler." },
            { icon: BookOpen, title: "Built to apply", desc: "Every book comes with a 7-day action plan and reflection prompts." },
            { icon: Brain, title: "Depth, not shortcuts", desc: "Real analysis of why an idea works — not just what it says." },
            { icon: Check, title: "Curated quality", desc: "Hand-picked books, written and edited by humans who use them." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="border border-border rounded-2xl p-5 bg-card">
              <Icon className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-serif text-lg font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="container py-12 md:py-20">
        <div className="bg-gold rounded-3xl p-10 md:p-16 text-center shadow-cover">
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-primary-foreground mb-3">
            Build your thinking library
          </h2>
          <p className="text-primary-foreground/80 max-w-xl mx-auto mb-7 text-sm md:text-base">
            Create a free account and save your favourite English book summaries to your library.
          </p>
          <Button asChild size="lg" variant="secondary" className="rounded-full px-8">
            <Link to="/auth">Get started — it's free</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
};

export default English;
