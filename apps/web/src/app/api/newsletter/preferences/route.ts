import { NextResponse } from "next/server";
import { getPreferences, isPreferencesConfigured, savePreferences } from "@/lib/newsletter/preferences";
import type { NewsSource } from "@/lib/newsletter/types";

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
    sources?: NewsSource[];
    copyModel?: string;
    imageModel?: string;
  };

  if (!isPreferencesConfigured()) {
    return NextResponse.json({ configured: false, preferences: null });
  }

  if (!body.preferenceId) {
    return NextResponse.json({ configured: true, error: "preferenceId is required" }, { status: 400 });
  }

  try {
    return NextResponse.json({
      configured: true,
      preferences: await savePreferences({
        preferenceId: body.preferenceId,
        sources: Array.isArray(body.sources) ? body.sources : [],
        copyModel: body.copyModel ?? "",
        imageModel: body.imageModel ?? "",
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        preferences: null,
        error: error instanceof Error ? error.message : "Unable to save preferences.",
      },
      { status: 500 },
    );
  }
}
