import { renderEmail, type Settings } from "@newsletter/core";
import { HttpError, jsonRequest } from "./network";
import type { Store } from "./store";

export async function exportMailchimp(
  store: Store,
  issueId: string,
  settings: Settings,
  key: string,
  signal: AbortSignal,
  report: (message: string) => void,
) {
  if (
    !key ||
    !settings.mailchimpListId ||
    !settings.fromName ||
    !settings.replyTo
  )
    throw new Error(
      "Complete Mailchimp connection, audience ID, sender name and reply-to in Settings.",
    );
  const server = key.split("-").at(-1);
  if (!server || !/^us\d+$/.test(server))
    throw new Error("Invalid Mailchimp API key region.");
  const issue = store.issue(issueId),
    profile = store.profile(issue.profileId);
  if (!issue.subject.trim() || !issue.blocks.length)
    throw new Error("Add a subject and content before exporting.");
  const request = (path: string, method = "GET", body?: unknown) =>
    jsonRequest(`https://${server}.api.mailchimp.com/3.0${path}`, {
      method,
      signal,
      headers: {
        Authorization:
          "Basic " + Buffer.from(`newsletter:${key}`).toString("base64"),
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }) as Promise<Record<string, unknown>>;
  const state = store.exportState(issueId);
  const marker = `[NC:${issueId}]`;
  let campaignId = typeof state.campaignId === "string" ? state.campaignId : "";
  const images = (state.images || {}) as Record<string, string>;
  const checkpoint = () =>
    store.saveExportState(issueId, {
      ...state,
      campaignId,
      images,
      revision: issue.revision,
      updatedAt: new Date().toISOString(),
    });
  if (!campaignId && state.creating) {
    report("Checking whether Mailchimp received the previous attempt…");
    // Recover uncertain POST outcomes using our stable marker, before risking a duplicate.
    for (let offset = 0; offset < 10000 && !campaignId; offset += 100) {
      const result = await request(
        `/campaigns?count=100&offset=${offset}&sort_field=create_time&sort_dir=DESC`,
      );
      const campaigns = result.campaigns as Array<{
        id: string;
        settings?: { title?: string };
      }>;
      campaignId =
        campaigns?.find((campaign) =>
          campaign.settings?.title?.includes(marker),
        )?.id || "";
      if (!campaigns || campaigns.length < 100) break;
    }
    if (!campaignId)
      throw new Error(
        "The previous creation request has an uncertain result. Check Mailchimp for this issue before retrying; duplicate creation has been stopped.",
      );
    checkpoint();
  }
  if (!campaignId) {
    state.creating = true;
    checkpoint();
    report("Creating Mailchimp draft…");
    const campaign = await request("/campaigns", "POST", {
      type: "regular",
      recipients: { list_id: settings.mailchimpListId },
      settings: {
        subject_line: issue.subject,
        preview_text: issue.preheader,
        title: `${issue.title} ${marker}`,
        from_name: settings.fromName,
        reply_to: settings.replyTo,
      },
    }).catch((error: unknown) => {
      // A definite rejection can be retried after fixing settings. Network failures
      // and server errors retain the uncertain-result marker to prevent duplicates.
      if (
        error instanceof HttpError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408
      ) {
        state.creating = false;
        checkpoint();
      }
      throw error;
    });
    if (typeof campaign.id !== "string")
      throw new Error("Mailchimp did not return a campaign ID.");
    campaignId = campaign.id;
    state.webId = campaign.web_id;
    state.creating = false;
    checkpoint();
  }
  const campaign = await request(`/campaigns/${campaignId}`);
  if (campaign.status !== "save" && campaign.status !== "paused")
    throw new Error(
      "This Mailchimp campaign is no longer an editable draft. Duplicate the local issue to create a new one.",
    );
  state.webId = campaign.web_id;
  for (const block of issue.blocks) {
    if (!block.assetId || images[block.assetId]) continue;
    signal.throwIfAborted();
    report("Uploading newsletter image to Mailchimp…");
    const asset = store.asset(block.assetId);
    const result = await request("/file-manager/files", "POST", {
      name: `newsletter-${block.assetId}.${asset.mime.split("/")[1]}`,
      file_data: asset.bytes.toString("base64"),
    });
    if (
      typeof result.full_size_url !== "string" ||
      !result.full_size_url.startsWith("https://")
    )
      throw new Error("Mailchimp did not return a hosted image URL.");
    images[block.assetId] = result.full_size_url;
    checkpoint();
  }
  const rendered = renderEmail(profile, issue, images, true);
  report("Saving and verifying the draft…");
  await request(`/campaigns/${campaignId}`, "PATCH", {
    recipients: { list_id: settings.mailchimpListId },
    settings: {
      subject_line: issue.subject,
      preview_text: issue.preheader,
      title: `${issue.title} ${marker}`,
      from_name: settings.fromName,
      reply_to: settings.replyTo,
    },
  });
  await request(`/campaigns/${campaignId}/content`, "PUT", {
    html: rendered.html,
    plain_text: rendered.text,
  });
  const content = await request(`/campaigns/${campaignId}/content`);
  if (
    typeof content.html !== "string" ||
    content.html.length < 200 ||
    Object.values(images).some((url) => !String(content.html).includes(url))
  )
    throw new Error(
      "Mailchimp content verification failed. The draft ID is saved; retry to repair it.",
    );
  state.complete = true;
  checkpoint();
  const url = `https://${server}.admin.mailchimp.com/campaigns/show?id=${Number(state.webId)}`;
  return { campaignId, url };
}
