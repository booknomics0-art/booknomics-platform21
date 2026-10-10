/**
 * Premium mind-map content engine (English, v1).
 *
 * Builds a 7–9 branch knowledge map purely from a book's existing summary
 * fields. No AI calls, no hallucinated facts: every node is either
 * transformed source text or a clearly-generic reading lens.
 */

import { isFictionCategory, resolveGenreKey, type MindmapGenreKey } from "./genreThemes";

export interface MindmapBookInput {
  title: string;
  author: string;
  category?: string | null;
  tagline?: string | null;
  overview?: string | null;
  deep_summary?: string | null;
  key_ideas?: string | null;
  deep_analysis?: string | null;
  daily_application?: string | null;
  action_system?: string | null;
  practice_tracker?: string | null;
  reflection_questions?: string | null;
  real_life_example?: string | null;
  reading_time?: number | null;
}

export type MindmapCalloutKind =
  | "why"
  | "insight"
  | "action"
  | "remember"
  | "example"
  | "connection";

export interface MindmapCallout {
  kind: MindmapCalloutKind;
  title: string;
  text: string;
}

export interface MindmapNode {
  /** Short label: 2–12 words. */
  label: string;
  /** Optional one-line explanation (slightly longer, important nodes only). */
  detail?: string;
  /** Small tag chip, e.g. "Example", "Connection", "Action". */
  tag?: string;
  /** Cause → effect rendering. */
  cause?: string;
  effect?: string;
  /** Sequence number for story arcs. */
  step?: string;
}

export type MindmapBranchId =
  | "core"
  | "concepts"
  | "story"
  | "people"
  | "themes"
  | "lessons"
  | "apply"
  | "moments";

export interface MindmapBranch {
  id: MindmapBranchId;
  title: string;
  /** Reader question this branch answers. */
  question: string;
  icon: string;
  nodes: MindmapNode[];
  callout?: MindmapCallout;
}

export interface MindmapData {
  title: string;
  author: string;
  category: string;
  genreKey: MindmapGenreKey;
  isFiction: boolean;
  oneLiner: string;
  whyItMatters: string;
  branches: MindmapBranch[];
  recall: {
    takeaways: string[];
    oneLine: string;
    best: string;
  };
}

/* ------------------------------------------------------------------ */
/* Text utilities                                                      */
/* ------------------------------------------------------------------ */

export const toText = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\\n/g, "\n") : "";

const stripMd = (s: string): string =>
  toText(s)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/[ \t]+/g, " ")
    .trim();

const wordsOf = (s: string): string[] => s.split(/\s+/).filter(Boolean);

const normalizeKey = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = normalizeKey(line).slice(0, 80);
    if (!key || key.length < 8 || seen.has(key)) continue;
    seen.add(key);
    out.push(line.trim());
  }
  return out;
}

const BOILERPLATE =
  /^(here (is|are)|in this (section|chapter|summary)|below (is|are)|let's|welcome|today we)/i;

export function splitSentences(raw: string): string[] {
  const clean = stripMd(raw).replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  return clean
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.replace(/[.।]+$/, "").trim())
    .filter((s) => {
      const n = wordsOf(s).length;
      return n >= 5 && n <= 42 && !BOILERPLATE.test(s);
    });
}

/** Markdown bullets / numbered lists → clean lines. */
export function extractBullets(raw: string): string[] {
  const lines = toText(raw).split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*(?:[-*•◦▪]|(?:\d{1,2}[.)]))\s+(.+?)\s*$/);
    if (m) {
      const clean = stripMd(m[1]);
      if (wordsOf(clean).length >= 2 && clean.length <= 320) out.push(clean);
    }
  }
  return dedupeLines(out);
}

/** Headings (### / standalone bold lines) → short concept labels. */
export function extractHeadings(raw: string): string[] {
  const lines = toText(raw).split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const h = line.match(/^\s*#{2,4}\s+(.+?)\s*$/) || line.match(/^\s*\*\*([^*\n]{3,90})\*\*\s*$/);
    if (h) {
      const clean = stripMd(h[1]).replace(/[:.]+$/, "").trim();
      const n = wordsOf(clean).length;
      if (n >= 2 && n <= 12) out.push(clean);
    }
  }
  return dedupeLines(out);
}

