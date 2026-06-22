/**
 * One-time local script to obtain a YouTube Data API refresh token.
 *
 * Run with:
 *   YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=... npx tsx src/oauth-bootstrap.ts
 *
 * Outputs the refresh_token to stdout. Paste it into the
 * YOUTUBE_REFRESH_TOKEN GitHub Actions secret.
 */
import { google } from 'googleapis';
import { createServer } from 'node:http';
import { URL } from 'node:url';

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

async function main() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars.');
    process.exit(1);
  }

  const oauth = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oauth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('\nOpen this URL in your browser and grant access:');
  console.log('  ' + authUrl + '\n');

  const code: string = await new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404).end();
        return;
      }
      const parsed = new URL(req.url, `http://localhost:${PORT}`);
      const c = parsed.searchParams.get('code');
      if (!c) {
        res.writeHead(400).end('Missing code');
        server.close();
        reject(new Error('No code in callback'));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h2>Done. You can close this tab.</h2>');
      server.close();
      resolve(c);
    });
    server.listen(PORT);
  });

  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    console.error('No refresh_token returned. Revoke app access at https://myaccount.google.com/permissions and retry.');
    process.exit(1);
  }

  console.log('\n=== YOUTUBE_REFRESH_TOKEN (add to GitHub Secrets) ===');
  console.log(tokens.refresh_token);
  console.log('=====================================================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
