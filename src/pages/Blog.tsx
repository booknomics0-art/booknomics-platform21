import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { BLOG_POSTS } from "@/content/blog";
import { Clock, ArrowRight } from "lucide-react";

const SITE = "https://booknomics.com";

const Blog = () => {
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Booknomics Blog",
    url: `${SITE}/blog`,
    blogPost: BLOG_POSTS.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      datePublished: p.publishedAt,
      url: `${SITE}/blog/${p.slug}`,
      author: { "@type": "Organization", name: p.author },
    })),
  };

  return (
    <Layout>
      <SEO
        title="Booknomics Blog — Practical articles on habits, mindset & money"
        description="Long-form, actionable articles that turn the best non-fiction books into routines, frameworks and decisions you can use this week."
        path="/blog"
        jsonLd={itemListLd}
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }]}
      />
      <section className="container max-w-4xl py-12 md:py-16">
        <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Articles</div>
        <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Ideas you can use this week
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mb-10">
          Long-form articles built around one practical problem each — distilled from the
          best book summaries on Booknomics.
        </p>

        <ul className="divide-y divide-border border-y border-border">
          {BLOG_POSTS.map((p) => (
            <li key={p.slug} className="py-7">
              <Link to={`/blog/${p.slug}`} className="group block">
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                  <span className="uppercase tracking-[0.15em] text-primary font-semibold">{p.category}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {p.readingTime} min</span>
                  <span>·</span>
                  <time dateTime={p.publishedAt}>
                    {new Date(p.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </time>
                </div>
                <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-tight group-hover:text-primary transition-colors leading-tight">
                  {p.title}
                </h2>
                <p className="text-muted-foreground mt-2 leading-relaxed">{p.description}</p>
                <span className="inline-flex items-center gap-1 mt-3 text-sm text-primary font-medium">
                  Read article <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
};

export default Blog;
