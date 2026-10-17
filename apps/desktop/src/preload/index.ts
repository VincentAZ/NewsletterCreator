import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, Progress } from "@newsletter/core";

const api: DesktopApi = {
  async invoke(command, input) {
    const result = await ipcRenderer.invoke(
      "newsletter:invoke",
      command,
      input,
    );
    if (!result.ok) throw new Error(result.error || "Operation failed.");
    return result.value;
  },
  onProgress(callback) {
    const listener = (_event: unknown, progress: Progress) =>
      callback(progress);
    ipcRenderer.on("newsletter:progress", listener);
    return () => ipcRenderer.removeListener("newsletter:progress", listener);
  },
};
contextBridge.exposeInMainWorld("newsletter", api);
