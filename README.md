# Psychology Traits — Autonomous YouTube Shorts Pipeline

Publishes 2 educational Shorts per week to [@Psychologytiv](https://youtube.com/@Psychologytiv) covering cognitive biases and mental quirks. Runs on GitHub Actions. Zero recurring infrastructure cost.

**Spec:** `docs/superpowers/specs/2026-06-22-psychology-traits-shorts-design.md`
**Implementation plan:** `docs/superpowers/plans/2026-06-22-psychology-traits-shorts.md`

---

## One-time setup (~2 hours)

### 1. Create YouTube channel
- Sign in at youtube.com, create the channel "Psychology Traits", claim handle `@Psychologytiv`.

### 2. ElevenLabs
- Sign up at elevenlabs.io (free tier).
- Settings → API Keys → generate a new key. Save it.
- Pick a preset voice or use your saved voice ID (`auq43ws1oslv0tO4BDa7`).

### 3. Pexels
- Sign up at pexels.com/api. Generate a key. Save it.

### 4. Google Cloud OAuth (for YouTube upload)
- console.cloud.google.com → create project → enable "YouTube Data API v3"
- APIs & Services → OAuth consent screen → External → fill required fields → publish
- Credentials → Create credentials → OAuth client ID → Web application
- Authorized redirect URI: `http://localhost:53682/callback`
- Save Client ID and Client Secret.

### 5. Mint the YouTube refresh token locally
```bash
YOUTUBE_CLIENT_ID=<id> YOUTUBE_CLIENT_SECRET=<secret> npx tsx src/oauth-bootstrap.ts
```
Open the printed URL, grant access, copy the refresh token from stdout.

### 6. Add secrets to GitHub
Repo Settings → Secrets and variables → Actions → New repository secret. Add:
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `PEXELS_API_KEY`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`

### 7. Bootstrap content
Inside Claude Code:
- `/seed-biases` — populates `data/biases.json` with ~250 entries
- `/generate-scripts 20` — generates the first 20 scripts

Commit the resulting `data/biases.json` and `data/scripts.json`.

### 8. First dry run
Repo → Actions → publish-short → Run workflow → check `dry_run` → Run.
Download the MP4 artifact and review it. Iterate on the Remotion template if needed.

### 9. Ship the first real video
Re-run the workflow with `dry_run` unchecked. Watch the next 2-3 cron runs to confirm stability.

---

## Ongoing operations

- **Refill scripts** when the bank gets low: run `/generate-scripts 20` in Claude Code (every 2-3 months at 2x/week cadence).
- **Pause publishing**: Actions tab → publish-short → ••• → Disable workflow.
- **Skip a bias**: edit `data/biases.json`, set `used_at` to any non-null string, commit.
- **Re-publish a specific bias**: Actions → Run workflow → fill in `bias_id`.
- **Failures**: each pipeline failure auto-opens a GitHub Issue labeled `pipeline-failure` with a link to the run logs.

---

## Local development

```bash
npm install
npm test              # run all vitest specs
npm run typecheck     # tsc --noEmit
npm run remotion:preview   # open Remotion preview at http://localhost:3000

# end-to-end dry run (needs all env vars exported in your shell)
npm run pipeline:dry
```

---

## Honest expectations

See Section 8 of the design spec. Summary:
- ~70% chance this stalls at <$10/mo after 12 months
- ~22% chance: $20-200/mo
- ~7% chance: $200-1500/mo
- ~1% chance: $1500+/mo

This is a low-cost lottery ticket, not a paycheck. Set it up, let it run, check back in 6 months.
