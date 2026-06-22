import React from 'react';
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../theme';
import type { SectionTiming, SectionKind } from '../../src/types';

interface SectionStyle {
  font: string;
  size: number;
  align: 'center';
  animation: 'word-reveal' | 'line-slide' | 'paragraph-fade' | 'big-fade' | 'question-pop';
}

const STYLE_BY_KIND: Record<SectionKind, SectionStyle> = {
  hook:        { font: THEME.fonts.display, size: THEME.sizes.hook,        align: 'center', animation: 'word-reveal' },
  phenomenon:  { font: THEME.fonts.body,    size: THEME.sizes.phenomenon,  align: 'center', animation: 'line-slide' },
  bias_name:   { font: THEME.fonts.display, size: THEME.sizes.biasName,    align: 'center', animation: 'big-fade' }, // skipped — handled by BiasNameDrop
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
  sectionsOnScreen: string[];
  timings: SectionTiming[];
}

export const KineticText: React.FC<Props> = ({ sectionsOnScreen, timings }) => {
  const fps = THEME.video.fps;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      {timings.map((t, i) => {
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
