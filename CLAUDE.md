# Brainy Bits factory: handbook

This repo makes and uploads the videos for the YouTube channel **Brainyvoo** (@brainyvoo, renamed from "Brainy Bits facts" / @factsbrainybits on 18 Nov 2026, channel ID `UCEKBQxcGl0NTb2zot5bxu1A`). It runs by itself every day on GitHub Actions. The owner is Vivan (a school student, beginner at code). Explain things to him simply and keep replies short.

## What runs every day
`.github/workflows/factory.yml`, cron `30 2 * * *` UTC. GitHub starts this repo's schedule 7 to 11 hours late (00:30 ran at about 07:00; 08:30 ran at about 19:20 and missed the 15:00 and 18:00 publish slots), so 02:30 really starts between 09:30 and 13:30 UTC: after the free Gemini quota resets (08:00 UTC) and before the first slot. The best free model (`gemini-3-flash-preview`) has a small daily quota that local testing shares.

1. `node factory/run.mjs --count 4` makes 4 Shorts: 3 facts and, last, 1 true story.
2. On Monday, Wednesday and Saturday it also runs `node factory/run.mjs --long` (one 3 to 4 minute 16:9 video; takes about 45 minutes in the cloud).
3. It commits `data/history.json` (used topics), publishes a GitHub Release, then `factory/youtube.mjs` uploads everything with scheduled publish times.

Repo variables: `YT_UPLOAD=1`, `YT_PRIVACY=public`, `YT_SCHEDULE=1`. Secrets: `GEMINI_API_KEY`, `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`. Never print, paste or type secrets. Vivan enters codes and passwords himself.

## The pipeline for one Short (`factory/run.mjs` → `makeOne`)
| Step | File | What it does |
|---|---|---|
| Learn | `run.mjs` `channelInsights` | Reads the public RSS feed and tells the writer which videos got the most and fewest views |
| Write | `prompts.mjs` `scriptPrompt` (Gemini) | JSON script: `hookText`, `photo`, `scenes[]`, title, description, tags, sources |
| Repair | `run.mjs` `repairSpec` | Fixes emoji names, folds a stand-alone subscribe ask into the scene before it, trims `hookText` |
| Check | `qa.mjs` `checkSpec` | Structure rules. A failed check goes back to the writer as feedback (4 tries) |
| Fact-check | `prompts.mjs` `factCheckPrompt` (Gemini, strict) | Rejects false claims, including the on-screen headline |
| Photo | `photo.mjs` `findPhoto` | Real photo of the subject from Wikimedia Commons, picked by a vision check |
| Voice | `tts.py` | Edge TTS with word timings (voices alternate: Guy, Brian). Kokoro is the offline fallback |
| Render | `remotion/` | 1080x1920, 30 fps |
| QA | `qa.mjs` `checkVideo` | Length 15 to 59 s, resolution, loudness, no black frames |
| Upload | `youtube.mjs` | Resumable upload, `publishAt` slots, photo credit in the description |

## The design rules, and the data behind them
These came from real YouTube Studio numbers. Do not undo them without new data.

