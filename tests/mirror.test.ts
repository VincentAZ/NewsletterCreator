import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

test("feature-triggered mirrors retain main and mirror only source branches and tags", { skip: process.platform === "win32" }, () => {
  const directory = mkdtempSync(join(tmpdir(), "newsletter-mirror-"));
  const script = resolve("scripts/mirror-repository.sh");
  const source = join(directory, "source.git"), target = join(directory, "target.git"), checkout = join(directory, "checkout");
  const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    git(directory, "init", "--bare", "--initial-branch=main", source);
    git(directory, "init", "--bare", "--initial-branch=main", target);
    git(directory, "clone", source, checkout);
    git(checkout, "config", "user.name", "Test"); git(checkout, "config", "user.email", "test@example.invalid");
    writeFileSync(join(checkout, "content"), "main");
    git(checkout, "add", "content"); git(checkout, "commit", "-m", "main"); git(checkout, "push", "origin", "main");
    git(checkout, "checkout", "-b", "feat/preview"); git(checkout, "tag", "v0.1-test");
    git(checkout, "push", "origin", "feat/preview", "--tags");
    git(checkout, "branch", "-D", "main"); // Reproduce actions/checkout on a feature push.
    const mirror = () => execFileSync("bash", [script], { cwd: checkout, env: { ...process.env, MIRROR_REPOSITORY_URL: target }, stdio: ["ignore", "pipe", "pipe"] });
    mirror();
    assert.deepEqual(git(target, "for-each-ref", "--format=%(refname)").split("\n"), ["refs/heads/feat/preview", "refs/heads/main", "refs/tags/v0.1-test"]);
    assert.equal(git(target, "rev-parse", "main"), git(source, "rev-parse", "main"));
    git(source, "update-ref", "-d", "refs/heads/feat/preview"); git(source, "update-ref", "-d", "refs/tags/v0.1-test");
    mirror();
    assert.equal(git(target, "for-each-ref", "--format=%(refname)"), "refs/heads/main");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
