import React from 'react';
import {AbsoluteFill} from 'remotion';
import {World} from './Worlds.jsx';
import {Brainy} from './Brainy.jsx';
import {Emoji} from './Scenes.jsx';
import {fontFamily} from './Video.jsx';

// Channel art, rendered as stills:
//   npx remotion still remotion/index.jsx Banner out/banner.png   (2560x1440; everything important sits in the 1546x423 centre strip that every device shows)
//   npx remotion still remotion/index.jsx Logo out/logo.png       (800x800 profile picture, shown as a circle)
const BG = 'linear-gradient(120deg, #0a0630 0%, #2a1a80 38%, #0f86a8 100%)';
const FLOAT = [
  ['octopus', 150, 520, 150, -12], ['ringed_planet', 2230, 250, 170, 10], ['t_rex', 330, 950, 190, 8], ['rocket', 2120, 980, 180, -18],
  ['shark', 880, 210, 150, 6], ['dna', 1640, 1150, 140, 14], ['high_voltage', 1280, 1210, 120, -8], ['microscope', 700, 1180, 140, -10], ['volcano', 1750, 190, 150, 6],
];

export const Banner = () => (
  <AbsoluteFill style={{fontFamily, background: BG, overflow: 'hidden'}}>
    <AbsoluteFill style={{backgroundImage: 'radial-gradient(rgba(255,255,255,.5) 2px, transparent 2.5px)', backgroundSize: '97px 83px', opacity: 0.35}} />
    <div style={{position: 'absolute', left: 1280 - 900, top: 720 - 900, width: 1800, height: 1800, borderRadius: '50%',
      background: 'repeating-conic-gradient(rgba(255,255,255,.07) 0deg 8deg, rgba(255,255,255,0) 8deg 22deg)',
      maskImage: 'radial-gradient(circle, #000 15%, transparent 66%)', WebkitMaskImage: 'radial-gradient(circle, #000 15%, transparent 66%)'}} />
    {FLOAT.map(([n, x, y, s, r]) => <Emoji key={n} name={n} size={s} style={{left: x, top: y, rotate: `${r}deg`, opacity: 0.9}} />)}
    {/* safe strip: x 507..2053, y 508..931 */}
    <Brainy size={360} emotion="happy" style={{left: 560, top: 540}} />
    <div style={{position: 'absolute', left: 950, top: 540, width: 1100}}>
      <div style={{fontWeight: 800, fontSize: 168, lineHeight: 1, letterSpacing: -5, color: '#fff', textShadow: '0 12px 40px rgba(0,0,0,.5)', whiteSpace: 'nowrap'}}>
        BRAINY<span style={{color: '#ffd54a'}}>VOO</span>
      </div>
      <div style={{marginTop: 26, fontWeight: 700, fontSize: 62, color: '#eaf6ff', textShadow: '0 6px 22px rgba(0,0,0,.5)', whiteSpace: 'nowrap'}}>Weird facts that are actually true</div>
      <div style={{marginTop: 26, display: 'inline-block', padding: '14px 38px', borderRadius: 60, background: '#ff2d2d', color: '#fff', fontWeight: 800, fontSize: 46, letterSpacing: 1,
        boxShadow: '0 12px 30px rgba(0,0,0,.4)'}}>NEW SHORTS EVERY DAY</div>
    </div>
  </AbsoluteFill>
);

export const Logo = () => (
  <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 40%, #3a2ab0 0%, #17105a 62%, #0a0630 100%)', overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: -300, top: -300, width: 1400, height: 1400, borderRadius: '50%',
      background: 'repeating-conic-gradient(rgba(255,255,255,.09) 0deg 10deg, rgba(255,255,255,0) 10deg 24deg)',
      maskImage: 'radial-gradient(circle, #000 20%, transparent 62%)', WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 62%)'}} />
    <Brainy size={560} emotion="happy" style={{left: 120, top: 120}} />
  </AbsoluteFill>
);
