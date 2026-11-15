// Photo agent: finds a real, freely licensed photograph of the video's subject for the opening.
// Why: a cartoon picture on a plain background made 4 out of 5 viewers swipe away in the first second (Nov 2026 stats).
// Source: Wikimedia Commons. Only public domain, CC0 and CC BY files are used (no share-alike, non-commercial or no-derivatives),
// and the credit goes into the video description. A vision model then picks the clearest family-friendly photo, or none.
// Test on its own: node factory/photo.mjs "peacock mantis shrimp" "Odontodactylus scyllarus"
import fs from 'node:fs';
import path from 'node:path';
import {askJSON} from './gemini.mjs';
import {tool} from './media.mjs';

const HEADERS = {'user-agent': 'shorts-factory/1.0 (educational video bot)'};
const FREE = (lic) => /^(cc0|public domain|pd\b|cc[ -]by[ -]\d)/i.test(lic) && !/sa|nc|nd/i.test(lic);
const strip = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const MAX_CANDIDATES = 7;

async function getJSON(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {headers: HEADERS, signal: AbortSignal.timeout(20000)});
      if (res.ok) return await res.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 2500));
  }
  return null;
}

async function getFile(url, file) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {headers: HEADERS, signal: AbortSignal.timeout(40000)});
      if (res.ok) { fs.writeFileSync(file, Buffer.from(await res.arrayBuffer())); return true; }
    } catch {}
    await new Promise((r) => setTimeout(r, 2500));
  }
  return false;
}

// search Commons for photos of at least 1000x700 and keep the freely licensed ones, in search order
async function search(query) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrsearch: `${query} filetype:bitmap filew:>1000 fileh:>700`, gsrnamespace: '6', gsrlimit: '40',
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '960',
  });
  const data = await getJSON(url);
  return Object.values(data?.query?.pages || {}).sort((a, b) => a.index - b.index).map((p) => {
    const ii = p.imageinfo?.[0] || {};
    const m = ii.extmetadata || {};
    return {
      title: String(p.title || '').replace(/^File:/, '').replace(/\.\w+$/, ''), mime: ii.mime, width: ii.width, height: ii.height,
      preview: ii.thumburl, full: ii.url, page: ii.descriptionurl,
      license: strip(m.LicenseShortName?.value), artist: strip(m.Artist?.value).slice(0, 90), about: strip(m.ImageDescription?.value).slice(0, 160),
    };
  }).filter((c) => c.preview && /jpe?g|png/.test(c.mime || '') && FREE(c.license) && c.width / c.height > 0.5 && c.width / c.height < 2.4);
}

