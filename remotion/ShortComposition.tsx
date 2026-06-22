import React from 'react';
import { AbsoluteFill, Audio } from 'remotion';
import { THEME } from './theme';
import { BackgroundLayer } from './components/BackgroundLayer';
import { KineticText } from './components/KineticText';
import { BiasNameDrop } from './components/BiasNameDrop';
import { ProgressBar } from './components/ProgressBar';
import { HandleBadge } from './components/HandleBadge';
import { Captions } from './components/Captions';
import type { StructuredScript, SectionTiming } from '../src/types';

export interface ShortCompositionProps extends Record<string, unknown> {
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
