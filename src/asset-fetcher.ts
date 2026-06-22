import type { StructuredScript } from './types.js';

interface FetcherOptions {
  apiKey: string;
}

interface PexelsVideoFile {
  quality: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  video_files: PexelsVideoFile[];
}

interface PexelsResponse {
  videos: PexelsVideo[];
}

async function searchPexels(query: string, apiKey: string): Promise<PexelsVideo[]> {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=15&orientation=portrait`;
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) {
    throw new Error(`Pexels search ${res.status}: ${query}`);
  }
  const body = (await res.json()) as PexelsResponse;
  return body.videos;
}

function pickBestFile(video: PexelsVideo): PexelsVideoFile | null {
  const portraitHd = video.video_files.find(
    (f) => f.quality === 'hd' && f.width <= f.height && f.width >= 1080,
  );
  if (portraitHd) return portraitHd;
  const anyHd = video.video_files.find((f) => f.quality === 'hd');
  return anyHd ?? video.video_files[0] ?? null;
}

// Returns Pexels CDN URLs directly — no local download needed.
// Remotion's OffthreadVideo handles https:// URLs natively during render.
export async function fetchBackgroundsForScript(
  script: StructuredScript,
  opts: FetcherOptions,
): Promise<string[]> {
  const urls: string[] = [];

  for (let i = 0; i < script.sections.length; i++) {
    const section = script.sections[i];
    const candidates = await searchPexels(section.broll_query, opts.apiKey);
    if (candidates.length === 0) {
      throw new Error(`No Pexels results for query "${section.broll_query}" (section ${i})`);
    }
    const chosen = pickBestFile(candidates[0]);
    if (!chosen) {
      throw new Error(`No usable video file for query "${section.broll_query}"`);
    }
    urls.push(chosen.link);
  }

  return urls;
}
