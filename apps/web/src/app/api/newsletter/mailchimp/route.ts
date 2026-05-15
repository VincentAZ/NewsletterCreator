import { NextResponse } from "next/server";
import { createMailchimpCampaignDraft, isMailchimpConfigured } from "@/lib/newsletter/mailchimp";
import type { GeneratedImage, NewsletterDraft } from "@/lib/newsletter/types";

export async function GET() {
  return NextResponse.json({ configured: isMailchimpConfigured() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    draft?: NewsletterDraft;
    image?: GeneratedImage;
  };

  if (!body.draft) {
    return NextResponse.json({ error: "draft is required" }, { status: 400 });
  }

  if (!body.image?.url) {
    return NextResponse.json({ error: "image is required" }, { status: 400 });
  }

  try {
    const campaign = await createMailchimpCampaignDraft({
      draft: body.draft,
      image: body.image,
    });

    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mailchimp campaign creation failed." },
      { status: 500 },
    );
  }
}
