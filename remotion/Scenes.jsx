import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, spring, Easing} from 'remotion';
import {Octo} from './Octo.jsx';

export const FPS = 30;
export const FADE = 7;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const pop = (f, at, damping = 13) => spring({frame: f - at, fps: FPS, config: {damping, stiffness: 170, mass: 0.8}});
const fadeIn = (p) => interpolate(p, [0, 0.4], [0, 1], clamp);

// Content zone: y 220..1080 (Brainy + captions live below it, clear of Shorts UI)
const CY = 650;

export const Emoji = ({name, size, style}) => {
  if (name === 'octopus') return <Octo size={size} style={{...style, marginTop: -size * 0.06}} />;
  return <Img src={staticFile(`emoji/${name}.svg`)} style={{position: 'absolute', width: size, height: size, filter: 'drop-shadow(0 18px 30px rgba(0,0,0,.35))', ...style}} />;
};

const Label = ({text, x, y, w = 360, size = 46, color = '#fff', style}) => text ? (
  <div style={{position: 'absolute', left: x - w / 2, top: y, width: w, textAlign: 'center', fontWeight: 800, fontSize: size, color,
    lineHeight: 1.1, textShadow: '0 6px 22px rgba(0,0,0,.5)', ...style}}>{text}</div>
) : null;

