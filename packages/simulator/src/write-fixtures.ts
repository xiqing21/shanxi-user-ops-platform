import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSnapshot } from "./generator";

const currentDir = dirname(fileURLToPath(import.meta.url));
const output = resolve(currentDir, "../../../data/fixtures/shanxi-snapshot.json");
const snapshot = generateSnapshot({ seed: 20260707, userCount: 200, readingMinutes: 12 });

await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(snapshot, null, 2), "utf8");
console.log(`wrote ${output}`);
