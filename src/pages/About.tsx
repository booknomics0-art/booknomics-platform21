import { DocPage } from "@/components/DocPage";
import { BookOpen, Globe, Heart, Target } from "lucide-react";

const values = [
  { icon: BookOpen, title: "Quality before scale", body: "A public page should be useful, book-specific, and accurate enough to earn indexing. Lower-confidence pages can stay out of search while they are improved." },
  { icon: Globe, title: "Hindi + English accessibility", body: "We build dedicated Hindi and English discovery experiences so readers can learn in the language that works best for them." },
  { icon: Target, title: "Practical learning", body: "Summaries are designed to move from understanding to application through key ideas, reflection, and action-oriented sections." },
  { icon: Heart, title: "Respect the source work", body: "The original book and author remain the source work. Booknomics publishes an independent study guide; it does not pretend to be the author or publisher." },
];

const orgLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://www.booknomics.com/#organization",
  name: "Booknomics",
  url: "https://www.booknomics.com/",
  logo: {
    "@type": "ImageObject",
    url: "https://www.booknomics.com/og-default.svg",
  },
  description: "Booknomics is a bilingual learning platform for practical book summaries, deeper analysis, reflection, and action in Hindi and English.",
  areaServed: { "@type": "Country", name: "India" },
  knowsLanguage: ["hi", "en"],
  knowsAbout: [
    "Hindi book summaries",
    "English book summaries",
    "literature",
    "non-fiction",
    "book analysis",
    "reading and learning",
  ],
  publishingPrinciples: "https://www.booknomics.com/about#editorial-process",
};

const About = () => (
  <DocPage
    eyebrow="Our story"
    title="A practical library for readers who want to understand and apply books."
    intro="Booknomics is a bilingual learning platform for Hindi and English readers. We turn books into structured study guides with concise answers, deeper analysis, key ideas, reflection, and practical application."
    sections={[
      {
        id: "mission",
        title: "Our Mission",
        body: (
          <>
            <p>
              We exist to make serious reading easier to <strong>understand, revisit, and apply</strong>. A summary should not be a pile of generic bullet points; it should help a reader grasp what a book is about, why its ideas matter, and where the limits or practical implications are.
            </p>
            <p>
              Hindi is a major focus for Booknomics. We are building a dedicated Hindi discovery layer for Indian readers while continuing to serve English readers on the same platform.
            </p>
          </>
        ),
      },
      {
        id: "what-we-publish",
        title: "What We Publish",
        body: (
          <>
            <p>Booknomics covers literature, classics, philosophy, self-improvement, business, psychology, spirituality, history, and other reading categories. Individual pages may include:</p>
            <ul>
              <li>a concise book-at-a-glance answer</li>
              <li>the original book title and author</li>
              <li>overview, key ideas, and deeper analysis</li>
              <li>practical application and reflection prompts</li>
              <li>related books and topic paths</li>
              <li>audio or other learning assets when available</li>
            </ul>
            <p>
              Booknomics pages are independent study guides. Unless explicitly stated otherwise, they are not written, sponsored, or endorsed by the original author or publisher.
            </p>
          </>
        ),
      },
      {
        id: "editorial-process",
        title: "How Our Editorial Workflow Works",
        body: (
          <>
            <p>
              Our workflow can use software and AI-assisted drafting, formatting, translation, enrichment, and quality checks. Automation is a production tool, not a substitute for factual standards.
            </p>
            <p>For public, indexable pages we aim to verify and preserve the things that matter most:</p>
            <ol>
              <li><strong>Identity:</strong> correct title, author, language, category, and canonical URL.</li>
              <li><strong>Specificity:</strong> the page should discuss the actual book rather than repeat generic boilerplate.</li>
              <li><strong>Answer clarity:</strong> important questions should have concise, extractable answers before deeper context.</li>
              <li><strong>Source separation:</strong> the original book is the source work; Booknomics is the publisher of the independent summary page.</li>
              <li><strong>Search quality:</strong> incomplete, duplicate, or lower-confidence pages can remain <code>noindex</code> until they meet the publishing gate.</li>
            </ol>
          </>
        ),
      },
      {
        id: "funding",
        title: "How Booknomics Is Funded",
        body: (
          <>
            <p>
              Booknomics may use clearly identified advertising, affiliate links, and optional paid features to help fund free access to the library and ongoing editorial work.
            </p>
            <p>
              Commercial relationships do <strong>not</strong> determine which books we cover, how we rank books, or the conclusions of a summary or analysis. Advertising is kept separate from editorial decisions, and any sponsored material will be clearly labelled if we publish it.
            </p>
          </>
        ),
      },
      {
        id: "corrections",
        title: "Accuracy and Corrections",
        body: (
          <>
            <p>
              Book summaries can contain factual, bibliographic, translation, or interpretation errors. When we identify a material problem, our preferred response is to correct it, quarantine the page from indexing when necessary, and keep the canonical record consistent rather than amplify a known error.
            </p>
            <p>
              Readers should use Booknomics as a learning guide, not as a replacement for the original book or a scholarly edition when exact quotations, editions, or academic citation are required.
            </p>
          </>
        ),
      },
      {
        id: "values",
        title: "Our Values",
        body: (
          <div className="not-prose grid sm:grid-cols-2 gap-4">
            {values.map((v) => (
              <div key={v.title} className="bg-card border border-border rounded-xl p-5 shadow-paper">
                <div className="bg-gold h-10 w-10 rounded-lg grid place-items-center mb-3">
                  <v.icon className="h-4 w-4 text-primary-foreground" />
                </div>
                <h3 className="font-serif text-lg font-bold mb-1">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: "promise",
        title: "Our Promise",
        body: (
          <>
            <p>
              We will keep the reader experience primary. Search engines and AI answer systems should be able to understand our pages because the content is clear and structured—not because the page is stuffed with hidden keywords or manufactured claims.
            </p>
            <p>
              The goal is simple: when someone searches for a book, author, idea, character, theme, or practical lesson, Booknomics should be a useful source worth reading and, when an answer engine chooses, worth citing.
            </p>
          </>
        ),
      },
    ]}
    seo={{
      title: "About Booknomics — Hindi & English Book Summaries and Editorial Standards",
      description: "Learn how Booknomics creates structured Hindi and English book summaries, separates source works from editorial guides, and applies quality and indexing checks.",
      path: "/about",
      jsonLd: orgLd,
    }}
  />
);

export default About;
