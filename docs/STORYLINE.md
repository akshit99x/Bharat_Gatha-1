# भारत गाथा · Bharat Gatha — Storyline Draft v0.1

**Status:** v0.1 design draft, **now built** — the prologue, all eleven chapters, the plaque mechanic, the Gatha
scroll, the Sabha and the Twelfth Panel are in `src/content/story/` and `src/story/`. Where the build differs from
this draft: plaques are read with `E` (not the lens hold); the `unsupported` and `overstated` verdicts replace the
fifth "legend" tag; the Sabha opens after three restored panels, not eleven; the panels are painted at runtime;
and the Dhundh is a veil plus in-world haze rather than a fog change. The chapter text below is the original
plan; the shipped text lives in the content files.

**Working title for the story:** *The Unfinished Scroll* (**अधूरा पट · Adhura Pat**)

---

## Part 0 — Why the game needs a story at all

What exists today is a very good *world* and a very good *learning engine*, but no *reason to go
from place to place*. The README says it directly: roaming ignores chapter order, `Save.quests` is
declared but unused, and the vimana drops you wherever you like. So the story has to satisfy four
constraints that come straight from the codebase and its rules:

1. **It must work from any landing point.** A player can drop into Hampi first. Every chapter's
   story must make sense on its own, and the overall arc must be assembled from *whichever order
   the player visits*.
2. **It must never fight the evidence rules.** The game's central rule is that every claim carries
   `archaeology / text / epic / debate`. The antagonist and the plot should *be about* that rule,
   not work around it.
3. **Failure stays cheap.** Nothing is deducted, wrong answers explain themselves. So the story
   never punishes — it *branches* and *colours* instead.
4. **It's data, not engine.** `content/` never imports from `world/`, `player/` or `ui/`. The story
   layer is therefore a set of typed data files plus a thin runtime that reads them.

---

## Part 1 — The premise (one paragraph)

India's past is a scroll painted by thousands of hands over five thousand years, in the tradition of
the *pat* and *phad* storytelling scrolls that bards once unrolled panel by panel while singing the
tale. This scroll — **the Gatha** — is kept on an island that exists outside ordinary time, where
eleven eras lie side by side. It is coming undone. A spreading haze, **the Dhundh** (धुंध, "mist"),
is smudging the panels, and it works in two ways: it either **gilds** the past into a flattering
fairy-tale or **erases** it into a shrug. You arrive on the **Pushpaka Vimana**, summoned by the
scroll's keeper, to do the one thing the Dhundh cannot survive: ask *"how do we know that?"* — and
restore each panel with evidence.

The twelfth panel is blank. It is yours.

---

## Part 2 — Tone, themes, and the rules of the story

### Tone
Warm, curious, a little wry. Never reverent in a way that stops questions, never cynical in a way
that stops wonder. The voice of a good museum guide who is also a good storyteller. Written for
12–16 year olds "without talking down" (the codex standard).

### Four themes (each one is a recurring gameplay verb)

| Theme | In the story | Gameplay verb |
|---|---|---|
| **How do we know?** | The Dhundh feeds on claims with no source | Scan → read the evidence tag → correct it |
| **Who made it?** | Monuments are remembered; makers are not | Restore a forgotten maker's name |
| **Both sides of the record** | Uncomfortable things stay in | Dialogue choices with real cost |
| **I don't know yet** | Honest uncertainty is a result, not a failure | The "Still Open" slot (Part 7) |

### Three motifs that thread through all eleven regions
These are the "callback" engine: each chapter adds a link, and the finale braids them.

- **💧 Water** — Great Bath & covered drains → Dholavira reservoir → the Setu's sea → Chola temple
  tank → Hampi's aqueducts → the Agra baoli → Maratha rock-cut cisterns. *Every civilisation's first
  serious engineering problem was water.*
- **✍️ Writing** — unreadable Indus seals → readable cuneiform → Brahmi cracked by Prinsep →
  Tamil temple inscriptions → Persian calligraphy on the Taj → the clerk's *bakhar* ledger.
  *Writing is how the dead talk to us — or fail to.*
- **⚖️ Measure** — Harappan binary weights → Mesopotamian shekel → Kautilya's standards → Chola
  land survey → the Jantar Mantar. *To measure is to agree on what's real.*

### Hard rules for writers
1. **Every story beat that states a fact is tagged** with a `SourceType`, same as the codex.
2. **The Dhundh is never "religion" or "a community".** It is a *habit of mind*. Epic chapters treat
   the tradition as living culture and never as a target; the Dhundh's lie is "this is a dig report"
   (or "this is nothing"), not "this is sacred".
3. **No villain is a real group of people.** Rulers appear as the documented people they were.
4. **Uncomfortable stays in**, with the same standard as the README: Ekalavya's thumb, Kalinga's
   numbers, the sack of Nalanda, Aurangzeb's reversal, Talikota's afternoon.
5. **No story gate is a test of memory.** Story progress comes from *doing* (scanning, choosing,
   restoring); quizzes remain the learning engine, not the plot lock.
6. **Contested = two readings.** Where the codex says `debate`, the story presents the argument and
   lets the player hold both.

---

## Part 3 — The cast

### The Keeper — **Maitri** (मैत्री)
Voice in the vimana's log and, later, a presence in the world. Dry, kind, precise. Not a god, not a
ghost: she is the scroll's *most recent* keeper, a lineage of archivists that goes back to whoever
first wrote something down. She never gives the answer; she asks what the evidence is.
- **Narrative function:** tutorial voice, chapter bridges, the player's conscience about sourcing.
- **Reveal (Act IV):** she is not the first Keeper — the vimana's log lists forty-one earlier ones.
  The job has always been done by ordinary people who asked good questions.

### The Player — **the Gathak** (गाथक, "one who tells the saga")
Uses `playerName` from the save. Deliberately a blank: no gender, age, region or faith. Maitri
addresses them by name or "Gathak". (Avoids pronoun assumptions in all scripted text — write in
second person.)

### The Antagonist — **Ekarupa** (एकरूप, "of one single form")
The Dhundh is not a person, but it **speaks** through a voice the player begins to hear around
Chapter 3. Ekarupa's whole philosophy: *"There is one story. Pick the nicest one."*
It wears two masks:

