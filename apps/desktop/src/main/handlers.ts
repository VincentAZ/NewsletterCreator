import { dialog, shell } from "electron";
import {
  readFileSync,
  writeFileSync,
  statSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  newProfile,
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
import { fetchPublic, limitedBytes, jsonRequest, localUrl } from "./network";

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
    importSupabase: async ({ url, key, preferenceId }) => {
      const base = new URL(url);
      if (base.protocol !== "https:" || !base.hostname.endsWith(".supabase.co"))
        throw new Error("Use your Supabase project's HTTPS URL.");
      const origin = `${base.origin}/${preferenceId}`;
      const existing = store
        .profiles()
        .find((profile) => profile.legacyImport?.origin === origin);
      if (existing) return existing;
      const result = await jsonRequest(
        `${base.origin}/rest/v1/newsletter_preferences?preference_id=eq.${encodeURIComponent(preferenceId)}&select=*`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      const rows = z
        .array(
          z.object({
            sources: z
              .array(
                z.object({
                  name: z.string(),
                  url: z.string(),
                  type: z.string(),
                  enabled: z.boolean(),
                }),
              )
              .default([]),
            copy_model: z.string().nullable().optional(),
            scrape_model: z.string().nullable().optional(),
            image_model: z.string().nullable().optional(),
            prompt_sets: z.array(z.record(z.string(), z.unknown())).optional(),
            last_prompt_set_id: z.string().nullable().optional(),
            current_prompt_set: z
              .record(z.string(), z.unknown())
              .nullable()
              .optional(),
          }),
        )
        .parse(result);
      if (!rows.length)
        throw new Error("No saved preferences found for that ID.");
      const profile = newProfile("Serpico AI Learning Center");
      profile.topic = "AI news";
      profile.audience = "Business owners and AI practitioners";
      profile.organization = "Serpico AI Learning Center";
      profile.brandColor = "#0d1b2e";
      profile.footer =
        "© 2026 Serpico AI Learning Center · Phoenix, AZ\nhttps://www.example.com";
      profile.ctaLabel = "Reserve Your 1:1 Expert Training";
      profile.ctaBody =
        "Solve your business problem in less than a day.\n\nWe begin with a discovery call. We then pair you with the right specialist to help you build a tailored solution for your business.\n\nNot a course. Not merely learning about AI. It's a real, working tool.";
      profile.logoAlt = "Serpico AI Learning Center at CEI";
      // Download the previous hosted logo only during this explicit migration.
      profile.logoAssetId = store.putImage(
        await limitedBytes(
          await fetchPublic(
            "https://mcusercontent.com/<account-id>/images/0ce7f308-4079-72f1-3d96-c66dd291cc4d.png",
          ),
        ),
      );
      profile.ctaUrl = "https://www.example.com/training";
      profile.freshnessDays = 3;
      profile.sources = rows[0].sources.map((source) => ({
        ...source,
        id: crypto.randomUUID(),
        type: source.type === "rss" ? "rss" : "website",
      }));
      // Preserve all legacy model/prompt choices without silently activating a
      // cloud provider or changing defaults for unrelated newsletters.
      profile.legacyImport = {
        origin,
        importedAt: new Date().toISOString(),
        preferences: rows[0],
      };
      return store.saveProfile(profile);
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
