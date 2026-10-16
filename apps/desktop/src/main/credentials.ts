import { safeStorage } from "electron";
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";

export class Credentials {
  private session = new Map<string, string>();
  private filename: string;
  readonly secure: boolean;
  constructor(directory: string) {
    this.filename = join(directory, "credentials.json");
    this.secure =
      safeStorage.isEncryptionAvailable() &&
      (process.platform !== "linux" ||
        safeStorage.getSelectedStorageBackend() !== "basic_text");
  }
  private read(): Record<string, string> {
    return existsSync(this.filename)
      ? JSON.parse(readFileSync(this.filename, "utf8"))
      : {};
  }
  get(name: string) {
    if (this.session.has(name)) return this.session.get(name)!;
    const value = this.read()[name];
    if (!value || !this.secure) return "";
    try {
      return safeStorage.decryptString(Buffer.from(value, "base64"));
    } catch {
      throw new Error(
        "Unlock your OS credential store or re-enter this credential.",
      );
    }
  }
  set(name: string, value: string) {
    this.session.set(name, value);
    const values = this.read();
    if (!value) delete values[name];
    else if (this.secure)
      values[name] = safeStorage.encryptString(value).toString("base64");
    if (this.secure || !value) {
      writeFileSync(this.filename + ".tmp", JSON.stringify(values), {
        mode: 0o600,
      });
      renameSync(this.filename + ".tmp", this.filename);
    }
    return this.secure;
  }
  names() {
    return ["openrouter", "fal", "mailchimp"].filter((name) =>
      Boolean(this.get(name)),
    );
  }
}
