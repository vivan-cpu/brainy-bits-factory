// Upload agent: uploads out/*.mp4 from manifest.json to YouTube via the Data API (resumable upload).
// Needs YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN. YT_PRIVACY=public|unlisted|private.
// YT_SCHEDULE=1 publishes the day's Shorts at fixed hours (publishAt, requires private + an audited API project).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const {YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN} = process.env;
const PRIVACY = process.env.YT_PRIVACY || 'private';
const SCHEDULE = process.env.YT_SCHEDULE === '1';

async function accessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: 'refresh_token'}),
  });
  if (!res.ok) throw new Error(`token refresh failed: HTTP ${res.status}`);
  return (await res.json()).access_token;
}

async function upload(token, meta, publishAt) {
  const file = path.join(ROOT, 'out', meta.file);
  const size = fs.statSync(file).size;
  const description = `${meta.description}\n\nSources: ${(meta.sources || []).join('; ')}${meta.credit ? `\n${meta.credit}` : ''}\n\nSubscribe for new weird facts every day: https://www.youtube.com/@brainyvoo?sub_confirmation=1\nAnimated by Brainyvoo.`.slice(0, 4900);
  const status = {privacyStatus: publishAt ? 'private' : PRIVACY, selfDeclaredMadeForKids: false};
  if (publishAt) status.publishAt = publishAt;
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': 'video/mp4', 'x-upload-content-length': String(size)},
    body: JSON.stringify({snippet: {title: meta.title.slice(0, 100), description, tags: (meta.tags || []).slice(0, 15), categoryId: '27', defaultLanguage: 'en', defaultAudioLanguage: 'en'}, status}),
  });
  if (!init.ok) throw new Error(`upload init failed: HTTP ${init.status} ${(await init.text()).slice(0, 300)}`);
  const put = await fetch(init.headers.get('location'), {method: 'PUT', headers: {'content-type': 'video/mp4', 'content-length': String(size)}, body: fs.readFileSync(file)});
  if (!put.ok) throw new Error(`upload failed: HTTP ${put.status} ${(await put.text()).slice(0, 300)}`);
  return (await put.json()).id;
}

// custom thumbnail for long videos; needs a phone-verified channel, so a refusal is not an error
async function setThumbnail(token, videoId, file) {
  const res = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`, {
    method: 'POST', headers: {authorization: `Bearer ${token}`, 'content-type': 'image/jpeg'}, body: fs.readFileSync(file)});
  console.log(res.ok ? '  thumbnail set' : `  thumbnail not set: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'out/manifest.json'), 'utf8'));
const token = await accessToken();
// Publish hours in UTC. YouTube first shows a Short to people who are awake when it goes live: the old morning-UTC slots
// reached mostly Asia (India, Indonesia, the Philippines), where many viewers swipe away from English narration. These slots are
// daytime and evening in the US and UK (10:00, 13:00, 16:00, 19:00 New York); the first one is also 20:30 in India. Long videos go out at 22:30 UTC. YT_SLOTS overrides the Shorts hours.
const SLOTS = (process.env.YT_SLOTS || '15,18,21,24').split(',').map(Number);
const LONG_SLOT = 22.5;
const now = Date.now();
const day0 = new Date(); day0.setUTCHours(0, 0, 0, 0);
const soon = new Date(now); soon.setUTCMinutes(0, 0, 0); soon.setUTCHours(soon.getUTCHours() + 1);
let short = 0, late = 0;
function publishTime(m) {
  if (!SCHEDULE) return null;
  const hour = m.long ? LONG_SLOT : SLOTS[short++] ?? SLOTS[SLOTS.length - 1] + 3 * (short - SLOTS.length);
  let t = day0.getTime() + hour * 3600 * 1000;
  if (t < now + 20 * 60 * 1000) t = soon.getTime() + late++ * 3 * 3600 * 1000; // the run started very late: next full hour, 3 hours apart
  return new Date(t).toISOString();
}
let failed = 0;
for (const m of manifest) {
  const at = publishTime(m);
  try {
    let id;
    try { id = await upload(token, m, at); }
    catch (e) { // one retry after a pause: most failures are short network or quota hiccups
      console.log(`  retrying "${m.title}" in 90s: ${e.message}`);
      await new Promise((r) => setTimeout(r, 90000));
      id = await upload(token, m, at);
    }
    console.log(`uploaded "${m.title}" -> https://youtube.com/${m.long ? 'watch?v=' : 'shorts/'}${id}${at ? ` (publishes ${at})` : ''}`);
    if (m.thumb && fs.existsSync(path.join(ROOT, 'out', m.thumb))) await setThumbnail(token, id, path.join(ROOT, 'out', m.thumb)).catch((e) => console.log(`  thumbnail not set: ${e.message}`));
  } catch (e) { failed++; console.log(`✗ ${m.title}: ${e.message}`); }
}
if (failed) process.exit(1);
