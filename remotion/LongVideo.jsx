import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate, spring} from 'remotion';
import {World} from './Worlds.jsx';
import {Brainy} from './Brainy.jsx';
import {SCENES, FPS, FADE, Emoji, pop} from './Scenes.jsx';
import {Captions, SceneWrap, makeCue, durationFor, fontFor, HOOK_FRAMES, Music, SubscribeNudge} from './Video.jsx';

// 16:9 long video. The Shorts scenes are reused as they are: their content zone (y 160..1110 of a 1080x1920 stage)
// sits on the right, with Brainy and the captions on the left.
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const STAGE_LEFT = 800;
const STAGE_TOP = -110;

// the Worlds are drawn for a 1080-wide canvas, so scale one up to cover 1920x1080
const WideWorld = ({world, sceneStarts}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 607.5, overflow: 'hidden', transform: `scale(${16 / 9})`, transformOrigin: '0 0'}}>
    <World world={world} sceneStarts={sceneStarts} wide />
  </div>
);

// the subject fills the right side from the first frame and stays moving through the whole hook
const LongHook = ({scene, dur}) => {
  const f = useCurrentFrame();
  const hero = scene.items?.[0]?.emoji;
  const punch = interpolate(spring({frame: f, fps: FPS, config: {damping: 10, stiffness: 200, mass: 0.6}}), [0, 1], [1.2, 1]);
  const push = interpolate(f, [0, dur], [1, 1.1], clamp);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 540 - 800, top: 650 - 800, width: 1600, height: 1600, borderRadius: '50%', rotate: `${f * 1.2}deg`,
        background: 'repeating-conic-gradient(rgba(255,255,255,.15) 0deg 9deg, rgba(255,255,255,0) 9deg 24deg)',
        maskImage: 'radial-gradient(circle, #000 18%, transparent 68%)', WebkitMaskImage: 'radial-gradient(circle, #000 18%, transparent 68%)'}} />
      {hero && (
        <div style={{position: 'absolute', left: 540 - 340, top: 650 - 340, width: 680, height: 680, scale: punch * push,
          translate: `0px ${Math.sin(f / 7) * 16}px`, rotate: `${Math.sin(f / 5) * 5}deg`}}>
          <Emoji name={hero} size={680} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// announces each fact with its number, picture and name
const Chapter = ({scene}) => {
  const f = useCurrentFrame();
  const num = pop(f, 2);
  const pic = pop(f, 6);
  const name = pop(f, 11);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 215, width: '100%', textAlign: 'center', fontWeight: 800, fontSize: 112, color: '#ffd54a', letterSpacing: -2,
        textShadow: '0 10px 36px rgba(0,0,0,.5)', opacity: interpolate(num, [0, 0.4], [0, 1], clamp), scale: interpolate(num, [0, 1], [0.6, 1])}}>FACT {scene.number}</div>
      <Emoji name={scene.emoji} size={420} style={{left: 330, top: 365, opacity: interpolate(pic, [0, 0.4], [0, 1], clamp), scale: interpolate(pic, [0, 1], [0.5, 1]), translate: `0px ${Math.sin(f / 18) * 10}px`}} />
      <div style={{position: 'absolute', top: 815, left: 50, right: 50, textAlign: 'center', fontWeight: 800, fontSize: 80, lineHeight: 1.08, color: '#fff',
        textShadow: '0 8px 30px rgba(0,0,0,.55)', opacity: interpolate(name, [0, 0.4], [0, 1], clamp), translate: `0px ${interpolate(name, [0, 1], [40, 0])}px`}}>{scene.title}</div>
    </AbsoluteFill>
  );
};

const LONG_SCENES = {...SCENES, hook: LongHook, chapter: Chapter};

const OpeningTitle = ({text}) => {
  const f = useCurrentFrame();
  if (!text || f > HOOK_FRAMES + 8) return null;
  const p = spring({frame: f, fps: FPS, config: {damping: 9, stiffness: 220, mass: 0.7}});
  const words = String(text).toUpperCase().split(/\s+/);
  return (
    <div style={{position: 'absolute', left: 60, width: 720, top: 300, height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 800,
      fontSize: words.join(' ').length > 18 ? 104 : 128, lineHeight: 1.04, letterSpacing: -2, color: '#fff', textShadow: '0 12px 40px rgba(0,0,0,.6)',
      opacity: interpolate(f, [HOOK_FRAMES - 6, HOOK_FRAMES + 2], [1, 0], clamp), scale: interpolate(p, [0, 1], [1.2, 1])}}>
      <div>{words.map((w, i) => <span key={i} style={{color: i === words.length - 1 ? '#ffd54a' : '#fff', marginRight: 20, display: 'inline-block'}}>{w}</span>)}</div>
    </div>
  );
};

