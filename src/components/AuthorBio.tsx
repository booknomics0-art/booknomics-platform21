import { BookOpen, ShieldCheck } from "lucide-react";

export const AuthorBio = ({ author, category }: { author: string; category: string }) => (
  <section className="mt-12 pt-8 border-t border-border" aria-labelledby="author-bio">
    <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">About the author & editor</div>
    <h2 id="author-bio" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-4">
      Written by {author} · Curated by Booknomics Editorial
    </h2>
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-card border border-border rounded-2xl p-5 shadow-paper">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Author</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong className="text-foreground">{author}</strong> is the author of this work in the
          {" "}<span className="lowercase">{category}</span> category. Booknomics summarizes the
          original book for educational use under fair use — we encourage readers to buy the full book.
        </p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 shadow-paper">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Curated by Booknomics Editorial</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This summary was researched, written, and fact-checked by the Booknomics editorial team —
          a group of writers and lifelong readers who specialise in distilling non-fiction into
          structured, actionable insights. Reviewed for accuracy before publishing.
        </p>
      </div>
    </div>
  </section>
);
