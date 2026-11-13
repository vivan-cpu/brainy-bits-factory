import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolateColors} from 'remotion';

export const WORLDS = {
  ocean: [['#053a66', '#0f86a8'], ['#06426a', '#12989a'], ['#082a72', '#2a6fd0']],
  space: [['#0a0630', '#2f1a78'], ['#0d0738', '#45208f'], ['#060426', '#22388a']],
  body: [['#4a0c2c', '#a8245a'], ['#3a0a30', '#8f2a78'], ['#4c1020', '#b8324a']],
  lab: [['#082c3c', '#128090'], ['#0e2050', '#2f58b8'], ['#0a3030', '#1f8a72']],
  sky: [['#0f55a8', '#58b0f0'], ['#1658b0', '#78bff5'], ['#0e4898', '#48a0e6']],
  forest: [['#0a3418', '#2a8a40'], ['#103a18', '#479a2e'], ['#0b3226', '#2c8a62']],
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

// Layered scenery along the bottom of the frame so the lower third is never an empty gradient.
// Each world has its own ground: seabed, planet horizon, tissue, lab floor, cloud bank, forest hills.
const GROUND = {
  ocean: ['#0a4a63', '#073a52', '#052a3f'],
  space: ['#3b2a7a', '#241a55', '#150f38'],
  body: ['#8a2348', '#6a1838', '#4a1028'],
  lab: ['#14606a', '#0e4a56', '#083540'],
  sky: ['#ffffff', '#e6f1ff', '#cfe3fb'],
  forest: ['#2f7a35', '#1f5c2a', '#12401d'],
};

const hill = (f, i, w, h, amp) => {
  const pts = [];
  for (let x = 0; x <= w; x += 40) {
    const y = h * 0.42 - i * 26 + Math.sin(x / (190 - i * 30) + i * 2.1 + f / (160 + i * 60)) * amp + Math.sin(x / 71 + i) * amp * 0.28;
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return `M0,${h} L${pts.join(' L')} L${w},${h} Z`;
};

const Scenery = ({world, f, wide}) => {
  const W = 1080, H = 460;
  const top = (wide ? 607.5 : 1920) - H * (wide ? 0.62 : 1);
  const c = GROUND[world] || GROUND.ocean;
  const sky = world === 'sky';
  return (
    <div style={{position: 'absolute', left: 0, top, width: W, height: H}}>
      {world === 'space' && (
        <div style={{position: 'absolute', left: -360, top: 150, width: 1800, height: 1800, borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 0%, #6a54c8 0%, #3a2a86 22%, #1a1248 60%)', boxShadow: '0 -18px 90px rgba(150,130,255,.55), inset 0 30px 80px rgba(190,170,255,.35)'}} />
      )}
      {world === 'forest' && [0, 1, 2, 3, 4, 5, 6].map((i) => {
        const x = 40 + i * 160 + (i % 2) * 30, s = 0.8 + ((i * 7) % 5) * 0.12;
        return <div key={i} style={{position: 'absolute', left: x, top: 60 - s * 60 + Math.sin(i * 2.3) * 14, width: 0, height: 0, borderLeft: `${46 * s}px solid transparent`, borderRight: `${46 * s}px solid transparent`,
          borderBottom: `${170 * s}px solid #164a22`, opacity: 0.9, rotate: `${Math.sin(f / 50 + i) * 1.2}deg`, transformOrigin: '50% 100%'}} />;
      })}
      {world !== 'space' && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0, filter: sky ? 'blur(10px)' : 'none', opacity: sky ? 0.5 : 1}}>
          {[0, 1, 2].map((i) => <path key={i} d={hill(f, i, W, H, sky ? 46 : 34)} fill={c[i]} opacity={sky ? 0.75 : 0.96} transform={`translate(0 ${i * 96})`} />)}
        </svg>
      )}
      {world === 'ocean' && [0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{position: 'absolute', left: 70 + i * 185 + (i % 2) * 40, bottom: 40 + (i % 3) * 30, width: 44, height: 170 + (i % 3) * 70, borderRadius: "50% 50% 14px 14px",
          background: 'linear-gradient(180deg, #2fbf8a, #0d6a56)', transformOrigin: '50% 100%', rotate: `${Math.sin(f / 26 + i * 1.4) * 9}deg`, opacity: 0.85}} />
      ))}
      {world === 'lab' && (
        <div style={{position: 'absolute', left: -200, right: -200, top: 150, bottom: 0, opacity: 0.5, transform: 'perspective(700px) rotateX(62deg)', transformOrigin: '50% 0%',
          backgroundImage: 'linear-gradient(rgba(140,240,255,.55) 2px, transparent 2px), linear-gradient(90deg, rgba(140,240,255,.55) 2px, transparent 2px)',
          backgroundSize: '90px 90px', backgroundPosition: `0px ${(f * 1.2) % 90}px`}} />
      )}
    </div>
  );
};

// sceneStarts: frame numbers where each scene begins (for palette cross-fades)
// wide: the world is cropped to its top 607px (16:9 long video), so the scenery sits there
export const World = ({world = 'ocean', sceneStarts = [0], wide = false}) => {
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
      <Scenery world={world} f={f} wide={wide} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 34%, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 38%)'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 52%, rgba(0,0,0,.34) 100%)'}} />
    </AbsoluteFill>
  );
};
