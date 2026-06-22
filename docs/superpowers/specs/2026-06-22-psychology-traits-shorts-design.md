# Psychology Traits — Autonomous YouTube Shorts Pipeline

**Design Spec**
**Date:** 2026-06-22
**Status:** Approved for implementation planning

---

## 1. Project goal

Build a fully autonomous pipeline that publishes 2 educational YouTube Shorts per week to a niche channel (`@Psychologytiv`) about cognitive biases and mental quirks. After a ~30-hour one-time setup, the system runs without owner involvement except:

- ~10 min every 2-3 months to refill the pre-generated script bank using Claude Code
- Occasional ~30-min intervention if a step in the pipeline breaks

The goal is positive expected value at zero recurring cost, with realistic 12-month revenue expectations of $0-200/mo (see Section 8).

---

## 2. Niche & content strategy

### Niche
**Cognitive biases and mental quirks.** Chosen for:
- Evergreen content (no need to chase trends)
- ~250+ documented biases provide years of source material
- Low controversy / low ban risk
- Solid revenue per thousand views ($4-7 RPM)

### Content format
- 60-second YouTube Shorts (1080×1920, 9:16)
- One bias or mental quirk per video
- Title pattern: *"Why you [observable behavior] — the [Bias Name] explained"*

### Locked 5-section script template (60 seconds total)

| Section | Time | Purpose | Style |
|---|---|---|---|
| Hook | 0-3s | Specific observable behavior viewer recognizes | "You ever notice how..." |
| Phenomenon | 3-15s | Describe what's happening | Plain observation |
| Bias name + mechanism | 15-40s | Name it, explain the underlying reason | The "drop" moment — name shown at 120pt |
| Twist/implication | 40-55s | Why this matters or surprises | Single big statement |
| Loop bait | 55-60s | Question/claim that triggers rewatch | "Most people don't notice this until the 3rd watch..." |

### Cadence
**2 videos per week, Mondays and Thursdays at 6pm ET** (22:00 UTC; will drift 1 hour with DST — acceptable).

Rationale: 2x/week × ~4.3 weeks × ~1,000 chars per video ≈ 8,700 chars/month, staying inside the **free** ElevenLabs tier of 10,000 chars/month. 3x/week would require the $5/mo Starter tier.

### Content source
A pre-curated `data/biases.json` file containing ~250 entries:

```json
{
  "id": "confirmation-bias",
  "name": "Confirmation Bias",
  "one_line_hook": "Why you only remember the times your gut feeling was right",
  "source_link": "https://en.wikipedia.org/wiki/Confirmation_bias",
  "used_at": null
}
```

The `bias-selector` picks the next entry where `used_at` is null, in file order. Deterministic, simple, version-controlled.

### Pre-generated scripts (Option B)
Scripts are not generated at runtime. Owner runs `npx tsx scripts/generate-scripts.ts --count 20` locally inside a Claude Code session (Claude generates each script, the script file writes them to `data/scripts.json`). Output format:

```json
{
  "bias_id": "confirmation-bias",
  "generated_at": "2026-06-22T15:00:00Z",
  "title": "Why you only remember when your gut was right — the Confirmation Bias",
  "description": "...",
  "tags": ["psychology", "cognitive bias", "confirmation bias", "mental quirk"],
  "sections": [
    { "kind": "hook", "voice": "...", "on_screen": "...", "broll_query": "ink water slow motion" },
    { "kind": "phenomenon", "voice": "...", "on_screen": "...", "broll_query": "..." },
    { "kind": "bias_name", "voice": "...", "on_screen": "Confirmation Bias", "broll_query": "..." },
    { "kind": "mechanism", "voice": "...", "on_screen": "...", "broll_query": "..." },
    { "kind": "twist", "voice": "...", "on_screen": "...", "broll_query": "..." },
    { "kind": "loop_bait", "voice": "...", "on_screen": "...", "broll_query": "..." }
  ]
}
```

When the bank gets low (< 4 unused scripts), the pipeline opens a GitHub Issue reminding the owner to refill.

### Explicit non-goals
- No live A/B testing of titles/thumbnails
- No engagement automation (comments, replies, bots)
- No trending-topic integration
- No multi-language
- No daily cadence
- No human-face content

---

## 3. Channel identity

- **Display name:** Psychology Traits
- **Handle:** @Psychologytiv
- **Voice:** ElevenLabs preset voice (ID: `auq43ws1oslv0tO4BDa7`). Owner declined paid voice cloning. Tradeoff accepted: lower "defensible identity" score; sounds similar to other AI-narrated channels; estimated ~30% lower view ceiling vs cloned-voice baseline.

