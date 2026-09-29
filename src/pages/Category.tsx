import { useEffect, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import Browse from "./Browse";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowRight } from "lucide-react";
import { slugifyCategory } from "@/lib/categorySlug";
import { getCategoryContent } from "@/content/categoryContent";

const CATEGORY_INTROS: Record<string, string> = {
  productivity: "Best productivity book summaries — frameworks for focus, deep work, time management, and high-output habits, distilled with action plans you can use today.",
  psychology: "Top psychology book summaries — understand cognitive biases, behavior, motivation, and the science of the mind through practical, applied insights.",
  finance: "Personal finance and investing book summaries — money mindset, wealth-building, smart investing, and financial freedom, broken down step-by-step.",
  "self-help": "Best self-help book summaries — discipline, confidence, purpose, and personal transformation, with reflection questions and habit trackers.",
  philosophy: "Philosophy book summaries — Stoicism, Vedanta, ethics, and meaning, translated into modern, livable principles.",
  fiction: "Fiction summaries and analysis — themes, characters, lessons, and what each story reveals about being human.",
  hindi: "हिंदी पुस्तक सारांश — आत्म-विकास, अर्थशास्त्र, मनोविज्ञान और दर्शन की किताबों का सारांश और कार्ययोजना।",
  business: "Best business and startup book summaries — strategy, leadership, growth, and building companies that last.",
  spirituality: "Spirituality book summaries — meditation, awareness, surrender, and the path to inner clarity.",
};

const SITE = "https://booknomics.com";

const Category = () => {
  const { category } = useParams();
  const [resolved, setResolved] = useState<string | null | undefined>(undefined);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!category) return;
    supabase.from("books").select("category").eq("is_draft", false).then(({ data }) => {
      const all = (data ?? []).map((r: any) => r.category).filter(Boolean);
      const cats = Array.from(new Set(all));
      const match = cats.find((c) => slugifyCategory(String(c)) === category.toLowerCase());
      setResolved(match ?? null);
      if (match) setCount(all.filter((c) => c === match).length);
    });
  }, [category]);

  if (!category) return <Navigate to="/browse" replace />;
  if (resolved === undefined) {
    return <Layout><div className="container py-20 text-center text-muted-foreground">Loading…</div></Layout>;
  }
  if (resolved === null) return <Navigate to="/browse" replace />;

  const slug = category.toLowerCase();
  const content = getCategoryContent(slug);
  const intro =
    content?.lead ??
    CATEGORY_INTROS[slug] ??
    `${resolved} book summaries with key insights, practical actions, and reflection prompts for every title.`;
  const title = content?.title
    ? `${content.title} | Booknomics`
    : `${resolved} Book Summaries — Best Books on ${resolved} | Booknomics`;
  const rawDesc = content?.description ?? intro;
  const description = rawDesc.length > 160 ? rawDesc.slice(0, 157) + "…" : rawDesc;
  const canonical = `${SITE}/category/${slug}`;
  const isHindi = slug === "hindi" || slug === "hindi-literature" || slug === "spiritual";

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: content?.h1 ?? `${resolved} book summaries`,
    description,
    url: canonical,
    inLanguage: isHindi ? "hi" : "en",
    isPartOf: { "@type": "WebSite", name: "Booknomics", url: `${SITE}/` },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Browse", item: `${SITE}/browse` },
      { "@type": "ListItem", position: 3, name: resolved, item: canonical },
    ],
  };

  const faqs = content?.faqs ?? [
    {
      q: `What are the best ${resolved} books to read?`,
      a: `Booknomics curates ${count}+ ${resolved} book summaries, each with key insights, an action plan, reflection questions, and an audio summary.`,
    },
    {
      q: `Are Booknomics ${resolved} summaries free to read?`,
      a: "Yes. Every book summary on Booknomics is free to read. Premium unlocks habit trackers, personal notes, reflection prompts, and downloadable PDFs.",
    },
    {
      q: `How long does it take to read a ${resolved} summary?`,
      a: "Each summary is designed to be read in 10–15 minutes, with key insights distilled from the original book.",
    },
  ];

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumb = (
    <nav aria-label="Breadcrumb" className="container pt-6 text-xs md:text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li><Link to="/" className="hover:text-primary">Home</Link></li>
        <li aria-hidden>›</li>
        <li><Link to="/browse" className="hover:text-primary">Browse</Link></li>
        <li aria-hidden>›</li>
        <li className="text-foreground">{content?.h1 ?? resolved}</li>
      </ol>
    </nav>
  );

  const editorial = content ? (
    <section className="container py-8 md:py-12 max-w-3xl" aria-labelledby="category-editorial">
      <h2 id="category-editorial" className="sr-only">About {resolved} book summaries</h2>
      <div className="space-y-8">
        {content.sections.map((s) => (
          <div key={s.h2}>
            <h3 className="font-serif text-xl md:text-2xl font-bold tracking-tight mb-3">{s.h2}</h3>
            {s.body.map((p, i) => (
              <p key={i} className="text-sm md:text-base text-muted-foreground leading-relaxed mb-3">{p}</p>
            ))}
          </div>
        ))}
      </div>
    </section>
  ) : null;

  const below = content ? (
    <>
      {/* Editor's picks — internal links to key book pages */}
      <section className="container pb-12" aria-labelledby="category-picks">
        <h2 id="category-picks" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-5">
          Where to start
        </h2>
        <ul className="grid md:grid-cols-2 gap-3">
          {content.picks.map((p) => (
            <li key={p.slug}>
              <Link
                to={`/books/${p.slug}`}
                className="block rounded-xl border border-border bg-card p-4 hover:border-primary hover:shadow-paper transition-all"
              >
                <span className="font-serif text-base md:text-lg font-semibold block">{p.label}</span>
                <span className="text-xs md:text-sm text-muted-foreground">{p.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="container pb-12 max-w-3xl" aria-labelledby="category-faq">
        <h2 id="category-faq" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-5">
          Frequently asked questions
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`cat-faq-${i}`}>
              <AccordionTrigger className="text-left font-serif text-base md:text-lg">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Related */}
      <section className="container pb-16" aria-labelledby="category-related">
        <h2 id="category-related" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-5">
          Related collections and resources
        </h2>
        <ul className="flex flex-wrap gap-2">
          {content.related.map((r) => (
            <li key={r.path}>
              <Link
                to={r.path}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-sm hover:border-primary hover:text-primary transition"
              >
                {r.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <Button asChild size="lg" className="bg-gold text-primary-foreground hover:opacity-90 rounded-full gap-2 px-7">
            <Link to="/auth">Start free <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  ) : null;

  return (
    <>
      <SEO
        title={title}
        description={description}
        canonical={canonical}
        lang={isHindi ? "hi" : "en"}
        jsonLd={[collectionLd, breadcrumbLd, faqLd]}
      />
      <Browse
        categoryFilter={resolved}
        titleOverride={content?.h1 ?? `${resolved} book summaries`}
        introText={intro}
        skipSeo
        breadcrumb={breadcrumb}
        aboveContent={editorial}
        belowContent={below}
      />
    </>
  );
};

export default Category;
