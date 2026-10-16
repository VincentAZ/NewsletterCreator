import { open } from "yauzl";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve, sep, dirname } from "node:path";
import { pipeline } from "node:stream/promises";

/** Never materialize archive symlinks or paths outside the target directory. */
export function extractZip(file: string, directory: string) {
  return new Promise<void>((resolvePromise, reject) => {
    const root = resolve(directory);
    open(
      file,
      { lazyEntries: true, validateEntrySizes: true },
      (error, archive) => {
        if (error || !archive) {
          reject(error || new Error("Invalid ZIP archive."));
          return;
        }
        const fail = (error: unknown) => {
          archive.close();
          reject(error);
        };
        archive.on("error", fail);
        archive.on("end", resolvePromise);
        archive.on("entry", (entry) => {
          void (async () => {
            const target = resolve(root, entry.fileName);
            const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
            if (!target.startsWith(root + sep) || (mode & 0xf000) === 0xa000)
              throw new Error(
                "Archive contains an unsafe path or symbolic link.",
              );
            if (entry.fileName.endsWith("/")) {
              await mkdir(target, { recursive: true });
              archive.readEntry();
              return;
            }
            await mkdir(dirname(target), { recursive: true });
            archive.openReadStream(entry, (error, stream) => {
              if (error || !stream) {
                fail(error || new Error("Unreadable archive entry."));
                return;
              }
              void pipeline(
                stream,
                createWriteStream(target, {
                  mode: mode ? mode & 0o777 : 0o600,
                }),
              ).then(() => archive.readEntry(), fail);
            });
          })().catch(fail);
        });
        archive.readEntry();
      },
    );
  });
}
