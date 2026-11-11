// QA agent: hard checks on the spec before rendering and on the MP4 after rendering.
import fs from 'node:fs';
import {tool} from './media.mjs';

const TYPES = new Set(['hook', 'trio', 'compare', 'stat', 'orbit', 'journey', 'outro']);

export function checkSpec(spec, emojiSet) {
  const problems = [];
  const sc = spec.scenes || [];
  if (sc.length < 4 || sc.length > 8) problems.push(`scene count ${sc.length}`);
  if (sc[0]?.type !== 'hook') problems.push('first scene is not a hook');
  if (!sc[0]?.items?.length) problems.push('hook needs at least one item: its first emoji fills the screen in the opening');
  problems.push(...hookProblems(spec));
  if (sc[sc.length - 1]?.type !== 'outro') problems.push('last scene is not an outro');
  sc.forEach((s, i) => {
    if (!TYPES.has(s.type)) problems.push(`scene ${i} has unknown type ${s.type}`);
    if (!s.narration || s.narration.split(/\s+/).length < 3) problems.push(`scene ${i} narration too short`);
  });
  const words = sc.reduce((n, s) => n + (s.narration || '').split(/\s+/).length, 0);
  if (words < 45 || words > 130) problems.push(`narration length ${words} words`);
  if (!spec.title || spec.title.length > 100) problems.push('bad title');
  const middle = new Set(sc.slice(1, -1).map((s) => s.type));
  if (middle.size < 2) problems.push('not enough visual variety');
  const emojis = collectEmojis(spec);
  const missing = emojis.filter((e) => !emojiSet.has(e));
  if (missing.length) problems.push(`unknown emoji after repair: ${missing.join(', ')}`);
  return problems;
}

const NUMBER = /\d|\b(two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand|million|billion|trillion|percent|times)\b/i;

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
  problems.push(...hookProblems(spec));
  sc.forEach((s, i) => {
    if (!types.has(s.type)) problems.push(`scene ${i} has unknown type ${s.type}`);
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