---

## 4. Pipeline architecture

### End-to-end flow

```
[Bias Selector] → [Script Loader] → [Voice Synth] → [Asset Fetcher]
                                                            ↓
                        [Uploader] ← [Renderer] ← [Composer]
                              ↓
                     [State Updater commits back to repo]
```

### Module responsibilities

| Module | File | Input | Output | Job |
|---|---|---|---|---|
| Bias Selector | `src/bias-selector.ts` | `data/biases.json` | `BiasRecord` | Picks next unused bias |
| Script Loader | `src/script-loader.ts` | bias ID + `data/scripts.json` | `StructuredScript` | Returns the pre-generated script for that bias |
| Voice Synth | `src/voice-synth.ts` | voice text per section | `audio.mp3` + per-section timing | Calls ElevenLabs API |
| Asset Fetcher | `src/asset-fetcher.ts` | per-section b-roll queries | `bg-1.mp4 .. bg-5.mp4` | Calls Pexels API |
| Renderer | `src/renderer.ts` | script + audio + bg files | `output.mp4` | Invokes Remotion headless render |
| Uploader | `src/uploader.ts` | `output.mp4` + title/desc/tags | YouTube video ID | YouTube Data API v3, sets visibility=Public, is_short=true |
| State Updater | `src/state-updater.ts` | bias ID, video ID, run metadata | git commit | Marks bias `used_at`, logs run, commits and pushes |
| Pipeline | `src/pipeline.ts` | CLI flags (`--dry-run`, `--bias-id`) | exit code | Orchestrates above, handles errors |

### Key design decisions

1. **Structured scripts, not raw text.** Voice text, on-screen text, and b-roll queries are separate fields. Each downstream module gets exactly what it needs.

2. **State lives in the repo.** `biases.json` and `scripts.json` are committed back after each run. No database. Repo is the source of truth.

3. **Fail closed.** Any error aborts the run *without* marking the bias as used. Next scheduled run retries the same bias. A GitHub Issue is auto-opened on failure.

4. **No in-run retries.** A single attempt per scheduled run keeps the pipeline simple and avoids burning API quota on bad inputs. The next cron tick is the retry.

5. **`--dry-run` mode supported.** Runs the full pipeline locally but uploads MP4 as a GitHub Actions artifact instead of publishing to YouTube. Used during the first 2 weeks and any template changes.

### File layout

```
psychology-traits-shorts/
├── data/
│   ├── biases.json              (queue, committed after each run)
│   ├── scripts.json             (pre-generated script bank)
│   └── runs/                    (per-video JSON logs)
├── src/
│   ├── pipeline.ts              (orchestrator entry)
│   ├── bias-selector.ts
│   ├── script-loader.ts
│   ├── voice-synth.ts
│   ├── asset-fetcher.ts
│   ├── renderer.ts
│   ├── uploader.ts
│   ├── state-updater.ts
│   └── oauth-bootstrap.ts       (one-time local script to generate YouTube refresh token)
├── remotion/
│   ├── Root.tsx
│   ├── ShortComposition.tsx
│   ├── components/
│   │   ├── BackgroundLayer.tsx
│   │   ├── KineticText.tsx
│   │   ├── BiasNameDrop.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── HandleBadge.tsx
│   │   └── Captions.tsx
│   └── fonts/                   (Instrument Serif + Inter, self-hosted)
├── scripts/
│   ├── generate-scripts.ts      (run locally inside a Claude Code session to refill the bank)
│   └── seed-biases.ts           (one-time: populate biases.json from Wikipedia)
├── .github/workflows/
│   └── publish.yml              (cron Mon + Thu 22:00 UTC)
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

### Secrets (stored in GitHub repo Settings → Secrets and Variables → Actions)

| Secret | Source | Sensitivity |
|---|---|---|
| `ELEVENLABS_API_KEY` | ElevenLabs dashboard | High |
| `ELEVENLABS_VOICE_ID` | Stored here for centralized config | Low |
| `PEXELS_API_KEY` | Pexels dashboard | Medium |
| `YOUTUBE_CLIENT_ID` | Google Cloud Console OAuth | Low |
| `YOUTUBE_CLIENT_SECRET` | Google Cloud Console OAuth | High |
| `YOUTUBE_REFRESH_TOKEN` | Generated locally by `oauth-bootstrap.ts` | High |

No `ANTHROPIC_API_KEY` is needed at runtime (Option B: scripts are pre-generated via Claude Code).

---

## 5. Remotion template (visual identity)

### Three-layer composition

```
┌──────────────────────────────────┐
│  Layer 3: Brand mark + captions  │  ← persistent overlays
│  Layer 2: Kinetic typography     │  ← words, animated per section beat
│  Layer 1: Pexels motion bg       │  ← abstract, slow, color-graded
└──────────────────────────────────┘
   1080 × 1920 (9:16 vertical)
