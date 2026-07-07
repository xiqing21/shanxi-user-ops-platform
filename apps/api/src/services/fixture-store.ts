import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { OperationsSnapshot } from "@shanxi/domain";
import { generateSnapshot } from "@shanxi/simulator";

const fixturePath = resolve(process.cwd(), "data/fixtures/shanxi-snapshot.json");

export async function loadSnapshot(): Promise<OperationsSnapshot> {
  try {
    return JSON.parse(await readFile(fixturePath, "utf8")) as OperationsSnapshot;
  } catch {
    return generateSnapshot({ seed: 20260707, userCount: 200, readingMinutes: 12 });
  }
}
