import type { PromptSet } from "./types";

export const defaultCopySystemPrompt = "Return valid JSON only.";

export const defaultCopyTaskPrompt = `Create a concise daily AI-news newsletter from these articles. Return strict JSON only.
Shape: {"subject":"string","preheader":"string","intro":"string","sections":[{"id":"short-kebab-case","heading":"string","summary":"string","items":[{"title":"string","url":"string","source":"string","summary":"string","whyItMatters":"string"}]}],"imagePrompt":"string","confidenceScore":0,"editorialNotes":["string"]}.
Rules: use 3-5 sections, use only provided stories, keep a sharp factual tone, make imagePrompt a no-text/no-logo editorial hero image prompt, confidenceScore is 1-10.

Regeneration target:
{{target}}

Editor feedback:
{{feedback}}

Previous draft JSON:
{{previousDraftJson}}

Articles:
{{articles}}`;

export const defaultScrapeSystemPrompt =
  "You extract article candidates from source-page link context for an AI newsletter. Return valid JSON only.";

export const defaultScrapeTaskPrompt = `Source: {{sourceName}}
Source URL: {{sourceUrl}}
Page title: {{pageTitle}}
Max articles: {{maxArticles}}

Choose only real article/news/story links from this page context. Ignore navigation, category pages, legal pages, social links, ads, newsletters, sign-in links, and duplicate links. Prefer recent AI, model, developer, policy, product, or research stories.

Return this JSON shape:
{"articles":[{"title":"string","url":"absolute URL","summary":"one sentence reason this is a relevant story"}]}

Link candidates:
{{candidatesJson}}`;

export const defaultImageSystemPrompt =
  "Create an editorial newsletter hero image. Avoid text, logos, watermarks, UI chrome, brand marks, and distorted typography.";

export const defaultImageTaskPrompt = `{{systemPrompt}}

Image prompt:
{{imagePrompt}}

Editor image feedback:
{{feedback}}`;

export const defaultPromptSetId = "default-workflow-prompts";

export function createDefaultPromptSet(): PromptSet {
  return {
    id: defaultPromptSetId,
    name: "Default workflow prompts",
    scrapeSystemPrompt: defaultScrapeSystemPrompt,
    scrapeTaskPrompt: defaultScrapeTaskPrompt,
    copySystemPrompt: defaultCopySystemPrompt,
    copyTaskPrompt: defaultCopyTaskPrompt,
    imageSystemPrompt: defaultImageSystemPrompt,
    imageTaskPrompt: defaultImageTaskPrompt,
    globalFeedbackPrompt: "",
    imageFeedbackPrompt: "",
    updatedAt: new Date(0).toISOString(),
  };
}
