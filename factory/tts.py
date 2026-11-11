"""Voice agent. One audio file per scene + word timestamps.
Usage: python tts.py <spec.json> <out_dir>
Engines (BRAINY_TTS): edge (Microsoft Edge voices, exact word timings), kokoro (offline, runs anywhere), auto (edge, else kokoro).
Writes <out_dir>/words.json = {"engine": ..., "files": [...], "scenes": [[{w,s,e}...], ...]}
"""
import asyncio, json, sys, os, re

ENGINE = os.environ.get("BRAINY_TTS", "auto")
EDGE_VOICE = os.environ.get("BRAINY_VOICE", "en-US-ChristopherNeural")
EDGE_RATE = os.environ.get("BRAINY_RATE", "+8%")
EDGE_PITCH = os.environ.get("BRAINY_PITCH", "-3Hz")
KOKORO_DIR = os.path.expanduser(os.environ.get("KOKORO_DIR", "~/kokoro"))
KOKORO_VOICE = os.environ.get("KOKORO_VOICE", "am_onyx")
KOKORO_SPEED = float(os.environ.get("KOKORO_SPEED", "1.1"))


async def edge_scene(text, path, tries):
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
    # Kokoro gives no timestamps: spread words across the clip by length (good enough for captions)
    toks = [re.sub(r"^[^\w']+|[^\w'%]+$", "", t) for t in text.split()]
    toks = [t for t in toks if t]
    weights = [len(t) + 2 for t in toks]
    total = sum(weights)
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
    scenes, files, engine = [], [], ENGINE
    if engine == "auto":
        try:
            await edge_scene(spec["scenes"][0]["narration"], os.path.join(out, "probe.mp3"), 1)
            engine = "edge"
        except Exception:
            print("edge unavailable here, using kokoro", file=sys.stderr)
            engine = "kokoro"
    for k, sc in enumerate(spec["scenes"]):
        if engine == "edge":
            p = os.path.join(out, f"scene_{k}.mp3")
            scenes.append(await edge_scene(sc["narration"], p, 4))
        else:
            p = os.path.join(out, f"scene_{k}.wav")
            scenes.append(kokoro_scene(sc["narration"], p))
        files.append(os.path.basename(p))
    json.dump({"engine": engine, "files": files, "scenes": scenes}, open(os.path.join(out, "words.json"), "w"), indent=1)
    print(f"voice engine: {engine}", file=sys.stderr)


asyncio.run(main())
