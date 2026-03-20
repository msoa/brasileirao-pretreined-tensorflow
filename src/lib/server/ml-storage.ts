import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { TFJS_MODEL_DIR } from "@/lib/server/ml-model";
import type { PersistedModelState } from "@/lib/server/ml-model";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadPersistedModelState(filePath: string): Promise<PersistedModelState | null> {
  const hasState = await fileExists(filePath);
  if (!hasState) {
    return null;
  }

  const rawState = await readFile(filePath, "utf-8");
  return JSON.parse(rawState) as PersistedModelState;
}

export async function persistModelState(filePath: string, state: PersistedModelState): Promise<void> {
  await mkdir(TFJS_MODEL_DIR, { recursive: true });
  await writeFile(filePath, JSON.stringify(state), "utf-8");
}