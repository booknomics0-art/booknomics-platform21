import { useEffect, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { getBlogPost, BLOG_POSTS } from "@/content/blog";
import { supabase } from "@/integrations/supabase/client";
import { BookCard, type BookCardData } from "@/components/BookCard";
import { Clock, ArrowLeft } from "lucide-react";

const SITE = "https://booknomics.com";

const BlogPost = () => {
  const { slug = "" } = useParams();
  const post = getBlogPost(slug);
  const [related, setRelated] = useState<BookCardData[]>([]);

  useEffect(() => {
    if (!post) return;
    supabase
      .from("books")
      .select("id,slug,title,author,category,cover_color,cover_url,tagline,rating,reading_time")
      .eq("is_draft", false)
      .ilike("category", post.category)
      .limit(3)
      .then(({ data }) => setRelated((data ?? []) as any));
  }, [post]);

  if (!post) return <Navigate to="/blog" replace />;

  const url = `${SITE}/blog/${post.slug}`;
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: { "@type": "Organization", name: post.author, url: SITE },
    publisher: {
      "@type": "Organization",
      name: "Booknomics",
      logo: { "@type": "ImageObject", url: `${SITE}/og-default.svg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    keywords: post.tags.join(", "),
    articleSection: post.category,
    wordCount: post.body.split(/\s+/).length,
  };

  return (
    <Layout>
      <SEO
        title={`${post.title} | Booknomics`}
        description={post.description}
        path={`/blog/${post.slug}`}
        ogType="article"
        jsonLd={articleLd}
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ]}
      />
      <article className="container max-w-3xl py-10 md:py-14">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to articles
        </Link>

        <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">{post.category}</div>
        <h1 className="font-serif text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-4">
          {post.title}
        </h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-10">
          <span>By {post.author}</span>
          <span>·</span>
          <time dateTime={post.publishedAt}>
            {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </time>
          <span>·</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {post.readingTime} min read</span>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none
          prose-headings:font-serif prose-headings:tracking-tight
          prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-3
          prose-p:leading-relaxed prose-p:text-foreground/85
          prose-strong:text-foreground
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body}</ReactMarkdown>
        </div>

        {related.length > 0 && (
          <aside className="mt-14 pt-10 border-t border-border" aria-labelledby="related-books">
            <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Go deeper</div>
            <h2 id="related-books" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-6">
              Related book summaries
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {related.map((b) => <BookCard key={b.id} book={b} />)}
            </div>
          </aside>
        )}

        <aside className="mt-12 pt-8 border-t border-border">
          <h2 className="font-serif text-xl font-bold tracking-tight mb-4">Keep reading</h2>
          <ul className="space-y-2">
            {BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3).map((p) => (
              <li key={p.slug}>
                <Link to={`/blog/${p.slug}`} className="text-primary hover:underline">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </article>
    </Layout>
  );
};

export default BlogPost;
