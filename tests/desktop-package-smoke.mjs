import { _electron as electron, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "newsletter-package-smoke-"));
const testEnv = { ...process.env };
delete testEnv.ELECTRON_RUN_AS_NODE;
const packagedExecutable = {
  linux: "linux-unpacked/newslettercreator",
  win32: "win-unpacked/newslettercreator.exe",
  darwin: "mac-arm64/newslettercreator.app/Contents/MacOS/newslettercreator",
}[process.platform];
if (!packagedExecutable) throw new Error("Unsupported package smoke platform");
let app;
try {
  app = await electron.launch({
    executablePath: resolve(
      process.argv[2] || `apps/desktop/release/${packagedExecutable}`,
    ),
    args: ["--no-sandbox", `--user-data-dir=${directory}`],
    env: testEnv,
  });
  const info = await app.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    directory: app.getPath("userData"),
  }));
  expect(info).toEqual({ packaged: true, directory });
  const page = await app.firstWindow();
  await expect(page.getByText("A good newsletter starts here.")).toBeVisible();
  const library = await page.evaluate(() =>
    window.newsletter.invoke("library", {}),
  );
  expect(library.profiles).toEqual([]);
  expect(library.settings.textProvider).toBe("local");
  console.log(
    "Packaged desktop boots with sandboxed IPC and an isolated local database.",
  );
} finally {
  if (app) await app.close().catch(() => {});
  rmSync(directory, { recursive: true, force: true });
}
