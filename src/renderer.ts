import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { resolve } from 'node:path';
import type { StructuredScript, SectionTiming } from './types.js';

interface RenderOptions {
  script: StructuredScript;
  audioPath: string;       // data URL (data:audio/mpeg;base64,...) or empty string
  backgroundPaths: string[]; // https:// CDN URLs or empty strings
  timings: SectionTiming[];
  outputPath: string;
  durationFramesOverride?: number;
}

export async function renderShort(opts: RenderOptions): Promise<void> {
  const entry = resolve(process.cwd(), 'remotion/Root.tsx');

  const bundled = await bundle({ entryPoint: entry });

  const inputProps = {
    script: opts.script,
    audioPath: opts.audioPath,
    backgroundPaths: opts.backgroundPaths,
    timings: opts.timings,
  };

  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'Short',
    inputProps,
  });

  await renderMedia({
    composition: opts.durationFramesOverride
      ? { ...composition, durationInFrames: opts.durationFramesOverride }
      : composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: opts.outputPath,
    inputProps,
  });
}
