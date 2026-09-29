import { slugify } from "./seoScore";

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","of","in","on","at","to","for","with","by",
  "from","as","is","it","this","that","be","are","was","were","will","would",
  "should","could","can","may","might","must","shall","do","does","did","have",
  "has","had","i","you","he","she","they","we","our","your","my","me","us","them",
]);

export type SlugAnalysis = {
  current: string;
  score: number;
  issues: string[];
  suggestions: string[];
};

export function analyzeSlug(current: string, title: string): SlugAnalysis {
  const issues: string[] = [];
  let score = 100;

  if (!current) {
    issues.push("Empty slug");
    score = 0;
  } else {
    if (!/^[a-z0-9-]+$/.test(current)) { issues.push("Contains invalid characters"); score -= 30; }
    if (current.includes("--")) { issues.push("Contains double hyphens"); score -= 10; }
    if (current.startsWith("-") || current.endsWith("-")) { issues.push("Starts or ends with hyphen"); score -= 10; }
    if (current.length > 60) { issues.push(`Too long (${current.length} chars, target ≤ 60)`); score -= 15; }
    if (current.length < 4) { issues.push("Too short"); score -= 15; }

    const parts = current.split("-");
    const stopHits = parts.filter(p => STOP_WORDS.has(p));
    if (stopHits.length > 0) {
      issues.push(`Contains stop words: ${stopHits.join(", ")}`);
      score -= 5 * stopHits.length;
    }

    const titleKw = slugify(title).split("-")[0];
    if (titleKw && !current.includes(titleKw)) {
      issues.push("Doesn't include main keyword from title");
      score -= 20;
    }

    if (parts.length > 8) { issues.push("Too many words (>8)"); score -= 10; }
  }

  // Suggestions
  const base = slugify(title);
  const clean = base.split("-").filter(p => !STOP_WORDS.has(p)).join("-");
  const summarySlug = `${clean}-book-summary`.slice(0, 60);
  const keyIdeasSlug = `${clean}-key-ideas`.slice(0, 60);

  const suggestions = Array.from(new Set([clean, summarySlug, keyIdeasSlug]))
    .filter(s => s && s !== current);

  return { current, score: Math.max(0, score), issues, suggestions };
}
