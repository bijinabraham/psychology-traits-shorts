import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { synthesizeScript } from '../voice-synth.js';
import type { StructuredScript } from '../types.js';

const script: StructuredScript = {
  bias_id: 'x',
  generated_at: '2026-06-22T00:00:00Z',
  title: 't', description: 'd', tags: [],
  sections: [
    { kind: 'hook', voice: 'Hello there', on_screen: 'Hello there', broll_query: 'q' },
    { kind: 'phenomenon', voice: 'World', on_screen: 'World', broll_query: 'q' },
    { kind: 'bias_name', voice: 'Bias', on_screen: 'Bias', broll_query: 'q' },
    { kind: 'mechanism', voice: 'Mech', on_screen: 'Mech', broll_query: 'q' },
    { kind: 'twist', voice: 'Twist', on_screen: 'Twist', broll_query: 'q' },
    { kind: 'loop_bait', voice: 'Bait', on_screen: 'Bait', broll_query: 'q' },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('synthesizeScript', () => {
  it('calls ElevenLabs once per section and returns a data URL + per-section timings', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({
        audio_base64: Buffer.from('FAKEAUDIO').toString('base64'),
        alignment: {
          characters: ['H', 'e', 'l', 'l', 'o'],
          character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4],
          character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5],
        },
      })),
    );

    const result = await synthesizeScript(script, {
      apiKey: 'test',
      voiceId: 'voice-x',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(6);
    expect(fetchSpy.mock.calls[0][0]).toContain('voice-x');
    expect((fetchSpy.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      'xi-api-key': 'test',
    });

    expect(result.timings).toHaveLength(6);
    expect(result.timings.map((t) => t.kind)).toEqual([
      'hook', 'phenomenon', 'bias_name', 'mechanism', 'twist', 'loop_bait',
    ]);
    expect(result.timings[1].start_ms).toBe(result.timings[0].end_ms);

    expect(result.audio_data_url).toMatch(/^data:audio\/mpeg;base64,/);
  });

  it('throws if the API returns a non-OK status', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response('quota exceeded', { status: 429 }),
    );
    await expect(
      synthesizeScript(script, { apiKey: 't', voiceId: 'v' }),
    ).rejects.toThrow(/elevenlabs.*429/i);
  });
});
