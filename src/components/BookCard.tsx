import { Link } from "react-router-dom";

export interface BookCardData {
  id: string;
  slug: string;
  title: string;
  author: string;
  category: string;
  cover_color: string;
  cover_url?: string | null;
  tagline: string | null;
  rating: number | null;
  reading_time: number | null;
}

export const BookCover = ({ book, size = "md", priority = false }: { book: BookCardData; size?: "sm" | "md" | "lg"; priority?: boolean }) => {
  const sizes = {
    sm: "aspect-[2/3] text-xs",
    md: "aspect-[2/3]",
    lg: "aspect-[2/3] text-lg",
  };
  const padSizes = { sm: "p-3", md: "p-5", lg: "p-8" };

  if (book.cover_url) {
    const url = book.cover_url;
    const isSupabase = /\/storage\/v1\/object\/public\//.test(url);
    const isGoogleBooks = /books\.google\.com|googleusercontent\.com/.test(url);
    const toRender = (w: number) => {
      if (isSupabase) {
        const h = Math.round(w * 1.5);
        return url.replace("/object/public/", "/render/image/public/") + `?width=${w}&height=${h}&resize=cover&quality=78&format=webp`;
      }
      if (isGoogleBooks) {
        return url.replace(/([?&])zoom=\d+/, "$1zoom=1").replace(/([?&])edge=curl/, "$1");
      }
      return url;
    };
    const w1 = size === "lg" ? 320 : size === "sm" ? 160 : 240;
    const w2 = w1 * 2;
    const h1 = Math.round(w1 * 1.5);
    return (
      <div className={`${sizes[size]} w-full rounded-md shadow-cover overflow-hidden relative bg-muted`}>
        <img
          src={toRender(w1)}
          srcSet={isSupabase ? `${toRender(w1)} 1x, ${toRender(w2)} 2x` : undefined}
          sizes={`(max-width: 768px) 45vw, ${w1}px`}
          width={w1}
          height={h1}
          alt={`${book.title} book summary cover by ${book.author} - Booknomics`}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding={priority ? "sync" : "async"}
          className="absolute inset-0 h-full w-full object-contain object-center bg-muted"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div className={`cover-${book.cover_color} rounded-md shadow-cover relative overflow-hidden flex flex-col justify-between ${sizes[size]} ${padSizes[size]}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
      <div className="absolute inset-y-0 left-0 w-px bg-black/20" />
      <div className="font-serif font-bold leading-tight tracking-tight" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.25)" }}>
        {book.title}
      </div>
      <div className="text-[10px] tracking-[0.2em] uppercase opacity-80">
        {book.author}
      </div>
    </div>
  );
};

export const BookCard = ({ book, priority = false }: { book: BookCardData; priority?: boolean }) => (
  <Link to={`/books/${book.slug}`} className="group block">
    <div className="bg-card rounded-xl shadow-paper overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-cover border border-border/50">
      <div className="p-3 md:p-5 pb-2 md:pb-3 relative">
        <span className="absolute top-2 left-2 md:top-3 md:left-3 z-10 text-[9px] md:text-[10px] tracking-[0.15em] uppercase font-medium bg-background/90 backdrop-blur px-2 py-0.5 md:px-2.5 md:py-1 rounded-full border border-border">
          {book.category}
        </span>
        <BookCover book={book} size="md" priority={priority} />
      </div>
      <div className="px-3 md:px-5 pb-3 md:pb-5">
        <h3 className="font-serif text-sm md:text-lg font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {book.title}
        </h3>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{book.author}</p>
        {book.tagline && (
          <p className="hidden md:block text-xs text-muted-foreground mt-2 italic line-clamp-2">"{book.tagline}"</p>
        )}
        <div className="hidden md:flex items-center gap-3 mt-3 text-xs text-muted-foreground">
          <span>{book.reading_time ?? 12} min read</span>
        </div>
        <div className="flex md:hidden items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
          <span>{book.reading_time ?? 12} min</span>
        </div>
      </div>
    </div>
  </Link>
);
