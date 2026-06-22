import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../theme';
import type { SectionTiming } from '../../src/types';

interface Props {
  timings: SectionTiming[];
}

export const Captions: React.FC<Props> = ({ timings }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

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
