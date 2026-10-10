import { Link } from "react-router-dom";
import { ArrowRight, Mail } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SEO } from "@/components/SEO";
import { SOCIAL_LINKS } from "@/config/social";

const PAGE_URL = "https://booknomics.com/press";

const CITATION =
  "Booknomics is a bilingual book summaries platform that turns important books into practical insights, action plans, and reflection prompts for English and Hindi readers.";

const OFFERINGS = [
  { title: "English book summaries", desc: "Curated summaries of modern and classic English non-fiction and literature." },
  { title: "Hindi book summaries", desc: "Hindi summaries of spiritual texts, literature, and self-growth books." },
  { title: "Key insights", desc: "The core arguments of each book, stated plainly and without filler." },
  { title: "Deep analysis", desc: "Why an idea works, where it breaks, and how it applies today." },
  { title: "7-day action plans", desc: "A one-week practice plan so each book changes behaviour, not just opinions." },
  { title: "Reflection prompts", desc: "Questions that turn reading into thinking and journalling." },
  { title: "Reading trackers", desc: "Printable trackers that keep a reading habit measurable." },
  { title: "Free reading resources", desc: "Open guides and templates any reader or educator can use." },
];

const LINKS = [
  { label: "Reading Discovery Report 2026", to: "/research/reading-discovery-report-2026" },
  { label: "Homepage", to: "/" },
  { label: "English Book Summaries", to: "/english" },
  { label: "Hindi Library", to: "/hindi" },
  { label: "Best Hindi Book Summaries", to: "/best-hindi-book-summaries" },
  { label: "Resources", to: "/resources" },
  { label: "7-Day Reading Action Tracker", to: "/resources/7-day-reading-action-tracker" },
  { label: "Book Summary Template", to: "/resources/book-summary-template" },
  { label: "Contact", to: "/contact" },
];

const FAQS = [
  {
    q: "What is Booknomics?",
    a: "Booknomics is a bilingual book summaries platform. Each summary includes an introduction, key insights, a deep analysis, a 7-day action plan, and reflection prompts, so readers can understand a book and apply it in the same week.",
  },
  {
    q: "Is Booknomics available in Hindi?",
    a: "Yes. Booknomics publishes a full Hindi library covering spiritual classics, Hindi literature, and self-growth titles. You can start with the Hindi library or the Best Hindi Book Summaries collection.",
  },
  {
    q: "Can bloggers or educators reference Booknomics?",
    a: "Yes. Bloggers, journalists, teachers, YouTubers, and newsletter writers are welcome to cite or link to any public Booknomics page. The Reading Discovery Report 2026 includes citation-ready aggregate catalog and early Google Search data with a transparent methodology note.",
  },
  {
    q: "Where should media enquiries go?",
    a: "Send press, partnership, and interview requests through the Booknomics contact page. We usually reply within a few working days.",
  },
];

