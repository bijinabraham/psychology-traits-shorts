import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { z } from 'zod';
import { ShortComposition } from './ShortComposition';
import { THEME } from './theme';
import { StructuredScriptSchema, SectionKindSchema } from '../src/types';
import type { StructuredScript, SectionTiming } from '../src/types';

const SectionTimingSchema = z.object({
  kind: SectionKindSchema,
  start_ms: z.number(),
  end_ms: z.number(),
  words: z.array(z.object({
    word: z.string(),
    start_ms: z.number(),
    end_ms: z.number(),
  })),
});

const ShortCompositionPropsSchema = z.object({
  script: StructuredScriptSchema,
  audioPath: z.string(),
  backgroundPaths: z.array(z.string()),
  timings: z.array(SectionTimingSchema),
});

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
      schema={ShortCompositionPropsSchema}
      defaultProps={{
        script: previewScript,
        audioPath: '',
        backgroundPaths: ['', '', '', '', '', ''],
        timings: previewTimings,
      }}
    />
  );
};

registerRoot(Root);
