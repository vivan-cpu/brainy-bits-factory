// QA agent: hard checks on the spec before rendering and on the MP4 after rendering.
import fs from 'node:fs';
import {tool} from './media.mjs';

const TYPES = new Set(['hook', 'trio', 'compare', 'stat', 'orbit', 'journey', 'bars', 'timeline', 'bigword', 'outro']);

// shape checks for the data-driven scene types, so a bad script is rewritten instead of rendering an empty scene
function shapeProblems(s, i) {
  const out = [];
  if (s.type === 'bars') {
    const b = s.bars || [];
    if (b.length < 2 || b.length > 4) out.push(`scene ${i} bars needs 2 to 4 bars`);
    if (b.some((x) => !x.emoji || !x.label || !(Number(x.value) > 0))) out.push(`scene ${i} every bar needs an emoji, a label and a value above 0`);
  }
  if (s.type === 'timeline') {
    const st = s.steps || [];
    if (st.length < 2 || st.length > 4) out.push(`scene ${i} timeline needs 2 to 4 steps`);
    if (st.some((x) => !x.emoji || !x.when || String(x.when).length > 9)) out.push(`scene ${i} every timeline step needs an emoji and a short "when" (max 8 characters)`);
  }
  if (s.type === 'bigword') {
    const w = String(s.text || '').trim().split(/\s+/).filter(Boolean);
    if (!w.length || w.length > 3 || w.some((x) => x.length > 11)) out.push(`scene ${i} bigword text must be 1 to 3 short words`);
  }
  return out;
}

export function checkSpec(spec, emojiSet) {
  const problems = [];
  const sc = spec.scenes || [];
  if (sc.length < 4 || sc.length > 8) problems.push(`scene count ${sc.length}`);
  if (sc[0]?.type !== 'hook') problems.push('first scene is not a hook');
  if (!sc[0]?.items?.length) problems.push('hook needs at least one item: its first emoji fills the screen in the opening');
  problems.push(...claimProblems(spec), ...askProblems(spec));
  if (sc[sc.length - 1]?.type !== 'outro') problems.push('last scene is not an outro');
  sc.forEach((s, i) => {
    if (!TYPES.has(s.type)) problems.push(`scene ${i} has unknown type ${s.type}`);
    problems.push(...shapeProblems(s, i));
    if (!s.narration || s.narration.split(/\s+/).length < 3) problems.push(`scene ${i} narration too short`);
  });
  const words = sc.reduce((n, s) => n + (s.narration || '').split(/\s+/).length, 0);
  if (words < 50 || words > 136) problems.push(`narration length ${words} words`);
  if (!spec.title || spec.title.length > 100) problems.push('bad title');
  const middle = new Set(sc.slice(1, -1).map((s) => s.type));
  if (middle.size < 2) problems.push('not enough visual variety');
  const emojis = collectEmojis(spec);
  const missing = emojis.filter((e) => !emojiSet.has(e));
  if (missing.length) problems.push(`unknown emoji after repair: ${missing.join(', ')}`);
  return problems;
}

const NUMBER = /\d|\b(two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand|million|billion|trillion|percent|times)\b/i;

// one subscribe ask before the payoff (viewers leave right after the answer, so the outro alone reaches few of them)
const SUBSCRIBE = /subscri|सब्सक्राइब/i;
function askProblems(spec) {
  const mid = (spec.scenes || []).slice(1, -1).filter((s) => SUBSCRIBE.test(s.narration || ''));
  if (mid.length !== 1) return [`${mid.length} middle scenes contain a subscribe ask: exactly one is required, right before the answer`];
  // the ask rides on the end of a real story sentence; a scene that is only the ask stalls the video
  return (mid[0].narration || '').split(/\s+/).length < 11 ? ['the subscribe ask must be the LAST sentence of a normal scene that first says something about the topic, not a scene on its own'] : [];
}

