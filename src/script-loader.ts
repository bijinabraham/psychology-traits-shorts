import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { StructuredScriptSchema, type StructuredScript } from './types.js';

const ScriptFileSchema = z.array(StructuredScriptSchema);

async function loadAll(path: string): Promise<StructuredScript[]> {
  const raw = await readFile(path, 'utf8');
  return ScriptFileSchema.parse(JSON.parse(raw));
}

export async function loadScriptForBias(
  scriptsPath: string,
  biasId: string,
): Promise<StructuredScript> {
  const all = await loadAll(scriptsPath);
  const match = all.find((s) => s.bias_id === biasId);
  if (!match) {
    throw new Error(`No script found for bias_id "${biasId}" in ${scriptsPath}. Run /generate-scripts to refill.`);
  }
  return match;
}

export async function countUnusedScripts(
  scriptsPath: string,
  unusedBiasIds: string[],
): Promise<number> {
  const all = await loadAll(scriptsPath);
  const set = new Set(unusedBiasIds);
  return all.filter((s) => set.has(s.bias_id)).length;
}
