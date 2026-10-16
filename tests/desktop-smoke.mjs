import { _electron as electron, expect } from "@playwright/test";
import executablePath from "electron";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "newsletter-desktop-smoke-"));
const testEnv = {
  ...process.env,
  NEWSLETTER_TEST_DATA: directory,
  NEWSLETTER_TEST_TRACE: "1",
};
delete testEnv.ELECTRON_RUN_AS_NODE;
const launch = () =>
  electron.launch({
    executablePath,
    args: [
      "--no-sandbox",
      `--log-net-log=${join(directory, "chromium-network.json")}`,
      "apps/desktop",
    ],
    env: testEnv,
    timeout: 30000,
  });
let app;
const localEngine = createServer(async (request, response) => {
  for await (const _chunk of request) {
    /* consume the model request */
  }
  response.setHeader("Content-Type", "application/json");
  response.end(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              subject: "Unused",
              preheader: "",
              intro: "",
              blocks: [
                {
                  title: "Refined garden note",
                  body: "Join your neighbors on Saturday.",
                  sourceIds: [],
                },
              ],
            }),
          },
        },
      ],
    }),
  );
});
await new Promise((resolve) => localEngine.listen(0, "127.0.0.1", resolve));
const engineOrigin = `http://127.0.0.1:${localEngine.address().port}`;
const traceFile = join(directory, "network.jsonl");
const trace = () =>
  existsSync(traceFile)
    ? readFileSync(traceFile, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(JSON.parse)
    : [];
try {
  app = await launch();
  const page = await app.firstWindow();
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await expect(page.getByText("A good newsletter starts here.")).toBeVisible();
  expect(trace()).toEqual([]);
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
  await page.getByRole("button", { name: "Text", exact: true }).click();
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
      .frameLocator('.export-view iframe[title="Newsletter preview"]')
      .getByText("The community garden is growing"),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/newsletter-desktop-preview.png" });
  await page
    .locator(".export-view")
    .getByRole("button", { name: "Plain text", exact: true })
    .click();
  await page.screenshot({ path: "/tmp/newsletter-desktop-text.png" });
  await expect(page.locator("pre")).toContainText("Join us on Saturday");
  const generated = await page.evaluate(async (origin) => {
    const library = await window.newsletter.invoke("library", {});
    await window.newsletter.invoke("settings", {
      ...library.settings,
      lmUrl: origin,
      textModel: "fixture-local-model",
    });
    const issue = library.issues[0];
    const result = await window.newsletter.invoke("generate", {
      jobId: crypto.randomUUID(),
      issueId: issue.id,
      blockId: issue.blocks[0].id,
      feedback: "Shorter",
    });
    const after = await window.newsletter.invoke("library", {});
    return {
      title: result.blocks[0].title,
      unchanged: JSON.stringify(issue) === JSON.stringify(after.issues[0]),
    };
  }, engineOrigin);
  expect(generated).toEqual({ title: "Refined garden note", unchanged: true });
  expect(trace().length).toBe(1);
  expect(trace().every((entry) => entry.origin === engineOrigin)).toBe(true);
  expect(failures).toEqual([]);
  await app.close();
  const chromiumRequests = JSON.parse(
    readFileSync(join(directory, "chromium-network.json"), "utf8"),
  )
    .events.filter((event) => /^https?:/.test(event.params?.url || ""))
    .map((event) => event.params.url);
  expect(chromiumRequests).toEqual([]);
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
    "Desktop smoke passed: create/edit, HTML/plain-text preview, local provider IPC, unchanged source draft, restart recovery. Startup: zero backend requests; generation: loopback only. No renderer exceptions.",
  );
} finally {
  if (app) await app.close().catch(() => {});
  await new Promise((resolve) => localEngine.close(resolve));
  rmSync(directory, { recursive: true, force: true });
}
