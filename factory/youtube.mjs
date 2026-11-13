// Upload agent: uploads out/*.mp4 from manifest.json to YouTube via the Data API (resumable upload).
// Needs YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN. YT_PRIVACY=public|unlisted|private.
// YT_SCHEDULE=1 spreads the day's videos 3 hours apart using publishAt (requires private + an audited API project).
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
  const description = `${meta.description}\n\nSources: ${(meta.sources || []).join('; ')}\n\nSubscribe for new weird facts every day: https://www.youtube.com/@factsbrainybits?sub_confirmation=1\nAnimated by Brainy Bits.`.slice(0, 4900);
  const status = {privacyStatus: publishAt ? 'private' : PRIVACY, selfDeclaredMadeForKids: false};
  if (publishAt) status.publishAt = publishAt;
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': 'video/mp4', 'x-upload-content-length': String(size)},
    body: JSON.stringify({snippet: {title: meta.title.slice(0, 100), description, tags: (meta.tags || []).slice(0, 15), categoryId: '27', defaultLanguage: 'en'}, status}),
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
const start = new Date(); start.setUTCMinutes(0, 0, 0); start.setUTCHours(start.getUTCHours() + 1);
let failed = 0;
for (const [i, m] of manifest.entries()) {
  const at = SCHEDULE ? new Date(start.getTime() + i * 3 * 3600 * 1000).toISOString() : null;
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
