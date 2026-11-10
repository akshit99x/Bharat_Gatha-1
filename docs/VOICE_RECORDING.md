# Voices: what the game ships, and how to replace it with real recordings

**Current state.** No human recordings yet. The game ships with **two sets of pre-rendered neural voices** for
all 480 spoken lines (`public/voices/clear/` and `public/voices/accent/`, made with Piper), so every player
hears the same voice on any device. Human recordings, if they are ever made, take priority over both, one line
at a time. Nothing in this document needs to be done for the game to work.

## The two generated sets

| | **Clear** (default) | **Accent** |
|---|---|---|
| Sounds like | natural British English | English with an Indian accent |
| Voices | Maitri: `en_GB-cori-high` (public domain). Everyone else: `en_GB-aru-medium`, 11 speakers (CC BY 4.0) | `en_US-l2arctic-medium`, the four Hindi-first-language speakers (CC BY-NC 4.0) |
| Ekarupa | the deepest ARU speaker, slower | a lower pitch, slower |
| Word error (speech recogniser, 102 lines) | **9.2%** | 24.5% |
| Commercial use | allowed (with attribution) | **not allowed** |

I could not listen to either. The word error rate is a speech recogniser's, so it is a fair measure of
*clarity*, not of how pleasant they sound. The accent set is much harder to follow because the corpus behind it
is recordings of non-native speakers, which makes a weaker voice model; that is why Clear is the default.

- **Priority:** human recording, then the chosen generated set, then the device's own voice. In Settings,
  "Voice style" offers Auto, Clear, Accent and Device. **Auto** uses Clear, unless the device has a natural
  Indian-English voice of its own (for example Windows "Neerja Online (Natural)"), in which case it uses that.
- **Each character** keeps the same voice every time: it is chosen from their name, with a small pace and pitch
  difference, so two characters sharing a base voice still sound distinct.
- **Re-rendering** (after the script changes): each set needs the Piper models in one folder.
  ```bash
  node scripts/voices.mjs export /tmp/lines.json
  pip install piper-tts        # needs ffmpeg too; download the models from huggingface.co/rhasspy/piper-voices
  python3 scripts/voices_render.py --lines /tmp/lines.json --models ./piper-models --cast clear  --out public/voices/clear
  python3 scripts/voices_render.py --lines /tmp/lines.json --models ./piper-models --cast accent --out public/voices/accent
  ```
  Lines are matched by speaker and exact wording; `--only "Maitri,Ekarupa"` re-renders just some speakers.

## If you do record real voices later

The game speaks through your browser's built-in synthesiser. On a laptop with good Indian-English
voices installed (Windows 11 "Neerja / Prabhat Online (Natural)", Chrome on Android, macOS "Rishi" or
"Lekha") that is decent. On everything else it sounds like a machine, and it sounds different on every
device. Recordings fix both problems.

**How it works now.** If a recording exists for a line, the game plays it. If it does not, the
synthesiser says that line. So recordings can arrive in any order, a few at a time, and the game is
always complete.

## The numbers

Everything the game says aloud is listed in [`docs/voice/script.csv`](voice/script.csv): **480 lines,
80 speakers, about 89 minutes** of finished audio. There is one printable page per speaker in
[`docs/voice/by-speaker/`](voice/by-speaker/), and an index in [`docs/voice/README.md`](voice/README.md).

| Tier | Who | Lines | Audio | Why |
|---|---|---:|---:|---|
| **1. The two voices you hear most** | Maitri, Ekarupa | 176 | ~33 min | They speak at every chapter start, every restoration and the finale. If only these are real, the game already feels different. |
| **2. The ten historical figures** | Krishna, Ashoka, Aryabhata, Akbar, Shivaji, Vibhishana, Nachchiyar, Kavi Sumant, Dr. Ila Rao, Dr. Shalini Deshpande | 64 | ~26 min | The long dialogue challenges. These are the lines students listen to most closely. |
| **3. The people of the island** | 68 villagers, smiths, children, traders | 240 | ~30 min | Short, 3 to 7 lines each. Easy to share across a few friends. |

My recommendation: **record Tier 1 and Tier 2 with real people (about 60 minutes of speech, 240
lines), and leave Tier 3 to the synthesiser or fill it in later.** Casting does not have to match
anyone's age or gender: the game never states a gender for any character. Maitri should sound warm
and unhurried. Ekarupa should sound smooth, a little too agreeable, in the same voice for both
"masks" (the flattering Gilder and the dismissive Eraser): the difference is in the words.

## What the recorder does

1. Open that speaker's page in `docs/voice/by-speaker/` (for example `MAITRI.md`). Each row has an
   **ID**, where the line is heard, and the words to say.
2. Record each line as its **own file** and name it with the ID: `MAITRI-0042.wav`.
   Say the line the way it is written: the spelling of Indian names is already chosen.
3. A phone is fine. Quiet room, soft furnishings (a wardrobe full of clothes is a good booth), phone
   about a hand's width from the mouth, a little to the side so breath does not pop. Keep the same
   position and room for a whole session. WAV, M4A, MP3 or OGG all work.
4. If you slip, record the entire line again. Do not worry about silence before or after, or loudness:
   the import step trims and levels each file.
5. Put the files in one folder (subfolders are fine) and send it.

Each recorder should do one sitting per speaker so the voice stays consistent. About 40 minutes of
speech takes roughly two to three hours including retakes.

## What happens to the files (what I do, or you can)

```bash
npm run voices:script                # regenerate the lists (only needed after the script changes)
npm run voices:import path/to/folder # trims, levels, converts to small mono MP3s, installs them
npm run voices:check                 # shows coverage per speaker
```

`voices:import` needs `ffmpeg` to tidy files. Without it, files are copied as they are. The clips land
in `public/voices/` and are listed in `public/voices/manifest.json`; commit both. Size is about 0.7 MB
per minute, so all 89 minutes is roughly 60 MB. Tier 1 and Tier 2 together are about 40 MB.

### If the script changes

A recording is matched to the **exact words and the speaker**. If a line is reworded, its old
recording stops matching and the game goes back to the synthesiser for that line, so it never plays
the wrong words. `npm run voices:check` lists any such recordings, and `npm run voices:script` gives
the reworded line a new ID to re-record.

## Upgrading the generated voices

The Piper voices are free and run offline, but a cloud neural voice (Azure Neural `en-IN-NeerjaNeural` and
`en-IN-PrabhatNeural`, or Google Cloud `en-IN-Neural2`) has a true Indian-English accent and is more natural
still. It uses the same pipeline: render the 480 clips once into `public/voices/clear/` (same file names,
same manifest). The whole script is about 75,000 characters, inside those services' free tiers. It needs an API
key, which belongs in the tool that renders the files and never in the repository. These services' terms
also permit commercial use, which the Piper voice data does not.

## Sound effects and music

Everything else you hear (music, ambience, footsteps) is generated by the game itself. There are no
audio files to license. If you want to add recordings of real places or instruments, use sources that
permit it (CC0 or your own recordings) and note them in `public/CREDITS.md`.
