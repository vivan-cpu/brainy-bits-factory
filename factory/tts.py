"""Voice agent. The whole video is recorded in ONE take (natural flow, no abrupt pauses between scenes), then every
script word gets a timestamp so captions and scenes stay in sync.
Usage: python tts.py <spec.json> <out_dir>

Engines (BRAINY_TTS):
  gemini  Gemini speech models, two voices: Brainy (narrator) and a curious kid who asks the scene "ask" lines.
          Expressive (tone follows the story). Words are timed with faster-whisper + character alignment.
  edge    Microsoft Edge voice, one take for the whole script, exact word timings. Kid lines use the same voice.
  kokoro  offline, one clip per scene (last resort).
  auto    gemini, else edge, else kokoro.
Writes <out_dir>/words.json:
  single take: {"engine", "single": true, "file": "voice.wav", "duration", "scenes": [[{w, s, e, kid?}, ...], ...]}
  kokoro:      {"engine", "files": [...], "scenes": [[{w, s, e}, ...], ...]}  (times relative to each clip)
"""
import asyncio, base64, difflib, json, os, re, subprocess, sys, time, unicodedata, urllib.error, urllib.request, wave

ENGINE = os.environ.get("BRAINY_TTS", "auto")
LANG = os.environ.get("BRAINY_LANG", "en")
EDGE_VOICE = os.environ.get("BRAINY_VOICE", "en-US-ChristopherNeural")
EDGE_RATE = os.environ.get("BRAINY_RATE", "+8%")
EDGE_PITCH = os.environ.get("BRAINY_PITCH", "-3Hz")
KOKORO_DIR = os.path.expanduser(os.environ.get("KOKORO_DIR", "~/kokoro"))
KOKORO_VOICE = os.environ.get("KOKORO_VOICE", "am_onyx")
KOKORO_SPEED = float(os.environ.get("KOKORO_SPEED", "1.1"))
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_TTS_MODELS = os.environ.get("GEMINI_TTS_MODELS", "gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts,gemini-3.8-flash-lite-tts,gemini-2.5-pro-preview-tts").split(",")
VOICE_BRAINY = os.environ.get("GEMINI_VOICE_BRAINY", "Puck")
VOICE_KID = os.environ.get("GEMINI_VOICE_KID", "Leda")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")
GEMINI_SPEED = float(os.environ.get("GEMINI_SPEED", "1.12"))  # Gemini storytellers speak slowly (~135 words/min); Shorts want ~160

PUNCT = "\"'“”‘’.,!?;:()[]{}-–—…।॥*"


def clean(tok):
    return tok.strip(PUNCT + " \t\n")


def script_words(spec):
    """[(scene_index, word, is_kid)] in speaking order: each scene's kid "ask" comes before its narration."""
    out = []
    for k, sc in enumerate(spec["scenes"]):
        for kid, text in ((True, sc.get("ask") or ""), (False, sc.get("narration") or "")):
            for t in text.split():
                c = clean(t)
                if c:
                    out.append((k, c, kid))
    return out


def turns(spec):
    """speaker turns for the dialogue: [(is_kid, text)], merging consecutive narrator lines"""
    out = []
    for sc in spec["scenes"]:
        if (sc.get("ask") or "").strip():
            out.append((True, sc["ask"].strip()))
        n = (sc.get("narration") or "").strip()
        if n:
            if out and not out[-1][0]:
                out[-1] = (False, out[-1][1] + " " + n)
            else:
                out.append((False, n))
    return out


# ---------- alignment: map script words onto timed words from a recogniser or TTS (spelling may differ) ----------
def skeleton(s):
    """letters and digits only, no vowel signs, lower case: survives most spelling differences in Hindi and English"""
    return "".join(ch for ch in unicodedata.normalize("NFC", s.lower()) if unicodedata.category(ch)[0] in "LN")