/** Split "Label — explanation" / "Label: explanation" pairs. */
function splitPair(line: string): { label: string; detail: string } | null {
  const m = line.match(/^(.{3,70}?)\s*[—–:]\s*(.{12,260})$/);
  if (!m) return null;
  const label = stripMd(m[1]).replace(/[.]+$/, "").trim();
  const detail = stripMd(m[2]).trim();
  if (wordsOf(label).length > 12 || wordsOf(label).length < 1) return null;
  return { label, detail };
}

export function shortenLabel(s: string, maxWords = 12): string {
  const words = wordsOf(stripMd(s).replace(/[.।:;]+$/, ""));
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}…`;
}

export function shortenDetail(s: string, maxWords = 24): string {
  const words = wordsOf(stripMd(s).replace(/[.।]+$/, ""));
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}…`;
}

const sentenceCase = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Prefer sentences carrying signal: verbs, concrete nouns, moderate length. */
function scoreSentence(s: string): number {
  const n = wordsOf(s).length;
  if (n < 6) return -10;
  let score = 12 - Math.abs(n - 16) * 0.5;
  if (/\b(you|your)\b/i.test(s)) score += 1.5;
  if (/\b(because|therefore|means|creates|builds|changes|requires|starts with)\b/i.test(s)) score += 2;
  if (/\b(always|never|secret|key|most important|ultimately)\b/i.test(s)) score += 1;
  if (/^(it|this|that|they|there)\b/i.test(s)) score -= 1.5;
  return score;
}

