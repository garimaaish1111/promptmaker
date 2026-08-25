import type { Category } from "./categories";
import type { CostBreakdown } from "./cost";
import type { UsageProjection } from "./providers";

/** Which model family the generated prompt is being written for. */
export const TARGET_FAMILIES = ["claude", "chatgpt", "gemini"] as const;
export type TargetFamily = (typeof TARGET_FAMILIES)[number];

/**
 * Quality/cost tier. This is the main lever the user has over spend.
 *
 * `economy`  — Haiku analysis, Sonnet synthesis at low effort.
 * `balanced` — Haiku analysis, Opus synthesis at medium effort. Default.
 * `max`      — Opus for both stages at xhigh effort, no shortcuts.
 */
export const MODES = ["economy", "balanced", "max"] as const;
export type Mode = (typeof MODES)[number];

export interface OptimizeRequest {
  rawPrompt: string;
  /** Omit to let stage 1 classify it. */
  category?: Category;
  target: TargetFamily;
  mode: Mode;
  tone?: string;
  audience?: string;
  outputFormat?: string;
  maxWords?: number;
  /** Set true to bypass the response cache for this request. */
  noCache?: boolean;
}

export interface ScoreCard {
  clarity: number;
  specificity: number;
  context: number;
  constraints: number;
  outputFormat: number;
  efficiency: number;
  overall: number;
}

export interface OptimizeResult {
  optimizedPrompt: string;
  category: Category;
  intent: string;
  /** Score of the ORIGINAL prompt, so the user sees the delta they gained. */
  score: ScoreCard;
  gaps: string[];
  assumptions: string[];
  placeholders: string[];
  suggestions: string[];
  efficiencyNotes: string[];
}

export interface StageLedger {
  stage: "analysis" | "synthesis";
  cost: CostBreakdown;
}

/** Cost of running the *generated* prompt, not of generating it. */
export interface PromptEconomics {
  promptTokens: number;
  originalPromptTokens: number;
  /**
   * Optimized minus original. Usually POSITIVE — a good prompt states things
   * the draft left out, and that costs tokens. The saving is downstream:
   * fewer re-runs to get a usable answer. Presented as a delta rather than a
   * "saved" figure so the number is not misread.
   */
  tokenDelta: number;
  assumedOutputTokens: number;
  projections: UsageProjection[];
  /** True when a count_tokens call failed and local estimates were used. */
  approximate: boolean;
}

export interface OptimizeResponse {
  result: OptimizeResult;
  /** What PromptMaker spent to produce this. Empty when served from cache. */
  ledger: StageLedger[];
  generationCost: {
    totalCost: number;
    uncachedEquivalentCost: number;
    cacheSavings: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  };
  economics: PromptEconomics;
  cacheHit: boolean;
  /** True when the heuristic pre-check judged the draft already strong. */
  skippedAnalysis: boolean;
  elapsedMs: number;
}
