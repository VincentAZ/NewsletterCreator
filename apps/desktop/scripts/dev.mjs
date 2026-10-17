import { cp } from "node:fs/promises";
import { build } from "esbuild";
import { createServer } from "vite";
import { spawn } from "node:child_process";
import electron from "electron";
await build({
  entryPoints: ["src/main/index.ts"],
  outfile: "dist/main/index.cjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  external: ["electron"],
  sourcemap: true,
});
await build({
  entryPoints: ["src/preload/index.ts"],
  outfile: "dist/preload/index.cjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  external: ["electron"],
});
await cp("src/main/python-locks", "dist/main/python-locks", {
  recursive: true,
});
const server = await createServer();
await server.listen();
const desktopEnv = {
  ...process.env,
  NEWSLETTER_DEV_URL: "http://127.0.0.1:5197",
};
delete desktopEnv.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ["."], {
  stdio: "inherit",
  env: desktopEnv,
});
const cleanup = async () => {
  child.kill();
  await server.close();
};
child.on("exit", async (code) => {
  await server.close();
  process.exit(code || 0);
});
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
