import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { newProfile, settingsSchema } from "@newsletter/core";
import { gather } from "../src/main/gather";
import {
  textProvider,
  imageProvider,
  type TextProvider,
} from "../src/main/providers";
import { fetchPublic, privateAddress } from "../src/main/network";
import { assertPortFree } from "../src/main/engines";
import pythonLocks from "../src/main/python-locks/index.json";

test("local provider failure and malformed output never call a cloud provider", async () => {
  const oldFetch = globalThis.fetch;
  const calls: string[] = [];
  const provider = textProvider(
    settingsSchema.parse({ textModel: "local-test" }),
    {
      get() {
        assert.fail("Local mode must not read cloud credentials");
      },
    },
  );
  try {
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return Response.json({ error: "out of memory" }, { status: 500 });
    };
    await assert.rejects(
      provider.complete("system", "prompt", {}, new AbortController().signal),
      /HTTP 500/,
    );
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return Response.json({ choices: [{ message: { content: "not JSON" } }] });
    };
    await assert.rejects(
      provider.complete("system", "prompt", {}, new AbortController().signal),
      /valid structured copy/,
    );
    await assert.rejects(
      provider.complete(
        "system",
        "x".repeat(100000),
        {},
        new AbortController().signal,
      ),
      /context budget/,
    );
    assert.ok(calls.every((url) => url.startsWith("http://127.0.0.1:1234/")));
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("every supported Python installation lock is pinned, hashed and intact", () => {
  assert.equal(Object.keys(pythonLocks).length, 5);
  for (const lock of Object.values(pythonLocks)) {
    const content = readFileSync(
      new URL(`../src/main/python-locks/${lock.file}`, import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(content).digest("hex"),
      lock.sha256,
    );
    const requirements = content.toString().split(/\n(?=[a-zA-Z])/);
    assert.ok(requirements.length > 30);
    for (const requirement of requirements) {
      assert.match(requirement, /^[a-zA-Z\d_.-]+==[^\s]+/);
      assert.match(requirement, /--hash=sha256:[a-f0-9]{64}/);
    }
    assert.match(content.toString(), /torch==2\.9\.1/);
  }
});

test("collection preserves successful sources and labels unavailable article content", async () => {
  const profile = newProfile("Community garden");
  profile.sources = ["healthy", "failed"].map((name) => ({
    id: crypto.randomUUID(),
    name,
    type: "rss",
    enabled: true,
    url: `https://example.org/${name}`,
  }));
  const provider: TextProvider = {
    async models() {
      return [];
    },
    async complete() {
      assert.fail("RSS does not need inference");
    },
  };
  const result = await gather(
    profile,
    provider,
    new AbortController().signal,
    () => {},
    async (url) => {
      if (url.endsWith("/healthy"))
        return new Response(
          "<rss><channel><item><title>Garden day</title><link>https://example.org/garden</link><description>Bring your seeds on Saturday.</description></item></channel></rss>",
        );
      throw new Error("Source unavailable");
    },
  );
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].coverage, "excerpt");
  assert.equal(result.articles[0].excerpt, "Bring your seeds on Saturday.");
  assert.equal(result.outcomes.filter((source) => !source.error).length, 1);
  assert.match(result.outcomes[1].error!, /unavailable/);
  const failed = await gather(
    profile,
    provider,
    new AbortController().signal,
    () => {},
    async () => {
      throw new Error("Offline");
    },
  );
  assert.equal(failed.articles.length, 0);
  assert.ok(failed.outcomes.every((source) => source.error));
});

test("ComfyUI cancellation removes only our queued prompt", async () => {
  const oldFetch = globalThis.fetch;
  const controller = new AbortController();
  const calls: string[] = [];
  try {
    globalThis.fetch = async (url, init) => {
      calls.push(String(url));
      if (String(url).endsWith("/prompt")) {
        controller.abort();
        return Response.json({ prompt_id: "our-prompt" });
      }
      assert.ok(String(url).endsWith("/queue"));
      assert.deepEqual(JSON.parse(String(init?.body)), {
        delete: ["our-prompt"],
      });
      return Response.json({});
    };
    const provider = imageProvider(
      settingsSchema.parse({ imageModel: "sdxl" }),
      {
        get() {
          assert.fail("No cloud keys in local mode");
        },
      },
    );
    await assert.rejects(
      provider.generate("garden", controller.signal, () => {}),
    );
    assert.equal(calls.length, 2);
    assert.ok(calls.every((url) => url.startsWith("http://127.0.0.1:8188/")));
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("source fetches reject private networks and setup identifies port conflicts", async () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "100.64.0.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "fd00::1",
    "ff00::1",
  ])
    assert.ok(privateAddress(address));
  for (const url of [
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/",
  ])
    await assert.rejects(fetchPublic(url), /private network/);
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  try {
    await assert.rejects(assertPortFree(port), /already in use/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await assertPortFree(port);
});
