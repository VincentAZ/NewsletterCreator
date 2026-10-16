import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as pinnedFetch } from "undici";

export function privateAddress(address: string) {
  return (
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|172\.(1[6-9]|2\d|3[01])\.|19[28]\.0\.|198\.(18|19)\.|22[4-9]\.|2[3-5]\d\.)/.test(
      address,
    ) || /^(::|fc|fd|fe[89ab]|ff)/i.test(address)
  );
}
export function localUrl(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error(
      "Local engines must use a loopback URL, such as http://127.0.0.1:1234.",
    );
  return url.origin;
}
export async function fetchPublic(
  value: string,
  signal?: AbortSignal,
  maxBytes = 4 * 1024 * 1024,
): Promise<Response> {
  let url = new URL(value);
  for (let redirects = 0; redirects < 5; redirects++) {
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("Only public HTTP/HTTPS sources are allowed.");
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await lookup(hostname, { all: true });
    if (
      !addresses.length ||
      addresses.some(({ address }) => privateAddress(address))
    )
      throw new Error("Sources cannot access private network addresses.");
    const address = addresses[0];
    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname, _options, callback) =>
          callback(null, [
            { address: address.address, family: address.family },
          ]),
      },
    });
    try {
      const response = await pinnedFetch(url, {
        dispatcher,
        redirect: "manual",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
          : AbortSignal.timeout(30000),
        headers: {
          "User-Agent": "NewsletterCreator/0.1 (user-requested collection)",
          Accept:
            "text/html,application/rss+xml,application/atom+xml,application/xml",
        },
      });
      // The entire body is consumed below, allowing the pinned connection to close.
      const body = await limitedBytes(
        response as unknown as Response,
        maxBytes,
      );
      const bounded = new Response(
        [204, 205, 304].includes(response.status) ? null : body,
        {
          status: response.status,
          headers: Object.fromEntries(response.headers),
        },
      );
      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get("location")
      ) {
        url = new URL(response.headers.get("location")!, url);
        continue;
      }
      if (!response.ok)
        throw new Error(`Source returned HTTP ${response.status}.`);
      return bounded;
    } finally {
      await dispatcher.destroy();
    }
  }
  throw new Error("Too many source redirects.");
}
export class HttpError extends Error {
  constructor(readonly status: number) {
    super(
      `Request failed (HTTP ${status}). Check the connection, credentials, model and available memory.`,
    );
  }
}
export async function limitedBytes(response: Response, max = 4 * 1024 * 1024) {
  if (Number(response.headers.get("content-length")) > max) {
    await response.body?.cancel();
    throw new Error("Response is too large.");
  }
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw new Error("Response is too large.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}
export async function jsonRequest(
  url: string,
  init: RequestInit = {},
  timeout = 120000,
) {
  const signal = init.signal
    ? AbortSignal.any([init.signal, AbortSignal.timeout(timeout)])
    : AbortSignal.timeout(timeout);
  const response = await fetch(url, { ...init, signal, redirect: "error" });
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(response.status);
  }
  if (response.status === 204) return {};
  return JSON.parse(
    (await limitedBytes(response, 8 * 1024 * 1024)).toString("utf8"),
  ) as unknown;
}
