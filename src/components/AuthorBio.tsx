import { BookOpen, ShieldCheck } from "lucide-react";

export const AuthorBio = ({ author, category }: { author: string; category: string }) => (
  <section className="mt-12 pt-8 border-t border-border" aria-labelledby="author-bio">
    <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">About the original work & this guide</div>
    <h2 id="author-bio" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-4">
      Original book by {author} · Summary & learning guide by Booknomics
    </h2>
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-card border border-border rounded-2xl p-5 shadow-paper">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Original book author</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong className="text-foreground">{author}</strong> is the author of the original work in the
          {" "}<span className="lowercase">{category}</span> category. This Booknomics page is an independent
          summary and learning guide; it is not presented as text written or endorsed by the original author.
          We encourage readers to consult or buy the full book for its complete context and nuance.
        </p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 shadow-paper">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">How this guide is produced</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Booknomics uses an editorial production workflow that can include software and AI-assisted drafting,
          formatting, translation, or enrichment. The workflow includes content-quality and SEO checks, and
          lower-confidence pages can remain excluded from search indexing while they are improved. The goal is
          to add useful explanation, practical application, and learning structure rather than replace the book.
        </p>
      </div>
    </div>
  </section>
);
