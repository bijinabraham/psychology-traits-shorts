import React from 'react';
import { AbsoluteFill } from 'remotion';
import { THEME } from './theme';
import type { StructuredScript, SectionTiming } from '../src/types';

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
