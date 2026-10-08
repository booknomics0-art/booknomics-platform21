import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Headphones, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookCover, type BookCardData } from "@/components/BookCard";

const positions = ["bn-cover-a", "bn-cover-b", "bn-cover-c", "bn-cover-d", "bn-cover-e"] as const;

export function HomepageHero({ books }: { books: BookCardData[] }) {
  const visible = books.slice(0, 5);

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

          {visible.length === 0 && (
            <div className="bn-stage-loading" aria-hidden="true">
              <div />
              <div />
              <div />
            </div>
          )}

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
