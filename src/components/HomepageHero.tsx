import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Headphones, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookCover, type BookCardData } from "@/components/BookCard";

const positions = ["bn-cover-a", "bn-cover-b", "bn-cover-c", "bn-cover-d", "bn-cover-e"] as const;

// Keep the hero useful even if the catalogue request is temporarily unavailable.
// These records mirror the current production D1 rows and use the canonical
// Booknomics image CDN URLs, so the fallback never shows empty loading slabs.
const FALLBACK_BOOKS: BookCardData[] = [
  {
    id: "6c70c888-5dc1-4ae1-87be-8504b32e993c",
    slug: "atomic-habits-james-clear-summary",
    title: "Atomic Habits",
    author: "James Clear",
    category: "Personal Development",
    cover_color: "blue",
    cover_url: "https://images.booknomics.com/covers/6c70c888-5dc1-4ae1-87be-8504b32e993c/7ba37be7f80d441a.webp",
    tagline: "Small behavior changes compound into remarkable results when systems make good actions easier.",
    rating: 4.8,
    reading_time: 19,
  },
  {
    id: "fc32255b-5cdb-4f28-b788-6091eeb9d2fb",
    slug: "deep-work-cal-newport-summary",
    title: "Deep Work",
    author: "Cal Newport",
    category: "Productivity",
    cover_color: "navy",
    cover_url: "https://images.booknomics.com/covers/fc32255b-5cdb-4f28-b788-6091eeb9d2fb/02ee56329c1747b2.webp",
    tagline: "Focused, distraction-free concentration is a trainable skill that produces rare and valuable work.",
    rating: 4.8,
    reading_time: 19,
  },
  {
    id: "132084bd-122f-483f-974c-7dcb60ece79f",
    slug: "the-psychology-of-money-morgan-housel-summary",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    category: "Finance",
    cover_color: "emerald",
    cover_url: "https://images.booknomics.com/covers/132084bd-122f-483f-974c-7dcb60ece79f/c57947fc1850124a.webp",
    tagline: "Financial success depends as much on behavior, time, and temperament as on technical knowledge.",
    rating: 4.8,
    reading_time: 19,
  },
  {
    id: "02004bfc-bfac-4494-9b06-4ca794ca7341",
    slug: "thinking-fast-and-slow-daniel-kahneman-summary",
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    category: "Psychology",
    cover_color: "indigo",
    cover_url: "https://images.booknomics.com/covers/02004bfc-bfac-4494-9b06-4ca794ca7341/f4f0993757462339.webp",
    tagline: "Human judgment relies on fast intuitive processes and slower deliberate reasoning, creating predictable biases under uncertainty.",
    rating: 4.8,
    reading_time: 19,
  },
  {
    id: "35fb5775-5311-4c33-b0d0-bb9e6e30842b",
    slug: "godan-munshi-premchand-saransh",
    title: "गोदान",
    author: "मुंशी प्रेमचंद",
    category: "साहित्य",
    cover_color: "amber",
    cover_url: "https://images.booknomics.com/covers/35fb5775-5311-4c33-b0d0-bb9e6e30842b/43430c406efa33e1.webp",
    tagline: "होरी और धनिया के जीवन के जरिए कर्ज़, जाति, खेती, परिवार और मानवीय गरिमा का गहरा ग्रामीण यथार्थ।",
    rating: 4.9,
    reading_time: 16,
  },
];

export function HomepageHero({ books }: { books: BookCardData[] }) {
  const visible = (books.length > 0 ? books : FALLBACK_BOOKS).slice(0, 5);

  return (
    <section className="bn-home-hero" aria-labelledby="home-hero-title">
      <div className="bn-home-hero-glow" aria-hidden="true" />
      <div className="container bn-home-hero-grid">
        <div className="bn-home-hero-copy">
          <div className="bn-eyebrow">
            <Sparkles className="h-3.5 w-3.5" />
            Read less. Keep more. Apply what matters.
          </div>

          <h1 id="home-hero-title" className="bn-display-title">
            Ideas worth keeping.
            <span>Books worth applying.</span>
          </h1>

          <p className="bn-home-lede">
            Discover the most useful ideas from remarkable books, then turn them into practical action — in English and Hindi.
          </p>

          <div className="bn-home-actions">
            <Button asChild size="lg" className="bn-primary-cta">
              <Link to="/browse">
                Explore the library <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bn-secondary-cta">
              <Link to="/hindi">हिंदी में पढ़ें</Link>
            </Button>
          </div>

          <div className="bn-hero-proof" aria-label="Booknomics features">
            <span><BookOpen className="h-4 w-4" /> Deep summaries</span>
            <span><Sparkles className="h-4 w-4" /> Action systems</span>
            <span><Headphones className="h-4 w-4" /> Read or listen</span>
          </div>
        </div>

        <div className="bn-book-stage" aria-label="Featured books from Booknomics">
          <div className="bn-stage-ring bn-stage-ring-one" aria-hidden="true" />
          <div className="bn-stage-ring bn-stage-ring-two" aria-hidden="true" />
          <div className="bn-stage-word bn-stage-word-read" aria-hidden="true">READ</div>
          <div className="bn-stage-word bn-stage-word-apply" aria-hidden="true">APPLY</div>

          {visible.map((book, index) => (
            <Link
              key={book.id}
              to={`/books/${book.slug}`}
              className={`bn-floating-cover ${positions[index]}`}
              aria-label={`Read ${book.title} by ${book.author}`}
            >
              <BookCover book={book} size={index === 2 ? "lg" : "md"} priority={index < 3} />
              <span className="bn-floating-meta">
                <strong>{book.title}</strong>
                <small>{book.author}</small>
              </span>
            </Link>
          ))}

          <div className="bn-stage-note" aria-hidden="true">
            <span>01</span>
            <p>Find one useful idea.<br />Put it to work.</p>
          </div>
        </div>
      </div>

      <div className="bn-kinetic-strip" aria-hidden="true">
        <div className="bn-kinetic-track">
          <span>READ</span><i>→</i><span>UNDERSTAND</span><i>→</i><span>APPLY</span><i>→</i><span>REFLECT</span><i>→</i><span>TRANSFORM</span><i>→</i>
          <span>READ</span><i>→</i><span>UNDERSTAND</span><i>→</i><span>APPLY</span><i>→</i><span>REFLECT</span><i>→</i><span>TRANSFORM</span><i>→</i>
        </div>
      </div>
    </section>
  );
}
