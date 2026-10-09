import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { PremiumMindmap } from "@/components/PremiumMindmap";
import type { MindmapBookInput } from "@/lib/mindmap/buildMindmap";
import { Button } from "@/components/ui/button";

/**
 * Internal preview for the premium interactive mind map (English v1).
 * Uses hand-written sample content — no database needed. Deliberately
 * excluded from search engines and site navigation.
 */

const SAMPLES: Array<{ id: string; label: string; book: MindmapBookInput }> = [
  {
    id: "business",
    label: "Business",
    book: {
      title: "The Compound Effect",
      author: "Darren Hardy",
      category: "Business",
      tagline: "Small choices, repeated daily, create extraordinary results over time.",
      overview:
        "Success is rarely a breakthrough moment. It is the quiet compounding of small smart choices made every day. Most people fail because they chase quick wins and quit during the boring middle. This book teaches you to track, own, and multiply your daily decisions until momentum takes over.",
      key_ideas: `### Compounding beats intensity
Small actions repeated daily outperform rare bursts of effort.

### Choices shape destiny
- **Track everything** — You cannot improve what you do not measure.
- **Own your decisions** — Total responsibility is the starting point of change.
- **Find your why** — Motivation follows a deep personal reason.
- **Guard your inputs** — What you read, watch, and hear programs you.
- **Environment wins** — Design your surroundings; willpower alone always leaks.`,
      deep_summary:
        "The book opens with the problem of invisible daily choices. It then introduces the compound effect formula with simple math. Stories of ordinary people show small habits growing into wealth and health. The middle chapters attack the myth of overnight success. Finally it gives a system of tracking, routines, and momentum to finish strong.",
      deep_analysis:
        "Hardy argues consistency is the unfair advantage because rivals quit during the boring middle. Because results lag effort, most people misread slow starts as failure. Tracking works therefore as an early warning system. The deepest claim is identity: you become the person your repeated choices describe.",
      daily_application:
        "- Write down three key behaviors to track every evening.\n- Remove one negative influence from your mornings.\n- Avoid skipping twice — one miss is human, two is a new habit.\n- Review your week every Sunday for ten minutes.",
      action_system:
        "1. Pick one habit that compounds toward your goal.\n2. Define the smallest daily version.\n3. Track it visibly for 30 days.\n4. Adjust the environment, not just your willpower.",
      practice_tracker: "- Day 1–7: track without judging\n- Day 8–21: tighten the routine\n- Day 22–30: review and lock the system",
      real_life_example:
        "A sales manager tracked every expense and call for ninety days. Because the numbers were visible, small leaks closed and income rose steadily.",
      reading_time: 14,
    },
  },
  {
    id: "psychology",
    label: "Psychology",
    book: {
      title: "Thinking in Bets",
      author: "Annie Duke",
      category: "Psychology",
      tagline: "Better decisions come from treating beliefs as bets, not certainties.",
      overview:
        "We judge decisions by outcomes, but luck hides the truth. A former poker champion shows how to separate skill from chance, update beliefs honestly, and decide well under uncertainty. The core shift is humility: hold every belief with a probability, not a verdict.",
      key_ideas: `### Resulting is the trap
Judging a decision by its outcome ignores the role of luck.

### Beliefs are bets
- **Say “I’m 70% sure”** — Numbers force honesty about uncertainty.
- **Update in public** — Truth-seeking groups beat solo ego.
- **Pre-mortems work** — Imagine failure first, then prevent it.
- **Separate self from belief** — Changing your mind is winning, not losing.`,
      deep_summary:
        "Duke opens at the poker table, where good decisions lose daily. She introduces resulting: our habit of equating results with quality. The middle builds the betting mindset with experiments and stories. Then comes the toolkit: belief calibration, decision groups, and time-travel techniques. It closes with a challenge to practice uncertainty in one real decision.",
      deep_analysis:
        "The book argues ego is the enemy of calibration because admitting doubt feels like weakness. Because memory rewrites history, written records beat recollection. Groups help therefore only when dissent is explicitly rewarded. The deepest move is identity: become someone who gets it right eventually, not someone who is right now.",
      daily_application:
        "- Add a probability to your next three opinions.\n- Keep a one-line decision journal.\n- Avoid defending a belief you would not bet on.\n- Ask a friend to argue the other side weekly.",
      action_system:
        "1. State the decision and your confidence level.\n2. List what would change your mind.\n3. Consult one disagreeing voice.\n4. Record the outcome and review monthly.",
      real_life_example:
        "A founder ran a pre-mortem before launching. Because the team named failure modes early, they fixed pricing and survived the first quarter.",
      reading_time: 12,
    },
  },
  {
    id: "fantasy",
    label: "Fantasy",
    book: {
      title: "The Ember Crown",
      author: "A. R. Sampleton",
      category: "Fantasy",
      tagline: "A mapmaker inherits a burning crown — and every road out of the fire.",
      overview:
        "When mapmaker Sella Voss inherits a crown that burns its bearer, she must chart a road through warring realms to unmake it. Allies gather and betray in turn, and each map she draws redraws her. It is a story about the price of power and the maps we inherit from our parents.",
      key_ideas: `### Power demands a price
Every use of the crown's fire costs Sella a memory she loves.

### Maps are promises
- **The ink road** — A charted path binds the traveler to finish it.
- **The hollow atlas** — Some pages show only what the reader fears.
- **Oaths as borders** — Promises redraw the map of who you are.`,
      deep_summary:
        "Sella inherits the ember crown at her mother's funeral. She flees the capital with a disgraced knight and a smuggler. Betrayal at the river city forces her to burn the bridge — and her childhood memories. In the hollow mountain she learns the crown was made from her own lineage. She unmakes it by mapping the one road home she swore never to take.",
      deep_analysis:
        "The novel argues inheritance is a map we mistake for destiny. Because Sella draws to understand, each chapter reframes power as cartography. The knight's arc therefore mirrors hers: loyalty redrawn as choice. The deepest theme is memory — what we keep versus what we pay to become.",
      daily_application:
        "- Name one inherited belief you still follow.\n- Draw your own map: where are you actually headed?\n- Avoid confusing comfort with home.\n- Pay one small price deliberately this week.",
      real_life_example:
        "Readers often start a 'memory ledger' after this book — because naming what matters makes sacrifice a choice, not an accident.",
      reading_time: 16,
    },
  },
];

