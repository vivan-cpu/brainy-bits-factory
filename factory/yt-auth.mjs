// One-time helper (run on the laptop): sign in with Google and get the YouTube upload refresh token.
// Usage: node factory/yt-auth.mjs <path-to-client_secret.json>
// Saves ~/.config/brainy-bits/yt-secrets.txt with the three values to paste into GitHub secrets. Nothing is printed.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {exec} from 'node:child_process';

const file = process.argv[2];
if (!file) { console.log('usage: node factory/yt-auth.mjs <client_secret.json>'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
const c = cfg.installed || cfg.web;
const SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const code = url.searchParams.get('code');
  if (!code) { res.end('Waiting for Google sign-in...'); return; }
  const redirect = `http://127.0.0.1:${server.address().port}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({code, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: redirect, grant_type: 'authorization_code'}),
  });
  const tok = await r.json();
  if (!tok.refresh_token) { res.end('No refresh token returned. Close this tab and run the helper again.'); console.log('No refresh token:', tok.error || 'unknown'); process.exit(1); }
  const dir = path.join(os.homedir(), '.config', 'brainy-bits');
  fs.mkdirSync(dir, {recursive: true});
  const out = path.join(dir, 'yt-secrets.txt');
  fs.writeFileSync(out, `Paste each value into GitHub -> brainy-bits-factory -> Settings -> Secrets and variables -> Actions -> New repository secret\n\nYT_CLIENT_ID\n${c.client_id}\n\nYT_CLIENT_SECRET\n${c.client_secret}\n\nYT_REFRESH_TOKEN\n${tok.refresh_token}\n`);
  res.end('Done! Brainy Bits can now upload. You can close this tab.');
  console.log(`Saved to ${out}`);
  exec(process.platform === 'win32' ? `notepad "${out}"` : `open "${out}"`);
  setTimeout(() => process.exit(0), 500);
});

server.listen(0, '127.0.0.1', () => {
  const redirect = `http://127.0.0.1:${server.address().port}`;
  const auth = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: c.client_id, redirect_uri: redirect, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent',
  });
  console.log('Opening Google sign-in in your browser. Pick the Brainy Bits channel when asked.');
  exec(process.platform === 'win32' ? `start "" "${auth}"` : `open "${auth}"`);
});
