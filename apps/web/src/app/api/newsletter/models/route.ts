import { NextResponse } from "next/server";
import { getBalances } from "@/lib/newsletter/balances";
import { fallbackFalModels, fallbackOpenRouterModels, getFalImageModels, getOpenRouterModels } from "@/lib/newsletter/providers";

export async function GET() {
  const balancesPromise = getBalances();
  const [openRouterResult, falResult] = await Promise.allSettled([getOpenRouterModels(), getFalImageModels()]);
  return NextResponse.json({
    openRouterModels: openRouterResult.status === "fulfilled" ? openRouterResult.value : fallbackOpenRouterModels(),
    falModels: falResult.status === "fulfilled" ? falResult.value : fallbackFalModels(),
    modelErrors: {
      openRouter: openRouterResult.status === "rejected" ? String(openRouterResult.reason) : null,
      fal: falResult.status === "rejected" ? String(falResult.reason) : null,
    },
    balances: await balancesPromise,
  });
}