| Mask | What it does | Its lines sound like | The truth it hides |
|---|---|---|---|
| **The Gilder** (सुनहरा) | Makes the past flattering | "Nothing was ever wrong here." / "Our ancestors had it all." | Real societies had cost, limits, argument |
| **The Eraser** (मिटाने वाला) | Makes the past meaningless | "It's all myth." / "Nobody can know." | Evidence exists; uncertainty has *shape* |

Why this works for the game: **the two masks cancel any attempt to pick a side.** A player who just
believes everything is Gilded; a player who just doubts everything is Erased. The only way through
is the game's own method — read the evidence tag.

**Twist (Act IV):** Ekarupa isn't invading. It grows wherever *anyone, including the player,*
chooses the comfortable version over the sourced one. The game quietly tracks this (Part 6) and
reflects it back at the finale without ever deducting anything.

### Anchor Voices — existing NPCs promoted to story roles
The game already has 69 people. The story reuses them rather than adding a cast of strangers.
Each chapter has one **Anchor** who carries the arc:

| Ch | Anchor | Existing role | Story role |
|---|---|---|---|
| 1 | **Bhadra** | Drain inspector | First "forgotten maker" — a salaried municipal worker |
| 2 | **Ea-nasir** + **Nin-shubur** | Copper merchant / junior scribe | The man behind the world's most famous complaint tablet; the girl who can read it |
| 3 | **Revati** | Potter of Ayodhya | Keeper of "which Ramayana?" |
| 4 | **Nala** + **Dr. Meena Fernando** | Engineer of the crossing / marine geologist | Epic builder ↔ modern surveyor, one conversation across time |
| 5 | **Sanjaya** | Narrator to the blind king | The original "reliable narrator" problem |
| 6 | **Sunita** | Stonecutter of the pillar works | "We only carved it" — the maker who isn't in the edict |
| 7 | **Kunjaramallan** | Sthapati | The named architect, who signed his work in stone |
| 8 | **Jagannatha Samrat** | Court astronomer to Jai Singh | A scholar who translated Euclid and Ptolemy into Sanskrit |
| 9 | **Mallappa** + **Nuniz** | Stone mason / Portuguese horse-trader | Local and foreign eyewitness of the same city |
| 10 | **Amanat Khan** + **Puran** | Calligrapher / marble cutter | The signed hand and the unsigned hand |
| 11 | **Sakhubai** | Keeper of the cisterns | Water, again, as the quiet reason forts hold |

*(Each Anchor already has lines in `zones/*.ts` / `npcs.ts`. New story dialogue is additive; existing
lines are not touched.)*

---

## Part 4 — Structure at a glance

```
PROLOGUE  The Vimana ........................ tutorial + premise
ACT I     What the ground remembers ......... Ch 1 Sindhu · Ch 2 Sumer & Dilmun
ACT II    What the people told .............. Ch 3 Kosala · Ch 4 Setu & Lanka · Ch 5 Kurukshetra
ACT III   What the stone says ............... Ch 6 Magadha · Ch 7 Chola · Ch 8 Konark
ACT IV    Who was left out .................. Ch 9 Hampi · Ch 10 Agra · Ch 11 Hill Forts
FINALE    The Sabha of Sources .............. personalised cross-examination
EPILOGUE  The Twelfth Panel ................. the player's own panel (learning record export)
```

Each Act has a **different evidence type in the foreground**, so the player's "method" deepens:
Act I → archaeology, Act II → epic tradition, Act III → written sources & inscriptions, Act IV →
debate (conflicting records and silences).

### The Pramana parallel (framing for the lens)
The Pramana Lens is already in the toolbelt. Classical Indian epistemology names the valid *means of
knowing* (pramanas): direct perception, inference, testimony, and others. Loosely and *not* as an
exact mapping, the four evidence tags rhyme with them:

| Game tag | Echoes the idea of |
|---|---|
| Archaeology | *pratyaksha* — what can be directly perceived/dug up |
| Debate | *anumana* — inference, where reasoning is doing the work |
| Written source | *shabda* — testimony of a source |
| Epic tradition | *itihasa/parampara* — the transmitted tradition |

Maitri should say it as "rhymes with", never "equals". (Flag for a historian-of-philosophy check.)

---

## Part 5 — Prologue: The Vimana

**Setting:** the existing vimana ride (`startRide`, ~52 s) — currently silent except for a toast.

**Beats**
1. *Black screen, tablas and a drone.* Maitri: *"Gathak. Good — it worked. I wasn't sure anyone
   would answer."*
2. The canopy shows the island from above, with **grey smudges** (the Dhundh) hanging over the
   regions. The player's own picked landing zone is *clear*, the others vary.
3. Maitri explains the Gatha and hands over **three tools** (all already in the HUD toolbelt):
   - 🏹 **Gandiva** — "for the things that need precision"
   - 🔨 **Shilpa tools** — "for rebuilding what was broken"
   - 🔍 **Pramana Lens** — "the one that matters. Hold right-click on anything old and it tells you
     *how* we know it, not just *what* it is."
4. First line of the Dhundh (Ekarupa is not named yet): *a whisper on the wind* — "There's no need to
   check. Just enjoy it." Maitri: *"Don't listen. Land."*
5. **Landing variant** — Maitri's final line changes by zone (11 lines in data). e.g., land in Hampi:
   *"Of all places to start. That's the one with an afternoon in it. Walk gently."*

**Implementation:** one `StoryBeat` per prologue line, fired by the existing ride start event.

---

## Part 6 — The two invisible meters (never shown as scores)

These produce the *colour* of the ending without ever being a grade.

- **Comfort Picks** — count of dialogue choices *not* flagged `wise` (the field already exists on
  `DialogueNode.choices`). A pick isn't "wrong"; it just is the comfortable one.
- **Open Questions** — count of times the player opts to leave something marked `debate` as
  unresolved ("I'm not sure yet") instead of forcing a verdict.

At the finale Maitri reads these back kindly: *"You took the easy road four times. So did I, the
first season. Notice it; that's all."* Both numbers feed the epilogue's wording and **never** reduce
Vidya.

---

## Part 7 — New mechanic: **Distortion Plaques** (विकृति)

This is the one new interactive system the story needs, and it reuses the code that already exists.

**What it is:** inside each region, 2–3 weathered plaques stand near monuments. Each states a popular
claim *with the wrong evidence tag* (or none). The Dhundh clings to them as a visible grey haze.

