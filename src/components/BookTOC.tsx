import { List } from "lucide-react";

interface Props {
  isHindi: boolean;
  hasRelated: boolean;
  hasMoreInLang: boolean;
}

/** Compact in-page Table of Contents with smooth-scroll jump links. */
export function BookTOC({ isHindi, hasRelated, hasMoreInLang }: Props) {
  const items: Array<{ id: string; label: string }> = [
    { id: "book-tabs", label: isHindi ? "सारांश और एक्शन प्लान" : "Summary & action plan" },
    { id: "book-mindmap", label: isHindi ? "माइंडमैप" : "Mindmap" },
    { id: "ai-summary", label: isHindi ? "इस पेज के बारे में" : "About this page" },
    ...(hasRelated ? [{ id: "related-books", label: isHindi ? "संबंधित किताबें" : "Related books" }] : []),
    ...(hasMoreInLang ? [{ id: "same-lang-books", label: isHindi ? "और किताबें" : "More books" }] : []),
    { id: "faq", label: isHindi ? "अक्सर पूछे जाने वाले प्रश्न" : "FAQ" },
  ];

  return (
    <nav
      aria-label={isHindi ? "इस पेज पर" : "On this page"}
      className="mb-6 rounded-2xl border border-border bg-card p-4"
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        <List className="h-3.5 w-3.5" />
        {isHindi ? "इस पेज पर" : "On this page"}
      </div>
      <ol className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        {items.map((it, i) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className="block rounded-md px-2 py-1 text-foreground/80 hover:bg-muted hover:text-primary transition"
            >
              <span className="text-muted-foreground mr-2 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
