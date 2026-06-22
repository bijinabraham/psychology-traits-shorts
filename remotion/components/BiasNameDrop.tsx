import React from 'react';
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../theme';
import type { SectionTiming } from '../../src/types';

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
