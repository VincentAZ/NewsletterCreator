import { _electron as electron, expect } from "@playwright/test";
import executablePath from "electron";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const directory = mkdtempSync(join(tmpdir(), "newsletter-studio-"));
const testEnv = { ...process.env, NEWSLETTER_TEST_DATA: directory };
delete testEnv.ELECTRON_RUN_AS_NODE;
let app;
try {
  app = await electron.launch({
    executablePath,
    args: ["--no-sandbox", "apps/desktop"],
    env: testEnv,
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole("button", { name: "Create your first newsletter" })
    .click();
  await page
    .getByLabel("Newsletter name", { exact: true })
    .fill("Garden Notes");
  await page
    .getByRole("button", { name: "Save newsletter", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start an issue", exact: false })
    .click();
  await page
    .getByLabel("Email subject", { exact: true })
    .pressSequentially("A Saturday worth sharing");
  await expect(page.getByLabel("Email subject", { exact: true })).toHaveValue(
    "A Saturday worth sharing",
  );
  await expect(
    page.getByRole("button", { name: "Saved on this computer", exact: true }),
  ).toBeVisible();
  const ids = await page.evaluate(async () => {
    const api = window.newsletter;
    const library = await api.invoke("library", {});
    const profile = library.profiles[0];
    profile.sources = [
      {
        id: crypto.randomUUID(),
        name: "Community Gazette",
        type: "rss",
        url: "https://example.com/feed",
        enabled: true,
      },
      {
        id: crypto.randomUUID(),
        name: "Unavailable feed",
        type: "rss",
        url: "https://example.com/missing",
        enabled: true,
      },
    ];
    await api.invoke("saveProfile", profile);
    const issue = library.issues[0];
    issue.title = "Saturday in the garden";
    issue.intro = "Neighbors, here is what is happening this weekend.";
    issue.articles = Array.from({ length: 24 }, (_, index) => ({
      id: crypto.randomUUID(),
      title:
        index === 0
          ? "The community garden is growing"
          : `Neighborhood story ${index}`,
      url: `https://example.com/story/${index}`,
      source: index % 2 ? "Local Library" : "Community Gazette",
      published: index === 1 ? null : "2026-10-15T12:00:00.000Z",
      excerpt: `Useful excerpt ${index}. A few things worth sharing with neighbors.`,
      content:
        index === 1
          ? ""
          : `Complete article ${index}: verified source material for this fixture.`,
      coverage: index === 1 ? "excerpt" : "full",
      selected: index === 0,
      retrievedAt: "2026-10-16T12:00:00.000Z",
    }));
    issue.blocks = [
      {
        id: crypto.randomUUID(),
        kind: "text",
        title: "A note from the organizer",
        body: "Bring a friend and a pair of gardening gloves.",
        url: "",
        sourceIds: [],
        assetId: "",
        alt: "",
      },
    ];
    await api.invoke("saveIssue", issue);
    for (const name of ["Bakery Dispatch", "The AI Brief"]) {
      const other = { ...profile, id: crypto.randomUUID(), name, revision: 0 };
      await api.invoke("saveProfile", other);
      await api.invoke("saveIssue", {
        ...issue,
        id: crypto.randomUUID(),
        profileId: other.id,
        title: `${name} · October`,
        revision: 0,
      });
    }
    return {
      issue: issue.id,
      original: issue.blocks[0].id,
      article: issue.articles[0].id,
    };
  });
  await page.reload();
  await page
    .locator(".issue-title")
    .filter({ hasText: "Saturday in the garden" })
    .click();
  const toolbar = page.locator(".studio-toolbar");
  await expect(
    page.getByRole("complementary", {
      name: "Live email preview",
      exact: true,
    }),
  ).toBeVisible();
  await toolbar.getByRole("button", { name: "Sources", exact: true }).click();
  await expect(
    page.getByRole("complementary", {
      name: "Live email preview",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByLabel("Find stories").fill("garden");
  await expect(page.locator(".story-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Read source", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Complete article 0");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Read source", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Add to issue", exact: true }).click();
  await expect(page.locator(".editor-block")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Go to block", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go to block", exact: true }).click();
  await expect(page.locator(".editor-block")).toHaveCount(2);
  const story = page.locator(".editor-block").last();
  await story
    .getByRole("button", { name: "Duplicate block", exact: true })
    .click();
  await expect(page.locator(".editor-block")).toHaveCount(3);
  await page
    .locator(`#block-${ids.original}`)
    .getByLabel("Content", { exact: true })
    .fill("A later edit that undo must preserve.");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".editor-block")).toHaveCount(2);
  await expect(
    page
      .locator(`#block-${ids.original}`)
      .getByLabel("Content", { exact: true }),
  ).toHaveValue("A later edit that undo must preserve.");
  await page.locator(".editor-block").last().focus();
  await page
    .locator(".editor-block")
    .last()
    .getByRole("button", { name: "Move block up" })
    .click();
  await expect(
    page
      .locator(".editor-block")
      .first()
      .getByLabel("Heading", { exact: true }),
  ).toHaveValue("The community garden is growing");
  await page.locator(".editor-block").first().focus();
  await page.keyboard.press("Control+z");
  await expect(
    page
      .locator(".editor-block")
      .first()
      .getByLabel("Heading", { exact: true }),
  ).toHaveValue("A note from the organizer");

  // Inject failures at the IPC boundary; ordinary save, assets, and export still use real services.
  await app.evaluate(({ ipcMain }) => {
    const original = ipcMain._invokeHandlers.get("newsletter:invoke");
    globalThis.studioFixture = { mode: "success", calls: 0 };
    ipcMain.removeHandler("newsletter:invoke");
    ipcMain.handle("newsletter:invoke", async (event, command, input) => {
      if (command === "gather")
        return {
          ok: true,
          value: {
            articles: [],
            outcomes: [
              { name: "Community Gazette", count: 0 },
              {
                name: "Unavailable feed",
                count: 0,
                error: "Source is temporarily unavailable",
              },
            ],
          },
        };
      if (command === "generate") {
        globalThis.studioFixture.calls++;
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (globalThis.studioFixture.mode === "failure")
          return {
            ok: false,
            error:
              "Local model returned malformed output. Your draft is unchanged.",
          };
        const lib = await original(event, "library", {});
        const issue = lib.value.issues.find(
          (value) => value.id === input.issueId,
        );
        const block =
          issue.blocks.find((value) => value.id === input.blockId) ||
          issue.blocks.find((value) => value.kind === "story");
        return {
          ok: true,
          value: {
            subject: "A fresh garden edition",
            preheader: "The weekend ahead",
            intro: "An edited introduction.",
            blocks: [
              {
                ...block,
                title: "Refined garden story",
                body: "Clear and concise garden news.",
              },
            ],
          },
        };
      }
      return original(event, command, input);
    });
  });
  await page.getByRole("button", { name: "Gather", exact: true }).click();
  await expect(page.getByText("Some sources could not be read")).toBeVisible();
  await expect(page.locator(".collection-result")).toContainText(
    "1 of 2 sources succeeded",
  );
  await expect(page.locator(".editor-block")).toHaveCount(2);
  await page.getByLabel("Find stories").fill("");
  await page.getByLabel("Filter by source").selectOption("Local Library");
  await expect(page.locator(".story-card")).toHaveCount(12);
  await expect(page.getByText("Date unknown", { exact: true })).toBeVisible();
  await expect(page.getByText("Excerpt only", { exact: true })).toBeVisible();
  await page.getByLabel("Filter by source").selectOption("");
  await page.getByRole("button", { name: "Selected (1)", exact: true }).click();
  await expect(page.locator(".story-card")).toHaveCount(1);
  await toolbar.getByRole("button", { name: "Sources", exact: true }).click();
  await expect(
    page.getByRole("complementary", {
      name: "Live email preview",
      exact: true,
    }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Draft with AI", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "1 original blocks stay",
  );
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.closest("dialog") !== null),
    )
    .toBe(true);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest("dialog")),
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await app.evaluate(() => globalThis.studioFixture.calls)).toBe(0);
  await app.evaluate(() => {
    globalThis.studioFixture.mode = "failure";
  });
  await page
    .getByRole("button", { name: "Draft with AI", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Replace generated copy", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("malformed output");
  await expect(page.locator(".editor-block")).toHaveCount(2);
  await expect(
    page
      .locator(`#block-${ids.original}`)
      .getByLabel("Content", { exact: true }),
  ).toHaveValue("A later edit that undo must preserve.");
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await app.evaluate(() => {
    globalThis.studioFixture.mode = "success";
  });
  await page.locator(".editor-block").last().focus();
  await page
    .locator(".editor-block")
    .last()
    .getByRole("button", { name: "Rewrite", exact: true })
    .click();
  await page.getByRole("button", { name: "Shorter", exact: true }).click();
  await page
    .getByRole("button", { name: "Rewrite this block", exact: true })
    .click();
  await expect(
    page.locator(".editor-block").last().getByLabel("Heading", { exact: true }),
  ).toHaveValue("Refined garden story");
  await expect(
    page
      .locator(`#block-${ids.original}`)
      .getByLabel("Content", { exact: true }),
  ).toHaveValue("A later edit that undo must preserve.");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.locator(".editor-block").last().getByLabel("Heading", { exact: true }),
  ).toHaveValue("The community garden is growing");

  await page
    .getByRole("button", { name: "Draft with AI", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Replace generated copy", exact: true })
    .click();
  await expect(
    page.getByLabel("Your introduction", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.locator(".editor-block").last().getByLabel("Heading", { exact: true }),
  ).toHaveValue("Refined garden story");
  await expect(
    page
      .locator(`#block-${ids.original}`)
      .getByLabel("Content", { exact: true }),
  ).toHaveValue("A later edit that undo must preserve.");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByLabel("Your introduction", { exact: true }),
  ).toHaveValue("Neighbors, here is what is happening this weekend.");

  const longTitle =
    "Saturday in the garden: neighbors, volunteers, autumn planting, the community harvest, and everything happening this month";
  await page.locator(".email-details summary").click();
  await page.getByLabel("Issue name", { exact: true }).fill(longTitle);
  await page.locator(".email-details summary").click();
  await page
    .locator(`#block-${ids.original}`)
    .getByLabel("Content", { exact: true })
    .fill(
      "A later edit that undo must preserve.\n" +
        "Our neighborhood has plenty of news to share. ".repeat(100),
    );

  const imagePath = join(directory, "fixture.png");
  writeFileSync(
    imagePath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [path],
    });
  }, imagePath);
  await page.getByRole("button", { name: "Image", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Choose an image from this computer",
      exact: true,
    })
    .click();
  await expect(page.locator(".editor-block img")).toHaveCount(1);
  await page.locator(".editor-block").last().focus();
  await page
    .locator(".editor-block")
    .last()
    .getByRole("button", { name: "Duplicate block", exact: true })
    .click();
  await expect(page.locator(".editor-block img")).toHaveCount(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".editor-block img")).toHaveCount(1);

  const sizes = [
    [940, 680],
    [1280, 800],
    [1440, 900],
    [1920, 1080],
  ];
  const metrics = [];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    if (width < 1100) {
      // Shrinking the workspace must not open a modal over the editor.
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await toolbar
        .getByRole("button", { name: "Sources", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Source inbox", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `/tmp/newsletter-studio-${width}-sources.png`,
      });
      await page.keyboard.press("Escape");
      await expect(
        toolbar.getByRole("button", { name: "Sources", exact: true }),
      ).toBeFocused();
    } else {
      if (
        (await toolbar
          .getByRole("button", { name: "Preview", exact: true })
          .getAttribute("aria-pressed")) !== "true"
      )
        await toolbar
          .getByRole("button", { name: "Preview", exact: true })
          .click();
      if (width >= 1600)
        await toolbar
          .getByRole("button", { name: "Sources", exact: true })
          .click();
      const separator = page.getByRole("separator", {
        name: "Resize Preview panel",
      });
      await separator.focus();
      await page.keyboard.press("End");
      await expect(separator).toHaveAttribute("aria-valuenow", "400");
      await page.keyboard.press("Home");
      await expect(separator).toHaveAttribute("aria-valuenow", "280");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      await expect(separator).toHaveAttribute("aria-valuenow", "320");
    }
    const metric = await page.evaluate(() => {
      const editor = document.querySelector(".studio-editor-scroll");
      return {
        width: innerWidth,
        editor: editor.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth > innerWidth,
        pageHeight: document.documentElement.scrollHeight,
        viewportHeight: innerHeight,
        columnOverflow:
          document.querySelector(".studio-columns").scrollWidth >
          document.querySelector(".studio-columns").clientWidth,
      };
    });
    expect(metric.editor).toBeGreaterThanOrEqual(560);
    expect(metric.overflow).toBe(false);
    expect(metric.pageHeight).toBeLessThanOrEqual(metric.viewportHeight);
    expect(metric.columnOverflow).toBe(false);
    metrics.push(metric);
    if (width >= 1100) {
      await expect
        .poll(() =>
          page.locator(".studio iframe").evaluate((frame) => {
            const doc = frame.contentDocument;
            return Boolean(
              doc?.documentElement &&
              doc.documentElement.scrollWidth <= frame.clientWidth,
            );
          }),
        )
        .toBe(true);
      await expect
        .poll(() =>
          page
            .locator(".studio-panel")
            .last()
            .evaluate((panel) => panel.scrollWidth <= panel.clientWidth),
        )
        .toBe(true);
    }
    await page.locator(".studio-editor-scroll").evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({ path: `/tmp/newsletter-studio-${width}.png` });
  }
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1.25),
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  if (await page.getByRole("dialog").count())
    await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/newsletter-studio-zoom125.png" });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole("button", { name: "Preview & Export", exact: true })
    .click();
  for (const name of ["Mobile", "Desktop"]) {
    await page
      .locator(".export-view")
      .getByRole("button", { name, exact: true })
      .click();
    await expect
      .poll(() =>
        page.locator(".export-view iframe").evaluate((frame) => {
          const email = frame.contentDocument?.querySelector("body > table");
          if (!email) return false;
          const expected = Math.max(500, email.getBoundingClientRect().height);
          return Math.abs(frame.clientHeight - expected) < 2;
        }),
      )
      .toBe(true);
  }
  const destination = join(directory, "newsletter.html");
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, destination);
  await page.getByRole("button", { name: "Export HTML", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Exported to");
  const html = readFileSync(destination, "utf8");
  expect(html).toContain("A later edit that undo must preserve.");
  expect(html).toContain("data:image/png;base64,");
  await expect(
    page
      .frameLocator(".export-view iframe")
      .getByText("A later edit that undo must preserve."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to writing", exact: true })
    .click();

  // Exercise a real SQLite revision conflict: no stale overwrite and no navigation away.
  await expect(
    page.getByRole("button", { name: "Saved on this computer", exact: true }),
  ).toBeVisible();
  await page.evaluate(async (id) => {
    const library = await window.newsletter.invoke("library", {});
    const current = library.issues.find((issue) => issue.id === id);
    await window.newsletter.invoke("saveIssue", {
      ...current,
      intro: "A newer saved revision",
    });
  }, ids.issue);
  await page
    .getByLabel("Your introduction", { exact: true })
    .fill("My unsaved competing revision");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".studio-mount")).toBeVisible();
  await expect(
    page.getByLabel("Your introduction", { exact: true }),
  ).toHaveValue("My unsaved competing revision");
  const saved = await page.evaluate(
    async (id) =>
      (await window.newsletter.invoke("library", {})).issues.find(
        (issue) => issue.id === id,
      ),
    ids.issue,
  );
  expect(saved.intro).toBe("A newer saved revision");
  expect(saved.blocks.some((block) => block.assetId)).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    "Studio passed: source filters/insertion, scoped undo, modal focus, rewrite failure/retry, real image persistence/export, responsive panes, zoom and stale-save navigation protection.",
    JSON.stringify(metrics),
  );
} finally {
  if (app) {
    await app
      .evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().forEach((window) => window.destroy()),
      )
      .catch(() => {});
    await app.close().catch(() => {});
  }
  rmSync(directory, { recursive: true, force: true });
}
