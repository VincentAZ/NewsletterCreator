import { loadLocalEnv } from "./env";
import type { GeneratedImage, MailchimpCampaignDraft, NewsletterDraft } from "./types";

type MailchimpConfig = {
  apiKey: string;
  server: string;
  listId: string;
  fromName: string;
  replyTo: string;
  template?: MailchimpTemplateConfig;
};

type MailchimpTemplateConfig = {
  id: number;
  sections: {
    preheader: string;
    intro: string;
    heroImage: string;
    body: string;
  };
};

type MailchimpCampaignResponse = {
  id?: string;
  web_id?: number;
  status?: string;
  settings?: { title?: string };
  archive_url?: string;
};

type MailchimpChecklistResponse = {
  items?: Array<{
    type?: string;
    heading?: string;
    details?: string;
    completed?: boolean;
  }>;
};

export function isMailchimpConfigured() {
  loadLocalEnv();
  return Boolean(
    process.env.MAILCHIMP_API_KEY &&
      process.env.MAILCHIMP_LIST_ID &&
      process.env.MAILCHIMP_FROM_NAME &&
      process.env.MAILCHIMP_REPLY_TO,
  );
}

export async function createMailchimpCampaignDraft(input: {
  draft: NewsletterDraft;
  image: GeneratedImage;
}): Promise<MailchimpCampaignDraft> {
  const config = getMailchimpConfig();
  const title = `${input.draft.subject} - ${new Date().toISOString().slice(0, 10)}`;

  const campaign = await mailchimpFetch<MailchimpCampaignResponse>(config, "/campaigns", {
    method: "POST",
    body: JSON.stringify({
      type: "regular",
      recipients: {
        list_id: config.listId,
      },
      settings: {
        subject_line: input.draft.subject,
        preview_text: input.draft.preheader,
        title,
        from_name: config.fromName,
        reply_to: config.replyTo,
      },
    }),
  });

  if (!campaign.id) {
    throw new Error("Mailchimp created a campaign without returning an id.");
  }

  await mailchimpFetch(config, `/campaigns/${campaign.id}/content`, {
    method: "PUT",
    body: JSON.stringify(buildMailchimpCampaignContent(input.draft, input.image, config.template)),
  });
  const checklist = await getCampaignChecklist(config, campaign.id);

  return {
    id: campaign.id,
    webId: campaign.web_id,
    title: campaign.settings?.title ?? title,
    status: campaign.status,
    archiveUrl: campaign.archive_url,
    checklist,
  };
}

function getMailchimpConfig(): MailchimpConfig {
  loadLocalEnv();
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const listId = process.env.MAILCHIMP_LIST_ID;
  const server = process.env.MAILCHIMP_SERVER || apiKey?.split("-").at(-1);
  const fromName = process.env.MAILCHIMP_FROM_NAME?.trim();
  const replyTo = process.env.MAILCHIMP_REPLY_TO?.trim();
  const templateId = parseMailchimpTemplateId(process.env.MAILCHIMP_TEMPLATE_ID);

  if (!apiKey) {
    throw new Error("MAILCHIMP_API_KEY is not configured.");
  }
  if (!server) {
    throw new Error("MAILCHIMP_SERVER is not configured and could not be inferred from MAILCHIMP_API_KEY.");
  }
  if (!listId) {
    throw new Error("MAILCHIMP_LIST_ID is not configured.");
  }
  if (!fromName) {
    throw new Error("MAILCHIMP_FROM_NAME is not configured.");
  }
  if (!replyTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
    throw new Error("MAILCHIMP_REPLY_TO must be a real email address.");
  }

  return {
    apiKey,
    server,
    listId,
    fromName,
    replyTo,
    template: templateId
      ? {
          id: templateId,
          sections: {
            preheader: process.env.MAILCHIMP_SECTION_PREHEADER?.trim() || "preheader",
            intro: process.env.MAILCHIMP_SECTION_INTRO?.trim() || "intro",
            heroImage: process.env.MAILCHIMP_SECTION_HERO_IMAGE?.trim() || "hero_image",
            body: process.env.MAILCHIMP_SECTION_BODY?.trim() || "body",
          },
        }
      : undefined,
  };
}

function parseMailchimpTemplateId(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const templateId = Number(trimmed);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    throw new Error("MAILCHIMP_TEMPLATE_ID must be a positive numeric template id.");
  }

  return templateId;
}

