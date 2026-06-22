import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { loadScriptForBias, countUnusedScripts } from '../script-loader.js';

vi.mock('node:fs/promises');

const sectionsFor = (biasName: string) => [
  { kind: 'hook' as const, voice: 'v1', on_screen: 'o1', broll_query: 'q1' },
  { kind: 'phenomenon' as const, voice: 'v2', on_screen: 'o2', broll_query: 'q2' },
  { kind: 'bias_name' as const, voice: 'v3', on_screen: biasName, broll_query: 'q3' },
  { kind: 'mechanism' as const, voice: 'v4', on_screen: 'o4', broll_query: 'q4' },
  { kind: 'twist' as const, voice: 'v5', on_screen: 'o5', broll_query: 'q5' },
  { kind: 'loop_bait' as const, voice: 'v6', on_screen: 'o6', broll_query: 'q6' },
];

const SAMPLE = [
  {
    bias_id: 'a', generated_at: '2026-06-22T00:00:00Z',
    title: 'A', description: 'A', tags: ['x'], sections: sectionsFor('A'),
  },
  {
    bias_id: 'b', generated_at: '2026-06-22T00:00:00Z',
    title: 'B', description: 'B', tags: ['x'], sections: sectionsFor('B'),
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readFile).mockResolvedValue(JSON.stringify(SAMPLE) as never);
});

describe('loadScriptForBias', () => {
  it('returns the script whose bias_id matches', async () => {
    const s = await loadScriptForBias('data/scripts.json', 'b');
    expect(s.title).toBe('B');
  });

  it('throws with a clear message if no script exists for the bias', async () => {
    await expect(loadScriptForBias('data/scripts.json', 'missing'))
      .rejects.toThrow(/no script.*missing/i);
  });
});

describe('countUnusedScripts', () => {
  it('returns scripts whose bias_id is in unusedBiasIds', async () => {
    const count = await countUnusedScripts('data/scripts.json', ['b', 'c']);
    expect(count).toBe(1);
  });
});