**How it plays:**
1. Hold right-mouse with the Pramana Lens on a plaque. The haze thins and the plaque's real claim
   and its (wrong) tag appear.
2. Pick the correct tag from four (`archaeology / text / epic / debate`), then optionally a
   one-line correction.
3. Correct → the haze lifts, Vidya +, and the **correction is written on a thread** in the Gatha
   panel. Incorrect → Maitri explains why, the plaque stays, no penalty, try again.

**Why it's cheap to build:**
- Tag set: `SOURCE_LABEL` / `SOURCE_NOTE` already in `types.ts`.
- Interaction: the same scan hold as landmarks.
- Question content: reuses the evidence-type question generator in `quiz/generators.ts`.
- New data: a `DistortionPlaque` type (claim, shownTag, trueTag, correction, codexId).

**Example plaques** (full list in each chapter below):
- *"Mohenjo-daro was destroyed in a massacre."* shown as **archaeology** → true tag **debate**
  (the "massacre" reading from the 1940s was later contradicted; the skeletons are not a single
  event). Already corrected by name in the README.
- *"The Taj's workers had their hands cut off."* shown as **text** → no contemporary record
  supports it; it resolves to **"no evidence found"** (see the open design question below).
- *"Uttaramerur was an ancient democracy."* shown as **text** → text is right but the *claim*
  overreaches; the plaque asks the player to find the property/literacy qualifications.

> **Open design question:** `SourceType` has no tag for "later folklore / popular myth". The Taj
> workers' hands and the Stone Chariot monolith are *not* epic tradition. Options: (a) add a fifth
> tag `legend`, (b) reuse `debate`, (c) plaques have a separate "this is not supported" outcome.
> Recommendation: **(c)** — plaques can resolve to "no evidence found", which is itself a lesson.

---

## Part 8 — The chapters

Format for each chapter: **Hook → The Dhundh's version → The Anchor → Story beats (mapped to
existing challenges) → Plaques → Forgotten Maker → Side quests → Choice → Panel & seal → Bridge.**

*All quest titles below use `Save.quests` ids of the form `ch<N>.<slug>` (Part 9).*

---

### ACT I — What the ground remembers

#### Chapter 1 · Sindhu-Sarasvati · c. 2600–1900 BCE · *"The Silent City"*

**Hook.** Landing Terrace. The air is *clean* — this is the clearest the Dhundh has left any
region — which is wrong. Maitri: *"Everything here is quiet. Nobody wrote anything we can read. The
Dhundh doesn't bother, because there's nothing to gild or erase. It just… waits."*

**The Dhundh's version.** Two at once: the Gilder's "the Indus cities were a perfect utopia, no
rulers, no wars" and the Eraser's "nobody can know anything about them".

**Anchor: Bhadra** (Drain inspector). Maitri's first lesson is not a king but a *municipal
employee*: "Somebody decided this job was worth wages. Now ask yourself what kind of city does that."

**Beats**
1. **The Balance at the Bead Shop** (trade) — measure with cubical weights. *Motif ⚖️: introduced.*
2. **Lay the Covered Drain** (assembly) — *Motif 💧: introduced.* Bhadra will not let you place the
   last slab until you clear the soak-pit.
3. **The Sealmaker's Table** (script match) — Maitri: *"Here is the honest lesson of the whole
   island: this is a language we cannot read."*
4. **Why Did the Cities Empty?** (dialogue) — a `debate` chapter climax: shifting rivers, trade
   collapse, climate, no single cause. The player is asked to hold more than one reading.

**Plaques**
- *"A massacre destroyed Mohenjo-daro."* → resolves as `debate`; see the README's "Myths get
  corrected by name".
- *"The Indus script has been fully deciphered."* → resolves "no": decipherment claims exist, none
  is accepted by consensus.
- *"Harappan cities had kings and palaces like Egypt."* → resolves `debate` (no unambiguous palace
  or royal burial has been identified).

**Forgotten Maker.** Bhadra — and the *anonymous* sealmaker whose seal shows up again in Chapter 2.

**Side quests** (new, small)
- **"The Toy Shelf"** — find Nilu's clay bull, a wheeled cart and a bird-whistle (collect).
  Maitri: *"Children's things are the best evidence of what a society valued."*
- **"Cotton, First"** — Sujata asks you to trace the cotton from field (Hemaka) to bale (dock).
  Sets up trade routes for Chapter 2.

**Choice (a Comfort/Open pick).** Maitri asks: *"Do you want me to pick the cause for you?"* —
**Yes** (comfort) or **No, tell me what each reading would predict** (open).

**Panel & seal.** Panel 1 restores as a *seal impression pressed into red clay* with a single
blank line below — "unread". Reward: the **Seal Ring** cosmetic and the Chapter 2 pointer.

**Bridge.** Hiranya hands over a **carnelian bead stamped with a boat**. Maitri: *"That boat is
going somewhere. Follow it west."* (Sindhu → Meluhha; first use of the shoal-less sea route.)

---

#### Chapter 2 · Sumer & Dilmun · c. 3200–1750 BCE · *"The Neighbours Who Wrote It All Down"*

**Hook.** Arrival by dhow at the Gulf Harbour. Maitri: *"Same period, same trade partners, opposite
problem. These people left us tablets by the tens of thousands."*

**The Dhundh's version.** The Eraser, quieter and slyer: *"See? Writing solves everything. Why would
anyone trust anything without a tablet?"*

**Anchors: Ea-nasir & Nin-shubur.** The Ur complaint tablet to the copper merchant Ea-nasir
(a customer, Nanni, complaining about poor copper ingots, c. 1750 BCE) is a real, famous, and funny
artefact. Nin-shubur is the junior scribe who has to read it back to him.

**Beats**
1. **The Scribe's Examination** (script match) — *"These signs we really can read."* Contrast with
   Chapter 1 is the point.
2. **The Meluhha Consignment** (trade) — the shekel weights; the ratios *don't quite match* the
   Indus ones. Maitri: *"Two systems of measure meeting at a dock."*
3. **How Writing Began** (sequence) — token → bulla → tablet → cuneiform.
4. **Reveal:** the carnelian boat-bead from Ch1 is a *Meluhha* (Indus) good in the Sumerian
   records. For the first time the Silent City is mentioned *by someone else*: the Indus world
   shows up in a foreign ledger.