const Press = () => {
  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Booknomics",
    url: "https://booknomics.com/",
    description: CITATION,
    sameAs: SOCIAL_LINKS.map((s) => s.url),
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "media enquiries",
        url: "https://booknomics.com/contact",
        availableLanguage: ["en", "hi"],
      },
    ],
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <Layout>
      <SEO
        title="Press & Media — Booknomics"
        description="Learn about Booknomics, a bilingual English and Hindi book summaries platform with practical insights, action plans, reading resources, and citation-ready research."
        canonical={PAGE_URL}
        ogType="website"
        jsonLd={[organizationLd, faqLd]}
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Press & Media", path: "/press" },
        ]}
      />

      <nav aria-label="Breadcrumb" className="container pt-6 text-xs md:text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link to="/" className="hover:text-primary">Home</Link></li>
          <li aria-hidden>›</li>
          <li className="text-foreground">Press &amp; Media</li>
        </ol>
      </nav>

      <section className="bg-hero border-b border-border">
        <div className="container py-12 md:py-20 max-w-4xl">
          <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">
            For journalists, educators &amp; creators
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
            Press &amp; Media
          </h1>
          <p className="text-base md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
            Booknomics turns important books into practical insights, deep analysis, and 7-day action
            plans for English and Hindi readers. This page has everything you need to describe, cite,
            or link to us accurately.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gold text-primary-foreground hover:opacity-90 rounded-full gap-2 px-7">
              <Link to="/research/reading-discovery-report-2026">View 2026 research <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <Link to="/contact">Media enquiries</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container py-12 md:py-16 max-w-3xl" aria-labelledby="mission">
        <h2 id="mission" className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-5">
          Our mission
        </h2>
        <div className="prose prose-lg max-w-none text-foreground/90 font-serif leading-relaxed space-y-4">
          <p>
            Most people do not lack good books — they lack the time and the system to act on them.
            Booknomics exists to close that gap. We read carefully, write summaries a human would be
            proud to sign, and pair each one with a practice plan so an idea has a chance to survive
            first contact with real life.
          </p>
          <p>
            We are deliberately bilingual. English readers get modern classics on productivity,
            business, and psychology in our{" "}
            <Link to="/english" className="text-primary hover:underline">English library</Link>, while
            Hindi readers get spiritual texts, literature, and self-growth titles in their own language
            through the <Link to="/hindi" className="text-primary hover:underline">Hindi library</Link>{" "}
            and the{" "}
            <Link to="/best-hindi-book-summaries" className="text-primary hover:underline">
              Best Hindi Book Summaries
            </Link>{" "}
            collection.
          </p>
        </div>
      </section>

      <section className="container pb-4 md:pb-8 max-w-5xl" aria-labelledby="offerings">
        <h2 id="offerings" className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-8">
          What Booknomics offers
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
          {OFFERINGS.map((o) => (
            <div key={o.title} className="border border-border rounded-2xl p-5 bg-card">
              <h3 className="font-serif text-lg font-semibold mb-1">{o.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{o.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container py-12 md:py-16 max-w-3xl" aria-labelledby="research">
        <div className="border border-border rounded-3xl p-6 md:p-8 bg-card">
          <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">New research</div>
          <h2 id="research" className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-4">
            Booknomics Reading Discovery Report 2026
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-5">
            A transparent snapshot of our 5,062-book bilingual catalog, including English/Hindi composition,
            category breadth, represented authors, and early Google Search discovery signals. The report clearly
            separates Booknomics' own catalog data from broader claims about readers in India.
          </p>
          <Button asChild variant="outline" className="rounded-full gap-2">
            <Link to="/research/reading-discovery-report-2026">Read the report <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <section className="container py-12 md:py-16 max-w-3xl" aria-labelledby="citation">
        <h2 id="citation" className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-5">
          Suggested citation
        </h2>
        <blockquote className="border-l-4 border-primary bg-card rounded-r-2xl p-5 md:p-6 font-serif text-base md:text-lg leading-relaxed">
          “{CITATION}”
        </blockquote>
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
          Please credit “Booknomics” and link to the specific page you reference. Book titles, author
          names, and cover images belong to their respective publishers and copyright holders.
        </p>
      </section>

      <section className="container pb-12 md:pb-16 max-w-3xl" aria-labelledby="useful-links">
        <h2 id="useful-links" className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-6">
          Useful links
        </h2>
        <ul className="grid sm:grid-cols-2 gap-2 md:gap-3">
          {LINKS.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                className="block border border-border rounded-xl px-4 py-3 bg-card hover:border-primary transition-colors text-sm md:text-base font-serif"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container pb-12 md:pb-16 max-w-3xl" aria-labelledby="faq-heading">
        <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">FAQ</div>
        <h2 id="faq-heading" className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-8">
          Frequently asked questions
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

      <section className="container pb-12 md:pb-20">
        <div className="bg-gold rounded-3xl p-10 md:p-16 text-center shadow-cover">
          <Mail className="h-6 w-6 text-primary-foreground mx-auto mb-4" />
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-primary-foreground mb-3">
            Media &amp; partnership enquiries
          </h2>
          <p className="text-primary-foreground/80 max-w-xl mx-auto mb-7 text-sm md:text-base">
            Writing about reading habits, book summaries, bilingual learning, or digital reading discovery? We are happy to share
            quotes, aggregate data, and methodology context.
          </p>
          <Button asChild size="lg" variant="secondary" className="rounded-full px-8">
            <Link to="/contact">Contact the Booknomics team</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
};

export default Press;
