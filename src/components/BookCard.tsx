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

const coverPalettes = [
  ["#0f172a", "#1d4ed8", "#38bdf8"],
  ["#18181b", "#7c3aed", "#c084fc"],
  ["#1c1917", "#b45309", "#fbbf24"],
  ["#052e16", "#15803d", "#86efac"],
  ["#450a0a", "#b91c1c", "#fb7185"],
  ["#172554", "#4338ca", "#818cf8"],
  ["#083344", "#0e7490", "#67e8f9"],
  ["#3b0764", "#a21caf", "#f0abfc"],
  ["#292524", "#78716c", "#d6d3d1"],
  ["#422006", "#ca8a04", "#fde047"],
  ["#0c4a6e", "#0369a1", "#7dd3fc"],
  ["#312e81", "#6d28d9", "#c4b5fd"],
] as const;

const hashText = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const CustomBookCover = ({ book, size }: { book: BookCardData; size: "sm" | "md" | "lg" }) => {
  const seed = hashText(`${book.slug}|${book.title}|${book.author}`);
  const palette = coverPalettes[seed % coverPalettes.length];
  const pattern = seed % 4;
  const titleSize =
    book.title.length > 42
      ? "text-[13px] md:text-base"
      : book.title.length > 26
        ? "text-sm md:text-lg"
        : "text-base md:text-xl";

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-md text-white"
      style={{
        background: `
          radial-gradient(circle at 82% 16%, ${palette[2]}55 0 11%, transparent 12%),
          radial-gradient(circle at 18% 84%, ${palette[2]}33 0 18%, transparent 19%),
          linear-gradient(145deg, ${palette[0]} 0%, ${palette[1]} 72%, ${palette[0]} 100%)
        `,
      }}
    >
      <div className="absolute inset-0 opacity-30">
        {pattern === 0 && (
          <>
            <div className="absolute -right-8 top-1/4 h-36 w-36 rotate-12 border border-white/40" />
            <div className="absolute -right-2 top-1/3 h-24 w-24 rotate-12 border border-white/20" />
          </>
        )}
        {pattern === 1 && (
          <>
            <div className="absolute left-0 top-1/3 h-px w-full bg-white/45" />
            <div className="absolute left-0 top-[38%] h-px w-3/4 bg-white/20" />
            <div className="absolute left-0 top-[43%] h-px w-1/2 bg-white/15" />
          </>
        )}
        {pattern === 2 && (
          <>
            <div className="absolute -left-10 top-8 h-28 w-28 rounded-full border border-white/40" />
            <div className="absolute -left-2 top-20 h-20 w-20 rounded-full border border-white/20" />
          </>
        )}
        {pattern === 3 && (
          <>
            <div className="absolute right-5 top-6 h-24 w-1 rotate-12 bg-white/30" />
            <div className="absolute right-10 top-6 h-32 w-px rotate-12 bg-white/20" />
            <div className="absolute right-14 top-6 h-20 w-px rotate-12 bg-white/15" />
          </>
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/35" />
      <div className="relative z-10 flex h-full flex-col p-4 md:p-5">
        <div className="flex items-center justify-between gap-2 text-[8px] md:text-[9px] font-semibold tracking-[0.22em] uppercase text-white/75">
          <span className="truncate">{book.category}</span>
          <span>Booknomics</span>
        </div>

        <div className="my-auto">
          <div className="mb-3 h-px w-10 bg-white/70" />
          <div className={`font-serif font-bold leading-[1.08] tracking-tight drop-shadow-sm ${titleSize}`}>
            {book.title}
          </div>
        </div>

        <div>
          <div className="mb-2 h-px w-full bg-white/20" />
          <div className="text-[9px] md:text-[10px] font-medium tracking-wide text-white/80 line-clamp-2">
            {book.author}
          </div>
        </div>
      </div>
    </div>
  );
};

export const BookCover = ({ book, size = "md", priority = false }: { book: BookCardData; size?: "sm" | "md" | "lg"; priority?: boolean }) => {
  const sizes = {
    sm: "aspect-[2/3] text-xs",
    md: "aspect-[2/3]",
    lg: "aspect-[2/3] text-lg",
  };

  if (book.cover_url) {
    const url = book.cover_url;
    const isSupabase = /\/storage\/v1\/object\/public\//.test(url);
    const isGoogleBooks = /books\.google\.com|googleusercontent\.com/.test(url);
    const toRender = (w: number) => {
      if (isSupabase) {
        const h = Math.round(w * 1.5);
        return url.replace("/object/public/", "/render/image/public/") + `?width=${w}&height=${h}&resize=cover&quality=82&format=webp`;
      }
      if (isGoogleBooks) {
        return url.replace(/([?&])zoom=\d+/, "$1zoom=1").replace(/([?&])edge=curl/, "$1");
      }
      return url;
    };
    const w1 = size === "lg" ? 360 : size === "sm" ? 180 : 260;
    const w2 = w1 * 2;
    const h1 = Math.round(w1 * 1.5);
    return (
      <div className={`bn-book-card-cover ${sizes[size]} w-full rounded-md shadow-cover overflow-hidden relative bg-muted`}>
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
    <div className={`bn-book-card-cover ${sizes[size]} w-full rounded-md shadow-cover overflow-hidden relative bg-muted`}>
      <CustomBookCover book={book} size={size} />
    </div>
  );
};

export const BookCard = ({ book, priority = false }: { book: BookCardData; priority?: boolean }) => (
  <Link to={`/books/${book.slug}`} className="group block h-full">
    <div className="bn-book-card bg-card rounded-xl shadow-paper overflow-hidden transition-all duration-300 border border-border/50">
      <div className="p-3 md:p-5 pb-2 md:pb-3 relative">
        <span className="absolute top-2 left-2 md:top-3 md:left-3 z-10 max-w-[72%] truncate text-[9px] md:text-[10px] tracking-[0.15em] uppercase font-medium bg-background/90 backdrop-blur px-2 py-0.5 md:px-2.5 md:py-1 rounded-full border border-border">
          {book.category}
        </span>
        <BookCover book={book} size="md" priority={priority} />
      </div>
      <div className="px-3 md:px-5 pb-3 md:pb-5">
        <h3 className="bn-book-card-title font-serif text-sm md:text-lg font-semibold group-hover:text-primary transition-colors line-clamp-2">
          {book.title}
        </h3>
        <p className="text-xs md:text-sm text-muted-foreground mt-1 truncate">{book.author}</p>
        {book.tagline && (
          <p title={book.tagline} className="text-[11px] md:text-xs text-muted-foreground mt-1.5 md:mt-2 italic line-clamp-1">
            “{book.tagline}”
          </p>
        )}
        <div className="mt-3 flex items-center justify-between text-[10px] md:text-xs text-muted-foreground">
          <span>{book.reading_time ?? 12} min read</span>
          {book.rating ? <span aria-label={`${book.rating} rating`}>★ {Number(book.rating).toFixed(1)}</span> : null}
        </div>
      </div>
    </div>
  </Link>
);
