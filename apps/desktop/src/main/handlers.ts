import { dialog, shell } from "electron";
import {
  readFileSync,
  writeFileSync,
  statSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import { join } from "node:path";
import {
  renderEmail,
  type Command,
  type Input,
  type Output,
} from "@newsletter/core";
import { Store } from "./store";
import { Credentials } from "./credentials";
import { Engines } from "./engines";
import { Jobs } from "./jobs";
import {
  generateCopy,
  imageProvider,
  referencedAssets,
  textProvider,
} from "./providers";
import { gather } from "./gather";
import { exportMailchimp } from "./mailchimp";
import { localUrl } from "./network";

type Handlers = {
  [K in Command]: (input: Input<K>) => Output[K] | Promise<Output[K]>;
};
export function createHandlers(
  store: Store,
  secrets: Credentials,
  engines: Engines,
  jobs: Jobs,
): Handlers {
  return {
    library: () => ({
      profiles: store.profiles(),
      issues: store.issues(),
      settings: store.settings(),
      credentials: secrets.names(),
      secureCredentials: secrets.secure,
    }),
    saveProfile: (profile) => store.saveProfile(profile),
    deleteProfile: ({ id }) => store.deleteProfile(id),
    saveIssue: (issue) => store.saveIssue(issue),
    deleteIssue: ({ id }) => store.deleteIssue(id),
    settings: (settings) => {
      localUrl(settings.lmUrl);
      localUrl(settings.comfyUrl);
      return store.saveSettings(settings);
    },
    credential: ({ name, value }) => secrets.set(name, value),
    gather: ({ jobId, profileId }) =>
      jobs.run(
        jobId,
        (signal, report) =>
          gather(
            store.profile(profileId),
            textProvider(store.settings(), secrets),
            signal,
            report,
          ),
        true,
      ),
    generate: ({ jobId, issueId, blockId, feedback }) =>
      jobs.run(
        jobId,
        (signal, report) => {
          const issue = store.issue(issueId);
          const settings = store.settings();
          report(
            settings.textProvider === "local"
              ? "Writing with your local model…"
              : "Writing with OpenRouter…",
          );
          return generateCopy(
            textProvider(settings, secrets),
            settings,
            store.profile(issue.profileId),
            issue,
            blockId,
            feedback,
            signal,
          );
        },
        true,
      ),
    image: ({ jobId, prompt }) =>
      jobs.run(
        jobId,
        async (signal, report) => {
          const settings = store.settings();
          const bytes = await imageProvider(settings, secrets)
            .generate(`${settings.imagePrompt}\n${prompt}`, signal, report)
            .catch(async (error: unknown) => {
              if (
                signal.aborted &&
                settings.imageProvider === "local" &&
                engines.owns("image")
              )
                await engines.stop("image"); // Release only our process tree.
              throw error;
            });
          return { assetId: store.putImage(bytes) };
        },
        true,
      ),
    cancel: ({ jobId }) => jobs.cancel(jobId),
    models: ({ kind }) =>
      kind === "text"
        ? textProvider(store.settings(), secrets).models()
        : imageProvider(store.settings(), secrets).models(),
    setupStatus: () => engines.status(),
    install: ({ jobId, engine }) =>
      jobs.run(jobId, (signal, report) =>
        engines.install(engine, signal, report),
      ),
    startEngine: ({ engine }) => engines.start(engine),
    stopEngine: async ({ engine }) => {
      await engines.stop(engine);
      return engines.status();
    },
    pickImage: async () => {
      const result = await dialog.showOpenDialog({
        title: "Choose an image",
        properties: ["openFile"],
        filters: [
          { name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] },
        ],
      });
      if (result.canceled) return null;
      if (statSync(result.filePaths[0]).size > 12 * 1024 * 1024)
        throw new Error("Choose an image smaller than 12 MB.");
      return { assetId: store.putImage(readFileSync(result.filePaths[0])) };
    },
    readAsset: ({ id }) => store.assetData(id),
    backup: async () => {
      const result = await dialog.showSaveDialog({
        title: "Back up your newsletters",
        defaultPath: `newsletter-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "Newsletter backup", extensions: ["json"] }],
      });
      if (result.canceled || !result.filePath) return null;
      atomicWrite(result.filePath, JSON.stringify(store.backup()));
      return result.filePath;
    },
    restore: async () => {
      const result = await dialog.showOpenDialog({
        title: "Restore a newsletter backup",
        properties: ["openFile"],
        filters: [{ name: "Newsletter backup", extensions: ["json"] }],
      });
      if (result.canceled) return false;
      const confirm = await dialog.showMessageBox({
        type: "warning",
        message: "Replace this computer's newsletters with the backup?",
        detail:
          "A recovery backup is saved first. Credentials stay on this computer; Mailchimp export links are reset.",
        buttons: ["Cancel", "Restore"],
        defaultId: 0,
        cancelId: 0,
      });
      if (confirm.response !== 1) return false;
      if (statSync(result.filePaths[0]).size > 200 * 1024 * 1024)
        throw new Error("Backup is larger than the supported 200 MB limit.");
      const value = JSON.parse(readFileSync(result.filePaths[0], "utf8"));
      mkdirSync(join(store.directory, "backups"), { recursive: true });
      atomicWrite(
        join(store.directory, "backups", `before-restore-${Date.now()}.json`),
        JSON.stringify(store.backup()),
      );
      store.restore(value);
      return true;
    },
    exportHtml: async ({ issueId }) => {
      const issue = store.issue(issueId);
      const rendered = renderEmail(
        store.profile(issue.profileId),
        issue,
        referencedAssets(store, issue),
      );
      const result = await dialog.showSaveDialog({
        title: "Export newsletter HTML",
        defaultPath: "newsletter.html",
        filters: [{ name: "HTML", extensions: ["html"] }],
      });
      if (result.canceled || !result.filePath) return null;
      atomicWrite(result.filePath, rendered.html);
      return result.filePath;
    },
    mailchimp: ({ jobId, issueId }) =>
      jobs.run(
        jobId,
        (signal, report) =>
          exportMailchimp(
            store,
            issueId,
            store.settings(),
            secrets.get("mailchimp"),
            signal,
            report,
          ),
        true,
      ),
    openExternal: async ({ url }) => {
      await shell.openExternal(url);
    },
  };
}
function atomicWrite(path: string, contents: string) {
  writeFileSync(path + ".part", contents, { mode: 0o600 });
  renameSync(path + ".part", path);
}
