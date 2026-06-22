import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReadStream } from 'node:fs';
import { uploadShort } from '../uploader.js';

vi.mock('node:fs', () => ({
  createReadStream: vi.fn(() => 'STREAM' as never),
}));

const insertMock = vi.fn();
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
      })),
    },
    youtube: vi.fn(() => ({
      videos: { insert: insertMock },
    })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('uploadShort', () => {
  it('calls videos.insert with #Shorts in description and returns the video id', async () => {
    insertMock.mockResolvedValue({ data: { id: 'video-abc' } });

    const id = await uploadShort({
      videoPath: '/tmp/out.mp4',
      title: 'Why you only see what confirms — Confirmation Bias',
      description: 'A 60-second look at why your brain keeps a one-sided scoreboard.',
      tags: ['psychology', 'cognitive bias'],
      auth: {
        clientId: 'cid', clientSecret: 'cs', refreshToken: 'rt',
      },
    });

    expect(id).toBe('video-abc');
    expect(insertMock).toHaveBeenCalledTimes(1);
    const call = insertMock.mock.calls[0][0];
    expect(call.part).toEqual(['snippet', 'status']);
    expect(call.requestBody.snippet.title).toContain('Confirmation Bias');
    expect(call.requestBody.snippet.description).toContain('#Shorts');
    expect(call.requestBody.status.privacyStatus).toBe('public');
    expect(call.requestBody.status.madeForKids).toBe(false);
    expect(call.media.body).toBe('STREAM');
  });

  it('throws if the API call fails', async () => {
    insertMock.mockRejectedValue(new Error('quotaExceeded'));
    await expect(
      uploadShort({
        videoPath: '/tmp/out.mp4',
        title: 't', description: 'd', tags: [],
        auth: { clientId: 'c', clientSecret: 's', refreshToken: 'r' },
      }),
    ).rejects.toThrow(/quotaExceeded/);
  });
});
