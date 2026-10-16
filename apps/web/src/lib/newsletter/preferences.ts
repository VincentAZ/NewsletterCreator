import { loadLocalEnv } from "./env";
import { normalizeSources } from "./sources";
import type { NewsletterPreferences, NewsSource, PromptFieldKey, PromptSet } from "./types";

type PreferenceRow = {
  preference_id: string;
  revision: number;
  sources: NewsSource[];
  copy_model: string | null;
  scrape_model: string | null;
  image_model: string | null;
  current_prompt_set: PromptSet | null;
  prompt_sets: PromptSet[] | null;
  last_prompt_set_id: string | null;
  updated_at: string;
};

export type PreferencePayload = {
  preferenceId: string;
  expectedRevision: number;
  sources: NewsSource[];
  copyModel: string;
  scrapeModel: string;
  imageModel: string;
  currentPromptSet: PromptSet | null;
  promptSets: PromptSet[];
  lastPromptSetId: string;
};

export function isPreferencesConfigured() {
  loadLocalEnv();
  return Boolean(getSupabaseUrl() && getSupabaseKey());
}

export async function getPreferences(preferenceId: string): Promise<NewsletterPreferences | null> {
  const client = getSupabaseRestClient();
  if (!client || !isValidPreferenceId(preferenceId)) {
    return null;
  }

  const response = await fetch(
    `${client.url}/rest/v1/newsletter_preferences?preference_id=eq.${encodeURIComponent(preferenceId)}&select=*`,
    {
      headers: client.headers,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(await formatSupabaseError(response, "lookup"));
  }

  const rows = (await response.json()) as PreferenceRow[];
  return rows[0] ? rowToPreferences(rows[0]) : null;
}

export async function savePreferences(payload: PreferencePayload): Promise<NewsletterPreferences | null> {
  const client = getSupabaseRestClient();
  if (!client || !isValidPreferenceId(payload.preferenceId)) {
    return null;
  }

  const updatedAt = new Date().toISOString();
  const row = {
    preference_id: payload.preferenceId,
    revision: payload.expectedRevision + 1,
    sources: normalizeSources(payload.sources),
    copy_model: payload.copyModel || null,
    scrape_model: payload.scrapeModel || null,
    image_model: payload.imageModel || null,
    current_prompt_set: normalizeCurrentPromptSet(payload.currentPromptSet),
    prompt_sets: normalizePromptSets(payload.promptSets),
    last_prompt_set_id: payload.lastPromptSetId || null,
    updated_at: updatedAt,
  };
  const response = await fetch(
    payload.expectedRevision === 0
      ? `${client.url}/rest/v1/newsletter_preferences?on_conflict=preference_id`
      : `${client.url}/rest/v1/newsletter_preferences?preference_id=eq.${encodeURIComponent(payload.preferenceId)}&revision=eq.${payload.expectedRevision}`,
    {
      method: payload.expectedRevision === 0 ? "POST" : "PATCH",
      headers: { ...client.headers, "Content-Type": "application/json", Prefer: payload.expectedRevision === 0 ? "resolution=ignore-duplicates,return=representation" : "return=representation" },
      body: JSON.stringify(row),
    },
  );

  if (!response.ok) {
    throw new Error(await formatSupabaseError(response, "save"));
  }

  const rows = (await response.json()) as PreferenceRow[];
  if (!rows[0]) throw new PreferenceConflictError();
  return rowToPreferences(rows[0]);
}

export class PreferenceConflictError extends Error {
  constructor() { super("Preferences changed in another window. Reload preferences before saving again."); }
}

function rowToPreferences(row: PreferenceRow): NewsletterPreferences {
  if (!Number.isSafeInteger(row.revision)) throw new Error("Preferences schema needs updating. Run npm run db:ensure-schema before saving.");
  const preferences: NewsletterPreferences = {
    preferenceId: row.preference_id,
    revision: row.revision,
    sources: normalizeSources(Array.isArray(row.sources) ? row.sources : []),
    copyModel: row.copy_model ?? "",
    scrapeModel: row.scrape_model ?? "",
    imageModel: row.image_model ?? "",
    currentPromptSet: normalizeCurrentPromptSet(row.current_prompt_set),
    promptSets: normalizePromptSets(Array.isArray(row.prompt_sets) ? row.prompt_sets : []),
    lastPromptSetId: row.last_prompt_set_id ?? "",
    updatedAt: row.updated_at,
  };

  return preferences;
}

type SupabaseRestClient = {
  url: string;
  headers: Record<string, string>;
};

async function formatSupabaseError(response: Response, action: "lookup" | "save") {
  const detail = await response.text().catch(() => "");
  const message = parseSupabaseErrorMessage(detail);
  const lowerMessage = message.toLowerCase();
  return [
    `Supabase preferences ${action} failed with ${response.status}.`,
    message,
    lowerMessage.includes("revision") ||
    lowerMessage.includes("scrape_model") ||
    lowerMessage.includes("current_prompt_set") ||
    lowerMessage.includes("prompt_sets") ||
    lowerMessage.includes("last_prompt_set_id")
      ? "Run npm run db:ensure-schema to update the newsletter_preferences columns."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeCurrentPromptSet(promptSet: PromptSet | null | undefined): PromptSet | null {
  if (!promptSet) {
    return null;
  }

  return normalizePromptSets([promptSet])[0] ?? null;
}

function normalizePromptSets(promptSets: PromptSet[]): PromptSet[] {
  return promptSets
    .map((promptSet) => ({
      id: normalizePromptSetId(promptSet.id),
      name: String(promptSet.name ?? "").trim().slice(0, 120),
      scrapeSystemPrompt: String(promptSet.scrapeSystemPrompt ?? ""),
      scrapeTaskPrompt: String(promptSet.scrapeTaskPrompt ?? ""),
      copySystemPrompt: String(promptSet.copySystemPrompt ?? ""),
      copyTaskPrompt: String(promptSet.copyTaskPrompt ?? ""),
      imageSystemPrompt: String(promptSet.imageSystemPrompt ?? ""),
      imageTaskPrompt: String(promptSet.imageTaskPrompt ?? ""),
      globalFeedbackPrompt: String(promptSet.globalFeedbackPrompt ?? ""),
      imageFeedbackPrompt: String(promptSet.imageFeedbackPrompt ?? ""),
      promptNames: normalizePromptNames(promptSet.promptNames),
      savedPromptFields: normalizePromptFieldList(promptSet.savedPromptFields),
      deletedPromptFields: normalizePromptFieldList(promptSet.deletedPromptFields),
      updatedAt: String(promptSet.updatedAt ?? new Date().toISOString()),
    }))
    .filter((promptSet) => promptSet.id && promptSet.name);
}

const promptFieldKeys: PromptFieldKey[] = [
  "scrapeSystemPrompt",
  "scrapeTaskPrompt",
  "copySystemPrompt",
  "copyTaskPrompt",
  "imageSystemPrompt",
  "imageTaskPrompt",
  "globalFeedbackPrompt",
  "imageFeedbackPrompt",
];

function normalizePromptNames(value: PromptSet["promptNames"]): PromptSet["promptNames"] {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    promptFieldKeys
      .map((key) => [key, String(value[key] ?? "").trim().slice(0, 120)] as const)
      .filter((entry): entry is [PromptFieldKey, string] => Boolean(entry[1])),
  );
}

function normalizePromptFieldList(value: PromptSet["savedPromptFields"]): PromptFieldKey[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return promptFieldKeys.filter((key) => value.includes(key));
}

function normalizePromptSetId(value: string) {
  const normalized = String(value ?? "").trim();
  return /^[a-zA-Z0-9_-]{8,80}$/.test(normalized) ? normalized : "";
}

function parseSupabaseErrorMessage(detail: string) {
  if (!detail) {
    return "";
  }

  try {
    const payload = JSON.parse(detail) as { message?: string; details?: string; hint?: string };
    return [payload.message, payload.details, payload.hint].filter(Boolean).join(" ");
  } catch {
    return detail.slice(0, 240);
  }
}

function getSupabaseRestClient(): SupabaseRestClient | null {
  loadLocalEnv();
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  if (!url || !key) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  };
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function getSupabaseKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
}

function isValidPreferenceId(value: string) {
  return /^[a-zA-Z0-9_-]{8,80}$/.test(value);
}
