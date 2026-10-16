import { test, expect } from "@playwright/test";

const balance = { status: "unavailable", balance: null, currency: "USD", updatedAt: "" };
const balances = { openRouter: { ...balance, provider: "openrouter", label: "OpenRouter" }, fal: { ...balance, provider: "fal", label: "fal.ai" } };

test("failed preference load never writes defaults and offers a retry", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/newsletter/preferences*", async (route) => {
    if (route.request().method() === "PUT") writes++;
    await route.fulfill({ status: 500, json: { error: "Database temporarily unavailable" } });
  });
  await page.route("**/api/newsletter/balances", (route) => route.fulfill({ json: { balances } }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Reload saved preferences" })).toBeVisible();
  await page.waitForTimeout(900);
  expect(writes).toBe(0);
});

test("gather and draft failures release busy state and preserve retry", async ({ page }) => {
  await page.route("**/api/newsletter/preferences*", (route) => route.fulfill({ json: { configured: false, preferences: null } }));
  await page.route("**/api/newsletter/balances", (route) => route.fulfill({ json: { balances } }));
  await page.route("**/api/newsletter/models", (route) => route.fulfill({ json: { balances, openRouterModels: [{ id: "test", name: "Test" }], falModels: [{ id: "image", name: "Image" }], modelErrors: {} } }));
  let failGather = true;
  await page.route("**/api/newsletter/articles", (route) => route.fulfill(failGather ? { status: 500, json: { error: "Gather unavailable" } } : { json: { balances, sourceCount: 1, sourceResults: [{ id: "one", name: "Source", count: 1 }], articles: [{ id: "story", title: "Story", source: "Source", url: "https://example.com", summary: "Summary", published: null, score: 50 }] } }));
  await page.route("**/api/newsletter/draft", (route) => route.fulfill({ status: 500, json: { error: "Generation unavailable" } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Load models", exact: true }).click();
  await page.getByRole("button", { name: "Gather news", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Gather unavailable");
  await expect(page.getByRole("button", { name: "Gather news", exact: true })).toBeEnabled();
  failGather = false;
  await page.getByRole("button", { name: "Gather news", exact: true }).click();
  await page.getByRole("button", { name: "Generate copy", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Generation unavailable");
  await expect(page.getByRole("button", { name: "Generate copy", exact: true })).toBeEnabled();
});
