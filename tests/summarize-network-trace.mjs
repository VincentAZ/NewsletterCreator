// Summarize an opt-in Linux strace capture without retaining request contents.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

if (!process.argv[2]) throw new Error("Pass the strace output prefix");
const prefix = resolve(process.argv[2]);
const files = readdirSync(dirname(prefix)).filter((name) =>
  name.startsWith(basename(prefix) + "."),
);
if (!files.length) throw new Error("No trace files found");
const addresses = {};
let unknownInternetDestinations = 0;
for (const file of files) {
  for (const line of readFileSync(join(dirname(prefix), file), "utf8").split(
    "\n",
  )) {
    if (!/\b(connect|sendto|sendmsg)\(/.test(line) || !line.includes("AF_INET"))
      continue;
    const address =
      line.match(/inet_addr\("([^"]+)"\)/)?.[1] ||
      line.match(/inet_pton\(AF_INET6, "([^"]+)"/)?.[1];
    if (address) addresses[address] = (addresses[address] || 0) + 1;
    else unknownInternetDestinations++;
  }
}
const external = Object.keys(addresses).filter(
  (address) =>
    address !== "::1" &&
    !/^127\./.test(address) &&
    !/^::ffff:127\./.test(address),
);
const result = {
  traceFiles: files.length,
  addresses,
  external,
  unknownInternetDestinations,
};
const output = join(dirname(prefix), "network-evidence.json");
writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
if (external.length || unknownInternetDestinations) process.exitCode = 1;
