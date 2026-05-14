import { NextResponse } from "next/server";
import { getBalances } from "@/lib/newsletter/balances";
import { DEFAULT_NEWS_SOURCES, gatherArticles, normalizeSources } from "@/lib/newsletter/sources";
import type { NewsSource } from "@/lib/newsletter/types";

export async function GET() {
  return respondWithArticles(DEFAULT_NEWS_SOURCES);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { sources?: NewsSource[] };
  return respondWithArticles(body.sources?.length ? normalizeSources(body.sources) : DEFAULT_NEWS_SOURCES);
}

async function respondWithArticles(sources: NewsSource[]) {
  const balancesPromise = getBalances();
  try {
    return NextResponse.json({ ...(await gatherArticles(sources)), sources, balances: await balancesPromise });
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
