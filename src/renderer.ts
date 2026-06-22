import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { resolve, dirname, relative } from 'node:path';
import type { StructuredScript, SectionTiming } from './types.js';

interface RenderOptions {
  script: StructuredScript;
  audioPath: string;
  backgroundPaths: string[];
  timings: SectionTiming[];
  outputPath: string;
  durationFramesOverride?: number;
}

export async function renderShort(opts: RenderOptions): Promise<void> {
  const entry = resolve(process.cwd(), 'remotion/Root.tsx');

  // Remotion's webpack server only serves files within publicDir.
  // Set publicDir to the work directory so audio and bg/ videos are reachable,
  // then pass server-relative URLs (/audio.mp3, /bg/section-0.mp4) to the composition.
  const workDir = opts.audioPath
    ? dirname(opts.audioPath)
    : process.cwd();

  const bundled = await bundle({ entryPoint: entry, publicDir: workDir });

  const servedAudioPath = opts.audioPath ? '/audio.mp3' : '';
  const servedBgPaths = opts.backgroundPaths.map(p =>
    p ? '/' + relative(workDir, p) : ''
  );

  const inputProps = {
    script: opts.script,
    audioPath: servedAudioPath,
    backgroundPaths: servedBgPaths,
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
