# Psychology Traits Shorts Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an autonomous pipeline that publishes 2 YouTube Shorts per week about cognitive biases, running on GitHub Actions with zero recurring cost.

**Architecture:** Node 20 + TypeScript modules orchestrated by a single `pipeline.ts`. Pre-generated scripts (stored in committed JSON) → ElevenLabs voice → Pexels backgrounds → Remotion render → YouTube upload via Data API v3. State (which biases used) lives in git.

**Tech Stack:** TypeScript, tsx, Vitest (testing), Remotion (video composition), googleapis (YouTube), ElevenLabs REST API, Pexels REST API, GitHub Actions (runtime).

---

## Spec deviation to acknowledge

The spec describes `scripts/seed-biases.ts` and `scripts/generate-scripts.ts` for owner-triggered content generation in Claude Code. The plan implements these as **Claude Code slash commands** in `.claude/commands/` instead — markdown files that instruct Claude what to do when the owner types `/seed-biases` or `/generate-scripts`. This is a small ergonomic improvement that better matches the spec's intent ("owner runs inside a Claude Code session") and avoids needing the Anthropic API key the spec ruled out. The `scripts/` directory is dropped.

---

## File structure

```
psychology-traits-shorts/
├── .claude/commands/
│   ├── seed-biases.md             (slash command: populate biases.json)
│   └── generate-scripts.md        (slash command: refill scripts.json)
├── .github/workflows/
│   └── publish.yml                (cron + workflow_dispatch)
├── data/
│   ├── biases.json                (250-entry queue; committed)
│   ├── scripts.json               (pre-generated scripts; committed)
│   └── runs/                      (per-video JSON logs)
├── remotion/
│   ├── Root.tsx                   (Remotion entry, registers compositions)
│   ├── ShortComposition.tsx       (60-second composition)
│   ├── components/
│   │   ├── BackgroundLayer.tsx
│   │   ├── KineticText.tsx
│   │   ├── BiasNameDrop.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── HandleBadge.tsx
│   │   └── Captions.tsx
│   ├── fonts.ts                   (load Instrument Serif + Inter via @remotion/google-fonts)
│   └── theme.ts                   (color, accent, sizes)
├── src/
│   ├── types.ts                   (shared TypeScript types)
│   ├── pipeline.ts                (orchestrator; entry point)
│   ├── bias-selector.ts
│   ├── script-loader.ts
│   ├── voice-synth.ts
│   ├── asset-fetcher.ts
│   ├── renderer.ts                (invokes Remotion programmatically)
│   ├── uploader.ts                (YouTube Data API v3)
│   ├── state-updater.ts
│   ├── oauth-bootstrap.ts         (one-time local OAuth flow)
│   └── __tests__/                 (vitest specs)
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── remotion.config.ts
├── .gitignore
└── README.md
```

---

## Test strategy (read before starting)

| Module category | Strategy |
|---|---|
| Pure logic (bias-selector, script-loader, state-updater) | Full TDD. Mock `fs/promises` with `vi.mock`. |
| API integration (voice-synth, asset-fetcher, uploader) | TDD with `vi.spyOn(global, 'fetch')` to stub HTTP. One manual smoke test in Task 22 against real APIs. |
| Renderer | Integration test: runs Remotion with mock data, asserts MP4 exists + duration ≈ 60s. |
| Remotion components | No automated tests. Visual verification via `npx remotion preview` (covered in Task 22). |
| Pipeline orchestrator | Integration test with every module mocked. Plus `--dry-run` end-to-end in Task 22. |
| OAuth bootstrap | No tests (interactive one-off). |
| Slash commands | No tests (instructions for Claude). |

**Important conventions:**
- All tests live in `src/__tests__/<module>.test.ts`
- Use `vi.mock('node:fs/promises')` for file system stubs
- Never call a real third-party API from any automated test
- Test names describe behavior in plain English: `it('picks the first bias whose used_at is null')`

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `remotion.config.ts`
- Modify: `.gitignore` (add Node/Remotion artifacts)

- [ ] **Step 1: Initialize package.json**

Create `package.json`:

```json
{
  "name": "psychology-traits-shorts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "pipeline": "tsx src/pipeline.ts",
    "pipeline:dry": "tsx src/pipeline.ts --dry-run",
    "remotion:preview": "remotion preview remotion/Root.tsx",
    "oauth:bootstrap": "tsx src/oauth-bootstrap.ts"
  },
  "dependencies": {
    "@remotion/bundler": "^4.0.0",
    "@remotion/cli": "^4.0.0",
    "@remotion/google-fonts": "^4.0.0",
    "@remotion/renderer": "^4.0.0",
    "googleapis": "^144.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "^4.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "remotion"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create remotion.config.ts**

```typescript
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setConcurrency(2);
Config.setChromiumOpenGlRenderer('angle');
```

- [ ] **Step 5: Extend .gitignore**

Add to existing `.gitignore`:

```
# Remotion artifacts
out/
remotion/.cache/

# Local env
.env
.env.local

# Test outputs
coverage/

