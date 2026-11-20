// Brainyvoo factory orchestrator.
// node factory/run.mjs [--count 5] [--topic "why flamingos are pink"] [--skip-factcheck]
import fs from 'node:fs';
import path from 'node:path';
import {askJSON} from './gemini.mjs';
import {CATEGORIES, CATEGORIES_HI, STORY_CATEGORIES, STORY_CATEGORIES_HI, OUTRO, OUTRO_NEXT, seriesPlanPrompt, scriptPrompt, longPrompt, factCheckPrompt, withLanguage} from './prompts.mjs';
import {checkSpec, checkLongSpec, checkVideo, collectEmojis} from './qa.mjs';
import {duration, tool, run, npx, pcmMono} from './media.mjs';
import {findPhoto} from './photo.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; };
const COUNT = parseInt(arg('count', '1'), 10);
const TOPIC = arg('topic', '');
const SPEC_FILE = arg('spec', ''); // test: re-make a video from an existing spec.json (skips writing and fact-checking)
const SKIP_FC = process.argv.includes('--skip-factcheck');
const LONG = process.argv.includes('--long'); // 16:9 video of about 3-4 minutes instead of a Short
const STORY_ONLY = process.argv.includes('--story'); // every Short in this run is a true story (for testing)
const LANG = arg('lang', 'en'); // 'hi' = Hindi channel: Hindi script, voices, font and its own topic history
const PY = process.env.PYTHON || (process.platform === 'win32' ? 'py' : 'python3');
const PY_ARGS = process.env.PYTHON ? [] : (process.platform === 'win32' ? ['-3'] : []);

