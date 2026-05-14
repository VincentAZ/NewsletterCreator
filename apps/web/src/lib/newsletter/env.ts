import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

let loaded = false;

export function loadLocalEnv() {
  if (loaded) {
    return;
  }
  loaded = true;

  for (const envPath of findCandidateEnvFiles()) {
    if (!existsSync(envPath)) {
      continue;
    }

    const contents = readFileSync(envPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [name, ...valueParts] = trimmed.split("=");
      const key = name.trim();
      const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      if (key) {
        process.env[key] = value;
      }
    }
  }
}

function findCandidateEnvFiles() {
  const paths: string[] = [];
  let current = process.cwd();

  for (let depth = 0; depth < 5; depth += 1) {
    paths.push(join(current, ".env.local"));
    paths.push(join(current, ".env"));
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return paths;
}
