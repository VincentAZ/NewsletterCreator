import { NextRequest, NextResponse } from "next/server";
import { checkAccess } from "./lib/newsletter/access";
import { loadLocalEnv } from "./lib/newsletter/env";

export function proxy(request: NextRequest) {
  loadLocalEnv();
  const access = checkAccess(request.headers.get("authorization"), {
    production: process.env.NODE_ENV === "production",
    hosted: Boolean(process.env.VERCEL),
    username: process.env.NEWSLETTER_ADMIN_USER,
    password: process.env.NEWSLETTER_ADMIN_PASSWORD,
  });
  if (access === "allowed") {
    const origin = request.headers.get("origin");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && origin && new URL(origin).host !== request.headers.get("host")) {
      return new NextResponse("Cross-origin writes are not allowed.", { status: 403 });
    }
    return NextResponse.next();
  }
  return new NextResponse(access === "unconfigured"
    ? "Private deployment: configure NEWSLETTER_ADMIN_USER and NEWSLETTER_ADMIN_PASSWORD."
    : "Authentication required.", {
    status: access === "unconfigured" ? 503 : 401,
    headers: { "Cache-Control": "no-store", ...(access === "unauthorized" ? { "WWW-Authenticate": 'Basic realm="NewsletterCreator", charset="UTF-8"' } : {}) },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)"] };
