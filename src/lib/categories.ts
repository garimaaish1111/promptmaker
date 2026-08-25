/**
 * Category playbooks.
 *
 * Each playbook is loaded as its own `system` block with its own cache
 * breakpoint, so a run only pays for the one playbook it needs — and repeat
 * runs in the same category read it from cache at 0.1x. Loading all six on
 * every request would multiply the cached prefix for no gain.
 *
 * Keep each playbook byte-stable. Any edit invalidates that category's cache
 * entry (and only that one — the shared core rubric sits in an earlier block).
 */

export const CATEGORIES = [
  "coding",
  "education",
  "research",
  "content",
  "business",
  "image",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface CategoryMeta {
  id: Category;
  label: string;
  blurb: string;
  /** Typical response length, used for cross-provider cost projection. */
  typicalOutputTokens: number;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  coding: {
    id: "coding",
    label: "Coding",
    blurb: "Implementation, debugging, refactors, code review",
    typicalOutputTokens: 1500,
  },
  education: {
    id: "education",
    label: "Education",
    blurb: "Explanations, lesson plans, tutoring, study material",
    typicalOutputTokens: 900,
  },
  research: {
    id: "research",
    label: "Research",
    blurb: "Literature synthesis, analysis, comparison, fact-finding",
    typicalOutputTokens: 1200,
  },
  content: {
    id: "content",
    label: "Content",
    blurb: "Copy, articles, scripts, social, marketing",
    typicalOutputTokens: 800,
  },
  business: {
    id: "business",
    label: "Business",
    blurb: "Strategy, docs, emails, analysis, planning",
    typicalOutputTokens: 700,
  },
  image: {
    id: "image",
    label: "Image generation",
    blurb: "Prompts for image models — subject, style, composition",
    typicalOutputTokens: 150,
  },
};

export const CATEGORY_PLAYBOOKS: Record<Category, string> = {
  coding: `## Playbook: coding

A strong coding prompt pins down the runtime before it describes the task.

Required slots. If the user's input leaves one blank, either infer it from
context or report it as a gap:
- Language and version, framework and version, runtime or platform.
- Where the code lives: new file, existing file, snippet in isolation.
- Existing conventions to match: naming, error handling, test framework.
- What "done" means: passing tests, specific behaviour, performance target.
- Constraints: no new dependencies, backwards compatibility, size limits.

Output-format rules for the prompt you generate:
- Ask for complete, runnable code rather than fragments with ellipses.
- Ask for the reasoning to come after the code, not before, so the answer is
  usable without scrolling.
- If the task is a fix, ask for the diff or the changed function only, not a
  rewrite of the whole file.
- Require that assumptions be stated explicitly rather than silently chosen.

Anti-patterns to strip from the user's draft:
- "Write the best possible code" is unmeasurable and wastes tokens.
- Asking for several alternative implementations when one is wanted.
- Vague "make it efficient" without naming the axis: speed, memory, or calls.`,

  education: `## Playbook: education

A strong teaching prompt fixes the learner before it fixes the topic.

Required slots:
- Learner level: age or stage, and what they already know.
- Prior knowledge to assume, and terms that must be defined on first use.
- Goal: recall, understanding, or ability to apply.
- Format: explanation, worked example, lesson plan, quiz, analogy set.
- Length and depth ceiling.

Output-format rules for the prompt you generate:
- Ask for one concrete worked example per abstract idea.
- Where a misconception is common, ask for it to be named and corrected.
- For lesson plans, ask for timing per section.
- For quizzes, specify question count, type, and whether answers are included.

Anti-patterns to strip:
- "Explain simply" without saying simple for whom.
- Requesting a beginner and an expert treatment in the same response.
- Asking for a topic overview when the user has one specific confusion.`,

  research: `## Playbook: research

A strong research prompt bounds the question and states what counts as evidence.

Required slots:
- The precise question, narrowed down from the general topic.
- Scope: time period, geography, discipline, admissible source types.
- Depth: overview, comparison, or deep synthesis.
- How to handle uncertainty and conflicting sources.
- Citation expectations, and whether the model is allowed to browse.

Output-format rules for the prompt you generate:
- Ask for established claims to be separated from speculation.
- Ask for disagreement between sources to be surfaced, not averaged away.
- Request a structure: findings, evidence, gaps, what would change the answer.
- Ask explicitly for an admission of ignorance where the evidence is thin.

Anti-patterns to strip:
- Asking for citations from a model with no browsing access. This invites
  fabricated references. Either enable a search tool, or ask for unsourced
  reasoning that is labelled as unsourced.
- Leading questions that presuppose the conclusion.
- Unbounded "tell me everything about X".`,

  content: `## Playbook: content

A strong content prompt fixes audience, voice, and format before topic.

Required slots:
- Audience: who reads this, what they already believe, what they want.
- Channel and format: blog, email, landing page, script, thread.
- Voice and tone, ideally with a reference example.
- Length, as a word or character count, not "short".
- Call to action, or explicitly none.
- Things to avoid: claims, competitors, banned phrasing.

Output-format rules for the prompt you generate:
- Ask for structure up front, headline and sections, when the piece is long.
- Where a hook matters, ask for two or three options rather than one.
- Ask for concrete specifics in place of adjectives.

Anti-patterns to strip:
- "Make it engaging" or "make it pop". Replace with a measurable property.
- Requesting SEO keywords with no target keyword or stated search intent.
- Piling on tone adjectives that conflict: authoritative, playful, concise.`,

  business: `## Playbook: business

A strong business prompt supplies the situation the reader is actually in.

Required slots:
- Company and role context, and the decision being supported.
- Audience and their seniority. A board memo differs from a team update.
- Data or facts available, and what must not be invented.
- Format: memo, email, one-pager, deck outline, analysis.
- Length, tone, and a level of hedging appropriate to the stakes.

Output-format rules for the prompt you generate:
- Ask for the recommendation first and the supporting reasoning after.
- Ask for assumptions and risks to be listed separately.
- Where numbers are involved, require the model to state which figures came
  from the user and which are its own estimates.

Anti-patterns to strip:
- Asking for financial, legal, or medical conclusions stated as authoritative.
- Requesting invented data to fill gaps. Ask for labelled placeholders instead.
- "Make it professional" without saying which register.`,

  image: `## Playbook: image generation

Image prompts are dense noun phrases, not instructions. Optimize for
specificity per token. Every word should change the picture.

Required slots, in this order:
- Subject, with defining detail.
- Action or pose, if any.
- Setting and time of day.
- Composition: shot type, angle, framing.
- Lighting.
- Style medium: photograph, oil painting, 3D render, line art.
- Colour palette or mood.
- Technical parameters: aspect ratio, quality settings.

Output-format rules for the prompt you generate:
- Produce a comma-separated phrase list, not prose sentences.
- Put the subject first. Leading tokens carry the most weight.
- Include a short negative-prompt list where the target model supports one.
- Keep it under roughly 80 tokens unless the user asks for more. Image models
  dilute attention across long prompts rather than honouring every clause.

Anti-patterns to strip:
- Full sentences with articles and connectives. They burn tokens without
  changing the image.
- Contradictory style tags such as photorealistic combined with anime.
- Stacked quality boosters, for example "masterpiece, best quality, 8k, ultra
  HD, award winning". These have sharply diminishing returns.`,
};
