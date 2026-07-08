import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { OperationsSnapshot } from "@shanxi/domain";
import { generateSnapshot } from "@shanxi/simulator";

const fixturePath = resolveWorkspaceFixturePath();

export async function loadSnapshot(): Promise<OperationsSnapshot> {
  try {
    return JSON.parse(await readFile(fixturePath, "utf8")) as OperationsSnapshot;
  } catch {
    return generateSnapshot({ seed: 20260707, userCount: 200, readingMinutes: 12 });
  }
}

export async function saveSnapshot(snapshot: OperationsSnapshot): Promise<void> {
  await mkdir(dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

function resolveWorkspaceFixturePath() {
  let current = process.cwd();
  while (current !== dirname(current)) {
    if (existsSync(resolve(current, "pnpm-workspace.yaml"))) {
      return resolve(current, "data/fixtures/shanxi-snapshot.json");
    }
    current = dirname(current);
  }
  return resolve(process.cwd(), "data/fixtures/shanxi-snapshot.json");
}
