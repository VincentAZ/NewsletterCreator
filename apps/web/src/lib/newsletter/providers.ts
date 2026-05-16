import { buildNewsletterPrompt, createFallbackDraft, parseDraftFromModel, validateNewsletterDraft } from "./draft";
import { loadLocalEnv } from "./env";
import { defaultCopySystemPrompt, defaultImageTaskPrompt } from "./prompts";
import type { Article, GeneratedImage, NewsletterDraft, ProviderModel } from "./types";

export async function getOpenRouterModels(): Promise<ProviderModel[]> {
  loadLocalEnv();
  const apiKey = process.env.OPENROUTER_API_KEY;
  const response = await fetch("https://openrouter.ai/api/v1/models?output_modalities=text", {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`OpenRouter models failed with ${response.status}`);
  }
  const payload = (await response.json()) as {
    data?: Array<{ id: string; name?: string; description?: string; context_length?: number; pricing?: { prompt?: string; completion?: string } }>;
  };
  return (payload.data ?? []).map((model) => ({
    id: model.id,
    name: model.name ?? model.id,
    description: model.description,
    contextLength: model.context_length,
    pricing:
      model.pricing?.prompt || model.pricing?.completion
        ? `Prompt ${model.pricing.prompt ?? "?"} / completion ${model.pricing.completion ?? "?"}`
        : undefined,
  }));
}

export async function getFalImageModels(): Promise<ProviderModel[]> {
  loadLocalEnv();
  const apiKey = process.env.FAL_KEY;
  const response = await fetch("https://api.fal.ai/v1/models?category=text-to-image&status=active&limit=100", {
    headers: apiKey ? { Authorization: `Key ${apiKey}` } : {},
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`fal.ai models failed with ${response.status}`);
  }
  const payload = (await response.json()) as {
    models?: Array<{ endpoint_id: string; metadata?: { display_name?: string; description?: string; category?: string } }>;
  };
  return (payload.models ?? []).map((model) => ({
    id: model.endpoint_id,
    name: model.metadata?.display_name ?? model.endpoint_id,
    description: model.metadata?.description,
    category: model.metadata?.category,
  }));
}

export async function generateNewsletterDraft(input: {
  model: string;
  articles: Article[];
  feedback?: string;
  previousDraft?: NewsletterDraft;
  systemPrompt?: string;
  taskPrompt?: string;
  target?: string;
}): Promise<{ draft: NewsletterDraft; usedFallback: boolean; raw?: string }> {
  loadLocalEnv();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { draft: createFallbackDraft(input.articles, input.feedback), usedFallback: true };
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: [
        { role: "system", content: input.systemPrompt?.trim() || defaultCopySystemPrompt },
        { role: "user", content: buildNewsletterPrompt(input) },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    return { draft: createFallbackDraft(input.articles, input.feedback), usedFallback: true };
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content ?? "";
  try {
    const draft = parseDraftFromModel(content);
    const validation = validateNewsletterDraft(draft);
    return validation.valid
      ? { draft, usedFallback: false, raw: content }
      : { draft: createFallbackDraft(input.articles, input.feedback), usedFallback: true, raw: content };
  } catch {
    return { draft: createFallbackDraft(input.articles, input.feedback), usedFallback: true, raw: content };
  }
}

export async function generateFalImage(input: { model: string; prompt: string; feedback?: string; systemPrompt?: string; taskPrompt?: string }): Promise<GeneratedImage> {
  loadLocalEnv();
  const apiKey = process.env.FAL_KEY;
  const prompt = buildImagePrompt(input.prompt, input.systemPrompt, input.feedback, input.taskPrompt);
  if (!apiKey) {
    return {
      url: "/newsletter-placeholder.svg",
      contentType: "image/svg+xml",
      model: input.model,
      prompt,
      generatedAt: new Date().toISOString(),
    };
  }
  const response = await fetch(`https://fal.run/${input.model.replace(/^\/+/, "")}`, {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image_size: "landscape_16_9", num_images: 1, enable_safety_checker: true }),
  });
  if (!response.ok) {
    throw new Error(`fal.ai image generation failed with ${response.status}: ${(await response.text()).slice(0, 240)}`);
  }
  const payload = (await response.json()) as { images?: Array<{ url?: string; content_type?: string }>; image?: { url?: string; content_type?: string } };
  const image = payload.images?.[0] ?? payload.image;
  if (!image?.url) {
    throw new Error("fal.ai did not return an image URL.");
  }
  return { url: image.url, contentType: image.content_type ?? guessContentType(image.url), model: input.model, prompt, generatedAt: new Date().toISOString() };
}

function buildImagePrompt(prompt: string, systemPrompt?: string, feedback?: string, taskPrompt?: string) {
  const imagePrompt = prompt.trim();
  const template = taskPrompt?.trim() || defaultImageTaskPrompt;
  const rendered = template
    .replaceAll("{{systemPrompt}}", systemPrompt?.trim() ?? "")
    .replaceAll("{{imagePrompt}}", imagePrompt)
    .replaceAll("{{feedback}}", feedback?.trim() ?? "");

  return rendered.includes(imagePrompt) ? rendered : `${rendered}\n\nImage prompt:\n${imagePrompt}`;
}

export function fallbackOpenRouterModels(): ProviderModel[] {
  return [
    { id: "openai/gpt-4.1", name: "OpenAI GPT-4.1" },
    { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
    { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  ];
}

export function fallbackFalModels(): ProviderModel[] {
  return [
    { id: "fal-ai/flux/dev", name: "FLUX.1 dev", category: "text-to-image" },
    { id: "fal-ai/flux/schnell", name: "FLUX.1 schnell", category: "text-to-image" },
    { id: "fal-ai/imagen4/preview", name: "Imagen 4 Preview", category: "text-to-image" },
  ];
}

function guessContentType(url: string) {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  return "image/jpeg";
}