// Returns {file, fit, fx, fy, aspect, credit} or null. dir = public/jobs/<id> (the render reads the photo from there).
export async function findPhoto({subject, queries, dir, log = () => {}}) {
  const seen = new Set();
  const cands = [];
  for (const q of (queries || []).filter(Boolean).slice(0, 3)) {
    for (const c of await search(q)) {
      if (cands.length >= MAX_CANDIDATES) break;
      if (seen.has(c.page)) continue;
      seen.add(c.page);
      cands.push(c);
    }
    if (cands.length >= MAX_CANDIDATES) break;
  }
  if (!cands.length) { log('  photo: no freely licensed candidates'); return null; }
  fs.mkdirSync(dir, {recursive: true});
  const images = [];
  const usable = [];
  for (const [i, c] of cands.entries()) {
    const tmp = path.join(dir, `cand_${i}`);
    if (!(await getFile(c.preview, tmp))) continue;
    const buf = fs.readFileSync(tmp);
    fs.rmSync(tmp, {force: true});
    if (buf.length < 8000 || buf.length > 3000000) continue;
    images.push({mime: c.mime.includes('png') ? 'image/png' : 'image/jpeg', data: buf.toString('base64')});
    usable.push(c);
  }
  if (!usable.length) { log('  photo: candidates could not be downloaded'); return null; }
  const prompt = `You pick the opening photo for a family-friendly educational YouTube Short for all ages. The photo fills a phone screen for the first two seconds and must make a stranger instantly see what the video is about.
The subject that must be shown: "${subject}".
You get ${usable.length} candidate images, numbered 0 to ${usable.length - 1} in order. Their file names: ${usable.map((c, i) => `${i}: ${c.title}`).join(' | ')}

Pick the ONE best image, or -1 if none is good enough. An image is only acceptable if ALL of these are true:
- It is a real photograph (or a real telescope, microscope or satellite image). NOT a drawing, painting, engraving, diagram, map, chart, logo, stamp, coin, book page, screenshot or museum label.
- The subject is really "${subject}" (not a different species, object or place), clearly visible, large in the frame and reasonably sharp.
- It is safe for children: no nudity, no gore, no blood, no dead or injured animals or people, no weapons pointed at anyone, nothing sexual or frightening.
- No recognisable private person as the main subject, and no big watermark or large text over the picture.
- It is a clean, striking picture: NOT a cluttered shop window, shelf, museum display with labels, product packaging, barcode, sign, or a snapshot where the subject is just one thing among many.
Prefer: the subject alive and in action, bright colours, a simple background, a close-up.
Be strict. A missing photo is fine (the video has another opening), but a dull or confusing photo makes viewers leave. Give the picked image a "score" from 1 to 10 for how instantly a stranger would recognise the subject and want to keep watching; if the best image would score under 7, answer -1.

Also report where the subject is, so the picture can be cropped to a tall phone screen:
- "focusX" and "focusY": the centre of the subject as fractions from 0 to 1 (0,0 is the top-left corner).
- "tallCropOk": true only if a tall crop that keeps just the middle 40 percent of the image width around focusX would still clearly show the whole subject.

Return JSON: {"best": number, "score": number, "focusX": number, "focusY": number, "tallCropOk": true|false, "why": "one short sentence"}`;
  let pick;
  try { pick = (await askJSON(prompt, {temperature: 0.1, images, timeoutMs: 45000})).json; }
  catch (e) { log(`  photo: vision check failed (${e.message.slice(0, 120)})`); return null; }
  const c = (pick?.score ?? 10) >= 7 ? usable[pick?.best] : null;
  if (!c) { log(`  photo: none of ${usable.length} candidates accepted (${pick?.why || 'no reason given'})`); return null; }
  // final file: a 1920px-wide copy when the original is larger (original otherwise), re-encoded to a plain JPEG
  const raw = path.join(dir, 'photo_raw');
  const big = c.width > 1920 ? c.preview.replace(/\/\d+px-/, '/1920px-') : c.full;
  if (!(await getFile(big, raw)) && !(await getFile(c.preview, raw))) { log('  photo: download failed'); return null; }
  const out = path.join(dir, 'photo.jpg');
  try { tool('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw, '-vf', "scale='min(1920,iw)':-2", '-frames:v', '1', '-q:v', '3', out]); }
  catch (e) { log(`  photo: could not convert (${e.message.slice(0, 100)})`); return null; }
  finally { fs.rmSync(raw, {force: true}); }
  const num = (v, d) => (Number.isFinite(+v) ? Math.max(0.05, Math.min(0.95, +v)) : d);
  const aspect = c.width / c.height;
  const credit = `Opening photo: "${c.title.slice(0, 80)}"${c.artist ? ` by ${c.artist}` : ''}, ${c.license}, via Wikimedia Commons (cropped). ${c.page}`;
  log(`  photo: ${c.title.slice(0, 60)} (${c.license}, score ${pick.score ?? '?'}) — ${pick.why || ''}`);
  return {file: 'photo.jpg', fit: aspect <= 1.05 || pick.tallCropOk ? 'cover' : 'contain', fx: num(pick.focusX, 0.5), fy: num(pick.focusY, 0.45), aspect: +aspect.toFixed(3), credit};
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))) {
  const [subject, ...more] = process.argv.slice(2);
  const res = await findPhoto({subject, queries: [subject, ...more], dir: path.resolve('out/photo-test'), log: console.log});
  console.log(res);
}
