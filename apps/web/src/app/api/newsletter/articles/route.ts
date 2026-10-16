import { NextResponse } from "next/server";
import { getBalances } from "@/lib/newsletter/balances";
import { DEFAULT_NEWS_SOURCES, gatherArticles, normalizeSources } from "@/lib/newsletter/sources";
import type { NewsSource } from "@/lib/newsletter/types";

export async function GET() {
  return respondWithArticles(DEFAULT_NEWS_SOURCES, {});
}

export async function POST(request: Request) {
  const body = (await request.json()) as { sources?: NewsSource[]; scrapeModel?: string; scrapeSystemPrompt?: string; scrapeTaskPrompt?: string };
  return respondWithArticles(body.sources?.length ? normalizeSources(body.sources) : DEFAULT_NEWS_SOURCES, {
    scrapeModel: body.scrapeModel,
    scrapeSystemPrompt: body.scrapeSystemPrompt,
    scrapeTaskPrompt: body.scrapeTaskPrompt,
  });
}

async function respondWithArticles(sources: NewsSource[], options: { scrapeModel?: string; scrapeSystemPrompt?: string; scrapeTaskPrompt?: string }) {
  const balancesPromise = getBalances();
  try {
    const result = await gatherArticles(sources, options);
    const allFailed = result.sourceResults.length > 0 && result.sourceCount === 0;
    return NextResponse.json({ ...result, sources, balances: await balancesPromise,
      ...(allFailed ? { error: "Every source failed. Check the source errors and retry." } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to gather articles.",
        articles: [],
        sourceCount: 0,
        sources,
        balances: await balancesPromise,
      },
      { status: 500 },
    );
  }
}
