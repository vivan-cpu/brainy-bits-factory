// ffmpeg / ffprobe: prefer a full system build (needed for QA filters), fall back to Remotion's bundled binaries.
import {spawnSync} from 'node:child_process';

const isWin = process.platform === 'win32';
const npx = isWin ? 'npx.cmd' : 'npx';

function hasSystem(name) {
  const r = spawnSync(name, ['-version'], {encoding: 'utf8', shell: isWin});
  return r.status === 0;
}
const SYSTEM = hasSystem('ffmpeg') && hasSystem('ffprobe');

export function tool(name, args, {allowFail = false} = {}) {
  const r = SYSTEM
    ? spawnSync(name, args, {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: isWin})
    : spawnSync(npx, ['remotion', name, ...args], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: isWin});
  if (r.status !== 0 && !allowFail) throw new Error(`${name} failed: ${(r.stderr || '').slice(-800)}`);
  return {out: r.stdout || '', err: r.stderr || '', status: r.status};
}

// decode any audio file to raw signed 16-bit mono PCM at the given sample rate
export function pcmMono(file, rate) {
  const args = ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(rate), '-f', 's16le', '-'];
  const r = SYSTEM
    ? spawnSync('ffmpeg', args, {maxBuffer: 256 * 1024 * 1024, shell: isWin})
    : spawnSync(npx, ['remotion', 'ffmpeg', ...args], {maxBuffer: 256 * 1024 * 1024, shell: isWin});
  if (r.status !== 0) throw new Error('pcm decode failed');
  return r.stdout;
}

export function duration(file) {
  const {out} = tool('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(out.trim());
}

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {stdio: 'inherit', shell: isWin, ...opts});
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(' ')} exited ${r.status}`);
}

export {npx, SYSTEM as SYSTEM_FFMPEG};