# Runtime outputs
data/runs/*.json
!data/runs/.gitkeep
```

- [ ] **Step 6: Create empty data/runs/.gitkeep so the directory is tracked**

```bash
mkdir -p data/runs && touch data/runs/.gitkeep
```

- [ ] **Step 7: Install dependencies + verify typecheck passes**

Run: `npm install`
Run: `npm run typecheck`
Expected: exits 0 (no source files yet but tsconfig is valid)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts remotion.config.ts .gitignore data/runs/.gitkeep
git commit -m "chore: scaffold Node + TS + Remotion + Vitest project"
```

---

## Task 2: Shared TypeScript types

**Files:**
- Create: `src/types.ts`
- Create: `src/__tests__/types.test.ts`

- [ ] **Step 1: Write failing test for Zod schema validation**

Create `src/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BiasRecordSchema, StructuredScriptSchema } from '../types.js';

describe('BiasRecord schema', () => {
  it('accepts a valid unused bias entry', () => {
    const valid = {
      id: 'confirmation-bias',
      name: 'Confirmation Bias',
      one_line_hook: 'Why you only remember when your gut was right',
      source_link: 'https://en.wikipedia.org/wiki/Confirmation_bias',
      used_at: null,
    };
    expect(() => BiasRecordSchema.parse(valid)).not.toThrow();
  });

  it('accepts a used bias entry with ISO timestamp', () => {
    const used = {
      id: 'sunk-cost',
      name: 'Sunk Cost Fallacy',
      one_line_hook: 'Why you finish bad movies',
      source_link: 'https://en.wikipedia.org/wiki/Sunk_cost',
      used_at: '2026-06-22T22:00:00Z',
    };
    expect(() => BiasRecordSchema.parse(used)).not.toThrow();
  });

  it('rejects a record missing the id field', () => {
    const invalid = { name: 'X', one_line_hook: 'Y', source_link: 'Z', used_at: null };
    expect(() => BiasRecordSchema.parse(invalid)).toThrow();
  });
});

describe('StructuredScript schema', () => {
  it('accepts a script with all 6 section kinds in order', () => {
    const script = {
      bias_id: 'confirmation-bias',
      generated_at: '2026-06-22T15:00:00Z',
      title: 'Why you only remember when your gut was right — the Confirmation Bias',
      description: 'A 60-second look at why your brain keeps a one-sided scoreboard.',
      tags: ['psychology', 'cognitive bias', 'confirmation bias'],
      sections: [
        { kind: 'hook', voice: 'You ever notice...', on_screen: 'You ever notice...', broll_query: 'ink water slow motion' },
        { kind: 'phenomenon', voice: '...', on_screen: '...', broll_query: 'smoke abstract dark' },
        { kind: 'bias_name', voice: '...', on_screen: 'Confirmation Bias', broll_query: 'particles floating' },
        { kind: 'mechanism', voice: '...', on_screen: '...', broll_query: 'neurons firing' },
        { kind: 'twist', voice: '...', on_screen: '...', broll_query: 'liquid metal flowing' },
        { kind: 'loop_bait', voice: '...', on_screen: '...', broll_query: 'ink swirl dark' },
      ],
    };
    expect(() => StructuredScriptSchema.parse(script)).not.toThrow();
  });

  it('rejects a script with the wrong number of sections', () => {
    const tooFew = {
      bias_id: 'x', generated_at: '2026-06-22T00:00:00Z',
      title: 'x', description: 'x', tags: [],
      sections: [{ kind: 'hook', voice: 'x', on_screen: 'x', broll_query: 'x' }],
    };
    expect(() => StructuredScriptSchema.parse(tooFew)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- types.test.ts`
Expected: FAIL — `Cannot find module '../types.js'`

- [ ] **Step 3: Implement types.ts**

Create `src/types.ts`:

```typescript
import { z } from 'zod';

export const BiasRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  one_line_hook: z.string().min(1),
  source_link: z.string().url(),
  used_at: z.string().datetime().nullable(),
});
export type BiasRecord = z.infer<typeof BiasRecordSchema>;

export const SectionKindSchema = z.enum([
  'hook',
  'phenomenon',
  'bias_name',
  'mechanism',
  'twist',
  'loop_bait',
]);
export type SectionKind = z.infer<typeof SectionKindSchema>;

export const ScriptSectionSchema = z.object({
  kind: SectionKindSchema,
  voice: z.string().min(1),
  on_screen: z.string().min(1),
  broll_query: z.string().min(1),
});
export type ScriptSection = z.infer<typeof ScriptSectionSchema>;

// Sections must appear in the canonical order and contain exactly 6 entries.
const SECTION_ORDER: SectionKind[] = [
  'hook', 'phenomenon', 'bias_name', 'mechanism', 'twist', 'loop_bait',
];

export const StructuredScriptSchema = z.object({
  bias_id: z.string().min(1),
  generated_at: z.string().datetime(),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(5000),
  tags: z.array(z.string()).max(15),
  sections: z.array(ScriptSectionSchema)
    .length(6)
    .refine(
      (arr) => arr.every((s, i) => s.kind === SECTION_ORDER[i]),
      { message: 'sections must be in canonical order: hook, phenomenon, bias_name, mechanism, twist, loop_bait' },
    ),
});
export type StructuredScript = z.infer<typeof StructuredScriptSchema>;

// Per-section audio timing returned by ElevenLabs alignment endpoint.
export interface SectionTiming {
  kind: SectionKind;
  start_ms: number;
  end_ms: number;
  // Per-word timing within this section for caption sync
  words: { word: string; start_ms: number; end_ms: number }[];
}

export interface RunArtifacts {
  bias: BiasRecord;
  script: StructuredScript;
  audio_path: string;
  background_paths: string[]; // 6 entries, one per section
  timings: SectionTiming[];   // 6 entries, one per section
  output_video_path: string;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- types.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: exits 0

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/__tests__/types.test.ts
git commit -m "feat(types): add Zod schemas for BiasRecord and StructuredScript"
```

---

## Task 3: Bias selector module

**Files:**
- Create: `src/bias-selector.ts`
- Create: `src/__tests__/bias-selector.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/bias-selector.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { selectNextBias, selectBiasById } from '../bias-selector.js';
import type { BiasRecord } from '../types.js';

vi.mock('node:fs/promises');

const SAMPLE: BiasRecord[] = [
  { id: 'a', name: 'A', one_line_hook: 'a', source_link: 'https://x/a', used_at: '2026-01-01T00:00:00Z' },
  { id: 'b', name: 'B', one_line_hook: 'b', source_link: 'https://x/b', used_at: null },
  { id: 'c', name: 'C', one_line_hook: 'c', source_link: 'https://x/c', used_at: null },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readFile).mockResolvedValue(JSON.stringify(SAMPLE) as never);
});

describe('selectNextBias', () => {
  it('returns the first bias whose used_at is null', async () => {
    const bias = await selectNextBias('data/biases.json');
    expect(bias.id).toBe('b');
  });

  it('throws a clear error if every bias has been used', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify([{ ...SAMPLE[0] }]) as never,
    );
    await expect(selectNextBias('data/biases.json')).rejects.toThrow(/all biases used/i);
  });

  it('throws if the file content fails schema validation', async () => {
    vi.mocked(readFile).mockResolvedValue('[{"id": "x"}]' as never);
    await expect(selectNextBias('data/biases.json')).rejects.toThrow();
  });
});

describe('selectBiasById', () => {
  it('returns the bias matching the given id even if already used', async () => {
    const bias = await selectBiasById('data/biases.json', 'a');
    expect(bias.id).toBe('a');
  });

  it('throws if no bias with that id exists', async () => {
    await expect(selectBiasById('data/biases.json', 'missing')).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- bias-selector.test.ts`
Expected: FAIL — `Cannot find module '../bias-selector.js'`

- [ ] **Step 3: Implement bias-selector.ts**

Create `src/bias-selector.ts`:

```typescript
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { BiasRecordSchema, type BiasRecord } from './types.js';

const BiasFileSchema = z.array(BiasRecordSchema);

async function loadAll(path: string): Promise<BiasRecord[]> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw);
  return BiasFileSchema.parse(parsed);
}

export async function selectNextBias(path: string): Promise<BiasRecord> {
  const all = await loadAll(path);
  const next = all.find((b) => b.used_at === null);
  if (!next) {
    throw new Error(`All biases used in ${path}. Refill via /generate-scripts or extend the queue.`);
  }
  return next;
}

export async function selectBiasById(path: string, id: string): Promise<BiasRecord> {
  const all = await loadAll(path);
  const found = all.find((b) => b.id === id);
  if (!found) {
    throw new Error(`Bias with id "${id}" not found in ${path}`);
  }
  return found;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- bias-selector.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/bias-selector.ts src/__tests__/bias-selector.test.ts
git commit -m "feat(bias-selector): load biases.json and pick next unused entry"
```

---

## Task 4: State updater module

**Files:**
- Create: `src/state-updater.ts`
- Create: `src/__tests__/state-updater.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/state-updater.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- state-updater.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement state-updater.ts**

Create `src/state-updater.ts`:

```typescript
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { BiasRecordSchema, type BiasRecord } from './types.js';

const BiasFileSchema = z.array(BiasRecordSchema);

export async function markBiasUsed(
  biasesPath: string,
  biasId: string,
  isoTimestamp: string,
): Promise<void> {
  const raw = await readFile(biasesPath, 'utf8');
  const all: BiasRecord[] = BiasFileSchema.parse(JSON.parse(raw));
  const idx = all.findIndex((b) => b.id === biasId);
  if (idx === -1) {
    throw new Error(`Bias with id "${biasId}" not found in ${biasesPath}`);
  }
  all[idx] = { ...all[idx], used_at: isoTimestamp };
  await writeFile(biasesPath, JSON.stringify(all, null, 2) + '\n');
}

export interface RunLogEntry {
  bias_id: string;
  run_at: string;
  youtube_video_id: string;
  title: string;
  duration_sec: number;
}

export async function writeRunLog(runsDir: string, entry: RunLogEntry): Promise<void> {
  // Filename: 2026-06-22T22-00-00Z__bias-id.json (colons replaced for filesystem safety)
  const stampFs = entry.run_at.replace(/:/g, '-').replace(/\.\d+Z?$/, 'Z');
  const filename = `${stampFs}__${entry.bias_id}.json`;
  await writeFile(`${runsDir}/${filename}`, JSON.stringify(entry, null, 2) + '\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- state-updater.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/state-updater.ts src/__tests__/state-updater.test.ts
git commit -m "feat(state-updater): mark bias used + write per-run JSON logs"
```

---

## Task 5: Script loader module

**Files:**
- Create: `src/script-loader.ts`
- Create: `src/__tests__/script-loader.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/script-loader.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { loadScriptForBias, countUnusedScripts } from '../script-loader.js';

vi.mock('node:fs/promises');

const sectionsFor = (biasName: string) => [
  { kind: 'hook' as const, voice: 'v1', on_screen: 'o1', broll_query: 'q1' },
  { kind: 'phenomenon' as const, voice: 'v2', on_screen: 'o2', broll_query: 'q2' },
  { kind: 'bias_name' as const, voice: 'v3', on_screen: biasName, broll_query: 'q3' },
  { kind: 'mechanism' as const, voice: 'v4', on_screen: 'o4', broll_query: 'q4' },
  { kind: 'twist' as const, voice: 'v5', on_screen: 'o5', broll_query: 'q5' },
  { kind: 'loop_bait' as const, voice: 'v6', on_screen: 'o6', broll_query: 'q6' },
];

const SAMPLE = [
  {
    bias_id: 'a', generated_at: '2026-06-22T00:00:00Z',
    title: 'A', description: 'A', tags: ['x'], sections: sectionsFor('A'),
  },
  {
    bias_id: 'b', generated_at: '2026-06-22T00:00:00Z',
    title: 'B', description: 'B', tags: ['x'], sections: sectionsFor('B'),
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readFile).mockResolvedValue(JSON.stringify(SAMPLE) as never);
});

describe('loadScriptForBias', () => {
  it('returns the script whose bias_id matches', async () => {
    const s = await loadScriptForBias('data/scripts.json', 'b');
    expect(s.title).toBe('B');
  });

  it('throws with a clear message if no script exists for the bias', async () => {
    await expect(loadScriptForBias('data/scripts.json', 'missing'))
      .rejects.toThrow(/no script.*missing/i);
  });
});

describe('countUnusedScripts', () => {
  it('returns scripts whose bias_id is in unusedBiasIds', async () => {
    const count = await countUnusedScripts('data/scripts.json', ['b', 'c']);
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- script-loader.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement script-loader.ts**

Create `src/script-loader.ts`:

```typescript
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { StructuredScriptSchema, type StructuredScript } from './types.js';

const ScriptFileSchema = z.array(StructuredScriptSchema);

async function loadAll(path: string): Promise<StructuredScript[]> {
  const raw = await readFile(path, 'utf8');
  return ScriptFileSchema.parse(JSON.parse(raw));
}

export async function loadScriptForBias(
  scriptsPath: string,
  biasId: string,
): Promise<StructuredScript> {
  const all = await loadAll(scriptsPath);
  const match = all.find((s) => s.bias_id === biasId);
  if (!match) {
    throw new Error(`No script found for bias_id "${biasId}" in ${scriptsPath}. Run /generate-scripts to refill.`);
  }
  return match;
}

export async function countUnusedScripts(
  scriptsPath: string,
  unusedBiasIds: string[],
): Promise<number> {
  const all = await loadAll(scriptsPath);
  const set = new Set(unusedBiasIds);
  return all.filter((s) => set.has(s.bias_id)).length;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- script-loader.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/script-loader.ts src/__tests__/script-loader.test.ts
git commit -m "feat(script-loader): load pre-generated script for a bias"
```

---

## Task 6: Voice synthesis module (ElevenLabs)

**Files:**
- Create: `src/voice-synth.ts`
- Create: `src/__tests__/voice-synth.test.ts`

**Reference:** ElevenLabs API docs for the `/v1/text-to-speech/{voice_id}/with-timestamps` endpoint, which returns audio + character-level alignment.

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/voice-synth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { synthesizeScript } from '../voice-synth.js';
import type { StructuredScript } from '../types.js';

vi.mock('node:fs/promises');

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
  vi.mocked(writeFile).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('synthesizeScript', () => {
  it('calls ElevenLabs once per section, concatenates audio, returns per-section timings', async () => {
    // Each call returns base64 audio + character alignment
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
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
      outputPath: '/tmp/audio.mp3',
    });

    // Six API calls — one per section
    expect(fetchSpy).toHaveBeenCalledTimes(6);
    expect(fetchSpy.mock.calls[0][0]).toContain('voice-x');
    expect((fetchSpy.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      'xi-api-key': 'test',
    });

    // Six timings, all in canonical order
    expect(result.timings).toHaveLength(6);
    expect(result.timings.map((t) => t.kind)).toEqual([
      'hook', 'phenomenon', 'bias_name', 'mechanism', 'twist', 'loop_bait',
    ]);

    // Each subsequent section starts where the previous ended
    expect(result.timings[1].start_ms).toBe(result.timings[0].end_ms);

    // Audio was written to disk
    expect(writeFile).toHaveBeenCalledWith('/tmp/audio.mp3', expect.any(Buffer));
    expect(result.audio_path).toBe('/tmp/audio.mp3');
  });

  it('throws if the API returns a non-OK status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('quota exceeded', { status: 429 }),
    );
    await expect(
      synthesizeScript(script, { apiKey: 't', voiceId: 'v', outputPath: '/tmp/a.mp3' }),
    ).rejects.toThrow(/elevenlabs.*429/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- voice-synth.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement voice-synth.ts**

Create `src/voice-synth.ts`:

```typescript
import { writeFile } from 'node:fs/promises';
import type { StructuredScript, SectionTiming, SectionKind } from './types.js';

interface SynthOptions {
  apiKey: string;
  voiceId: string;
  outputPath: string;
}

interface SynthResult {
  audio_path: string;
  timings: SectionTiming[];
}

interface ElevenLabsResponse {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

const MODEL_ID = 'eleven_turbo_v2_5';

async function synthOneSection(
  voiceText: string,
  apiKey: string,
  voiceId: string,
): Promise<ElevenLabsResponse> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: voiceText,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as ElevenLabsResponse;
}

// Group character-level alignment into word-level timings.
function charsToWords(
  chars: string[],
  startsSec: number[],
  endsSec: number[],
  offsetMs: number,
): { word: string; start_ms: number; end_ms: number }[] {
  const out: { word: string; start_ms: number; end_ms: number }[] = [];
  let buf = '';
  let bufStart = 0;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c)) {
      if (buf) {
        out.push({
          word: buf,
          start_ms: Math.round(bufStart * 1000) + offsetMs,
          end_ms: Math.round(endsSec[i - 1] * 1000) + offsetMs,
        });
        buf = '';
      }
    } else {
      if (!buf) bufStart = startsSec[i];
      buf += c;
    }
  }
  if (buf) {
    out.push({
      word: buf,
      start_ms: Math.round(bufStart * 1000) + offsetMs,
      end_ms: Math.round(endsSec[endsSec.length - 1] * 1000) + offsetMs,
    });
  }
  return out;
}

export async function synthesizeScript(
  script: StructuredScript,
  opts: SynthOptions,
): Promise<SynthResult> {
  const audioBuffers: Buffer[] = [];
  const timings: SectionTiming[] = [];
  let cursorMs = 0;

  for (const section of script.sections) {
    const resp = await synthOneSection(section.voice, opts.apiKey, opts.voiceId);
    const audio = Buffer.from(resp.audio_base64, 'base64');
    audioBuffers.push(audio);

    const sectionDurationMs = Math.round(
      resp.alignment.character_end_times_seconds[
        resp.alignment.character_end_times_seconds.length - 1
      ] * 1000,
    );
    const words = charsToWords(
      resp.alignment.characters,
      resp.alignment.character_start_times_seconds,
      resp.alignment.character_end_times_seconds,
      cursorMs,
    );

    timings.push({
      kind: section.kind as SectionKind,
      start_ms: cursorMs,
      end_ms: cursorMs + sectionDurationMs,
      words,
    });
    cursorMs += sectionDurationMs;
  }

  const combined = Buffer.concat(audioBuffers);
  await writeFile(opts.outputPath, combined);

  return { audio_path: opts.outputPath, timings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- voice-synth.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/voice-synth.ts src/__tests__/voice-synth.test.ts
git commit -m "feat(voice-synth): per-section ElevenLabs TTS with word-level timings"
```

---

## Task 7: Asset fetcher module (Pexels)

**Files:**
- Create: `src/asset-fetcher.ts`
- Create: `src/__tests__/asset-fetcher.test.ts`

**Reference:** Pexels Video Search API — `GET https://api.pexels.com/videos/search?query=<q>&per_page=15&orientation=portrait`.

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/asset-fetcher.test.ts`:

```typescript
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
      // Re-resolve the download too (any fetch returns this in tests)
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
    // 6 search calls + 6 download calls = 12 fetches
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- asset-fetcher.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement asset-fetcher.ts**

Create `src/asset-fetcher.ts`:

```typescript
import { writeFile } from 'node:fs/promises';
import type { StructuredScript } from './types.js';

interface FetcherOptions {
  apiKey: string;
  outputDir: string;
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
  // Prefer portrait HD (width 1080, height ≥ 1920); fall back to anything HD.
  const portraitHd = video.video_files.find(
    (f) => f.quality === 'hd' && f.width <= f.height && f.width >= 1080,
  );
  if (portraitHd) return portraitHd;
  const anyHd = video.video_files.find((f) => f.quality === 'hd');
  return anyHd ?? video.video_files[0] ?? null;
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download ${res.status}: ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
}

export async function fetchBackgroundsForScript(
  script: StructuredScript,
  opts: FetcherOptions,
): Promise<string[]> {
  const paths: string[] = [];

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
    const dest = `${opts.outputDir}/section-${i}.mp4`;
    await downloadFile(chosen.link, dest);
    paths.push(dest);
  }

  return paths;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- asset-fetcher.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/asset-fetcher.ts src/__tests__/asset-fetcher.test.ts
git commit -m "feat(asset-fetcher): Pexels portrait HD video per section"
```

---

## Task 8: Remotion scaffold (Root + theme + fonts)

**Files:**
- Create: `remotion/theme.ts`
- Create: `remotion/fonts.ts`
- Create: `remotion/ShortComposition.tsx` (placeholder)
- Create: `remotion/Root.tsx`

- [ ] **Step 1: Create theme constants**

Create `remotion/theme.ts`:

```typescript
export const THEME = {
  colors: {
    background: '#0A0A0A',
    text: '#FFFFFF',
    accent: '#FFB84D',
    captionBg: 'rgba(0, 0, 0, 0.55)',
    overlayBg: 'rgba(0, 0, 0, 0.40)',
  },
  fonts: {
    display: 'Instrument Serif',
    body: 'Inter',
  },
  sizes: {
    hook: 96,
    phenomenon: 56,
    biasName: 120,
    mechanism: 48,
    twist: 80,
    loopBait: 60,
    handle: 24,
    caption: 36,
  },
  video: {
    width: 1080,
    height: 1920,
    fps: 30,
    durationSec: 60,
  },
  handle: '@Psychologytiv',
} as const;
```

- [ ] **Step 2: Create fonts loader**

Create `remotion/fonts.ts`:

```typescript
import { loadFont as loadInstrumentSerif } from '@remotion/google-fonts/InstrumentSerif';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

const instrumentSerif = loadInstrumentSerif();
const inter = loadInter('normal', { weights: ['400', '700'] });

export async function ensureFontsLoaded(): Promise<void> {
  await Promise.all([instrumentSerif.waitUntilDone(), inter.waitUntilDone()]);
}
```

- [ ] **Step 3: Create placeholder ShortComposition**

Create `remotion/ShortComposition.tsx`:

```typescript
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { THEME } from './theme.js';
import type { StructuredScript, SectionTiming } from '../src/types.js';

export interface ShortCompositionProps {
  script: StructuredScript;
  audioPath: string;
  backgroundPaths: string[];
  timings: SectionTiming[];
}

export const ShortComposition: React.FC<ShortCompositionProps> = (props) => {
  return (
    <AbsoluteFill style={{ backgroundColor: THEME.colors.background }}>
      {/* Composition built up across subsequent tasks */}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Create Root**

