# Brainy Bits factory

Makes animated YouTube Shorts for **Brainyvoo** (@brainyvoo) every day, in the cloud.

For how everything works and why, read `CLAUDE.md`.

## The agents
1. **Script writer** (`factory/prompts.mjs`, Gemini): picks a true, surprising fact and writes a 5–7 scene script that opens with the claim itself. Brainy, the mascot, narrates.
2. **Fact-checker** (Gemini, strict): rejects false claims and myths; the writer rewrites, up to 4 tries.
3. **Photo finder** (`factory/photo.mjs`): finds a freely licensed real photo of the subject on Wikimedia Commons for the opening, and credits it in the description.
4. **Voice** (`factory/tts.py`, Edge TTS): records each scene with exact word timings.
5. **Animator** (`remotion/`): Brainy plus scene templates (hook, trio, compare, stat, orbit, journey, bars, timeline, bigword, outro) over animated worlds (ocean, space, body, lab, sky, forest), using 1,285 Microsoft Fluent emoji illustrations (MIT licence).
6. **QA + publisher** (`factory/qa.mjs`, `factory/youtube.mjs`): checks length, resolution, audio level and black frames. Then it publishes the day's Shorts as a GitHub Release and uploads them to YouTube once the YouTube secrets are set.

## Running it from your phone or iPad
- **Automatic:** every day (the schedule is 02:30 UTC, but GitHub really starts it 7 to 11 hours later) it makes 4 Shorts (3 facts and 1 true story), plus a 3 to 4 minute video on Monday, Wednesday and Saturday.
- **On demand:** GitHub app → this repo → Actions → *Brainy Bits factory* → **Run workflow**. Pick how many Shorts, and optionally a topic.
- **Get the videos:** repo → **Releases** → newest release → tap the `.mp4`. The release notes hold the ready-to-copy title, description and tags.

## Secrets (repo → Settings → Secrets and variables → Actions)
- `GEMINI_API_KEY`: required.
- `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`: optional, turn on automatic YouTube upload.
- Variables: `YT_PRIVACY` (`private`, `unlisted` or `public`) and `YT_SCHEDULE` (`1` publishes the Shorts at 15:00, 18:00, 21:00 and 24:00 UTC).

## Local
`npm ci`, `pip install edge-tts`, then `GEMINI_API_KEY=... node factory/run.mjs --count 1 --topic "why flamingos are pink"`
