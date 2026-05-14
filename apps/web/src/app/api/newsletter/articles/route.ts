import { NextResponse } from "next/server";
import { getBalances } from "@/lib/newsletter/balances";
import { gatherArticles } from "@/lib/newsletter/sources";

export async function GET() {
  const balancesPromise = getBalances();
  try {
    return NextResponse.json({ ...(await gatherArticles()), balances: await balancesPromise });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to gather articles.",
        articles: [],
        sourceCount: 0,
        balances: await balancesPromise,
      },
      { status: 500 },
    );
  }
}
