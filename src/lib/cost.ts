import type Anthropic from "@anthropic-ai/sdk";
import {
  CACHE_READ_MULTIPLIER,
  CACHE_WRITE_MULTIPLIER,
  ratesFor,
  type ClaudeModelId,
} from "./models";

export interface CostBreakdown {
  model: ClaudeModelId;
  /** Uncached input tokens, billed at the full input rate. */
  inputTokens: number;
  /** Tokens written to the cache this request, billed at 1.25x input. */
  cacheWriteTokens: number;
  /** Tokens served from cache, billed at 0.1x input. */
  cacheReadTokens: number;
  outputTokens: number;
  inputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  outputCost: number;
  totalCost: number;
  /**
   * What this request would have cost with no cache hits at all — the
   * baseline the savings figure is measured against.
   */
  uncachedEquivalentCost: number;
  cacheSavings: number;
  promotionalPricing: boolean;
}

const EMPTY_USAGE = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};

type UsageLike = Partial<Anthropic.Usage> | null | undefined;

/** Turns a Messages API `usage` object into a priced, cache-aware breakdown. */
export function priceUsage(
  model: ClaudeModelId,
  usage: UsageLike,
  now: Date = new Date(),
): CostBreakdown {
  const u = { ...EMPTY_USAGE, ...(usage ?? {}) };
  const inputTokens = u.input_tokens ?? 0;
  const outputTokens = u.output_tokens ?? 0;
  const cacheWriteTokens = u.cache_creation_input_tokens ?? 0;
  const cacheReadTokens = u.cache_read_input_tokens ?? 0;

  const { inputPerMTok, outputPerMTok, promotional } = ratesFor(model, now);
  const perInputToken = inputPerMTok / 1_000_000;
  const perOutputToken = outputPerMTok / 1_000_000;

  const inputCost = inputTokens * perInputToken;
  const cacheWriteCost =
    cacheWriteTokens * perInputToken * CACHE_WRITE_MULTIPLIER;
  const cacheReadCost = cacheReadTokens * perInputToken * CACHE_READ_MULTIPLIER;
  const outputCost = outputTokens * perOutputToken;
  const totalCost = inputCost + cacheWriteCost + cacheReadCost + outputCost;

  // Without caching every input token would bill at the full rate.
  const uncachedEquivalentCost =
    (inputTokens + cacheWriteTokens + cacheReadTokens) * perInputToken +
    outputCost;

  return {
    model,
    inputTokens,
    cacheWriteTokens,
    cacheReadTokens,
    outputTokens,
    inputCost,
    cacheWriteCost,
    cacheReadCost,
    outputCost,
    totalCost,
    uncachedEquivalentCost,
    cacheSavings: uncachedEquivalentCost - totalCost,
    promotionalPricing: promotional,
  };
}

/** Sums per-stage breakdowns into one ledger for the whole request. */
export function sumCosts(parts: CostBreakdown[]): {
  totalCost: number;
  uncachedEquivalentCost: number;
  cacheSavings: number;
  totalInputTokens: number;
  totalOutputTokens: number;
} {
  return parts.reduce(
    (acc, p) => ({
      totalCost: acc.totalCost + p.totalCost,
      uncachedEquivalentCost:
        acc.uncachedEquivalentCost + p.uncachedEquivalentCost,
      cacheSavings: acc.cacheSavings + p.cacheSavings,
      totalInputTokens:
        acc.totalInputTokens +
        p.inputTokens +
        p.cacheWriteTokens +
        p.cacheReadTokens,
      totalOutputTokens: acc.totalOutputTokens + p.outputTokens,
    }),
    {
      totalCost: 0,
      uncachedEquivalentCost: 0,
      cacheSavings: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    },
  );
}

/** Formats a USD amount with enough precision to stay non-zero at these scales. */
export function formatUSD(amount: number): string {
  if (amount === 0) return "$0";
  if (amount < 0.01) return `$${amount.toFixed(5)}`;
  if (amount < 1) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}