Create `remotion/Root.tsx`:

```typescript
import React from 'react';
import { Composition } from 'remotion';
import { ShortComposition } from './ShortComposition.js';
import { THEME } from './theme.js';
import type { StructuredScript, SectionTiming } from '../src/types.js';

// Default props used in Remotion preview (never used by the rendering pipeline)
const previewScript: StructuredScript = {
  bias_id: 'preview',
  generated_at: new Date().toISOString(),
  title: 'Preview',
  description: 'Preview',
  tags: [],
  sections: [
    { kind: 'hook', voice: 'Preview hook', on_screen: 'Preview hook', broll_query: 'q' },
    { kind: 'phenomenon', voice: 'Preview phenomenon', on_screen: 'Preview phenomenon', broll_query: 'q' },
    { kind: 'bias_name', voice: 'Preview Bias', on_screen: 'Preview Bias', broll_query: 'q' },
    { kind: 'mechanism', voice: 'Preview mechanism', on_screen: 'Preview mechanism', broll_query: 'q' },
    { kind: 'twist', voice: 'Preview twist', on_screen: 'Preview twist', broll_query: 'q' },
    { kind: 'loop_bait', voice: 'Preview loop bait', on_screen: 'Preview loop bait', broll_query: 'q' },
  ],
};

const previewTimings: SectionTiming[] = [
  { kind: 'hook',       start_ms: 0,     end_ms: 3000,  words: [] },
  { kind: 'phenomenon', start_ms: 3000,  end_ms: 15000, words: [] },
  { kind: 'bias_name',  start_ms: 15000, end_ms: 18000, words: [] },
  { kind: 'mechanism',  start_ms: 18000, end_ms: 40000, words: [] },
  { kind: 'twist',      start_ms: 40000, end_ms: 55000, words: [] },
  { kind: 'loop_bait',  start_ms: 55000, end_ms: 60000, words: [] },
];

export const Root: React.FC = () => {
  return (
    <Composition
      id="Short"
      component={ShortComposition}
      durationInFrames={THEME.video.fps * THEME.video.durationSec}
      fps={THEME.video.fps}
      width={THEME.video.width}
      height={THEME.video.height}
      defaultProps={{
        script: previewScript,
        audioPath: '',
        backgroundPaths: ['', '', '', '', '', ''],
        timings: previewTimings,
      }}
    />
  );
};
```

