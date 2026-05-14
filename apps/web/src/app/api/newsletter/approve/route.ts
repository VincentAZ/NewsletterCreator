import { NextResponse } from "next/server";
import { getBalances } from "@/lib/newsletter/balances";
import { validateNewsletterDraft } from "@/lib/newsletter/draft";
import type { GeneratedImage, NewsletterDraft } from "@/lib/newsletter/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    draft?: NewsletterDraft;
    image?: GeneratedImage | null;
    status?: "approved" | "rejected";
    notes?: string;
  };
  const balances = await getBalances();

  if (!body.draft) {
    return NextResponse.json({ error: "draft is required", balances }, { status: 400 });
  }

  const validation = validateNewsletterDraft(body.draft);
  if (!validation.valid) {
    return NextResponse.json({ error: "draft failed validation", validation, balances }, { status: 400 });
  }

  return NextResponse.json({
    approval: {
      id: crypto.randomUUID(),
      status: body.status ?? "approved",
      approvedAt: new Date().toISOString(),
      notes: body.notes ?? "",
      draft: body.draft,
      image: body.image ?? null,
    },
    balances,
  });
}
