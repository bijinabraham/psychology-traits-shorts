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
