import React from 'react';
import { AbsoluteFill } from 'remotion';
import { THEME } from '../theme';

export const HandleBadge: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <span style={{
      position: 'absolute',
      top: 48,
      left: 36,
      fontFamily: THEME.fonts.body,
      fontSize: THEME.sizes.handle,
      color: THEME.colors.text,
      opacity: 0.7,
      fontWeight: 400,
    }}>
      {THEME.handle}
    </span>
  </AbsoluteFill>
);
