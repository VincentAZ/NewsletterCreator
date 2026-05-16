import type { Article, NewsletterDraft, ValidationResult } from "./types";
import { defaultCopyTaskPrompt } from "./prompts";

export function buildNewsletterPrompt(input: {
  articles: Article[];
  feedback?: string;
  previousDraft?: NewsletterDraft;
  taskPrompt?: string;
  target?: string;
}) {
  const articles = input.articles
    .slice(0, 40)
    .map((article, index) => {
      return `${index + 1}. ${article.title}
Source: ${article.source}
URL: ${article.url}
Published: ${article.published ?? "unknown"}
Summary: ${article.summary || "No summary provided."}`;
    })
    .join("\n\n");
  const previousDraft = input.previousDraft ? `\nPrevious draft JSON:\n${JSON.stringify(input.previousDraft)}` : "";
  const feedback = input.feedback ? `\nEditor feedback:\n${input.feedback}` : "";
  const target = input.target ? `\nRegeneration target:\n${input.target}` : "";
  const previousDraftJson = input.previousDraft ? JSON.stringify(input.previousDraft) : "";
  const template = input.taskPrompt?.trim() || defaultCopyTaskPrompt;
  const rendered = template
    .replaceAll("{{targetBlock}}", target)
    .replaceAll("{{feedbackBlock}}", feedback)
    .replaceAll("{{previousDraftBlock}}", previousDraft)
    .replaceAll("{{target}}", input.target ?? "")
    .replaceAll("{{feedback}}", input.feedback ?? "")
    .replaceAll("{{previousDraftJson}}", previousDraftJson)
    .replaceAll("{{articles}}", articles);

  return rendered.includes(articles) ? rendered : `${rendered}\n\nArticles:\n${articles}`;
}

export function validateNewsletterDraft(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObject(value)) {
    return { valid: false, errors: ["Draft is not an object."] };
  }
  for (const field of ["subject", "preheader", "intro", "imagePrompt"] as const) {
    if (typeof value[field] !== "string" || !value[field].trim()) {
      errors.push(`${field} is required.`);
    }
  }
  if (!Array.isArray(value.sections) || value.sections.length === 0) {
    errors.push("sections must be a non-empty array.");
  }
  if (typeof value.confidenceScore !== "number" || value.confidenceScore < 1 || value.confidenceScore > 10) {
    errors.push("confidenceScore must be a number from 1 to 10.");
  }
  if (!Array.isArray(value.editorialNotes)) {
    errors.push("editorialNotes must be an array.");
  }
  return { valid: errors.length === 0, errors };
}

export function parseDraftFromModel(content: string): NewsletterDraft {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  return normalizeDraft(JSON.parse(trimmed) as NewsletterDraft);
}

export function normalizeDraft(draft: NewsletterDraft): NewsletterDraft {
  return {
    subject: draft.subject ?? "",
    preheader: draft.preheader ?? "",
    intro: draft.intro ?? "",
    sections: (draft.sections ?? []).map((section, index) => ({
      id: section.id || slugify(section.heading || `section-${index + 1}`),
      heading: section.heading ?? "",
      summary: section.summary ?? "",
      items: (section.items ?? []).map((item) => ({
        title: item.title ?? "",
        url: item.url ?? "",
        source: item.source ?? "",
        summary: item.summary ?? "",
        whyItMatters: item.whyItMatters ?? "",
      })),
      feedback: section.feedback ?? "",
    })),
    imagePrompt: draft.imagePrompt ?? "",
    confidenceScore: Number(draft.confidenceScore ?? 1),
    editorialNotes: Array.isArray(draft.editorialNotes) ? draft.editorialNotes : [],
  };
}

export function createFallbackDraft(articles: Article[], feedback?: string): NewsletterDraft {
  const selected = articles.slice(0, 12);
  const groups = [
    ["frontier-models", "Frontier Models", selected.slice(0, 4)],
    ["developer-infrastructure", "Developer Infrastructure", selected.slice(4, 8)],
    ["market-and-policy", "Market and Policy", selected.slice(8, 12)],
  ] as const;
  return {
    subject: "Daily AI Brief: models, tools, and market signals",
    preheader: "A curated AI-news draft ready for editorial review.",
    intro: "Today's draft is assembled from the selected source queue. Review each section before publishing.",
    sections: groups
      .filter(([, , items]) => items.length > 0)
      .map(([id, heading, items]) => ({
        id,
        heading,
        summary: "A focused set of stories for this editorial bucket.",
        items: items.map((article) => ({
          title: article.title,
          url: article.url,
          source: article.source,
          summary: article.summary || "Source did not provide a summary.",
          whyItMatters: "This may affect AI product direction, developer workflows, or platform strategy.",
        })),
        feedback: "",
      })),
    imagePrompt:
      "Editorial hero image for an AI newsletter: luminous data streams crossing a clean newsroom desk, realistic cinematic lighting, no text, no logos.",
    confidenceScore: process.env.OPENROUTER_API_KEY ? 6 : 4,
    editorialNotes: [
      process.env.OPENROUTER_API_KEY
        ? "Fallback draft used because the model response could not be parsed."
        : "OPENROUTER_API_KEY is missing, so this deterministic draft was generated locally.",
      ...(feedback ? [`Pending editor feedback: ${feedback}`] : []),
    ],
  };
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
