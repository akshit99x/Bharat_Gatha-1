#!/usr/bin/env python3
"""
Pre-render the game's spoken lines with a neural voice (Piper), so every player hears the same
natural-sounding Indian-accented English whatever their device offers.

    node scripts/voices.mjs export /tmp/lines.json
    python3 scripts/voices_render.py --lines /tmp/lines.json --model en_US-l2arctic-medium.onnx \
        --out public/voices/generated

The model is Piper's "l2arctic" voice, trained on L2-ARCTIC (CC BY-NC 4.0, non-commercial, attribution
required: see public/CREDITS.md). It has four speakers whose first language is Hindi, which is what
gives the lines their Indian-English accent. Each character is given one of the four, a pace and a small
pitch shift, chosen from their name so the same character always sounds the same.

Needs: pip install piper-tts, ffmpeg on the PATH.
"""

import argparse
import json
import subprocess
import sys
import wave
from pathlib import Path

# L2-ARCTIC speakers whose first language is Hindi, with the model's speaker ids.
HINDI_SPEAKERS = {"SVBI": 2, "TNI": 9, "ASI": 10, "RRBI": 19}
ORDER = ["SVBI", "ASI", "TNI", "RRBI"]


def fnv(text: str) -> int:
    h = 2166136261
    for ch in text.encode("utf-8"):
        h = ((h ^ ch) * 16777619) & 0xFFFFFFFF
    return h


def style_for(speaker: str) -> dict:
    """Which voice, how fast, how high. Maitri and Ekarupa are fixed; everyone else comes from the name."""
    if speaker == "Maitri":
        return {"who": "SVBI", "length": 1.06, "pitch": 1.0}
    if speaker == "Ekarupa":
        # Lower, slower and a little too smooth.
        return {"who": "ASI", "length": 1.16, "pitch": 0.93}
    h = fnv(speaker)
    return {
        "who": ORDER[h % 4],
        "length": 0.94 + ((h >> 4) % 100) / 100 * 0.16,
        "pitch": 0.93 + ((h >> 11) % 100) / 100 * 0.14,
    }


def render(voice, text: str, who: str, length: float, wav_path: Path) -> None:
    from piper import SynthesisConfig

    cfg = SynthesisConfig(
        speaker_id=HINDI_SPEAKERS[who],
        length_scale=length,
        noise_scale=0.62,
        noise_w_scale=0.75,
    )
    with wave.open(str(wav_path), "wb") as wf:
        voice.synthesize_wav(text, wf, syn_config=cfg)


def finish(wav: Path, mp3: Path, pitch: float) -> None:
    """Pitch shift (keeping the pace), level, trim, and store as a small mono MP3."""
    rate = int(22050 * pitch)
    chain = [
        "highpass=f=70",
        f"asetrate={rate}",
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
    ap.add_argument("--model", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--limit", type=int, default=0, help="render only the first N lines (for trying it out)")
    ap.add_argument("--only", default="", help="render only these speakers, comma separated")
    args = ap.parse_args()

    from piper import PiperVoice

    voice = PiperVoice.load(args.model)
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

    for n, row in enumerate(rows, 1):
        key = row["key"]
        mp3 = out / f"{key}.mp3"
        st = style_for(row["speaker"])
        wav = tmp / f"{key}.wav"
        try:
            render(voice, row["spoken"], st["who"], st["length"], wav)
            finish(wav, mp3, st["pitch"])
        except Exception as e:  # keep going; one bad line must not stop the batch
            print(f"[{n}/{len(rows)}] FAILED {row['id']} {row['speaker']}: {e}", file=sys.stderr)
            continue
        finally:
            wav.unlink(missing_ok=True)
        clips[key] = mp3.name
        if n % 20 == 0 or n == len(rows):
            print(f"[{n}/{len(rows)}] {row['speaker']} -> {st['who']}", flush=True)
            json.dump({"version": 1, "voice": "piper en_US-l2arctic-medium (Hindi-L1 speakers)", "clips": clips},
                      open(manifest_path, "w"), indent=1)
    json.dump({"version": 1, "voice": "piper en_US-l2arctic-medium (Hindi-L1 speakers)", "clips": clips},
              open(manifest_path, "w"), indent=1)
    tmp.rmdir()
    print(f"{len(clips)} clips in {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