def align(words, timed, duration):
    """words: [(scene, w, kid)]; timed: [{w, s, e}] -> [{w, s, e, kid, scene}] with monotonic times; returns (items, coverage)"""
    a, a_idx = [], []
    for i, (_, w, _) in enumerate(words):
        for ch in skeleton(w):
            a.append(ch); a_idx.append(i)
    b, b_t = [], []
    for tw in timed:
        sk = skeleton(tw["w"])
        n = len(sk)
        for j, ch in enumerate(sk):
            b.append(ch)
            b_t.append(tw["s"] + (tw["e"] - tw["s"]) * (j + 0.5) / max(1, n))
    starts, ends = [None] * len(words), [None] * len(words)
    matched = 0
    sm = difflib.SequenceMatcher(None, "".join(a), "".join(b), autojunk=False)
    for blk in sm.get_matching_blocks():
        for d in range(blk.size):
            i, t = a_idx[blk.a + d], b_t[blk.b + d]
            matched += 1
            starts[i] = t if starts[i] is None else min(starts[i], t)
            ends[i] = t if ends[i] is None else max(ends[i], t)
    coverage = matched / max(1, len(a))
    tail_ok = any(starts[i] is not None for i in range(max(0, len(words) - 8), len(words)))  # the take reached the end of the script
    if not tail_ok:
        coverage = min(coverage, 0.0)
    # words with no matched letters (numbers spoken as digits, misheard words): spread them between known neighbours
    n = len(words)
    known = [i for i in range(n) if starts[i] is not None]
    if not known:
        return None, 0.0
    for i in range(n):
        if starts[i] is not None:
            continue
        prev = max([k for k in known if k < i], default=None)
        nxt = min([k for k in known if k > i], default=None)
        lo = ends[prev] if prev is not None else 0.0
        hi = starts[nxt] if nxt is not None else duration
        gap_words = (nxt if nxt is not None else n) - (prev if prev is not None else -1) - 1
        pos = i - (prev if prev is not None else -1)
        step = (hi - lo) / (gap_words + 1)
        starts[i] = lo + step * (pos - 0.5)
        ends[i] = lo + step * (pos + 0.4)
    items, last = [], 0.0
    for i, (k, w, kid) in enumerate(words):
        s = max(last, starts[i] - 0.04)
        e = max(s + 0.08, ends[i] + 0.06)
        items.append({"w": w, "s": round(s, 3), "e": round(e, 3), "kid": kid, "scene": k})
        last = s + 0.01
    return items, coverage


def by_scene(items, count):
    scenes = [[] for _ in range(count)]
    for it in items:
        d = {"w": it["w"], "s": it["s"], "e": it["e"]}
        if it["kid"]:
            d["kid"] = True
        scenes[it["scene"]].append(d)
    return scenes


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args], check=True)


def duration_of(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True).stdout
    return float(out.strip() or 0)


def tidy(src, dst, speed=1.0):
    """trim the ends, shorten any pause longer than 0.55 s to 0.4 s (no dead stops) and speed up without changing pitch"""
    ffmpeg("-i", src, "-af",
           "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,"
           "silenceremove=stop_periods=-1:stop_duration=0.55:stop_threshold=-42dB:stop_silence=0.4,"
           "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse" + (f",atempo={speed}" if abs(speed - 1) > 0.01 else ""),
           "-ar", "44100", "-ac", "1", dst)


# ---------- Gemini (expressive, two voices) ----------
STYLE = {
    "en": ("Perform this as a gripping, fun YouTube Short. Brainy is a warm, excited storyteller, like a cool older friend. "
           "Kid is a curious, amazed little kid who asks short questions. Let the tone follow the story: lean in and slow down to build suspense, "
           "speed up when it gets exciting, sound genuinely amazed at the surprises, and smile on the playful lines. "
           "Treat '...' as a short dramatic pause. Keep it flowing like a real conversation at a brisk, energetic YouTube Shorts pace, never slow, flat or robotic."),
    "hi": ("इसे एक मज़ेदार, रोमांचक हिंदी YouTube Short की तरह बोलिए। Brainy एक प्यारा, जोशीला कहानी सुनाने वाला बड़ा भैया है। "
           "Kid एक जिज्ञासु, हैरान छोटा बच्चा है जो छोटे-छोटे सवाल पूछता है। कहानी के साथ आवाज़ का भाव बदलिए: सस्पेंस पर धीमे और रहस्यमय, "
           "रोमांचक हिस्से पर तेज़, हैरानी वाली बात पर सच में हैरान, और मज़ेदार लाइन पर मुस्कुराते हुए। '...' पर छोटा नाटकीय ठहराव। "
           "बिल्कुल असली बातचीत की तरह, जोश से भरी और तेज़ रफ़्तार (YouTube Shorts जैसी), कभी धीमी, सपाट या रोबोट जैसी नहीं। Natural Indian Hindi accent."),
}


