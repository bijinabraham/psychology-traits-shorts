import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { selectNextBias, selectBiasById } from './bias-selector.js';
import { loadScriptForBias } from './script-loader.js';
import { synthesizeScript, checkElevenLabsQuota } from './voice-synth.js';
import { fetchBackgroundsForScript } from './asset-fetcher.js';
import { renderShort } from './renderer.js';
import { uploadShort } from './uploader.js';
import { markBiasUsed, writeRunLog } from './state-updater.js';

export interface PipelineEnv {
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_VOICE_ID: string;
  PEXELS_API_KEY: string;
  YOUTUBE_CLIENT_ID: string;
  YOUTUBE_CLIENT_SECRET: string;
  YOUTUBE_REFRESH_TOKEN: string;
}

export interface PipelineOptions {
  env: PipelineEnv;
  dryRun: boolean;
  biasIdOverride: string | null;
  biasesPath: string;
  scriptsPath: string;
  runsDir: string;
  workDir: string;
}

const REQUIRED_ENV: (keyof PipelineEnv)[] = [
  'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'PEXELS_API_KEY',
  'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN',
];

function validateEnv(env: PipelineEnv): string | null {
  for (const key of REQUIRED_ENV) {
    if (!env[key]) return `Missing required env var: ${key}`;
  }
  return null;
}

export async function runPipeline(opts: PipelineOptions): Promise<number> {
  try {
    const envError = validateEnv(opts.env);
    if (envError) {
      console.error(`[pipeline] ${envError}`);
      return 1;
    }

    await mkdir(opts.workDir, { recursive: true });
    await mkdir(opts.runsDir, { recursive: true });

    console.log('[pipeline] selecting bias');
    const bias = opts.biasIdOverride
      ? await selectBiasById(opts.biasesPath, opts.biasIdOverride)
      : await selectNextBias(opts.biasesPath);
    console.log(`[pipeline] bias: ${bias.id} (${bias.name})`);

    console.log('[pipeline] loading script');
    const script = await loadScriptForBias(opts.scriptsPath, bias.id);

    console.log('[pipeline] checking ElevenLabs quota');
    const quota = await checkElevenLabsQuota(script, opts.env.ELEVENLABS_API_KEY);
    if (!quota.sufficient) {
      const resetIso = quota.resetUnix
        ? new Date(quota.resetUnix * 1000).toISOString()
        : 'unknown';
      console.log(
        `[pipeline] SKIP: ElevenLabs quota insufficient ` +
        `(available ${quota.available}, required ${quota.required}, resets ${resetIso}). ` +
        `Bias not marked used; will retry on next run.`,
      );
      return 0;
    }

    console.log('[pipeline] synthesizing voice');
    const { audio_data_url, timings } = await synthesizeScript(script, {
      apiKey: opts.env.ELEVENLABS_API_KEY,
      voiceId: opts.env.ELEVENLABS_VOICE_ID,
    });

    console.log('[pipeline] fetching backgrounds');
    const backgroundPaths = await fetchBackgroundsForScript(script, {
      apiKey: opts.env.PEXELS_API_KEY,
    });

    console.log('[pipeline] rendering video');
    const videoPath = join(opts.workDir, 'output.mp4');
    await renderShort({
      script, audioPath: audio_data_url, backgroundPaths, timings, outputPath: videoPath,
    });

    if (opts.dryRun) {
      console.log(`[pipeline] dry run complete; video at ${videoPath}`);
      return 0;
    }

    console.log('[pipeline] uploading to YouTube');
    const videoId = await uploadShort({
      videoPath,
      title: script.title,
      description: script.description,
      tags: script.tags,
      auth: {
        clientId: opts.env.YOUTUBE_CLIENT_ID,
        clientSecret: opts.env.YOUTUBE_CLIENT_SECRET,
        refreshToken: opts.env.YOUTUBE_REFRESH_TOKEN,
      },
    });
    console.log(`[pipeline] uploaded: https://youtube.com/shorts/${videoId}`);

    const runAt = new Date().toISOString();
    await markBiasUsed(opts.biasesPath, bias.id, runAt);
    await writeRunLog(opts.runsDir, {
      bias_id: bias.id,
      run_at: runAt,
      youtube_video_id: videoId,
      title: script.title,
      duration_sec: 60,
    });

    console.log('[pipeline] done');
    return 0;
  } catch (err) {
    console.error('[pipeline] FAILED:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    return 1;
  }
}

async function cli() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const biasIdIdx = argv.indexOf('--bias-id');
  const biasIdOverride = biasIdIdx !== -1 ? argv[biasIdIdx + 1] : null;

  const code = await runPipeline({
    env: process.env as unknown as PipelineEnv,
    dryRun,
    biasIdOverride: biasIdOverride ?? null,
    biasesPath: 'data/biases.json',
    scriptsPath: 'data/scripts.json',
    runsDir: 'data/runs',
    workDir: 'out/run',
  });
  process.exit(code);
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  cli();
}
