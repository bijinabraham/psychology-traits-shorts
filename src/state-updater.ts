import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { BiasRecordSchema, type BiasRecord } from './types.js';

const BiasFileSchema = z.array(BiasRecordSchema);

export async function markBiasUsed(
  biasesPath: string,
  biasId: string,
  isoTimestamp: string,
): Promise<void> {
  const raw = await readFile(biasesPath, 'utf8');
  const all: BiasRecord[] = BiasFileSchema.parse(JSON.parse(raw));
  const idx = all.findIndex((b) => b.id === biasId);
  if (idx === -1) {
    throw new Error(`Bias with id "${biasId}" not found in ${biasesPath}`);
  }
  all[idx] = { ...all[idx], used_at: isoTimestamp };
  await writeFile(biasesPath, JSON.stringify(all, null, 2) + '\n');
}

export interface RunLogEntry {
  bias_id: string;
  run_at: string;
  youtube_video_id: string;
  title: string;
  duration_sec: number;
}

export async function writeRunLog(runsDir: string, entry: RunLogEntry): Promise<void> {
  // Filename: 2026-06-22T22-00-00Z__bias-id.json (colons replaced for filesystem safety)
  const stampFs = entry.run_at.replace(/:/g, '-').replace(/\.\d+Z?$/, 'Z');
  const filename = `${stampFs}__${entry.bias_id}.json`;
  await writeFile(`${runsDir}/${filename}`, JSON.stringify(entry, null, 2) + '\n');
}
