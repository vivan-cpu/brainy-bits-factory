"""Voice agent: one Edge TTS call per scene, with exact word timestamps.
Usage: python tts.py <spec.json> <out_dir>
Writes <out_dir>/scene_<k>.mp3 and <out_dir>/words.json ({"scenes": [[{w,s,e}...], ...]})
"""
import asyncio, json, sys, os
import edge_tts

VOICE = os.environ.get("BRAINY_VOICE", "en-US-AndrewMultilingualNeural")
RATE = os.environ.get("BRAINY_RATE", "+6%")


async def speak(text, path):
    for attempt in range(4):
        try:
            words = []
            c = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
            with open(path, "wb") as f:
                async for ch in c.stream():
                    if ch["type"] == "audio":
                        f.write(ch["data"])
                    elif ch["type"] == "WordBoundary":
                        s = ch["offset"] / 1e7
                        words.append({"w": ch["text"], "s": round(s, 3), "e": round(s + ch["duration"] / 1e7, 3)})
            if words and os.path.getsize(path) > 1000:
                return words
        except Exception as e:  # network hiccups
            print(f"tts retry {attempt + 1}: {e}", file=sys.stderr)
        await asyncio.sleep(3 * (attempt + 1))
    raise RuntimeError(f"TTS failed for: {text[:60]}")


async def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    scenes = []
    for k, sc in enumerate(spec["scenes"]):
        scenes.append(await speak(sc["narration"], os.path.join(out, f"scene_{k}.mp3")))
    json.dump({"scenes": scenes}, open(os.path.join(out, "words.json"), "w"), indent=1)


asyncio.run(main())
