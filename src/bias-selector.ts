import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { BiasRecordSchema, type BiasRecord } from './types.js';

const BiasFileSchema = z.array(BiasRecordSchema);

async function loadAll(path: string): Promise<BiasRecord[]> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw);
  return BiasFileSchema.parse(parsed);
}

export async function selectNextBias(path: string): Promise<BiasRecord> {
  const all = await loadAll(path);
  const next = all.find((b) => b.used_at === null);
  if (!next) {
    throw new Error(`All biases used in ${path}. Refill via /generate-scripts or extend the queue.`);
  }
  return next;
}

export async function selectBiasById(path: string, id: string): Promise<BiasRecord> {
  const all = await loadAll(path);
  const found = all.find((b) => b.id === id);
  if (!found) {
    throw new Error(`Bias with id "${id}" not found in ${path}`);
  }
  return found;
}
