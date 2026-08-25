/**
 * Claude model catalog.
 *
 * Rates are Anthropic first-party API list prices in USD per 1M tokens.
 * Source: Anthropic pricing, cached 2026-06-24. Bedrock / Vertex are
 * partner-operated and priced separately — do not use this table for those.
 */

export type ClaudeModelId =
  | "claude-opus-5"
  | "claude-sonnet-5"
  | "claude-haiku-4-5";

export interface ModelSpec {
  id: ClaudeModelId;
  label: string;
  /** Max input tokens (context window). */
  contextWindow: number;
  /** USD per 1M input tokens. */
  inputPerMTok: number;
  /** USD per 1M output tokens. */
  outputPerMTok: number;
  /**
   * Promotional pricing that expires. When `now` is before `until`, the
   * promo rates apply instead of the list rates above.
   */
  introPricing?: {
    inputPerMTok: number;
    outputPerMTok: number;
    /** ISO date, exclusive upper bound. */
    until: string;
  };
  /** `output_config.effort` is rejected on models older than Opus 4.5. */
  supportsEffort: boolean;
  /** Adaptive thinking (`thinking: {type: "adaptive"}`). Older models need budget_tokens. */
  supportsAdaptiveThinking: boolean;
}

export const MODELS: Record<ClaudeModelId, ModelSpec> = {
  "claude-opus-5": {
    id: "claude-opus-5",
    label: "Claude Opus 5",
    contextWindow: 1_000_000,
    inputPerMTok: 5.0,
    outputPerMTok: 25.0,
    supportsEffort: true,
    supportsAdaptiveThinking: true,
  },
  "claude-sonnet-5": {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    contextWindow: 1_000_000,
    inputPerMTok: 3.0,
    outputPerMTok: 15.0,
    introPricing: {
      inputPerMTok: 2.0,
      outputPerMTok: 10.0,
      until: "2026-09-01",
    },
    supportsEffort: true,
    supportsAdaptiveThinking: true,
  },
  "claude-haiku-4-5": {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    contextWindow: 200_000,
    inputPerMTok: 1.0,
    outputPerMTok: 5.0,
    // Haiku 4.5 predates output_config.effort and adaptive thinking.
    // Sending either returns a 400.
    supportsEffort: false,
    supportsAdaptiveThinking: false,
  },
};

/**
 * Cache pricing multipliers, applied to a model's input rate.
 * Writing to cache costs ~1.25x; reading from it costs ~0.1x.
 */
export const CACHE_WRITE_MULTIPLIER = 1.25;
export const CACHE_READ_MULTIPLIER = 0.1;

/** Resolves the rates in effect at `now`, honouring promotional pricing. */
export function ratesFor(
  model: ClaudeModelId,
  now: Date = new Date(),
): { inputPerMTok: number; outputPerMTok: number; promotional: boolean } {
  const spec = MODELS[model];
  const intro = spec.introPricing;
  if (intro && now < new Date(intro.until)) {
    return {
      inputPerMTok: intro.inputPerMTok,
      outputPerMTok: intro.outputPerMTok,
      promotional: true,
    };
  }
  return {
    inputPerMTok: spec.inputPerMTok,
    outputPerMTok: spec.outputPerMTok,
    promotional: false,
  };
}
