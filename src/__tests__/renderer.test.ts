import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { stat, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderShort } from '../renderer.js';
import type { StructuredScript, SectionTiming } from '../types.js';

const script: StructuredScript = {
  bias_id: 'integration',
  generated_at: '2026-06-22T00:00:00Z',
  title: 'Integration Test',
  description: 'd', tags: [],
  sections: [
    { kind: 'hook',       voice: 'a', on_screen: 'Hook', broll_query: 'q' },
    { kind: 'phenomenon', voice: 'b', on_screen: 'Phenomenon', broll_query: 'q' },
    { kind: 'bias_name',  voice: 'c', on_screen: 'Test Bias', broll_query: 'q' },
    { kind: 'mechanism',  voice: 'd', on_screen: 'Mechanism', broll_query: 'q' },
    { kind: 'twist',      voice: 'e', on_screen: 'Twist', broll_query: 'q' },
    { kind: 'loop_bait',  voice: 'f', on_screen: 'Loop?', broll_query: 'q' },
  ],
};

const timings: SectionTiming[] = [
  { kind: 'hook',       start_ms: 0,   end_ms: 167, words: [] },
  { kind: 'phenomenon', start_ms: 167, end_ms: 333, words: [] },
  { kind: 'bias_name',  start_ms: 333, end_ms: 500, words: [] },
  { kind: 'mechanism',  start_ms: 500, end_ms: 667, words: [] },
  { kind: 'twist',      start_ms: 667, end_ms: 833, words: [] },
  { kind: 'loop_bait',  start_ms: 833, end_ms: 1000, words: [] },
];

let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'render-test-'));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('renderShort', () => {
  it('produces an MP4 at the requested path', async () => {
    const out = join(workDir, 'out.mp4');
    await renderShort({
      script,
      audioPath: '',
      backgroundPaths: ['', '', '', '', '', ''],
      timings,
      outputPath: out,
      durationFramesOverride: 30,
    });
    const s = await stat(out);
    expect(s.size).toBeGreaterThan(1000);
  }, 120000);
});
