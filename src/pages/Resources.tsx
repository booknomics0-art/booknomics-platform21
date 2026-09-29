import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { ArrowRight, ClipboardList, FileText, Compass, Languages } from "lucide-react";

const SITE = "https://booknomics.com";
const PATH = "/resources";

const RESOURCES = [
  {
    path: "/resources/7-day-reading-action-tracker",
    icon: ClipboardList,
    title: "Free 7-Day Reading Action Tracker",
    desc: "Turn any book into seven days of small, specific actions — with reflection space for each day.",
  },
  {
    path: "/resources/book-summary-template",
    icon: FileText,
    title: "Free Book Summary Template",
    desc: "A reusable structure for summarising any book: core idea, five lessons, quotes, action steps.",
  },
  {
    path: "/resources/best-book-summary-websites",
    icon: Compass,
    title: "Best Book Summary Websites and Apps",
    desc: "An honest guide to choosing a summary platform, with the criteria that actually matter.",
  },
  {
    path: "/resources/best-hindi-book-summaries-guide",
    icon: Languages,
    title: "Best Hindi Book Summaries: Complete Guide",
    desc: "हिंदी पाठकों के लिए पूरी गाइड — कहाँ से शुरू करें, कौन-सी श्रेणी चुनें, कैसे लागू करें।",
  },
];

const Resources = () => {
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Free Reading Resources by Booknomics",
    description:
      "Free tools, templates, trackers and guides that help readers apply what they read — from Booknomics.",
    url: `${SITE}${PATH}`,
    inLanguage: "en",
    isPartOf: { "@type": "WebSite", name: "Booknomics", url: `${SITE}/` },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: RESOURCES.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: r.title,
        url: `${SITE}${r.path}`,
      })),
    },
  };

  return (
    <Layout>
      <SEO
        title="Free Reading Resources by Booknomics"
        description="Free reading tools from Booknomics: a 7-day action tracker, a book summary template, and practical guides for English and Hindi readers."
        canonical={`${SITE}${PATH}`}
        jsonLd={[collectionLd]}
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "Resources", path: PATH }]}
      />

      <nav aria-label="Breadcrumb" className="container pt-6 text-xs md:text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link to="/" className="hover:text-primary">Home</Link></li>
          <li aria-hidden>›</li>
          <li className="text-foreground">Resources</li>
        </ol>
      </nav>

      <header className="bg-hero border-b border-border">
        <div className="container py-10 md:py-16 max-w-4xl">
          <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Free for everyone</div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-4">
            Free Reading Resources by Booknomics
          </h1>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
            Reading more is easy. Retaining and applying what you read is the hard part. These free tools —
            a 7-day action tracker, a summary template and two practical guides — exist to close that gap.
            No sign-up required, and you are welcome to use them with your students, team or book club.
          </p>
        </div>
      </header>

      <section className="container py-10 md:py-14" aria-labelledby="all-resources">
        <h2 id="all-resources" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-6">
          Tools and guides
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {RESOURCES.map(({ icon: Icon, ...r }) => (
            <Link
              key={r.path}
              to={r.path}
              className="rounded-2xl border border-border bg-card p-5 md:p-6 hover:border-primary hover:shadow-paper transition-all"
            >
              <Icon className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-serif text-lg md:text-xl font-semibold mb-1.5">{r.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{r.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container pb-12 max-w-3xl">
        <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-3">How readers use these</h2>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-3">
          Most people who feel stuck with reading do not have a discipline problem — they have a translation
          problem. A book gives you an idea; nothing in your week changes to accommodate it. The tracker fixes
          that by forcing one specific action per day for seven days. The template fixes the memory side, giving
          every book you read the same retrievable shape.
        </p>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
          Teachers and book-club organisers are welcome to print or adapt these pages. If you publish them
          elsewhere, a link back to this page is appreciated but not required.
        </p>
      </section>

      <section className="container pb-16" aria-labelledby="resources-next">
        <h2 id="resources-next" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-5">
          Where to read next
        </h2>
        <ul className="flex flex-wrap gap-2">
          {[
            { path: "/english", label: "English book summaries" },
            { path: "/hindi", label: "हिंदी लाइब्रेरी" },
            { path: "/best-hindi-book-summaries", label: "Best Hindi book summaries" },
            { path: "/category/self-help", label: "Self-help summaries" },
            { path: "/category/productivity", label: "Productivity summaries" },
            { path: "/blog", label: "Booknomics blog" },
            { path: "/press", label: "Press & citation info" },
          ].map((l) => (
            <li key={l.path}>
              <Link
                to={l.path}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-sm hover:border-primary hover:text-primary transition"
              >
                {l.label}
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
    </Layout>
  );
};

export default Resources;
