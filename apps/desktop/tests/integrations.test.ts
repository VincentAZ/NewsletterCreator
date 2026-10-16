import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import {
  newProfile,
  newIssue,
  newBlock,
  settingsSchema,
} from "@newsletter/core";
import { Store } from "../src/main/store";
import { exportMailchimp } from "../src/main/mailchimp";
import { download } from "../src/main/download";
import { Jobs } from "../src/main/jobs";

test("Mailchimp retries reuse the draft and uploaded images; no sending endpoint is called", async () => {
  const dir = mkdtempSync(join(tmpdir(), "newsletter-mailchimp-"));
  const store = new Store(dir);
  const oldFetch = globalThis.fetch;
  const calls: Array<{ path: string; method: string }> = [];
  let storedHtml = "";
  try {
    const profile = store.saveProfile(newProfile("Community"));
    const assetId = store.putImage(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    const issue = store.saveIssue({
      ...newIssue(profile.id),
      subject: "Community news",
      blocks: [{ ...newBlock("image"), assetId }],
    });
    globalThis.fetch = async (input, init) => {
      const path = new URL(String(input)).pathname;
      const method = init?.method || "GET";
      calls.push({ path, method });
      if (path.endsWith("/campaigns") && method === "POST")
        return Response.json({ id: "campaign-one", web_id: 123 });
      if (path.endsWith("/file-manager/files"))
        return Response.json({
          full_size_url: "https://example.com/hosted.png",
        });
      if (path.endsWith("/content")) {
        if (method === "PUT") storedHtml = JSON.parse(String(init?.body)).html;
        return Response.json({ html: storedHtml });
      }
      return Response.json({ status: "save", web_id: 123 });
    };
    const settings = settingsSchema.parse({
      mailchimpListId: "audience",
      fromName: "Editor",
      replyTo: "editor@example.com",
    });
    const run = () =>
      exportMailchimp(
        store,
        issue.id,
        settings,
        "test-us1",
        new AbortController().signal,
        () => {},
      );
    assert.equal((await run()).campaignId, "campaign-one");
    await run();
    assert.equal(
      calls.filter(
        (call) => call.path.endsWith("/campaigns") && call.method === "POST",
      ).length,
      1,
    );
    assert.equal(
      calls.filter((call) => call.path.endsWith("/file-manager/files")).length,
      1,
    );
    assert.ok(calls.every((call) => !/send|schedule/.test(call.path)));
    assert.ok(storedHtml.includes("https://example.com/hosted.png"));
    assert.ok(!storedHtml.includes("data:image"));
  } finally {
    globalThis.fetch = oldFetch;
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verified downloads resume partial files and reject tampering", async () => {
  const dir = mkdtempSync(join(tmpdir(), "newsletter-download-"));
  const bytes = Buffer.from("an exact pinned runtime artifact");
  let range = "";
  const server = createServer((req, res) => {
    range = req.headers.range || "";
    const offset = range ? Number(range.match(/\d+/)?.[0]) : 0;
    res.writeHead(offset ? 206 : 200, {
      "Content-Length": bytes.length - offset,
      ...(offset
        ? {
            "Content-Range": `bytes ${offset}-${bytes.length - 1}/${bytes.length}`,
          }
        : {}),
    });
    res.end(bytes.subarray(offset));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    const path = join(dir, "engine.bin");
    writeFileSync(path + ".part", bytes.subarray(0, 7));
    const artifact = {
      url: `http://127.0.0.1:${address.port}`,
      bytes: bytes.length,
      digest: "sha256:" + createHash("sha256").update(bytes).digest("hex"),
    };
    await download(artifact, path, new AbortController().signal, () => {});
    assert.equal(range, "bytes=7-");
    assert.deepEqual(readFileSync(path), bytes);
    const invalid = join(dir, "invalid.bin");
    await assert.rejects(
      download(
        { ...artifact, digest: "sha256:" + "0".repeat(64) },
        invalid,
        new AbortController().signal,
        () => {},
      ),
      /checksum/,
    );
    assert.ok(!existsSync(invalid));
    assert.ok(!existsSync(invalid + ".part"));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("queued inference cancels before execution and emits progress", async () => {
  const events: string[] = [];
  const jobs = new Jobs((progress) => events.push(progress.stage));
  let release!: () => void;
  const first = jobs.run(
    "first",
    async () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    true,
  );
  await Promise.resolve();
  const second = jobs.run(
    "second",
    async () => {
      assert.fail("Cancelled queued inference must not execute");
    },
    true,
  );
  const rejected = assert.rejects(second, /Cancelled/);
  jobs.cancel("second");
  release();
  await first;
  await rejected;
  assert.ok(events.includes("complete"));
  assert.ok(events.includes("error"));
});
