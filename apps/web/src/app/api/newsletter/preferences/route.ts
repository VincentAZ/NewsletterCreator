import { NextResponse } from "next/server";
import { getPreferences, isPreferencesConfigured, savePreferences, PreferenceConflictError } from "@/lib/newsletter/preferences";
import type { NewsSource, PromptSet } from "@/lib/newsletter/types";

export async function GET(request: Request) {
  const preferenceId = new URL(request.url).searchParams.get("preferenceId") ?? "";

  if (!isPreferencesConfigured()) {
    return NextResponse.json({ configured: false, preferences: null });
  }

  try {
    return NextResponse.json({
      configured: true,
      preferences: preferenceId ? await getPreferences(preferenceId) : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        preferences: null,
        error: error instanceof Error ? error.message : "Unable to load preferences.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    preferenceId?: string;
    expectedRevision?: number;
    sources?: NewsSource[];
    copyModel?: string;
    scrapeModel?: string;
    imageModel?: string;
    currentPromptSet?: PromptSet | null;
    promptSets?: PromptSet[];
    lastPromptSetId?: string;
  };

  if (!isPreferencesConfigured()) {
    return NextResponse.json({ configured: false, preferences: null });
  }

  if (!body.preferenceId) {
    return NextResponse.json({ configured: true, error: "preferenceId is required" }, { status: 400 });
  }

  if (!Number.isSafeInteger(body.expectedRevision) || (body.expectedRevision ?? -1) < 0) {
    return NextResponse.json({ error: "expectedRevision is required" }, { status: 400 });
  }

  try {
    return NextResponse.json({
      configured: true,
      preferences: await savePreferences({
        preferenceId: body.preferenceId,
        expectedRevision: body.expectedRevision!,
        sources: Array.isArray(body.sources) ? body.sources : [],
        copyModel: body.copyModel ?? "",
        scrapeModel: body.scrapeModel ?? "",
        imageModel: body.imageModel ?? "",
        currentPromptSet: body.currentPromptSet ?? null,
        promptSets: Array.isArray(body.promptSets) ? body.promptSets : [],
        lastPromptSetId: body.lastPromptSetId ?? "",
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        preferences: null,
        error: error instanceof Error ? error.message : "Unable to save preferences.",
      },
      { status: error instanceof PreferenceConflictError ? 409 : 500 },
    );
  }
}
