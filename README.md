# भारत गाथा · Bharat Gatha

**Chronicles of a Civilisation** — an open-world, first-person learning game about Indian
civilisation, history and culture.

Built for **Smart India Hackathon, problem statement 26208** (Student Innovation — toys and games
based on our civilisation, history and culture).

---

## Run it

You need **Node 18 or newer** (check with `node -v`) and a browser with **WebGL 2** — any current Chrome, Edge, Firefox or Safari. Chrome or Edge give the best voices.

```bash
git clone https://github.com/meharraviarora-lab/Bharat_Gatha.git
cd Bharat_Gatha
npm install
npm run dev
```

Then open the address it prints, normally **http://localhost:5173**. Click **Board the Pushpaka Vimana**. Use headphones if you can, and click the page once so the browser allows sound and voices.

```bash
npm run build      # static bundle in dist/, deployable to any static host
npm run preview    # serve the built bundle at http://localhost:4173
npm run typecheck  # strict TypeScript, no emit
```

If it runs slowly, open the pause menu (`Esc`) and switch off **Shadows**. If you hear no voices, the pause menu says which voice your device is using and how to install an English (India) one. To start again from nothing, clear this site's data in your browser (the save lives in `localStorage` under `bharat-gatha/profile/v1`).

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

## Sound, light and people

**Music.** Every region has its own score, generated live in the browser — there are no audio files. Each
theme is a raga with its own pakad phrases, a taal with real bols, instruments (bansuri, sitar, veena,
sarangi, santoor, shehnai, pakhawaj, tabla, manjira, tanpura) and a room. The Composer opens a piece with
an unmetered alap that settles on Sa, then moves into a metered gat in call-and-response. Crossing a
region border crossfades to the next theme; the title screen and the vimana flight have their own.
Pads and drones are checked against the raga's scale in code, and each theme's level is calibrated by
rendering it offline and measuring it, so nothing is louder than anything else.

**Ambience.** Beneath the music sits a bed of place: surf and gulls on the Setu, the river and koel in
Kosala, wind over Kurukshetra, a forge in Chola country, a fountain and a bazaar crowd in Agra, crickets
at dusk. Music has its own volume slider; `Esc` → Settings.

**Places that sound like places.** Walk toward a stepwell and you hear water; toward a bronze foundry,
the forge; toward a harbour, surf and gulls; toward a temple, its bells; through a bazaar, the crowd.
These are positioned sources, so they come from the right direction and fade with distance. Footsteps
change with the ground: stone, sand, grass, bare earth, water.

**People.** NPCs are not statues. Each has a role-based routine (smiths hammer, scribes write, dancers
rehearse, children and water-carriers wander), turns to face you when you speak, offers a short remark as
you pass, and wears a nameplate that shows a mark when they have something to tell you. Spoken lines use
the browser's Indian-English voices where the device has them.

**Voices.** All 480 spoken lines ship pre-rendered with a neural voice (Piper), read slowly and clearly, in two
sets: **Indian** (real Indian-English speakers from the CMU ARCTIC corpus, the default) and **Neutral** (British
English), so every player hears the same voice on any device. Settings → "Voice style" switches between them or
to the device's own voice; Auto keeps the device's voice when it has a natural Indian-English one. A human
recording of a line, if one is ever added, takes priority (`npm run voices:script`, `voices:import`,
`voices:check`). Licences, measurements and how to re-render: [`docs/VOICE_RECORDING.md`](docs/VOICE_RECORDING.md).

**Moving.** Staircases are climbable (their colliders are real stairs); rotated buildings collide as the
rectangles they are, not as their bounding boxes; walking into a ledge up to about a metre high hops you
onto it; the view eases over steps instead of jolting; the camera stops short of hillsides.

**Life in the world.** Flocks of birds wheel overhead, and grass and wildflowers sway underfoot.

**The Journey screen (`M`).** One screen, three tabs: **Map** (the island, regions, fast travel, what is
discovered and what is not), **Roadmap** (all eleven chapters, what each still needs, and the next step
for the one you are in) and **Guide** (controls, and a checklist that tracks your first steps).

**Graphics.** Stone and terrain carry world-space weathering that varies hue and wear so no two walls read
as the same texture; foliage sways in a gust field, and a recycled field of grass and wildflowers grows
out of the ground's own colour around the player. The sea knows its own depth — turquoise shallows,
deep blue, lines of surf at the shore, and the sand showing through thin water. A post-processing chain
adds bloom, sun shafts, a gentle warm/cool grade, vignette and grain over a multisampled HDR target.
"Cinematic lighting" in Settings turns it off, and it steps itself down on slow machines.

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

## The challenges

Every challenge is a real game, never a quiz in disguise. None of them can be failed outright; the ones that
can be lost just offer another go. A wrong move explains itself, and the score only decides how much Vidya you
earn, never whether you can go on.

| Kind | Challenges | How it plays |
|---|---|---|
| **Sequence** | 10 | Drag or keyboard-reorder cards into order. A check says how many are in the right place, never which. On success the timeline unfolds with each step's date and detail |
| **Script matching** | 5 | Pick a sign, then its meaning; a line draws between them. After two misses on one sign, the right answer pulses |
| **Assembly** | 7 | Isometric blocks at their real relative sizes onto ordered steps. A piece for a later step says what must come first. A finished build is "switched on" — water through a drain, light through a monument |
| **Trade** | 3 | A pan balance that is a damped-spring simulation. Set a quantity with the period's own weights, load goods until it hangs level. Scored on how few weights you used — which is why a binary series makes a good standard |
| **Pattern** | 3 | Paint a design under mirror, four-fold or rotational symmetry. A finished design proves itself by turning or flipping |
| **Archery** | 3 | A ballistics range in perspective: aim with breath sway, draw to full, arrow drop over distance, wind on the pennant, moving targets. A miss says why. Drona's test only scores the eye |
| **Gathering** | 1 | A meadow of labelled plants, genuine and look-alike. A look-alike goes back with the reason it is wrong |
| **Conversation** | 10 | The dialogue box, with ethical choices that never punish |

`validateMiniGames()` runs at startup and checks every challenge's data — whether the weights can make the
target, whether the symmetry contradicts itself, whether every socket has a piece. It has already caught a
pattern that could not have been completed.

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
  core/music/    Procedural score: ragas, taals, instruments, composer, ambience, conductor
  render/        Post-processing chain (bloom, sun shafts, grade) with adaptive quality
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

**Mini-games:** all eight challenge kinds are playable — 42 challenges in total.

**Not built yet:** nothing from the original plan.

**What could come next:** archery in the 3D world rather than on a range view; recorded voices for the key lines;
a full Hindi text option (the setting exists, the translated content does not); a teacher view over the exported
learning records; more regions on the same engine.

---

## Content sources

Written from standard academic scholarship on each period. Where a claim is contested the entry says
so rather than picking a side; where a date is approximate it is marked approximate. Specific things
worth checking if you are extending it: the Harappan weight series and brick ratios, the Uttaramerur
inscriptions, Ashoka's Major Rock Edicts 12 and 13, the Thanjavur construction, Aryabhata's
`asanna`, the Jantar Mantar instrument functions, and the Vijayanagara survey. The `debate`-tagged
entries are the ones to read first — they are where the interesting history is.

## Testing movement

`scripts/tests/` holds three Playwright scripts that drive the real player controller (`npm i -D playwright`, run
`npm run dev`, then `node scripts/tests/walk.mjs`): **walk** (walks 8 directions from every interactable and a
grid of land, and reports trapped or popping spots), **climb** (approaches every landmark) and **vault**
(ledges of several heights, rotated and not).