- **The first second decides everything.** In November 2026, 75 to 93% of Shorts-feed viewers swiped away. A cartoon emoji on a gradient with a vague teaser ("TOTAL SPACE DOMINATION") did not hold anyone, in either of two animated opening styles.
- **18 Nov 2026: the photo opening is OFF by default.** All 10 photo-opening Shorts (16-18 Nov) got 0-17 views, while every cartoon-opening Short got 80-900 (the cranberry Short, cartoon, same day: 649). YouTube barely showed the photo ones at all, so the cartoon openings (`HookOpening`, `SlamOpening`) are the default again. `PHOTO=1` turns the photo step back on.
- Earlier design (kept for reference): **the opening was a real photo** (`PhotoOpening` in `remotion/Video.jsx`): the photo fills the screen from frame one, the headline slams over it, and after 2 seconds the photo shrinks into a card for the rest of the hook scene. When no good photo exists, the cartoon openings (`HookOpening`, `SlamOpening`, alternating) are the fallback.
- **The hook states the claim.** Scene 1 says the most surprising true claim and names the subject ("A T-Rex lived closer in time to you than to a Stegosaurus"). `hookText` is that claim as a 3 to 6 word headline. Vague teases are rejected by `claimProblems` in `qa.mjs`.
- **One extra twist is saved for the end**, and the **subscribe ask** is the last sentence of the scene right before it (`askProblems`). An animated SUBSCRIBE button appears when the word is spoken (`SubscribeNudge`).
- **Animals and ocean life get 3 to 8 times the views**, so `CATEGORIES` in `prompts.mjs` is weighted toward them.
- **19 Nov 2026: Shorts are shorter.** Studio, 28 days: only 16.9% of Shorts-feed viewers stayed (83.1% swiped away); 94% of views come from the Shorts feed. Fact Shorts are now 48 to 68 words (20 to 26 s), stories 70 to 95 words, because a Short people finish beats a longer one they leave.
- **Titles name the subject.** "The snack that changed history" got 84 views; "Why an octopus has blue blood and three hearts" got 570.
- **Publish hours are India daytime, chosen by Vivan on 18 Nov 2026** (`SLOTS` in `youtube.mjs`, in IST: 06:00, 10:00, 14:00, 18:00; long videos 16:00). Nothing after 18:00 IST, so every Short of the day is public by evening. Each run fills the next India day. Both channels use the same hours. Before this the English slots were US/UK daytime (15, 18, 21, 24 UTC); the audience was already mostly Asia (28 days to 14 Nov 2026: India 21%, US 7.5%, Philippines 6%, Indonesia 5%).
- **Family-friendly always.** No mass-casualty stories, nothing a child could copy and get hurt, no private people in photos.
- **Photos must be freely licensed:** public domain, CC0 or CC BY only (no share-alike, non-commercial or no-derivatives), with the credit line in the description. This keeps the channel safe for monetisation later.

## How to check whether a change worked
Each video's opening style is stored in `data/history.json` (`opening`: `photo`, `hero` or `slam`). In YouTube Studio open a video → Analytics → Engagement → "How viewers engaged": **Stayed to watch vs Swiped away**. It needs about a day of data. Direct link: `https://studio.youtube.com/video/<VIDEO_ID>/analytics/tab-interest_viewers/period-default`.

Baseline before the photo opening (14 Nov 2026): 7 to 25% stayed. Good Shorts keep over 60%. If photo openings are still under 30% after 3 days, the next things to test are the voice (a more human one) and showing real photos in the middle scenes too, not more videos per day.

## Testing locally (Windows, Git Bash)
```bash
export GEMINI_API_KEY=$(grep -a '^GEMINI_API_KEY=' ~/.config/watch/.env | cut -d= -f2- | tr -d '\r')
node factory/run.mjs --count 1 --topic "how fast a peregrine falcon dives"
git checkout data/history.json data/refurbish.json   # always undo the test's history changes
```
- One Short takes about 4 minutes. Output is `out/<id>.mp4`, the script is `jobs/<id>/spec.json`.
- Look at real frames before pushing a visual change: `npx remotion still remotion/index.jsx Brainy out/f.jpg --props=jobs/<id>/props.json --frame=30 --scale=0.3`
- Other flags: `--story` (true story), `--long`, `--lang hi`, `--skip-factcheck`. The photo step is off unless `PHOTO=1`.
- Test the photo finder alone: `node factory/photo.mjs "a peacock mantis shrimp" "mantis shrimp"`
- Before pushing anything that touches the script rules or the render, rehearse the real thing: `node factory/run.mjs --count 4`. All 4 should pass.
- Complex edits with nested quotes fail in Bash heredocs. Write a small patch script to a temp file instead.

