// Pure, rule-based SEO + polish scoring. Zero AI calls.

export type BookForAudit = {
  id: string;
  slug: string;
  title: string;
  author: string;
  category?: string | null;
  language?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  og_image?: string | null;
  cover_url?: string | null;
  tagline?: string | null;
  overview?: string | null;
  key_ideas?: string | null;
  deep_analysis?: string | null;
  daily_application?: string | null;
  action_system?: string | null;
  reflection_questions?: string | null;
  affiliate_link?: string | null;
};

export type Check = {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  detail?: string;
  fix?: string;
  severity?: "critical" | "high" | "medium" | "low";
};

export type AuditResult = {
  score: number;        // 0..100
  passed: Check[];
  failed: Check[];
  warnings: Check[];
  checks: Check[];
};

const SITE = "https://booknomics.com";

const wordCount = (s?: string | null) => (s || "").trim().split(/\s+/).filter(Boolean).length;
const has = (s?: string | null, min = 1) => wordCount(s) >= min;

// ---- Bilingual helpers -------------------------------------------------
// Hindi sentences end with a danda (।), not a full stop. Splitting only on
// [.!?] treated a whole Hindi summary as one sentence, which reported "2 words"
// for a 2,650-word article and failed every length/variety check.
const SENTENCE_SPLIT = /[.!?।॥]+/;

/** Split prose into sentences for both Latin and Devanagari punctuation. */
export function splitSentences(text: string): string[] {
  return text.split(SENTENCE_SPLIT).map((s) => s.trim()).filter(Boolean);
}

/** Count words across scripts. Devanagari is space-delimited like Latin. */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const hasDevanagari = (text: string) => /[\u0900-\u097F]/.test(text);

// Second-person address: English pronouns plus Hindi आप/तुम forms.
const SECOND_PERSON_RE =
  /\b(you|your|let's|here's|i've|we'll|imagine|notice|try this)\b|(आप|आपक|आपन|तुम|तुम्ह|अपन|कीजिए|कीजिये|लीजिए|लीजिये|देखिए|देखिये|सोचिए|सोचिये|पूछिए|मानिए|कल्पना)/;

// Example markers in both languages.
const EXAMPLES_RE =
  /\b(for example|for instance|case in point|consider|imagine)\b|(उदाहरण|मसलन|जैसे कि|मान लीजिए|मान लीजिये|कल्पना कीजिए|जैसा कि)/;

// Concrete numbers: Latin digits, Devanagari digits, and Hindi time words.
const CONCRETE_RE =
  /\b(\d+%|\$\d|\d+x|\d+ (days|weeks|years|minutes|hours))\b|[०-९]+|(\d+\s*(दिन|सप्ताह|हफ़्ते|हफ्ते|साल|वर्ष|मिनट|घंटे|प्रतिशत|फ़ीसदी))|((एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस|सौ)\s*(दिन|सप्ताह|हफ़्ते|हफ्ते|साल|वर्ष|मिनट|घंटे))/;

// AI-cliché list, extended with the Hindi equivalents that show up in
// machine-translated copy.
const AI_CLICHES_EN = [
  "in today's fast-paced world", "in conclusion", "delve into", "it is important to note",
  "navigate the complexities", "ever-evolving", "in the realm of", "embark on a journey",
  "at the end of the day", "tapestry", "harness the power",
];
const AI_CLICHES_HI = [
  "आज की तेज़-रफ़्तार दुनिया", "आज की तेज रफ्तार दुनिया", "अंत में यह कहा जा सकता है",
  "यह ध्यान देने योग्य है", "गहराई से जानें", "एक यात्रा पर निकलें", "निष्कर्ष के तौर पर",
];

export function bookUrl(slug: string) { return `${SITE}/books/${slug}`; }

