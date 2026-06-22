import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { markBiasUsed, writeRunLog } from '../state-updater.js';

vi.mock('node:fs/promises');

beforeEach(() => {
  vi.resetAllMocks();
});

describe('markBiasUsed', () => {
  it('sets used_at on the matching bias and writes the file back', async () => {
    const input = [
      { id: 'a', name: 'A', one_line_hook: 'a', source_link: 'https://x/a', used_at: null },
      { id: 'b', name: 'B', one_line_hook: 'b', source_link: 'https://x/b', used_at: null },
    ];
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(input) as never);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    await markBiasUsed('data/biases.json', 'a', '2026-06-22T22:00:00Z');

    const [path, body] = vi.mocked(writeFile).mock.calls[0];
    expect(path).toBe('data/biases.json');
    const written = JSON.parse(body as string);
    expect(written[0].used_at).toBe('2026-06-22T22:00:00Z');
    expect(written[1].used_at).toBeNull();
  });

  it('throws if the bias id does not exist', async () => {
    vi.mocked(readFile).mockResolvedValue('[]' as never);
    await expect(markBiasUsed('data/biases.json', 'missing', '2026-06-22T22:00:00Z'))
      .rejects.toThrow(/not found/i);
  });
});

describe('writeRunLog', () => {
  it('writes a JSON file under data/runs/ named after the bias and timestamp', async () => {
    vi.mocked(writeFile).mockResolvedValue(undefined);
    await writeRunLog('data/runs', {
      bias_id: 'a',
      run_at: '2026-06-22T22:00:00Z',
      youtube_video_id: 'abc123',
      title: 'X',
      duration_sec: 60,
    });
    const [path, body] = vi.mocked(writeFile).mock.calls[0];
    expect(path).toBe('data/runs/2026-06-22T22-00-00Z__a.json');
    const written = JSON.parse(body as string);
    expect(written.youtube_video_id).toBe('abc123');
  });
});
