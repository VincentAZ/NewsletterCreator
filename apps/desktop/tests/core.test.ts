import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  newProfile,
  newIssue,
  newBlock,
  renderEmail,
  settingsSchema,
} from "@newsletter/core";
import { Store } from "../src/main/store";
import { generateCopy, type TextProvider } from "../src/main/providers";
import { localUrl } from "../src/main/network";

test("issues and images survive restart; stale revisions cannot overwrite saved edits", () => {
  const directory = mkdtempSync(join(tmpdir(), "newsletter-store-"));
  let store = new Store(directory);
  try {
    const profile = store.saveProfile(newProfile("Community notes"));
    let issue = store.saveIssue(newIssue(profile.id));
    const stale = { ...issue };
    issue = store.saveIssue({
      ...issue,
      subject: "Updated subject",
      blocks: [
        { ...newBlock("event"), title: "Garden day", body: "Meet on Saturday" },
      ],
    });
    assert.throws(() => store.saveIssue(stale), /changed in another window/);
    store.close();
    store = new Store(directory);
    assert.equal(store.issue(issue.id).subject, "Updated subject");
    const image = store.putImage(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    assert.match(store.assetData(image), /^data:image\/png;base64,/);
    assert.throws(() => store.asset("../../etc/passwd"));
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("backup roundtrip preserves source material and assets without copying export state", () => {
  const directory = mkdtempSync(join(tmpdir(), "newsletter-backup-"));
  const store = new Store(directory);
  try {
    const profile = store.saveProfile(newProfile("Small business"));
    const assetId = store.putImage(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    const issue = store.saveIssue({
      ...newIssue(profile.id),
      blocks: [{ ...newBlock("image"), assetId }],
    });
    store.saveExportState(issue.id, { campaignId: "private-campaign" });
    const backup = store.backup();
    assert.ok(!JSON.stringify(backup).includes("private-campaign"));
    store.restore(backup);
    assert.equal(store.issues().length, 1);
    assert.ok(store.assetData(store.issues()[0].blocks[0].assetId));
    assert.deepEqual(store.exportState(issue.id), {});
    assert.throws(
      () =>
        store.restore({
          ...backup,
          issues: [{ ...backup.issues[0], profileId: crypto.randomUUID() }],
        }),
      /missing references/,
    );
    assert.equal(store.issues().length, 1);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("email rendering supports unrelated topics, original blocks, escaping, and optional images", () => {
  for (const topic of ["AI news", "Neighborhood gardening", "Bakery updates"]) {
    const profile = { ...newProfile(topic), topic, organization: "Our group" };
    const issue = {
      ...newIssue(profile.id),
      subject: "This week <script>",
      blocks: [
        { ...newBlock("event"), title: "Meet up", body: "Friday at noon" },
        { ...newBlock("cta"), title: "Visit", url: "https://example.com" },
      ],
    };
    const rendered = renderEmail(profile, issue, {}, true);
    assert.ok(rendered.html.includes(topic));
    assert.ok(rendered.text.includes("Friday at noon"));
    assert.ok(!rendered.html.includes("<script>"));
    assert.ok(rendered.html.includes("*|UNSUB|*"));
    assert.ok(!rendered.html.includes("Serpico"));
    assert.ok(!rendered.html.includes("mcusercontent"));
  }
});

test("targeted generation rejects unrelated sources and leaves input unchanged", async () => {
  const profile = newProfile("Community");
  const block = {
    ...newBlock("text"),
    title: "Original",
    body: "Neighbors meet Friday",
  };
  const issue = {
    ...newIssue(profile.id),
    blocks: [block, { ...newBlock("event"), body: "Keep this event" }],
  };
  const before = JSON.stringify(issue);
  const provider: TextProvider = {
    async models() {
      return ["test"];
    },
    async complete() {
      return {
        subject: "",
        preheader: "",
        intro: "",
        blocks: [
          {
            title: "Refined",
            body: "Meet your neighbors Friday",
            sourceIds: [],
          },
        ],
      };
    },
  };
  const result = await generateCopy(
    provider,
    settingsSchema.parse({}),
    profile,
    issue,
    block.id,
    "Shorter",
    new AbortController().signal,
  );
  assert.equal(result.blocks.length, 1);
  assert.equal(result.blocks[0].id, block.id);
  assert.equal(JSON.stringify(issue), before);
  provider.complete = async () => ({
    subject: "",
    preheader: "",
    intro: "",
    blocks: [{ title: "Bad", body: "Bad", sourceIds: [crypto.randomUUID()] }],
  });
  await assert.rejects(
    generateCopy(
      provider,
      settingsSchema.parse({}),
      profile,
      issue,
      block.id,
      "",
      new AbortController().signal,
    ),
    /unknown source/,
  );
  assert.equal(JSON.stringify(issue), before);
});

test("local mode rejects external inference URLs", () => {
  assert.equal(localUrl("http://127.0.0.1:1234/v1"), "http://127.0.0.1:1234");
  assert.throws(() => localUrl("https://external.example.com"), /loopback/);
  assert.throws(() => localUrl("http://secret@localhost:1234"), /loopback/);
});