def gemini_take(spec, out_wav):
    tl = turns(spec)
    has_kid = any(k for k, _ in tl)
    lines = "\n".join(f"{'Kid' if k else 'Brainy'}: {t}" for k, t in tl) if has_kid else " ".join(t for _, t in tl)
    prompt = STYLE.get(LANG, STYLE["en"]) + "\n\n" + lines
    if has_kid:
        speech = {"multiSpeakerVoiceConfig": {"speakerVoiceConfigs": [
            {"speaker": "Brainy", "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE_BRAINY}}},
            {"speaker": "Kid", "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE_KID}}}]}}
    else:
        speech = {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE_BRAINY}}}
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                       "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": speech}}).encode()
    errors = []
    for m in GEMINI_TTS_MODELS:
        for attempt in range(2):
            try:
                req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{m.strip()}:generateContent?key={GEMINI_KEY}",
                                             data=body, headers={"content-type": "application/json"})
                r = json.load(urllib.request.urlopen(req, timeout=150))
                part = r["candidates"][0]["content"]["parts"][0]["inlineData"]
                rate = int((re.search(r"rate=(\d+)", part.get("mimeType", "")) or [0, 24000])[1])
                data = base64.b64decode(part["data"])
                if data[:4] == b"RIFF":  # some models already return a wav file
                    open(out_wav, "wb").write(data)
                else:
                    with wave.open(out_wav, "wb") as w:
                        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(data)
                print(f"gemini voice: {m.strip()} ({duration_of(out_wav):.1f}s)", file=sys.stderr)
                return m.strip()
            except urllib.error.HTTPError as e:
                errors.append(f"{m}: HTTP {e.code}")
                if e.code in (429, 404, 400, 403):
                    break  # quota, retired or unsupported: next model
            except Exception as e:
                errors.append(f"{m}: {e}")
            time.sleep(3)
    raise RuntimeError("gemini tts failed: " + "; ".join(errors))


_whisper = None


def whisper_words(path):
    global _whisper
    import numpy as np
    from faster_whisper import WhisperModel
    if _whisper is None:
        _whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True).stdout
    audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    segs, _ = _whisper.transcribe(audio, language=LANG, word_timestamps=True, vad_filter=False, beam_size=3)
    return [{"w": w.word.strip(), "s": w.start, "e": w.end} for s in segs for w in (s.words or [])]


def single_take_gemini(spec, out):
    raw = os.path.join(out, "voice_raw.wav")
    gemini_take(spec, raw)
    final = os.path.join(out, "voice.wav")
    tidy(raw, final, GEMINI_SPEED)
    dur = duration_of(final)
    words = script_words(spec)
    if not (len(words) * 0.15 < dur < len(words) * 0.9 + 4):
        raise RuntimeError(f"gemini take has a strange length ({dur:.1f}s for {len(words)} words)")
    items, cov = align(words, whisper_words(final), dur)
    print(f"alignment coverage {cov:.0%}", file=sys.stderr)
    if items is None or cov < 0.55:
        raise RuntimeError(f"gemini take does not match the script (coverage {cov:.0%})")
    return final, dur, items


