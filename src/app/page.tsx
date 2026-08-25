"use client";

import { useCallback, useMemo, useState } from "react";
import { CostPanel } from "@/components/CostPanel";
import { ProjectionTable } from "@/components/ProjectionTable";
import { ScoreBars } from "@/components/ScoreBars";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/categories";
import { roughTokenEstimate, structuralScore } from "@/lib/heuristics";
import { MODES, TARGET_FAMILIES, type Mode, type TargetFamily } from "@/lib/types";
import type { OptimizeResponse } from "@/lib/types";

const MODE_BLURB: Record<Mode, string> = {
  economy: "Haiku analysis, Sonnet synthesis. Cheapest.",
  balanced: "Haiku analysis, Opus synthesis. Default.",
  max: "Opus throughout, highest effort. Most expensive.",
};

const TARGET_LABEL: Record<TargetFamily, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
};

export default function Home() {
  const [rawPrompt, setRawPrompt] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [target, setTarget] = useState<TargetFamily>("claude");
  const [mode, setMode] = useState<Mode>("balanced");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");

  const [response, setResponse] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Live, free, local. No API call — this is the pre-flight the user gets for
  // nothing before deciding whether to spend anything.
  const preflight = useMemo(() => {
    if (rawPrompt.trim().length < 3) return null;
    return {
      structural: structuralScore(rawPrompt),
      tokens: roughTokenEstimate(rawPrompt),
    };
  }, [rawPrompt]);

  const submit = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawPrompt,
          category: category || undefined,
          target,
          mode,
          audience: audience || undefined,
          tone: tone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      setResponse(data as OptimizeResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, [rawPrompt, category, target, mode, audience, tone]);

  const copyPrompt = useCallback(async () => {
    if (!response) return;
    await navigator.clipboard.writeText(response.result.optimizedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [response]);

  const canSubmit = rawPrompt.trim().length >= 3 && !loading;

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-5 py-10">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">PromptMaker AI</h1>
        <p className="text-sm text-muted mt-1.5 max-w-2xl">
          Turn a rough instruction into a precise, model-specific prompt — and
          see exactly what it cost to generate and what it will cost to run.
        </p>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 items-start">
        {/* ─── Input ──────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <div>
            <label
              htmlFor="draft"
              className="block text-sm font-medium mb-2"
            >
              Your instruction
            </label>
            <textarea
              id="draft"
              value={rawPrompt}
              onChange={(e) => setRawPrompt(e.target.value)}
              rows={8}
              placeholder="write a function to clean up user data"
              className="w-full rounded-lg border border-border bg-surface p-3 text-sm font-mono resize-y focus:outline-none focus:border-accent"
            />
            {preflight && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="tabular-nums">~{preflight.tokens} tokens</span>
                <span>·</span>
                <span className="tabular-nums">
                  structural completeness {preflight.structural.score}/100
                </span>
                {preflight.structural.missing.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-warn">
                      missing {preflight.structural.missing.join(", ")}
                    </span>
                  </>
                )}
                {preflight.structural.fillerTokens > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-warn tabular-nums">
                      ~{preflight.structural.fillerTokens} filler tokens
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category | "")}
                className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm focus:outline-none focus:border-accent"
              >
                <option value="">Detect automatically</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_META[c].label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Target model">
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as TargetFamily)}
                className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm focus:outline-none focus:border-accent"
              >
                {TARGET_FAMILIES.map((t) => (
                  <option key={t} value={t}>
                    {TARGET_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Audience (optional)">
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="junior developers"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </Field>

            <Field label="Tone (optional)">
              <input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="direct, no fluff"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </Field>
          </div>

          <Field label="Cost tier">
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    mode === m
                      ? "border-accent bg-accent-soft"
                      : "border-border bg-surface hover:border-muted"
                  }`}
                >
                  <span className="block text-sm font-medium capitalize">
                    {m}
                  </span>
                  <span className="block text-[11px] text-muted leading-snug mt-0.5">
                    {MODE_BLURB[m]}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="w-full rounded-md bg-accent text-white px-4 py-2.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading ? "Optimizing…" : "Optimize prompt"}
          </button>

          {error && (
            <p className="rounded-md border border-bad/40 bg-bad/5 px-3 py-2 text-sm text-bad">
              {error}
            </p>
          )}
        </div>

        {/* ─── Output ─────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {!response && !loading && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted">
                Your optimized prompt, its quality score, and a full cost
                breakdown will appear here.
              </p>
            </div>
          )}

          {response && (
            <>
              <section className="rounded-lg border border-border bg-surface p-5">
                <header className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">Optimized prompt</h2>
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
                      {CATEGORY_META[response.result.category].label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={copyPrompt}
                    className="text-xs text-accent hover:underline"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </header>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed bg-background rounded-md border border-border p-3 max-h-96 overflow-y-auto">
                  {response.result.optimizedPrompt}
                </pre>
              </section>

              <section className="rounded-lg border border-border bg-surface p-5">
                <ScoreBars score={response.result.score} />
              </section>

              <CostPanel response={response} />
              <ProjectionTable economics={response.economics} />

              <NoteList
                title="Assumptions made"
                items={response.result.assumptions}
              />
              <NoteList
                title="Placeholders to fill in"
                items={response.result.placeholders}
                mono
              />
              <NoteList
                title="Suggestions"
                items={response.result.suggestions}
              />
              <NoteList
                title="Token efficiency notes"
                items={response.result.efficiencyNotes}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="block text-sm font-medium mb-2">{label}</span>
      {children}
    </div>
  );
}

function NoteList({
  title,
  items,
  mono,
}: {
  title: string;
  items: string[];
  mono?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h3 className="text-sm font-semibold mb-2.5">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className={`text-xs leading-relaxed text-muted pl-3 border-l-2 border-border ${
              mono ? "font-mono" : ""
            }`}
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