// -------- On-page SEO (0..100) --------
export function auditOnPage(book: BookForAudit): AuditResult {
  const checks: Check[] = [];
  const titleKw = book.title.toLowerCase();

  const mt = (book.meta_title || "").trim();
  checks.push({
    id: "meta_title", label: "Meta title (30–65 chars, contains book title)",
    weight: 10,
    passed: mt.length >= 30 && mt.length <= 65 && mt.toLowerCase().includes(titleKw.split(" ")[0]),
    detail: mt ? `${mt.length} chars` : "missing",
    fix: "Write a 50–60 char meta title that includes the book title and a benefit (e.g. 'Book Summary, Key Ideas & Lessons').",
    severity: "critical",
  });

  const md = (book.meta_description || "").trim();
  checks.push({
    id: "meta_description", label: "Meta description (120–160 chars)",
    weight: 10,
    passed: md.length >= 120 && md.length <= 165,
    detail: md ? `${md.length} chars` : "missing",
    fix: "Write a 140–160 char description with the book title, the core takeaway, and a CTA.",
    severity: "critical",
  });

  checks.push({
    id: "h1_title", label: "H1 / page title present",
    weight: 8, passed: book.title.length > 3,
    fix: "Set a clear book title.", severity: "critical",
  });

  checks.push({
    id: "tagline", label: "Tagline / hook present (10+ words)",
    weight: 6, passed: has(book.tagline, 10),
    fix: "Add a 15–25 word hook that promises the key insight.",
    severity: "medium",
  });

  const totalWords =
    wordCount(book.overview) + wordCount(book.key_ideas) + wordCount(book.deep_analysis) +
    wordCount(book.daily_application) + wordCount(book.action_system);
  checks.push({
    id: "content_depth", label: "Content depth (≥ 600 words)",
    weight: 12, passed: totalWords >= 600,
    detail: `${totalWords} words`,
    fix: "Expand overview, key ideas, and deep analysis. Aim for 800+ words total.",
    severity: "high",
  });

  checks.push({
    id: "key_ideas", label: "Key ideas / bullets present",
    weight: 8, passed: /[-•*]\s|\n\d+[.)]\s/.test(book.key_ideas || ""),
    fix: "Add 5–7 bullet points in Key Ideas.", severity: "high",
  });

  checks.push({
    id: "action_system", label: "Numbered action steps present",
    weight: 6, passed: /\n?\d+[.)]\s/.test(book.action_system || ""),
    fix: "List 3–7 numbered action steps.", severity: "medium",
  });

  checks.push({
    id: "reflection", label: "Reflection questions present",
    weight: 4, passed: has(book.reflection_questions, 10),
    fix: "Add 3–5 reflection questions.", severity: "low",
  });

  // Slug quality
  const slug = book.slug || "";
  const slugClean = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
  const slugShort = slug.length > 0 && slug.length <= 60;
  const slugHasKw = slug.includes(slugify(book.title).split("-")[0] || "");
  checks.push({
    id: "slug_quality", label: "Slug clean, ≤60 chars, includes keyword",
    weight: 8,
    passed: slugClean && slugShort && slugHasKw,
    detail: slug,
    fix: "Use lowercase, hyphen-separated slug with the main keyword.",
    severity: "high",
  });

  checks.push({
    id: "og_image", label: "OG image / cover present",
    weight: 6, passed: !!(book.og_image || book.cover_url),
    fix: "Generate or upload a cover image.", severity: "medium",
  });

  checks.push({
    id: "canonical", label: "Canonical URL stable (slug set)",
    weight: 4, passed: slug.length > 0,
    fix: "Set a permanent slug.", severity: "medium",
  });

  checks.push({
    id: "category", label: "Category set (powers internal links)",
    weight: 4, passed: !!(book.category && book.category.length > 1),
    fix: "Assign a category.", severity: "low",
  });

  checks.push({
    id: "affiliate", label: "Affiliate / outbound link present",
    weight: 4, passed: !!book.affiliate_link,
    fix: "Add the Amazon / publisher link.", severity: "low",
  });

  checks.push({
    id: "schema_ready", label: "Schema-ready fields (title, author, description)",
    weight: 6, passed: !!(book.title && book.author && (md || book.tagline)),
    fix: "Fill title, author and meta description for Book schema.",
    severity: "medium",
  });

  checks.push({
    id: "headings_structure", label: "Multiple content sections (≥3)",
    weight: 4,
    passed: [book.overview, book.key_ideas, book.deep_analysis, book.daily_application, book.action_system]
      .filter(s => has(s, 20)).length >= 3,
    fix: "Fill at least 3 long-form sections.",
    severity: "medium",
  });

  return finalize(checks);
}

