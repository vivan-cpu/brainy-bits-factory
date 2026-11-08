// QA agent: hard checks on the spec before rendering and on the MP4 after rendering.
import fs from 'node:fs';
import {tool} from './media.mjs';

const TYPES = new Set(['hook', 'trio', 'compare', 'stat', 'orbit', 'journey', 'outro']);

export function checkSpec(spec, emojiSet) {
  const problems = [];
  const sc = spec.scenes || [];
  if (sc.length < 4 || sc.length > 8) problems.push(`scene count ${sc.length}`);
  if (sc[0]?.type !== 'hook') problems.push('first scene is not a hook');
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

export function checkVideo(file) {
  const problems = [];
  if (!fs.existsSync(file)) return ['video file missing'];
  const size = fs.statSync(file).size;
  if (size < 400 * 1024) problems.push(`file too small (${size} bytes)`);
  const probe = tool('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file]);
  const info = JSON.parse(probe.out);
  const dur = parseFloat(info.format?.duration || '0');
  if (dur < 15 || dur > 59) problems.push(`duration ${dur.toFixed(1)}s outside 15-59s`);
  const v = info.streams?.find((s) => s.codec_type === 'video');
  if (!v || v.width !== 1080 || v.height !== 1920) problems.push('video is not 1080x1920');
  if (!info.streams?.some((s) => s.codec_type === 'audio')) problems.push('no audio track');
  const vol = tool('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], {allowFail: true});
  const mean = parseFloat((vol.err.match(/mean_volume:\s*(-?[\d.]+)/) || [])[1]);
  if (!(mean > -40)) problems.push(`audio too quiet (mean ${mean} dB)`);
  const blk = tool('ffmpeg', ['-hide_banner', '-i', file, '-vf', 'blackdetect=d=0.4:pix_th=0.06', '-an', '-f', 'null', '-'], {allowFail: true});
  if (/black_start/.test(blk.err)) problems.push('black frames detected');
  return {problems, duration: dur, meanVolume: mean};
}
