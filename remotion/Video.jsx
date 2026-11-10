import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate, spring, Easing} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Montserrat';
import {World} from './Worlds.jsx';
import {Brainy} from './Brainy.jsx';
import {SCENES, FPS, FADE, Emoji, hookBadgePos} from './Scenes.jsx';

const {fontFamily} = loadFont('normal', {weights: ['700', '800'], subsets: ['latin']});
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const durationFor = (timing) => Math.ceil((timing.total + 0.7) * FPS);
const HOOK_FRAMES = 48; // big hook title is on screen for the first ~1.6s

const HERO = 700; // px, the subject's size during the opening
const HERO_Y = 590;

// First 1.6s: the subject already fills the screen and moves on frame one, with the teaser as the only text.
// It then flies up and becomes the first badge of the hook scene, so Brainy never appears on top of it.
const HookOpening = ({text, hero, badges}) => {
  const f = useCurrentFrame();
  if (!text || f > HOOK_FRAMES + 8) return null;
  const leave = interpolate(f, [HOOK_FRAMES - 6, HOOK_FRAMES + 6], [0, 1], {...clamp, easing: ease});
  const [bx, by] = hookBadgePos(badges);
  const punch = interpolate(spring({frame: f, fps: FPS, config: {damping: 10, stiffness: 200, mass: 0.6}}), [0, 1], [1.22, 1]);
  const push = interpolate(f, [0, HOOK_FRAMES], [1, 1.1], clamp);
  const heroScale = punch * push * interpolate(leave, [0, 1], [1, 150 / HERO]);
  const titleP = spring({frame: f, fps: FPS, config: {damping: 9, stiffness: 220, mass: 0.7}});
  const titleOut = interpolate(f, [HOOK_FRAMES - 6, HOOK_FRAMES + 2], [1, 0], clamp);
  const shake = f < 10 ? Math.sin(f * 2.2) * (10 - f) * 1.2 : 0;
  const ring = interpolate(f, [0, 24], [0, 1], {...clamp, easing: ease});
  const words = String(text).toUpperCase().split(/\s+/);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 540 - 950, top: HERO_Y - 950, width: 1900, height: 1900, borderRadius: '50%', opacity: 1 - leave, rotate: `${f * 1.4}deg`,
        background: 'repeating-conic-gradient(rgba(255,255,255,.17) 0deg 9deg, rgba(255,255,255,0) 9deg 24deg)',
        maskImage: 'radial-gradient(circle, #000 18%, transparent 68%)', WebkitMaskImage: 'radial-gradient(circle, #000 18%, transparent 68%)'}} />
      <div style={{position: 'absolute', left: 540 - 480, top: HERO_Y - 480, width: 960, height: 960, borderRadius: '50%', opacity: 1 - leave,
        background: 'radial-gradient(circle, rgba(255,255,255,.34) 0%, rgba(255,255,255,0) 68%)'}} />
      <div style={{position: 'absolute', left: 540 - 400, top: HERO_Y - 400, width: 800, height: 800, borderRadius: '50%', border: '10px solid rgba(255,255,255,.75)',
        scale: interpolate(ring, [0, 1], [0.5, 1.5]), opacity: interpolate(ring, [0, 1], [0.9, 0])}} />
      {hero && (
        <div style={{position: 'absolute', width: HERO, height: HERO, left: interpolate(leave, [0, 1], [540, bx]) - HERO / 2, top: interpolate(leave, [0, 1], [HERO_Y, by]) - HERO / 2,
          scale: heroScale, opacity: interpolate(leave, [0.85, 1], [1, 0], clamp),
          translate: `0px ${Math.sin(f / 7) * 16 * (1 - leave)}px`, rotate: `${Math.sin(f / 5) * 5 * (1 - leave)}deg`}}>
          <Emoji name={hero} size={HERO} />
        </div>
      )}
      <div style={{position: 'absolute', left: 70, right: 70, top: 1090, textAlign: 'center', fontWeight: 800, fontSize: words.join(' ').length > 18 ? 118 : 140, lineHeight: 1.02, letterSpacing: -2,
        color: '#fff', textShadow: '0 12px 40px rgba(0,0,0,.6)', opacity: titleOut, scale: interpolate(titleP, [0, 1], [1.25, 1]), translate: `${shake}px 0px`}}>
        {words.map((w, i) => (
          <span key={i} style={{color: i === words.length - 1 ? '#ffd54a' : '#fff', marginRight: 22, display: 'inline-block'}}>{w}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const SceneWrap = ({dur, first, last, children}) => {
  const f = useCurrentFrame();
  const a = first ? 1 : interpolate(f, [0, FADE * 2], [0, 1], clamp);
  const b = last ? 1 : interpolate(f, [dur - FADE * 2, dur], [1, 0], clamp);
  return <AbsoluteFill style={{opacity: Math.min(a, b), scale: 1 + f * 0.00025}}>{children}</AbsoluteFill>;
};

// Brainy lives across the whole video: big & centred on hook/outro, small at bottom-left otherwise
const BrainyLayer = ({spec, timing}) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const k = Math.max(0, timing.scenes.findLastIndex((s) => t >= s.start - 0.25));
  const type = spec.scenes[k]?.type;
  const bigNow = type === 'hook' || type === 'outro';
  const sStart = Math.round((timing.scenes[k]?.start ?? 0) * FPS);
  const prevType = spec.scenes[k - 1]?.type;
  const bigPrev = k === 0 ? bigNow : prevType === 'hook' || prevType === 'outro';
  const p = k === 0 ? 1 : spring({frame: f - sStart + 8, fps: FPS, config: {damping: 16, stiffness: 120}});
  const big = interpolate(p, [0, 1], [bigPrev ? 1 : 0, bigNow ? 1 : 0]);
  const outro = type === 'outro';
  const size = interpolate(big, [0, 1], [250, outro ? 420 : 470]);
  const left = interpolate(big, [0, 1], [40, 540 - size / 2]);
  const top = interpolate(big, [0, 1], [1120, outro ? 480 : 610]);
  // mouth follows the real loudness of the voice track (per-frame envelope from run.mjs); fallback: word timings
  let talking;
  if (timing.amp && timing.amp.length) {
    talking = timing.amp[Math.min(f, timing.amp.length - 1)] || 0;
  } else {
    const words = timing.scenes.flatMap((s) => s.words);
    talking = words.some((w) => t >= w.s - 0.03 && t <= w.e + 0.03) ? 1 : 0;
  }
  const intro = spring({frame: f - (spec.hookText ? HOOK_FRAMES - 2 : 2), fps: FPS, config: {damping: 14}});
  return <Brainy size={size} talk={talking} emotion={spec.scenes[k]?.mood === 'wow' ? 'wow' : 'happy'}
    style={{left, top, scale: interpolate(intro, [0, 1], [0.6, 1]), opacity: interpolate(intro, [0, 0.4], [0, 1], clamp),
      translate: `0px ${Math.sin(f / 18) * (6 + big * 8)}px`, rotate: `${Math.sin(f / 30) * 3}deg`}} />;
};

const Captions = ({timing, hideUntil = 0}) => {
  const f = useCurrentFrame();
  if (f < hideUntil) return null; // only one piece of text on screen at a time
  const t = f / FPS;
  const chunks = [];
  timing.scenes.forEach((s) => { for (let i = 0; i < s.words.length; i += 3) chunks.push(s.words.slice(i, i + 3)); });
  const ci = chunks.findIndex((c, n) => t >= c[0].s - 0.05 && (n + 1 < chunks.length ? t < chunks[n + 1][0].s - 0.05 : t < c[c.length - 1].e + 0.5));
  if (ci < 0) return null;
  const c = chunks[ci];
  const enterF = f - Math.round((c[0].s - 0.05) * FPS);
  const endF = ci + 1 < chunks.length ? Math.round((chunks[ci + 1][0].s - 0.05) * FPS) : Math.round((c[c.length - 1].e + 0.5) * FPS);
  const op = Math.min(interpolate(enterF, [0, 5], [0, 1], clamp), interpolate(f, [endF - 3, endF], [1, 0], clamp));
  return (
    <div style={{position: 'absolute', left: 300, width: 730, top: 1140, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', fontWeight: 800, fontSize: 76, lineHeight: 1.12, color: '#fff', textShadow: '0 6px 28px rgba(0,0,0,.55)', opacity: op,
      translate: `0px ${interpolate(enterF, [0, 6], [22, 0], {...clamp, easing: ease})}px`}}>
      <div style={{width: '100%', overflowWrap: 'break-word'}}>
        {c.map((w, j) => {
          const on = t >= w.s;
          return <span key={j} style={{display: 'inline-block', margin: '0 10px', color: on ? (t < w.e + 0.08 ? '#ffd54a' : '#fff') : 'rgba(255,255,255,.55)'}}>{w.w}</span>;
        })}
      </div>
    </div>
  );
};

export const Video = ({jobId, spec, timing}) => {
  const starts = timing.scenes.map((s) => Math.round(s.start * FPS));
  return (
    <AbsoluteFill style={{fontFamily, background: '#04223f'}}>
      <World world={spec.world} sceneStarts={starts} />
      {spec.scenes.map((scene, k) => {
        const Comp = SCENES[scene.type];
        if (!Comp) return null;
        const st = timing.scenes[k];
        const from = Math.max(0, starts[k] - FADE);
        const end = k + 1 < starts.length ? starts[k + 1] : durationFor(timing);
        const dur = end + FADE - from;
        // cue(word, frac, exact): frame of a spoken word. Reveals are capped at 40% of the scene so the screen is never empty for long;
        // exact=true (state changes like dimAt/revealAt) keeps the true word time.
        const cue = (word, frac, exact = false) => {
          const fallback = Math.round(FADE + (dur - FADE * 2) * (frac ?? 0.2));
          let at = fallback;
          if (word) {
            const n = norm(word);
            const hit = st.words.find((w) => norm(w.w).includes(n) || (n.length > 3 && n.includes(norm(w.w)) && norm(w.w).length > 3));
            if (hit) at = Math.round(hit.s * FPS) - from;
          }
          const capped = exact ? at : Math.min(at, Math.round(FADE + (dur - FADE * 2) * Math.max(0.4, frac ?? 0)));
          return k === 0 && spec.hookText ? Math.max(capped, HOOK_FRAMES - from) : capped;
        };
        return (
          <Sequence key={k} from={from} durationInFrames={dur} name={`${k}:${scene.type}`}>
            <SceneWrap dur={dur} first={k === 0} last={k === spec.scenes.length - 1}>
              <Comp scene={scene} cue={cue} dur={dur} />
            </SceneWrap>
          </Sequence>
        );
      })}
      <BrainyLayer spec={spec} timing={timing} />
      <HookOpening text={spec.hookText} hero={spec.scenes[0]?.items?.[0]?.emoji} badges={Math.min(spec.scenes[0]?.items?.length || 1, 3)} />
      <Captions timing={timing} hideUntil={spec.hookText ? HOOK_FRAMES + 4 : 0} />
      <Audio src={staticFile(`jobs/${jobId}/voice.mp3`)} />
      {spec.hookText && <Audio src={staticFile('sfx/boom.wav')} volume={0.32} />}
      {starts.slice(1).map((s, i) => (
        <Sequence key={`w${i}`} from={Math.max(0, s - 6)} durationInFrames={20} layout="none"><Audio src={staticFile('sfx/whoosh.wav')} volume={0.26} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
