import { app, BrowserWindow, ipcMain, session, dialog } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { channel } from "node:diagnostics_channel";
import { appendFileSync } from "node:fs";
import { commandSchemas, type Command } from "@newsletter/core";
import { Store } from "./store";
import { Credentials } from "./credentials";
import { Engines } from "./engines";
import { Jobs } from "./jobs";
import { createHandlers } from "./handlers";

// Test builds may isolate data without changing the user's OS home directory.
if (process.env.NEWSLETTER_TEST_DATA && !app.isPackaged)
  app.setPath("userData", process.env.NEWSLETTER_TEST_DATA);
// Opt-in test instrumentation records destinations only, never credentials,
// prompts or source bodies. Packaged builds ignore these test variables.
if (
  process.env.NEWSLETTER_TEST_DATA &&
  !app.isPackaged &&
  process.env.NEWSLETTER_TEST_TRACE
) {
  const tracePath = join(process.env.NEWSLETTER_TEST_DATA, "network.jsonl");
  channel("undici:request:create").subscribe((message) => {
    const { request } = message as {
      request: { origin: string; path: string };
    };
    appendFileSync(
      tracePath,
      JSON.stringify({
        origin: String(request.origin),
        path: request.path.split("?")[0],
      }) + "\n",
    );
  });
}
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
let window: BrowserWindow | null = null;
let store: Store;
let engines: Engines;
let jobs: Jobs;
app.on("second-instance", () => {
  window?.show();
  window?.focus();
});

if (locked)
  void app
    .whenReady()
    .then(() => {
      session.defaultSession.setSpellCheckerEnabled(false);
      session.defaultSession.setSpellCheckerLanguages([]);
      store = new Store(app.getPath("userData"));
      engines = new Engines(store);
      jobs = new Jobs((progress) => {
        if (window && !window.isDestroyed())
          window.webContents.send("newsletter:progress", progress);
      });
      const handlers = createHandlers(
        store,
        new Credentials(store.directory),
        engines,
        jobs,
      );
      const developmentUrl = !app.isPackaged
        ? process.env.NEWSLETTER_DEV_URL
        : undefined;
      if (developmentUrl && new URL(developmentUrl).hostname !== "127.0.0.1")
        throw new Error("Development server must be local.");
      const rendererUrl =
        developmentUrl ||
        pathToFileURL(join(__dirname, "../renderer/index.html")).href;
      window = new BrowserWindow({
        width: 1440,
        height: 940,
        minWidth: 940,
        minHeight: 680,
        show: false,
        title: "NewsletterCreator",
        backgroundColor: "#f7f7f2",
        webPreferences: {
          preload: join(__dirname, "../preload/index.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
          spellcheck: false, // Avoid Chromium's automatic dictionary downloads.
        },
      });
      window.removeMenu();
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event, url) => {
        if (url !== rendererUrl) event.preventDefault();
      });
      session.defaultSession.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        const allowed =
          details.url.startsWith("file:") ||
          details.url.startsWith("data:") ||
          details.url.startsWith("blob:") ||
          Boolean(
            developmentUrl &&
            (details.url.startsWith(developmentUrl + "/") ||
              details.url.startsWith("ws://127.0.0.1:")),
          );
        callback({ cancel: !allowed });
      });
      ipcMain.handle(
        "newsletter:invoke",
        async (event, command: unknown, raw: unknown) => {
          try {
            if (
              event.sender !== window?.webContents ||
              event.senderFrame !== window.webContents.mainFrame
            )
              throw new Error("Untrusted caller.");
            if (
              typeof command !== "string" ||
              !Object.hasOwn(commandSchemas, command)
            )
              throw new Error("Unknown command.");
            const key = command as Command;
            const input = commandSchemas[key].parse(raw);
            const handler = handlers[key] as (value: unknown) => unknown;
            const value = await handler(input);
            return { ok: true, value };
          } catch (error) {
            return {
              ok: false,
              error:
                error instanceof Error ? error.message : "Operation failed.",
            };
          }
        },
      );
      window.once("ready-to-show", () => window?.show());
      void window.loadURL(rendererUrl);
    })
    .catch((error) => {
      dialog.showErrorBox(
        "NewsletterCreator could not start",
        error instanceof Error ? error.message : "Unknown startup error",
      );
      app.quit();
    });
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  jobs?.cancelAll();
  engines?.stopAll();
});
app.on("will-quit", () => store?.close());
