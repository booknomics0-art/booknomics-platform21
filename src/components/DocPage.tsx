import { ReactNode, useEffect, useState } from "react";
import { Layout } from "./Layout";
import { SEO } from "./SEO";

export type DocSection = { id: string; title: string; body: ReactNode };

interface DocPageProps {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  updated?: string;
  sections: DocSection[];
  seo: { title: string; description: string; path: string; jsonLd?: object };
}

export const DocPage = ({ eyebrow, title, intro, updated, sections, seo }: DocPageProps) => {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <Layout>
      <SEO
        title={seo.title}
        description={seo.description}
        path={seo.path}
        jsonLd={seo.jsonLd}
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: title, path: seo.path },
        ]}
      />
      {/* Hero */}
      <section className="bg-hero border-b border-border">
        <div className="container py-12 md:py-20 max-w-5xl">
          <div className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">
            {eyebrow}
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-4 [min-height:1.1em]">
            {title}
          </h1>
          {intro && (
            <p className="text-lg md:text-xl text-muted-foreground font-serif leading-relaxed max-w-3xl">
              {intro}
            </p>
          )}
          {updated && (
            <p className="text-xs text-muted-foreground mt-6 tracking-wide uppercase">
              Last updated · {updated}
            </p>
          )}
        </div>
      </section>

      {/* Document body */}
      <div className="container max-w-6xl py-10 md:py-16">
        <div className="grid md:grid-cols-[220px_1fr] gap-10 md:gap-16">
          {/* Sticky TOC */}
          <aside className="hidden md:block">
            <div className="sticky top-24">
              <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-semibold mb-4">
                On this page
              </div>
              <nav className="space-y-1 border-l border-border">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={`block pl-4 py-1.5 -ml-px border-l-2 text-sm transition-colors ${
                      active === s.id
                        ? "border-primary text-foreground font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Mobile TOC */}
          <details className="md:hidden bg-card border border-border rounded-xl p-4 mb-2">
            <summary className="text-sm font-semibold cursor-pointer">On this page</summary>
            <nav className="mt-3 space-y-1.5">
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="block text-sm text-muted-foreground py-1">
                  · {s.title}
                </a>
              ))}
            </nav>
          </details>

          {/* Content */}
          <article className="min-w-0 space-y-12">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-xs font-mono text-primary tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-tight">
                    {s.title}
                  </h2>
                </div>
                <div className="prose prose-base md:prose-lg dark:prose-invert max-w-none font-serif prose-headings:font-serif prose-a:text-primary prose-strong:text-foreground prose-li:my-1">
                  {s.body}
                </div>
                {i < sections.length - 1 && (
                  <div className="mt-12 h-px bg-gradient-to-r from-primary/30 via-border to-transparent" />
                )}
              </section>
            ))}
          </article>
        </div>
      </div>
    </Layout>
  );
};