- [ ] **Step 5: Verify Remotion config loads**

Run: `npx remotion compositions remotion/Root.tsx`
Expected: lists one composition `Short` with 1800 frames, 1080×1920, 30fps

- [ ] **Step 6: Commit**

```bash
git add remotion/theme.ts remotion/fonts.ts remotion/ShortComposition.tsx remotion/Root.tsx
git commit -m "feat(remotion): scaffold Root + theme + fonts + placeholder composition"
```

---

## Task 9: BackgroundLayer component

**Files:**
- Create: `remotion/components/BackgroundLayer.tsx`

- [ ] **Step 1: Implement BackgroundLayer**

Create `remotion/components/BackgroundLayer.tsx`:

```typescript
import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { THEME } from '../theme.js';
import type { SectionTiming } from '../../src/types.js';

interface Props {
  backgroundPaths: string[];
  timings: SectionTiming[];
}

const CROSSFADE_MS = 200;

export const BackgroundLayer: React.FC<Props> = ({ backgroundPaths, timings }) => {
  const frame = useCurrentFrame();
  const fps = THEME.video.fps;

  return (
    <AbsoluteFill>
      {timings.map((t, i) => {
        const startFrame = Math.round((t.start_ms / 1000) * fps);
        const endFrame = Math.round((t.end_ms / 1000) * fps);
        const duration = endFrame - startFrame;
        const fadeFrames = Math.round((CROSSFADE_MS / 1000) * fps);
        const opacity = interpolate(
          frame,
          [startFrame - fadeFrames, startFrame, endFrame - fadeFrames, endFrame],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );

        return (
          <Sequence key={i} from={Math.max(0, startFrame - fadeFrames)} durationInFrames={duration + fadeFrames * 2}>
            <AbsoluteFill style={{ opacity, filter: 'saturate(0.7)' }}>
              <OffthreadVideo
                src={backgroundPaths[i]}
                playbackRate={0.5}
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {/* Black overlay for legibility */}
              <AbsoluteFill style={{ backgroundColor: THEME.colors.overlayBg }} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add remotion/components/BackgroundLayer.tsx
git commit -m "feat(remotion): BackgroundLayer with per-section Pexels video + crossfade"
```

---

## Task 10: KineticText component (per-section text treatment)

**Files:**
- Create: `remotion/components/KineticText.tsx`

- [ ] **Step 1: Implement KineticText**

Create `remotion/components/KineticText.tsx`:

```typescript
import React from 'react';
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../theme.js';
import type { SectionTiming, SectionKind } from '../../src/types.js';

interface SectionStyle {
  font: string;
  size: number;
  align: 'center';
  animation: 'word-reveal' | 'line-slide' | 'paragraph-fade' | 'big-fade' | 'question-pop';
}

const STYLE_BY_KIND: Record<SectionKind, SectionStyle> = {
  hook:        { font: THEME.fonts.display, size: THEME.sizes.hook,        align: 'center', animation: 'word-reveal' },
  phenomenon:  { font: THEME.fonts.body,    size: THEME.sizes.phenomenon,  align: 'center', animation: 'line-slide' },
  bias_name:   { font: THEME.fonts.display, size: THEME.sizes.biasName,    align: 'center', animation: 'big-fade' }, // styled in BiasNameDrop instead — KineticText skips this kind
  mechanism:   { font: THEME.fonts.body,    size: THEME.sizes.mechanism,   align: 'center', animation: 'paragraph-fade' },
  twist:       { font: THEME.fonts.display, size: THEME.sizes.twist,       align: 'center', animation: 'big-fade' },
  loop_bait:   { font: THEME.fonts.body,    size: THEME.sizes.loopBait,    align: 'center', animation: 'question-pop' },
};

interface SectionTextProps {
  text: string;
  style: SectionStyle;
  startFrame: number;
  endFrame: number;
}

const SectionText: React.FC<SectionTextProps> = ({ text, style, startFrame, endFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  const baseStyle: React.CSSProperties = {
    fontFamily: style.font,
    fontSize: style.size,
    color: THEME.colors.text,
    textAlign: style.align,
    maxWidth: '88%',
    lineHeight: 1.15,
    fontWeight: style.font === THEME.fonts.body ? 700 : 400,
  };

  if (style.animation === 'word-reveal') {
    const words = text.split(/\s+/);
    const perWord = (endFrame - startFrame) / words.length;
    return (
      <span style={baseStyle}>
        {words.map((w, i) => {
          const wordStart = i * perWord;
          const opacity = interpolate(localFrame, [wordStart, wordStart + perWord * 0.3], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          return <span key={i} style={{ opacity, marginRight: 16 }}>{w}</span>;
        })}
      </span>
    );
  }

  if (style.animation === 'big-fade' || style.animation === 'paragraph-fade') {
    const opacity = interpolate(localFrame, [0, fps * 0.35], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    return <span style={{ ...baseStyle, opacity }}>{text}</span>;
  }

  if (style.animation === 'line-slide') {
    const translate = interpolate(localFrame, [0, fps * 0.45], [40, 0], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    const opacity = interpolate(localFrame, [0, fps * 0.45], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    return <span style={{ ...baseStyle, opacity, transform: `translateY(${translate}px)` }}>{text}</span>;
  }

  // question-pop
  const scale = spring({ frame: localFrame, fps, config: { damping: 12 } });
  return <span style={{ ...baseStyle, transform: `scale(${scale})` }}>{text}</span>;
};

interface Props {
  sectionsOnScreen: string[];  // one per timing entry
  timings: SectionTiming[];
}

export const KineticText: React.FC<Props> = ({ sectionsOnScreen, timings }) => {
  const fps = THEME.video.fps;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      {timings.map((t, i) => {
        // bias_name handled separately by BiasNameDrop
        if (t.kind === 'bias_name') return null;

        const startFrame = Math.round((t.start_ms / 1000) * fps);
        const endFrame = Math.round((t.end_ms / 1000) * fps);
        return (
          <Sequence key={i} from={startFrame} durationInFrames={endFrame - startFrame}>
            <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 60 }}>
              <SectionText
                text={sectionsOnScreen[i]}
                style={STYLE_BY_KIND[t.kind]}
                startFrame={startFrame}
                endFrame={endFrame}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add remotion/components/KineticText.tsx
git commit -m "feat(remotion): KineticText with per-section animation grammar"
```