export function buildMailchimpCampaignContent(
  draft: NewsletterDraft,
  image: GeneratedImage,
  template?: MailchimpTemplateConfig,
) {
  const plainText = renderNewsletterText(draft);

  if (template) {
    return {
      template: {
        id: template.id,
        sections: buildMailchimpTemplateSections(draft, image, template.sections),
      },
      plain_text: plainText,
    };
  }

  return {
    html: renderNewsletterHtml(draft, image),
    plain_text: plainText,
  };
}

function buildMailchimpTemplateSections(
  draft: NewsletterDraft,
  image: GeneratedImage,
  sectionNames: MailchimpTemplateConfig["sections"],
) {
  return {
    [sectionNames.preheader]: escapeHtml(draft.preheader),
    [sectionNames.intro]: renderIntroHtml(draft),
    [sectionNames.heroImage]: renderHeroImageHtml(image, draft.subject),
    [sectionNames.body]: renderSectionsHtml(draft),
  };
}

async function getCampaignChecklist(config: MailchimpConfig, campaignId: string) {
  const checklist = await mailchimpFetch<MailchimpChecklistResponse>(config, `/campaigns/${campaignId}/send-checklist`, {
    method: "GET",
  }).catch(() => null);

  return (
    checklist?.items
      ?.filter((item) => !item.completed)
      .map((item) => [item.heading, item.details].filter(Boolean).join(": "))
      .filter((item) => item.length > 0) ?? []
  );
}

async function mailchimpFetch<T = unknown>(config: MailchimpConfig, path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`https://${config.server}.api.mailchimp.com/3.0${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${config.apiKey}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Mailchimp request failed with ${response.status}: ${details.slice(0, 300)}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function renderNewsletterHtml(draft: NewsletterDraft, image: GeneratedImage) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f7f9;color:#1b1f24;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(draft.preheader)}</div>
    <main style="max-width:680px;margin:0 auto;background:#ffffff;padding:28px;">
      ${renderHeroImageHtml(image, draft.subject)}
      ${renderIntroHtml(draft)}
      ${renderSectionsHtml(draft)}
    </main>
  </body>
</html>`;
}

function renderIntroHtml(draft: NewsletterDraft) {
  return `<h1 style="font-size:28px;line-height:1.15;margin:24px 0 10px;">${escapeHtml(draft.subject)}</h1>
<p style="font-size:16px;line-height:1.55;margin:0 0 24px;">${escapeHtml(draft.intro)}</p>`;
}

function renderHeroImageHtml(image: GeneratedImage, subject: string) {
  return `<img src="${escapeAttribute(image.url)}" alt="${escapeAttribute(subject)}" style="border:0;display:block;height:auto;margin:0 0 24px;max-width:100%;width:100%;" />`;
}

function renderSectionsHtml(draft: NewsletterDraft) {
  return draft.sections
    .map(
      (section) => `<section style="border-top:1px solid #d9e0e5;padding:22px 0 0;margin:22px 0 0;">
  <h2 style="font-size:21px;line-height:1.25;margin:0 0 8px;">${escapeHtml(section.heading)}</h2>
  <p style="font-size:15px;line-height:1.55;margin:0 0 14px;">${escapeHtml(section.summary)}</p>
  ${section.items
    .map(
      (item) => `<article style="margin:0 0 18px;">
    <h3 style="font-size:16px;line-height:1.3;margin:0 0 5px;"><a href="${escapeAttribute(item.url)}" style="color:#234b5f;">${escapeHtml(item.title)}</a></h3>
    <p style="font-size:14px;line-height:1.5;margin:0 0 5px;">${escapeHtml(item.summary)}</p>
    <p style="color:#5f6c76;font-size:13px;line-height:1.45;margin:0;"><strong>Why it matters:</strong> ${escapeHtml(item.whyItMatters)}</p>
  </article>`,
    )
    .join("")}
</section>`,
    )
    .join("");
}

function renderNewsletterText(draft: NewsletterDraft) {
  const sectionText = draft.sections
    .map((section) => {
      const items = section.items
        .map((item) => `${item.title}\n${item.summary}\nWhy it matters: ${item.whyItMatters}\n${item.url}`)
        .join("\n\n");
      return `${section.heading}\n${section.summary}\n\n${items}`;
    })
    .join("\n\n");

  return `${draft.subject}\n\n${draft.preheader}\n\n${draft.intro}\n\n${sectionText}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
