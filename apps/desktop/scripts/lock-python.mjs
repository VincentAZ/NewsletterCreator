// Deliberate maintainer action; never run automatically by the application.
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { x } from "tar";

const exec = promisify(execFile);
const manifest = JSON.parse(
  await readFile(
    new URL("../src/main/runtime-manifest.json", import.meta.url),
    "utf8",
  ),
);
const working = resolve(process.argv[2] || "/tmp/newsletter-python-locks");
await mkdir(working, { recursive: true });
const artifact = manifest.engines[`${process.platform}-${process.arch}`]?.uv;
if (!artifact || artifact.archive !== "tar.gz")
  throw new Error("Generate locks on Linux x64 or Apple Silicon macOS.");
const archive = join(working, "uv.tar.gz");
await exec("curl", [
  "--fail",
  "--location",
  "--silent",
  "--show-error",
  artifact.url,
  "--output",
  archive,
]);
const actual = createHash("sha256")
  .update(await readFile(archive))
  .digest("hex");
if (`sha256:${actual}` !== artifact.digest)
  throw new Error("uv checksum mismatch");
await x({ file: archive, cwd: working, strict: true });
const uv = join(working, artifact.directory, "uv");
const input = join(working, "requirements.in");
await exec("curl", [
  "--fail",
  "--location",
  "--silent",
  "--show-error",
  `https://raw.githubusercontent.com/comfyanonymous/ComfyUI/${manifest.comfy.version}/requirements.txt`,
  "--output",
  input,
]);
const requirementsHash = createHash("sha256")
  .update(await readFile(input))
  .digest("hex");
if (requirementsHash !== manifest.comfy.requirementsSha256)
  throw new Error("ComfyUI requirements checksum mismatch");
const constraints = join(working, "constraints.txt");
await writeFile(
  constraints,
  "torch==2.9.1\ntorchvision==0.24.1\ntorchaudio==2.9.1\n",
);
const output = new URL("../src/main/python-locks/", import.meta.url);
await mkdir(output, { recursive: true });
const targets = [
  ["linux-x64-cpu", "x86_64-unknown-linux-gnu", "cpu"],
  ["linux-x64-cu128", "x86_64-unknown-linux-gnu", "cu128"],
  ["win32-x64-cpu", "x86_64-pc-windows-msvc", "cpu"],
  ["win32-x64-cu128", "x86_64-pc-windows-msvc", "cu128"],
  ["darwin-arm64-metal", "aarch64-apple-darwin", "cpu"],
];
for (const [name, platform, backend] of targets) {
  console.log(`Locking ${name}`);
  await exec(
    uv,
    [
      "pip",
      "compile",
      input,
      "--constraint",
      constraints,
      "--generate-hashes",
      "--only-binary",
      ":all:",
      "--python-version",
      "3.12",
      "--python-platform",
      platform,
      "--torch-backend",
      backend,
      "--exclude-newer",
      "2026-10-16",
      "--no-header",
      "--cache-dir",
      join(working, "cache"),
      "--output-file",
      fileURLToPath(new URL(`${name}.txt`, output)),
    ],
    {
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, MACOSX_DEPLOYMENT_TARGET: "14.0" },
    },
  );
}
const index = {};
for (const file of await readdir(output)) {
  if (!file.endsWith(".txt")) continue;
  const path = new URL(file, output);
  const normalized = (await readFile(path, "utf8"))
    .replaceAll(input, `ComfyUI-${manifest.comfy.version}/requirements.txt`)
    .replaceAll(constraints, "NewsletterCreator-pinned-torch-constraints");
  await writeFile(path, normalized);
  const bytes = Buffer.from(normalized);
  index[file.replace(/\.txt$/, "")] = {
    file,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
await writeFile(
  new URL("index.json", output),
  JSON.stringify(index, null, 2) + "\n",
);
console.log("Pinned dependency locks generated.");