const emojiNames = fs.readFileSync(path.join(ROOT, 'data/emoji-names.txt'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const emojiSet = new Set(emojiNames);
const historyFile = path.join(ROOT, LANG === 'en' ? 'data/history.json' : `data/history-${LANG}.json`);
if (!fs.existsSync(historyFile)) fs.writeFileSync(historyFile, '[]');
const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

// Deleted private videos waiting to be remade in the current style: these go ahead of newly picked topics
const refurbFile = path.join(ROOT, 'data/refurbish.json');
const refurb = fs.existsSync(refurbFile) ? JSON.parse(fs.readFileSync(refurbFile, 'utf8')) : {videos: []};
const refurbQueue = refurb.videos.filter((v) => !v.made);
const refurbTopic = (v) => `${v.title}. What the earlier version covered: ${v.description.replace(/#\w+/g, '').trim()}${v.duplicateOfPublic ? ` A public video titled "${v.title}" already exists, so take a fresh angle and use a different title.` : ''}`;

// Learning loop: read the channel's public feed (latest 15 videos with view counts) and tell the script writer
// which recent videos people watched most and least, so topics and titles drift toward what works.
const CHANNEL_ID = process.env.YT_CHANNEL_ID || 'UCEKBQxcGl0NTb2zot5bxu1A';
async function channelInsights() {
  if (LANG !== 'en' && !process.env.YT_CHANNEL_ID) return ''; // the Hindi channel needs its own YT_CHANNEL_ID
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const now = Date.now();
      const vids = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
        title: (e.match(/<title>([^<]+)/) || [])[1],
        views: +((e.match(/views="(\d+)"/) || [])[1] || 0),
        hours: (now - Date.parse((e.match(/<published>([^<]+)/) || [])[1])) / 3600000,
      })).filter((v) => v.title && v.hours > 20); // a video needs about a day before its views mean anything
      if (vids.length < 6) return '';
      vids.sort((a, b) => b.views - a.views);
      const line = (v) => `"${v.title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')}" (${v.views} views)`;
      return `Most watched recently: ${vids.slice(0, 4).map(line).join('; ')}. Least watched: ${vids.slice(-3).map(line).join('; ')}.`;
    } catch (e) { await new Promise((r) => setTimeout(r, 3000)); }
  }
  return '';
}
const insights = await channelInsights();
if (insights) log(`channel insights: ${insights}`);

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
    [...(s.items || []), ...(s.bars || []), ...(s.steps || [])].forEach((it) => (it.emoji = repairEmoji(it.emoji)));
    ['emoji', 'center', 'around', 'actor', 'flyer'].forEach((k) => { if (s[k]) s[k] = repairEmoji(s[k]); });
    if (s.props) s.props = s.props.map(repairEmoji);
    if (s.left) s.left.emoji = repairEmoji(s.left.emoji);
    if (s.right) s.right.emoji = repairEmoji(s.right.emoji);
  }
  // a subscribe ask written as its own tiny scene stalls the video: fold it into the end of the scene before it
  if (!LONG) {
    const k = spec.scenes.findIndex((s, i) => i >= 2 && i < spec.scenes.length - 1 && /subscri|सब्सक्राइब/i.test(s.narration || '') && String(s.narration).split(/\s+/).length < 11);
    if (k > 0 && spec.scenes.length > 5) {
      spec.scenes[k - 1].narration = `${String(spec.scenes[k - 1].narration).trim()} ${String(spec.scenes[k].narration).trim()}`;
      spec.scenes.splice(k, 1);
    }
  }
  const last = spec.scenes[spec.scenes.length - 1];
  if (last?.type === 'outro' && !(spec.nextTease && String(last.narration || '').includes(spec.nextTease))) last.narration = OUTRO[LANG] || OUTRO.en;
  spec.lang = LANG;
  spec.opening = history.length % 2 ? 'slam' : 'hero'; // two opening styles alternate, so their "stayed to watch" numbers can be compared
  if (!spec.hookText) spec.hookText = String(spec.title || '').split(/\s+/).slice(0, 4).join(' ');
  spec.hookText = String(spec.hookText).replace(/[^\p{L}\p{M}\p{N}\s?!'%.,-]/gu, '').trim().split(/\s+/).slice(0, LONG ? 5 : 6).join(' ');
  if (!['ocean', 'space', 'body', 'lab', 'sky', 'forest'].includes(spec.world)) spec.world = 'lab';
  return spec;
}

async function writeScript(category, topic, story = false, series = null, kidOpens = false) {
  const used = topic && !series ? [] : history.map((h) => h.topic); // a requested topic may already be in the history (remakes)
  let feedback = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    const {model, json} = await askJSON(withLanguage((LONG ? longPrompt : scriptPrompt)({category, topic, used, emojiNames, feedback, story, insights, series, kidOpens}), LANG));
    const spec = repairSpec(json);
    if (story) spec.story = true;
    if (series) {
      spec.series = {n: series.n, total: series.total, theme: series.theme};
      const outro = spec.scenes[spec.scenes.length - 1];
      const tease = String(json.nextTease || '').trim();
      if (series.next && outro?.type === 'outro') {
        outro.narration = `${tease || (LANG === 'hi' ? 'इससे जुड़ा अगला फैक्ट और भी हैरान कर देगा, वो अगले वीडियो में!' : 'The next fact in this chain is even crazier. That\'s the next fact!')} ${OUTRO_NEXT[LANG] || OUTRO_NEXT.en}`;
        spec.nextTease = tease || undefined;
      }
    }
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

// Hindi: native voice only (19 Nov 2026). The American Brian voice speaking Hindi sounds foreign and robotic to Indian viewers.
const VOICES_HI = [
  {BRAINY_VOICE: 'hi-IN-MadhurNeural', BRAINY_RATE: '+8%', BRAINY_PITCH: '-6Hz', KOKORO_VOICE: 'hm_omega', KOKORO_LANG: 'hi'},
];

function buildVoice(spec, id) {
  const jobDir = path.join(ROOT, 'jobs', id);
  const pool = LANG === 'hi' ? VOICES_HI : VOICES;
  const voice0 = pool[history.length % pool.length];
  log(`  narrator: ${voice0.BRAINY_VOICE}`);
  run(PY, [...PY_ARGS, path.join(ROOT, 'factory/tts.py'), path.join(jobDir, 'spec.json'), jobDir], {env: {...process.env, ...voice0, BRAINY_LANG: LANG}});
  const voice = JSON.parse(fs.readFileSync(path.join(jobDir, 'words.json'), 'utf8'));
  if (voice.single) return singleTake(voice, jobDir, id);
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
  return {total: t - GAP, scenes, amp: loudness(path.join(pubDir, 'voice.mp3')), engine: voice.engine || 'edge'};
}

// 19 Nov 2026: the whole video is one recording (tts.py), so there are no dead gaps between scenes and the tone flows.
// Each scene starts just before its first word; Brainy's mouth stays shut while the kid is talking.
function singleTake(voice, jobDir, id) {
  log(`  voice engine: ${voice.engine} (one take)`);
  const pubDir = path.join(ROOT, 'public/jobs', id);
  fs.mkdirSync(pubDir, {recursive: true});
  const mp3 = path.join(pubDir, 'voice.mp3');
  tool('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', path.join(jobDir, voice.file), '-ar', '44100', '-b:a', '160k', mp3]);
  const total = duration(mp3);
  const firsts = voice.scenes.map((ws) => (ws.length ? ws[0].s : null));
  const starts = [];
  for (let k = 0; k < firsts.length; k++) {
    let st = k === 0 ? 0 : (firsts[k] ?? starts[k - 1] + 0.5) - 0.12;
    if (k > 0) st = Math.max(st, starts[k - 1] + 0.4); // every scene stays on screen for a moment
    starts.push(+st.toFixed(3));
  }
  const scenes = voice.scenes.map((ws, k) => ({start: starts[k], end: k + 1 < starts.length ? starts[k + 1] : total, words: ws}));
  const amp = loudness(mp3);
  for (const w of scenes.flatMap((sc) => sc.words)) {
    if (!w.kid) continue;
    for (let f = Math.floor(w.s * 30); f <= Math.ceil(w.e * 30) && f < amp.length; f++) amp[f] = 0;
  }
  return {total, scenes, amp, engine: voice.engine};
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

async function makeOne(i, seriesPlan = null) {
  const day = Math.floor(Date.now() / 86400000);
  const cats = LANG === 'hi' ? CATEGORIES_HI : CATEGORIES;
  const category = cats[(day * 5 + i + (LONG ? 7 : 0)) % cats.length];
  const id = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12) + (LONG ? '-long' : `-${i + 1}`);
  // in a daily run of 3+, the last Short is a true story; the others are facts (remakes of deleted videos go first)
  const story = !LONG && !(i === 0 && TOPIC) && (STORY_ONLY || (COUNT >= 3 && i === COUNT - 1));
  const remake = LANG === 'en' && !LONG && !story && !(i === 0 && TOPIC) ? refurbQueue.shift() : null;
  const stories = LANG === 'hi' ? STORY_CATEGORIES_HI : STORY_CATEGORIES;
  const storyTheme = stories[(day + i) % stories.length];
  log(`video ${i + 1}/${COUNT}: ${remake ? `remake of "${remake.title}"` : story ? `true story, theme "${storyTheme}"` : `category "${TOPIC || category}"`} (job ${id})`);
  const part = !story && !remake && seriesPlan && i < seriesPlan.facts.length ? i : -1;
  const series = part >= 0 ? {n: part + 1, total: seriesPlan.facts.length, theme: seriesPlan.theme, prev: seriesPlan.facts[part - 1]?.topic, next: seriesPlan.facts[part + 1]?.topic} : null;
  if (series) log(`  series "${series.theme}" fact ${series.n}/${series.total}: ${seriesPlan.facts[part].topic}`);
  const spec = SPEC_FILE ? repairSpec(JSON.parse(fs.readFileSync(SPEC_FILE, 'utf8'))) : await writeScript(remake?.category || (story ? storyTheme : seriesPlan?.category || category), series ? seriesPlan.facts[part].topic : remake ? refurbTopic(remake) : (i === 0 ? TOPIC : ''), story, series, i % 2 === 0);
  fs.mkdirSync(path.join(ROOT, 'jobs', id), {recursive: true});
  if (!LONG && process.env.PHOTO === '1') { // OFF by default since 18 Nov 2026: photo-opening Shorts got 0-17 views vs 80-900 for cartoon openings. PHOTO=1 turns it back on
    const want = spec.photo || {};
    let found = null;
    log(`  photo wanted: ${want.subject || spec.topic} [${(want.queries || []).join(' | ')}]`);
    let timer;
    try { // never let the photo hold up the video: after 3 minutes the cartoon opening is used
      found = await Promise.race([
        findPhoto({subject: want.subject || spec.topic, queries: [...(Array.isArray(want.queries) ? want.queries : []), want.subject].filter(Boolean), dir: path.join(ROOT, 'public/jobs', id), log}),
        new Promise((res) => { timer = setTimeout(() => { log('  photo: took too long, using the cartoon opening'); res(null); }, 180000); }),
      ]);
    }
    catch (e) { log(`  photo skipped: ${e.message}`); }
    finally { clearTimeout(timer); }
    spec.photo = found || undefined;
    if (found) spec.opening = 'photo';
  } else delete spec.photo;
  fs.writeFileSync(path.join(ROOT, 'jobs', id, 'spec.json'), JSON.stringify(spec, null, 1));
  log('  voice…');
  const timing = buildVoice(spec, id);
  for (let attempt = 1; attempt <= 2; attempt++) {
    log(`  render (attempt ${attempt})…`);
    const file = render(spec, timing, id);
    const qa = checkVideo(file, LONG ? {min: 120, max: 360, width: 1920, height: 1080} : undefined);
    if (!qa.problems.length) {
      log(`  QA passed: ${qa.duration.toFixed(1)}s, ${qa.meanVolume} dB`);
      let thumb;
      if (LONG) { // custom thumbnail: the opening frame with the big title and the hero picture
        try {
          thumb = `${id}.jpg`;
          run(npx, ['remotion', 'still', 'remotion/index.jsx', 'BrainyLong', path.join(ROOT, 'out', thumb), `--props=${path.join(ROOT, 'jobs', id, 'props.json')}`, '--frame=22', '--image-format=jpeg', '--jpeg-quality=90', '--log=error'], {cwd: ROOT});
        } catch (e) { thumb = undefined; log(`  thumbnail skipped: ${e.message}`); }
      }
      const meta = {id, file: path.basename(file), long: LONG || undefined, thumb, opening: spec.opening, credit: spec.photo?.credit, title: spec.title, description: spec.description, tags: spec.tags || [], topic: spec.topic,
        category: spec.category, sources: spec.sources || [], duration: qa.duration, emojis: collectEmojis(spec)};
      fs.writeFileSync(path.join(ROOT, 'out', `${id}.json`), JSON.stringify(meta, null, 1));
      history.push({date: new Date().toISOString().slice(0, 10), topic: spec.topic, title: spec.title, category: spec.category, opening: LONG ? undefined : spec.opening, voice: timing.engine, series: spec.series ? `${spec.series.theme} ${spec.series.n}/${spec.series.total}` : undefined, kid: spec.scenes.some((s) => s.ask) || undefined});
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
// Shorts 1-3 of a daily run are one connected chain (a story stays last)
let seriesPlan = null;
if (!LONG && !TOPIC && !SPEC_FILE && !STORY_ONLY && COUNT >= 3 && process.env.SERIES !== '0') {
  const day = Math.floor(Date.now() / 86400000);
  const cats = LANG === 'hi' ? CATEGORIES_HI : CATEGORIES;
  const category = cats[(day * 5) % cats.length];
  try {
    const {json} = await askJSON(seriesPlanPrompt({category, used: history.map((h) => h.topic), lang: LANG}));
    const facts = (json.facts || []).filter((f) => String(f.topic || '').trim()).slice(0, 3);
    if (facts.length === 3) { seriesPlan = {theme: String(json.theme || category), category, facts}; log(`series planned: "${seriesPlan.theme}"`); }
  } catch (e) { log(`  series planning failed, making single Shorts: ${e.message}`); }
}
for (let i = 0; i < COUNT; i++) {
  try { made.push(await makeOne(i, seriesPlan)); }
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
