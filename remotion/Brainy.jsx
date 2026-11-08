import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';

// Brainy: the channel mascot. Brain illustration + drawn face that blinks and talks.
export const Brainy = ({size, talk = 0, emotion = 'happy', style}) => {
  const f = useCurrentFrame();
  const blink = f % 110 > 105 ? 0.1 : 1;
  const look = Math.sin(f / 45) * 1.5;
  const wow = emotion === 'wow';
  // talk = voice loudness 0..1 for this frame, so the mouth opens exactly when (and as wide as) the voice is loud
  const open = talk > 0.08 ? Math.min(1, 0.1 + talk * 0.9) : 0;
  return (
    <div style={{position: 'absolute', width: size, height: size, ...style}}>
      <div style={{position: 'absolute', inset: '-14%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,170,220,.38) 0%, rgba(255,170,220,0) 64%)'}} />
      <Img src={staticFile('emoji/brain.svg')} style={{position: 'absolute', width: size, height: size, filter: 'drop-shadow(0 18px 28px rgba(0,0,0,.35))'}} />
      <svg viewBox="0 0 100 100" style={{position: 'absolute', width: size, height: size, overflow: 'visible'}}>
        {wow && <>
          <path d="M30 41 Q37 36 44 40" stroke="#7a1d45" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M56 40 Q63 36 70 41" stroke="#7a1d45" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </>}
        {[38, 62].map((cx, i) => (
          <g key={i}>
            <ellipse cx={cx} cy="55" rx="8.5" ry={9.5 * blink * (wow ? 1.12 : 1)} fill="#fff" />
            {blink > 0.5 && <>
              <circle cx={cx + 1.5 + look} cy="57" r={wow ? 4.2 : 5} fill="#1d1430" />
              <circle cx={cx + 3.5 + look} cy="54.5" r="1.7" fill="#fff" />
            </>}
          </g>
        ))}
        <ellipse cx="28" cy="66" rx="5" ry="2.8" fill="#ff8fb0" opacity=".7" />
        <ellipse cx="72" cy="66" rx="5" ry="2.8" fill="#ff8fb0" opacity=".7" />
        {open > 0.02 ? (
          // talking: the voice loudness alone sets how wide the mouth opens (wow only changes brows/eyes)
          <ellipse cx="50" cy="70" rx={4 + open * 2} ry={1 + open * 5} fill="#5a1233" />
        ) : wow ? (
          <ellipse cx="50" cy="70" rx="2.6" ry="3" fill="#5a1233" />
        ) : (
          <path d="M44 68 Q50 74 56 68" stroke="#7a1d45" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        )}
      </svg>
    </div>
  );
};
