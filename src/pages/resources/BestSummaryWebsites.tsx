import { ResourceShell, H2, P } from "@/components/ResourceShell";

const CRITERIA = [
  { t: "Depth over volume", b: "A library of thousands of titles is useful only if a single guide gives you enough context to understand the argument, its evidence, and its weak points. Compare the depth of one title you already know well before paying." },
  { t: "An application layer", b: "Insight without retrieval or practice fades quickly. Look for exercises, notes, spaced repetition, reflection prompts, trackers, or a clear way to turn a summary into a decision." },
  { t: "Honest treatment of the original", b: "A good platform helps you decide when the summary is enough and when the full book is worth your time. Memoir, literary fiction, history, and technical books often lose the most when compressed." },
  { t: "Language quality", b: "If you read in more than one language, sample the same topic in each. A large translated catalogue is not automatically better than a smaller library written and edited for that language." },
  { t: "Audio and offline access", b: "If most of your learning happens during a commute or walk, audio quality and offline access can matter more than catalogue size." },
  { t: "A testable free tier or trial", b: "You should be able to judge the product before committing. Check what is genuinely free, how long a trial lasts, whether it auto-renews, and what the renewal price will be in your region." },
];

const PLATFORMS = [
  {
    name: "Blinkist",
    bestFor: "Breadth, polished audio, and quick nonfiction discovery",
    access: "Free Basic plan offers one hand-picked title per day; paid plans unlock the full library",
    depth: "Short read/listen format designed around roughly 15-minute learning",
    note: "Official 2026 materials advertise 9,000+ book and podcast summaries. Premium pricing and promotions can vary, so verify the checkout price in your region.",
  },
  {
    name: "Shortform",
    bestFor: "Readers who want deeper guides, context, and exercises",
    access: "Paid subscription with a trial; monthly and annual billing are offered",
    depth: "Longer analytical guides, audio narration, exercises, notes, PDF downloads, and topic guides",
    note: "Its official pricing page lists $24/month or $16.42/month when billed annually, alongside 10,000+ books covered. Prices can change.",
  },
  {
    name: "Headway",
    bestFor: "Habit-building, visual microlearning, and spaced repetition",
    access: "One pre-selected daily read/listen is available free; the annual plan can include a 7-day trial",
    depth: "15-minute summaries plus streaks, highlights, repetition, and guided learning features",
    note: "Headway says subscription pricing varies by region, store, and promotion, so the price shown at checkout is the one that matters.",
  },
  {
    name: "getAbstract",
    bestFor: "Business, leadership, workplace learning, and professional development",
    access: "Individual, student, team, and enterprise options; a short individual trial is available",
    depth: "Concise professional summaries with audio, offline access, downloads, and reading lists",
    note: "The official individual page currently lists $29.90 monthly or $299/year. Student and team offerings use different pricing.",
  },
  {
    name: "Booknomics",
    bestFor: "Free long-form reading, English + Hindi discovery, and practical application",
    access: "Public book summaries are free to read; optional product features may sit behind account or premium tools",
    depth: "Overview, key ideas, analysis, reflection, and action-oriented sections; coverage and assets vary by title",
    note: "Booknomics uses an editorial production workflow that can include software and AI-assisted drafting, translation, or enrichment, followed by quality and SEO checks.",
  },
];

