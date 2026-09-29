import { ResourceShell, H2, P } from "@/components/ResourceShell";

const SECTIONS = [
  { t: "1. Book facts", b: "Title, author, year, category, pages, and how long it took you. Boring, but it makes your notes searchable a year later." },
  { t: "2. The one-sentence core idea", b: "The whole book compressed into a single sentence in your own words. If you need two sentences, you have not found the idea yet." },
  { t: "3. Five lessons that changed something", b: "Not five interesting points — five lessons that alter a decision, a habit or an opinion you held. Interesting is not the same as useful." },
  { t: "4. The argument in the author's terms", b: "Summarise the case the author is actually making, including the parts you dislike. Fair summaries are more useful than flattering ones." },
  { t: "5. Where you disagree", b: "Name at least one weak claim, missing counter-example or cultural assumption. A summary with no disagreement is usually a summary with no thought." },
  { t: "6. Quotes worth keeping", b: "Three at most, with page numbers. Quotes are evidence, not decoration — skip anything you cannot explain in your own words." },
  { t: "7. Actions for the next seven days", b: "One concrete action per day, each tied to an existing routine. This is the section that separates reading from changing." },
  { t: "8. Who should read the full book", b: "Say plainly who benefits from the original and who can stop at the summary. This is the most honest line in any summary." },
];

const SummaryTemplate = () => (
  <ResourceShell
    path="/resources/book-summary-template"
    title="Free Book Summary Template (8 Sections) | Booknomics"
    description="A free book summary template used by Booknomics: eight sections covering core idea, lessons, counter-arguments, quotes and a seven-day action plan."
    h1="Free Book Summary Template"
    kicker="Free template"
    lead="Most book notes are unusable within a month — highlights without structure. This eight-section template is the same skeleton every Booknomics summary is written on, and it works for any non-fiction title."
    faqs={[
      { q: "How long should a book summary be?", a: "Between 1,200 and 2,500 words for most non-fiction books. Shorter loses the argument; longer becomes a second book you will never re-read." },
      { q: "Is it legal to write and publish book summaries?", a: "Original summaries, analysis and commentary in your own words are generally treated as fair use for educational and editorial purposes. Reproducing substantial passages of the original text is not." },
      { q: "Should a summary include my own opinion?", a: "Yes. Section five exists precisely for disagreement. A summary that only agrees with the author adds nothing a blurb could not." },
      { q: "Can I use this template for fiction?", a: "Yes, with two swaps: replace the five lessons with themes and character arcs, and replace the action plan with what the story reveals about people." },
    ]}
    related={[
      { path: "/resources/7-day-reading-action-tracker", label: "7-day action tracker" },
      { path: "/resources/best-book-summary-websites", label: "Best summary websites" },
      { path: "/category/psychology", label: "Psychology summaries" },
      { path: "/blog", label: "Booknomics blog" },
      { path: "/resources", label: "All free resources" },
    ]}
  >
    <section>
      <H2>The eight sections</H2>
      <P>
        Work through the sections in order. The order matters: forcing the core idea into one sentence before
        listing lessons prevents the most common failure, which is a summary that is really just a table of
        contents with adjectives.
      </P>
      <ol className="space-y-3">
        {SECTIONS.map((s) => (
          <li key={s.t} className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-serif text-base md:text-lg font-semibold mb-1">{s.t}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.b}</p>
          </li>
        ))}
      </ol>
    </section>

    <section>
      <H2>Copy-paste version</H2>
      <pre className="rounded-xl border border-border bg-muted/50 p-4 text-xs md:text-sm leading-relaxed overflow-x-auto whitespace-pre-wrap">{`TITLE — AUTHOR (YEAR)
Category: | Pages: | Time to read:

CORE IDEA (one sentence):

FIVE LESSONS
1.
2.
3.
4.
5.

THE AUTHOR'S ARGUMENT (3-5 sentences):

WHERE I DISAGREE:

QUOTES (max 3, with page numbers):

7-DAY ACTION PLAN
Mon:
Tue:
Wed:
Thu:
Fri:
Sat:
Sun:

WHO SHOULD READ THE FULL BOOK:`}</pre>
    </section>

    <section>
      <H2>Three rules that keep summaries useful</H2>
      <P>
        <strong className="text-foreground">Write in your own words.</strong> Paraphrasing forces comprehension;
        copying only moves text between locations. It also keeps you on the right side of copyright.
      </P>
      <P>
        <strong className="text-foreground">Keep one summary per book.</strong> Update the same document as your
        understanding changes rather than starting new notes on a re-read.
      </P>
      <P>
        <strong className="text-foreground">End with an action, always.</strong> If you cannot name one thing to
        do differently, record that honestly — some books are entertainment, and pretending otherwise wastes
        your week.
      </P>
    </section>
  </ResourceShell>
);

export default SummaryTemplate;
