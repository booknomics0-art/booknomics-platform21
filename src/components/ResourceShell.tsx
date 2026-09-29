import { ReactNode } from "react";
import { Link } from "react-router-dom";
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

const SITE = "https://booknomics.com";

export interface ResourceShellProps {
  path: string;
  title: string;
  description: string;
  h1: string;
  kicker?: string;
  lead: string;
  lang?: "en" | "hi";
  /** Extra breadcrumb crumbs between Home and the current page. */
  crumbs?: { name: string; path: string }[];
  datePublished?: string;
  faqs?: { q: string; a: string }[];
  related?: { path: string; label: string }[];
  children: ReactNode;
}

export const ResourceShell = ({
  path,
  title,
  description,
  h1,
  kicker,
  lead,
  lang = "en",
  crumbs = [{ name: "Resources", path: "/resources" }],
  datePublished = "2026-08-01",
  faqs,
  related,
  children,
}: ResourceShellProps) => {
  const url = `${SITE}${path}`;
  const trail = [{ name: "Home", path: "/" }, ...crumbs, { name: h1, path }];

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: lang,
    datePublished,
    author: { "@type": "Organization", name: "Booknomics", url: `${SITE}/` },
    publisher: { "@type": "Organization", name: "Booknomics", url: `${SITE}/` },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${SITE}${c.path}`,
    })),
  };
  const faqLd = faqs?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  return (
    <Layout>
      <SEO
        title={title}
        description={description}
        canonical={url}
        lang={lang}
        ogType="article"
        jsonLd={faqLd ? [articleLd, breadcrumbLd, faqLd] : [articleLd, breadcrumbLd]}
      />

      <nav aria-label="Breadcrumb" className="container pt-6 text-xs md:text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          {trail.map((c, i) => (
            <li key={c.path} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>›</span>}
              {i === trail.length - 1 ? (
                <span className="text-foreground">{c.name}</span>
              ) : (
                <Link to={c.path} className="hover:text-primary">{c.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <header className="bg-hero border-b border-border">
        <div className="container py-10 md:py-16 max-w-4xl">
          {kicker && (
            <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">{kicker}</div>
          )}
          <h1 className="font-serif text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-4">{h1}</h1>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">{lead}</p>
        </div>
      </header>

      <div className="container py-10 md:py-14 max-w-3xl space-y-10">{children}</div>

      {faqs && faqs.length > 0 && (
        <section className="container pb-12 max-w-3xl" aria-labelledby="resource-faq">
          <h2 id="resource-faq" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-5">
            Frequently asked questions
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`res-faq-${i}`}>
                <AccordionTrigger className="text-left font-serif text-base md:text-lg">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {related && related.length > 0 && (
        <section className="container pb-16" aria-labelledby="resource-related">
          <h2 id="resource-related" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-5">
            Related resources and collections
          </h2>
          <ul className="flex flex-wrap gap-2">
            {related.map((r) => (
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
              <Link to="/browse">Explore book summaries <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      )}
    </Layout>
  );
};

/** Shared prose block helpers for resource pages. */
export const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-3">{children}</h2>
);

export const P = ({ children }: { children: ReactNode }) => (
  <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-3">{children}</p>
);
