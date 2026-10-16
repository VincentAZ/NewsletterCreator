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
  undoEdit,
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
    store.saveProfile({
      ...profile,
      logoAssetId: assetId,
      logoAlt: "Business logo",
      ctaBody: "Come visit our bakery.",
    });
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
    assert.equal(
      store.profiles()[0].logoAssetId,
      store.issues()[0].blocks[0].assetId,
    );
    assert.equal(store.profiles()[0].ctaBody, "Come visit our bakery.");
    assert.deepEqual(store.exportState(issue.id), {});
    assert.equal(store.backup().assets.length, backup.assets.length);
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
    const profile = {
      ...newProfile(topic),
      topic,
      organization: "Our group",
      ctaLabel: "Join us",
      ctaUrl: "https://example.com",
      ctaBody: "Come share your ideas.",
    };
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
    assert.ok(rendered.text.includes("Come share your ideas."));
    assert.ok(rendered.html.includes("Come share your ideas."));
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

test("undoing a generated block retains later edits in unrelated sections", () => {
  const profile = newProfile("Neighbors");
  const before = {
    ...newIssue(profile.id),
    subject: "Original subject",
    blocks: [
      { ...newBlock("story"), title: "Original story", body: "Original body" },
      {
        ...newBlock("event"),
        title: "Meet Saturday",
        body: "Community garden",
      },
    ],
  };
  const after = {
    ...before,
    blocks: [
      { ...before.blocks[0], body: "Generated replacement" },
      before.blocks[1],
    ],
  };
  const current = {
    ...after,
    revision: 7,
    subject: "My later subject edit",
    blocks: [
      after.blocks[0],
      { ...after.blocks[1], body: "Bring seeds and coffee" },
    ],
  };
  const restored = undoEdit(current, { before, after });
  assert.equal(restored.blocks[0].body, "Original body");
  assert.equal(restored.blocks[1].body, "Bring seeds and coffee");
  assert.equal(restored.subject, "My later subject edit");
  assert.equal(restored.revision, 7);
  const replacedStories = {
    ...before,
    blocks: [before.blocks[1], newBlock("story")],
  };
  assert.deepEqual(
    undoEdit(replacedStories, { before, after: replacedStories }).blocks,
    before.blocks,
  );
});