**Plaques**
- *"Mesopotamia and the Indus were the same civilisation."* → resolves "no".
- *"Meluhha is definitely the Indus region."* → `debate` in detail, though it is the dominant
  reading; the plaque asks what evidence ties the two (Indus-type seals found in Mesopotamia;
  tablets listing Meluhhan goods).

**Forgotten Maker.** The unknown *editor* of the Ea-nasir tablet pile: the child scribes who
copied standard exercises. Nin-shubur's story.

**Side quests**
- **"A Letter of Complaint"** — rebuild the Ea-nasir complaint tablet from fragments (collect).
  A comic breather that makes the point: *ordinary people's grievances survive 3,750 years.*
- **"What the Sky Diary Says"** — Nabu-rimanni asks you to match two observation dates; sets up the
  Measure motif for Konark.

**Choice.** Ea-nasir asks for an honest verdict on the ingots he's selling. **Defend him** /
**Weigh it fairly**. (The right answer is a *method*, not a verdict.)

**Panel & seal.** A clay tablet in cuneiform on one side; on the other, the same sealed bead from
Panel 1. The two panels visibly touch — **the first "stitch" between panels** that the finale pays
off.

**Bridge.** The tablets mention *Dilmun* and *Magan* — and then, on a damp scrap, a line about a
*"far land across the sea where a king won his wife with a bow"*. Maitri, quietly: *"That isn't
Sumer talking. That's a story. Different kind of evidence. Time to learn the difference between a
tablet and a tale."* (Cuts to Act II — the evidence shifts from archaeology to epic.)

---

### ACT II — What the people told

*Act II is the delicate one. The tradition is a living culture; the story treats it as such, and
the Dhundh's lie is only ever "this is a dig report" or "this is nothing".*

#### Chapter 3 · Kosala & Dandaka · epic tradition · *"Three Hundred Ramayanas"*

**Hook.** Ayodhya on the Sarayu. First time **Ekarupa speaks**, from the water, to the player
directly: *"One story. Why would you want three hundred?"* Maitri: *"Because that is how it
lived."*

**The Dhundh's version.** The Gilder: *"The tale is a newspaper report, every detail is archaeology."*
The Eraser: *"It's only a story, ignore it."*

**Anchor: Revati** (Potter of Ayodhya) — "which Ramayana did your grandmother tell?" She makes a
vessel and each retelling is a different glaze.

**Beats**
1. **The Ashram Archery Ground** (archery) — Lava, the young reciter, teaches the verse metre.
2. **The Forest Pharmacy** (collect) — Vaidya Sumitra; *real* medicinal plants of the tradition's
   forests; separates "named in the text" from "identified by botanists".
3. **The Seven Books** (sequence) — the *kandas* in order; which parts are later additions.
4. **Three Hundred Ramayanas** (dialogue) — the tradition's plurality: Valmiki, Kamban, the
   Southeast Asian tellings, Jain and Buddhist versions. A scholar's phrase that Maitri quotes:
   *"not a text but a tradition".*

**Plaques**
- *"Excavations have confirmed the events of the Ramayana."* → resolves **epic**: the story is
  cultural truth, not a dig report.
- *"There is only one Ramayana."* → resolves "no", shown by three retellings.
- *"The Ramayana is a fiction with no cultural significance."* → the Eraser's plaque; resolves
  "no: it is among the most influential narratives in history".

**Forgotten Maker.** The *reciters* — the oral tradition itself. Lava is the Anchor's apprentice.

**Side quests**
- **"The Sarayu Ghat Steps"** — climb and read a set of Prakrit/Sanskrit/Tamil inscriptions of
  retellings (script-match).
- **"Guha's Crossing"** — ferry three travellers; each asks a question about the story in a
  different tradition.

**Choice.** Revati asks: *"Which version should the children be told?"* — **the one we like** or
**all of them, with their sources**.

**Panel & seal.** A shimmering panel where the **same scene is painted three ways in three styles**.
(Visually echoes real pat/phad conventions.)

**Bridge.** Guha rows you across the strait. In the dusk the next shore has a causeway that isn't
quite above the water. *"Is it a bridge? Or a shoal? Ask the person who measured it."*

---

#### Chapter 4 · The Setu & Lanka · epic tradition · *"The Hardest Choice"*

**Hook.** Standing on the Setu causeway at low tide. Ekarupa, now in the Gilder mask, *loves* this
place: *"The bridge is definitely man-made. Scientists agree."* Maitri: *"Do they?"*

**Anchors: Nala (epic) ↔ Dr. Meena Fernando (modern).** The game's oldest design trick — two
witnesses across time — becomes literal: they never meet, but the player carries answers back and
forth between them, and the *question* each asks is the same: *"what holds the stone up?"*

**Beats**
1. **Build the Causeway** (assembly) — Nala's rule: floating stones are *not* the mechanism; the
   player discovers the tradition's engineering logic.
2. **Vibhishana's Choice** (dialogue) — the loyalty-versus-righteousness dilemma. The story gives the
   *wise* flag weight: Ekarupa pushes the player to pick the flattering ending.
3. **The Lanka Campaign** (sequence) — the order of the siege.

**Plaques**
- *"Adam's Bridge is a man-made structure built 7,000 years ago."* → resolves **debate**: it is a
  natural chain of shoals/limestone shoals; whether people used or modified it is argued.
- *"The Ramayana's Lanka is definitely modern Sri Lanka."* → resolves **debate**.

**Forgotten Maker.** The *engineers whose names the tradition kept* — Nala — and the unnamed
labourers behind the hand that built anything.

**Side quests**
- **"Depth Soundings"** — help Nila take sounding-line readings across the shoal; the result is the
  *real* geography of the Palk Strait. Satisfying data-collection mini-game.
- **"The Gulf of Mannar Pearls"** — Mannar the pearl diver shows the sea's other history.

**Choice.** Vibhishana: loyalty to family, loyalty to dharma. The scene is built so that **neither
choice is shown as stupid**; the *note* text on the `wise` choice explains why the epic frames it as
the hard one.

**Panel & seal.** A panel with a **sea in the middle and the Setu rendered as a faint dotted line**
— half-bridge, half-shoal, exactly as the evidence leaves it.

**Bridge.** Nala's last line: *"Every stone in this bridge was carried by someone. Remember that
before the next battlefield."*

---

#### Chapter 5 · Kurukshetra · epic tradition · *"The Longest Poem in the World, About a Family That Could Not Talk"*