```

### Layer 1 — Background

- 5 separate Pexels clips per video (one per script section)
- Each clip slowed to 0.5× playback
- 40% black overlay + 30% desaturation applied as Remotion CSS filters
- 200ms cross-fade between sections

### Layer 2 — Kinetic typography

- **Fonts:** Instrument Serif (display) + Inter (body). Both Google Fonts, self-hosted in `remotion/fonts/`.
- **Color:** white text on dark bg; single accent `#FFB84D` (warm amber) used *only* for the bias name
- **Animation grammar** (consistent across every video, synced to audio timestamps from ElevenLabs response):

| Section | Font | Size | Animation |
|---|---|---|---|
| Hook | Instrument Serif | 96pt | Word-by-word reveal, centered |
| Phenomenon | Inter | 56pt | Line-by-line slide-up |
| Bias name (the "drop") | Instrument Serif | 120pt | Scale-pop, accent color |
| Mechanism | Inter | 48pt | Paragraph chunks |
| Twist | Instrument Serif | 80pt | Single big statement, fade-in |
| Loop bait | Inter | 60pt | Question mark animates last |

### Layer 3 — Persistent overlays

- **Top-left:** `@Psychologytiv` in Inter 24pt, 70% opacity
- **Top-right:** 3px progress bar, accent color, fills left-to-right over 60s
- **Bottom:** Word-level captions (synced to audio), Inter 36pt bold, semi-transparent black plate

### Audio

- Voice from ElevenLabs (main track, full volume)
- Ambient music bed underneath at -22dB. One looping track from YouTube Audio Library or Pixabay for v1. Can rotate later.

### Why this looks "designed" and not generic

1. **Beat-synced rhythm:** every section transition lands on an audio timestamp from the ElevenLabs response, not a static timer
2. **Color restraint:** white + amber + Pexels bg only. No emojis, no rainbows, no stock graphics
3. **The bias-name drop:** every video has the 120pt name pop — becomes the channel's signature beat

---

## 6. Automation infrastructure

### GitHub Actions workflow (`.github/workflows/publish.yml`)

```yaml
name: publish-short
on:
  schedule:
    - cron: '0 22 * * 1,4'    # Mon + Thu, 22:00 UTC
  workflow_dispatch:
    inputs:
      dry_run:
        type: boolean
        default: false
      bias_id:
        description: "Override: specific bias ID to render"
        required: false

jobs:
  publish:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    permissions:
      contents: write           # commit state back
      issues: write             # auto-open failure issues
    steps:
      - checkout
      - setup-node@v4 (Node 20)
      - install ffmpeg + Chromium (for Remotion headless)
      - npm ci
      - npx tsx src/pipeline.ts [flags]
      - on success: commit + push updated state files
      - on failure: gh issue create with logs
```

### Runtime budget

Per run: ~3min setup + ~1min script load + ~2min Pexels + ~6-10min Remotion render + ~1min upload+commit = **~13-17 min/run**.
Monthly: ~17 min × 8-9 runs = **~120-150 min/mo**.
GitHub Actions free tier on **public repos = unlimited**. (Use public repo to avoid the 2,000-min private-repo cap.)

### One-time setup checklist (~2 hours, owner does once)

1. Create YouTube channel + claim `@Psychologytiv` handle (~5 min)
2. Sign up ElevenLabs free tier, save voice ID `auq43ws1oslv0tO4BDa7` (already done)
3. Set up Google Cloud project + enable YouTube Data API v3 + create OAuth Web Application credentials (~30 min)
4. Run `npx tsx src/oauth-bootstrap.ts` locally to generate `YOUTUBE_REFRESH_TOKEN` via one-time browser OAuth flow (~10 min)
5. Add all 6 secrets to GitHub repo Settings → Secrets → Actions (~15 min)
6. Run `npx tsx scripts/seed-biases.ts` to populate `data/biases.json` with the initial 250 entries (~5 min)
7. Inside a Claude Code session, run `npx tsx scripts/generate-scripts.ts --count 20` to populate `data/scripts.json` with the first 20 scripts (~15 min)
8. Manually trigger workflow with `dry_run: true`, download the MP4 artifact, review it, iterate on template if needed (~30 min)
9. Disable `dry_run`, ship first real video. Watch the next 2-3 runs to confirm stability.

### Monitoring (zero-effort, pull-based)

