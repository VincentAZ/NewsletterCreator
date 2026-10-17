import { spawn, type ChildProcess } from "node:child_process";

/** Only use with direct children spawned by this app in their own process group. */
export async function stopOwnedProcess(child: ChildProcess, graceMs = 5000) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null)
    return;
  let didClose = false;
  child.once("close", () => {
    didClose = true;
  });
  const waitForClose = (timeout: number) =>
    new Promise<boolean>((resolve) => {
      if (didClose) {
        resolve(true);
        return;
      }
      const done = () => {
        clearTimeout(timer);
        resolve(true);
      };
      const timer = setTimeout(() => {
        child.off("close", done);
        resolve(false);
      }, timeout);
      child.once("close", done);
    });
  const closed = waitForClose(graceMs);
  if (process.platform === "win32") {
    // Windows has no POSIX process groups. Restrict taskkill to our direct child's tree.
    const killer = spawn(
      "taskkill.exe",
      ["/PID", String(child.pid), "/T", "/F"],
      { windowsHide: true, stdio: "ignore" },
    );
    await new Promise<void>((resolve, reject) => {
      killer.once("error", reject);
      killer.once("close", () => resolve());
    });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
  if ((await closed) || didClose) return;
  const forced = waitForClose(5000);
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
  if (!(await forced))
    throw new Error(
      "The managed engine did not stop. Wait for it to exit before restarting.",
    );
}
