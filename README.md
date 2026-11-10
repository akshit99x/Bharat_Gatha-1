# भारत गाथा · Bharat Gatha

**Chronicles of a Civilisation** — an open-world, first-person learning game about Indian
civilisation, history and culture.

Built for **Smart India Hackathon, problem statement 26208** (Student Innovation — toys and games
based on our civilisation, history and culture).

---

## Run it

```bash
npm install
npm run dev
```

Then open the printed URL. It needs a browser with WebGL 2 — any current Chrome, Edge, Firefox or
Safari.

```bash
npm run build      # static bundle in dist/, deployable to any static host
npm run typecheck  # strict TypeScript, no emit
```

There are **no asset files**. Every monument, tree, boulder and person is generated from code at
load time, and all the audio is synthesised with the Web Audio API. The whole thing is about
290 KB gzipped, which matters when the target user is a school laptop on a shared connection.

---

## What it is

One island, 3.6 km across, holding eleven regions of Indian history side by side. You arrive on the
Pushpaka Vimana, drop where you like, glide down, and walk.

| Chapter | Region | Period |
|--------:|--------|--------|
| 1 | Sindhu-Sarasvati (Indus/Harappan) | c. 2600–1900 BCE |
| 2 | Sumer & Dilmun | c. 3200–1750 BCE |
| 3 | Kosala & Dandaka (Ramayana) | epic tradition |
| 4 | The Setu & Lanka | epic tradition |
| 5 | Kurukshetra (Mahabharata) | epic tradition |
| 6 | Magadha (Maurya, Gupta, Nalanda) | c. 321 BCE – 1200 CE |
| 7 | The Chola Country | c. 850–1279 CE |
| 8 | Konark & the Observatory | 499–1734 CE |
| 9 | Vijayanagara (Hampi) | 1336–1565 CE |
| 10 | Agra & Sikri (Mughal) | 1526–1707 CE |
| 11 | The Hill Forts (Rajput & Maratha) | c. 1300–1818 CE |

Mesopotamia is in there on purpose. It was the Indus world's trading partner, and it left a readable
archive where the Indus did not — which is the sharpest possible way to teach what decipherment
actually requires.

### Controls

| | |
|---|---|
| Move / sprint / crouch | `W A S D` · `Shift` · `Ctrl` |
| Jump, drop from the vimana, open the canopy | `Space` |
| Interact, talk, mount a chariot | `E` |
| Step down from a chariot | `E` or `R` |
| Drive a chariot | `W/S` throttle · `A/D` steer · `Space` brake |
| Switch third/first person | `V` |
| Zoom the map | mouse wheel |
| Scan a monument (Pramana lens) | hold **right mouse** |
| Map and fast travel | `M` |
| Codex | `J` |
| The Gatha — panels, plaques, the story | `K` |
| Pause, settings, export record | `Esc` |
| Help | `F1` |
| Answer a question | `1` `2` `3` `4` |

---

## The story — *The Unfinished Scroll* (अधूरा पट)

The island holds **the Gatha**, a scroll of eleven painted panels in the style of the *pat* and *phad*
storytelling scrolls, and a haze called **the Dhundh** is smudging it. The Dhundh does one of two things
to a story: it **gilds** it into a flattering fairy-tale, or it **erases** it into a shrug. The only thing
it cannot survive is the question *"how do we know that?"* — which is the evidence-tag system the game was
already built on, so the story and the learning rules are the same thing.

You are the *Gathak*. **Maitri**, the scroll's Keeper, speaks to you from the vimana log. **Ekarupa** ("of
one form") is the Dhundh's voice: *"There is one story. Pick the nicest one."*

| Piece | What it is |
|---|---|
| **Prologue** | Captions over the opening flight — non-blocking, so the crossing never freezes for a conversation |
| **Region hooks** | The first time you stand in a region, Maitri frames it and Ekarupa tries its line. Works from any landing point; the vimana lets you drop anywhere |
| **Distortion plaques** (33) | A weathered stele beside a monument states a popular claim under a wrong or missing label. Read the codex evidence it asks for, then say where the honest version belongs: *archaeology · written source · epic tradition · debated · overstated · no evidence*. A wrong answer is never punished; it is counted quietly so the finale can lean on it |
| **Anchor beats and trails** | Each region's people react to what you complete, and one three-person trail per region makes you meet the cast |
| **Panel restoration** | Passing a chapter assessment restores its panel. Maitri asks one question where the comfortable answer and the open-minded answer differ |
| **The Gatha (`K`)** | The eleven panels, painted at runtime from each region's own palette; the people each panel remembers; trail and plaque progress |
| **The Sabha of Sources** | After three panels, Ekarupa presses one claim per restored chapter — the ones *you* found hardest — and each chapter's anchor is called as a witness |
| **The Twelfth Panel** | The last panel is blank and you write it: three things you are sure of, one you hold on tradition, one you still do not know, one name you want remembered. It is saved into the learning-record export |

