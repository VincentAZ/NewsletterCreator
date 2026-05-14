import { NextResponse } from "next/server";
import { getBalances } from "@/lib/newsletter/balances";

export async function GET() {
  return NextResponse.json({ balances: await getBalances() });
}