const BestSummaryWebsites = () => (
  <ResourceShell
    path="/resources/best-book-summary-websites"
    title="Best Book Summary Websites & Apps (2026): 5 Compared | Booknomics"
    description="Compare Blinkist, Shortform, Headway, getAbstract and Booknomics by depth, free access, audio, learning tools and best use case. Updated for 2026."
    h1="Best Book Summary Websites and Apps in 2026"
    kicker="Independent-style buyer's guide · checked October 2026"
    lead="There is no single best summary app for every reader. Blinkist optimizes for breadth and fast audio learning, Shortform for deeper guides, Headway for habit-building, getAbstract for professional learning, and Booknomics for free bilingual long-form discovery. Use the comparison below to choose by the job you actually need done."
    faqs={[
      { q: "What is the best book summary app in 2026?", a: "It depends on the use case. Blinkist is strong for breadth and audio, Shortform for deeper analytical guides, Headway for habit-building and repetition, getAbstract for professional learning, and Booknomics for free English and Hindi reading with application sections." },
      { q: "Which book summary services have a free option?", a: "Blinkist and Headway both describe a free daily-title experience. Booknomics keeps public summaries free to read. Trial terms and regional offers change, so verify the current checkout page before starting a paid trial." },
      { q: "Are book summaries actually worth it?", a: "They are useful for deciding what to read, refreshing a book you finished, and extracting a book's central framework. They are weaker substitutes for memoir, narrative history, literary fiction, technical books, and any work where evidence or prose is the main value." },
      { q: "Is Shortform better than Blinkist?", a: "Shortform is usually the better fit if you want longer guides, exercises, and more context. Blinkist is usually the better fit if you want a much broader catalogue and fast read-or-listen discovery. Sample the same book on both before choosing." },
      { q: "Are there good Hindi book summary platforms?", a: "Hindi coverage is still less standardized than English. Check whether a service has dedicated Hindi pages, readable native-language prose, and titles from Hindi literature rather than only translated international nonfiction." },
    ]}
    related={[
      { path: "/resources/book-summary-template", label: "Book summary template" },
      { path: "/best-hindi-book-summaries", label: "Best Hindi book summaries" },
      { path: "/english", label: "English book summaries" },
      { path: "/about", label: "About Booknomics" },
      { path: "/resources", label: "All free resources" },
    ]}
  >
    <section>
      <H2>Quick comparison: which platform is best for what?</H2>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3">Platform</th>
              <th className="p-3">Best for</th>
              <th className="p-3">Free / trial access</th>
              <th className="p-3">Learning style</th>
            </tr>
          </thead>
          <tbody>
            {PLATFORMS.map((p) => (
              <tr key={p.name} className="border-t border-border align-top">
                <td className="p-3 font-semibold text-foreground">{p.name}</td>
                <td className="p-3 text-muted-foreground">{p.bestFor}</td>
                <td className="p-3 text-muted-foreground">{p.access}</td>
                <td className="p-3 text-muted-foreground">{p.depth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
        Facts and public plan information checked against provider pages in October 2026. Subscription prices,
        trials, regional offers, catalogue counts, and features can change; always confirm the final terms on the
        provider's current checkout page.
      </p>
    </section>

    <section>
      <H2>The five options, without pretending they are interchangeable</H2>
      <div className="space-y-4">
        {PLATFORMS.map((p) => (
          <div key={p.name} className="rounded-xl border border-border bg-card p-4 md:p-5">
            <h3 className="font-serif text-lg md:text-xl font-semibold mb-2">{p.name}: {p.bestFor}</h3>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-2">{p.depth}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{p.note}</p>
          </div>
        ))}
      </div>
    </section>

    <section>
      <H2>Six criteria that separate good platforms from busy ones</H2>
      <div className="space-y-3">
        {CRITERIA.map((c, i) => (
          <div key={c.t} className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-serif text-base md:text-lg font-semibold mb-1">
              <span className="text-primary mr-1.5">{i + 1}.</span>{c.t}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{c.b}</p>
          </div>
        ))}
      </div>
    </section>

    <section>
      <H2>When a summary is the right choice</H2>
      <P>
        Summaries work well for three jobs. First, triage: deciding which of forty recommended books deserves
        your next month. Second, recall: returning to a book you read years ago without re-reading three hundred
        pages. Third, single-framework books, where your immediate goal is to understand and test the central
        model before deciding whether the full text deserves more time.
      </P>
      <P>
        They work badly as replacements for memoirs, narrative history, literary fiction and technical books. In
        those cases the evidence, sequence, voice, examples, or worked detail may be the main value; compressing
        it removes the thing you came for.
      </P>
    </section>

    <section>
      <H2>How to run a fair five-minute test before paying</H2>
      <ol className="space-y-2 text-sm md:text-base text-muted-foreground leading-relaxed list-decimal pl-5">
        <li>Pick a book you have already read and know well.</li>
        <li>Open that title on two or three services rather than comparing different books.</li>
        <li>Check whether the summary preserves the author's argument, caveats, and counterexamples.</li>
        <li>Listen to five minutes of audio if audio will be your main use case.</li>
        <li>Try one note, exercise, highlight, or recall feature instead of only reading the landing page.</li>
        <li>Check the renewal price and cancellation terms before beginning any auto-renewing trial.</li>
      </ol>
    </section>

    <section>
      <H2>Questions to ask before you subscribe</H2>
      <ul className="space-y-2 text-sm md:text-base text-muted-foreground leading-relaxed list-disc pl-5">
        <li>Can I test a complete or representative summary before paying?</li>
        <li>Does the platform show enough context to distinguish the author's evidence from the summary writer's interpretation?</li>
        <li>Does each summary help me retrieve or apply the idea, or only consume it?</li>
        <li>Does the language I actually read in feel natural and editorially coherent?</li>
        <li>Do audio and offline features match where I will use the product?</li>
        <li>What will I pay after the introductory offer or trial ends?</li>
      </ul>
    </section>

    <section>
      <H2>How Booknomics approaches the problem</H2>
      <P>
        Booknomics keeps public summaries free to read and aims to connect explanation with application through
        key ideas, deeper analysis, reflection questions and action-oriented sections. The catalogue includes
        English and Hindi books, including Hindi literary titles that are often missing from international
        summary apps.
      </P>
      <P>
        Our production workflow can include software and AI-assisted drafting, formatting, translation, or
        enrichment. That is why quality checks matter more than claiming that every page was produced in one
        identical way. Lower-confidence pages can remain excluded from search indexing while they are improved,
        and a summary should never be presented as a replacement for the original book.
      </P>
    </section>
  </ResourceShell>
);

export default BestSummaryWebsites;
