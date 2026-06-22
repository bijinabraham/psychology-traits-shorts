import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { resolve, relative } from 'node:path';
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import type { StructuredScript, SectionTiming } from './types.js';

interface RenderOptions {
  script: StructuredScript;
  audioPath: string;
  backgroundPaths: string[];
  timings: SectionTiming[];
  outputPath: string;
  durationFramesOverride?: number;
}

// Serve downloaded assets over HTTP so Remotion's OffthreadVideo can fetch them
// (Remotion's webpack server only serves its own bundle directory).
function startAssetServer(workDir: string): Promise<{ port: number; close: () => void }> {
  return new Promise((res) => {
    const server = createServer((req, response) => {
      const rawPath = decodeURIComponent(req.url ?? '/');
      const filePath = resolve(workDir, '.' + rawPath);
      if (!filePath.startsWith(workDir)) {
        response.writeHead(403).end();
        return;
      }
      try {
        const stat = statSync(filePath);
        const type = filePath.endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg';
        response.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': type });
        createReadStream(filePath).pipe(response);
      } catch {
        response.writeHead(404).end();
      }
    });
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      res({ port, close: () => server.close() });
    });
  });
}

export async function renderShort(opts: RenderOptions): Promise<void> {
  const entry = resolve(process.cwd(), 'remotion/Root.tsx');

  // workDir is the directory containing audio.mp3 and the bg/ subdirectory.
  const workDir = opts.audioPath
    ? resolve(opts.audioPath, '..')
    : process.cwd();

  const hasAssets = opts.audioPath || opts.backgroundPaths.some(p => p);
  let port = 0;
  let closeServer: () => void = () => {};

  if (hasAssets) {
    const srv = await startAssetServer(workDir);
    port = srv.port;
    closeServer = srv.close;
  }

  const toUrl = (localPath: string) =>
    localPath && port
      ? `http://localhost:${port}/${relative(workDir, localPath)}`
      : localPath;

  try {
    const bundled = await bundle({ entryPoint: entry });

    const inputProps = {
      script: opts.script,
      audioPath: toUrl(opts.audioPath),
      backgroundPaths: opts.backgroundPaths.map(toUrl),
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
  } finally {
    closeServer();
  }
}