# ---------- Edge (one take, exact word timings) ----------
async def edge_take(text, path, tries=4):
    import edge_tts
    for attempt in range(tries):
        try:
            words = []
            c = edge_tts.Communicate(text, EDGE_VOICE, rate=EDGE_RATE, pitch=EDGE_PITCH, boundary="WordBoundary")
            with open(path, "wb") as f:
                async for ch in c.stream():
                    if ch["type"] == "audio":
                        f.write(ch["data"])
                    elif ch["type"] == "WordBoundary":
                        s = ch["offset"] / 1e7
                        words.append({"w": ch["text"], "s": round(s, 3), "e": round(s + ch["duration"] / 1e7, 3)})
            if words and os.path.getsize(path) > 1000:
                return words
        except Exception as e:
            print(f"edge retry {attempt + 1}: {e}", file=sys.stderr)
        await asyncio.sleep(2 * (attempt + 1))
    raise RuntimeError("edge tts failed")


async def single_take_edge(spec, out):
    raw = os.path.join(out, "voice_raw.mp3")
    text = " ".join(t for _, t in turns(spec))
    timed = await edge_take(text, raw)
    final = os.path.join(out, "voice.wav")
    # no silence trimming here: Edge timings are exact for the raw file, only convert it
    ffmpeg("-i", raw, "-ar", "44100", "-ac", "1", final)
    dur = duration_of(final)
    items, cov = align(script_words(spec), timed, dur)
    print(f"alignment coverage {cov:.0%}", file=sys.stderr)
    if items is None:
        raise RuntimeError("edge alignment failed")
    return final, dur, items


# ---------- Kokoro (offline, per scene) ----------
_kokoro = None


def kokoro_scene(text, path):
    global _kokoro
    import numpy as np, soundfile as sf
    if _kokoro is None:
        from kokoro_onnx import Kokoro
        _kokoro = Kokoro(os.path.join(KOKORO_DIR, "kokoro-v1.0.onnx"), os.path.join(KOKORO_DIR, "voices-v1.0.bin"))
    audio, sr = _kokoro.create(text, voice=KOKORO_VOICE, speed=KOKORO_SPEED, lang=os.environ.get("KOKORO_LANG", "en-us"))
    nz = np.where(np.abs(audio) > 0.01)[0]
    if len(nz):
        audio = audio[max(0, nz[0] - int(0.03 * sr)): nz[-1] + int(0.05 * sr)]
    sf.write(path, audio, sr)
    dur = len(audio) / sr
    toks = [c for c in (clean(t) for t in text.split()) if c]
    weights = [len(t) + 2 for t in toks]
    total = sum(weights) or 1
    words, cur = [], 0.03
    span = max(0.1, dur - 0.08)
    for t, wgt in zip(toks, weights):
        d = span * wgt / total
        words.append({"w": t, "s": round(cur, 3), "e": round(cur + d * 0.92, 3)})
        cur += d
    return words


async def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    order = {"auto": ["gemini", "edge", "kokoro"], "gemini": ["gemini", "edge", "kokoro"], "edge": ["edge", "kokoro"], "kokoro": ["kokoro"]}[ENGINE]
    if not GEMINI_KEY and "gemini" in order:
        order.remove("gemini")
    for engine in order:
        try:
            if engine == "kokoro":
                scenes, files = [], []
                for k, sc in enumerate(spec["scenes"]):
                    text = " ".join(x for x in (sc.get("ask"), sc.get("narration")) if x)
                    p = os.path.join(out, f"scene_{k}.wav")
                    scenes.append(kokoro_scene(text, p))
                    files.append(os.path.basename(p))
                result = {"engine": "kokoro", "files": files, "scenes": scenes}
            else:
                if engine == "gemini":
                    try:
                        final, dur, items = single_take_gemini(spec, out)
                    except Exception as e:  # a bad take (cut short, skipped lines) is usually fine on the second try
                        print(f"gemini take 1 failed: {e}", file=sys.stderr)
                        final, dur, items = single_take_gemini(spec, out)
                else:
                    final, dur, items = await single_take_edge(spec, out)
                result = {"engine": engine, "single": True, "file": os.path.basename(final), "duration": round(dur, 3),
                          "scenes": by_scene(items, len(spec["scenes"]))}
            json.dump(result, open(os.path.join(out, "words.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print(f"voice engine: {engine}", file=sys.stderr)
            return
        except Exception as e:
            print(f"{engine} voice failed: {e}", file=sys.stderr)
    raise SystemExit("every voice engine failed")


asyncio.run(main())