const GENRE_PREVIEW = [
  "Business",
  "Psychology",
  "Self-Help",
  "Mystery & Thriller",
  "Romance",
  "Fantasy",
  "Science Fiction",
  "History",
  "Biography",
  "Philosophy",
  "Productivity",
  "Leadership",
];

const MindmapDemo = () => {
  const [sampleId, setSampleId] = useState("business");
  const [genreOverride, setGenreOverride] = useState<string | null>(null);
  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0];
  const book = useMemo<MindmapBookInput>(
    () => (genreOverride ? { ...sample.book, category: genreOverride } : sample.book),
    [sample, genreOverride],
  );

  return (
    <Layout>
      <SEO
        title="Mindmap Preview (internal) | Booknomics"
        description="Internal preview of the premium interactive mind map."
        path="/mindmap-demo"
        noindex
      />
      <div className="bg-hero border-b border-border">
        <div className="container py-8 md:py-12">
          <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-2">Internal preview</div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold tracking-tight">Premium Mindmap</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            English-first rollout. Pick a sample book, then switch genres to preview all 12 visual identities. Nothing
            here is linked from the site or indexed by search engines.
          </p>
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Sample book">
            {SAMPLES.map((s) => (
              <Button
                key={s.id}
                size="sm"
                variant={s.id === sampleId ? "default" : "outline"}
                className="rounded-full"
                onClick={() => {
                  setSampleId(s.id);
                  setGenreOverride(null);
                }}
              >
                {s.label} sample
              </Button>
            ))}
          </div>
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Preview genre theme{genreOverride ? `: ${genreOverride}` : " (from sample)"}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Genre theme">
              <Button
                size="sm"
                variant={genreOverride === null ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setGenreOverride(null)}
              >
                Auto
              </Button>
              {GENRE_PREVIEW.map((genre) => (
                <Button
                  key={genre}
                  size="sm"
                  variant={genreOverride === genre ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setGenreOverride(genre)}
                >
                  {genre}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="container py-8 md:py-10">
        <div className="mx-auto max-w-5xl">
          <PremiumMindmap key={`${sampleId}-${genreOverride ?? "auto"}`} book={book} />
        </div>
      </div>
    </Layout>
  );
};

export default MindmapDemo;
