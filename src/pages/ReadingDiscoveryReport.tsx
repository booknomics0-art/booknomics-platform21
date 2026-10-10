import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Languages,
  Search,
  Sparkles,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";

const PAGE_URL = "https://booknomics.com/research/reading-discovery-report-2026";

const LANGUAGE_DATA = [
  { label: "English", value: 3460, share: 68.4 },
  { label: "Hindi", value: 1602, share: 31.6 },
];

const CATEGORY_DATA = [
  { label: "Literary Fiction / Classic Literature", value: 210 },
  { label: "Hindi novels (उपन्यास)", value: 171 },
  { label: "Science Fiction", value: 130 },
  { label: "Literary Fiction / Classic & Cultural Studies", value: 111 },
  { label: "Classic Literature", value: 108 },
  { label: "Regional literature · Telugu", value: 100 },
  { label: "Regional literature · Malayalam", value: 100 },
  { label: "Regional literature · Kannada", value: 100 },
  { label: "Psychology", value: 90 },
  { label: "Romance", value: 85 },
];

const AUTHOR_DATA = [
  { label: "Munshi Premchand", value: 40 },
  { label: "Stephen King", value: 33 },
  { label: "Agatha Christie", value: 31 },
  { label: "Rabindranath Tagore", value: 25 },
  { label: "Yaddanapudi Sulochana Rani", value: 25 },
  { label: "Surender Mohan Pathak", value: 25 },
  { label: "Triveni", value: 21 },
  { label: "William Shakespeare", value: 20 },
];

const QUERY_DATA = [
  { query: "कामायनी का सारांश", impressions: 8, clicks: 1, position: 7.63 },
  { query: "मैला आँचल का सारांश", impressions: 7, clicks: 1, position: 6.71 },
  { query: "पहला गिरमिटिया", impressions: 5, clicks: 1, position: 9.8 },
  { query: "वयं रक्षामः उपन्यास का सारांश", impressions: 2, clicks: 1, position: 1.5 },
  { query: "how emotions are made summary", impressions: 2, clicks: 1, position: 9.5 },
  { query: "thanks for the feedback summary", impressions: 2, clicks: 1, position: 7.5 },
  { query: "atit ke chalchitra kiski rachna hai", impressions: 36, clicks: 0, position: 6.64 },
];

const maxCategory = Math.max(...CATEGORY_DATA.map((item) => item.value));
const maxAuthor = Math.max(...AUTHOR_DATA.map((item) => item.value));

