import { _electron as electron, expect } from "@playwright/test";
import executablePath from "electron";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "newsletter-desktop-smoke-"));
const testEnv = { ...process.env, NEWSLETTER_TEST_DATA: directory };
delete testEnv.ELECTRON_RUN_AS_NODE;
const launch = () =>
  electron.launch({
    executablePath,
    args: ["--no-sandbox", "apps/desktop"],
    env: testEnv,
    timeout: 30000,
  });
let app;
try {
  app = await launch();
  const page = await app.firstWindow();
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await expect(page.getByText("A good newsletter starts here.")).toBeVisible();
  await page.screenshot({ path: "/tmp/newsletter-desktop-library.png" });
  await page
    .getByRole("button", { name: "Create your first newsletter" })
    .click();
  await page.getByRole("button", { name: "Community", exact: true }).click();
  await page
    .getByRole("button", { name: "Save newsletter", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start an issue", exact: false })
    .click();
  await page
    .getByLabel("Issue name", { exact: true })
    .fill("Neighborhood edition");
  await page
    .getByLabel("Email subject", { exact: true })
    .fill("A brighter weekend in the neighborhood");
  await page
    .getByLabel("Your introduction", { exact: true })
    .fill("A few good things to share with our neighbors this week.");
  await page.getByRole("button", { name: "＋ Text", exact: true }).click();
  await page
    .getByLabel("Heading", { exact: true })
    .fill("The community garden is growing");
  await page
    .getByLabel("Content", { exact: true })
    .fill(
      "Join us on Saturday morning to plant herbs, meet neighbors, and enjoy coffee together.",
    );
  await expect(
    page.getByRole("button", { name: "Saved on this computer", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/newsletter-desktop-editor.png" });
  await page.getByRole("button", { name: "Preview issue" }).click();
  await expect(
    page
      .frameLocator('iframe[title="Newsletter preview"]')
      .getByText("The community garden is growing"),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/newsletter-desktop-preview.png" });
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  await page.screenshot({ path: "/tmp/newsletter-desktop-text.png" });
  await expect(page.locator("pre")).toContainText("Join us on Saturday");
  expect(failures).toEqual([]);
  await app.close();
  app = await launch();
  const reopened = await app.firstWindow();
  await expect(
    reopened.getByText("Neighborhood edition", { exact: true }),
  ).toBeVisible();
  await reopened.getByText("Neighborhood edition", { exact: true }).click();
  await expect(reopened.getByLabel("Heading", { exact: true })).toHaveValue(
    "The community garden is growing",
  );
  console.log(
    "Desktop smoke passed: create newsletter, edit issue, preview HTML/plain text, restart recovery. No renderer exceptions.",
  );
} finally {
  if (app) await app.close().catch(() => {});
  rmSync(directory, { recursive: true, force: true });
}