- All pipeline failures auto-open a GitHub Issue tagged `pipeline-failure` with logs + which step failed
- No email, no Slack, no Discord — owner sees it when they next visit the repo
- YouTube Analytics dashboard is the source of truth for view/sub metrics

### Manual controls

- **Pause:** disable workflow in GitHub Actions UI (1 click)
- **Skip a bias:** edit `data/biases.json`, set `used_at` manually, commit
- **Re-run a specific bias:** trigger workflow with `bias_id` input
- **Dry-run anytime:** trigger workflow with `dry_run: true`

### Tradeoffs

- **Pro:** $0/mo infrastructure. Zero servers. Full git history of every video produced.
- **Con:** GitHub Actions cron is best-effort — can drift up to 15 min during high load. Acceptable for 6pm posting.
- **Con:** Render time means iteration is slow. Mitigated by `--dry-run` mode runnable locally.

---

## 7. What is deliberately excluded (YAGNI list)

- No queue system, Redis, or database
- No multi-environment (dev/staging/prod) — single main branch
- No observability stack (no Grafana, no Sentry, no metrics ingestion)
- No automated tests of the upload step against real YouTube (risky; manual sanity check on first 3 videos instead)
- No web dashboard (GitHub UI is the dashboard)
- No A/B testing infra
- No content moderation pre-check (low-risk niche; YouTube will flag if anything trips policy)
- No retry-in-place inside a single run
- No automatic script refill (owner triggers it via Claude Code on demand)

---

## 8. Honest expectations & kill criteria

### 12-month outcome distribution (2026 base rates for AI-narrated faceless Shorts)

| Outcome | Probability | What it looks like |
|---|---|---|
| Stalls out | ~70% | <200 subs, <$10/mo at month 12 |
| Modest success | ~22% | 1-10k subs, monetized by month 9-12, $20-200/mo |
| Real hit | ~7% | 10-50k subs, $200-1500/mo |
| Breakout | ~1% | 100k+ subs, $1500+/mo |

### Checkpoint matrix

| Checkpoint | Healthy | Concerning | Kill |
|---|---|---|---|
| Week 4 (8 videos) | ≥200 views avg, 50+ subs | <100 views avg | (don't kill yet; fix infra if pipeline is broken) |
| Month 3 (24 videos) | 200+ subs, one video >2k views | <100 subs, no video >500 views | Consider sub-niche pivot |
| Month 6 (48 videos) | 1k+ subs OR a 10k+ view video | <300 subs, no video >2k | Kill or pivot format |
| Month 9 | On track for monetization (1k subs + 10M Shorts views/90d) | Plateaued under 500 subs | Kill |
| Month 12 | Monetized, $20+/mo | Monetized but <$10/mo | Kill or radically change |

### False alarms (do NOT treat as kill signals)

- Month 1-2 low views (algorithm hasn't learned the niche yet)
- A single bad video (channels are about averages)
- AI-voice criticism in comments
- The queue picking a less-interesting bias early on

### Build/don't-build self-test

**Build it if:** owner can let it run for 12 months without daily checking; the ~30 hours of setup feels like a fun project; outcomes of $0 forever wouldn't feel like a failure; $20-200/mo would feel like a win.

**Don't build it if:** owner is counting on it for a specific bill; would stress over daily analytics; would feel like a failure if it doesn't break out.

---

## 9. Open questions

None. All decisions are locked.

---

## 10. Locked decisions (canonical summary)

| Decision | Value |
|---|---|
| Niche | Cognitive biases & mental quirks |
| Channel display name | Psychology Traits |
| Channel handle | @Psychologytiv |
| Platforms | YouTube Shorts only (Phase 1) |
| Cadence | 2x/week, Mon + Thu 22:00 UTC (6pm ET winter, 5pm ET summer) |
| Video format | 60s, 1080×1920 |
| Voice | ElevenLabs preset (ID `auq43ws1oslv0tO4BDa7`), free tier |
| Visual style | Pexels stock motion bg + kinetic typography overlay |
| Fonts | Instrument Serif + Inter, accent color `#FFB84D` |
| Video assembly | Remotion (headless on GitHub Actions) |
| Runtime | GitHub Actions, public repo, cron-scheduled |
| Upload | YouTube Data API v3 (OAuth refresh token) |
| Script generation | Pre-generated in batches via Claude Code (Option B), no runtime LLM calls |
| State storage | Git-committed JSON files (`biases.json`, `scripts.json`) |
| Failure handling | Fail closed, auto-open GitHub Issue, retry on next scheduled run |
| Monitoring | Pull-based via GitHub UI; YouTube Analytics for content metrics |
