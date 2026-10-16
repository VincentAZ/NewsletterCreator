import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { stopOwnedProcess } from "../src/main/owned-process";
import { assertPortFree, run } from "../src/main/engines";
import { Jobs } from "../src/main/jobs";

test("managed shutdown waits for the owned process tree and leaves unrelated engines running", async () => {
  const server = `require('node:net').createServer().listen(0,'127.0.0.1',function(){console.log(this.address().port)});process.on('SIGTERM',()=>{});`;
  const parent = `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(server)}],{stdio:['ignore','inherit','inherit']});process.on('SIGTERM',()=>{});setInterval(()=>{},1000);`;
  const child = spawn(process.execPath, ["-e", parent], {
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const unrelated = spawn(process.execPath, ["-e", server], {
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const [ownedOutput, unrelatedOutput] = await Promise.all([
      once(child.stdout, "data"),
      once(unrelated.stdout, "data"),
    ]);
    const ownedPort = Number(String(ownedOutput[0]).trim());
    const unrelatedPort = Number(String(unrelatedOutput[0]).trim());
    await assert.rejects(assertPortFree(ownedPort), /already in use/);
    await stopOwnedProcess(child, 50);
    assert.ok(child.exitCode !== null || child.signalCode !== null);
    await assertPortFree(ownedPort);
    await assert.rejects(assertPortFree(unrelatedPort), /already in use/);
  } finally {
    await Promise.all([
      stopOwnedProcess(child, 50),
      stopOwnedProcess(unrelated, 50),
    ]);
  }
});

test(
  "cancelled installer commands wait for child cleanup before releasing their job",
  { timeout: 20000 },
  async () => {
    const jobs = new Jobs(() => {});
    let port = 0;
    let ready!: () => void;
    const listening = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const server = `require('node:net').createServer().listen(0,'127.0.0.1',function(){console.log(this.address().port)});process.on('SIGTERM',()=>{});`;
    const parent = `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(server)}],{stdio:['ignore','inherit','inherit']});process.on('SIGTERM',()=>{});setInterval(()=>{},1000);`;
    const operation = jobs.run("install", (signal) =>
      run(
        process.execPath,
        ["-e", parent],
        process.cwd(),
        signal,
        (message) => {
          port = Number(message);
          ready();
        },
      ),
    );
    const rejected = assert.rejects(operation, /abort|cancel/i);
    try {
      await listening;
      await assert.rejects(assertPortFree(port), /already in use/);
      await jobs.cancelAllAndWait();
      await assertPortFree(port);
      await rejected;
    } finally {
      await jobs.cancelAllAndWait();
    }
  },
);
