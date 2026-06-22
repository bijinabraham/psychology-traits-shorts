import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPipeline } from '../pipeline.js';
import type { BiasRecord, StructuredScript, SectionTiming } from '../types.js';

vi.mock('../bias-selector.js');
vi.mock('../script-loader.js');
vi.mock('../voice-synth.js');
vi.mock('../asset-fetcher.js');
vi.mock('../renderer.js');
vi.mock('../uploader.js');
vi.mock('../state-updater.js');

import { selectNextBias, selectBiasById } from '../bias-selector.js';
import { loadScriptForBias } from '../script-loader.js';
import { synthesizeScript } from '../voice-synth.js';
import { fetchBackgroundsForScript } from '../asset-fetcher.js';
import { renderShort } from '../renderer.js';
import { uploadShort } from '../uploader.js';
import { markBiasUsed, writeRunLog } from '../state-updater.js';

const bias: BiasRecord = {
  id: 'b1', name: 'Bias One', one_line_hook: 'h', source_link: 'https://x/b1', used_at: null,
};
const script: StructuredScript = {
  bias_id: 'b1', generated_at: '2026-06-22T00:00:00Z',
  title: 'T', description: 'D', tags: ['t'],
  sections: [
    { kind: 'hook', voice: 'v', on_screen: 'o', broll_query: 'q' },
    { kind: 'phenomenon', voice: 'v', on_screen: 'o', broll_query: 'q' },
    { kind: 'bias_name', voice: 'v', on_screen: 'Bias One', broll_query: 'q' },
    { kind: 'mechanism', voice: 'v', on_screen: 'o', broll_query: 'q' },
    { kind: 'twist', voice: 'v', on_screen: 'o', broll_query: 'q' },
    { kind: 'loop_bait', voice: 'v', on_screen: 'o', broll_query: 'q' },
  ],
};
const timings: SectionTiming[] = [
  { kind: 'hook', start_ms: 0, end_ms: 3000, words: [] },
  { kind: 'phenomenon', start_ms: 3000, end_ms: 15000, words: [] },
  { kind: 'bias_name', start_ms: 15000, end_ms: 18000, words: [] },
  { kind: 'mechanism', start_ms: 18000, end_ms: 40000, words: [] },
  { kind: 'twist', start_ms: 40000, end_ms: 55000, words: [] },
  { kind: 'loop_bait', start_ms: 55000, end_ms: 60000, words: [] },
];

const env = {
  ELEVENLABS_API_KEY: 'el-key',
  ELEVENLABS_VOICE_ID: 'el-voice',
  PEXELS_API_KEY: 'px-key',
  YOUTUBE_CLIENT_ID: 'y-id',
  YOUTUBE_CLIENT_SECRET: 'y-secret',
  YOUTUBE_REFRESH_TOKEN: 'y-rt',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(selectNextBias).mockResolvedValue(bias);
  vi.mocked(selectBiasById).mockResolvedValue(bias);
  vi.mocked(loadScriptForBias).mockResolvedValue(script);
  vi.mocked(synthesizeScript).mockResolvedValue({ audio_path: '/tmp/a.mp3', timings });
  vi.mocked(fetchBackgroundsForScript).mockResolvedValue(
    Array.from({ length: 6 }, (_, i) => `/tmp/bg-${i}.mp4`),
  );
  vi.mocked(renderShort).mockResolvedValue(undefined);
  vi.mocked(uploadShort).mockResolvedValue('yt-vid-id');
  vi.mocked(markBiasUsed).mockResolvedValue(undefined);
  vi.mocked(writeRunLog).mockResolvedValue(undefined);
});

describe('runPipeline', () => {
  it('happy path: selects bias, renders, uploads, marks used, writes log', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'pl-'));
    const exitCode = await runPipeline({
      env, dryRun: false, biasIdOverride: null,
      biasesPath: 'data/biases.json',
      scriptsPath: 'data/scripts.json',
      runsDir: 'data/runs',
      workDir,
    });
    expect(exitCode).toBe(0);
    expect(uploadShort).toHaveBeenCalledTimes(1);
    expect(markBiasUsed).toHaveBeenCalledWith('data/biases.json', 'b1', expect.any(String));
    expect(writeRunLog).toHaveBeenCalledTimes(1);
  });

  it('dry run: renders but does NOT upload or mark used', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'pl-'));
    const exitCode = await runPipeline({
      env, dryRun: true, biasIdOverride: null,
      biasesPath: 'data/biases.json',
      scriptsPath: 'data/scripts.json',
      runsDir: 'data/runs',
      workDir,
    });
    expect(exitCode).toBe(0);
    expect(renderShort).toHaveBeenCalledTimes(1);
    expect(uploadShort).not.toHaveBeenCalled();
    expect(markBiasUsed).not.toHaveBeenCalled();
  });

  it('failure in render aborts before upload and does NOT mark bias used', async () => {
    vi.mocked(renderShort).mockRejectedValue(new Error('render boom'));
    const workDir = await mkdtemp(join(tmpdir(), 'pl-'));
    const exitCode = await runPipeline({
      env, dryRun: false, biasIdOverride: null,
      biasesPath: 'data/biases.json',
      scriptsPath: 'data/scripts.json',
      runsDir: 'data/runs',
      workDir,
    });
    expect(exitCode).toBe(1);
    expect(uploadShort).not.toHaveBeenCalled();
    expect(markBiasUsed).not.toHaveBeenCalled();
  });

  it('biasIdOverride uses selectBiasById', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'pl-'));
    await runPipeline({
      env, dryRun: false, biasIdOverride: 'b1',
      biasesPath: 'data/biases.json',
      scriptsPath: 'data/scripts.json',
      runsDir: 'data/runs',
      workDir,
    });
    expect(selectBiasById).toHaveBeenCalledWith('data/biases.json', 'b1');
    expect(selectNextBias).not.toHaveBeenCalled();
  });

  it('throws if a required env var is missing', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'pl-'));
    const exitCode = await runPipeline({
      env: { ...env, ELEVENLABS_API_KEY: undefined as unknown as string },
      dryRun: false, biasIdOverride: null,
      biasesPath: 'data/biases.json',
      scriptsPath: 'data/scripts.json',
      runsDir: 'data/runs',
      workDir,
    });
    expect(exitCode).toBe(1);
    expect(synthesizeScript).not.toHaveBeenCalled();
  });
});
