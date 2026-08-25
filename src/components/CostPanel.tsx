import { formatUSD } from "@/lib/cost";
import { MODELS } from "@/lib/models";
import type { OptimizeResponse } from "@/lib/types";

/**
 * What PromptMaker spent generating this prompt.
 *
 * These are measured figures taken from the Messages API `usage` object, not
 * estimates — which is why they get to be stated plainly.
 */
export function CostPanel({ response }: { response: OptimizeResponse }) {
  const { ledger, generationCost, cacheHit, skippedAnalysis, elapsedMs } =
    response;

  const savedPct =
    generationCost.uncachedEquivalentCost > 0
      ? Math.round(
          (generationCost.cacheSavings /
            generationCost.uncachedEquivalentCost) *
            100,
        )
      : 0;

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <header className="flex items-baseline justify-between gap-4 mb-4">
        <h3 className="text-sm font-semibold">Generation cost</h3>
        <span className="text-xs text-muted tabular-nums">
          {(elapsedMs / 1000).toFixed(1)}s
        </span>
      </header>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-semibold tabular-nums">
          {formatUSD(generationCost.totalCost)}
        </span>
        {generationCost.cacheSavings > 0 && (
          <span className="text-xs text-good">
            {savedPct}% below {formatUSD(generationCost.uncachedEquivalentCost)}{" "}
            uncached
          </span>
        )}
      </div>

      <p className="text-xs text-muted mb-4 tabular-nums">
        {generationCost.totalInputTokens.toLocaleString()} in ·{" "}
        {generationCost.totalOutputTokens.toLocaleString()} out
      </p>

      {(cacheHit || skippedAnalysis) && (
        <ul className="mb-4 space-y-1">
          {cacheHit && (
            <li className="text-xs text-good">
              Served from the response cache — this request cost nothing.
            </li>
          )}
          {skippedAnalysis && (
            <li className="text-xs text-good">
              Analysis stage skipped: local heuristics resolved the category and
              found the draft structurally complete. One fewer API call.
            </li>
          )}
        </ul>
      )}

      {ledger.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted text-left">
              <th className="font-normal pb-2">Stage</th>
              <th className="font-normal pb-2">Model</th>
              <th className="font-normal pb-2 text-right">Cached in</th>
              <th className="font-normal pb-2 text-right">Fresh in</th>
              <th className="font-normal pb-2 text-right">Out</th>
              <th className="font-normal pb-2 text-right">Cost</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {ledger.map(({ stage, cost }) => (
              <tr key={stage} className="border-t border-border">
                <td className="py-2 capitalize">{stage}</td>
                <td className="py-2 text-muted">{MODELS[cost.model].label}</td>
                <td className="py-2 text-right text-good">
                  {cost.cacheReadTokens.toLocaleString()}
                </td>
                <td className="py-2 text-right">
                  {(cost.inputTokens + cost.cacheWriteTokens).toLocaleString()}
                </td>
                <td className="py-2 text-right">
                  {cost.outputTokens.toLocaleString()}
                </td>
                <td className="py-2 text-right">{formatUSD(cost.totalCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {ledger.some((l) => l.cost.promotionalPricing) && (
        <p className="mt-3 text-xs text-muted">
          Includes promotional Sonnet 5 pricing, which expires 2026-09-01.
        </p>
      )}
    </section>
  );
}