Three motifs run through every region and are braided in the finale: **💧 water**, **✍️ writing**, **⚖️ measure**.

Nothing here is a score. The two counters behind the ending (comfortable picks, open-minded picks) only choose
its wording, and nothing is ever deducted. The full design, cast and chapter-by-chapter beats are in
[`docs/STORYLINE.md`](docs/STORYLINE.md).

---

## How it handles history

This is the part that was designed first.

**Every claim carries its evidence type.** Each of the 104 codex entries is tagged
`archaeology`, `text`, `epic` or `debate`, and the tag is shown on the entry. The game never lets an
epic narrative pass as an excavation report, and where historians genuinely disagree it says so and
gives both readings — the Lothal basin, the Harappan decline, Adam's Bridge, Haldighati, the dating
of the Mahabharata.

**That distinction is itself examinable.** One of the question generators picks a codex entry and
asks what kind of evidence it rests on. Knowing the difference between "we dug this up", "someone
wrote this down", "the tradition tells it this way" and "this is argued" is the single most
transferable thing a history game can teach.

**Uncomfortable things stay in.** Drona's test sits next to Ekalavya's thumb. Ashoka's edicts sit
next to the Arthashastra. Akbar's sulh-i-kul is followed by Aurangzeb reversing it, with the point
made explicitly: a tolerance that depends on one ruler's character is on loan. The Uttaramerur
inscriptions are presented as rule-bound auditable local government, *not* as "ancient democracy",
because they had property and literacy qualifications and saying otherwise is flattery.

**Myths get corrected by name.** The Taj workers' hands, the Mohenjo-daro "massacre", the Stone
Chariot as a single monolith.

---

## Architecture

```
src/
  core/          Engine services: event bus, seeded RNG, value noise, input,
                 save profile, procedural raga-based audio
  content/       ALL history and culture data — zones, codex, questions, timeline
  content/story/ The narrative: prologue, eleven chapters (hooks, plaques, trails, panels),
                 the Sabha and the endings — pure data, validated at startup
  story/         StoryEngine: every story rule (what counts as a corrected plaque, when a
                 panel can be restored, which ending is heard) with no DOM and no three.js
  world/         Terrain, sky, sea, vegetation, collision
  world/architecture/   The procedural building kit and 33 monument builders
  player/        Character controller, third-person camera rig, avatar animation
  vehicles/      Rideable chariots
  quiz/          Question bank, spaced repetition, question generators, round engine
  ui/            HUD, overlays, quiz screen, dialogue box, captions, the Gatha scroll,
                 plaque reader, Sabha, Twelfth Panel, and the procedural panel painter
```

The hard rule is that **`content/` never imports from `world/`, `player/` or `ui/`**. Adding a new
region, monument, challenge, codex entry or question is a data edit. The engine learns about it
automatically.

### Four systems worth describing

**Terrain.** The continent is not noise with a coastline carved out of it — it is *grown from the
zones*. Each zone contributes a blob of land and an explicit list of land bridges joins the ones that
should be walkable neighbours. Two zones get no bridge, which is what makes Sumer and Lanka genuine
islands, and one gets a *shoal* bridge capped just below sea level — which is how Adam's Bridge
appears in the world without anybody modelling it. Heights are baked once into a grid and sampled
bilinearly, so the player always stands on exactly the surface that is drawn.

**Procedural monuments.** A `Kit` of primitives — the two most useful being `lathe` (a profile
revolved around Y, which is exactly how a shikhara, a stupa dome, an amalaka or an onion dome is
described) and `prism` (a 2D outline extruded). Each monument merges into **one** vertex-coloured
geometry, so a whole temple is a single draw call: 82 monuments cost 82 draws. Builders also emit
axis-aligned colliders, which the world transforms into place.

**Character controller and camera.** A vertical cylinder with gravity resolved against AABBs, plus
a step-up rule that makes stairs, plinths and temple platforms work without any stair-specific
code. On top of that a small state machine: `vimana → freefall → glide → ground`, with `swim` when
you walk into the sea.

The default view is over the shoulder. The camera orbits a pivot at the character's head with the
crosshair still dead centre, so aiming, scanning and interaction all work exactly as they did in
first person — only the eye moved. Two details carry the feel: the boom shortens *instantly* when
something comes between camera and character and extends back slowly, so you never see through a
wall but the camera does not snap out in doorways; and the pivot is damped while the orientation is
not, so mouse-look stays exact while body movement is smoothed. `V` switches back to first person.

The character is seven meshes with no skeleton: each limb's geometry hangs below its group origin,
so the origin *is* the joint and a plain rotation swings it from the hip or shoulder. Walk, run,
jump, skydive, glide, swim and ride are all pose functions over a single phase counter. The body
faces where it is going rather than where the camera is looking, and drifts round to the camera
when you stand still.