// -------- Polishing (grammar / structure proxies) 0..100 --------
export function auditPolish(book: BookForAudit): AuditResult {
  const checks: Check[] = [];
  const text = [book.overview, book.key_ideas, book.deep_analysis, book.daily_application, book.action_system]
    .filter(Boolean).join("\n\n");

  const sentences = splitSentences(text);
  const avgLen = sentences.length ? sentences.reduce((a, s) => a + countWords(s), 0) / sentences.length : 0;

  checks.push({
    id: "sentence_variety", label: "Sentence length variety (8–22 avg words)",
    weight: 15, passed: avgLen >= 8 && avgLen <= 22, detail: `avg ${avgLen.toFixed(1)} words`,
    fix: "Mix short punchy sentences with longer explanatory ones.",
  });

  // Repeated phrases (very rough: most common trigram count).
  // Keep Devanagari code points so Hindi copy is actually measured — the old
  // [^a-z\s] strip erased every Hindi word and reported a word count of ~0.
  const trigrams = new Map<string, number>();
  const words = text
    .toLowerCase()
    // eslint-disable-next-line no-misleading-character-class -- Devanagari combining marks belong to the kept range.
    .replace(/[^a-z\u0900-\u097F\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  for (let i = 0; i < words.length - 2; i++) {
    const k = words.slice(i, i + 3).join(" ");
    trigrams.set(k, (trigrams.get(k) || 0) + 1);
  }
  const topRepeat = [...trigrams.values()].sort((a, b) => b - a)[0] || 0;
  checks.push({
    id: "repetition", label: "No phrase repeated > 3 times",
    weight: 15, passed: topRepeat <= 3, detail: `max trigram repeat ${topRepeat}`,
    fix: "Rephrase repeated openings; vary sentence starters.",
  });

  checks.push({
    id: "headings_present", label: "Section structure present",
    weight: 10,
    passed: [book.overview, book.key_ideas, book.action_system].every(s => has(s, 20)),
    fix: "Fill overview, key ideas, and action system.",
  });

  checks.push({
    id: "bullets", label: "Uses bullets or numbered lists",
    weight: 10, passed: /(^|\n)\s*([-•*]|\d+[.)])\s+/.test(text),
    fix: "Convert dense paragraphs into 5–7 bullets where possible.",
  });

  checks.push({
    id: "cta", label: "Has a clear call-to-action / takeaway",
    weight: 10, passed: has(book.daily_application, 12) || has(book.action_system, 15),
    fix: "Add a 'Apply today' or 3-step action block.",
  });

  checks.push({
    id: "no_filler", label: "Low filler (≤ 3 'very/really/just/basically')",
    weight: 10,
    passed: (text.toLowerCase().match(/\b(very|really|just|basically|actually)\b/g) || []).length <= 3,
    fix: "Cut hedging words; commit to the claim.",
  });

  checks.push({
    id: "exclaim", label: "Restrained exclamation marks (≤ 2)",
    weight: 5,
    passed: (text.match(/!/g) || []).length <= 2,
    fix: "Trust the writing — remove most exclamation marks.",
  });

  checks.push({
    id: "spelling_proxy", label: "No long ALL-CAPS strings",
    weight: 5, passed: !/\b[A-Z]{6,}\b/.test(text),
    fix: "Avoid SHOUTING; use bold sparingly instead.",
  });

  checks.push({
    id: "length_ok", label: "Content length ≥ 400 words",
    weight: 20, passed: words.length >= 400, detail: `${words.length} words`,
    fix: "Expand thin sections.",
  });

  return finalize(checks);
}

// -------- Humanized score (anti-AI cues) 0..100 --------
export function auditHumanized(book: BookForAudit): AuditResult {
  const checks: Check[] = [];
  const text = [book.overview, book.key_ideas, book.deep_analysis, book.daily_application]
    .filter(Boolean).join("\n\n").toLowerCase();

  const cliches = [...AI_CLICHES_EN, ...AI_CLICHES_HI];
  const hits = cliches.filter(c => text.includes(c));
  checks.push({
    id: "ai_cliches", label: "No AI-clichés",
    weight: 25, passed: hits.length === 0,
    detail: hits.length ? `found: ${hits.join(", ")}` : "clean",
    fix: "Replace clichés with concrete examples.",
  });

  // Em-dash / semicolon abundance is an AI tell
  const emDash = (text.match(/—/g) || []).length;
  checks.push({
    id: "em_dash", label: "Em-dash use restrained (≤ 5)",
    weight: 10, passed: emDash <= 5, detail: `${emDash} em-dashes`,
    fix: "Swap a few em-dashes for full stops or commas.",
  });

  // Personal voice cues (English pronouns or Hindi आप/तुम forms)
  const personal = SECOND_PERSON_RE.test(text);
  checks.push({
    id: "second_person", label: "Speaks directly to reader (you/your)",
    weight: 20, passed: personal,
    fix: "Address the reader as 'you'. Use 'try this' / 'notice that'.",
  });

  const concrete = CONCRETE_RE.test(text);
  checks.push({
    id: "concrete_numbers", label: "Concrete numbers / time spans present",
    weight: 15, passed: concrete,
    fix: "Add specific numbers, time spans, or measurable outcomes.",
  });

  const examples = EXAMPLES_RE.test(text);
  checks.push({
    id: "examples", label: "Uses examples or scenarios",
    weight: 15, passed: examples,
    fix: "Add at least one real-world example.",
  });

  const questions = (text.match(/[?？]/g) || []).length;
  checks.push({
    id: "rhetorical_q", label: "Uses ≥ 1 rhetorical question",
    weight: 5, passed: questions >= 1,
    fix: "Open a section with a question the reader is asking.",
  });

  const sentences = splitSentences(text);
  const lens = sentences.map(s => countWords(s));
  const variance = lens.length ? Math.sqrt(lens.reduce((a, n) => a + (n - lens.reduce((b, m) => b + m, 0) / lens.length) ** 2, 0) / lens.length) : 0;
  checks.push({
    id: "burstiness", label: "Burstiness (varied sentence lengths)",
    weight: 10, passed: variance >= 4, detail: `σ=${variance.toFixed(1)}`,
    fix: "Alternate short and long sentences.",
  });

  return finalize(checks);
}

// -------- SEO readiness composite --------
export function auditSeoReadiness(book: BookForAudit): AuditResult {
  const onPage = auditOnPage(book);
  const polish = auditPolish(book);
  const human = auditHumanized(book);
  const score = Math.round(onPage.score * 0.5 + polish.score * 0.25 + human.score * 0.25);
  return {
    score,
    checks: [],
    passed: [],
    failed: [],
    warnings: [],
  };
}

function finalize(checks: Check[]): AuditResult {
  const totalW = checks.reduce((a, c) => a + c.weight, 0);
  const earned = checks.filter(c => c.passed).reduce((a, c) => a + c.weight, 0);
  const score = Math.round((earned / Math.max(1, totalW)) * 100);
  return {
    score,
    checks,
    passed: checks.filter(c => c.passed),
    failed: checks.filter(c => !c.passed && (c.severity === "critical" || c.severity === "high")),
    warnings: checks.filter(c => !c.passed && (c.severity === "medium" || c.severity === "low" || !c.severity)),
  };
}

export function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}
export function scoreBg(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export function slugify(s: string) {
  return s.toLowerCase().trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// -------- Recommendation engine --------
export type Recommendation = {
  id: string; title: string; why: string; fix: string;
  priority: "critical" | "high" | "medium" | "low";
  module: "on_page" | "off_page" | "polish" | "social" | "indexing";
};

export function generateRecommendations(book: BookForAudit, opts?: {
  hasSocial?: Record<string, boolean>;
  indexed?: boolean | null;
  impressions?: number;
  ctr?: number;
  avgPosition?: number;
}): Recommendation[] {
  const recs: Recommendation[] = [];
  const onPage = auditOnPage(book);
  for (const c of onPage.checks.filter(c => !c.passed)) {
    recs.push({
      id: `op_${c.id}`, title: c.label,
      why: "On-page SEO factor — directly affects ranking.",
      fix: c.fix || "Fix this field.",
      priority: (c.severity as any) || "medium",
      module: "on_page",
    });
  }
  const human = auditHumanized(book);
  for (const c of human.checks.filter(c => !c.passed)) {
    recs.push({
      id: `hu_${c.id}`, title: c.label,
      why: "Improves humanization & reader trust.",
      fix: c.fix || "Rewrite this section.",
      priority: "medium", module: "polish",
    });
  }
  if (opts?.hasSocial) {
    for (const p of ["youtube", "pinterest", "instagram", "facebook", "threads"]) {
      if (!opts.hasSocial[p]) {
        recs.push({
          id: `soc_${p}`, title: `Share on ${p}`,
          why: "Social distribution drives discovery & off-page signals.",
          fix: `Generate a ${p} post in the Social Publisher.`,
          priority: "low", module: "social",
        });
      }
    }
  }
  if (opts?.indexed === false) {
    recs.push({
      id: "idx_request", title: "Page not indexed — request indexing",
      why: "No index = no organic traffic.",
      fix: "Open URL Inspection in Google Search Console and click 'Request indexing'. Ensure the URL is in sitemap.xml.",
      priority: "critical", module: "indexing",
    });
  }
  if ((opts?.impressions || 0) > 100 && (opts?.ctr || 0) < 0.02) {
    recs.push({
      id: "ctr_low", title: "High impressions, low CTR",
      why: "Title/description not compelling enough.",
      fix: "Rewrite meta title with a benefit/number; add year or 'in 3 minutes'.",
      priority: "high", module: "on_page",
    });
  }
  if ((opts?.avgPosition || 99) >= 6 && (opts?.avgPosition || 99) <= 20) {
    recs.push({
      id: "near_top", title: "Ranking 6–20 — push to top 5",
      why: "These pages have the highest upside.",
      fix: "Add 2–3 subtopics, FAQ section, and internal links from related books.",
      priority: "high", module: "on_page",
    });
  }
  return recs.sort((a, b) => prio(a.priority) - prio(b.priority));
}
const prio = (p: string) => ({ critical: 0, high: 1, medium: 2, low: 3 } as any)[p] ?? 9;
