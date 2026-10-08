import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookCover, type BookCardData } from "@/components/BookCard";

const story = [
  { kicker: "Read", line: "Most people read.", detail: "Ideas arrive quickly. Attention moves on even faster." },
  { kicker: "Remember", line: "A few remember.", detail: "A highlight only matters when it stays with you." },
  { kicker: "Apply", line: "Even fewer apply.", detail: "Knowledge changes nothing until it becomes a decision or a habit." },
  { kicker: "Transform", line: "Booknomics changes the last part.", detail: "Key ideas become practical actions, reflection prompts and systems you can use." },
] as const;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function ScrollTypographyStory({ books }: { books: BookCardData[] }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const active = Math.min(story.length - 1, Math.round(progress * (story.length - 1)));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const section = sectionRef.current;
    if (!section) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(1, section.offsetHeight - window.innerHeight);
      const travelled = clamp(-rect.top / scrollable);
      setProgress(travelled);
    };

    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const stage = progress * (story.length - 1);
  const visualBooks = useMemo(() => books.slice(0, 4), [books]);

  return (
    <section ref={sectionRef} className="bn-scroll-story" aria-labelledby="bn-story-heading">
      <div className="bn-story-sticky">
        <div className="bn-story-grid" aria-hidden="true" />
        <div className="bn-story-glow" aria-hidden="true" />

        <div className="bn-story-counter" aria-hidden="true">
          <span>{String(active + 1).padStart(2, "0")}</span>
          <i />
          <span>04</span>
        </div>

        <div className="bn-story-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.max(0.02, progress)})` }} />
        </div>

        <div className="bn-story-words" aria-live="polite">
          <h2 id="bn-story-heading" className="sr-only">How Booknomics turns reading into action</h2>
          {story.map((item, index) => {
            const distance = Math.abs(stage - index);
            const opacity = clamp(1 - distance * 1.15);
            const translate = (index - stage) * 88;
            const scale = 0.94 + opacity * 0.06;
            return (
              <article
                key={item.kicker}
                className={`bn-story-slide ${index === story.length - 1 ? "bn-story-slide-final" : ""}`}
                style={{
                  opacity,
                  transform: `translate3d(0, ${translate}px, 0) scale(${scale})`,
                  pointerEvents: opacity > 0.75 ? "auto" : "none",
                }}
                aria-hidden={active !== index}
              >
                <span className="bn-story-kicker">{item.kicker}</span>
                <p className="bn-story-line">{item.line}</p>
                <p className="bn-story-detail">{item.detail}</p>
                {index === story.length - 1 && (
                  <Link to="/browse" className="bn-story-link">Explore books <span aria-hidden="true">→</span></Link>
                )}
              </article>
            );
          })}
        </div>

        {visualBooks.map((book, index) => {
          const direction = index % 2 === 0 ? 1 : -1;
          const x = direction * (18 + progress * 44);
          const y = (index < 2 ? -1 : 1) * (18 + progress * 32);
          const rotate = direction * (6 + progress * 10);
          return (
            <Link
              key={book.id}
              to={`/books/${book.slug}`}
              className={`bn-story-book bn-story-book-${index + 1}`}
              style={{ transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg)` }}
              tabIndex={active === story.length - 1 ? 0 : -1}
              aria-label={`${book.title} by ${book.author}`}
            >
              <BookCover book={book} size="sm" />
            </Link>
          );
        })}

        <div className="bn-story-watermark" aria-hidden="true">BOOKNOMICS</div>
      </div>
    </section>
  );
}