**Quiz engine.** 175 authored questions plus generators that build unlimited new ones from the
timeline and codex — chronology, century-dating, region identification, era ordering, evidence type.
Selection is spaced repetition: a question you got wrong last time comes back with weight 6, an
unseen one with 3, one you have answered right three times running with 0.3. Option order is
reshuffled on every draw. Three rules are enforced in the UI rather than left to content: the
explanation shows for *every* answer; a wrong answer reveals the right one instead of letting you
guess again; and nothing is ever deducted. Failure has to be cheap or children stop taking swings at
hard questions.

**Chariots.** Twenty-two of them, parked by the landing terraces, gates and bazaars of every
region. `E` to mount. Handling is deliberately simple — speed along a heading, steering authority
that scales with speed so it cannot pivot on the spot, and the body pitched and rolled to the
ground normal sampled four ways. 0 to 21 m/s in about three seconds, roughly twice a sprint. The
collision response judges a hit by how much forward progress survived it: graze a wall and you
slide along it, drive into one and you stop. The camera swings back behind the chariot once it is
moving, unless you are actively looking around.

**The map.** Top right, north-up, with the range on the mouse wheel. The island is rendered once at
load into an offscreen canvas — coastline, biome colour and hill shading — and every frame the game
blits the piece under the player and stamps markers on top: monuments (filled once scanned),
challenges (filled once done), people, chariots and landing terraces, with region names so the map
teaches geography rather than only position. Anything in a region you have not reached yet is
dimmed.

### Other things worth knowing

- **Seeded world.** Terrain, scatter and question order all derive from one seed, so a teacher can
  hand out a seed and every student gets the same map and the same round.
- **Spoken voices.** Every conversation, caption and Sabha line is spoken through the browser's own speech
  engine, so there are still no audio files. It asks for **English (India)** voices first, then Hindi, then any
  English voice, and the pause menu says which one your device is using. Nobody is assigned a gender: each
  person gets a stable voice from a hash of their name, with a small pitch and pace shift, so the same person
  always sounds the same. Maitri is warm and unhurried; Ekarupa is lower, slower and a little too smooth. Indian
  names and terms are respelled for the voice only (Dhundh → "Dhoondh"), never on screen. The music ducks
  under speech. Best results on Edge or Chrome with an English (India) voice installed; on Windows that is
  Settings → Time & language → Speech.
- **Procedural score.** Each zone carries a raga; the drone and the sparse plucked phrases are
  generated from its swaras. No audio files, and the music never loops identically.
- **Learning record.** The save profile doubles as an exportable JSON record — per-question history,
  per-objective accuracy, time per zone, weakest skills. `Esc → Export learning record`.
- **Content validation** runs at startup and prints any unresolved codex id, dead dialogue node,
  unmatched script pair, mis-indexed answer or unsolvable weight puzzle to the console. The story
  adds its own: every plaque's evidence and landmark, every trail stop's NPC, every restoration graph,
  and the rule that each chapter offers both a comfortable and an open-minded answer.
- **Accessibility:** gentle descent (on by default), dyslexia-friendly text, head-movement toggle,
  full keyboard play for the quiz, `prefers-reduced-motion` respected.

---

## Status — what is and is not built

**Working now:** terrain and the whole island; all 82 monuments across 11 regions; the third-person
character and camera (first person on `V`) including the vimana ride, freefall, glide and swimming;
22 rideable chariots; the live corner map; collision; scanning monuments to unlock codex entries;
the codex; the region list with fast travel; 69 people to talk to; the full quiz engine with
generated questions, spaced repetition and the results breakdown; the dialogue challenges (all 11
of them, including the Gita, Ashoka after Kalinga, Vibhishana and Akbar's Ibadat Khana); pause,
settings and the learning-record export.

**Also working now:** the whole story layer described above — prologue, region hooks, 33 plaques with
in-world haze that dissolves when a claim is corrected, eleven trails, panel restoration with a
haze-lifting reveal, the Gatha scroll, the Sabha of Sources, the Twelfth Panel and three endings.

**Not built yet:** the interactive runtimes for the other six challenge kinds — archery, assembly,
pattern, script-matching, trade/weights and sequencing. All 42 challenges have their full data
written (targets, pieces, sockets, glyph pairs, weights, orderings) and their posts stand in the
world; interacting with a non-dialogue one currently shows the brief and what it teaches, says
plainly that the mini-game is not built, and runs its quiz round so the learning still happens.
Those six runtimes are the next piece of work.

---

## Content sources

Written from standard academic scholarship on each period. Where a claim is contested the entry says
so rather than picking a side; where a date is approximate it is marked approximate. Specific things
worth checking if you are extending it: the Harappan weight series and brick ratios, the Uttaramerur
inscriptions, Ashoka's Major Rock Edicts 12 and 13, the Thanjavur construction, Aryabhata's
`asanna`, the Jantar Mantar instrument functions, and the Vijayanagara survey. The `debate`-tagged
entries are the ones to read first — they are where the interesting history is.
