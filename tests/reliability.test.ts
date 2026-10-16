import assert from "node:assert/strict";
import { test } from "node:test";
import { tmpdir } from "node:os";
import { SaveQueue } from "../apps/web/src/lib/newsletter/save-queue";
import { checkAccess } from "../apps/web/src/lib/newsletter/access";
import { buildMailchimpCampaignContent } from "../apps/web/src/lib/newsletter/mailchimp";
import { gatherArticles } from "../apps/web/src/lib/newsletter/sources";
import { getPreferences, savePreferences, PreferenceConflictError } from "../apps/web/src/lib/newsletter/preferences";

test("writes serialize and coalesce pending edits without losing manual saves", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const writes: number[] = [];
  const queue = new SaveQueue(async (value: number) => { writes.push(value); if (value === 1) await gate; return value; });
  const first = queue.enqueue(1);
  const second = queue.enqueue(2);
  const third = queue.enqueue(3);
  assert.deepEqual(writes, [1]);
  release();
  assert.deepEqual(await Promise.all([first, second, third]), [1, 3, 3]);
  assert.deepEqual(writes, [1, 3]);
});

test("a failed write rejects queued changes rather than sending them blindly", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const writes: number[] = [];
  const queue = new SaveQueue(async (value: number) => { writes.push(value); await gate; throw new Error("conflict"); });
  const results = Promise.allSettled([queue.enqueue(1), queue.enqueue(2)]);
  release();
  assert.ok((await results).every((result) => result.status === "rejected"));
  assert.deepEqual(writes, [1]);
});

test("production is closed without credentials and checks every provided password", () => {
  assert.equal(checkAccess(null, { production: true, hosted: true }), "unconfigured");
  const config = { production: true, hosted: true, username: "owner", password: "test-secret" };
  assert.equal(checkAccess(null, config), "unauthorized");
  assert.equal(checkAccess("Basic " + Buffer.from("owner:wrong").toString("base64"), config), "unauthorized");
  assert.equal(checkAccess("Basic " + Buffer.from("owner:test-secret").toString("base64"), config), "allowed");
});

test("Next AMA survives both HTML and plain-text rendering", () => {
  const draft = { subject: "Issue", preheader: "Preview", intro: "Hello", nextAma: "Thursday at noon", sections: [], imagePrompt: "test", confidenceScore: 5, editorialNotes: [] };
  const content = buildMailchimpCampaignContent(draft, { url: "https://example.com/image.png", contentType: "image/png", model: "test", prompt: "test", generatedAt: "" });
  assert.ok(content.html.includes(draft.nextAma));
  assert.ok(content.plain_text.includes(draft.nextAma));
});

test("partial and total source failure retain actionable source outcomes", async () => {
  const previous = globalThis.fetch;
  const sources = ["good", "bad"].map((name) => ({ id: name, name, type: "rss" as const, url: `https://example.com/${name}`, enabled: true, limit: 20 }));
  try {
    globalThis.fetch = async (url) => {
      if (String(url).endsWith("bad")) throw new Error("source unavailable");
      return new Response(`<rss><item><title>New story</title><link>https://example.com/story</link><pubDate>${new Date().toISOString()}</pubDate></item></rss>`);
    };
    const result = await gatherArticles(sources);
    assert.equal(result.sourceCount, 1);
    assert.equal(result.articles.length, 1);
    assert.equal(result.sourceResults[1].error, "source unavailable");
    const failed = await gatherArticles([sources[1]]);
    assert.equal(failed.sourceCount, 0);
    assert.equal(failed.sourceResults.length, 1);
  } finally { globalThis.fetch = previous; }
});

test("revision writes are conditional and concurrent stale writers conflict", async () => {
  const previous = globalThis.fetch;
  const cwd = process.cwd();
  process.chdir(tmpdir());
  process.env.SUPABASE_URL = "https://test.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
  let stored: Record<string, unknown> | undefined;
  const payload = { preferenceId: "default-preferences", expectedRevision: 0, sources: [], copyModel: "one", scrapeModel: "", imageModel: "", currentPromptSet: null, promptSets: [], lastPromptSetId: "" };
  try {
    globalThis.fetch = async (url, init) => {
      const query = new URL(String(url));
      if (init?.method === "POST") {
        if (stored) return Response.json([]);
      } else if (init?.method === "PATCH") {
        if (query.searchParams.get("revision") !== `eq.${stored?.revision}`) return Response.json([]);
      } else { return Response.json(stored ? [stored] : []); }
      stored = JSON.parse(String(init?.body));
      return Response.json([stored]);
    };
    assert.equal((await savePreferences(payload))?.revision, 1);
    assert.equal((await savePreferences({ ...payload, expectedRevision: 1, copyModel: "two" }))?.revision, 2);
    await assert.rejects(savePreferences({ ...payload, expectedRevision: 1, copyModel: "stale" }), PreferenceConflictError);
    assert.equal((await getPreferences(payload.preferenceId))?.copyModel, "two");
  } finally { globalThis.fetch = previous; process.chdir(cwd); delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
});
