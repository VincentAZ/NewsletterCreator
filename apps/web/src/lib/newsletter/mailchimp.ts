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

type MailchimpCampaignContentResponse = {
  html?: string;
};

type MailchimpTemplateResponse = {
  id?: number;
  name?: string;
  content_type?: string;
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

  await setCampaignContent(config, campaign.id, input.draft, input.image);
  const checklist = await getCampaignChecklist(config, campaign.id);

  return {
    id: campaign.id,
    webId: campaign.web_id,
    title: campaign.settings?.title ?? title,
    status: campaign.status,
    archiveUrl: campaign.archive_url,
    adminUrl: campaign.web_id ? `https://${config.server}.admin.mailchimp.com/campaigns/show?id=${campaign.web_id}` : undefined,
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
  if (template) {
    return {
      template: {
        id: template.id,
        sections: buildMailchimpTemplateSections(draft, image, template.sections),
      },
      plain_text: renderNewsletterText(draft),
    };
  }

  return {
    html: renderNewsletterHtml(draft, image),
    plain_text: renderNewsletterText(draft),
  };
}

async function validateMailchimpTemplate(config: MailchimpConfig, templateId: number) {
  const template = await mailchimpFetch<MailchimpTemplateResponse>(config, `/templates/${templateId}`, {
    method: "GET",
  });

  if (template.content_type === "multichannel") {
    throw new Error(
      `MAILCHIMP_TEMPLATE_ID ${templateId} (${template.name ?? "unnamed template"}) is a multichannel/New Builder template. Mailchimp's Marketing API does not expose editable HTML sections for this template type, so the app cannot populate it without creating the wrong layout. Recreate it as a Classic coded template with mc:edit sections, or remove MAILCHIMP_TEMPLATE_ID to use the app's HTML layout.`,
    );
  }

  if (template.content_type !== "html") {
    throw new Error(
      `MAILCHIMP_TEMPLATE_ID ${templateId} (${template.name ?? "unnamed template"}) has unsupported content_type "${template.content_type ?? "unknown"}". Use a Classic coded HTML template with mc:edit sections.`,
    );
  }
}

async function setCampaignContent(
  config: MailchimpConfig,
  campaignId: string,
  draft: NewsletterDraft,
  image: GeneratedImage,
) {
  await mailchimpFetch(config, `/campaigns/${campaignId}/content`, {
    method: "PUT",
    body: JSON.stringify(buildMailchimpCampaignContent(draft, image)),
  });

  const content = await mailchimpFetch<MailchimpCampaignContentResponse>(config, `/campaigns/${campaignId}/content`, {
    method: "GET",
  }).catch(() => null);

  if (!content?.html || !hasGeneratedNewsletterContent(content.html, draft) || !hasPersistentNewsletterContent(content.html)) {
    throw new Error("Mailchimp saved the draft but did not return previewable HTML content. Open the draft in Mailchimp and check the template/content builder.");
  }
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

function hasGeneratedNewsletterContent(html: string, draft: NewsletterDraft) {
  const normalizedHtml = normalizeContentText(stripHtmlTags(html));
  const subject = normalizeContentText(draft.subject);
  const intro = normalizeContentText(draft.intro);
  const firstHeading = normalizeContentText(draft.sections[0]?.heading ?? "");

  return Boolean(
    subject &&
      normalizedHtml.includes(subject) &&
      ((intro && normalizedHtml.includes(intro.slice(0, 80))) ||
        (firstHeading && normalizedHtml.includes(firstHeading))),
  );
}

function hasPersistentNewsletterContent(html: string) {
  const normalizedHtml = normalizeContentText(stripHtmlTags(html));

  return normalizedHtml.includes("explore the learning center") && normalizedHtml.includes("serpico ai learning center") && normalizedHtml.includes("unsubscribe");
}

function stripHtmlTags(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeContentText(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
<html lang="en">
  <body style="margin:0;padding:0;background:#eef1f5;color:#111827;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(draft.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;border-collapse:collapse;padding:20px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="720" cellpadding="0" cellspacing="0" style="background:#ffffff;border-collapse:collapse;border-radius:6px;overflow:hidden;">
            <tr>
              <td align="center" style="background:#0d1b2e;padding:50px 40px 49px;">
                <img src="https://mcusercontent.com/<account-id>/images/0ce7f308-4079-72f1-3d96-c66dd291cc4d.png" alt="Serpico AI Learning Center at CEI" width="240" style="border:0;display:block;height:auto;margin:0 auto;max-width:240px;width:240px;" />
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:38px 48px 39px;">
                ${renderIntroHtml(draft)}
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;line-height:0;padding:0;">
                ${renderHeroImageHtml(image, draft.subject)}
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;color:#111827;font-family:Arial,Helvetica,sans-serif;padding:35px 48px 20px;">
                ${renderSectionsHtml(draft)}
              </td>
            </tr>
            ${renderLearningCenterButtonHtml()}
            ${renderDividerHtml()}
            ${renderMarketingCtaHtml()}
            ${renderFooterHtml()}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderIntroHtml(draft: NewsletterDraft) {
  return `<h1 style="color:#031126;font-family:Arial,Helvetica,sans-serif;font-size:29px;font-weight:700;line-height:1.1;margin:0 0 10px;">${escapeHtml(draft.subject)}</h1>
<p style="color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.45;margin:0;max-width:560px;">${escapeHtml(draft.intro)}</p>`;
}

function renderHeroImageHtml(image: GeneratedImage, subject: string) {
  return `<img src="${escapeAttribute(image.url)}" alt="${escapeAttribute(subject)}" width="720" style="border:0;display:block;height:auto;margin:0;max-width:720px;width:100%;" />`;
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

function renderLearningCenterButtonHtml() {
  return `<tr>
  <td align="left" style="background:#ffffff;padding:0 48px 44px;">
    <a href="https://serpicoailc.com" style="background:#3b73e6;border-radius:5px;color:#ffffff;display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;line-height:1.2;min-width:244px;padding:15px 28px;text-align:center;text-decoration:none;">Explore the Learning Center &rarr;</a>
  </td>
</tr>`;
}

function renderDividerHtml() {
  return `<tr>
  <td style="background:#0b1424;background-image:linear-gradient(90deg,#021122 0%,#0b4a88 28%,#54b5ff 50%,#5735c8 73%,#031225 100%);height:48px;line-height:0;padding:0;">
    <img src="https://mcusercontent.com/<account-id>/images/902c0ae4-7495-6b44-c893-a6fffc630e0b.png" alt="" width="720" style="border:0;display:block;height:auto;max-width:720px;width:100%;" />
  </td>
</tr>`;
}

function renderMarketingCtaHtml() {
  return `<tr>
  <td align="center" style="background:#0d1b2e;color:#ffffff;font-family:Arial,Helvetica,sans-serif;padding:43px 48px 45px;text-align:center;">
    <h2 style="color:#ffffff;font-size:31px;font-weight:900;line-height:1.25;margin:0 0 22px;">Solve your business problem in less than a day.</h2>
    <p style="color:#c7d8ee;font-size:16px;line-height:1.55;margin:0 0 24px;">We begin with a discovery call. We then pair you with the right specialist to help you build a tailored solution for your business.</p>
    <p style="color:#c7d8ee;font-size:16px;line-height:1.55;margin:0 0 24px;">Not a course. Not merely learning about AI. It's a real, working tool.</p>
    <a href="https://serpicoailc.com/register" style="background:#f2b334;border-radius:5px;color:#020817;display:inline-block;font-size:16px;font-weight:700;min-width:270px;padding:15px 34px;text-decoration:none;">Reserve Your 1:1 Expert Training</a>
  </td>
</tr>`;
}

function renderFooterHtml() {
  return `<tr>
  <td align="center" style="background:#eef1f5;color:#8a929b;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;padding:31px 40px;text-align:center;">
    <p style="margin:0 0 8px;">&copy; 2026 Serpico AI Learning Center &middot; Phoenix, AZ</p>
    <p style="margin:0;"><a href="*|UNSUB|*" style="color:#8a929b;text-decoration:underline;">Unsubscribe</a> &middot; <a href="*|UPDATE_PROFILE|*" style="color:#8a929b;text-decoration:underline;">Update Preferences</a></p>
  </td>
</tr>`;
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

  return `${draft.subject}\n\n${draft.preheader}\n\n${draft.intro}\n\n${sectionText}\n\nExplore the Learning Center: https://serpicoailc.com\n\nReserve Your 1:1 Expert Training: https://serpicoailc.com/register\n\n© 2026 Serpico AI Learning Center · Phoenix, AZ`;
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
