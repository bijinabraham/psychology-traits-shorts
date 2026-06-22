import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { fetchBackgroundsForScript } from '../asset-fetcher.js';
import type { StructuredScript } from '../types.js';

vi.mock('node:fs/promises');

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
  vi.mocked(writeFile).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchBackgroundsForScript', () => {
  it('returns 6 file paths, one per section, preferring portrait HD clips', async () => {
    const searchResponse = {
      videos: [
        {
          id: 1,
          width: 1080,
          height: 1920,
          video_files: [
            { quality: 'hd', width: 1080, height: 1920, link: 'https://example.com/portrait-hd.mp4' },
            { quality: 'sd', width: 540, height: 960, link: 'https://example.com/portrait-sd.mp4' },
          ],
        },
      ],
    };
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(searchResponse)))
      .mockImplementation(async (url) => {
        if (String(url).includes('api.pexels.com')) return new Response(JSON.stringify(searchResponse));
        return new Response(Buffer.from('FAKEMP4'));
      });

    const paths = await fetchBackgroundsForScript(script, {
      apiKey: 'pexels-key',
      outputDir: '/tmp/bg',
    });

    expect(paths).toHaveLength(6);
    expect(paths[0]).toBe('/tmp/bg/section-0.mp4');
    expect(paths[5]).toBe('/tmp/bg/section-5.mp4');
    expect(fetchSpy).toHaveBeenCalledTimes(12);
    expect(writeFile).toHaveBeenCalledTimes(6);
  });

  it('throws if Pexels returns no videos for a query', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ videos: [] })),
    );
    await expect(
      fetchBackgroundsForScript(script, { apiKey: 'k', outputDir: '/tmp' }),
    ).rejects.toThrow(/no pexels results/i);
  });
});