const BrainyPanel = ({spec, timing}) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const k = Math.max(0, timing.scenes.findLastIndex((s) => t >= s.start - 0.25));
  const talk = timing.amp?.length ? timing.amp[Math.min(f, timing.amp.length - 1)] || 0 : 0;
  const intro = spring({frame: f - (HOOK_FRAMES - 2), fps: FPS, config: {damping: 14}});
  return <Brainy size={430} talk={talk} emotion={spec.scenes[k]?.mood === 'wow' ? 'wow' : 'happy'}
    style={{left: 190, top: 190, scale: interpolate(intro, [0, 1], [0.6, 1]), opacity: interpolate(intro, [0, 0.4], [0, 1], clamp),
      translate: `0px ${Math.sin(f / 18) * 10}px`, rotate: `${Math.sin(f / 30) * 3}deg`}} />;
};

// "FACT 3 OF 6" in the corner, so viewers can see how much is left
const Progress = ({spec, timing}) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const chapters = spec.scenes.map((s, k) => ({s, k})).filter((c) => c.s.type === 'chapter');
  const now = chapters.filter((c) => t >= timing.scenes[c.k].start);
  if (!now.length) return null;
  return (
    <div style={{position: 'absolute', left: 60, top: 56, display: 'flex', gap: 12, alignItems: 'center'}}>
      <div style={{color: '#fff', fontWeight: 800, fontSize: 40, marginRight: 8}}>FACT {now.length} OF {chapters.length}</div>
      {chapters.map((c, i) => <div key={i} style={{width: 26, height: 12, borderRadius: 6, background: i < now.length ? '#ffd54a' : 'rgba(255,255,255,.25)'}} />)}
    </div>
  );
};

export const LongVideo = ({jobId, spec, timing}) => {
  const starts = timing.scenes.map((s) => Math.round(s.start * FPS));
  return (
    <AbsoluteFill style={{fontFamily: fontFor(spec), background: '#04223f', overflow: 'hidden'}}>
      <WideWorld world={spec.world} sceneStarts={starts} />
      <div style={{position: 'absolute', left: STAGE_LEFT, top: STAGE_TOP, width: 1080, height: 1920,
        maskImage: 'linear-gradient(90deg, transparent 0, #000 70px)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 70px)'}}>
        {spec.scenes.map((scene, k) => {
          const Comp = LONG_SCENES[scene.type];
          if (!Comp) return null;
          const st = timing.scenes[k];
          const from = Math.max(0, starts[k] - FADE);
          const end = k + 1 < starts.length ? starts[k + 1] : durationFor(timing);
          const dur = end + FADE - from;
          return (
            <Sequence key={k} from={from} durationInFrames={dur} name={`${k}:${scene.type}`}>
              <SceneWrap dur={dur} first={k === 0} last={k === spec.scenes.length - 1}>
                <Comp scene={scene} cue={makeCue({st, dur, from, minFrame: null})} dur={dur} />
              </SceneWrap>
            </Sequence>
          );
        })}
      </div>
      <BrainyPanel spec={spec} timing={timing} />
      <OpeningTitle text={spec.hookText} />
      <Progress spec={spec} timing={timing} />
      <Captions timing={timing} hideUntil={HOOK_FRAMES + 4} box={{left: 60, width: 720, top: 680, height: 300, fontSize: 66}} />
      <SubscribeNudge timing={timing} box={{left: 40, width: 1000, top: 900, height: 150}} name={spec.lang === 'hi' ? 'Brainyvoo Hindi' : 'Brainyvoo'} />
      <Music total={durationFor(timing)} volume={0.1} />
      <Audio src={staticFile(`jobs/${jobId}/voice.mp3`)} />
      <Audio src={staticFile('sfx/boom.wav')} volume={0.32} />
      {starts.slice(1).map((s, i) => (
        <Sequence key={`w${i}`} from={Math.max(0, s - 6)} durationInFrames={20} layout="none"><Audio src={staticFile('sfx/whoosh.wav')} volume={0.2} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
