import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statfsSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join, dirname, resolve, relative, isAbsolute } from "node:path";
import { homedir, totalmem } from "node:os";
import { extractZip } from "./archive";
import { x as extractTar } from "tar";
import type { SetupStatus } from "@newsletter/core";
import manifest from "./runtime-manifest.json";
import { download, type Artifact } from "./download";
import { jsonRequest, localUrl } from "./network";
import type { Store } from "./store";

type Report = (message: string, completed?: number, total?: number) => void;
type Engine = "text" | "image";
const executable = (name: string) =>
  process.platform === "win32" ? name + ".exe" : name;
export class Engines {
  private processes = new Map<Engine, ChildProcess>();
  private installing = false;
  readonly root: string;
  private platform =
    `${process.platform}-${process.arch}` as keyof typeof manifest.engines;
  constructor(private store: Store) {
    this.root = join(store.directory, "engines");
    mkdirSync(this.root, { recursive: true });
  }
  private installed(engine: Engine) {
    return existsSync(join(this.root, engine, "installed.json"));
  }
  private existingLms() {
    const candidates = [
      join(homedir(), ".lmstudio", "bin", executable("lms")),
      join(homedir(), ".cache", "lm-studio", "bin", executable("lms")),
    ];
    return candidates.find(existsSync);
  }
  private lms() {
    return join(this.root, "text", ".bundle", executable("lms"));
  }
  private python() {
    return join(
      this.root,
      "image",
      "venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    );
  }
  async status(): Promise<SetupStatus> {
    const settings = this.store.settings();
    const disk = statfsSync(this.root);
    let gpu =
      process.platform === "darwin" && process.arch === "arm64"
        ? "Apple Silicon / Metal"
        : "CPU or undetected GPU";
    if (process.platform !== "darwin") {
      try {
        gpu =
          (
            await run(
              "nvidia-smi",
              ["--query-gpu=name,memory.total", "--format=csv,noheader"],
              this.root,
              AbortSignal.timeout(3000),
            )
          ).trim() || gpu;
      } catch {
        /* CPU remains usable. */
      }
    }
    const connected = async (url: string, path: string) => {
      try {
        await jsonRequest(localUrl(url) + path, {}, 1500);
        return true;
      } catch {
        return false;
      }
    };
    const [text, image] = await Promise.all([
      connected(settings.lmUrl, "/v1/models"),
      connected(settings.comfyUrl, "/system_stats"),
    ]);
    return {
      hardware: {
        platform: process.platform,
        arch: process.arch,
        memoryGB: Math.round(totalmem() / 1024 ** 3),
        freeDiskGB: Math.floor(
          (Number(disk.bavail) * Number(disk.bsize)) / 1024 ** 3,
        ),
        gpu,
        managedSupported: Boolean(manifest.engines[this.platform]),
      },
      engines: [
        {
          id: "text",
          installed: this.installed("text") || Boolean(this.existingLms()),
          connected: text,
          managed: this.installed("text"),
          details: text
            ? "Local text engine connected"
            : this.existingLms()
              ? "Existing LM Studio detected. Start its local server to connect."
              : "Install LM Studio's headless engine and Qwen model",
        },
        {
          id: "image",
          installed: this.installed("image"),
          connected: image,
          managed: this.installed("image"),
          details: image
            ? "ComfyUI connected"
            : "Install isolated ComfyUI and SDXL checkpoint",
        },
      ],
      downloads: [
        {
          id: "text-model",
          name: "Qwen3 4B Q4_K_M",
          bytes: manifest.models.text.bytes,
          termsUrl: manifest.models.text.termsUrl,
        },
        {
          id: "image-model",
          name: "SDXL 1.0",
          bytes: manifest.models.image.bytes,
          termsUrl: manifest.models.image.termsUrl,
        },
        {
          id: "text-engine",
          name: "LM Studio engine (additional runtime download)",
          bytes: manifest.engines[this.platform]?.text.bytes || 0,
          termsUrl: "https://lmstudio.ai/terms",
        },
        {
          id: "image-engine",
          name: "ComfyUI + Python/PyTorch (allow 8 GB additional)",
          bytes: 0,
          termsUrl:
            "https://github.com/comfyanonymous/ComfyUI/blob/v0.41.0/LICENSE",
        },
      ],
    };
  }
  async install(engine: Engine, signal: AbortSignal, report: Report) {
    if (this.installing)
      throw new Error("Another setup operation is in progress.");
    this.installing = true;
    try {
      const artifacts = manifest.engines[this.platform];
      if (!artifacts)
        throw new Error(
          "Managed setup is not available on this architecture. Connect an existing local engine in Settings.",
        );
      const status = await this.status();
      if (status.hardware.freeDiskGB < (engine === "text" ? 8 : 20))
        throw new Error(
          "Free at least 8 GB for text setup or 20 GB for image setup, then retry.",
        );
      if (
        status.engines.find((item) => item.id === engine)?.connected &&
        !this.installed(engine)
      ) {
        report(
          "Existing engine detected; its installation and settings are unchanged.",
        );
        return status;
      }
      if (engine === "text" && this.existingLms() && !this.installed("text"))
        throw new Error(
          "Existing LM Studio detected. Start its local server and choose a model in Settings. Managed setup will not overwrite your installation.",
        );
      const target = join(this.root, engine);
      mkdirSync(target, { recursive: true });
      if (engine === "text") {
        report("Installing verified LM Studio engine…");
        await this.unpack(
          artifacts.text,
          join(
            this.root,
            "downloads",
            "llmster-0.0.25-1." + artifacts.text.archive,
          ),
          target,
          signal,
          report,
        );
        // Upstream llmster owns its standard ~/.lmstudio data directory. Never redirect
        // the user's home or replace an existing installation to isolate it artificially.
        report("Initializing LM Studio's standard runtime data directory…");
        await run(
          join(target, executable("llmster")),
          ["bootstrap"],
          target,
          signal,
          report,
        );
        const model = await download(
          manifest.models.text,
          join(target, "models", manifest.models.text.filename),
          signal,
          report,
        );
        // Start and track the daemon before using the CLI, which can otherwise
        // launch a detached daemon outside the application's ownership.
        await this.start("text", signal, true);
        await run(
          this.lms(),
          [
            "import",
            model,
            "--hard-link",
            "--user-repo",
            manifest.models.text.repository,
            "--yes",
          ],
          target,
          signal,
          report,
        );
        writeFileSync(
          join(target, "installed.json"),
          JSON.stringify({ version: manifest.version, engine: "0.0.25-1" }),
        );
      } else {
        report("Installing isolated Python tooling…");
        const uvDir = join(target, "uv");
        await this.unpack(
          artifacts.uv,
          join(this.root, "downloads", "uv-0.13.1." + artifacts.uv.archive),
          uvDir,
          signal,
          report,
        );
        const uv = join(uvDir, artifacts.uv.directory, executable("uv"));
        const sourceDir = join(target, "source");
        await this.unpack(
          manifest.comfy,
          join(this.root, "downloads", "comfy-v0.41.0.zip"),
          sourceDir,
          signal,
          report,
        );
        const extracted = readdirSync(sourceDir).find((entry) =>
          existsSync(join(sourceDir, entry, "main.py")),
        );
        if (!extracted)
          throw new Error(
            "ComfyUI archive did not contain the expected application.",
          );
        // Use the extracted versioned directory directly; the pointer is app-owned.
        writeFileSync(
          join(target, "source.json"),
          JSON.stringify({ directory: join(sourceDir, extracted) }),
        );
        await run(
          uv,
          [
            "venv",
            "--allow-existing",
            "--managed-python",
            "--python",
            "3.12.12",
            join(target, "venv"),
          ],
          target,
          signal,
          report,
          this.pythonEnv(),
        );
        const index =
          process.platform === "darwin"
            ? "https://pypi.org/simple"
            : status.hardware.gpu.includes("CPU")
              ? "https://download.pytorch.org/whl/cpu"
              : "https://download.pytorch.org/whl/cu128";
        await run(
          uv,
          [
            "pip",
            "install",
            "--python",
            this.python(),
            "torch==2.9.1",
            "torchvision==0.24.1",
            "torchaudio==2.9.1",
            "--index-url",
            index,
          ],
          target,
          signal,
          report,
          this.pythonEnv(),
        );
        const constraints = join(target, "constraints.txt");
        writeFileSync(
          constraints,
          "torch==2.9.1\ntorchvision==0.24.1\ntorchaudio==2.9.1\n",
        );
        await run(
          uv,
          [
            "pip",
            "install",
            "--python",
            this.python(),
            "-r",
            join(sourceDir, extracted, "requirements.txt"),
            "-c",
            constraints,
          ],
          target,
          signal,
          report,
          this.pythonEnv(),
        );
        const checkpoint = join(
          sourceDir,
          extracted,
          "models",
          "checkpoints",
          manifest.models.image.filename,
        );
        await download(manifest.models.image, checkpoint, signal, report);
        writeFileSync(
          join(target, "installed.json"),
          JSON.stringify({
            version: manifest.version,
            engine: manifest.comfy.version,
            cpu: status.hardware.gpu.includes("CPU"),
          }),
        );
      }
      await this.start(engine, signal);
      const settings = this.store.settings();
      let textModel = "";
      if (engine === "text") {
        const models = (await jsonRequest(
          localUrl(settings.lmUrl) + "/v1/models",
          { signal },
        )) as { data: Array<{ id: string }> };
        textModel =
          models.data.find((model) => /qwen3.*4b/i.test(model.id))?.id || "";
        if (!textModel)
          throw new Error(
            "The engine is running but the installed Qwen model was not discovered. Refresh models in Settings.",
          );
      }
      this.store.saveSettings({
        ...settings,
        ...(engine === "text"
          ? { textModel }
          : { imageModel: manifest.models.image.filename }),
      });
      return this.status();
    } catch (error) {
      this.stop(engine);
      throw error;
    } finally {
      this.installing = false;
    }
  }
  private pythonEnv() {
    return {
      UV_PYTHON_INSTALL_DIR: join(this.root, "python"),
      UV_CACHE_DIR: join(this.root, "cache"),
      PIP_DISABLE_PIP_VERSION_CHECK: "1",
      DO_NOT_TRACK: "1",
      HF_HUB_DISABLE_TELEMETRY: "1",
    };
  }
  private async unpack(
    artifact: Artifact & { archive: string },
    archive: string,
    target: string,
    signal: AbortSignal,
    report: Report,
  ) {
    await download(artifact, archive, signal, report);
    signal.throwIfAborted();
    mkdirSync(target, { recursive: true });
    report("Extracting verified runtime…");
    if (artifact.archive === "zip") await extractZip(archive, resolve(target));
    else
      await extractTar({
        file: archive,
        cwd: target,
        strict: true,
        preservePaths: false,
      });
  }
  async start(
    engine: Engine,
    signal = AbortSignal.timeout(120000),
    duringInstall = false,
  ) {
    signal.throwIfAborted();
    if (!this.installed(engine) && !duringInstall)
      throw new Error(
        "Complete setup first, or start your existing engine outside this app.",
      );
    if (this.processes.has(engine)) return this.status();
    const settings = this.store.settings();
    const base = localUrl(
      engine === "text" ? settings.lmUrl : settings.comfyUrl,
    );
    const path = engine === "text" ? "/v1/models" : "/system_stats";
    try {
      await jsonRequest(base + path, {}, 1500);
      return this.status();
    } catch {
      /* start our instance */
    }
    const endpoint = new URL(base);
    if (endpoint.protocol !== "http:" || endpoint.pathname !== "/")
      throw new Error(
        "Managed engines need a local HTTP URL. HTTPS is available for existing engines only.",
      );
    await assertPortFree(
      Number(endpoint.port || (engine === "text" ? 1234 : 8188)),
    );
    let command: string, args: string[], cwd: string;
    if (engine === "text") {
      command = join(this.root, "text", executable("llmster"));
      args = [];
      cwd = dirname(command);
      const daemon = JSON.parse(
        await run(this.lms(), ["daemon", "status", "--json"], cwd, signal),
      ) as { status: string };
      if (daemon.status !== "not-running")
        throw new Error(
          "An existing LM Studio process is running. Start its server outside this app; it will not be taken over.",
        );
    } else {
      cwd = JSON.parse(
        readFileSync(join(this.root, "image", "source.json"), "utf8"),
      ).directory;
      const runtimePath = relative(resolve(this.root, "image"), resolve(cwd));
      if (
        !runtimePath ||
        runtimePath.startsWith("..") ||
        isAbsolute(runtimePath)
      )
        throw new Error("Invalid managed runtime directory.");
      command = this.python();
      const setup = JSON.parse(
        readFileSync(join(this.root, "image", "installed.json"), "utf8"),
      );
      args = [
        join(cwd, "main.py"),
        "--listen",
        "127.0.0.1",
        "--port",
        new URL(base).port || "8188",
        "--disable-auto-launch",
        "--disable-all-custom-nodes",
        ...(setup.cpu ? ["--cpu"] : []),
      ];
    }
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...this.pythonEnv(),
        LMS_DAEMON_DISABLE_UPDATES: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    this.processes.set(engine, child);
    let log = "";
    const capture = (chunk: Buffer) => {
      log = (log + chunk.toString()).slice(-4000);
    };
    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);
    child.on("error", (error) => {
      log = error.message;
      this.processes.delete(engine);
    });
    child.on("exit", () => this.processes.delete(engine));
    try {
      if (engine === "text") {
        let ready = false;
        for (let attempt = 0; attempt < 60; attempt++) {
          signal.throwIfAborted();
          if (!this.processes.has(engine))
            throw new Error(
              `Engine stopped during startup: ${log.slice(-1500)}`,
            );
          const status = JSON.parse(
            await run(this.lms(), ["daemon", "status", "--json"], cwd, signal),
          ) as { status: string };
          if (status.status === "running") {
            ready = true;
            break;
          }
          await delay(500, undefined, { signal });
        }
        if (!ready) throw new Error("LM Studio daemon did not become ready.");
        await run(
          this.lms(),
          [
            "server",
            "start",
            "--bind",
            "127.0.0.1",
            "--port",
            new URL(base).port || "1234",
          ],
          cwd,
          signal,
        );
      }
      for (let attempt = 0; attempt < 90; attempt++) {
        signal.throwIfAborted();
        if (!this.processes.has(engine))
          throw new Error(`Engine stopped during startup: ${log.slice(-1500)}`);
        try {
          await jsonRequest(base + path, { signal }, 1500);
          return this.status();
        } catch {
          await delay(1000, undefined, { signal });
        }
      }
      this.stop(engine);
      throw new Error(
        "Engine startup timed out. Check available memory and GPU drivers, then retry.",
      );
    } catch (error) {
      this.stop(engine);
      throw error;
    }
  }
  stop(engine: Engine) {
    const child = this.processes.get(engine);
    if (child) {
      child.kill();
      this.processes.delete(engine);
    }
  }
  stopAll() {
    this.stop("text");
    this.stop("image");
  }
}

export function run(
  command: string,
  args: string[],
  cwd: string,
  signal: AbortSignal,
  report: Report = () => {},
  env: Record<string, string> = {},
): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      signal,
      shell: false,
      windowsHide: true,
      env: { ...process.env, LMS_DAEMON_DISABLE_UPDATES: "1", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const consume = (chunk: Buffer) => {
      const text = chunk.toString();
      output = (output + text).slice(-16000);
      report(
        text
          .replace(/\x1b\[[0-9;]*m/g, "")
          .trim()
          .slice(-250),
      );
    };
    child.stdout.on("data", consume);
    child.stderr.on("data", consume);
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolvePromise(output)
        : reject(
            new Error(
              `${command.split(/[\\/]/).at(-1)} failed (${code}). ${output.slice(-1500)}`,
            ),
          ),
    );
  });
}

export async function assertPortFree(port: number) {
  await new Promise<void>((resolvePromise, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(
        new Error(
          `Port ${port} is already in use. Choose a different local engine port in Settings.`,
        ),
      ),
    );
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolvePromise()));
  });
}
