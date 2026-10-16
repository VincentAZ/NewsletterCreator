import { createHash, timingSafeEqual } from "node:crypto";

export function checkAccess(authorization: string | null, config: {
  production: boolean; hosted: boolean; username?: string; password?: string;
}): "allowed" | "unauthorized" | "unconfigured" {
  if (!config.production && !config.hosted) return "allowed";
  if (!config.username || !config.password) return "unconfigured";
  const expected = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(authorization ?? ""), digest(expected)) ? "allowed" : "unauthorized";
}
