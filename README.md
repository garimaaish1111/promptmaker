# PromptMaker AI

Turns a rough instruction into a precise, model-specific prompt — and reports
exactly what that cost to generate and what the result will cost to run.

Built on Next.js 16 (App Router, TypeScript) and the Claude API.

## Setup

```bash
cp .env.example .env.local   # then paste your key into .env.local
npm install
npm run dev
```

Open http://localhost:3000.

Without a key the UI still runs and the free pre-flight check still works —
only the optimize button needs credentials.

## How it works

A request goes through two stages, deliberately assigned to different models:

| Stage | Job | Model |
|---|---|---|
| Analysis | Classify the draft, find its gaps | Haiku 4.5 |
| Synthesis | Write the prompt, score the original | Opus 5 |

Splitting them is what makes it cheap. Classification is an easy job that does
not need a frontier model, and its output shrinks the expensive stage's task
from "work out what this is and fix it" to "fix this known list of gaps".

## Where the token and credit savings come from

Six mechanisms, roughly in order of impact:

**1. Response cache** — identical requests return in milliseconds for zero
tokens. Keyed on every field that changes the output. In-process and per
instance; swap `src/lib/cache.ts` for Redis before running more than one
instance.

**2. Prompt caching with a three-block prefix** — the synthesis `system` array
is ordered most-stable-first, each block with its own cache breakpoint:

```
[ core rubric      ] ← identical for every request, 1h TTL
[ category playbook] ← shared by everyone using that category
[ target notes     ] ← shared by that category + target model
--- cache breakpoints end here ---
messages: the user's draft   ← volatile, cannot invalidate anything above
```

Cached input bills at 0.1x. The user's text never appears in a `system` block,
so no request can invalidate another's prefix.

**3. Per-category playbook loading** — only the relevant one of six playbooks
is sent. Loading all six would multiply the cached prefix for no quality gain.

**4. Skipping the analysis stage** — `src/lib/heuristics.ts` scores structural
completeness and classifies by keyword margin, locally and for free. When it is
confident on both, stage 1 is skipped entirely: one fewer API call. The bar is
high on purpose, since a bad rewrite costs more than the call it saved.

**5. Cost tiers** — `economy` / `balanced` / `max` trade model quality against
spend, using `output_config.effort` to control thinking depth rather than
paying frontier rates for every request.

**6. Structured outputs** — `messages.parse()` with Zod schemas constrains the
response to valid JSON. No "reply with JSON only" boilerplate in the prompt, and
no retry loop when the model wraps its answer in prose.

Every figure shown in the Generation cost panel is measured from the Messages
API `usage` object, not estimated.

## Accuracy of the cost tables

Two different sets of numbers, held to different standards:

- **Generation cost** — measured. Rates in `src/lib/models.ts` are Anthropic
  first-party list prices, and token counts come from the API's own usage
  accounting. Promotional pricing is handled with an expiry date.
- **Cross-provider projection** — partly estimated. The Anthropic rows in
  `src/lib/providers.ts` are verified; **the OpenAI and Google rows are
  placeholders and are almost certainly stale.** They are marked `verified:
  false` and the UI labels them `est`. Update them from each provider's own
  pricing page before trusting them.

Non-Anthropic token counts are scaled by `tokenRatioVsClaude`, a crude factor.
Do not substitute tiktoken for Claude token counts — it is OpenAI's tokenizer
and undercounts Claude by roughly 15-20% on prose and more on code.

## Layout

```
src/
  app/
    page.tsx                 UI
    api/optimize/route.ts    the two-stage pipeline
    api/estimate/route.ts    free local pre-flight, no API call
  lib/
    pipeline.ts              stage orchestration and model assignment
    prompts.ts               system prompts and cache-block construction
    categories.ts            the six category playbooks
    heuristics.ts            zero-token local analysis
    cost.ts                  usage -> USD, cache-aware
    models.ts                Claude catalog and rates
    providers.ts             cross-provider projection
    cache.ts                 response cache
    schemas.ts               Zod schemas for structured outputs
```

## Notes on prompt injection

The draft a user submits is untrusted text. Two defences, both required:

- Drafts are wrapped in `<draft_prompt>` delimiters in the user message.
- The core rubric instructs the model to treat that content as raw material
  and never as instructions addressed to it.

Edits to `CORE_RUBRIC` should preserve both.
