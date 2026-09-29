import { ResourceShell, H2, P } from "@/components/ResourceShell";

const DAYS = [
  { d: "Day 1", t: "Name the one idea", b: "Write the book's single most useful idea in one sentence, in your own words. If you cannot, you have not finished reading it yet." },
  { d: "Day 2", t: "Pick the smallest action", b: "Choose one action so small it feels almost insulting — two minutes, one page, one call. Small enough that failure is embarrassing." },
  { d: "Day 3", t: "Attach it to something existing", b: "Tie the action to a habit you already have: after coffee, after logging in, before dinner. Cues beat willpower." },
  { d: "Day 4", t: "Remove one obstacle", b: "Identify the friction that will stop you tomorrow and delete it tonight — lay out the clothes, close the tab, silence the notification." },
  { d: "Day 5", t: "Do it badly on purpose", b: "Deliberately do a low-quality version. This kills perfectionism, which is the real reason most reading never becomes doing." },
  { d: "Day 6", t: "Tell one person", b: "Share the action and the result with someone who will ask about it. Social accountability is unglamorous and extremely effective." },
  { d: "Day 7", t: "Decide: keep, change, or drop", b: "Review the week honestly. Keep what worked, shrink what felt heavy, drop what was borrowed from someone else's life." },
];

const ReadingTracker = () => (
  <ResourceShell
    path="/resources/7-day-reading-action-tracker"
    title="Free 7-Day Reading Action Tracker (Printable) | Booknomics"
    description="A free 7-day reading action tracker that turns any book into seven small daily actions, with prompts, scoring and a weekly review. No sign-up needed."
    h1="Free 7-Day Reading Action Tracker"
    kicker="Free tool"
    lead="Finishing a book feels like progress. It usually is not. This tracker converts one book into seven days of specific, small actions — the shortest path from reading to actual change."
    faqs={[
      { q: "Is the 7-day reading action tracker really free?", a: "Yes. The full tracker, prompts and review questions are on this page and free to use, print or adapt. No account or payment is required." },
      { q: "Can I use one tracker for several books at once?", a: "It works best with a single book. Seven days of attention on one idea produces more change than seven shallow days across three books." },
      { q: "What if I miss a day?", a: "Continue on the next day rather than restarting. The tracker measures completed actions, not unbroken streaks — a 5-of-7 week is a successful week." },
      { q: "Does Booknomics have a digital version?", a: "Yes. Every book summary on Booknomics includes a habit tracker and reflection prompts built around this same seven-day structure." },
    ]}
    related={[
      { path: "/resources/book-summary-template", label: "Book summary template" },
      { path: "/category/productivity", label: "Productivity summaries" },
      { path: "/category/self-help", label: "Self-help summaries" },
      { path: "/books/atomic-habits", label: "Atomic Habits summary" },
      { path: "/resources", label: "All free resources" },
    ]}
  >
    <section>
      <H2>Why seven days</H2>
      <P>
        Seven days is long enough to see whether an idea fits your actual life, and short enough that you will
        not abandon it in week three. Thirty-day challenges fail for a boring reason: they ask for a commitment
        before you have any evidence the behaviour is worth committing to. A week gives you evidence.
      </P>
      <P>
        Use one book per tracker. Each day has a single job, and every job is deliberately smaller than you
        think it should be.
      </P>
    </section>

    <section>
      <H2>The 7-day tracker</H2>
      <ol className="space-y-3">
        {DAYS.map((day) => (
          <li key={day.d} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">{day.d}</span>
              <h3 className="font-serif text-base md:text-lg font-semibold">{day.t}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{day.b}</p>
          </li>
        ))}
      </ol>
    </section>

    <section>
      <H2>How to score each day</H2>
      <P>
        Give each day a mark out of three: 0 if nothing happened, 1 if you did a token version, 2 if you did the
        action as planned, 3 if you did it and it felt natural. Anything at 14 or above for the week means the
        habit is ready to continue without the tracker.
      </P>
      <P>
        Write one line of evidence next to each score — what actually happened, not how you felt about it. Vague
        notes ("went okay") make the weekly review useless.
      </P>
    </section>

    <section>
      <H2>The weekly review questions</H2>
      <ul className="space-y-2 text-sm md:text-base text-muted-foreground leading-relaxed list-disc pl-5">
        <li>Which day was hardest, and was the difficulty about time, energy or belief?</li>
        <li>What is the smallest version of this action I would still do on my worst week?</li>
        <li>Did this idea belong to me, or did I borrow it because the author was persuasive?</li>
        <li>What single sentence would I tell someone who is about to read this book?</li>
      </ul>
    </section>

    <section>
      <H2>Printing and sharing</H2>
      <P>
        Use your browser's print function on this page for a clean paper version. Teachers, coaches and book
        clubs are welcome to reproduce or adapt the tracker; a credit link back to Booknomics is appreciated.
      </P>
    </section>
  </ResourceShell>
);

export default ReadingTracker;
