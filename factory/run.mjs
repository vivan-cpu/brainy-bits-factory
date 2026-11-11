// Brainy Bits factory orchestrator.
// node factory/run.mjs [--count 5] [--topic "why flamingos are pink"] [--skip-factcheck]
import fs from 'node:fs';
import path from 'node:path';
import {askJSON} from './gemini.mjs';
import {CATEGORIES, STORY_CATEGORIES, scriptPrompt, longPrompt, factCheckPrompt} from './prompts.mjs';
import {checkSpec, checkLongSpec, checkVideo, collectEmojis} from './qa.mjs';
import {duration, tool, run, npx, pcmMono} from './media.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; };
const COUNT = parseInt(arg('count', '1'), 10);
const TOPIC = arg('topic', '');
const SKIP_FC = process.argv.includes('--skip-factcheck');
const LONG = process.argv.includes('--long'); // 16:9 video of about 3-4 minutes instead of a Short
const STORY_ONLY = process.argv.includes('--story'); // every Short in this run is a true story (for testing)
const PY = process.env.PYTHON || (process.platform === 'win32' ? 'py' : 'python3');
const PY_ARGS = process.env.PYTHON ? [] : (process.platform === 'win32' ? ['-3'] : []);

const emojiNames = fs.readFileSync(path.join(ROOT, 'data/emoji-names.txt'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const emojiSet = new Set(emojiNames);
const historyFile = path.join(ROOT, 'data/history.json');
const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

// Deleted private videos waiting to be remade in the current style: these go ahead of newly picked topics
const refurbFile = path.join(ROOT, 'data/refurbish.json');
const refurb = fs.existsSync(refurbFile) ? JSON.parse(fs.readFileSync(refurbFile, 'utf8')) : {videos: []};
const refurbQueue = refurb.videos.filter((v) => !v.made);
const refurbTopic = (v) => `${v.title}. What the earlier version covered: ${v.description.replace(/#\w+/g, '').trim()}${v.duplicateOfPublic ? ` A public video titled "${v.title}" already exists, so take a fresh angle and use a different title.` : ''}`;

// map an unknown emoji to the closest allowed one (shared words), else a safe default
function repairEmoji(name) {
  if (!name) return 'sparkles';
  const n = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (emojiSet.has(n)) return n;
  const parts = n.split('_').filter((p) => p.length > 2);
  let best = null, score = 0;
  for (const e of emojiNames) {
    const s = parts.filter((p) => e.split('_').includes(p)).length;
    if (s > score || (s === score && s > 0 && e.length < best.length)) { best = e; score = s; }
  }
  return best || 'sparkles';
}

function repairSpec(spec) {
  for (const s of spec.scenes) {
    (s.items || []).forEach((it) => (it.emoji = repairEmoji(it.emoji)));
    ['emoji', 'center', 'around', 'actor', 'flyer'].forEach((k) => { if (s[k]) s[k] = repairEmoji(s[k]); });
    if (s.props) s.props = s.props.map(repairEmoji);
    if (s.left) s.left.emoji = repairEmoji(s.left.emoji);
    if (s.right) s.right.emoji = repairEmoji(s.right.emoji);
  }
  const last = spec.scenes[spec.scenes.length - 1];
  if (last?.type === 'outro') last.narration = 'Like, share and subscribe to Brainy Bits for more weird facts!';
  if (!spec.hookText) spec.hookText = String(spec.title || '').split(/\s+/).slice(0, 4).join(' ');
  spec.hookText = String(spec.hookText).replace(/[^\p{L}\p{N}\s?!'%-]/gu, '').split(/\s+/).slice(0, 5).join(' ');
  if (!['ocean', 'space', 'body', 'lab', 'sky', 'forest'].includes(spec.world)) spec.world = 'lab';
  return spec;
}

async function writeScript(category, topic, story = false) {
  const used = topic ? [] : history.map((h) => h.topic); // a requested topic may already be in the history (remakes)
  let feedback = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    const {model, json} = await askJSON((LONG ? longPrompt : scriptPrompt)({category, topic, used, emojiNames, feedback, story}));
    const spec = repairSpec(json);
    const problems = (LONG ? checkLongSpec : checkSpec)(spec, emojiSet);
    if (problems.length) { feedback = problems.join('; '); log(`  script attempt ${attempt} (${model}) failed checks: ${feedback}`); continue; }
    if (SKIP_FC) return spec;
    const {json: fc} = await askJSON(factCheckPrompt(spec), {temperature: 0.1});
    if (fc.ok && (fc.confidence ?? 1) >= 0.7) { log(`  fact-check passed (${model}) — "${spec.title}"`); return spec; }
    feedback = (fc.problems || []).join(' ') || 'fact check failed';
    log(`  fact-check rejected attempt ${attempt}: ${feedback}`);
  }
  throw new Error('could not produce a script that passes checks');
}

// Vivan's picks: alternate Guy (energetic) and Brian (heavy) video by video; Kokoro fallbacks alternate too
const VOICES = [
  {BRAINY_VOICE: 'en-US-GuyNeural', BRAINY_RATE: '+10%', BRAINY_PITCH: '-2Hz', KOKORO_VOICE: 'am_fenrir'},
  {BRAINY_VOICE: 'en-US-BrianMultilingualNeural', BRAINY_RATE: '+8%', BRAINY_PITCH: '-4Hz', KOKORO_VOICE: 'am_onyx'},
];

function buildVoice(spec, id) {
  const jobDir = path.join(ROOT, 'jobs', id);
  const voice0 = VOICES[history.length % VOICES.length];
  log(`  narrator: ${voice0.BRAINY_VOICE}`);
  run(PY, [...PY_ARGS, path.join(ROOT, 'factory/tts.py'), path.join(jobDir, 'spec.json'), jobDir], {env: {...process.env, ...voice0}});
  const voice = JSON.parse(fs.readFileSync(path.join(jobDir, 'words.json'), 'utf8'));
  const words = voice.scenes;
  const files = voice.files || words.map((_, k) => `scene_${k}.mp3`);
  log(`  voice engine: ${voice.engine || 'edge'}`);
  const GAP = 0.22;
  let t = 0;
  const scenes = words.map((ws, k) => {
    const d = duration(path.join(jobDir, files[k]));
    const sc = {start: t, end: t + d, words: ws.map((w) => ({w: w.w, s: +(w.s + t).toFixed(3), e: +(w.e + t).toFixed(3)}))};
    t += d + GAP;
    return sc;
  });
  const pubDir = path.join(ROOT, 'public/jobs', id);
  fs.mkdirSync(pubDir, {recursive: true});
  const inputs = files.flatMap((f) => ['-i', path.join(jobDir, f)]);
  const pads = words.map((_, k) => `[${k}:a]apad=pad_dur=${GAP}[a${k}]`).join(';');
  const cat = words.map((_, k) => `[a${k}]`).join('') + `concat=n=${words.length}:v=0:a=1[out]`;
  tool('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...inputs, '-filter_complex', `${pads};${cat}`, '-map', '[out]', '-ar', '44100', '-b:a', '160k', path.join(pubDir, 'voice.mp3')]);
  return {total: t - GAP, scenes, amp: loudness(path.join(pubDir, 'voice.mp3'))};
}

// Per-frame (30 fps) loudness of the voice, 0..1, used to drive Brainy's mouth so lip-sync matches the real audio
function loudness(file) {
  const SR = 9000, FR = 30, per = SR / FR; // 300 samples per frame (must be an integer)
  const pcm = pcmMono(file, SR);
  const n = Math.floor(pcm.length / 2 / per);
  const rms = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < per; j++) { const v = pcm.readInt16LE((i * per + j) * 2) / 32768; s += v * v; }
    rms[i] = Math.sqrt(s / per);
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const ref = sorted[Math.floor(sorted.length * 0.95)] || 1;
  return rms.map((v, i) => {
    const prev = rms[i - 1] ?? v, next = rms[i + 1] ?? v;
    const sm = (prev + 2 * v + next) / 4;
    const x = Math.max(0, Math.min(1, sm / ref));
    return x < 0.12 ? 0 : +x.toFixed(2);
  });
}

function render(spec, timing, id) {
  const propsFile = path.join(ROOT, 'jobs', id, 'props.json');
  fs.writeFileSync(propsFile, JSON.stringify({jobId: id, spec, timing}));
  const outFile = path.join(ROOT, 'out', `${id}.mp4`);
  run(npx, ['remotion', 'render', 'remotion/index.jsx', LONG ? 'BrainyLong' : 'Brainy', outFile, `--props=${propsFile}`, '--log=error', `--concurrency=${process.env.RENDER_CONCURRENCY || '50%'}`], {cwd: ROOT});
  return outFile;
}

async function makeOne(i) {
  const day = Math.floor(Date.now() / 86400000);
  const category = CATEGORIES[(day * 5 + i + (LONG ? 7 : 0)) % CATEGORIES.length];
  const id = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12) + (LONG ? '-long' : `-${i + 1}`);
  // in a daily run of 3+, the last Short is a true story; the others are facts (remakes of deleted videos go first)
  const story = !LONG && !(i === 0 && TOPIC) && (STORY_ONLY || (COUNT >= 3 && i === COUNT - 1));
  const remake = !LONG && !story && !(i === 0 && TOPIC) ? refurbQueue.shift() : null;
  const storyTheme = STORY_CATEGORIES[(day + i) % STORY_CATEGORIES.length];
  log(`video ${i + 1}/${COUNT}: ${remake ? `remake of "${remake.title}"` : story ? `true story, theme "${storyTheme}"` : `category "${TOPIC || category}"`} (job ${id})`);
  const spec = await writeScript(remake?.category || (story ? storyTheme : category), remake ? refurbTopic(remake) : (i === 0 ? TOPIC : ''), story);
  fs.mkdirSync(path.join(ROOT, 'jobs', id), {recursive: true});
  fs.writeFileSync(path.join(ROOT, 'jobs', id, 'spec.json'), JSON.stringify(spec, null, 1));
  log('  voice…');
  const timing = buildVoice(spec, id);
  for (let attempt = 1; attempt <= 2; attempt++) {
    log(`  render (attempt ${attempt})…`);
    const file = render(spec, timing, id);
    const qa = checkVideo(file, LONG ? {min: 120, max: 360, width: 1920, height: 1080} : undefined);
    if (!qa.problems.length) {
      log(`  QA passed: ${qa.duration.toFixed(1)}s, ${qa.meanVolume} dB`);
      const meta = {id, file: path.basename(file), title: spec.title, description: spec.description, tags: spec.tags || [], topic: spec.topic,
        category: spec.category, sources: spec.sources || [], duration: qa.duration, emojis: collectEmojis(spec)};
      fs.writeFileSync(path.join(ROOT, 'out', `${id}.json`), JSON.stringify(meta, null, 1));
      history.push({date: new Date().toISOString().slice(0, 10), topic: spec.topic, title: spec.title, category: spec.category});
      fs.writeFileSync(historyFile, JSON.stringify(history, null, 1));
      if (remake) { remake.made = true; fs.writeFileSync(refurbFile, JSON.stringify(refurb, null, 1)); }
      return meta;
    }
    log(`  QA failed: ${qa.problems.join('; ')}`);
  }
  throw new Error('video failed QA twice');
}

fs.mkdirSync(path.join(ROOT, 'out'), {recursive: true});
const made = [];
for (let i = 0; i < COUNT; i++) {
  try { made.push(await makeOne(i)); }
  catch (e) { log(`  ✗ video ${i + 1} skipped: ${e.message}`); }
}
// the long video runs after the Shorts in the same job, so it adds to their manifest instead of replacing it
const manifestFile = path.join(ROOT, 'out', 'manifest.json');
const earlier = LONG && fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : [];
const all = [...earlier, ...made];
fs.writeFileSync(manifestFile, JSON.stringify(all, null, 1));
const notes = all.map((m, n) => `### ${n + 1}. ${m.title}\n**File:** ${m.file} (${m.duration.toFixed(0)}s)\n\n**Title:**\n\`\`\`\n${m.title}\n\`\`\`\n**Description:**\n\`\`\`\n${m.description}\n\`\`\`\n**Tags:** ${m.tags.join(', ')}\n\n**Sources:** ${m.sources.join('; ')}\n`).join('\n---\n\n');
fs.writeFileSync(path.join(ROOT, 'out', 'release-notes.md'), notes || 'No videos passed QA this run.');
log(`done: ${made.length}/${COUNT} videos`);
if (!made.length) process.exit(1);
