import React from 'react';
import {useCurrentFrame} from 'remotion';

// Hand-built vector octopus: bulb mantle, 8 tapered curling tentacles with suckers.
const VW = 600, VH = 690;

const tentacle = (f, i, spread, len, phase, curlAmt) => {
  const N = 26, ds = len / N, sign = Math.sign(spread) || 1;
  let x = 300 + spread * 115, y = 350;
  let th = Math.PI / 2 - spread * 0.8;
  const L = [], R = [], suckers = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const w = 30 * Math.pow(1 - t, 0.8) + 3;
    const nx = -Math.sin(th), ny = Math.cos(th);
    L.push([x + nx * w, y + ny * w]);
    R.push([x - nx * w, y - ny * w]);
    if (k > 2 && k < N - 2 && k % 2 === 0) {
      suckers.push({x: x - nx * w * 0.42 * sign, y: y - ny * w * 0.42 * sign, r: Math.max(2.2, w * 0.3)});
    }
    th += (-curlAmt * sign * 2 * t * t + 0.55 * Math.sin(f / 11 + phase + t * 4.2) * t) / N * 1.6;
    x += Math.cos(th) * ds;
    y += Math.sin(th) * ds;
  }
  const pts = [...L, ...R.reverse()];
  const d = 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + 'Z';
  return {d, suckers};
};

export const Octo = ({size = 500, style}) => {
  const f = useCurrentFrame();
  const breathe = 1 + 0.025 * Math.sin(f / 12);
  const blink = (f % 95) > 90 ? 0.12 : 1;
  const look = Math.sin(f / 40) * 6;
  const back = [-1.25, -0.55, 0.55, 1.25].map((s, i) => tentacle(f, i, s, 340, i * 1.7 + 2, 1.5));
  const front = [-0.85, -0.28, 0.28, 0.85].map((s, i) => tentacle(f, i + 4, s, 330, i * 1.3, 1.7));
  return (
    <svg width={size} height={(size * VH) / VW} viewBox={`0 0 ${VW} ${VH}`}
      style={{position: 'absolute', overflow: 'visible', filter: 'drop-shadow(0 24px 34px rgba(0,0,0,.38))', ...style}}>
      <defs>
        <radialGradient id="oMantle" cx="38%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#ffb48c" />
          <stop offset="45%" stopColor="#ff6f7d" />
          <stop offset="100%" stopColor="#d23a6c" />
        </radialGradient>
        <linearGradient id="oFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff7a7f" />
          <stop offset="100%" stopColor="#e9467a" />
        </linearGradient>
        <linearGradient id="oBack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8395f" />
          <stop offset="100%" stopColor="#a0285a" />
        </linearGradient>
      </defs>
      {back.map((t, i) => <path key={i} d={t.d} fill="url(#oBack)" />)}
      <g style={{transformOrigin: '300px 360px', scale: `${1 / breathe + 0.03} ${breathe}`}}>
        <path d="M135 300 C 105 150, 185 55, 300 55 C 415 55, 495 150, 465 300 C 455 385, 145 385, 135 300 Z" fill="url(#oMantle)" />
        <ellipse cx="225" cy="150" rx="55" ry="34" fill="#fff" opacity=".28" transform="rotate(-28 225 150)" />
        <circle cx="370" cy="130" r="14" fill="#c43567" opacity=".35" />
        <circle cx="400" cy="185" r="9" fill="#c43567" opacity=".3" />
        <circle cx="345" cy="95" r="8" fill="#c43567" opacity=".3" />
      </g>
      {front.map((t, i) => (
        <g key={i}>
          <path d={t.d} fill="url(#oFront)" />
          {t.suckers.map((s, j) => <circle key={j} cx={s.x} cy={s.y} r={s.r} fill="#ffd7df" opacity=".9" />)}
        </g>
      ))}
      {/* face */}
      <ellipse cx="300" cy="352" rx="150" ry="40" fill="#e9467a" />
      {[235, 365].map((ex, i) => (
        <g key={i}>
          <ellipse cx={ex} cy="300" rx="40" ry={40 * blink} fill="#fff" />
          {blink > 0.5 && <>
            <circle cx={ex + look} cy="306" r="22" fill="#1d1430" />
            <circle cx={ex + look + 8} cy="297" r="7" fill="#fff" />
          </>}
        </g>
      ))}
      <ellipse cx="190" cy="345" rx="22" ry="12" fill="#ff9fb2" opacity=".55" />
      <ellipse cx="410" cy="345" rx="22" ry="12" fill="#ff9fb2" opacity=".55" />
      <path d="M278 350 Q300 370 322 350" stroke="#7a1d45" strokeWidth="7" fill="none" strokeLinecap="round" />
    </svg>
  );
};
