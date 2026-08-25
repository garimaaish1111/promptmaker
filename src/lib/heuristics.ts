import { CATEGORIES, type Category } from "./categories";

/**
 * Zero-token pre-checks.
 *
 * Every function here runs locally and costs nothing. Two of them earn their
 * keep by removing API calls entirely:
 *
 * - `structuralScore` estimates how complete a draft already is. A draft that
 *   scores high does not need the Haiku analysis pass, which cuts one of the
 *   two API calls for that request.
 * - `guessCategory` resolves the category by keyword when the signal is
 *   unambiguous, which is the other thing the analysis pass was for.
 *
 * These are heuristics, not judgements. They only ever *skip* work when they
 * are confident; when unsure they fall through to the model.
 */

const ROLE_MARKERS = /\b(you are|act as|as an? (expert|senior|professional))\b/i;
const FORMAT_MARKERS =
  /\b(json|yaml|markdown|table|bullet|numbered|csv|format|schema|template|structure)\b/i;
const CONSTRAINT_MARKERS =
  /\b(must|only|don'?t|do not|never|avoid|without|no more than|at most|limit|constraint|exclude)\b/i;
const AUDIENCE_MARKERS =
  /\b(audience|for (a|an|my|our) \w+|beginner|expert|student|customer|reader|team|stakeholder)\b/i;
const LENGTH_MARKERS =
  /\b(\d+\s*(words?|characters?|sentences?|paragraphs?|bullets?|items?|lines?)|brief|short|detailed)\b/i;
const EXAMPLE_MARKERS = /\b(for example|e\.g\.|such as|like this|sample)\b/i;

/** Padding that adds tokens without changing the model's output. */
const FILLER = [
  /\bplease\b/gi,
  /\bthank you\b/gi,
  /\bthanks\b/gi,
  /\bi (would like|want) you to\b/gi,
  /\bcould you (please )?\b/gi,
  /\bkindly\b/gi,
  /\bif you (can|could|don'?t mind)\b/gi,
  /\b(world[- ]class|best possible|expert[- ]level|top[- ]tier|amazing|awesome)\b/gi,
  /\b(very|really|extremely|super)\b/gi,
];

export interface StructuralAnalysis {
  /** 0-100. How complete the draft looks structurally. */
  score: number;
  present: string[];
  missing: string[];
  /** Rough count of tokens attributable to filler phrasing. */
  fillerTokens: number;
  wordCount: number;
}

/**
 * A crude token estimate for UI display only.
 *
 * Never use this for billing or for anything the user might act on
 * financially — `countClaudeTokens` in `tokens.ts` calls the real
 * `count_tokens` endpoint and is the only accurate source.
 */
export function roughTokenEstimate(text: string): number {
  return Math.ceil(text.length / 3.8);
}

export function structuralScore(text: string): StructuralAnalysis {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const checks: Array<[string, boolean, number]> = [
    ["role or persona", ROLE_MARKERS.test(text), 15],
    ["output format", FORMAT_MARKERS.test(text), 20],
    ["constraints", CONSTRAINT_MARKERS.test(text), 20],
    ["audience", AUDIENCE_MARKERS.test(text), 15],
    ["length or depth", LENGTH_MARKERS.test(text), 15],
    ["example", EXAMPLE_MARKERS.test(text), 5],
    ["enough detail", words.length >= 30, 10],
  ];

  const present = checks.filter(([, ok]) => ok).map(([name]) => name);
  const missing = checks.filter(([, ok]) => !ok).map(([name]) => name);
  const score = checks.reduce((sum, [, ok, weight]) => sum + (ok ? weight : 0), 0);

  let fillerChars = 0;
  for (const pattern of FILLER) {
    for (const match of text.matchAll(pattern)) {
      fillerChars += match[0].length;
    }
  }

  return {
    score,
    present,
    missing,
    fillerTokens: Math.ceil(fillerChars / 3.8),
    wordCount: words.length,
  };
}

/**
 * Category keywords, deliberately excluding words that are common across
 * categories. "audience", "copy", "post", and "script" all look like content
 * signals but appear constantly in coding and business prompts, and including
 * them made every well-specified prompt tie against `content`.
 *
 * All patterns carry /g because they are counted, not just tested.
 */
const CATEGORY_KEYWORDS: Record<Category, RegExp> = {
  coding:
    /\b(code|function|bug|refactor|api|typescript|python|javascript|rust|sql|compile|debug|unit test|class|component|endpoint|repo|git|parser|migration)\b/gi,
  education:
    /\b(explain|teach|learn|lesson|student|quiz|curriculum|tutor|homework|beginner|syllabus|worked example)\b/gi,
  research:
    /\b(research|literature|evidence|analy[sz]e|compare|citation|survey|findings|hypothesis|peer[- ]reviewed|methodology)\b/gi,
  content:
    /\b(blog|article|caption|tweet|newsletter|headline|seo|marketing|copywriting|social post|landing page|brand voice)\b/gi,
  business:
    /\b(memo|strategy|proposal|stakeholder|revenue|roadmap|okr|pitch deck|budget|quarterly|board)\b/gi,
  image:
    /\b(image|photo|illustration|render|midjourney|dall[- ]?e|stable diffusion|drawing|logo|portrait|wallpaper|aspect ratio)\b/gi,
};

/**
 * Keyword classification by margin.
 *
 * Counts distinct keyword hits per category and returns the leader only when
 * it is a strict leader. A tie carries no information, so it falls through to
 * the model rather than guessing. Counting beats a boolean match because real
 * prompts routinely touch two categories in passing while being clearly about
 * one of them.
 */
export function guessCategory(text: string): Category | null {
  const scores = CATEGORIES.map((category) => {
    const pattern = CATEGORY_KEYWORDS[category];
    // Distinct terms, so repeating one word does not outweigh variety.
    const hits = new Set(
      [...text.matchAll(pattern)].map((m) => m[0].toLowerCase()),
    );
    return { category, count: hits.size };
  }).sort((a, b) => b.count - a.count);

  const [top, runnerUp] = scores;
  if (top.count === 0) return null;
  if (runnerUp && runnerUp.count >= top.count) return null;
  return top.category;
}

/**
 * Whether stage 1 can be skipped for this draft.
 *
 * Requires both a confident category and a structurally complete draft. The
 * bar is high on purpose: skipping analysis on a vague draft produces a worse
 * rewrite, and a bad result costs more than the API call it saved.
 */
export function canSkipAnalysis(
  text: string,
  explicitCategory?: Category,
): { skip: boolean; category: Category | null; structural: StructuralAnalysis } {
  const structural = structuralScore(text);
  const category = explicitCategory ?? guessCategory(text);
  return {
    skip: category !== null && structural.score >= 70 && structural.wordCount >= 25,
    category,
    structural,
  };
}