// Shorts: the hook states the claim and names the subject (vague teases made 4 out of 5 viewers swipe away)
const VAGUE = /^(did you know|have you ever|in this video|today|hey guys)|\b(secret|mystery|you won'?t believe|something (strange|weird|amazing))\b/i;
const STOP = new Set(['this', 'that', 'than', 'with', 'from', 'have', 'they', 'their', 'your', 'about', 'what', 'when', 'were', 'will', 'into', 'most', 'more', 'ever', 'never', 'does', 'every', 'which', 'there', 'these', 'those', 'actually', 'really', 'just', 'been', 'being', 'make', 'makes', 'made', 'only', 'over', 'very', 'much', 'many', 'some', 'here', 'why', 'how', 'the', 'and', 'are', 'was', 'has', 'can', 'for', 'its', 'you', 'not', 'one', 'who']);
const keywords = (t) => String(t || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP.has(w)).map((w) => w.replace(/(es|s)$/, ''));
function claimProblems(spec) {
  const out = [];
  const hook = String(spec.scenes?.[0]?.narration || '');
  const head = String(spec.hookText || '').trim().split(/\s+/).filter(Boolean);
  if (head.length < 2 || head.length > 6) out.push('hookText must be 3 to 6 words');
  if (head.some((w) => w.length > 13)) out.push('hookText has a word longer than 12 letters: use shorter words');
  if (hook.split(/\s+/).length > 17) out.push('hook narration is too long: one sentence of 6 to 14 words');
  if (VAGUE.test(hook) || VAGUE.test(spec.hookText || '')) out.push('the hook is a vague tease: state the surprising claim itself and name the subject');
  if (spec.lang !== 'hi') { // the headline and the first sentence must both be about the subject named in the title
    const subject = new Set([...keywords(spec.title), ...keywords(spec.topic)]);
    if (!keywords(spec.hookText).some((w) => subject.has(w))) out.push('hookText does not name the subject of the video (it shares no word with the title or topic)');
    if (!keywords(hook).some((w) => subject.has(w))) out.push('the hook sentence does not name the subject of the video');
    const named = keywords(spec.photo?.subject);
    if (named.length && !named.some((w) => keywords(spec.title).includes(w))) out.push(`the title does not name the subject: it must contain "${named.join('" or "')}" instead of a vague word like "this animal"`);
  }
  return out;
}

function hookProblems(spec) {
  const hook = spec.scenes?.[0];
  const problems = [];
  if (NUMBER.test(spec.hookText || '')) problems.push('hookText gives away a number: it must tease without numbers');
  if (NUMBER.test(hook?.narration || '')) problems.push('hook narration gives away a number: it must tease and save the answer for later');
  return problems;
}

export function checkLongSpec(spec, emojiSet) {
  const problems = [];
  const sc = spec.scenes || [];
  const types = new Set([...TYPES, 'chapter']);
  if (sc.length < 20 || sc.length > 50) problems.push(`scene count ${sc.length}, need 20 to 50`);
  if (sc[0]?.type !== 'hook') problems.push('first scene is not a hook');
  if (!sc[0]?.items?.length) problems.push('hook needs at least one item: its first emoji fills the screen in the opening');
  if (sc[sc.length - 1]?.type !== 'outro') problems.push('last scene is not an outro');
  problems.push(...hookProblems(spec), ...askProblems(spec));
  sc.forEach((s, i) => {
    if (!types.has(s.type)) problems.push(`scene ${i} has unknown type ${s.type}`);
    problems.push(...shapeProblems(s, i));
    if (!s.narration || s.narration.split(/\s+/).length < 3) problems.push(`scene ${i} narration too short`);
  });
  const chapters = sc.filter((s) => s.type === 'chapter');
  if (chapters.length < 5 || chapters.length > 8) problems.push(`${chapters.length} chapter scenes, need 5 to 8`);
  chapters.forEach((c, i) => {
    if (Number(c.number) !== i + 1) problems.push(`chapter ${i + 1} is numbered ${c.number}`);
    if (!c.title || !c.emoji) problems.push(`chapter ${i + 1} needs a title and an emoji`);
  });
  const words = sc.reduce((n, s) => n + (s.narration || '').split(/\s+/).length, 0);
  if (words < 400 || words > 760) problems.push(`narration length ${words} words, need 420 to 700`);
  if (!spec.title || spec.title.length > 100) problems.push('bad title');
  const missing = collectEmojis(spec).filter((e) => !emojiSet.has(e));
  if (missing.length) problems.push(`unknown emoji after repair: ${missing.join(', ')}`);
  return problems;
}

export function collectEmojis(spec) {
  const out = [];
  for (const s of spec.scenes || []) {
    (s.items || []).forEach((it) => out.push(it.emoji));
    (s.bars || []).forEach((it) => out.push(it.emoji));
    (s.steps || []).forEach((it) => out.push(it.emoji));
    ['emoji', 'center', 'around', 'actor', 'flyer'].forEach((k) => s[k] && out.push(s[k]));
    (s.props || []).forEach((p) => out.push(p));
    s.left?.emoji && out.push(s.left.emoji);
    s.right?.emoji && out.push(s.right.emoji);
  }
  return out;
}

export function checkVideo(file, {min = 15, max = 59, width = 1080, height = 1920} = {}) {
  const problems = [];
  if (!fs.existsSync(file)) return ['video file missing'];
  const size = fs.statSync(file).size;
  if (size < 400 * 1024) problems.push(`file too small (${size} bytes)`);
  const probe = tool('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file]);
  const info = JSON.parse(probe.out);
  const dur = parseFloat(info.format?.duration || '0');
  if (dur < min || dur > max) problems.push(`duration ${dur.toFixed(1)}s outside ${min}-${max}s`);
  const v = info.streams?.find((s) => s.codec_type === 'video');
  if (!v || v.width !== width || v.height !== height) problems.push(`video is not ${width}x${height}`);
  if (!info.streams?.some((s) => s.codec_type === 'audio')) problems.push('no audio track');
  const vol = tool('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], {allowFail: true});
  const mean = parseFloat((vol.err.match(/mean_volume:\s*(-?[\d.]+)/) || [])[1]);
  if (!(mean > -40)) problems.push(`audio too quiet (mean ${mean} dB)`);
  const blk = tool('ffmpeg', ['-hide_banner', '-i', file, '-vf', 'blackdetect=d=0.4:pix_th=0.06', '-an', '-f', 'null', '-'], {allowFail: true});
  if (/black_start/.test(blk.err)) problems.push('black frames detected');
  return {problems, duration: dur, meanVolume: mean};
}
