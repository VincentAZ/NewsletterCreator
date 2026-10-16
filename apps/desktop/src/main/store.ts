import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  id,
  issueSchema,
  profileSchema,
  settingsSchema,
  type Issue,
  type Profile,
  type Settings,
} from "@newsletter/core";

const assetSchema = z.object({
  id,
  mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
  data: z.string().max(24_000_000),
});
const backupSchema = z.object({
  version: z.literal(1),
  profiles: z.array(profileSchema),
  issues: z.array(issueSchema),
  settings: settingsSchema,
  assets: z.array(assetSchema),
});
export class Store {
  readonly db: DatabaseSync;
  readonly assetsDir: string;
  constructor(readonly directory: string) {
    mkdirSync(directory, { recursive: true });
    this.assetsDir = join(directory, "assets");
    mkdirSync(this.assetsDir, { recursive: true });
    this.db = new DatabaseSync(join(directory, "newsletter.sqlite"));
    if (
      Number(this.db.prepare("PRAGMA user_version").get()?.user_version) > 1
    ) {
      this.db.close();
      throw new Error(
        "This library was created by a newer version. Update NewsletterCreator before opening it.",
      );
    }
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS issues(id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id), revision INTEGER NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY, mime TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS exports(issue_id TEXT PRIMARY KEY, json TEXT NOT NULL);
      PRAGMA user_version=1;`);
  }
  profiles(): Profile[] {
    return this.db
      .prepare("SELECT json FROM profiles ORDER BY rowid DESC")
      .all()
      .map((row) => profileSchema.parse(JSON.parse(String(row.json))));
  }
  issues(): Issue[] {
    return this.db
      .prepare("SELECT json FROM issues ORDER BY rowid DESC")
      .all()
      .map((row) => issueSchema.parse(JSON.parse(String(row.json))));
  }
  profile(key: string): Profile {
    const row = this.db
      .prepare("SELECT json FROM profiles WHERE id=?")
      .get(id.parse(key));
    if (!row) throw new Error("Newsletter not found.");
    return profileSchema.parse(JSON.parse(String(row.json)));
  }
  issue(key: string): Issue {
    const row = this.db
      .prepare("SELECT json FROM issues WHERE id=?")
      .get(id.parse(key));
    if (!row) throw new Error("Issue not found.");
    return issueSchema.parse(JSON.parse(String(row.json)));
  }
  saveProfile(input: Profile) {
    const value = profileSchema.parse(input);
    const saved = { ...value, revision: value.revision + 1 };
    this.save("profiles", value.id, value.revision, saved);
    return saved;
  }
  saveIssue(input: Issue) {
    const value = issueSchema.parse(input);
    const saved = {
      ...value,
      revision: value.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    this.save("issues", value.id, value.revision, saved, value.profileId);
    return saved;
  }
  private save(
    table: "profiles" | "issues",
    key: string,
    revision: number,
    value: unknown,
    profileId?: string,
  ) {
    const json = JSON.stringify(value);
    const result =
      revision === 0
        ? table === "profiles"
          ? this.db
              .prepare("INSERT OR IGNORE INTO profiles VALUES(?,1,?)")
              .run(key, json)
          : this.db
              .prepare("INSERT OR IGNORE INTO issues VALUES(?,?,1,?)")
              .run(key, profileId!, json)
        : this.db
            .prepare(
              `UPDATE ${table} SET revision=revision+1,json=? WHERE id=? AND revision=?`,
            )
            .run(json, key, revision);
    if (!result.changes)
      throw new Error(
        "This item changed in another window. Reload before saving.",
      );
  }
  deleteProfile(key: string) {
    if (
      this.db
        .prepare("SELECT id FROM issues WHERE profile_id=? LIMIT 1")
        .get(key)
    )
      throw new Error("Delete this newsletter's issues first.");
    this.db.prepare("DELETE FROM profiles WHERE id=?").run(key);
  }
  deleteIssue(key: string) {
    this.db.prepare("DELETE FROM issues WHERE id=?").run(key);
    this.db.prepare("DELETE FROM exports WHERE issue_id=?").run(key);
  }
  settings(): Settings {
    const row = this.db.prepare("SELECT json FROM settings WHERE id=1").get();
    return settingsSchema.parse(row ? JSON.parse(String(row.json)) : {});
  }
  saveSettings(value: Settings) {
    const parsed = settingsSchema.parse(value);
    this.db
      .prepare(
        "INSERT INTO settings VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json",
      )
      .run(JSON.stringify(parsed));
    return parsed;
  }
  putImage(bytes: Buffer): string {
    const mime = imageMime(bytes);
    const key = randomUUID();
    const temp = join(this.assetsDir, key + ".part");
    writeFileSync(temp, bytes, { mode: 0o600 });
    renameSync(temp, join(this.assetsDir, key));
    this.db.prepare("INSERT INTO assets VALUES(?,?)").run(key, mime);
    return key;
  }
  asset(key: string) {
    const row = this.db
      .prepare("SELECT mime FROM assets WHERE id=?")
      .get(id.parse(key));
    if (!row) throw new Error("Image not found.");
    return {
      mime: String(row.mime),
      bytes: readFileSync(join(this.assetsDir, key)),
    };
  }
  assetData(key: string) {
    const asset = this.asset(key);
    return `data:${asset.mime};base64,${asset.bytes.toString("base64")}`;
  }
  exportState(key: string): Record<string, unknown> {
    const row = this.db
      .prepare("SELECT json FROM exports WHERE issue_id=?")
      .get(key);
    return row ? JSON.parse(String(row.json)) : {};
  }
  saveExportState(key: string, value: Record<string, unknown>) {
    this.db
      .prepare(
        "INSERT INTO exports VALUES(?,?) ON CONFLICT(issue_id) DO UPDATE SET json=excluded.json",
      )
      .run(key, JSON.stringify(value));
  }
  backup() {
    return {
      version: 1,
      profiles: this.profiles(),
      issues: this.issues(),
      settings: this.settings(),
      assets: this.db
        .prepare("SELECT id,mime FROM assets")
        .all()
        .map((row) => ({
          id: String(row.id),
          mime: String(row.mime),
          data: this.asset(String(row.id)).bytes.toString("base64"),
        })),
    };
  }
  restore(value: unknown) {
    const backup = backupSchema.parse(value);
    const profileIds = new Set(backup.profiles.map((profile) => profile.id));
    const assetIds = new Set(backup.assets.map((asset) => asset.id));
    if (
      profileIds.size !== backup.profiles.length ||
      new Set(backup.issues.map((issue) => issue.id)).size !==
        backup.issues.length ||
      assetIds.size !== backup.assets.length
    )
      throw new Error("Backup has duplicate IDs.");
    for (const issue of backup.issues) {
      if (
        !profileIds.has(issue.profileId) ||
        issue.blocks.some(
          (block) => block.assetId && !assetIds.has(block.assetId),
        )
      )
        throw new Error("Backup has missing references.");
    }
    const assets = backup.assets.map((asset) => {
      const bytes = Buffer.from(asset.data, "base64");
      if (imageMime(bytes) !== asset.mime)
        throw new Error("Invalid backup image.");
      return { ...asset, bytes };
    });
    // Preserve existing assets. Restore into new IDs to avoid file/DB rollback races.
    const remap = new Map<string, string>();
    const created: string[] = [];
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const asset of assets) {
        const key = this.putImage(asset.bytes);
        remap.set(asset.id, key);
        created.push(key);
      }
      this.db.exec(
        "DELETE FROM exports; DELETE FROM issues; DELETE FROM profiles;",
      );
      for (const profile of backup.profiles)
        this.saveProfile({ ...profile, revision: 0 });
      for (const issue of backup.issues)
        this.saveIssue({
          ...issue,
          revision: 0,
          blocks: issue.blocks.map((block) => ({
            ...block,
            assetId: remap.get(block.assetId) || "",
          })),
        });
      this.saveSettings(backup.settings);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      for (const key of created)
        if (existsSync(join(this.assetsDir, key)))
          rmSync(join(this.assetsDir, key));
      throw error;
    }
  }
  close() {
    this.db.close();
  }
}
export function imageMime(bytes: Buffer) {
  if (bytes.length > 12 * 1024 * 1024)
    throw new Error("Images must be smaller than 12 MB.");
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  throw new Error("Choose a PNG, JPEG, or WebP image.");
}
