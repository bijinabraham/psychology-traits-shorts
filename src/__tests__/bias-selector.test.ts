import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { selectNextBias, selectBiasById } from '../bias-selector.js';
import type { BiasRecord } from '../types.js';

vi.mock('node:fs/promises');

const SAMPLE: BiasRecord[] = [
  { id: 'a', name: 'A', one_line_hook: 'a', source_link: 'https://x/a', used_at: '2026-01-01T00:00:00Z' },
  { id: 'b', name: 'B', one_line_hook: 'b', source_link: 'https://x/b', used_at: null },
  { id: 'c', name: 'C', one_line_hook: 'c', source_link: 'https://x/c', used_at: null },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readFile).mockResolvedValue(JSON.stringify(SAMPLE) as never);
});

describe('selectNextBias', () => {
  it('returns the first bias whose used_at is null', async () => {
    const bias = await selectNextBias('data/biases.json');
    expect(bias.id).toBe('b');
  });

  it('throws a clear error if every bias has been used', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify([{ ...SAMPLE[0] }]) as never,
    );
    await expect(selectNextBias('data/biases.json')).rejects.toThrow(/all biases used/i);
  });

  it('throws if the file content fails schema validation', async () => {
    vi.mocked(readFile).mockResolvedValue('[{"id": "x"}]' as never);
    await expect(selectNextBias('data/biases.json')).rejects.toThrow();
  });
});

describe('selectBiasById', () => {
  it('returns the bias matching the given id even if already used', async () => {
    const bias = await selectBiasById('data/biases.json', 'a');
    expect(bias.id).toBe('a');
  });

  it('throws if no bias with that id exists', async () => {
    await expect(selectBiasById('data/biases.json', 'missing')).rejects.toThrow(/not found/i);
  });
});
