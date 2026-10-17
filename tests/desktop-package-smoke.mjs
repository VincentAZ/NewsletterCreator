import { _electron as electron, expect } from "@playwright/test";
import { mkdtempSync, rmSync, realpathSync } from "node:fs";
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
    args: [
      ...(process.platform === "linux" &&
      process.env.NEWSLETTER_PACKAGE_NATIVE_SANDBOX !== "1"
        ? ["--no-sandbox"]
        : []),
      `--user-data-dir=${directory}`,
    ],
    env: testEnv,
  });
  const info = await app.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    directory: app.getPath("userData"),
  }));
  expect(info.packaged).toBe(true);
  expect(realpathSync(info.directory)).toBe(realpathSync(directory));
  const page = await app.firstWindow();
  // First launch of a packaged build initialises SQLite and the asset folder;
  // the Intel macOS build also runs under Rosetta on Apple Silicon runners.
  await expect(
    page.getByText("A good newsletter starts here."),
  ).toBeVisible({ timeout: 60000 });
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