## Remotion map
- `remotion/index.jsx`: compositions `Brainy` (Short), `BrainyLong`, `Banner`, `Logo`.
- `Video.jsx`: the Short. Openings, `BrainyLayer` (the mascot, lip-synced to the voice loudness), `Captions`, `SubscribeNudge`, `Music`.
- `Scenes.jsx`: scene templates `hook`, `trio`, `compare`, `stat`, `orbit`, `journey`, `bars`, `timeline`, `bigword`, `outro`. Content zone is y 220 to 1080; Brainy and captions sit below it.
- `Worlds.jsx`: backgrounds `ocean`, `space`, `body`, `lab`, `sky`, `forest`.
- `LongVideo.jsx`: the 16:9 video with `chapter` scenes.
- Pictures are Microsoft Fluent emoji SVGs in `public/emoji` (names in `data/emoji-names.txt`).

### Adding a scene type
1. Write the component in `Scenes.jsx` and add it to the `SCENES` map.
2. Describe its fields in `SCENE_TYPES` in `prompts.mjs`.
3. Add it to `TYPES` and `shapeProblems` in `qa.mjs`, and to `collectEmojis` / `repairSpec` if it has emoji fields.
4. Add its on-screen text to `factCheckPrompt`.
5. Render a still of it and look at it before pushing.

## Hindi channel
**Brainyvoo Hindi** (@brainyvoohindi, channel ID `UCqIxJ7l5VwjdeXk1PRy5AUQ`), created 19 Nov 2026. Banner: `../brand/banner-brainyvoo-hindi.png` (`Banner` composition with `--props='{"lang":"hi"}'`).

`--lang hi` writes Hindi scripts (Devanagari), uses the Baloo 2 font and keeps its own `data/history-hi.json`. Its signature, so it is not just another translated facts channel ("desi connection", 19 Nov 2026):
- Half the topics come from `CATEGORIES_HI` / `STORY_CATEGORIES_HI` (Indian animals, places, inventions, ISRO, food and cricket science).
- Every big number is compared to something every Indian knows (cricket pitch, auto-rickshaw, Qutub Minar, Delhi to Mumbai). Spoken style is everyday Hinglish in Devanagari.
- Voice: only the native `hi-IN-MadhurNeural` (the American Brian voice speaking Hindi sounded foreign).

The workflow jobs `hi-gate` + `make-hi` make 4 Hindi Shorts a day and upload them at the same hours as English (06:00, 10:00, 14:00, 18:00 IST). Repo variables `HINDI=1`, `YT_HANDLE_HI`, `YT_CHANNEL_ID_HI` are set. `hi-gate` skips the job until the secret `YT_REFRESH_TOKEN_HI` exists (Vivan pastes it himself; the value is in `~/.config/brainy-bits/HINDI-SECRET-PASTE-ME.txt` on the laptop). Optional `HINDI_COUNT` (default 4).

Upload quota: both channels share one Google Cloud project. With 4 + 4 Shorts and a long video that is 9 uploads a day; if Hindi uploads fail with `quotaExceeded`, give the Hindi channel its own Cloud project (new client ID/secret as `YT_CLIENT_ID_HI` / `YT_CLIENT_SECRET_HI`) or ask Google for more quota.

`youtube.mjs` takes `YT_LANG` (description footer and video language) and `YT_HANDLE` (subscribe link).

## Things that need Vivan (or a parent)
- Phone verification of the channel (also unlocks custom thumbnails for long videos; until then `thumbnails.set` returns 403, which is expected).
- Creating accounts or channels, accepting terms, AdSense (needs an adult).
- Anything that deletes videos permanently: ask first.

## Known quirks
- The RSS feed sometimes returns 404 or nothing. Retry before deciding a video is missing.
- `gh` is not installed locally. Read run logs in Chrome at `github.com/vivan-cpu/brainy-bits-factory/actions`.
- Upload limit: 4 Shorts plus a long video in one day has worked. If uploads fail with `uploadLimitExceeded`, lower `COUNT` in the workflow to 3.
- The emoji named `leopard` is the only spotted big cat, so scripts sometimes call a cheetah a leopard. The fact-checker catches it.
