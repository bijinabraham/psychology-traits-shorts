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
