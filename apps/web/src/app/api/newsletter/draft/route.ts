import { NextResponse } from "next/server";
import { getBalances } from "@/lib/newsletter/balances";
import { validateNewsletterDraft } from "@/lib/newsletter/draft";
import { generateNewsletterDraft } from "@/lib/newsletter/providers";
import type { Article, NewsletterDraft } from "@/lib/newsletter/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    model?: string;
    articles?: Article[];
    feedback?: string;
    previousDraft?: NewsletterDraft;
    target?: string;
  };
  if (!body.model) return NextResponse.json({ error: "model is required", balances: await getBalances() }, { status: 400 });
  if (!Array.isArray(body.articles) || body.articles.length === 0) {
    return NextResponse.json({ error: "articles are required", balances: await getBalances() }, { status: 400 });
  }
  const result = await generateNewsletterDraft({
    model: body.model,
    articles: body.articles,
    feedback: body.feedback,
    previousDraft: body.previousDraft,
    target: body.target,
  });
  return NextResponse.json({
    draft: result.draft,
    validation: validateNewsletterDraft(result.draft),
    usedFallback: result.usedFallback,
    raw: result.raw,
    balances: await getBalances(),
  });
}