function bestSentences(text: string, count: number, minWords = 7, maxWords = 30): string[] {
  return splitSentences(text)
    .filter((s) => {
      const n = wordsOf(s).length;
      return n >= minWords && n <= maxWords;
    })
    .map((s) => ({ s, score: scoreSentence(s) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}

/* ------------------------------------------------------------------ */
/* Branch builders                                                     */
/* ------------------------------------------------------------------ */

type Sources = Required<
  Pick<
    MindmapBookInput,
    | "overview"
    | "deep_summary"
    | "key_ideas"
    | "deep_analysis"
    | "daily_application"
    | "action_system"
    | "practice_tracker"
    | "real_life_example"
  >
>;

const asSources = (book: MindmapBookInput): Sources =>
  ({
    overview: toText(book.overview),
    deep_summary: toText(book.deep_summary),
    key_ideas: toText(book.key_ideas),
    deep_analysis: toText(book.deep_analysis),
    daily_application: toText(book.daily_application),
    action_system: toText(book.action_system),
    practice_tracker: toText(book.practice_tracker),
    real_life_example: toText(book.real_life_example),
  }) as Sources;

function buildCoreIdea(book: MindmapBookInput, src: Sources): MindmapBranch {
  const nodes: MindmapNode[] = [];
  const overviewBest = bestSentences(src.overview, 3);
  const analysisBest = bestSentences(src.deep_analysis, 4);

  const mainMessage =
    (book.tagline && wordsOf(toText(book.tagline)).length >= 4
      ? stripMd(toText(book.tagline))
      : overviewBest[0]) || "";
  if (mainMessage) {
    nodes.push({
      label: shortenLabel(mainMessage),
      detail: wordsOf(mainMessage).length > 12 ? shortenDetail(mainMessage) : undefined,
      tag: "Main message",
    });
  }

  const problem =
    [...splitSentences(src.overview), ...analysisBest].find((s) =>
      /\b(problem|struggle|challenge|difficult|fear|failure|mistake|trap|stuck|anxiet|stress|conflict|crisis)\b/i.test(
        s,
      ),
    ) || "";
  if (problem) nodes.push({ label: shortenLabel(problem), tag: "Central problem" });

  const teaches =
    overviewBest.find((s) => s !== mainMessage && /\b(teach|show|argue|prove|reveal|help|guide)\b/i.test(s)) ||
    overviewBest[1] ||
    analysisBest[0] ||
    "";
  if (teaches && normalizeKey(teaches) !== normalizeKey(mainMessage)) {
    nodes.push({ label: shortenLabel(teaches), tag: "Ultimate teaching" });
  }

  if (nodes.length === 0) {
    nodes.push(
      { label: `What ${book.author} most wants you to understand`, tag: "Main message" },
      { label: "The problem this book solves for its reader", tag: "Central problem" },
      { label: "The one shift to carry into daily life", tag: "Ultimate teaching" },
    );
  }

  return {
    id: "core",
    title: "Core Idea",
    question: "What is this book really about?",
    icon: "target",
    nodes: nodes.slice(0, 4),
    callout: {
      kind: "why",
      title: "Why It Matters",
      text:
        shortenDetail(
          overviewBest.find((s) => /\b(you|your|life|work|everyday|daily)\b/i.test(s)) ||
            teaches ||
            mainMessage ||
            `Read this branch first — it frames everything else in ${book.title}.`,
          22,
        ),
    },
  };
}

function buildConcepts(book: MindmapBookInput, src: Sources): MindmapBranch {
  const nodes: MindmapNode[] = [];
  const seen = new Set<string>();

  const push = (label: string, detail?: string) => {
    const key = normalizeKey(label).slice(0, 60);
    if (!label || seen.has(key) || wordsOf(label).length < 2) return;
    seen.add(key);
    nodes.push(detail ? { label: shortenLabel(label, 10), detail: shortenDetail(detail) } : { label: shortenLabel(label) });
  };

  // 1) "Concept — explanation" bullets carry the richest signal.
  for (const line of [...extractBullets(src.key_ideas), ...extractBullets(src.deep_analysis)]) {
    if (nodes.length >= 7) break;
    const pair = splitPair(line);
    if (pair) push(pair.label, pair.detail);
  }
  // 2) Headings + their first following sentence.
  const keyIdeasText = stripMd(src.key_ideas);
  for (const heading of extractHeadings(src.key_ideas)) {
    if (nodes.length >= 7) break;
    const idx = keyIdeasText.indexOf(heading);
    const after = idx >= 0 ? keyIdeasText.slice(idx + heading.length, idx + heading.length + 400) : "";
    const first = splitSentences(after).find((s) => wordsOf(s).length >= 6 && wordsOf(s).length <= 30);
    push(heading, first);
  }
  // 3) Plain strong bullets.
  for (const line of extractBullets(src.key_ideas)) {
    if (nodes.length >= 6) break;
    if (!splitPair(line) && wordsOf(line).length <= 26) push(line);
  }
  // 4) Fallback: best sentences from analysis.
  for (const s of bestSentences(src.deep_analysis, 8)) {
    if (nodes.length >= 5) break;
    push(s);
  }

  if (nodes.length < 3) {
    const generic = genericConceptLenses(book);
    for (const lens of generic) {
      if (nodes.length >= 5) break;
      push(lens);
    }
  }

  const strongest = nodes[0];
  return {
    id: "concepts",
    title: "Key Concepts",
    question: "What are the big ideas?",
    icon: "lightbulb",
    nodes: nodes.slice(0, 7),
    callout: strongest
      ? { kind: "insight", title: "Key Insight", text: shortenDetail(strongest.detail || strongest.label, 24) }
      : undefined,
  };
}

function buildStory(book: MindmapBookInput, src: Sources, isFiction: boolean): MindmapBranch {
  const steps = isFiction
    ? (["Beginning", "Development", "Turning point", "Climax", "Resolution"] as const)
    : (["Starting point", "Core framework", "Evidence", "Method", "Payoff"] as const);
  const sentences = dedupeLines([
    ...splitSentences(src.deep_summary),
    ...bestSentences(src.deep_analysis, 6),
  ]);

  const nodes: MindmapNode[] = [];
  if (sentences.length >= 3) {
    const per = Math.max(1, Math.floor(sentences.length / steps.length));
    steps.forEach((step, i) => {
      const pick = sentences[Math.min(sentences.length - 1, i * per)] || sentences[i];
      if (pick) nodes.push({ step, label: shortenLabel(pick) });
    });
  }

  if (nodes.length === 0) {
    const fallback = isFiction
      ? [
          "A world and want are established",
          "Pressure rises through choices and costs",
          "One decision changes everything",
          "The truth is faced at full cost",
          "A new balance — changed or broken",
        ]
      : [
          "The problem is named clearly",
          "A framework reframes the problem",
          "Stories and evidence make it stick",
          "A method turns insight into action",
          "The payoff compounds over time",
        ];
    fallback.forEach((label, i) => nodes.push({ step: steps[i], label }));
  }

  // Cause → effect: surface one explicit link when detectable.
  const causal = sentences.find((s) =>
    /\b(because|led to|leads to|resulted in|therefore|so that|when .+,)\b/i.test(s),
  );
  const causeEffect: MindmapCallout | undefined = causal
    ? { kind: "connection", title: "Connection", text: `Cause → effect: ${shortenDetail(causal, 22)}` }
    : {
        kind: "connection",
        title: "Connection",
        text: isFiction
          ? "Follow the chain: want → obstacle → choice → consequence."
          : "Follow the chain: problem → principle → practice → payoff.",
      };

  return {
    id: "story",
    title: isFiction ? "Story Arc" : "Structure",
    question: isFiction ? "How does the story unfold?" : "How is the argument built?",
    icon: "bookOpen",
    nodes: nodes.slice(0, 5),
    callout: causeEffect,
  };
}

function buildPeople(book: MindmapBookInput, src: Sources, isFiction: boolean): MindmapBranch {
  const nodes: MindmapNode[] = [];
  const seen = new Set<string>();
  const push = (label: string, detail?: string) => {
    const key = normalizeKey(label).slice(0, 50);
    if (!label || seen.has(key)) return;
    seen.add(key);
    nodes.push(detail ? { label: shortenLabel(label, 8), detail: shortenDetail(detail, 20) } : { label: shortenLabel(label) });
  };

  const pool = [...extractBullets(src.deep_analysis), ...extractBullets(src.key_ideas), ...extractBullets(src.deep_summary)];
  // "Name — role / motivation" shaped lines.
  for (const line of pool) {
    if (nodes.length >= 6) break;
    const pair = splitPair(line);
    if (!pair) continue;
    const looksLikePerson =
      /^[A-Z][a-zA-Z.'-]*(?:\s+[A-Z][a-zA-Z.'-]*){0,2}$/.test(pair.label.trim()) &&
      /\b(want|fear|seek|drive|ambition|duty|love|lead|found|built|argue|believe|teach|role|protago|mentor|rival|hero)\b/i.test(
        pair.detail,
      );
    if (looksLikePerson || /\b(character|protagonist|hero|mentor|narrator|author|founder|leader|thinker|researcher)\b/i.test(pair.label)) {
      push(pair.label, pair.detail);
    }
  }
  // "X is a ..." person sentences.
  for (const s of [...splitSentences(src.deep_summary), ...splitSentences(src.deep_analysis)]) {
    if (nodes.length >= 6) break;
    const m = s.match(/^([A-Z][a-zA-Z.'-]*(?:\s+[A-Z][a-zA-Z.'-]*){0,2})\s+is\s+(.{10,160})$/);
    if (m && /\b(character|leader|author|thinker|researcher|founder|hero|daughter|son|king|queen|teacher|student)\b/i.test(m[2])) {
      push(m[1], m[2]);
    }
  }

  // Lenses (generic-safe, no invented names).
  if (nodes.length < 3) {
    const lenses = isFiction
      ? [
          { label: "The protagonist", detail: "Track what they want — and what it costs them." },
          { label: "The key relationship", detail: "Most change happens between two people." },
          { label: "The opposing force", detail: "Name what stands in the way — person or system." },
          { label: "Who changes most", detail: "The arc of change is the meaning of the story." },
        ]
      : book.category && /biograph|memoir/i.test(book.category)
        ? [
            { label: book.author, detail: "Whose life is the evidence for every lesson." },
            { label: "Mentors and allies", detail: "Notice who guided the key decisions." },
            { label: "Rivals and critics", detail: "Opposition sharpens the real principles." },
            { label: "The era", detail: "Context explains which bets were brave." },
          ]
        : [
            { label: book.author, detail: "The guide — follow their core argument first." },
            { label: "Thinkers cited", detail: "Watch whose research backs each claim." },
            { label: "You, the reader", detail: "Each idea asks one question back of you." },
            { label: "Case studies", detail: "Real stories show the idea under pressure." },
          ];
    for (const lens of lenses) {
      if (nodes.length >= 5) break;
      push(lens.label, lens.detail);
    }
  }

  return {
    id: "people",
    title: isFiction ? "Characters" : book.category && /biograph|memoir/i.test(book.category) ? "People" : "Thinkers",
    question: isFiction ? "Who matters and why?" : "Whose ideas shape this book?",
    icon: "users",
    nodes: nodes.slice(0, 6),
    callout: {
      kind: "insight",
      title: "Key Insight",
      text: isFiction
        ? "Character → motivation → choice → consequence: trace one chain per person."
        : "Thinker → claim → evidence → your verdict: never skip the last step.",
    },
  };
}

function buildThemes(book: MindmapBookInput, src: Sources): MindmapBranch {
  const nodes: MindmapNode[] = [];
  const seen = new Set<string>();
  const push = (label: string, tag?: string) => {
    const clean = shortenLabel(label, 8);
    const key = normalizeKey(clean);
    if (!clean || seen.has(key) || wordsOf(clean).length < 1) return;
    seen.add(key);
    nodes.push(tag ? { label: clean, tag } : { label: clean });
  };

  const haystack = `${src.key_ideas}\n${src.deep_analysis}\n${src.overview}`;
  // Explicit "theme of X" / "explores X" signals.
  const themeHits = haystack.match(/\b(?:theme of|explores?|about|between)\s+([A-Za-z][A-Za-z\s&',-]{2,48}?)(?=[.!?\n])/g) || [];
  for (const hit of themeHits.slice(0, 8)) {
    const cleaned = hit.replace(/^(theme of|explores?|about|between)\s+/i, "").trim();
    if (wordsOf(cleaned).length <= 6 && cleaned.length > 3) push(sentenceCase(cleaned));
  }
  // Conflict pairs: "X vs Y", "X versus Y", "tension between X and Y".
  const conflicts =
    haystack.match(/\b([A-Za-z][A-Za-z ]{2,24}?)\s+(?:vs\.?|versus)\s+([A-Za-z][A-Za-z ]{2,24}?)\b/g) || [];
  for (const c of conflicts.slice(0, 3)) push(c.trim(), "Conflict");
  const tension = haystack.match(/tension between\s+([^.\n]{4,60}?)\s+and\s+([^.\n]{4,60}?)(?=[.!?\n])/i);
  if (tension) push(`${sentenceCase(tension[1].trim())} vs ${tension[2].trim()}`, "Conflict");

  // Concept headings double as themes.
  for (const h of [...extractHeadings(src.key_ideas), ...extractHeadings(src.deep_analysis)]) {
    if (nodes.length >= 6) break;
    push(h);
  }

  if (nodes.length < 3) {
    for (const lens of genericThemeLenses(book)) {
      if (nodes.length >= 5) break;
      push(lens);
    }
  }

  return {
    id: "themes",
    title: "Themes",
    question: "What deeper ideas run through it?",
    icon: "layers",
    nodes: nodes.slice(0, 6),
    callout: {
      kind: "remember",
      title: "Remember This",
      text: nodes[0]
        ? `If you keep one theme: ${shortenDetail(nodes[0].label, 14)}.`
        : "Name the tension the book never fully resolves — that is its engine.",
    },
  };
}

function buildLessons(book: MindmapBookInput, src: Sources): MindmapBranch {
  const nodes: MindmapNode[] = [];
  const seen = new Set<string>();
  const push = (label: string, tag?: string) => {
    const clean = shortenLabel(label);
    const key = normalizeKey(clean);
    if (!clean || seen.has(key)) return;
    seen.add(key);
    nodes.push(tag ? { label: clean, tag } : { label: clean });
  };

  const lessonPool = [
    ...extractBullets(src.daily_application),
    ...extractBullets(src.action_system),
    ...extractBullets(src.key_ideas),
  ];
  for (const line of lessonPool) {
    if (nodes.length >= 6) break;
    if (wordsOf(line).length > 30) continue;
    if (/\b(avoid|mistake|never |don't|do not|fail|trap|warning|beware)\b/i.test(line)) {
      push(line, "Avoid");
    } else {
      push(line);
    }
  }
  for (const s of [...bestSentences(src.daily_application, 6), ...bestSentences(src.key_ideas, 6)]) {
    if (nodes.length >= 6) break;
    push(s);
  }

  if (nodes.length < 3) {
    push("Small actions, repeated, beat rare intensity");
    push("Design the environment before relying on willpower");
    push("Measure one thing that truly matters");
    push("Avoid consuming without applying", "Avoid");
  }

  const mistake = nodes.find((n) => n.tag === "Avoid");
  return {
    id: "lessons",
    title: "Key Lessons",
    question: "What should you remember?",
    icon: "graduationCap",
    nodes: nodes.slice(0, 7),
    callout: {
      kind: "remember",
      title: "Remember This",
      text: mistake
        ? `Mistake to avoid: ${shortenDetail(mistake.label, 20)}`
        : `Principles beat tactics — live one lesson from ${book.title} this week.`,
    },
  };
}

function buildApply(book: MindmapBookInput, src: Sources): MindmapBranch {
  const nodes: MindmapNode[] = [];
  const seen = new Set<string>();
  const push = (label: string, tag?: string) => {
    const clean = shortenLabel(label);
    const key = normalizeKey(clean);
    if (!clean || seen.has(key)) return;
    seen.add(key);
    nodes.push(tag ? { label: clean, tag } : { label: clean });
  };

  const actionPool = [
    ...extractBullets(src.action_system),
    ...extractBullets(src.practice_tracker),
    ...extractBullets(src.daily_application),
  ];
  for (const line of actionPool) {
    if (nodes.length >= 6) break;
    if (wordsOf(line).length > 30) continue;
    const imperative = /^(write|pick|choose|define|track|review|practice|start|stop|schedule|ask|note|build|create|set|make|try|do|take|list|plan)\b/i.test(
      line.trim(),
    );
    push(line, imperative ? "Action" : undefined);
  }
  for (const s of bestSentences(src.daily_application, 6)) {
    if (nodes.length >= 6) break;
    push(s);
  }

  const example = splitSentences(src.real_life_example).find((s) => wordsOf(s).length >= 8) || "";

  if (nodes.length < 3) {
    push("Pick one idea to test for seven days", "Action");
    push("Attach it to an existing daily cue", "Action");
    push("Write a one-line evening review", "Action");
    push("Use it in the next real decision you face");
  }

  return {
    id: "apply",
    title: "Real-Life Application",
    question: "How do you use this tomorrow?",
    icon: "rocket",
    nodes: nodes.slice(0, 7),
    callout: {
      kind: example ? "example" : "action",
      title: example ? "Example" : "Action Step",
      text: example
        ? shortenDetail(example, 24)
        : `Today: apply one idea from ${book.title} to a decision you already face.`,
    },
  };
}

function buildMoments(book: MindmapBookInput, src: Sources, isFiction: boolean): MindmapBranch {
  const nodes: MindmapNode[] = [];
  const seen = new Set<string>();
  const sentences = dedupeLines([
    ...splitSentences(src.deep_summary),
    ...splitSentences(src.deep_analysis),
  ]);

  const turning = sentences.filter((s) =>
    /\b(but |however|suddenly|realiz|discover|reveal|turning point|breakthrough|proved|failed|decided|changed|shock|secret|truth|finally)\b/i.test(
      s,
    ),
  );

  for (const s of [...turning, ...sentences]) {
    if (nodes.length >= 5) break;
    const key = normalizeKey(s).slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    // Try cause → effect split.
    const m = s.match(/^(.{10,120}?)\s+(?:led to|leads to|resulted in|therefore|so that|which meant)\s+(.{8,140})$/i);
    if (m) {
      nodes.push({ label: shortenLabel(m[1], 8), cause: shortenLabel(m[1], 10), effect: shortenLabel(m[2], 10) });
    } else {
      nodes.push({ label: shortenLabel(s) });
    }
  }

  if (nodes.length < 3) {
    const fallback = isFiction
      ? [
          "The moment the want becomes urgent",
          "The choice that cannot be undone",
          "The revelation that reframes everything",
          "The final cost — and what it buys",
        ]
      : [
          "The reframe that changes the question",
          "The evidence that makes it undeniable",
          "The method that makes it usable",
          "The result that compounds over time",
        ];
    for (const label of fallback) {
      if (nodes.length >= 4) break;
      nodes.push({ label });
    }
  }

  return {
    id: "moments",
    title: isFiction ? "Key Moments" : "Key Insights",
    question: isFiction ? "What changes everything?" : "What are the breakthroughs?",
    icon: "zap",
    nodes: nodes.slice(0, 5),
    callout: {
      kind: "connection",
      title: "Connection",
      text: isFiction
        ? "Each moment links back: event → choice → theme."
        : "Each insight links forward: idea → example → application.",
    },
  };
}

/* ------------------------------------------------------------------ */
/* Generic-safe lenses (used only when source text is thin)            */
/* ------------------------------------------------------------------ */

function genericConceptLenses(book: MindmapBookInput): string[] {
  const key = resolveGenreKey(book.category);
  const map: Record<MindmapGenreKey, string[]> = {
    business: ["Value creation before value capture", "Moats and unfair advantages", "Unit economics that work", "Distribution beats product alone", "Capital allocation over time"],
    psychology: ["Fast intuition vs slow reasoning", "Biases that distort judgment", "Incentives drive behavior", "Stories stick more than stats", "Environment shapes choice"],
    selfhelp: ["Identity precedes behavior", "Systems beat goals", "Attention is the scarcest asset", "Friction decides follow-through", "Review loops compound growth"],
    mystery: ["Every clue cuts both ways", "Motive hides in routine", "The least likely pressure point", "Timing reveals the truth", "Nothing is only what it seems"],
    romance: ["Vulnerability before trust", "Timing and missed chances", "Love as daily practice", "The rival is usually fear", "Choosing each other, again"],
    fantasy: ["Power always demands a price", "Maps of the world, maps of the soul", "Prophecy vs free will", "Allies carry the quest", "The return changes home"],
    scifi: ["Technology amplifies human intent", "The future tests today's ethics", "Systems fail at the edges", "Adaptation beats prediction", "What it means to be human"],
    history: ["Incentives move empires", "Geography shapes destiny", "Ideas outlive armies", "Crises reveal character", "Patterns rhyme across centuries"],
    biography: ["Early constraints forge craft", "One defining bet", "Mentors accelerate mastery", "Setbacks become curriculum", "Legacy is built daily"],
    philosophy: ["Control judgment, not outcome", "Question the unexamined want", "Meaning is made, not found", "Attention shapes reality", "Death clarifies priorities"],
    productivity: ["One priority at a time", "Capture everything, decide fast", "Deep work in guarded blocks", "Energy before hours", "Weekly review keeps truth"],
    leadership: ["Clarity multiplies teams", "Decide with incomplete data", "Culture is repeated behavior", "Feedback is a gift system", "Serve the mission first"],
    default: ["The central tension", "The reframe", "The method", "The test", "The payoff"],
  };
  return map[key];
}

function genericThemeLenses(book: MindmapBookInput): string[] {
  const key = resolveGenreKey(book.category);
  const map: Record<MindmapGenreKey, string[]> = {
    business: ["Ambition vs sustainability", "Risk and reward", "Craft vs scale"],
    psychology: ["Reason vs emotion", "Self vs story", "Control vs acceptance"],
    selfhelp: ["Comfort vs growth", "Identity vs habit", "Now vs later"],
    mystery: ["Truth vs deception", "Justice vs law", "Guilt vs innocence"],
    romance: ["Independence vs intimacy", "Passion vs commitment", "Fate vs choice"],
    fantasy: ["Power vs responsibility", "Destiny vs will", "Light vs shadow"],
    scifi: ["Progress vs wisdom", "Human vs machine", "Freedom vs safety"],
    history: ["Power vs people", "Continuity vs change", "Memory vs myth"],
    biography: ["Talent vs grit", "Fame vs craft", "Self vs service"],
    philosophy: ["Being vs becoming", "Knowledge vs wisdom", "Self vs world"],
    productivity: ["Busy vs effective", "More vs essential", "Speed vs depth"],
    leadership: ["Authority vs trust", "Vision vs execution", "Self vs team"],
    default: ["Change vs continuity", "Individual vs collective", "Ideal vs real"],
  };
  return map[key];
}

/* ------------------------------------------------------------------ */
/* Public builder                                                      */
/* ------------------------------------------------------------------ */

export function buildMindmapFromBook(book: MindmapBookInput): MindmapData {
  const src = asSources(book);
  const category = (book.category ?? "").trim() || "General";
  const genreKey = resolveGenreKey(category);
  const isFiction = isFictionCategory(category);

  const overviewBest = bestSentences(src.overview, 3);
  const tagline = stripMd(toText(book.tagline));
  const oneLiner =
    (tagline && wordsOf(tagline).length >= 4 && wordsOf(tagline).length <= 30
      ? tagline
      : overviewBest[0]) || `${book.title} by ${book.author} — the essential ideas, mapped.`;

  const whyCandidate =
    bestSentences(`${src.overview}\n${src.daily_application}`, 6).find((s) =>
      /\b(you|your|life|work|everyday|daily|career|relationship|money|health|decision)\b/i.test(s),
    ) || overviewBest[1] || "";
  const whyItMatters = whyCandidate
    ? shortenDetail(whyCandidate, 26)
    : `Understand ${book.title} in minutes — then apply one idea today.`;

  const branches: MindmapBranch[] = [
    buildCoreIdea(book, src),
    buildConcepts(book, src),
    buildStory(book, src, isFiction),
    buildPeople(book, src, isFiction),
    buildThemes(book, src),
    buildLessons(book, src),
    buildApply(book, src),
    buildMoments(book, src, isFiction),
  ];

  // Quick recall: strongest distinct sentences across the whole book.
  const recallPool = dedupeLines([
    ...extractBullets(src.key_ideas).slice(0, 6),
    ...bestSentences(src.overview, 4),
    ...bestSentences(src.key_ideas, 6),
    ...bestSentences(src.daily_application, 4),
    ...bestSentences(src.deep_analysis, 4),
  ]).filter((s) => wordsOf(s).length >= 6 && wordsOf(s).length <= 30);

  const takeaways = recallPool.slice(0, 5).map((s) => sentenceCase(shortenDetail(s, 22)));
  while (takeaways.length < 5) {
    const fillers = [
      `The core argument of ${book.title} in one reread`,
      "One concept worth explaining to a friend",
      "One story that makes the idea stick",
      "One lesson to apply this week",
      "One question to keep asking",
    ];
    const next = fillers[takeaways.length];
    if (!next || takeaways.includes(next)) break;
    takeaways.push(next);
  }

  return {
    title: book.title,
    author: book.author,
    category,
    genreKey,
    isFiction,
    oneLiner: sentenceCase(oneLiner),
    whyItMatters: sentenceCase(whyItMatters),
    branches,
    recall: {
      takeaways,
      oneLine: sentenceCase(shortenDetail(oneLiner, 24)),
      best: takeaways[0] || sentenceCase(shortenDetail(oneLiner, 24)),
    },
  };
}