---

## Task 11: BiasNameDrop component (the signature beat)

**Files:**
- Create: `remotion/components/BiasNameDrop.tsx`

- [ ] **Step 1: Implement BiasNameDrop**

Create `remotion/components/BiasNameDrop.tsx`:

```typescript
import React from 'react';
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../theme.js';
import type { SectionTiming } from '../../src/types.js';

interface Props {
  biasName: string;
  timings: SectionTiming[];
}

const Inner: React.FC<{ biasName: string; startFrame: number }> = ({ biasName, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  const scale = spring({
    frame: local,
    fps,
    config: { damping: 10, mass: 0.6, stiffness: 120 },
  });
  // Slight float upward as it settles
  const translateY = (1 - scale) * 30;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <span style={{
        fontFamily: THEME.fonts.display,
        fontSize: THEME.sizes.biasName,
        color: THEME.colors.accent,
        textAlign: 'center',
        maxWidth: '90%',
        lineHeight: 1.05,
        transform: `scale(${scale}) translateY(${translateY}px)`,
      }}>
        {biasName}
      </span>
    </AbsoluteFill>
  );
};

export const BiasNameDrop: React.FC<Props> = ({ biasName, timings }) => {
  const fps = THEME.video.fps;
  const biasTiming = timings.find((t) => t.kind === 'bias_name');
  if (!biasTiming) return null;
  const startFrame = Math.round((biasTiming.start_ms / 1000) * fps);
  const durationFrames = Math.round((biasTiming.end_ms - biasTiming.start_ms) / 1000 * fps);

  return (
    <Sequence from={startFrame} durationInFrames={durationFrames}>
      <Inner biasName={biasName} startFrame={startFrame} />
    </Sequence>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add remotion/components/BiasNameDrop.tsx
git commit -m "feat(remotion): BiasNameDrop — 120pt accent-color signature beat"
```

---

## Task 12: ProgressBar, HandleBadge, Captions components

**Files:**
- Create: `remotion/components/ProgressBar.tsx`
- Create: `remotion/components/HandleBadge.tsx`
- Create: `remotion/components/Captions.tsx`

- [ ] **Step 1: ProgressBar**

Create `remotion/components/ProgressBar.tsx`:

```typescript
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../theme.js';

export const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const width = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        top: 24,
        left: 0,
        width: `${width}%`,
        height: 3,
        backgroundColor: THEME.colors.accent,
      }} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: HandleBadge**

Create `remotion/components/HandleBadge.tsx`:

```typescript
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { THEME } from '../theme.js';

export const HandleBadge: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <span style={{
      position: 'absolute',
      top: 48,
      left: 36,
      fontFamily: THEME.fonts.body,
      fontSize: THEME.sizes.handle,
      color: THEME.colors.text,
      opacity: 0.7,
      fontWeight: 400,
    }}>
      {THEME.handle}
    </span>
  </AbsoluteFill>
);
```

- [ ] **Step 3: Captions**

Create `remotion/components/Captions.tsx`:

```typescript
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../theme.js';
import type { SectionTiming } from '../../src/types.js';

interface Props {
  timings: SectionTiming[];
}

export const Captions: React.FC<Props> = ({ timings }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  // Find the currently-spoken word across all sections.
  let activeWord: string | null = null;
  outer: for (const t of timings) {
    if (currentMs < t.start_ms || currentMs > t.end_ms) continue;
    for (const w of t.words) {
      if (currentMs >= w.start_ms && currentMs <= w.end_ms) {
        activeWord = w.word;
        break outer;
      }
    }
  }

  if (!activeWord) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        bottom: 220,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: THEME.fonts.body,
          fontSize: THEME.sizes.caption,
          fontWeight: 700,
          color: THEME.colors.text,
          backgroundColor: THEME.colors.captionBg,
          padding: '8px 20px',
          borderRadius: 6,
        }}>
          {activeWord}
        </span>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Commit**

```bash
git add remotion/components/ProgressBar.tsx remotion/components/HandleBadge.tsx remotion/components/Captions.tsx
git commit -m "feat(remotion): ProgressBar, HandleBadge, Captions overlays"
```

---

## Task 13: Wire ShortComposition with all layers + audio

**Files:**
- Modify: `remotion/ShortComposition.tsx`

- [ ] **Step 1: Replace placeholder with the real composition**

Replace `remotion/ShortComposition.tsx` with:

```typescript
import React from 'react';
import { AbsoluteFill, Audio } from 'remotion';
import { THEME } from './theme.js';
import { BackgroundLayer } from './components/BackgroundLayer.js';
import { KineticText } from './components/KineticText.js';
import { BiasNameDrop } from './components/BiasNameDrop.js';
import { ProgressBar } from './components/ProgressBar.js';
import { HandleBadge } from './components/HandleBadge.js';
import { Captions } from './components/Captions.js';
import type { StructuredScript, SectionTiming } from '../src/types.js';

export interface ShortCompositionProps {
  script: StructuredScript;
  audioPath: string;
  backgroundPaths: string[];
  timings: SectionTiming[];
}

export const ShortComposition: React.FC<ShortCompositionProps> = ({
  script, audioPath, backgroundPaths, timings,
}) => {
  const biasNameSection = script.sections.find((s) => s.kind === 'bias_name');
  const biasName = biasNameSection?.on_screen ?? script.title;
  const sectionsOnScreen = script.sections.map((s) => s.on_screen);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.colors.background }}>
      <BackgroundLayer backgroundPaths={backgroundPaths} timings={timings} />
      <KineticText sectionsOnScreen={sectionsOnScreen} timings={timings} />
      <BiasNameDrop biasName={biasName} timings={timings} />
      <Captions timings={timings} />
      <HandleBadge />
      <ProgressBar />
      {audioPath ? <Audio src={audioPath} /> : null}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify Remotion can still list the composition**

Run: `npx remotion compositions remotion/Root.tsx`
Expected: lists `Short` composition without errors

- [ ] **Step 3: Commit**

```bash
git add remotion/ShortComposition.tsx
git commit -m "feat(remotion): wire ShortComposition with all layers + audio"
```

---

## Task 14: Renderer module (invokes Remotion programmatically)

**Files:**
- Create: `src/renderer.ts`
- Create: `src/__tests__/renderer.test.ts`

**Why integration test:** rendering invokes a real headless Chromium. The test renders a tiny 30-frame composition with mock data and asserts the output file exists. This catches "Remotion config broken" without spending 10 minutes.

- [ ] **Step 1: Write failing integration test**

Create `src/__tests__/renderer.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { stat, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderShort } from '../renderer.js';
import type { StructuredScript, SectionTiming } from '../types.js';

const script: StructuredScript = {
  bias_id: 'integration',
  generated_at: '2026-06-22T00:00:00Z',
  title: 'Integration Test',
  description: 'd', tags: [],
  sections: [
    { kind: 'hook',       voice: 'a', on_screen: 'Hook', broll_query: 'q' },
    { kind: 'phenomenon', voice: 'b', on_screen: 'Phenomenon', broll_query: 'q' },
    { kind: 'bias_name',  voice: 'c', on_screen: 'Test Bias', broll_query: 'q' },
    { kind: 'mechanism',  voice: 'd', on_screen: 'Mechanism', broll_query: 'q' },
    { kind: 'twist',      voice: 'e', on_screen: 'Twist', broll_query: 'q' },
    { kind: 'loop_bait',  voice: 'f', on_screen: 'Loop?', broll_query: 'q' },
  ],
};

// Tiny composition: 1 second total for fast test
const timings: SectionTiming[] = [
  { kind: 'hook',       start_ms: 0,   end_ms: 167, words: [] },
  { kind: 'phenomenon', start_ms: 167, end_ms: 333, words: [] },
  { kind: 'bias_name',  start_ms: 333, end_ms: 500, words: [] },
  { kind: 'mechanism',  start_ms: 500, end_ms: 667, words: [] },
  { kind: 'twist',      start_ms: 667, end_ms: 833, words: [] },
  { kind: 'loop_bait',  start_ms: 833, end_ms: 1000, words: [] },
];

