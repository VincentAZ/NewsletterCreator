import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  statSync,
  renameSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { dirname } from "node:path";
import { once } from "node:events";

export type Artifact = { url: string; digest: string; bytes: number };
async function verify(path: string, digest: string) {
  const [algorithm, expected] = digest.split(":");
  if (
    !["sha256", "sha512"].includes(algorithm) ||
    !/^[a-f0-9]+$/i.test(expected)
  )
    throw new Error("Invalid artifact checksum.");
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex") === expected;
}
export async function download(
  artifact: Artifact,
  path: string,
  signal: AbortSignal,
  report: (message: string, completed?: number, total?: number) => void,
) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && (await verify(path, artifact.digest))) return path;
  const part = path + ".part";
  let offset = existsSync(part) ? statSync(part).size : 0;
  if (artifact.bytes && offset >= artifact.bytes) {
    if (offset === artifact.bytes && (await verify(part, artifact.digest))) {
      renameSync(part, path);
      return path;
    }
    rmSync(part);
    offset = 0;
  }
  const response = await fetch(artifact.url, {
    headers: offset ? { Range: `bytes=${offset}-` } : {},
    signal,
  });
  if (!response.ok || !response.body)
    throw new Error(
      `Download failed (HTTP ${response.status}). Retry setup to resume.`,
    );
  if (offset && response.status !== 206) offset = 0;
  if (
    offset &&
    !response.headers.get("content-range")?.startsWith(`bytes ${offset}-`)
  )
    throw new Error("The download server returned an invalid resume offset.");
  const total =
    artifact.bytes ||
    offset + Number(response.headers.get("content-length") || 0);
  const output = createWriteStream(part, {
    flags: offset ? "a" : "w",
    mode: 0o600,
  });
  const reader = response.body.getReader();
  let bytes = offset;
  let outputError: Error | undefined;
  output.on("error", (error) => {
    outputError = error;
  });
  try {
    while (true) {
      signal.throwIfAborted();
      if (outputError) throw outputError;
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (artifact.bytes && bytes > artifact.bytes)
        throw new Error("Downloaded artifact exceeds its pinned size.");
      if (!output.write(value)) await once(output, "drain");
      report("Downloading verified local AI files…", bytes, total || undefined);
    }
    output.end();
    await once(output, "close");
  } catch (error) {
    output.destroy();
    throw error;
  } finally {
    await reader.cancel();
  }
  signal.throwIfAborted();
  report("Verifying download integrity…");
  if (
    (artifact.bytes && bytes !== artifact.bytes) ||
    !(await verify(part, artifact.digest))
  ) {
    rmSync(part, { force: true });
    throw new Error(
      "Download checksum did not match. The file was discarded; retry setup.",
    );
  }
  renameSync(part, path);
  return path;
}
