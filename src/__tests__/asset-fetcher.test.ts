import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchBackgroundsForScript } from '../asset-fetcher.js';
import type { StructuredScript } from '../types.js';

const script: StructuredScript = {
  bias_id: 'x',
  generated_at: '2026-06-22T00:00:00Z',
  title: 't', description: 'd', tags: [],
  sections: [
    { kind: 'hook', voice: 'v', on_screen: 'o', broll_query: 'ink water' },
    { kind: 'phenomenon', voice: 'v', on_screen: 'o', broll_query: 'smoke' },
    { kind: 'bias_name', voice: 'v', on_screen: 'o', broll_query: 'particles' },
    { kind: 'mechanism', voice: 'v', on_screen: 'o', broll_query: 'neurons' },
    { kind: 'twist', voice: 'v', on_screen: 'o', broll_query: 'liquid' },
    { kind: 'loop_bait', voice: 'v', on_screen: 'o', broll_query: 'swirl' },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchBackgroundsForScript', () => {
  it('returns 6 CDN URLs, one per section, preferring portrait HD clips', async () => {
    const searchResponse = {
      videos: [
        {
          id: 1,
          width: 1080,
          height: 1920,
          video_files: [
            { quality: 'hd', width: 1080, height: 1920, link: 'https://cdn.pexels.com/portrait-hd.mp4' },
            { quality: 'sd', width: 540, height: 960, link: 'https://cdn.pexels.com/portrait-sd.mp4' },
          ],
        },
      ],
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify(searchResponse)),
    );

    const urls = await fetchBackgroundsForScript(script, { apiKey: 'pexels-key' });

    expect(urls).toHaveLength(6);
    expect(urls[0]).toBe('https://cdn.pexels.com/portrait-hd.mp4');
    expect(urls[5]).toBe('https://cdn.pexels.com/portrait-hd.mp4');
    // 6 search calls only — no downloads
    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });

  it('throws if Pexels returns no videos for a query', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ videos: [] })),
    );
    await expect(
      fetchBackgroundsForScript(script, { apiKey: 'k' }),
    ).rejects.toThrow(/no pexels results/i);
  });
});
