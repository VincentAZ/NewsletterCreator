// Opt-in live draft validation. Creates a clearly labeled test draft, never sends.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  newProfile,
  newIssue,
  newBlock,
  settingsSchema,
} from "../packages/core/src/index.ts";
import { Store } from "../apps/desktop/src/main/store.ts";
import { exportMailchimp } from "../apps/desktop/src/main/mailchimp.ts";

const required = [
  "MAILCHIMP_API_KEY",
  "MAILCHIMP_LIST_ID",
  "MAILCHIMP_FROM_NAME",
  "MAILCHIMP_REPLY_TO",
];
if (
  process.env.NEWSLETTER_LIVE_MAILCHIMP !== "1" ||
  required.some((key) => !process.env[key])
)
  throw new Error(
    "Explicitly enable NEWSLETTER_LIVE_MAILCHIMP=1 and configure the four MAILCHIMP_* test credentials/settings described in the desktop README. No API request was made.",
  );
const key = process.env.MAILCHIMP_API_KEY;
const region = key.split("-").at(-1);
if (!/^us\d+$/.test(region)) throw new Error("Invalid Mailchimp API key region");
const origin = `https://${region}.api.mailchimp.com`;
const directory = resolve(
  process.env.NEWSLETTER_VALIDATION_DATA ||
    "apps/desktop/release/production-validation/mailchimp",
);
mkdirSync(directory, { recursive: true });
let store = new Store(directory);
const nativeFetch = globalThis.fetch;
const calls = [];
let simulateLostVerification = true;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const method = init?.method || "GET";
  assert.equal(url.origin, origin);
  assert.ok(!/\/actions\/(send|schedule)/.test(url.pathname));
  assert.ok(
    /^\/3\.0\/(campaigns(?:\/[^/]+(?:\/content)?)?|file-manager\/files)$/.test(
      url.pathname,
    ),
  );
  calls.push({ method, path: url.pathname });
  const response = await nativeFetch(input, init);
  if (
    simulateLostVerification &&
    method === "GET" &&
    url.pathname.endsWith("/content") &&
    response.ok
  ) {
    simulateLostVerification = false;
    await response.arrayBuffer();
    throw new Error("Simulated lost verification response");
  }
  return response;
};
const settings = settingsSchema.parse({
  mailchimpListId: process.env.MAILCHIMP_LIST_ID,
  fromName: process.env.MAILCHIMP_FROM_NAME,
  replyTo: process.env.MAILCHIMP_REPLY_TO,
});
let issueId;
try {
  // Reuse the previous test issue and campaign if this validation is retried.
  let profile = store
    .profiles()
    .find((p) => p.name === "NewsletterCreator release validation");
  if (!profile)
    profile = store.saveProfile(
      newProfile("NewsletterCreator release validation"),
    );
  let issue = store.issues().find((i) => i.profileId === profile.id);
  if (!issue) {
    const assetId = store.putImage(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNwaHAAAAIEAQFd/gSVAAAAAElFTkSuQmCC",
        "base64",
      ),
    );
    issue = store.saveIssue({
      ...newIssue(profile.id),
      title: "Release validation — do not send",
      subject: "NewsletterCreator test draft — do not send",
      intro:
        "Synthetic release verification. This campaign must remain a draft.",
      blocks: [
        {
          ...newBlock("text"),
          title: "Community garden",
          body: "Neighbors meet Saturday at 10 AM. Bring gloves.",
        },
        {
          ...newBlock("image"),
          assetId,
          alt: "Synthetic one-pixel test image",
        },
      ],
    });
  }
  issueId = issue.id;
  const handoff = () =>
    exportMailchimp(
      store,
      issueId,
      settings,
      key,
      AbortSignal.timeout(120000),
      () => {},
    );
  await assert.rejects(handoff(), /Simulated lost verification response/);
  const campaignId = store.exportState(issueId).campaignId;
  assert.ok(campaignId);
  assert.equal(store.exportState(issueId).complete, false);
  store.close();
  store = new Store(directory);
  const result = await handoff();
  assert.equal(result.campaignId, campaignId);
  const state = store.exportState(issueId);
  assert.equal(state.complete, true);
  assert.ok(
    calls.filter((c) => c.method === "POST" && c.path === "/3.0/campaigns")
      .length <= 1,
  );
  const campaign = await globalThis
    .fetch(`${origin}/3.0/campaigns/${campaignId}`, {
      headers: {
        Authorization:
          "Basic " + Buffer.from(`newsletter:${key}`).toString("base64"),
      },
      signal: AbortSignal.timeout(30000),
    })
    .then(async (response) => {
      assert.ok(response.ok);
      return response.json();
    });
  assert.equal(campaign.status, "save");
  for (const url of Object.values(state.images)) {
    assert.equal(new URL(url).protocol, "https:");
    const response = await nativeFetch(url, {
      signal: AbortSignal.timeout(30000),
    });
    assert.ok(response.ok);
    assert.match(response.headers.get("content-type") || "", /^image\//);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
  writeFileSync(
    join(directory, "evidence.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        result: "passed",
        campaignId,
        issueId,
        uploadedImages: Object.keys(state.images).length,
        retryAfterRestart: true,
        status: campaign.status,
        calls,
      },
      null,
      2,
    ),
  );
  console.log(
    `Live Mailchimp validation passed. Test draft retained: ${result.url}`,
  );
} finally {
  globalThis.fetch = nativeFetch;
  store.close();
}
