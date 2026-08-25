import { formatUSD } from "@/lib/cost";
import type { PromptEconomics } from "@/lib/types";

/**
 * What the *generated* prompt costs to run, per model.
 *
 * Anthropic rows are computed from measured token counts and verified rates.
 * The others are labelled estimates, and the caveat under the table is not
 * decoration — the third-party rates in `providers.ts` ship unverified.
 */
export function ProjectionTable({ economics }: { economics: PromptEconomics }) {
  const { projections, promptTokens, originalPromptTokens, tokenDelta } =
    economics;
  const anyUnverified = projections.some((p) => !p.model.verified);

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h3 className="text-sm font-semibold mb-1">Cost to run this prompt</h3>
      <p className="text-xs text-muted mb-4 tabular-nums">
        {promptTokens.toLocaleString()} tokens, vs{" "}
        {originalPromptTokens.toLocaleString()} in your draft (
        {tokenDelta >= 0 ? "+" : ""}
        {tokenDelta.toLocaleString()}) · assuming a{" "}
        {economics.assumedOutputTokens.toLocaleString()}-token response
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[26rem]">
          <thead>
            <tr className="text-muted text-left">
              <th className="font-normal pb-2">Model</th>
              <th className="font-normal pb-2 text-right">Prompt tokens</th>
              <th className="font-normal pb-2 text-right">Per run</th>
              <th className="font-normal pb-2 text-right">Per 1,000 runs</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {projections.map((p) => (
              <tr key={p.model.id} className="border-t border-border">
                <td className="py-2">
                  {p.model.label}
                  {!p.model.verified && (
                    <span
                      className="ml-1.5 text-[10px] uppercase tracking-wide text-warn"
                      title="Rates in providers.ts have not been verified against the provider"
                    >
                      est
                    </span>
                  )}
                </td>
                <td className="py-2 text-right">
                  {p.promptTokens.toLocaleString()}
                </td>
                <td className="py-2 text-right">{formatUSD(p.costPerRun)}</td>
                <td className="py-2 text-right">
                  {formatUSD(p.costPer1kRuns)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {anyUnverified && (
        <p className="mt-3 text-xs text-warn">
          Rows marked <strong>est</strong> use placeholder rates and an
          approximate tokenizer ratio. Update them in{" "}
          <code className="font-mono">src/lib/providers.ts</code> from each
          provider&rsquo;s own pricing page before relying on the numbers.
        </p>
      )}
      {economics.approximate && (
        <p className="mt-2 text-xs text-warn">
          Token counting failed for this request; figures fall back to a local
          estimate.
        </p>
      )}
    </section>
  );
}
