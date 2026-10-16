// Explicit opt-in hardware validation. Never run this during ordinary CI.
import { _electron as electron, expect } from "@playwright/test";
import executablePath from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { newProfile, newIssue, newBlock } from "../packages/core/src/index.ts";

const directory = resolve(
  process.env.NEWSLETTER_VALIDATION_DATA ||
    `apps/desktop/release/production-validation/${process.platform}`,
);
const installImage = process.argv.includes("--install-image");
const managedImage = installImage || process.argv.includes("--managed-image");
if (installImage && process.env.NEWSLETTER_ACCEPT_ENGINE_TERMS !== "1")
  throw new Error(
    "Review the pinned ComfyUI and SDXL terms in the setup manifest, then set NEWSLETTER_ACCEPT_ENGINE_TERMS=1 to test installation.",
  );
const textModel = process.env.NEWSLETTER_TEXT_MODEL || "";
if (!textModel && !managedImage)
  throw new Error(
    "Select a local text model or explicitly request --install-image.",
  );
mkdirSync(directory, { recursive: true });
const env = {
  ...process.env,
  NEWSLETTER_TEST_DATA: directory,
  NEWSLETTER_TEST_TRACE: "1",
  NEWSLETTER_ELECTRON_BINARY: executablePath,
};
delete env.ELECTRON_RUN_AS_NODE;
const report = {
  date: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  checks: [],
};
let app;
let page;
const launch = async () => {
  app = await electron.launch({
    executablePath: process.env.NEWSLETTER_ELECTRON_WRAPPER || executablePath,
    args: ["--no-sandbox", "apps/desktop"],
    env,
  });
  page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.newsletter));
  page.on("console", (message) => {
    if (message.text().startsWith("VALIDATION:")) console.log(message.text());
  });
  await page.evaluate(() => {
    let previous = "";
    window.newsletter.onProgress((p) => {
      const label = p.message.startsWith("Downloading")
        ? `${p.message} ${Math.floor((p.completed || 0) / 1024 ** 3)} GB`
        : p.message;
      if (label !== previous) console.log("VALIDATION:", label);
      previous = label;
    });
  });
};
const invoke = (command, input) =>
  page.evaluate(
    ([command, input]) => window.newsletter.invoke(command, input),
    [command, input],
  );
async function check(name, work) {
  const start = Date.now();
  try {
    const details = await work();
    report.checks.push({
      name,
      result: "passed",
      elapsedMs: Date.now() - start,
      details,
    });
    console.log(`${name}: passed`);
  } catch (error) {
    report.checks.push({
      name,
      result: "failed",
      elapsedMs: Date.now() - start,
      error: error.message,
    });
    console.error(`${name}: ${error.message}`);
    process.exitCode = 1;
  }
  writeFileSync(
    join(directory, "evidence.json"),
    JSON.stringify(report, null, 2),
  );
}
try {
  await launch();
  const library = await invoke("library", {});
  await invoke("settings", {
    ...library.settings,
    textProvider: "local",
    imageProvider: "local",
    textModel,
    lmUrl: process.env.NEWSLETTER_LM_URL || "http://127.0.0.1:1234",
    comfyUrl: "http://127.0.0.1:18188",
  });
  report.hardware = (await invoke("setupStatus", {})).hardware;
  const profile = await invoke(
    "saveProfile",
    newProfile("Community hardware validation"),
  );
  let issue = await invoke("saveIssue", {
    ...newIssue(profile.id),
    subject: "Community weekend",
    intro: "Synthetic test data, not a real campaign.",
    blocks: [
      {
        ...newBlock("text"),
        title: "Saturday in the garden",
        body: "Neighbors can join a free community garden cleanup on Saturday at 10 AM. Bring gloves. Everyone is welcome.",
      },
    ],
  });
  if (textModel)
    await check("existing local text engine targeted generation", async () => {
      const result = await invoke("generate", {
        jobId: crypto.randomUUID(),
        issueId: issue.id,
        blockId: issue.blocks[0].id,
        feedback:
          "Make this warmer and concise, preserving all factual details.",
      });
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].body.length).toBeGreaterThan(20);
      expect(
        (await invoke("library", {})).issues.find((i) => i.id === issue.id)
          .blocks[0].body,
      ).toBe(issue.blocks[0].body);
      return { model: textModel, characters: result.blocks[0].body.length };
    });
  if (managedImage) {
    await check(
      `${installImage ? "managed ComfyUI installation and" : "managed ComfyUI"} SDXL generation`,
      async () => {
        if (installImage)
          await invoke("install", {
            jobId: crypto.randomUUID(),
            engine: "image",
            acceptTerms: true,
          });
        else await invoke("startEngine", { engine: "image" });
        const image = await invoke("image", {
          jobId: crypto.randomUUID(),
          prompt:
            "A small community garden in warm morning light, editorial illustration, no words or logos.",
        });
        issue = await invoke("saveIssue", {
          ...issue,
          blocks: [
            ...issue.blocks,
            {
              ...newBlock("image"),
              assetId: image.assetId,
              alt: "Community garden",
            },
          ],
        });
        const data = await invoke("readAsset", { id: image.assetId });
        expect(data).toMatch(/^data:image\/(png|jpeg|webp);base64,/);
        await invoke("stopEngine", { engine: "image" });
        await invoke("startEngine", { engine: "image" });
        await invoke("stopEngine", { engine: "image" });
        return { assetId: image.assetId, encodedBytes: data.length };
      },
    );
    await check(
      "managed image cancellation releases the engine and allows restart",
      async () => {
        await invoke("startEngine", { engine: "image" });
        const jobId = crypto.randomUUID();
        const outcome = invoke("image", {
          jobId,
          prompt: "Synthetic cancellation test, a community garden.",
        }).then(
          () => "completed",
          (error) => error.message,
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        await invoke("cancel", { jobId });
        expect(await outcome).toMatch(/cancel|abort/i);
        expect(
          (await invoke("setupStatus", {})).engines.find(
            (e) => e.id === "image",
          ).connected,
        ).toBe(false);
        await invoke("startEngine", { engine: "image" });
        await invoke("stopEngine", { engine: "image" });
      },
    );
  }
  await check(
    "real issue and generated assets survive application restart",
    async () => {
      await app.close();
      await launch();
      const saved = (await invoke("library", {})).issues.find(
        (i) => i.id === issue.id,
      );
      expect(saved.blocks).toEqual(issue.blocks);
      for (const block of saved.blocks.filter((b) => b.assetId))
        expect(await invoke("readAsset", { id: block.assetId })).toContain(
          "base64,",
        );
      return {
        issueId: issue.id,
        assets: saved.blocks.filter((b) => b.assetId).length,
      };
    },
  );
} finally {
  if (app) await app.close().catch(() => {});
  writeFileSync(
    join(directory, "evidence.json"),
    JSON.stringify(report, null, 2),
  );
}
