import { ResourceShell, H2, P } from "@/components/ResourceShell";

const CRITERIA = [
  { t: "Depth over volume", b: "A library of 5,000 four-hundred-word summaries is a search index, not a learning tool. Ask whether a single summary is enough to hold an argument, including its weak points." },
  { t: "An application layer", b: "Insight without a mechanism for practice evaporates within a week. Look for action plans, trackers, reflection prompts or exercises attached to each title." },
  { t: "Honest treatment of the original", b: "Good platforms tell you when to buy the full book. Platforms that imply the summary replaces every book are selling convenience, not understanding." },
  { t: "Language coverage that is native, not translated", b: "Machine-translated Hindi reads as machine-translated Hindi. Summaries written for Indian readers, with local examples, land very differently." },
  { t: "Audio and offline access", b: "Commutes and walks are where most reading time actually exists. Audio summaries and offline access change how much you get through in a month." },
  { t: "A transparent free tier", b: "You should be able to read a complete summary before paying anything. Paywalls that hide the entire product make quality impossible to judge." },
];

const BestSummaryWebsites = () => (
  <ResourceShell
    path="/resources/best-book-summary-websites"
    title="Best Book Summary Websites & Apps: How to Choose (2026) | Booknomics"
    description="A practical guide to choosing among book summary websites and apps — the six criteria that matter, when summaries help, and when to read the full book instead."
    h1="Best Book Summary Websites and Apps: How to Choose"
    kicker="Buyer's guide"
    lead="Every summary platform claims the same thing: the big ideas of any book in fifteen minutes. Here is how to judge them properly, from a team that writes summaries for a living and has no interest in pretending they replace books."
    faqs={[
      { q: "Are book summaries actually worth it?", a: "For deciding what to read, refreshing a book you finished, and books whose argument fits in a chapter, yes. For books whose value is in the narrative, the evidence or the writing itself, a summary is a poor substitute." },
      { q: "What is the best free book summary website?", a: "Judge free platforms by whether a complete summary is readable without payment. Booknomics keeps every summary free to read and charges only for the application tools — trackers, notes and downloads." },
      { q: "Do book summaries help you remember books better?", a: "Only when paired with retrieval and action. Reading a summary once produces recognition, not recall; writing your own notes and acting on one idea produces retention." },
      { q: "Are there good Hindi book summary platforms?", a: "Genuinely native Hindi coverage remains rare — most platforms machine-translate English summaries. Booknomics writes Hindi summaries for Hindi readers, including Indian classics and scripture." },
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
        pages. Third, single-idea books — the ones where a well-argued chapter was expanded to meet a publisher's
        page count.
      </P>
      <P>
        They work badly for memoirs, narrative history, literary fiction and technical books. In those, the
        detail <em>is</em> the value; compressing it removes the thing you came for.
      </P>
    </section>

    <section>
      <H2>Questions to ask before you subscribe</H2>
      <ul className="space-y-2 text-sm md:text-base text-muted-foreground leading-relaxed list-disc pl-5">
        <li>Can I read one complete summary, end to end, before paying?</li>
        <li>Who writes the summaries, and does anyone edit them?</li>
        <li>Does each summary tell me what to do this week, or only what the author thinks?</li>
        <li>Is the catalogue current, or is it the same 300 titles every platform lists?</li>
        <li>If I cancel, do my notes and highlights leave with me?</li>
      </ul>
    </section>

    <section>
      <H2>How Booknomics approaches it</H2>
      <P>
        We keep every summary free to read, write in long form rather than bullet-point form, and attach an
        action system, reflection questions and a habit tracker to each title. Hindi summaries are written
        natively, not translated. Premium exists for the application tools — personal notes, trackers and
        downloads — never to unlock the ideas themselves.
      </P>
      <P>
        We also say plainly when a book deserves to be read in full, and link to the original edition so authors
        get paid. A summary platform that never sends you to a bookshop is not being honest with you.
      </P>
    </section>
  </ResourceShell>
);

export default BestSummaryWebsites;
