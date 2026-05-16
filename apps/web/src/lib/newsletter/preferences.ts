import { loadLocalEnv } from "./env";
import { normalizeSources } from "./sources";
import type { NewsletterPreferences, NewsSource, PromptSet } from "./types";

type PreferenceRow = {
  preference_id: string;
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
    sources: normalizeSources(payload.sources),
    copy_model: payload.copyModel || null,
    scrape_model: payload.scrapeModel || null,
    image_model: payload.imageModel || null,
    current_prompt_set: normalizeCurrentPromptSet(payload.currentPromptSet),
    prompt_sets: normalizePromptSets(payload.promptSets),
    last_prompt_set_id: payload.lastPromptSetId || null,
    updated_at: updatedAt,
  };
  const response = await upsertPreferenceRowWithSchemaFallback(client, row);

  if (!response.ok) {
    throw new Error(await formatSupabaseError(response, "save"));
  }

  const rows = (await response.json()) as PreferenceRow[];
  return rows[0] ? rowToPreferences(rows[0]) : null;
}

function rowToPreferences(row: PreferenceRow): NewsletterPreferences {
  const preferences: NewsletterPreferences = {
    preferenceId: row.preference_id,
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

function upsertPreferenceRow(client: SupabaseRestClient, body: Record<string, unknown>) {
  return fetch(`${client.url}/rest/v1/newsletter_preferences?on_conflict=preference_id`, {
    method: "POST",
    headers: {
      ...client.headers,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(body),
  });
}

async function upsertPreferenceRowWithSchemaFallback(client: SupabaseRestClient, row: Record<string, unknown>) {
  const body = { ...row };
  const optionalColumns = new Set(["scrape_model", "image_model", "current_prompt_set", "prompt_sets", "last_prompt_set_id"]);

  for (let attempt = 0; attempt < optionalColumns.size + 1; attempt += 1) {
    const response = await upsertPreferenceRow(client, body);
    if (response.ok) {
      return response;
    }

    const detail = await response.text().catch(() => "");
    const missingColumn = extractMissingPreferenceColumn(detail);
    if (!missingColumn || !optionalColumns.has(missingColumn) || !(missingColumn in body)) {
      return responseFromText(response, detail);
    }

    delete body[missingColumn];
  }

  return upsertPreferenceRow(client, body);
}

function extractMissingPreferenceColumn(detail: string) {
  const message = parseSupabaseErrorMessage(detail);
  return (
    message.match(/column newsletter_preferences\.([a-z_]+) does not exist/i)?.[1] ??
    message.match(/Could not find the '([a-z_]+)' column of 'newsletter_preferences'/i)?.[1] ??
    ""
  );
}

function responseFromText(response: Response, detail: string) {
  return new Response(detail, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function formatSupabaseError(response: Response, action: "lookup" | "save") {
  const detail = await response.text().catch(() => "");
  const message = parseSupabaseErrorMessage(detail);
  const lowerMessage = message.toLowerCase();
  return [
    `Supabase preferences ${action} failed with ${response.status}.`,
    message,
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
      updatedAt: String(promptSet.updatedAt ?? new Date().toISOString()),
    }))
    .filter((promptSet) => promptSet.id && promptSet.name);
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
