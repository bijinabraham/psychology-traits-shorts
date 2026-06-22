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
