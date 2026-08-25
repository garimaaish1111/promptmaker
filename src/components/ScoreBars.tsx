import type { ScoreCard } from "@/lib/types";

const DIMENSIONS: Array<[keyof ScoreCard, string]> = [
  ["clarity", "Clarity"],
  ["specificity", "Specificity"],
  ["context", "Context"],
  ["constraints", "Constraints"],
  ["outputFormat", "Output format"],
  ["efficiency", "Token efficiency"],
];

function toneFor(value: number): string {
  if (value >= 75) return "var(--good)";
  if (value >= 45) return "var(--warn)";
  return "var(--bad)";
}

export function ScoreBars({ score }: { score: ScoreCard }) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <span
          className="text-4xl font-semibold tabular-nums"
          style={{ color: toneFor(score.overall) }}
        >
          {score.overall}
        </span>
        <span className="text-sm text-muted">
          / 100 — score of your original draft
        </span>
      </div>

      <div className="space-y-2.5">
        {DIMENSIONS.map(([key, label]) => {
          const value = score[key];
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-xs text-muted">{label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${value}%`,
                    backgroundColor: toneFor(value),
                  }}
                />
              </div>
              <span className="w-8 shrink-0 text-xs tabular-nums text-muted text-right">
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
