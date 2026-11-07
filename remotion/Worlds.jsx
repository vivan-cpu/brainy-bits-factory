import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolateColors} from 'remotion';

export const WORLDS = {
  ocean: [['#04223f', '#0b5876'], ['#04283f', '#0c6466'], ['#061947', '#1d4c9c']],
  space: [['#05031a', '#1a0f45'], ['#070420', '#2a1460'], ['#030212', '#14224f']],
  body: [['#2a0718', '#6a1438'], ['#1f0618', '#5a1a4a'], ['#2b0a12', '#7a2030']],
  lab: [['#061a24', '#0d4a52'], ['#0a1430', '#1f3a7a'], ['#071c1c', '#14594a']],
  sky: [['#0b3a73', '#3a8fd6'], ['#123a7a', '#5aa0e0'], ['#0a2f66', '#2f7fc8']],
  forest: [['#06200f', '#1a5a2a'], ['#0b2410', '#2f6a1f'], ['#071f18', '#1d5a40']],
};

const Rays = ({f, color = 'rgba(190,235,255,.20)'}) => [0, 1, 2, 3, 4].map((i) => (
  <div key={i} style={{position: 'absolute', top: -200, left: 80 + i * 210, width: 150 + (i % 2) * 90, height: 1700,
    background: `linear-gradient(180deg, ${color} 0%, rgba(0,0,0,0) 85%)`, filter: 'blur(28px)', transformOrigin: '50% 0%',
    rotate: `${-14 + i * 6 + Math.sin(f / 70 + i) * 4}deg`, opacity: 0.55 + 0.35 * Math.sin(f / 45 + i * 1.7)}} />
));

const Particles = ({f, n = 46, up = true, color = 'rgba(210,240,255,.55)'}) => Array.from({length: n}).map((_, i) => {
  const depth = i % 3, size = [4, 8, 14][depth], speed = [0.5, 1.0, 1.8][depth];
  const x = ((i * 197 + 61) % 1080) + Math.sin(f / 50 + i) * 18;
  const travel = (f * speed + i * 137) % 2040;
  const y = up ? 1960 - travel : -40 + travel;
  return <div key={i} style={{position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%', background: color,
    filter: depth === 1 ? 'none' : `blur(${depth === 0 ? 1.5 : 2.5}px)`, opacity: [0.35, 0.55, 0.4][depth]}} />;
});

const Stars = ({f}) => Array.from({length: 90}).map((_, i) => {
  const x = (i * 263 + 17) % 1080, y = (i * 571 + 91) % 1920, s = 2 + (i % 4);
  return <div key={i} style={{position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%', background: '#fff',
    opacity: 0.25 + 0.6 * Math.abs(Math.sin(f / (18 + (i % 7) * 4) + i))}} />;
});

const Cells = ({f}) => Array.from({length: 14}).map((_, i) => {
  const s = 60 + (i * 37) % 120, x = (i * 211) % 1080, y = 1980 - ((f * (0.6 + (i % 3) * 0.3) + i * 260) % 2200);
  return <div key={i} style={{position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 35%, rgba(255,150,170,.35), rgba(200,40,80,.12) 60%, rgba(0,0,0,0) 72%)', filter: 'blur(1px)'}} />;
});

const Grid = () => (
  <AbsoluteFill style={{backgroundImage: 'radial-gradient(rgba(160,230,255,.16) 2px, transparent 2px)', backgroundSize: '54px 54px', opacity: 0.6}} />
);

const Clouds = ({f}) => [0, 1, 2, 3].map((i) => (
  <div key={i} style={{position: 'absolute', top: 160 + i * 380, left: ((i * 300 + f * (0.6 + i * 0.2)) % 1500) - 400, width: 420, height: 140,
    borderRadius: 140, background: 'rgba(255,255,255,.18)', filter: 'blur(18px)'}} />
));

// sceneStarts: frame numbers where each scene begins (for palette cross-fades)
export const World = ({world = 'ocean', sceneStarts = [0]}) => {
  const f = useCurrentFrame();
  const pal = WORLDS[world] || WORLDS.ocean;
  const stops = [], top = [], bot = [];
  sceneStarts.forEach((s, k) => {
    const p = pal[k % pal.length];
    if (k === 0) { stops.push(0); top.push(p[0]); bot.push(p[1]); return; }
    const prev = pal[(k - 1) % pal.length];
    stops.push(s - 7, s + 7); top.push(prev[0], p[0]); bot.push(prev[1], p[1]);
  });
  const c1 = stops.length > 1 ? interpolateColors(f, stops, top) : top[0];
  const c2 = stops.length > 1 ? interpolateColors(f, stops, bot) : bot[0];
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${c1} 0%, ${c2} 100%)`}}>
      {world === 'ocean' && <><Rays f={f} /><Particles f={f} /></>}
      {world === 'space' && <><Stars f={f} /><Particles f={f} n={14} up={false} color="rgba(200,180,255,.5)" /></>}
      {world === 'body' && <><Cells f={f} /><Particles f={f} n={24} color="rgba(255,200,215,.45)" /></>}
      {world === 'lab' && <><Grid /><Particles f={f} n={30} /></>}
      {world === 'sky' && <><Rays f={f} color="rgba(255,250,220,.22)" /><Clouds f={f} /></>}
      {world === 'forest' && <><Rays f={f} color="rgba(230,255,190,.18)" /><Particles f={f} n={30} up={false} color="rgba(220,255,170,.5)" /></>}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 45%, rgba(0,0,0,.45) 100%)'}} />
    </AbsoluteFill>
  );
};
