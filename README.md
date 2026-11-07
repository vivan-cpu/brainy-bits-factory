# Brainy Bits factory

Makes animated YouTube Shorts for **Brainy Bits** (@factsbrainybits) every day, in the cloud.

## The five agents
1. **Script writer** (`factory/prompts.mjs`, Gemini): picks a true, surprising fact and writes a 5–7 scene script. Brainy, the mascot, narrates.
2. **Fact-checker** (Gemini, strict): rejects false claims and myths; the writer rewrites, up to 4 tries.
3. **Voice** (`factory/tts.py`, Edge TTS): records each scene with exact word timings.
4. **Animator** (`remotion/`): Brainy plus scene templates (hook, trio, compare, stat, orbit, journey, outro) over animated worlds (ocean, space, body, lab, sky, forest), using 1,285 Microsoft Fluent emoji illustrations (MIT licence).
5. **QA + publisher** (`factory/qa.mjs`, `factory/youtube.mjs`): checks length, resolution, audio level and black frames. Then it publishes the day's Shorts as a GitHub Release and uploads them to YouTube once the YouTube secrets are set.

## Running it from your phone or iPad
- **Automatic:** every day at 06:00 India time it makes 5 Shorts.
- **On demand:** GitHub app → this repo → Actions → *Brainy Bits factory* → **Run workflow**. Pick how many Shorts, and optionally a topic.
- **Get the videos:** repo → **Releases** → newest release → tap the `.mp4`. The release notes hold the ready-to-copy title, description and tags.

## Secrets (repo → Settings → Secrets and variables → Actions)
- `GEMINI_API_KEY`: required.
- `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`: optional, turn on automatic YouTube upload.
- Variables: `YT_PRIVACY` (`private`, `unlisted` or `public`) and `YT_SCHEDULE` (`1` spreads the uploads 3 hours apart).

## Local
`npm ci`, `pip install edge-tts`, then `GEMINI_API_KEY=... node factory/run.mjs --count 1 --topic "why flamingos are pink"`
