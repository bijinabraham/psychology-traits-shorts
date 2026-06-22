import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { THEME } from '../theme';
import type { SectionTiming } from '../../src/types';

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
        const fadeFrames = Math.min(Math.round((CROSSFADE_MS / 1000) * fps), Math.floor(duration / 2));
        const opacity = interpolate(
          frame,
          [startFrame - fadeFrames, startFrame, endFrame - fadeFrames, endFrame],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );

        const videoSrc = backgroundPaths[i];

        return (
          <Sequence key={i} from={Math.max(0, startFrame - fadeFrames)} durationInFrames={duration + fadeFrames * 2}>
            <AbsoluteFill style={{ opacity, filter: 'saturate(0.7)' }}>
              {videoSrc && (
                <OffthreadVideo
                  src={videoSrc}
                  playbackRate={0.5}
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
              <AbsoluteFill style={{ backgroundColor: THEME.colors.overlayBg }} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