const ReadingDiscoveryReport = () => {
  const reportLd = {
    "@context": "https://schema.org",
    "@type": "Report",
    name: "Booknomics Reading Discovery Report 2026",
    headline: "Booknomics Reading Discovery Report 2026",
    description:
      "A transparent data snapshot of Booknomics' 5,062-book bilingual catalog and its early Google Search discovery signals.",
    url: PAGE_URL,
    datePublished: "2026-10-11",
    author: {
      "@type": "Organization",
      name: "Booknomics",
      url: "https://booknomics.com/",
    },
    publisher: {
      "@type": "Organization",
      name: "Booknomics",
      url: "https://booknomics.com/",
    },
    about: [
      "Book discovery",
      "Hindi books",
      "English books",
      "Reading",
      "Book summaries",
    ],
  };

  return (
    <Layout>
      <SEO
        title="Reading Discovery Report 2026 — Booknomics"
        description="Booknomics' 2026 research snapshot: 5,062 books, English and Hindi catalog composition, genre breadth, represented authors, and early Google Search discovery signals."
        canonical={PAGE_URL}
        ogType="article"
        jsonLd={reportLd}
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Research", path: "/research/reading-discovery-report-2026" },
          { name: "Reading Discovery Report 2026", path: "/research/reading-discovery-report-2026" },
        ]}
      />

      <nav aria-label="Breadcrumb" className="container pt-6 text-xs md:text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link to="/" className="hover:text-primary">Home</Link></li>
          <li aria-hidden>›</li>
          <li><Link to="/press" className="hover:text-primary">Press &amp; Media</Link></li>
          <li aria-hidden>›</li>
          <li className="text-foreground">Reading Discovery Report 2026</li>
        </ol>
      </nav>

      <section className="bg-hero border-b border-border">
        <div className="container py-12 md:py-20 max-w-5xl">
          <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">
            Booknomics Research · 11 October 2026
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight leading-[1.08] mb-5 max-w-4xl">
            Reading Discovery Report 2026
          </h1>
          <p className="text-base md:text-xl text-muted-foreground leading-relaxed max-w-3xl">
            A transparent snapshot of a 5,062-book bilingual digital catalog and the early Google Search
            signals showing how readers are discovering Hindi and English book content on Booknomics.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gold text-primary-foreground hover:opacity-90 rounded-full gap-2 px-7">
              <a href="#findings">Explore the findings <ArrowRight className="h-4 w-4" /></a>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <Link to="/press">Press &amp; citation guide</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container py-10 md:py-14 max-w-6xl" aria-label="Headline statistics">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
          {[
            { value: "5,062", label: "books in the catalog", icon: BookOpen },
            { value: "3,460", label: "English books", icon: Languages },
            { value: "1,602", label: "Hindi books", icon: Languages },
            { value: "18 min", label: "median summary reading time", icon: Sparkles },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="border border-border rounded-2xl p-5 md:p-6 bg-card">
                <Icon className="h-5 w-5 text-primary mb-4" aria-hidden />
                <div className="font-serif text-3xl md:text-4xl font-bold tracking-tight">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="findings" className="container pb-12 md:pb-16 max-w-5xl" aria-labelledby="findings-heading">
        <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Executive summary</div>
        <h2 id="findings-heading" className="font-serif text-3xl md:text-5xl font-bold tracking-tight mb-7">
          Five findings worth citing
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            ["01", "The catalog is meaningfully bilingual", "English represents 68.4% of the catalog and Hindi 31.6%, creating a substantial Hindi-language discovery layer rather than a token translation section."],
            ["02", "Classic literature is a major catalog pillar", "Literary fiction and classic-literature categories are among the largest groups, while Hindi novels form one of the largest single category labels."],
            ["03", "Regional Indian literature already has visible depth", "The catalog includes at least 100 titles each tagged under Telugu, Malayalam and Kannada regional-literature categories."],
            ["04", "Early search demand is India-heavy", "In the latest settled 28-day Google Search Console window used for this report, India generated 2,110 impressions and 18 clicks — roughly 84% of measured impressions and 78% of clicks."],
            ["05", "Hindi literature queries are appearing early", "Queries around Kamayani, Maila Anchal, Banbhatt Ki Atmakatha and Atit Ke Chalchitra are already surfacing in Google Search, alongside English nonfiction-summary searches."],
          ].map(([num, title, body]) => (
            <article key={num} className="border border-border rounded-2xl p-5 md:p-6 bg-card">
              <div className="text-xs font-semibold tracking-[0.16em] text-primary mb-3">FINDING {num}</div>
              <h3 className="font-serif text-xl md:text-2xl font-semibold mb-2">{title}</h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card/40">
        <div className="container py-12 md:py-16 max-w-5xl">
          <div className="flex items-center gap-3 mb-3">
            <Languages className="h-5 w-5 text-primary" aria-hidden />
            <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold">Catalog composition</div>
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-8">English and Hindi at meaningful scale</h2>
          <div className="space-y-6">
            {LANGUAGE_DATA.map((item) => (
              <div key={item.label}>
                <div className="flex items-end justify-between gap-4 mb-2">
                  <div>
                    <div className="font-serif text-xl font-semibold">{item.label}</div>
                    <div className="text-sm text-muted-foreground">{item.value.toLocaleString()} books</div>
                  </div>
                  <div className="font-serif text-2xl font-bold">{item.share}%</div>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden" aria-label={`${item.label}: ${item.share}%`}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${item.share}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-7 text-sm text-muted-foreground leading-relaxed">
            Catalog snapshot: 11 October 2026. Counts are derived from Booknomics' production catalog and are not a survey of national reading behaviour.
          </p>
        </div>
      </section>

      <section className="container py-12 md:py-16 max-w-5xl" aria-labelledby="categories-heading">
        <div className="flex items-center gap-3 mb-3">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
          <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold">Genre breadth</div>
        </div>
        <h2 id="categories-heading" className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-8">
          Most represented catalog categories
        </h2>
        <div className="space-y-4">
          {CATEGORY_DATA.map((item) => (
            <div key={item.label} className="grid md:grid-cols-[280px_1fr_60px] gap-2 md:gap-4 items-center">
              <div className="text-sm font-medium leading-snug">{item.label}</div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(item.value / maxCategory) * 100}%` }} />
              </div>
              <div className="text-sm md:text-right font-semibold tabular-nums">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="container pb-12 md:pb-16 max-w-5xl" aria-labelledby="authors-heading">
        <h2 id="authors-heading" className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-8">
          Most represented authors in the catalog
        </h2>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
          {AUTHOR_DATA.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between gap-4 mb-1.5 text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="font-semibold tabular-nums">{item.value}</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(item.value / maxAuthor) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground leading-relaxed">
          These figures measure representation inside the Booknomics catalog, not popularity among readers.
        </p>
      </section>

      <section className="border-y border-border bg-card/40">
        <div className="container py-12 md:py-16 max-w-5xl">
          <div className="flex items-center gap-3 mb-3">
            <Search className="h-5 w-5 text-primary" aria-hidden />
            <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold">Early search discovery</div>
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Google discovery is currently concentrated in India
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-3xl mb-8">
            In the latest settled Search Console window used here, Booknomics recorded 23 clicks and 2,524 impressions overall. India accounted for 18 clicks and 2,110 impressions, with an average position of 7.40.
          </p>

          <div className="grid md:grid-cols-3 gap-4 mb-10">
            {[
              ["2,110", "India impressions"],
              ["18", "India clicks"],
              ["7.40", "India average position"],
            ].map(([value, label]) => (
              <div key={label} className="border border-border rounded-2xl p-5 bg-background">
                <div className="font-serif text-3xl font-bold">{value}</div>
                <div className="text-sm text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto border border-border rounded-2xl bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left bg-muted/40">
                  <th className="px-4 py-3 font-semibold">Search query</th>
                  <th className="px-4 py-3 font-semibold text-right">Impressions</th>
                  <th className="px-4 py-3 font-semibold text-right">Clicks</th>
                  <th className="px-4 py-3 font-semibold text-right">Avg. position</th>
                </tr>
              </thead>
              <tbody>
                {QUERY_DATA.map((row) => (
                  <tr key={row.query} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 font-medium">{row.query}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.impressions}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.clicks}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 text-xs md:text-sm text-muted-foreground leading-relaxed">
            Google Search Console data is early-stage and low-volume. It is presented as discovery evidence, not as a statistically representative measure of Indian reading demand. Search data was settled through 6 October 2026.
          </p>
        </div>
      </section>

      <section className="container py-12 md:py-16 max-w-4xl" aria-labelledby="method-heading">
        <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Methodology &amp; limitations</div>
        <h2 id="method-heading" className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-6">
          How to use these numbers responsibly
        </h2>
        <div className="prose prose-lg max-w-none text-foreground/90 font-serif leading-relaxed space-y-4">
          <p>
            Catalog metrics come from the Booknomics production database on 11 October 2026. They describe the books currently represented on Booknomics — they do not estimate the size, preferences, or demographics of India's reading population.
          </p>
          <p>
            Search metrics come from the connected Google Search Console property for Booknomics. Because the site is still early in its search lifecycle and Search Console data settles with a delay, these figures should be read as directional discovery signals rather than stable market-share estimates.
          </p>
          <p>
            Book counts, language splits, category representation, author representation, reading-time statistics and the quoted Search Console figures may be cited with attribution to “Booknomics Reading Discovery Report 2026” and a link to this page.
          </p>
        </div>
      </section>

      <section className="container pb-12 md:pb-20 max-w-5xl">
        <div className="bg-gold rounded-3xl p-8 md:p-12 shadow-cover">
          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="text-xs tracking-[0.2em] uppercase text-primary-foreground/70 font-semibold mb-3">For journalists, educators &amp; researchers</div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-foreground mb-3">
                Need a quote, methodology note, or custom cut of the data?
              </h2>
              <p className="text-primary-foreground/80 leading-relaxed max-w-2xl">
                We can provide the underlying aggregate figures, clarify methodology, and share additional non-personal catalog cuts for editorial use.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary" className="rounded-full px-7 gap-2 shrink-0">
              <Link to="/contact">Contact Booknomics <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default ReadingDiscoveryReport;
