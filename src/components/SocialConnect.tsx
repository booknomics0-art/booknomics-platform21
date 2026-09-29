import { SOCIAL_LINKS, SOCIAL_REL, withUtm } from "@/config/social";
import { SocialIcon } from "./SocialIcon";

export const SocialConnect = () => {
  return (
    <section className="container py-10 md:py-16" aria-labelledby="connect-booknomics">
      <div className="max-w-3xl mx-auto text-center mb-6 md:mb-10">
        <div className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2 md:mb-3">
          Community
        </div>
        <h2 id="connect-booknomics" className="font-serif text-2xl md:text-4xl font-bold tracking-tight mb-3">
          Connect with Booknomics
        </h2>
        <p className="text-sm md:text-base text-muted-foreground">
          Follow us on your favourite platform for book summaries, business insights, finance lessons, and powerful ideas.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {SOCIAL_LINKS.map((s) => (
          <a
            key={s.platform}
            href={withUtm(s.url, "homepage_social_section")}
            target="_blank"
            rel={SOCIAL_REL}
            aria-label={s.ariaLabel}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary hover:shadow-paper transition-all"
          >
            <span className="grid place-items-center h-10 w-10 rounded-lg bg-muted text-foreground/80 group-hover:bg-gold group-hover:text-primary-foreground transition-colors">
              <SocialIcon platform={s.platform} className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-serif text-sm md:text-base font-semibold truncate">{s.name}</span>
              <span className="block text-xs text-muted-foreground truncate">{s.description}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
};