let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'render-test-'));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('renderShort', () => {
  it('produces an MP4 at the requested path', async () => {
    const out = join(workDir, 'out.mp4');
    await renderShort({
      script,
      audioPath: '',          // no audio for this test
      backgroundPaths: ['', '', '', '', '', ''], // empty backgrounds (BackgroundLayer renders black)
      timings,
      outputPath: out,
      durationFramesOverride: 30, // 1 second @ 30fps
    });
    const s = await stat(out);
    expect(s.size).toBeGreaterThan(1000); // at least 1KB
  }, 120000); // 2 min timeout
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- renderer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement renderer.ts**

Create `src/renderer.ts`:

```typescript
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { resolve } from 'node:path';
import type { StructuredScript, SectionTiming } from './types.js';

interface RenderOptions {
  script: StructuredScript;
  audioPath: string;
  backgroundPaths: string[];
  timings: SectionTiming[];
  outputPath: string;
  /** Optional override (mainly used by tests to render a tiny clip) */
  durationFramesOverride?: number;
}

export async function renderShort(opts: RenderOptions): Promise<void> {
  const entry = resolve(process.cwd(), 'remotion/Root.tsx');

  const bundled = await bundle({ entryPoint: entry });

  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'Short',
    inputProps: {
      script: opts.script,
      audioPath: opts.audioPath,
      backgroundPaths: opts.backgroundPaths,
      timings: opts.timings,
    },
  });

  await renderMedia({
    composition: opts.durationFramesOverride
      ? { ...composition, durationInFrames: opts.durationFramesOverride }
      : composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: opts.outputPath,
    inputProps: {
      script: opts.script,
      audioPath: opts.audioPath,
      backgroundPaths: opts.backgroundPaths,
      timings: opts.timings,
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- renderer.test.ts`
Expected: PASS (1 test, may take ~30-60s)

If Chromium download is needed, Remotion will fetch it automatically on first run.

- [ ] **Step 5: Commit**

```bash
git add src/renderer.ts src/__tests__/renderer.test.ts
git commit -m "feat(renderer): wrap @remotion/renderer for headless MP4 output"
```

---

## Task 15: OAuth bootstrap (one-time local script)

**Files:**
- Create: `src/oauth-bootstrap.ts`

This script is run locally exactly once by the owner to mint a refresh token. It's not part of the pipeline and is not tested automatically.

- [ ] **Step 1: Implement oauth-bootstrap.ts**

Create `src/oauth-bootstrap.ts`:

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add src/oauth-bootstrap.ts
git commit -m "feat(oauth-bootstrap): one-time local script to mint YouTube refresh token"
```

---

## Task 16: Uploader module (YouTube Data API)

**Files:**
- Create: `src/uploader.ts`
- Create: `src/__tests__/uploader.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/uploader.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReadStream } from 'node:fs';
import { uploadShort } from '../uploader.js';

vi.mock('node:fs', () => ({
  createReadStream: vi.fn(() => 'STREAM' as never),
}));

// Mock googleapis surface — only the bits we use
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- uploader.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement uploader.ts**

Create `src/uploader.ts`:

```typescript
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
        categoryId: '27', // Education
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- uploader.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/uploader.ts src/__tests__/uploader.test.ts
git commit -m "feat(uploader): YouTube Data API v3 Shorts upload with #Shorts marker"
```

---

## Task 17: Pipeline orchestrator

**Files:**
- Create: `src/pipeline.ts`
- Create: `src/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/pipeline.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPipeline } from '../pipeline.js';
import type { BiasRecord, StructuredScript, SectionTiming } from '../types.js';

vi.mock('../bias-selector.js');
vi.mock('../script-loader.js');
vi.mock('../voice-synth.js');
vi.mock('../asset-fetcher.js');
vi.mock('../renderer.js');
vi.mock('../uploader.js');
vi.mock('../state-updater.js');

import { selectNextBias, selectBiasById } from '../bias-selector.js';
import { loadScriptForBias } from '../script-loader.js';
import { synthesizeScript } from '../voice-synth.js';
import { fetchBackgroundsForScript } from '../asset-fetcher.js';
import { renderShort } from '../renderer.js';
import { uploadShort } from '../uploader.js';
import { markBiasUsed, writeRunLog } from '../state-updater.js';

const bias: BiasRecord = {
  id: 'b1', name: 'Bias One', one_line_hook: 'h', source_link: 'https://x/b1', used_at: null,
};
const script: StructuredScript = {
  bias_id: 'b1', generated_at: '2026-06-22T00:00:00Z',
  title: 'T', description: 'D', tags: ['t'],
  sections: [
    { kind: 'hook', voice: 'v', on_screen: 'o', broll_query: 'q' },
    { kind: 'phenomenon', voice: 'v', on_screen: 'o', broll_query: 'q' },
    { kind: 'bias_name', voice: 'v', on_screen: 'Bias One', broll_query: 'q' },
    { kind: 'mechanism', voice: 'v', on_screen: 'o', broll_query: 'q' },
    { kind: 'twist', voice: 'v', on_screen: 'o', broll_query: 'q' },
    { kind: 'loop_bait', voice: 'v', on_screen: 'o', broll_query: 'q' },
  ],
};
const timings: SectionTiming[] = [
  { kind: 'hook', start_ms: 0, end_ms: 3000, words: [] },
  { kind: 'phenomenon', start_ms: 3000, end_ms: 15000, words: [] },
  { kind: 'bias_name', start_ms: 15000, end_ms: 18000, words: [] },
  { kind: 'mechanism', start_ms: 18000, end_ms: 40000, words: [] },
  { kind: 'twist', start_ms: 40000, end_ms: 55000, words: [] },
  { kind: 'loop_bait', start_ms: 55000, end_ms: 60000, words: [] },
];

const env = {
  ELEVENLABS_API_KEY: 'el-key',
  ELEVENLABS_VOICE_ID: 'el-voice',
  PEXELS_API_KEY: 'px-key',
  YOUTUBE_CLIENT_ID: 'y-id',
  YOUTUBE_CLIENT_SECRET: 'y-secret',
  YOUTUBE_REFRESH_TOKEN: 'y-rt',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(selectNextBias).mockResolvedValue(bias);
  vi.mocked(selectBiasById).mockResolvedValue(bias);
  vi.mocked(loadScriptForBias).mockResolvedValue(script);
  vi.mocked(synthesizeScript).mockResolvedValue({ audio_path: '/tmp/a.mp3', timings });
  vi.mocked(fetchBackgroundsForScript).mockResolvedValue(
    Array.from({ length: 6 }, (_, i) => `/tmp/bg-${i}.mp4`),
  );
  vi.mocked(renderShort).mockResolvedValue(undefined);
  vi.mocked(uploadShort).mockResolvedValue('yt-vid-id');
  vi.mocked(markBiasUsed).mockResolvedValue(undefined);
  vi.mocked(writeRunLog).mockResolvedValue(undefined);
});

describe('runPipeline', () => {
  it('happy path: selects bias, renders, uploads, marks used, writes log', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'pl-'));
    const exitCode = await runPipeline({
      env, dryRun: false, biasIdOverride: null,
      biasesPath: 'data/biases.json',
      scriptsPath: 'data/scripts.json',
      runsDir: 'data/runs',
      workDir,
    });
    expect(exitCode).toBe(0);
    expect(uploadShort).toHaveBeenCalledTimes(1);
    expect(markBiasUsed).toHaveBeenCalledWith('data/biases.json', 'b1', expect.any(String));
    expect(writeRunLog).toHaveBeenCalledTimes(1);
  });

  it('dry run: renders but does NOT upload or mark used', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'pl-'));
    const exitCode = await runPipeline({
      env, dryRun: true, biasIdOverride: null,
      biasesPath: 'data/biases.json',
      scriptsPath: 'data/scripts.json',
      runsDir: 'data/runs',
      workDir,
    });
    expect(exitCode).toBe(0);
    expect(renderShort).toHaveBeenCalledTimes(1);
    expect(uploadShort).not.toHaveBeenCalled();
    expect(markBiasUsed).not.toHaveBeenCalled();
  });

  it('failure in render aborts before upload and does NOT mark bias used', async () => {
    vi.mocked(renderShort).mockRejectedValue(new Error('render boom'));
    const workDir = await mkdtemp(join(tmpdir(), 'pl-'));
    const exitCode = await runPipeline({
      env, dryRun: false, biasIdOverride: null,
      biasesPath: 'data/biases.json',
      scriptsPath: 'data/scripts.json',
      runsDir: 'data/runs',
      workDir,
    });
    expect(exitCode).toBe(1);
    expect(uploadShort).not.toHaveBeenCalled();
    expect(markBiasUsed).not.toHaveBeenCalled();
  });

  it('biasIdOverride uses selectBiasById', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'pl-'));
    await runPipeline({
      env, dryRun: false, biasIdOverride: 'b1',
      biasesPath: 'data/biases.json',
      scriptsPath: 'data/scripts.json',
      runsDir: 'data/runs',
      workDir,
    });
    expect(selectBiasById).toHaveBeenCalledWith('data/biases.json', 'b1');
    expect(selectNextBias).not.toHaveBeenCalled();
  });

  it('throws if a required env var is missing', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'pl-'));
    const exitCode = await runPipeline({
      env: { ...env, ELEVENLABS_API_KEY: undefined as unknown as string },
      dryRun: false, biasIdOverride: null,
      biasesPath: 'data/biases.json',
      scriptsPath: 'data/scripts.json',
      runsDir: 'data/runs',
      workDir,
    });
    expect(exitCode).toBe(1);
    expect(synthesizeScript).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pipeline.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement pipeline.ts**

Create `src/pipeline.ts`:

```typescript
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { selectNextBias, selectBiasById } from './bias-selector.js';
import { loadScriptForBias } from './script-loader.js';
import { synthesizeScript } from './voice-synth.js';
import { fetchBackgroundsForScript } from './asset-fetcher.js';
import { renderShort } from './renderer.js';
import { uploadShort } from './uploader.js';
import { markBiasUsed, writeRunLog } from './state-updater.js';

export interface PipelineEnv {
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_VOICE_ID: string;
  PEXELS_API_KEY: string;
  YOUTUBE_CLIENT_ID: string;
  YOUTUBE_CLIENT_SECRET: string;
  YOUTUBE_REFRESH_TOKEN: string;
}

export interface PipelineOptions {
  env: PipelineEnv;
  dryRun: boolean;
  biasIdOverride: string | null;
  biasesPath: string;
  scriptsPath: string;
  runsDir: string;
  workDir: string;
}

const REQUIRED_ENV: (keyof PipelineEnv)[] = [
  'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'PEXELS_API_KEY',
  'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN',
];

function validateEnv(env: PipelineEnv): string | null {
  for (const key of REQUIRED_ENV) {
    if (!env[key]) return `Missing required env var: ${key}`;
  }
  return null;
}

export async function runPipeline(opts: PipelineOptions): Promise<number> {
  try {
    const envError = validateEnv(opts.env);
    if (envError) {
      console.error(`[pipeline] ${envError}`);
      return 1;
    }

    await mkdir(opts.workDir, { recursive: true });
    await mkdir(opts.runsDir, { recursive: true });

    console.log('[pipeline] selecting bias');
    const bias = opts.biasIdOverride
      ? await selectBiasById(opts.biasesPath, opts.biasIdOverride)
      : await selectNextBias(opts.biasesPath);
    console.log(`[pipeline] bias: ${bias.id} (${bias.name})`);

    console.log('[pipeline] loading script');
    const script = await loadScriptForBias(opts.scriptsPath, bias.id);

    console.log('[pipeline] synthesizing voice');
    const audioPath = join(opts.workDir, 'audio.mp3');
    const { timings } = await synthesizeScript(script, {
      apiKey: opts.env.ELEVENLABS_API_KEY,
      voiceId: opts.env.ELEVENLABS_VOICE_ID,
      outputPath: audioPath,
    });

    console.log('[pipeline] fetching backgrounds');
    const bgDir = join(opts.workDir, 'bg');
    await mkdir(bgDir, { recursive: true });
    const backgroundPaths = await fetchBackgroundsForScript(script, {
      apiKey: opts.env.PEXELS_API_KEY,
      outputDir: bgDir,
    });

    console.log('[pipeline] rendering video');
    const videoPath = join(opts.workDir, 'output.mp4');
    await renderShort({
      script, audioPath, backgroundPaths, timings, outputPath: videoPath,
    });

    if (opts.dryRun) {
      console.log(`[pipeline] dry run complete; video at ${videoPath}`);
      return 0;
    }

    console.log('[pipeline] uploading to YouTube');
    const videoId = await uploadShort({
      videoPath,
      title: script.title,
      description: script.description,
      tags: script.tags,
      auth: {
        clientId: opts.env.YOUTUBE_CLIENT_ID,
        clientSecret: opts.env.YOUTUBE_CLIENT_SECRET,
        refreshToken: opts.env.YOUTUBE_REFRESH_TOKEN,
      },
    });
    console.log(`[pipeline] uploaded: https://youtube.com/shorts/${videoId}`);

    const runAt = new Date().toISOString();
    await markBiasUsed(opts.biasesPath, bias.id, runAt);
    await writeRunLog(opts.runsDir, {
      bias_id: bias.id,
      run_at: runAt,
      youtube_video_id: videoId,
      title: script.title,
      duration_sec: 60,
    });

    console.log('[pipeline] done');
    return 0;
  } catch (err) {
    console.error('[pipeline] FAILED:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    return 1;
  }
}

// CLI entry
async function cli() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const biasIdIdx = argv.indexOf('--bias-id');
  const biasIdOverride = biasIdIdx !== -1 ? argv[biasIdIdx + 1] : null;

  const code = await runPipeline({
    env: process.env as unknown as PipelineEnv,
    dryRun,
    biasIdOverride: biasIdOverride ?? null,
    biasesPath: 'data/biases.json',
    scriptsPath: 'data/scripts.json',
    runsDir: 'data/runs',
    workDir: 'out/run',
  });
  process.exit(code);
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  cli();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- pipeline.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all tests across all suites pass

- [ ] **Step 6: Commit**

```bash
git add src/pipeline.ts src/__tests__/pipeline.test.ts
git commit -m "feat(pipeline): orchestrator with dry-run, bias-override, and fail-closed semantics"
```

---

## Task 18: Slash command — /seed-biases

**Files:**
- Create: `.claude/commands/seed-biases.md`

This creates a Claude Code slash command. When the owner types `/seed-biases` in Claude Code, Claude reads this instruction file and acts on it.

- [ ] **Step 1: Create the slash command**

Create `.claude/commands/seed-biases.md`:

````markdown
---
description: One-time bootstrap — populate data/biases.json with ~250 cognitive biases
---

You are populating `data/biases.json` for the Psychology Traits Shorts pipeline. This is a one-time bootstrap operation.

## What to do

1. Read `src/types.ts` to confirm the current `BiasRecord` schema.
2. If `data/biases.json` already exists and contains entries, STOP and tell the user — do not overwrite.
3. Generate a JSON array of approximately 250 cognitive bias entries covering:
   - The major documented cognitive biases (confirmation bias, availability heuristic, anchoring, etc.)
   - Decision-making biases (sunk cost, loss aversion, hyperbolic discounting, etc.)
   - Memory biases (rosy retrospection, hindsight bias, peak-end rule, etc.)
   - Social/interpersonal biases (halo effect, fundamental attribution error, ingroup bias, etc.)
   - Self-perception biases (Dunning-Kruger, illusion of control, optimism bias, etc.)
   - Perceptual quirks (apophenia, pareidolia, gambler's fallacy, etc.)
4. For each entry, fill in:
   - `id`: kebab-case (e.g., `confirmation-bias`)
   - `name`: Proper-case display name
   - `one_line_hook`: ONE concrete observable behavior in plain language, NOT a definition (e.g., "Why you only remember when your gut feeling was right", NOT "The tendency to favor confirming information")
   - `source_link`: Wikipedia URL when possible
   - `used_at`: always `null` for bootstrap
5. Write the array to `data/biases.json` with 2-space indentation.
6. Validate by running `npm test -- bias-selector` — if any tests fail because of the data shape, fix the file.
7. Report the count to the user.

## Constraints

- The `one_line_hook` must be a behavior the average viewer would recognize. It is what becomes the YouTube Short title pattern: "Why you [hook] — the [Name] explained". Test each one against that pattern.
- No biases that are vague or pseudo-scientific (e.g., no astrology, no MBTI personality types).
- No biases that require domain expertise to understand (e.g., skip technical statistical biases like "Berkson's paradox" unless you can write a relatable hook).
- IDs must be unique. Names must be unique.
````

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/seed-biases.md
git commit -m "feat(commands): /seed-biases slash command for one-time bootstrap"
```

---

## Task 19: Slash command — /generate-scripts

**Files:**
- Create: `.claude/commands/generate-scripts.md`

- [ ] **Step 1: Create the slash command**

Create `.claude/commands/generate-scripts.md`:

````markdown
---
description: Generate N pre-written scripts for unused biases (default 20). Refills data/scripts.json.
argument-hint: [count]
---

You are generating new scripts for the Psychology Traits Shorts pipeline. The owner runs this periodically to refill the script bank.

## What to do

1. Read `src/types.ts` to confirm the current `StructuredScript` schema (Zod definition is the source of truth).
2. Read `data/biases.json` and `data/scripts.json`.
3. Determine which bias IDs are in `biases.json` with `used_at === null` AND do NOT yet have a script in `scripts.json`. These are the candidates.
4. Take the first N candidates (N defaults to 20 if no argument given; honor the user's argument if provided).
5. For each candidate, write a script following the locked 5-section template (rendered as 6 JSON sections — `bias_name` is broken out from `mechanism`):

| Section | Approx duration | Word count target | Style |
|---|---|---|---|
| `hook` | 3s | ~10-12 words | Concrete observable behavior the viewer will recognize ("You ever notice how...") |
| `phenomenon` | 12s | ~30-35 words | Describe what's happening without naming the bias yet |
| `bias_name` | 3s | the name itself only (1-4 words) | The "drop" — `on_screen` is JUST the bias name |
| `mechanism` | 22s | ~55-65 words | Name + explain why this happens |
| `twist` | 15s | ~35-45 words | The surprising implication |
| `loop_bait` | 5s | ~12-15 words | A question or claim that triggers rewatch |

6. For each section, fill in:
   - `voice`: the spoken text (this is what gets read by ElevenLabs and what counts toward the free 10,000 char/mo quota)
   - `on_screen`: the text rendered as kinetic typography. Often shorter than `voice` — only the most quotable phrases. For `bias_name`, this is JUST the bias name.
   - `broll_query`: a 2-4 word Pexels search query that returns abstract motion footage. Examples: "ink water slow motion", "smoke abstract dark", "particles floating", "neural network 3d", "liquid metal flowing". AVOID literal queries about people, places, or objects.

7. Title format: `"Why you [observable behavior] — the [Bias Name] explained"` (max 100 chars; truncate the hook if needed)

8. Description: 2-3 sentence summary. The pipeline will automatically append `#Shorts` if absent.

9. Tags: 5-8 tags including `psychology`, `cognitive bias`, the lowercase bias name, and 2-3 thematic keywords.

10. Validate each script against the Zod schema by running `npm test -- script-loader.test.ts` after writing — if validation fails, fix the data shape.

11. Append the new scripts to the existing `scripts.json` array (don't overwrite existing scripts). Preserve order. Write back with 2-space indentation.

12. Report to the user: how many scripts you generated, the total in `scripts.json` now, and how many unused biases remain without scripts.

## Quality bar

- Hooks must reference behavior, not abstractions. "Why you remember bad reviews more than good ones" YES. "The tendency to weigh negative information more heavily" NO.
- No throat-clearing intros ("In this video we'll explore..."). Cold open.
- The `on_screen` text must be readable in 1-2 seconds. If it's longer than ~12 words for any non-mechanism section, shorten it.
- Voice text should sound conversational, not like a textbook. Read it aloud in your head.
- Loop bait should be a real curiosity gap, not generic engagement bait ("Most people don't notice this until the 3rd watch...").
````

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/generate-scripts.md
git commit -m "feat(commands): /generate-scripts slash command for script refill"
```

---

## Task 20: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/publish.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/publish.yml`:

```yaml
name: publish-short

on:
  schedule:
    - cron: '0 22 * * 1,4'    # Mon + Thu, 22:00 UTC
  workflow_dispatch:
    inputs:
      dry_run:
        type: boolean
        description: 'Dry run: render but do not upload'
        default: false
      bias_id:
        type: string
        description: 'Override: specific bias ID to render (skips selector)'
        required: false

permissions:
  contents: write
  issues: write

jobs:
  publish:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install system deps for Remotion
        run: |
          sudo apt-get update
          sudo apt-get install -y ffmpeg libnss3 libatk1.0-0 libatk-bridge2.0-0 \
            libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
            libxrandr2 libgbm1 libasound2t64 libpango-1.0-0 libcairo2

      - name: Install npm deps
        run: npm ci

      - name: Run pipeline
        env:
          ELEVENLABS_API_KEY: ${{ secrets.ELEVENLABS_API_KEY }}
          ELEVENLABS_VOICE_ID: ${{ secrets.ELEVENLABS_VOICE_ID }}
          PEXELS_API_KEY: ${{ secrets.PEXELS_API_KEY }}
          YOUTUBE_CLIENT_ID: ${{ secrets.YOUTUBE_CLIENT_ID }}
          YOUTUBE_CLIENT_SECRET: ${{ secrets.YOUTUBE_CLIENT_SECRET }}
          YOUTUBE_REFRESH_TOKEN: ${{ secrets.YOUTUBE_REFRESH_TOKEN }}
        run: |
          FLAGS=""
          if [ "${{ inputs.dry_run }}" = "true" ]; then FLAGS="$FLAGS --dry-run"; fi
          if [ -n "${{ inputs.bias_id }}" ]; then FLAGS="$FLAGS --bias-id ${{ inputs.bias_id }}"; fi
          npx tsx src/pipeline.ts $FLAGS

      - name: Upload dry-run artifact
        if: inputs.dry_run == true
        uses: actions/upload-artifact@v4
        with:
          name: short-mp4-${{ github.run_id }}
          path: out/run/output.mp4

      - name: Commit updated state files
        if: success() && inputs.dry_run != true
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add data/biases.json data/runs/
          if git diff --cached --quiet; then
            echo "No state changes to commit."
          else
            git commit -m "chore: publish run state $(date -u +%Y-%m-%dT%H:%MZ)"
            git push
          fi

      - name: Open issue on failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `Pipeline failure on ${context.payload.repository.updated_at}`,
              labels: ['pipeline-failure'],
              body: `Run: https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}\n\nCheck logs in the run page.`,
            });
```

- [ ] **Step 2: Validate the workflow file syntax with actionlint (optional)**

If `actionlint` is installed locally:
```bash
actionlint .github/workflows/publish.yml
```
Expected: no errors. Skip if not installed.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "feat(ci): GitHub Actions workflow with cron, dry-run, and auto-issue on failure"
```

---

## Task 21: README + setup docs

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Create `README.md`:

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with one-time setup, ongoing ops, and honest expectations"
```

---

## Task 22: End-to-end smoke (manual, after one-time setup)

This task is **performed by the owner**, not an agent. It validates the system against real APIs after the one-time setup checklist is complete. No code changes — purely manual verification.

- [ ] **Step 1: Run Remotion preview and visually inspect**

```bash
npm run remotion:preview
```
Open http://localhost:3000 → click `Short`. The preview uses the default props (a placeholder script). Confirm:
- Background plays (or is solid black if no path provided)
- Hook text reveals word-by-word
- Bias name "drops" at 120pt in amber at ~15s
- Progress bar fills smoothly
- Handle `@Psychologytiv` appears top-left

If any of these look broken, iterate on the relevant component file before proceeding.

- [ ] **Step 2: First dry-run on GitHub Actions**

GitHub Actions → publish-short → Run workflow → check `dry_run`. Wait ~15 min. Download the MP4 artifact. Watch it.

Pass criteria:
- 60 ± 2 seconds long
- Voice audible and synced to captions
- All 6 sections visually distinct
- No black frames longer than 200ms
- Final frame is the loop-bait question

- [ ] **Step 3: First real publish**

Re-run the workflow with `dry_run` unchecked. Within ~20 min, a new video should appear on the channel. Verify:
- Published as Public
- Marked as a Short (vertical, < 60s)
- `data/biases.json` got committed with the bias now marked `used_at`
- `data/runs/<timestamp>__<bias-id>.json` exists

- [ ] **Step 4: Confirm cron**

Wait for the next scheduled cron tick (next Mon or Thu 22:00 UTC). Confirm a video publishes automatically without you touching anything.

---

## Self-review notes

Reviewed plan against the spec's 10 sections:

| Spec section | Covered by tasks |
|---|---|
| §1 Project goal | Task 21 (README captures it) |
| §2 Niche & content strategy: 5-section template | Task 2 (Zod enforces 6 sections), Task 19 (slash command bakes in the template) |
| §2 Cadence (2x/week) | Task 20 (cron `0 22 * * 1,4`) |
| §2 biases.json structure | Task 2, Task 18 (seed command) |
| §2 scripts.json structure | Task 2, Task 19 (generate command) |
| §2 Non-goals | Implicit (not built) |
| §3 Channel identity (Psychology Traits, @Psychologytiv) | Task 8 (THEME.handle), Task 16 (madeForKids=false), Task 21 |
| §4 Pipeline architecture (8 modules) | Tasks 3-7, 14-17 |
| §4 Fail-closed semantics | Task 17 (pipeline test explicitly checks abort-before-upload) |
| §4 Secrets list | Task 17 (validateEnv), Task 20 (workflow env), Task 21 (setup) |
| §5 Remotion template (3 layers, fonts, animation grammar) | Tasks 8-13 |
| §5 Beat-synced rhythm | Task 9 (BackgroundLayer uses timings), Task 10 (KineticText uses timings), Task 11 (BiasNameDrop uses timings) |
| §6 GitHub Actions workflow | Task 20 |
| §6 Setup checklist (9 steps) | Task 21 (README mirrors steps) |
| §6 Monitoring (auto-issue) | Task 20 (failure step opens issue) |
| §6 Manual controls (pause, skip, re-run, dry-run) | Task 20 (workflow_dispatch inputs), Task 21 (docs) |
| §7 YAGNI list | Honored (no DB, no observability stack, no A/B infra, etc.) |
| §8 Honest expectations | Task 21 (README mirrors) |
| §10 Locked decisions table | All values appear in code (cron, theme, voice ID, handle, fonts, accent) |

Type/method consistency check:
- `selectNextBias` / `selectBiasById` used identically across Tasks 3, 17 ✓
- `synthesizeScript` signature consistent across Tasks 6, 17 ✓
- `fetchBackgroundsForScript` signature consistent across Tasks 7, 17 ✓
- `renderShort` signature consistent across Tasks 14, 17 ✓
- `uploadShort` signature consistent across Tasks 16, 17 ✓
- `markBiasUsed` / `writeRunLog` signatures consistent across Tasks 4, 17 ✓
- `SectionTiming` shape consistent across Tasks 2, 6, 9, 10, 11, 12 ✓
- Six-section order (`hook, phenomenon, bias_name, mechanism, twist, loop_bait`) consistent across Tasks 2, 6, 10, 19 ✓

No placeholders, TBDs, or "add error handling here" detected.