**Hook.** The Pandava camp, dawn. Ekarupa, now openly present: *"Eighteen days. Good and evil. Easy."*
Maitri: *"No. It isn't. Read what Sanjaya actually says."*

**Anchor: Sanjaya** (narrator to the blind king). He sees the whole war from a distance and tells it
accurately — the original *reliable narrator* problem, and the beating heart of the "who tells the
story?" theme.

**Beats**
1. **The Conversation Between the Armies** (dialogue) — the Gita as a conversation about duty; the
   story keeps it a conversation with a real question, not a lecture.
2. **Drona's Test** (archery) — the bird's eye; next to **Ekalavya's thumb** (the uncomfortable half,
   as the README insists).
3. **The Chakravyuha** (pattern) — Abhimanyu's formation; the player sees *why* it is a trap.
4. **Eighteen Days** (sequence).

**Plaques**
- *"The Mahabharata war has been dated to a single exact year."* → resolves **debate**: scholars
  propose very different dates; the README lists this explicitly.
- *"Everyone in the epic is either a hero or a villain."* → resolves "no".

**Forgotten Maker.** The *camp followers* and the *chariot-wrights* (Takshaka) — wars run on
supply, not speeches. Uttara and the cooks.

**Side quests**
- **"The Army Marches on Its Stomach"** — help Uttara work out rations for the camp (trade/balance).
- **"Sanjaya's Eyes"** — ask three witnesses what they saw of the same morning; compare.

**Choice (Act II finale).** Sanjaya: *"Do you want the clean version, or the true one?"* This is
the game's first **explicit Comfort/Open** fork where Maitri names the stakes aloud.

**Panel & seal.** A vast panel of a field with **two armies painted the same colour** — no side is
marked "good". Beneath it, a thin line of text in Sanjaya's voice.

**Act II ends.** Maitri: *"You've just handled the three hardest stories in the Gatha without
turning any of them into a lie. That's the method. Now you meet the people who wrote things down on
purpose."*

**Bridge.** Sanjaya hands you a rolled leaf: *"Take this to the one who put his regrets in
stone."*

---

### ACT III — What the stone says

#### Chapter 6 · Magadha · c. 321 BCE – 1200 CE · *"An Emperor's Apology"*

**Hook.** The Ashokan pillar. Maitri is almost joyful: *"Finally — an Indian voice we can read on
the original stone."* Ekarupa has a new line: *"He ruled an empire. Of course he was perfect."*

**Anchor: Sunita** (Stonecutter). *"The lion capital is on your money now, I am told. We only
carved it."* The story's **maker** theme crystallises here.

**Beats**
1. **Reading the Edict** (script match; Brahmi) — *Writing motif ✍️ completes its trilogy:*
   unreadable → readable → readable-because-someone-worked-it-out (Prinsep, 1837).
2. **Raise the Stupa** (assembly).
3. **After Kalinga** (dialogue; **already authored**) — the emperor's remorse. The story keeps
   this exactly as written, and adds a *preamble* where Sunita asks to be given the stonecutters'
   brief.
4. **From Pataliputra to Nalanda** (sequence) — includes the sack of Nalanda.

**Plaques**
- *"Ashoka forced everyone to become Buddhist."* → resolves "no": see Rock Edict 12 on toleration.
- *"Ashoka's empire was peaceful throughout."* → resolves "no": the Kalinga war and its numbers.
- *"Nalanda's library burned for three months."* → resolves **debate**: a late tradition; the sack
  itself is not in doubt.

