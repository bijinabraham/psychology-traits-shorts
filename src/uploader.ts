import { google } from 'googleapis';
import { createReadStream } from 'node:fs';

interface AuthCreds {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface UploadOptions {
  videoPath: string;
  title: string;
  description: string;
  tags: string[];
  auth: AuthCreds;
}

const SHORTS_MARKER = '#Shorts';

function buildDescription(description: string): string {
  if (description.includes(SHORTS_MARKER)) return description;
  return `${description}\n\n${SHORTS_MARKER}`;
}

export async function uploadShort(opts: UploadOptions): Promise<string> {
  const oauth = new google.auth.OAuth2(opts.auth.clientId, opts.auth.clientSecret);
  oauth.setCredentials({ refresh_token: opts.auth.refreshToken });

  const youtube = google.youtube({ version: 'v3', auth: oauth });

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: opts.title.slice(0, 100),
        description: buildDescription(opts.description),
        tags: opts.tags.slice(0, 15),
        categoryId: '27',
        defaultLanguage: 'en',
      },
      status: {
        privacyStatus: 'public',
        madeForKids: false,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: createReadStream(opts.videoPath),
    },
  });

  const id = res.data.id;
  if (!id) {
    throw new Error('YouTube upload succeeded but returned no video id');
  }
  return id;
}
