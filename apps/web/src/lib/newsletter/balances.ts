import type { Balances, ProviderBalance } from "./types";

const nowIso = () => new Date().toISOString();

function missing(provider: ProviderBalance["provider"], label: string, details: string): ProviderBalance {
  return { provider, status: "missing_key", label, balance: null, currency: "USD", updatedAt: nowIso(), details };
}

export async function getBalances(): Promise<Balances> {
  const [openRouter, fal] = await Promise.all([getOpenRouterBalance(), getFalBalance()]);
  return { openRouter, fal };
}

async function getOpenRouterBalance(): Promise<ProviderBalance> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return missing("openrouter", "OpenRouter", "OPENROUTER_API_KEY is not configured.");
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return providerError("openrouter", "OpenRouter", `Credits request failed with ${response.status}.`);
    }
    const payload = (await response.json()) as { data?: { total_credits?: number; total_usage?: number } };
    const total = payload.data?.total_credits;
    const used = payload.data?.total_usage;
    const balance = typeof total === "number" && typeof used === "number" ? total - used : null;
    return {
      provider: "openrouter",
      status: balance === null ? "unavailable" : "ready",
      label: "OpenRouter",
      balance,
      currency: "USD",
      updatedAt: nowIso(),
      details:
        typeof total === "number" && typeof used === "number"
          ? `Purchased ${total.toFixed(4)}, used ${used.toFixed(4)}.`
          : "Credits response did not include totals.",
    };
  } catch (error) {
    return providerError("openrouter", "OpenRouter", error instanceof Error ? error.message : "Unknown error.");
  }
}

async function getFalBalance(): Promise<ProviderBalance> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return missing("fal", "fal.ai", "FAL_KEY is not configured.");
  }

  try {
    const response = await fetch("https://api.fal.ai/v1/account/billing?expand=credits", {
      headers: { Authorization: `Key ${apiKey}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return providerError("fal", "fal.ai", `Billing request failed with ${response.status}. Admin key may be required.`);
    }
    const payload = (await response.json()) as {
      username?: string;
      credits?: { current_balance?: number; currency?: string };
    };
    const balance = payload.credits?.current_balance;
    return {
      provider: "fal",
      status: typeof balance === "number" ? "ready" : "unavailable",
      label: "fal.ai",
      balance: typeof balance === "number" ? balance : null,
      currency: payload.credits?.currency ?? "USD",
      updatedAt: nowIso(),
      details: payload.username ? `Workspace ${payload.username}.` : "Billing response did not include credits.",
    };
  } catch (error) {
    return providerError("fal", "fal.ai", error instanceof Error ? error.message : "Unknown error.");
  }
}

function providerError(provider: ProviderBalance["provider"], label: string, details: string): ProviderBalance {
  return { provider, status: "error", label, balance: null, currency: "USD", updatedAt: nowIso(), details };
}