**Forgotten Maker.** Sunita, and the *unnamed* administrators (Rudradaman the revenue officer;
Mahamatra Devi the dhamma inspector — the edicts' *first* readers).

**Side quests**
- **"Whose Language?"** — the edicts are in Prakrit/Brahmi, Kharosthi, Greek and Aramaic. Match each
  language to where the edict stood (puzzle).
- **"Jnanashri's Letter"** — the Tibetan student at Nalanda; help translate his request.

**Choice.** *Ekarupa's finest hour.* After the apology, Ekarupa offers the player a way to "improve"
the edict: edit out the number of deaths. **Accept** (comfort) or **Refuse** (open). Either way,
the edict reads exactly as it does historically — the choice only changes *Maitri's reply*.

**Panel & seal.** A pillar with an inscription. Lines of Brahmi at the base are **a real line of
the edict** (use only text verified against a scholarly translation).

**Bridge.** The pillar leads the eye south, to a country that *kept* its inscriptions: *"There is a
place where every boundary, every tax, every vote is carved in Tamil on the temple wall."*

---

#### Chapter 7 · The Chola Country · c. 850–1279 CE · *"Ballots from a Pot"*

**Hook.** The Brihadeeswarar temple at sunrise. Maitri hands the player a **Survey Rope**
(cosmetic) for this chapter's recurring theme: the *state measuring itself*.

**The Dhundh's version.** The Gilder's most seductive line: *"The Cholas had democracy a thousand
years ago."* The README already refuses this by name.

**Anchor: Kunjaramallan** (Sthapati). Real: the Thanjavur temple inscription credits an architect
by name (the README flags the Thanjavur construction as a check item — verify before writing).

**Beats**
1. **Cast a Bronze** (assembly) — lost-wax casting, a living craft.
2. **The Pot Ballot** (dialogue) — the Uttaramerur system, *with* property and literacy
   qualifications spelled out. The wise choice is to name the limits.
3. **Raise the Capstone** (sequence).
4. **The Srivijaya Expedition** (sequence) — *trade motif 🧭:* ships to Southeast Asia, c. 1025 CE.

**Plaques**
- *"The Chola village assembly was a democracy."* → resolves **text** (Uttaramerur inscriptions)
  *but* with the qualification rules the player must read off the wall.
- *"The capstone of the temple weighs 80 tons."* → resolves **debate** (a popular figure; ask for
  the source).
- *"The Cholas conquered Southeast Asia."* → resolves "no": a naval raid/expedition and trade
  relations, not a colonial empire.

**Forgotten Maker.** Sembian the bronze caster and **Karanattan** the temple accountant — *the
people whose ledgers are how we know anything.*

**Side quests**
- **"The Temple Accountant"** — audit a donation record; find the error (sequence/collect).
- **"Nangai's Dance"** — a pattern-matching rhythm game with the bronze Nataraja's pose.

**Choice.** Kunjaramallan asks whether the architect's name should be carved. **Yes, small, at the
base** / **No — the god, not the maker**. (He did sign. The game doesn't tell you which he chose
until you scan the base.)

**Panel & seal.** Granite and bronze; **a very small signature at the corner** — Kunjaramallan's.

**Bridge.** The Chola ships carry an astronomical instrument aboard. Next stop: the instruments
themselves.

---

#### Chapter 8 · Konark & the Observatory · 499–1734 CE · *"A Chariot for the Sun"*

**Hook.** The Sun Temple, built as a chariot with twenty-four wheels. Maitri: *"Look — those wheels
are clocks."*

**The Dhundh's version.** The Eraser: *"It's pretty. It doesn't mean anything."* The Gilder:
*"Ancient India knew everything modern science does."*

**Anchor: Jagannatha Samrat** (court astronomer to Jai Singh). A scholar who worked with *both*
Sanskrit and Greek/Arabic astronomical traditions.

**Beats**
1. **The Chariot Wheel Sundial** (pattern) — *Measure motif ⚖️ becomes literal time.*
2. **What Does This Instrument Measure?** (dialogue) — the Jantar Mantar instruments.
3. **The Earth Does Not Stand Still** (dialogue) — Aryabhata (499 CE) and the question of whether
   the Earth rotates; a good place to demonstrate **"text says X, later commentators argue about
   what X meant"**.
4. **A Thousand Years of Reckoning** (sequence).

**Plaques**
- *"Ancient Indians discovered everything: planes, atom bombs."* → resolves "no"; the Gilder
  overreach, answered kindly rather than mockingly.
- *"Aryabhata proved the Earth rotates."* → resolves **debate**/nuanced: he states it; how he
  argued it is read differently.
- *"Konark was a lighthouse for ships."* → resolves **debate** (a popular claim; check scholarly
  basis before writing).

**Forgotten Maker.** Bisu Maharana, the sculptor, and the *Maharanas* as a guild. The legend of the
twelve hundred sculptors is **epic/legend**, marked as such.

**Side quests**
- **"A Day on the Sundial"** — read the shadow at three times and compare with the almanac maker
  (Panchangi Ratna).
- **"Chilika Fisher"** — Sumitra: monsoon winds, and why a coastal temple faces east.

**Choice.** Jagannatha asks which book should be translated next — **the Greek**, **the Arabic**,
or **the Sanskrit original**. The game's answer: *all of them; knowledge moved both ways.*

**Panel & seal.** A wheel — and in its rim, small, a **shadow-line that moves with the real sun
elevation of the zone** (`sunElevation` / `sunAzimuth` are already in `ZonePalette`).

**Act III ends.** Maitri: *"Three chapters of people who wrote things down on purpose — and look
how much the scribes themselves left out."*

**Bridge.** A single line is carved in the temple floor: *"Ask who laid the stone."*

---

### ACT IV — Who was left out

*In Act IV the Dhundh stops whispering. The player has collected enough method to see it clearly,
and the chapters deliberately press on the hardest questions: who is recorded, and who is not?*

#### Chapter 9 · Vijayanagara (Hampi) · 1336–1565 CE · *"One Catastrophic Afternoon"*

**Hook.** The Boulder Ridge at dusk. The most beautiful and the most dangerous place in the Gatha.
Ekarupa, openly now: *"This city fell in an afternoon. What's the point of knowing it?"*

**Anchors: Mallappa & Nuniz.** A local stone mason and a Portuguese horse-trader describe the
same city; the player has to read *two eyewitnesses with different interests*.

**Beats**
1. **Restore the Aqueduct** (assembly) — *Water motif 💧 returns.*
2. **The Pagoda Market** (trade) — the market.
3. **What Was This Building For?** — a function-guessing puzzle that teaches how archaeologists
   *infer* use; reuses the evidence-type logic.
4. **Three Witnesses** (dialogue) — Nuniz, Abdur Razzaq (envoy from Herat) and a local voice
   describe the city; the player weighs the testimonies.

**Plaques**
- *"The Stone Chariot is a single carved monolith."* → resolves "no" — README already names this
  myth.
- *"Vijayanagara was destroyed completely in one day."* → resolves **debate**: the sack after
  Talikota (1565) was severe and prolonged; the exact process is argued.
- *"Hampi was a purely Hindu city with no outside influence."* → resolves "no": Islamicate
  architectural influence is visible.

**Forgotten Maker.** Mallappa — and **Hampamma** the canal keeper, whose job is the reason the
fields work.

**Side quests**
- **"The Canal at Dawn"** — walk the canal with Hampamma; find the three places it's silting up.
- **"What the Poet Left Out"** — Allasani Peddana's verse praises the court; the player finds the
  *absence* in the verse (collect clues).

**Choice.** Nuniz and Razzaq disagree about the city's size. The player has to decide **which
witness to trust and why**, then reconcile it with the archaeological survey (the README flags the
Vijayanagara survey as a verify item).

**Panel & seal.** The panel is half-painted: **the city before** and the **ruin after**, with a
single stitched line of the canal running through both.

**Bridge.** Maitri grows quiet: *"You can fix a ruin on a panel. You can't fix a ruin."*

---

#### Chapter 10 · Agra & Sikri (Mughal) · 1526–1707 CE · *"Whose Hands Built the Tomb?"*

**Hook.** The Charbagh, marble light. The Gilder's masterpiece: *"A monument to love; no one was
harmed; the builders were happy."*

**Anchors: Amanat Khan & Puran.** The calligrapher *signed* the Taj (his name is on the gateway
inscription). Puran, the Makrana marble cutter, left no name. The comparison **is** the chapter.

**Beats**
1. **The Inlay Workshop** (pattern) — pietra dura symmetry; Zarina the apprentice.
2. **Raise the Mausoleum** (assembly).
3. **The House of Worship** (dialogue) — Akbar's Ibadat Khana at Fatehpur Sikri and *sulh-i-kul*
   ("peace with all"), followed by Aurangzeb reversing it — the README's line: *tolerance that
   depends on one ruler's character is on loan.*
4. **The Shape of a Dynasty** (sequence).

**Plaques**
- *"Shah Jahan cut off the workers' hands."* → resolves "no evidence": a legend; no contemporary
  record supports it; the README names it as a myth.
- *"The Taj Mahal was a temple."* → resolves "no": rebutted by the documentary record; the plaque
  shows the evidence (contemporary court chronicles, plans).
- *"Akbar was an enlightened ruler who treated everyone equally."* → resolves **text**, but the
  Gilder overreaches: the dialogue shows real tolerance *and* real power.

**Forgotten Maker.** Puran — "the unsigned hand" — and **Bhishti Ramzan** the water-carrier
(*Water motif 💧*): without water carriers no wall is mortared.

**Side quests**
- **"The Inlay Apprentice"** — Zarina's pattern puzzle across three scales.
- **"A Painter at Court"** — Bichitr's atelier: match miniature details to the events they depict.

**Choice.** *Ekarupa's second great moment.* It offers to give the unsigned workers a name — a
beautiful, invented name. **Accept** the invented name or **Leave it blank**. The blank is honoured
by Maitri: *"An honest blank is a better monument than a lovely lie."*

**Panel & seal.** The panel is the Taj in white — with **a section of the border left deliberately
unpainted**, labelled for "Puran, and the others".

**Bridge.** Bichitr's miniature shows a fort in the west, a hill, a man on a horse.

---

#### Chapter 11 · The Hill Forts (Rajput & Maratha) · c. 1300–1818 CE · *"Where Geography Is the General"*

**Hook.** The hill fort at dawn. Maitri: *"The last chapter. Forts, queens, spies, water, and a lot
of arguing historians."*

**The Dhundh's version.** The Gilder and the Eraser *fuse*: Ekarupa shows both masks at once — a
battle painted entirely glorious in one panel and entirely meaningless in the next.

**Anchors: Sakhubai** (keeper of the cisterns), with **Tanaji** and **Ahilyabai Holkar**.

**Beats**
1. **Design the Approach** (assembly) — place defensive works with the terrain; *Water motif 💧*
   completes: no fort holds without a cistern.
2. **Ganimi Kava** (dialogue) — guerrilla war as strategy.
3. **Ranging from the Bastion** (archery).
4. **Five Centuries of Resistance** (sequence).

**Plaques**
- *"Haldighati was an outright victory for one side."* → resolves **debate** — the README flags
  this as a contested record.
- *"Rani Padmini's story is verified history."* → resolves **epic/legend**: a literary tradition
  (Jayasi's *Padmavat*, 1540) rather than a contemporary record — verify with a historian before
  shipping.
- *"Ahilyabai Holkar ruled only through a regent."* → resolves "no": she governed in her own name
  (verify).

**Forgotten Maker.** Sakhubai, the cistern keeper — the one person whose neglect would have lost
the fort.

**Side quests**
- **"The Last Cistern"** — a time-limited management puzzle; water vs. siege-days.
- **"The Bakhar Clerk"** — Balaji, the revenue clerk, lets you read a *bakhar* (chronicle) and
  separate source from praise.

**Choice.** *The last Comfort/Open fork of the main story.* Balaji offers to "tidy up" a ledger
discrepancy so the fort's account reads more heroically. **Tidy** or **Leave the discrepancy**. The
Gilder in its purest form.

**Panel & seal.** A fort — and beneath it, **a long thin cistern line**, the water motif braided
with the other two.

**Act IV ends.** All eleven panels hang in the air around the player. They don't quite touch. Three
threads (💧 ✍️ ⚖️) run across all of them, in the wrong order, tangled. Maitri: *"Now we find out
what you've learned. It's time for the Sabha."*

---

## Part 9 — The Finale: **The Sabha of Sources** (सभा)

**Setting.** A new, small zone at the island's centre: **the Smriti Mandapa**, a round hall with
eleven doors (one per chapter) and a twelfth, plain door. (Placement and visual builder TBD — it
needs one new `BuilderKind`.)

**What happens**
1. **Ekarupa appears** — not a monster; a figure in a plain cloak who keeps changing masks. It
   offers a deal: *"Let me finish the scroll. One story. No more work for you."*
2. **The cross-examination.** Ekarupa makes **eleven claims** (one per chapter, each a Distortion
   Plaque the player may or may not have corrected). The player cross-examines each:
   - Ask **"how do we know?"** → the game opens that claim's codex entries.
   - Pick the evidence tag.
   - **Call a witness** — an Anchor from that chapter, with a short line in their own voice.
3. **Personalised difficulty (the clever bit):** the claims Ekarupa makes are *drawn from the
   player's weakest skills* in the learning record (`Save` already stores per-objective accuracy and
   "weakest skills"; `QuestionBank` already weights wrong answers 6×). The player is literally
   up against their own gaps — and it's pitched as *"Ekarupa knows where you're soft"*, not as a
   test.
4. **Cheap failure** (the rule): if a claim isn't resolved, Ekarupa wins that *round* but the
   witness explains why; the claim returns later in the session. Nothing is deducted.
5. **The braid.** Each resolved claim pulls one of the three motif threads (water/writing/measure)
   straight. After eleven, the threads are braided across all panels — the **panels finally touch**.

**Ekarupa's end.** Not destroyed — *named.* Maitri, gently: *"It was never a villain. It's the part
of every listener that wants it simple. We don't beat it. We just check it, every time."*

---

## Part 10 — Epilogue: **The Twelfth Panel** (बारहवाँ पट)

The plain door opens onto a blank panel.

**The Gathak writes it.** A short composition screen, fed by what the player did:

1. **Three things I am sure of** — choose 3 codex entries (restricted to `archaeology` / `text`).
2. **One thing I believe on tradition** — choose 1 `epic` entry.
3. **One thing I still don't know** — choose 1 `debate` entry (this is the **"Still Open"** slot —
   the game's thesis in a button).
4. **A name I want remembered** — choose a Forgotten Maker.

The result is rendered as the twelfth panel and attached to the **existing learning record export**
(`Esc → Export learning record`). That record already holds per-question history and weakest
skills, so the "panel" is a genuinely useful teacher-facing artefact — and it's *the student's own
words.*

**Ending colour (three variants, all positive)**, read from the invisible meters (Part 6):

| Pattern | Maitri's closing |
|---|---|
| Mostly **wise** picks, several **Still Open** | *"You doubt kindly. That's rare."* |
| Mostly **comfort** picks early, **wise** later | *"You changed your mind with evidence. Most people can't do that at all."* |
| Many **comfort** picks throughout | *"You like a good story. So do I. Now you can tell which parts are the story."* |

**Post-game.** The Gatha never finishes: a **Keeper's Log** lists Maitri's 41 predecessors (each a
one-line profession — *a clerk, a boatwoman, a schoolteacher…*). The player's name is appended as
the 42nd. The **seeded-world** hook (a teacher hands out a seed) means a class can compare Keeper
Logs.

---

## Part 11 — What gets built (and how it fits the existing code)

### New content (all in `src/content/story/`, pure data)

```
src/content/story/
  types.ts          StoryBeat, Quest, QuestObjective, DistortionPlaque, Panel, EndingVariant
  prologue.ts       vimana log beats + 11 landing variants
  chapters/*.ts     one file per zone: hook, anchor beats, plaques, side quests, choice, panel, bridge
  sabha.ts          the finale claims, witnesses, braid rules
  epilogue.ts       twelfth-panel slots, ending variants, Keeper's Log
  index.ts          registry + validateStory()
```

`validateStory()` plugs into the same startup validation that `validateContent()` already runs, so
it flags: unresolved codex ids, plaques whose `trueTag` isn't a `SourceType` (or "no evidence"),
quests that reference nonexistent challenges/NPCs, dead story-beat links.

### Runtime pieces (thin; engine side)

| Piece | Where | Notes |
|---|---|---|
| Quest state | `core/Save.ts` | `quests: Record<string, string[]>` **already exists**, unused. Add two counters: `comfortPicks`, `openQuestions` |
| Story events | `core/EventBus.ts` | Emit `scanned`, `challengeDone`, `npcSpoke`, `zoneEntered`; story listens |
| Story card UI | `ui/` | Reuse `DialogueBox` for Maitri's lines; add a small "Keeper's Log" overlay (like Codex, `J`) |
| Distortion plaques | `world/` + `main.ts` | Place as interactables the way landmarks are; reuse scan hold |
| Panel gallery | `ui/` | Eleven panels, drawn on canvas like the map's offscreen pass |
| Sabha zone | `content/zones/` | One new zone entry + one new `BuilderKind` for the hall |
| Finale | `quiz/` | Reuses `QuestionBank` weights for "weakest skills" |

### Dependencies on work that isn't done yet (README "Not built yet")
The six unbuilt runtimes — **archery, assembly, pattern, script-matching, trade, sequencing** —
carry a lot of the beats above. Today a non-dialogue challenge just shows its brief and runs the
quiz. The story therefore works in two **tiers**:

- **Tier 1 (buildable now):** everything that rides on dialogue challenges, scanning, plaques, the
  Keeper's Log, panels, choices and the finale. Chapters are *narratively* complete.
- **Tier 2 (as runtimes land):** each mini-game upgrades its story beat from "brief + quiz" to a
  playable scene. The story text is written to read fine either way.

### Suggested build order
1. `story/types.ts`, `validateStory()`, quest state in `Save`.
2. Prologue + Keeper's Log overlay (smallest visible win).
3. Distortion Plaques mechanic + Chapter 1 as the **vertical slice** (all of Part 8 Ch1).
4. Chapters 2–11, one PR each.
5. Sabha + Epilogue.
6. Mini-game runtimes, in parallel, whenever.

---

## Part 12 — Accuracy checklist (must be reviewed by a historian before shipping)

Every item here is something a story beat leans on that the README or the codex either flags as
contested or that I'd verify before it goes into the game:

- [ ] Ea-nasir complaint tablet (c. 1750 BCE, Ur): wording, who wrote it, the ingot dispute.
- [ ] Indus weights: ratio series and the exact unit; cubical chert weights.
- [ ] "Meluhha = Indus" — mainstream reading; present as such, not as certain.
- [ ] Adam's Bridge origin: wording in the plaque (natural shoal vs. human modification).
- [ ] Mahabharata dating: range of proposals.
- [ ] Rock Edict 13 numbers (deported/killed/died) — quote the scholarly translation.
- [ ] Nalanda: date of sack; the "library burned for months" tradition.
- [ ] Brihadeeswarar: capstone weight claim; architect inscription name and form.
- [ ] Uttaramerur: qualification rules list.
- [ ] Chola–Srivijaya: the 11th-century expedition's nature (raid vs. conquest).
- [ ] Aryabhata and the Earth's rotation: what the text says vs. later readings.
- [ ] Konark "lighthouse" and "twelve hundred sculptors" claims.
- [ ] Vijayanagara: Talikota/the sack's duration; the Nuniz/Paes/Razzaq passages.
- [ ] Taj: Amanat Khan's signature; absence of record for the "hands" story; the "temple" claim.
- [ ] Padmavat (1540) and Rani Padmini — status of the story.
- [ ] Haldighati (1576) — outcome framing.
- [ ] Ahilyabai Holkar — administration in her own name.
- [ ] The pramana mapping (Part 4) — a historian of Indian philosophy.

---

## Part 13 — Decisions I need from you

1. **The frame.** Do you like *The Unfinished Scroll* (a pat/phad-style scroll, Maitri the Keeper,
   Ekarupa the Dhundh)? Or would you prefer something more adventure-led (a lost artefact hunt, a
   rival, a ticking clock)? I think the scroll fits the game's rules best, but it's your game.
2. **Antagonist tone.** Ekarupa as a quiet "habit of mind" (current draft) — or a more visible,
   personified rival?
3. **Plaque tag for folklore.** Option (a) add a fifth tag `legend`, (b) reuse `debate`, or (c)
   allow a "no evidence found" outcome. I recommend (c).
4. **Endgame scope.** The game stops at 1818 / Aurangzeb's era. Do you want a **Chapter 12 — the
   Present** (modern India, the Constitution, living heritage), or keep the Twelfth Panel as the
   only "present" beat?
5. **Language.** Maitri's lines in English with Devanagari names (current draft), or fully bilingual
   (Hindi + English toggle)? That affects how I write the data.
6. **Difficulty of personalisation.** The Sabha pulling from *your weakest skills* is the most
   interesting part and the most work. Keep it, or simplify to fixed claims for v1?
7. **Age range.** Draft assumes 12–16 per the codex. Tell me if you want to aim younger or older.

---

*When you've marked this up, I'll turn the approved version into the `content/story/` data files
and wire the minimum runtime — starting with the Prologue and Chapter 1 as the vertical slice.*
