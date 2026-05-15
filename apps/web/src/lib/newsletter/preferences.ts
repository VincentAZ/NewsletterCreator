import { loadLocalEnv } from "./env";
import { normalizeSources } from "./sources";
import type { NewsletterPreferences, NewsSource } from "./types";

type PreferenceRow = {
  preference_id: string;
  sources: NewsSource[];
  copy_model: string | null;
  image_model: string | null;
  updated_at: string;
};

export type PreferencePayload = {
  preferenceId: string;
  sources: NewsSource[];
  copyModel: string;
  imageModel: string;
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
    throw new Error(`Supabase preferences lookup failed with ${response.status}.`);
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
  const response = await upsertPreferenceRow(client, {
    preference_id: payload.preferenceId,
    sources: normalizeSources(payload.sources),
    copy_model: payload.copyModel || null,
    image_model: payload.imageModel || null,
    updated_at: updatedAt,
  });

  if (!response.ok) {
    throw new Error(`Supabase preferences save failed with ${response.status}.`);
  }

  const rows = (await response.json()) as PreferenceRow[];
  return rows[0] ? rowToPreferences(rows[0]) : null;
}

function rowToPreferences(row: PreferenceRow): NewsletterPreferences {
  const preferences: NewsletterPreferences = {
    preferenceId: row.preference_id,
    sources: normalizeSources(Array.isArray(row.sources) ? row.sources : []),
    copyModel: row.copy_model ?? "",
    imageModel: row.image_model ?? "",
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