// ---------- hook: badges arc above the big Brainy (Brainy itself is drawn by Video) ----------
export const Hook = ({scene, cue}) => {
  const f = useCurrentFrame();
  const items = (scene.items || []).slice(0, 3);
  const pos = items.length === 1 ? [[540, 330]] : items.length === 2 ? [[330, 360], [750, 360]] : [[220, 400], [540, 290], [860, 400]];
  return (
    <AbsoluteFill>
      {items.map((it, i) => {
        const at = cue(it.at, 0.15 + i * 0.22);
        const p = pop(f, at);
        const [x, y] = pos[i];
        return (
          <div key={i} style={{position: 'absolute', left: x - 120, top: y - 120, width: 240, height: 240, borderRadius: '50%',
            background: 'rgba(255,255,255,.10)', border: '2px solid rgba(255,255,255,.22)', backdropFilter: 'blur(10px)',
            boxShadow: '0 20px 50px rgba(0,0,0,.25)', opacity: fadeIn(p), scale: interpolate(p, [0, 1], [0.4, 1]),
            translate: `0px ${Math.sin((f - at) / 22) * 8}px`}}>
            <Emoji name={it.emoji} size={150} style={{left: 45, top: 45}} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- trio: up to 3 big icons, some can "switch off" at a cue word ----------
export const Trio = ({scene, cue}) => {
  const f = useCurrentFrame();
  const items = (scene.items || []).slice(0, 3);
  const n = items.length || 1;
  const dimAt = scene.dimAt ? cue(scene.dimAt, 0.5, true) : null;
  const dimSet = new Set(scene.dim || []);
  const xs = n === 1 ? [540] : n === 2 ? [330, 750] : [200, 540, 880];
  return (
    <AbsoluteFill>
      {items.map((it, i) => {
        const p = pop(f, 4 + i * 5);
        const off = dimAt !== null && dimSet.has(i) ? interpolate(f, [dimAt, dimAt + 10], [0, 1], clamp) : 0;
        const beat = Math.pow(Math.max(0, Math.sin(((f + i * 9) % 30) / 30 * Math.PI * 2)), 6) * (scene.pulse ? 1 : 0.35);
        const big = n === 1 ? 420 : n === 2 ? 320 : (i === 1 ? 300 : 260);
        return (
          <React.Fragment key={i}>
            <Emoji name={it.emoji} size={big} style={{left: xs[i] - big / 2, top: CY - big / 2 - 40,
              opacity: fadeIn(p) * (1 - off * 0.55), scale: interpolate(p, [0, 1], [0.5, 1]) * (1 + 0.08 * beat * (1 - off)),
              translate: `0px ${off * 40 + Math.sin((f + i * 20) / 24) * 8}px`,
              filter: `grayscale(${off}) brightness(${1 - off * 0.4}) drop-shadow(0 18px 30px rgba(0,0,0,.35))`}} />
            <Label text={it.label} x={xs[i]} y={CY + big / 2 - 10} w={n === 3 ? 320 : 440} size={n === 3 ? 40 : 50}
              style={{opacity: fadeIn(pop(f, 10 + i * 5)) * (1 - off * 0.5)}} />
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- compare: two cards side by side ----------
const Card = ({side, data, x, grad, at, dim, win}) => {
  const f = useCurrentFrame();
  const p = pop(f, at);
  return (
    <div style={{position: 'absolute', left: x, top: CY - 260, width: 400, height: 520, borderRadius: 44, background: grad,
      boxShadow: win ? '0 0 0 6px #ffd54a, 0 30px 70px rgba(255,213,74,.35)' : '0 30px 60px rgba(0,0,0,.35), inset 0 2px 0 rgba(255,255,255,.3)',
      color: '#fff', opacity: fadeIn(p) * (1 - dim * 0.5), scale: interpolate(p, [0, 1], [0.6, 1]) * (1 - dim * 0.08),
      translate: `0px ${interpolate(p, [0, 1], [60, 0])}px`}}>
      <Emoji name={data.emoji} size={190} style={{left: 105, top: 36, filter: `grayscale(${dim}) drop-shadow(0 14px 22px rgba(0,0,0,.3))`}} />
      <div style={{position: 'absolute', top: 245, width: '100%', textAlign: 'center', fontSize: (data.big || '').length > 6 ? 76 : 110, fontWeight: 800, letterSpacing: -2}}>{data.big}</div>
      <div style={{position: 'absolute', bottom: 34, width: '100%', textAlign: 'center', fontSize: 42, fontWeight: 700, opacity: 0.92, padding: '0 20px', boxSizing: 'border-box', lineHeight: 1.1}}>{data.label}</div>
    </div>
  );
};

export const Compare = ({scene, cue}) => {
  const f = useCurrentFrame();
  const rv = scene.revealAt ? cue(scene.revealAt, 0.6, true) : null;
  const k = rv === null ? 0 : interpolate(f, [rv, rv + 12], [0, 1], clamp);
  const w = scene.winner;
  return (
    <AbsoluteFill>
      <Card data={scene.left || {}} x={90} grad="linear-gradient(160deg,#ff8a65,#c2185b)" at={cue(scene.left?.at, 0.05)} dim={w === 'right' ? k : 0} win={w === 'left' && k > 0.5} />
      <Card data={scene.right || {}} x={590} grad="linear-gradient(160deg,#4fb3ff,#1f5fd6)" at={cue(scene.right?.at, 0.35)} dim={w === 'left' ? k : 0} win={w === 'right' && k > 0.5} />
      <div style={{position: 'absolute', left: 490, top: CY - 50, width: 100, height: 100, borderRadius: 50, background: 'rgba(255,255,255,.14)',
        border: '2px solid rgba(255,255,255,.3)', color: '#fff', fontWeight: 800, fontSize: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: fadeIn(pop(f, cue(scene.right?.at, 0.35)))}}>VS</div>
    </AbsoluteFill>
  );
};

// ---------- stat: a big number that counts up ----------
const fmt = (v, dec) => v.toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec});
export const Stat = ({scene, cue}) => {
  const f = useCurrentFrame();
  const at = cue(scene.at, 0.1);
  const target = Number(scene.value) || 0;
  const dec = Number.isInteger(target) ? 0 : 1;
  const v = interpolate(f, [at, at + 36], [0, target], {...clamp, easing: ease});
  const p = pop(f, 3);
  return (
    <AbsoluteFill>
      <Emoji name={scene.emoji} size={300} style={{left: 390, top: 250, opacity: fadeIn(p), scale: interpolate(p, [0, 1], [0.5, 1]), translate: `0px ${Math.sin(f / 20) * 10}px`}} />
      <div style={{position: 'absolute', top: 590, left: 40, right: 40, textAlign: 'center', fontWeight: 800, color: '#ffd54a', whiteSpace: 'nowrap',
        fontSize: Math.min(200, Math.floor(1500 / Math.max(4, (scene.prefix || '').length + fmt(target, dec).length + 1))),
        letterSpacing: -6, textShadow: '0 10px 40px rgba(0,0,0,.45)', opacity: fadeIn(pop(f, at))}}>
        {scene.prefix || ''}{fmt(v, dec)}
        {scene.suffix ? <span style={{fontSize: '0.42em', letterSpacing: 0, marginLeft: 10}}>{String(scene.suffix).trim()}</span> : null}
      </div>
      <Label text={scene.label} x={540} y={850} w={900} size={56} style={{opacity: fadeIn(pop(f, at + 10))}} />
    </AbsoluteFill>
  );
};

// ---------- orbit: centre icon, satellites, optional progress ring ----------
export const Orbit = ({scene, cue}) => {
  const f = useCurrentFrame();
  const n = Math.max(3, Math.min(10, Number(scene.count) || 6));
  const at = cue(scene.at, 0.15);
  const R = 300, C = 2 * Math.PI * R;
  const ring = scene.ring ? Math.max(0, Math.min(1, Number(scene.ring))) : 0;
  const prog = interpolate(f, [at, at + 26], [0, ring], {...clamp, easing: ease});
  const pc = pop(f, 3);
  return (
    <AbsoluteFill>
      {ring > 0 && (
        <svg width="1080" height="1920" style={{position: 'absolute'}}>
          <circle cx="540" cy={CY} r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="16" />
          <circle cx="540" cy={CY} r={R} fill="none" stroke="#ffd54a" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${C * prog} ${C}`}
            transform={`rotate(-90 540 ${CY})`} style={{filter: 'drop-shadow(0 0 18px rgba(255,213,74,.6))'}} />
        </svg>
      )}
      <Emoji name={scene.center} size={300} style={{left: 390, top: CY - 150, opacity: fadeIn(pc), scale: interpolate(pc, [0, 1], [0.6, 1]), translate: `0px ${Math.sin(f / 20) * 8}px`}} />
      {Array.from({length: n}).map((_, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2 + f * 0.003;
        const p = pop(f, at + i * 3);
        return <Emoji key={i} name={scene.around} size={120} style={{left: 540 + Math.cos(a) * 400 - 60, top: CY + Math.sin(a) * 400 - 60,
          opacity: fadeIn(p), scale: interpolate(p, [0, 1], [0.3, 1])}} />;
      })}
      <Label text={scene.label} x={540} y={CY + 440} w={900} size={50} style={{opacity: fadeIn(pop(f, at + 12))}} />
    </AbsoluteFill>
  );
};

// ---------- journey: an actor travels across a little set ----------
export const Journey = ({scene, dur}) => {
  const f = useCurrentFrame();
  const x = interpolate(f, [0, dur], [60, 560], clamp);
  const step = Math.sin(f / 5);
  const props = scene.props || [];
  return (
    <AbsoluteFill>
      <svg width="1080" height="1920" style={{position: 'absolute'}}>
        <path d="M0 960 C 220 900 420 980 620 940 S 960 900 1080 950 L1080 1100 L0 1100Z" fill="rgba(0,0,0,.25)" />
        <path d="M0 1010 C 260 980 520 1040 760 1000 S 1000 985 1080 1010 L1080 1100 L0 1100Z" fill="rgba(0,0,0,.3)" />
      </svg>
      {props[0] && <Emoji name={props[0]} size={240} style={{left: -20, top: 790, opacity: 0.95}} />}
      {props[1] && <Emoji name={props[1]} size={190} style={{left: 880, top: 830, opacity: 0.9}} />}
      {scene.flyer && <Emoji name={scene.flyer} size={140} style={{left: interpolate(f, [0, dur], [1100, -200]), top: 300 + Math.sin(f / 12) * 20, scale: '-1 1', opacity: 0.9}} />}
      <Emoji name={scene.actor} size={380} style={{left: x, top: 600 + Math.abs(step) * -14, rotate: `${step * 4}deg`, scale: `${1 + step * 0.03} ${1 - step * 0.03}`}} />
    </AbsoluteFill>
  );
};

// ---------- outro: subscribe button (Brainy is drawn by Video) ----------
// LIKE / SHARE / SUBSCRIBE chips pop in as each word is spoken
const CtaChips = ({cue}) => {
  const f = useCurrentFrame();
  const chips = [
    {icon: 'thumbs_up', label: 'LIKE', word: 'like', x: 150},
    {icon: 'right_arrow_curving_left', label: 'SHARE', word: 'share', x: 435, flip: true},
    {icon: 'bell', label: 'SUBSCRIBE', word: 'subscribe', x: 720},
  ];
  return chips.map((c, i) => {
    const p = pop(f, cue(c.word, 0.1 + i * 0.12, true));
    return (
      <div key={i} style={{position: 'absolute', left: c.x, top: 160, width: 210, height: 250, opacity: fadeIn(p), scale: interpolate(p, [0, 1], [0.3, 1]),
        translate: `0px ${Math.sin((f + i * 12) / 14) * 6}px`}}>
        <div style={{position: 'absolute', left: 15, top: 0, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.12)',
          border: '2px solid rgba(255,255,255,.25)', boxShadow: '0 18px 40px rgba(0,0,0,.25)'}}>
          <Emoji name={c.icon} size={120} style={{left: 30, top: 30, scale: c.flip ? '-1 1' : '1 1'}} />
        </div>
        <div style={{position: 'absolute', top: 196, width: '100%', textAlign: 'center', fontWeight: 800, fontSize: 36, color: '#fff', letterSpacing: 1}}>{c.label}</div>
      </div>
    );
  });
};

export const Outro = ({cue}) => {
  const f = useCurrentFrame();
  const subAt = cue ? cue('subscribe', 0.45, true) : FADE + 36;
  const b = pop(f, FADE + 8);
  const press = Math.max(FADE + 20, subAt + 10);
  const down = interpolate(f, [press, press + 3, press + 8], [1, 0.92, 1], clamp);
  const done = f >= press + 2;
  return (<>
    {cue && <CtaChips cue={cue} />}
    <div style={{position: 'absolute', left: 270, top: 950, width: 540, height: 128, borderRadius: 64,
      background: done ? '#3b3f4f' : 'linear-gradient(180deg,#ff3b3b,#d91c1c)', color: '#fff', fontWeight: 800, fontSize: 56, letterSpacing: 2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: done ? '0 16px 34px rgba(0,0,0,.3)' : '0 18px 40px rgba(217,28,28,.45), inset 0 2px 0 rgba(255,255,255,.3)',
      opacity: fadeIn(b), scale: interpolate(b, [0, 1], [0.6, 1]) * down}}>
      {done ? 'SUBSCRIBED' : 'SUBSCRIBE'}
    </div>
  </>);
};

export const SCENES = {hook: Hook, trio: Trio, compare: Compare, stat: Stat, orbit: Orbit, journey: Journey, outro: Outro};
