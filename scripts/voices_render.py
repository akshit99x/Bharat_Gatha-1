#!/usr/bin/env python3
"""
Pre-render the game's spoken lines with a neural voice (Piper), so every player hears the same
natural-sounding Indian-accented English whatever their device offers.

    node scripts/voices.mjs export /tmp/lines.json
    python3 scripts/voices_render.py --lines /tmp/lines.json --models ./piper-models \
        --cast indian --out public/voices/indian

Two casts are defined (see CASTS): "indian" (the Indian speakers of the CMU ARCTIC corpus, the game's
default) and "neutral" (British voices). Each character is given a voice, a pace and a small pitch shift
chosen from their name, so the same character always sounds the same. Lines are read slowly, with a rest
between sentences.

Needs: pip install piper-tts, ffmpeg on the PATH.
"""

import argparse
import json
import subprocess
import sys
import wave
from pathlib import Path

# Two casts. Each names the model(s) it needs, who plays Maitri and Ekarupa, and the pool everyone else
# is drawn from by name. A voice is (model key, speaker id or None). `pace` multiplies the model's own
# speaking rate (bigger = slower); the game is for learners, so lines are read slowly and clearly.
CASTS = {
    # Real Indian-English speakers: the Indian voices of the CMU ARCTIC corpus (studio recordings of fluent
    # Indian speakers reading English), used through Piper's en_US-arctic-medium model.
    # ksp, aup, gka are male; slp, axb are female.
    "indian": {
        "models": {"arctic": "en_US-arctic-medium.onnx"},
        "maitri": ("arctic", 12, 1.0, 1.0),  # slp: the clearest of the five
        "ekarupa": ("arctic", 13, 1.06, 0.94),  # aup, a little lower and slower
        "pool": [("arctic", 3), ("arctic", 12), ("arctic", 13), ("arctic", 15), ("arctic", 17)],
        "label": "piper en_US-arctic-medium (Indian speakers: ksp, slp, aup, axb, gka)",
        "base": 1.22,
    },
    # Standard British voices: neutral and clear. Maitri is the single high-quality "Cori" voice;
    # Ekarupa is the deepest of the twelve ARU speakers; everyone else is drawn from the rest.
    "neutral": {
        "models": {"cori": "en_GB-cori-high.onnx", "aru": "en_GB-aru-medium.onnx"},
        "maitri": ("cori", None, 1.0, 1.0),
        "ekarupa": ("aru", 9, 1.06, 0.97),
        "pool": [("aru", i) for i in (0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11)],
        "label": "piper en_GB-cori-high + en_GB-aru-medium",
        "base": 1.22,
    },
}


def fnv(text: str) -> int:
    h = 2166136261
    for ch in text.encode("utf-8"):
        h = ((h ^ ch) * 16777619) & 0xFFFFFFFF
    return h


def style_for(cast: dict, speaker: str) -> dict:
    """Which voice, how fast, how high. Maitri and Ekarupa are fixed; everyone else comes from the name."""
    if speaker in ("Maitri", "Ekarupa"):
        m, sid, length, pitch = cast[speaker.lower()]
        return {"model": m, "sid": sid, "length": length * cast["base"], "pitch": pitch}
    else:
        h = fnv(speaker)
        m, sid = cast["pool"][h % len(cast["pool"])]
        length = 0.97 + ((h >> 4) % 100) / 100 * 0.08
        pitch = 0.93 + ((h >> 11) % 100) / 100 * 0.14
    return {"model": m, "sid": sid, "length": length * cast["base"], "pitch": pitch}


def render(voice, text: str, sid, length: float, wav_path: Path) -> None:
    """Speak sentence by sentence and join them with real pauses, so the line breathes."""
    import numpy as np
    from piper import SynthesisConfig

    cfg = SynthesisConfig(speaker_id=sid, length_scale=length, noise_scale=0.6, noise_w_scale=0.7)
    rate = voice.config.sample_rate
    parts = []
    for chunk in voice.synthesize(text, syn_config=cfg):
        a = chunk.audio_float_array
        parts.append(a)
        # a longer rest after a full stop or question than after the shorter breaks inside a sentence
        parts.append(np.zeros(int(rate * 0.42), dtype=np.float32))
    audio = np.concatenate(parts[:-1]) if len(parts) > 1 else np.concatenate(parts)
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(pcm.tobytes())


def finish(wav: Path, mp3: Path, pitch: float, in_rate: int) -> None:
    """Pitch shift (keeping the pace), level, trim, and store as a small mono MP3."""
    chain = [
        "highpass=f=70",
        f"asetrate={int(in_rate * pitch)}",
        f"atempo={1 / pitch:.4f}",
        "aresample=24000",
        "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05",
        "areverse",
        "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05",
        "areverse",
        "loudnorm=I=-18:TP=-1.5:LRA=9",
        "adelay=80|80",
        "apad=pad_dur=0.15",
        "asetpts=N/SR/TB",
    ]
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-af", ",".join(chain),
         "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "48k", str(mp3)],
        check=True,
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lines", required=True)
    ap.add_argument("--models", required=True, help="folder holding the Piper .onnx files (and their .json)")
    ap.add_argument("--cast", choices=sorted(CASTS), required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--limit", type=int, default=0, help="render only the first N lines (for trying it out)")
    ap.add_argument("--only", default="", help="render only these speakers, comma separated")
    args = ap.parse_args()

    from piper import PiperVoice

    cast = CASTS[args.cast]
    voices = {k: PiperVoice.load(str(Path(args.models) / f)) for k, f in cast["models"].items()}
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    tmp = out / ".tmp"
    tmp.mkdir(exist_ok=True)

    rows = json.load(open(args.lines, encoding="utf-8"))
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    if only:
        rows = [r for r in rows if r["speaker"] in only]
    if args.limit:
        rows = rows[: args.limit]

    manifest_path = out / "manifest.json"
    clips = {}
    if manifest_path.exists():
        clips = json.load(open(manifest_path)).get("clips", {})

    def save() -> None:
        json.dump({"version": 1, "voice": cast["label"], "clips": clips}, open(manifest_path, "w"), indent=1)

    for n, row in enumerate(rows, 1):
        key = row["key"]
        mp3 = out / f"{key}.mp3"
        st = style_for(cast, row["speaker"])
        voice = voices[st["model"]]
        wav = tmp / f"{key}.wav"
        try:
            render(voice, row["spoken"], st["sid"], st["length"], wav)
            finish(wav, mp3, st["pitch"], voice.config.sample_rate)
        except Exception as e:  # keep going; one bad line must not stop the batch
            print(f"[{n}/{len(rows)}] FAILED {row['id']} {row['speaker']}: {e}", file=sys.stderr)
            continue
        finally:
            wav.unlink(missing_ok=True)
        clips[key] = mp3.name
        if n % 40 == 0 or n == len(rows):
            print(f"[{n}/{len(rows)}] {row['speaker']} -> {st['model']}:{st['sid']}", flush=True)
            save()
    save()
    tmp.rmdir()
    print(f"{len(clips)} clips in {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
