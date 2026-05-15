import { NextResponse } from "next/server";
import { getBalances } from "@/lib/newsletter/balances";
import { generateFalImage } from "@/lib/newsletter/providers";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    model?: string;
    prompt?: string;
    feedback?: string;
    systemPrompt?: string;
  };

  if (!body.model) {
    return NextResponse.json({ error: "model is required", balances: await getBalances() }, { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required", balances: await getBalances() }, { status: 400 });
  }

  try {
    const image = await generateFalImage({
      model: body.model,
      prompt: body.prompt,
      feedback: body.feedback,
      systemPrompt: body.systemPrompt,
    });

    return NextResponse.json({ image, balances: await getBalances() });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Image generation failed.",
        balances: await getBalances(),
      },
      { status: 500 },
    );
  }
}
