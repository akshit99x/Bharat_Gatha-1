import * as THREE from 'three';
import { Post } from './render/Post';
import { Waypoint } from './ui/Waypoint';
import { Coach } from './ui/Coach';
import { cloud } from './net/Cloud';
import { presentClassPanel } from './ui/ClassPanel';
import { Combat, PLAYER_HEARTS } from './combat/Combat';
import { chapterProgress, journeyAction, nextAction, type NextAction, type NextTarget } from './story/Progress';
import { hasSeenIntro, presentHowToPlay } from './ui/HowToPlay';
import { VOICE_SAMPLE } from './content/story/sabha';
import './styles/main.css';

import { Input } from './core/Input';
import { bus } from './core/EventBus';
import { save, type Settings } from './core/Save';
import { audio } from './core/Audio';
import { voice } from './core/Voice';
import { Rng } from './core/Rng';

import { World } from './world/World';
import { Kit } from './world/architecture/kit';
import { stoneMaterial, shade } from './world/Materials';
import { WORLD_HALF } from './world/Terrain';

import { PlayerController } from './player/PlayerController';

import { QuestionBank } from './quiz/QuestionBank';
import { QuizEngine } from './quiz/QuizEngine';

import { Hud, type CompassPoi } from './ui/Hud';
import { Minimap, type MinimapMarker } from './ui/Minimap';
import { QuizModal } from './ui/QuizModal';
import { DialogueBox } from './ui/DialogueBox';
import { Narration, type NarrationLine } from './ui/Narration';
import { NpcLabels, type NpcMark } from './ui/NpcLabels';
import { JourneyScreen } from './ui/JourneyScreen';
import { PlaqueModal } from './ui/PlaqueModal';
import { ScrollModal } from './ui/ScrollModal';
import { SabhaModal } from './ui/SabhaModal';
import { TwelfthModal } from './ui/TwelfthModal';
import { MiniGames } from './minigames/MiniGames';
import { Aksharas } from './creative/Aksharas';
import { captureFrame, openDarkroom, shutter } from './creative/PhotoMode';
import { MELODIES, MusicalPillars } from './creative/MusicalPillars';
import { AKSHARAS, aksharasIn, type Akshara } from './content/aksharas';
import { buildSkyline } from './ui/skyline';
import type { MiniGameResult } from './minigames/types';
import { validateMiniGames } from './minigames/validate';
import { StoryEngine, EKARUPA, MAITRI, SABHA_MIN_PANELS, type Speaker } from './story/StoryEngine';
import { CHAPTERS, PROLOGUE, getChapter, validateStory, type StoryLine } from './content/story';
import { buildPanel, button, closeOverlay, el, mountOverlay, overlayOpen } from './ui/overlay';

import { ZONES, TOTAL_NPCS, getZone } from './content/zones';
import { CODEX, getCodex, validateContent } from './content/codex';
import { validateQuestions, QUESTION_COUNT } from './content/questions';
import type { Interactable } from './world/World';
import { CHARIOT_DECK_HEIGHT, type Chariot } from './vehicles/Chariot';
import type { ChallengeSpec, Zone } from './content/types';
import type { ObjectiveRow } from './story/StoryEngine';

/**
 * Bootstrap and game loop.
 *
 * Wires the systems together — terrain, procedural monuments, the character
 * controller, the quiz engine, the story layer and the mini-games — plus enough
 * HUD and interaction to play them. Each challenge kind has its own mini-game
 * under `minigames/`; conversations run in the dialogue box.
 */

const SCAN_RANGE = 150;

/** Reused each frame so the scan probe allocates nothing. */
const _fwd = new THREE.Vector3();
const _sunDir = new THREE.Vector3();
const _look = new THREE.Vector3();
const _guide = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _from = new THREE.Vector3();
const _up = new THREE.Vector3();
const _side = new THREE.Vector3();

class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly post: Post;
  private readonly clock = new THREE.Clock();

  private readonly input: Input;
  private readonly hud: Hud;
  private readonly bank: QuestionBank;
  private readonly quiz: QuizEngine;
  private readonly quizModal: QuizModal;
  private readonly dialogue = new DialogueBox();
  private readonly story = new StoryEngine(save);
  private readonly minigames = new MiniGames();
  private readonly narration = new Narration();
  private readonly labels = new NpcLabels();
  private readonly journey: JourneyScreen;
  /** Who the player is talking to right now, so they keep facing us. */
  private talkingTo: string | null = null;
  private readonly plaqueModal = new PlaqueModal(this.story);
  private readonly sabhaModal = new SabhaModal(this.story);
  private readonly twelfthModal = new TwelfthModal(this.story, () => save.profile.playerName);
  private readonly scrollModal: ScrollModal;
  private readonly veil: HTMLElement;
  /** Regions whose story hook has been checked this session — one cheap lookup per frame. */
  private readonly hooked = new Set<string>();
  /** The theme waiting for the player to land. */
  private pendingTheme: string | null = null;

  private world!: World;
  private player!: PlayerController;
  private minimap!: Minimap;
  private vimanaMesh: THREE.Mesh | null = null;

  private currentZone: Zone | null = null;
  /** Heading of the opening flight, so the craft faces where it is going. */
  private rideHeading = 0;
  private ridingChariot: Chariot | null = null;
  /** Who we have already met, so a second conversation opens somewhere new. */
  private readonly spokenTo = new Set<string>();
  private scanTarget: string | null = null;
  private scanProgress = 0;
  private running = false;
  private paused = false;
  private elapsed = 0;
  private sessionStart = Date.now();
  private statsTimer = 0;
  private lastTier: 'full' | 'lite' | 'off' = 'full';
  private waypoint!: Waypoint;
  private guideAction: NextAction | null = null;
  private guideTimer = 0;
  private guideDistance: number | null = null;
  private coach!: Coach;
  private hasFlown = false;
  private combat!: Combat;
  private aksharas!: Aksharas;
  private pillars!: MusicalPillars;
  /** Set by P; the frame is captured right after it has been rendered. */
  private photoPending = false;
  /** Which tool is in hand: 0 the bow, 1 the Shilpa hammer, 2 the Pramana lens. */
  private tool = 2;

  constructor(private readonly viewport: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.shadowMap.enabled = save.settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    viewport.appendChild(this.renderer.domElement);
    document.body.classList.toggle('post-on', save.settings.cinematic);

    // A little wider than first person: the point of the over-the-shoulder view
    // is seeing more of where you are heading.
    this.camera = new THREE.PerspectiveCamera(78, 1, 0.1, WORLD_HALF * 3.4);
    this.post = new Post(this.renderer, this.scene, this.camera);
    this.post.setEnabled(save.settings.cinematic);
    this.scene.add(this.camera);

    this.input = new Input(this.renderer.domElement);
    this.input.sensitivity = save.settings.mouseSensitivity;
    this.input.invertY = save.settings.invertY;

    this.hud = new Hud();
    this.waypoint = new Waypoint(document.getElementById('hud') ?? document.body);
    this.waypoint.setEnabled(save.settings.guide);
    this.coach = new Coach(document.getElementById('hud') ?? document.body);
    // The optional class connection: every save may be sent to the teacher's server, and the class's own
    // questions join the quiz. None of it is needed to play.
    cloud.attach(() => save.profile);
    save.onFlush((profile) => cloud.schedule(profile));
    void this.loadClassQuestions();
    bus.on('codex:unlock', () => this.coach.notify('scan'));
    // The conch's second (and only other) moment: a chapter's panel restored to the Gatha.
    bus.on('story:panel', () => window.setTimeout(() => audio.conch(), 600));
    bus.on('ui:open', ({ screen }) => {
      if (screen === 'journey') this.coach.notify('map');
    });
    this.bank = new QuestionBank(save);
    this.quiz = new QuizEngine(this.bank, save);
    this.quizModal = new QuizModal(this.quiz);

    this.journey = new JourneyScreen({
      profile: () => save.profile,
      island: () => this.minimap.island(),
      player: () => ({ x: this.player.position.x, z: this.player.position.z, yaw: this.player.yaw }),
      pads: () =>
        this.world.interactables
          .filter((i) => i.kind === 'pad' && i.padZone)
          .map((i) => ({ zoneId: i.padZone as string, x: i.position.x, z: i.position.z })),
      controls: CONTROLS,
      travel: (zoneId) => this.travelTo(zoneId),
      seal: (zoneId) => void this.runSeal(zoneId),
      gatha: () => this.scrollModal.present(),
    });

    this.scrollModal = new ScrollModal(this.story, {
      restore: (zoneId) => void this.runRestoration(zoneId),
      sabha: () => void this.runSabha(),
      twelfth: () => void this.runTwelfth(),
      playerName: () => save.profile.playerName,
    });
    this.veil = document.createElement('div');
    this.veil.id = 'dhundh-veil';
    document.body.appendChild(this.veil);

    audio.setVolumes(save.settings.musicVolume, save.settings.sfxVolume);
    voice.setEnabled(save.settings.voices);
    voice.setSource(save.settings.voiceSource);
    void voice.loadRecordings();
    voice.setVolume(save.settings.voiceVolume);
    // The score ducks while anybody is speaking.
    voice.watch((speaking) => audio.duck(speaking));
    this.applyAccessibility();

    window.addEventListener('resize', () => this.resize());
    this.resize();

    // Captions wait while a conversation or a puzzle is up: one voice at a time. The close event fires
    // before the overlay's state clears, so look again a tick later.
    const syncNarration = (): void => queueMicrotask(() => (overlayOpen() || this.dialogue.isOpen ? this.narration.pause() : this.narration.resume()));
    bus.on('dialogue:open', syncNarration);
    bus.on('dialogue:close', syncNarration);
    bus.on('ui:open', syncNarration);
    bus.on('ui:close', syncNarration);

    // Overlays suspend gameplay input and release the pointer.
    bus.on('ui:open', () => {
      audio.focus(true);
      this.input.setSuspended(true);
      this.input.releaseLock();
      this.hud.dimObjectives(true);
    });
    bus.on('ui:close', () => {
      audio.focus(false);
      this.input.setSuspended(false);
      this.hud.dimObjectives(false);
      if (this.running && !this.paused) this.input.requestLock();
    });

    bus.on('vidya:gain', () => this.hud.setVidya(save.profile.vidya));
    bus.on('codex:unlock', () => this.refreshMapMarkers());
    bus.on('challenge:finish', () => this.refreshMapMarkers());
    bus.on('zone:enter', () => this.refreshMapMarkers());

    // A passed chapter assessment queues its panel; the restoration conversation
    // runs once the assessment screen has been closed (see runQuiz).
    bus.on('chapter:sealed', ({ zoneId }) => this.story.queueRestoration(zoneId));

    this.renderer.domElement.addEventListener('click', () => {
      if (this.running && !this.paused && !overlayOpen() && !this.dialogue.isOpen) this.input.requestLock();
    });
  }

  // ------------------------------------------------------------------ build

  async build(onProgress: (fraction: number, label: string) => void): Promise<void> {
    onProgress(0.06, 'Checking the chronicles…');
    await nextFrame();

    const contentProblems = [...validateContent(), ...validateQuestions(), ...validateStory(), ...validateMiniGames()];
    if (contentProblems.length > 0) {
      console.warn(`[content] ${contentProblems.length} problem(s) found:`);
      for (const p of contentProblems) console.warn(`  · ${p}`);
    } else {
      console.info('[content] all references resolve');
    }

    onProgress(0.18, 'Raising the subcontinent…');
    await nextFrame();

    this.world = new World(this.scene, {
      seed: save.profile.worldSeed,
      shadows: save.settings.shadows,
      floraScale: save.settings.renderScale < 1 ? 0.6 : 1,
    });

    // Places with a sound of their own: water at the stepwells, bells at the temples, surf at the harbours.
    audio.setEmitters(
      this.world.landmarks.map((l) => ({ id: l.id, kind: l.kind, x: l.position.x, y: l.position.y, z: l.position.z, radius: l.radius })),
    );

    // The Dhundh's shades, out in the open country.
    this.combat = new Combat(this.world, save.profile.worldSeed, {
      onDefeat: (_zoneId, cleared) => {
        save.addVidya(10);
        bus.emit('vidya:gain', { amount: 10, reason: 'A shade dispersed' });
        if (cleared) this.hud.toast('good', 'The haze lifts here', 'Every shade at this column is gone. It will gather again, in time.', '🌬️', 4500);
      },
      onHealth: (hearts, max) => this.hud.setHearts(hearts, max, hearts < max || this.combat.engaged),
      onOverwhelmed: () => this.overwhelmed(),
      onNpcStruck: (npcId) => {
        const lines = ['Mind your aim!', 'Not at me, Gathak!', 'Careful with that bow.', 'Shoot the haze, not the people.'];
        this.labels.bark(npcId, lines[Math.floor(Math.random() * lines.length)] as string);
      },
    });
    this.combat.setEnabled(save.settings.combat);
    this.scene.add(this.combat.group);

    // Letters hidden around the island.
    this.aksharas = new Aksharas(this.world, save.profile.creative.aksharas);
    this.scene.add(this.aksharas.group);

    // Hampi's ringing pillars, beside the Stone Chariot.
    this.pillars = new MusicalPillars(this.world, [
      ...this.combat.sitePositions(),
      ...this.world.interactables.map((i) => i.position),
      ...this.aksharas.positions().map((a) => a.position),
    ]);
    this.scene.add(this.pillars.group);
    this.pillars.onMelody = (m) => {
      const fresh = save.learnMelody(m.id);
      if (fresh) {
        save.addVidya(30);
        bus.emit('vidya:gain', { amount: 30, reason: `Played ${m.name}` });
      }
      audio.success(3);
      const learned = save.profile.creative.melodies.length;
      this.hud.toast('good', `${m.name}${fresh ? '' : ' (again)'}`, `${m.note} ${fresh ? `Melodies learned: ${learned} of ${MELODIES.length}.` : ''}`, '🎶', 8000);
      if (fresh && learned === MELODIES.length) {
        void this.narration.say([
          this.narrationLine({ who: 'maitri', text: 'Stone that sings. Nobody wrote down how the masons tuned it, so all we have is the sound. Sometimes that is the whole record.' }),
        ]);
      }
    };

    // Lift the haze from plaques already corrected in a previous session.
    for (const chapter of CHAPTERS) for (const p of chapter.plaques) if (this.story.plaqueDone(p.id)) this.world.setPlaqueCleared(p.id, true);

    // Remarks and greetings from the people of the world appear as speech bubbles.
    this.world.onNpcSay = (npc, text) => this.labels.bark(npc.id, text);

    onProgress(0.72, 'Placing the monuments…');
    await nextFrame();

    this.player = new PlayerController(this.camera, this.world, this.input, save.settings);
    this.scene.add(this.player.avatar.group);
    this.buildVimana();

    onProgress(0.84, 'Drawing the map…');
    await nextFrame();
    const minimapHost = document.getElementById('minimap');
    if (!minimapHost) throw new Error('[boot] #minimap is missing');
    this.minimap = new Minimap(this.world.terrain, minimapHost);
    this.refreshMapMarkers();

    onProgress(0.9, 'Tuning the tanpura…');
    await nextFrame();

    const stats = this.world.stats;
    console.info(
      `[world] ${stats.monuments} monuments · ${stats.colliders} colliders · ${stats.flora} plants · ${stats.interactables} interactables · ${stats.chariots} chariots · ${TOTAL_NPCS} people · ${CODEX.length} codex entries · ${QUESTION_COUNT} authored questions`,
    );

    onProgress(1, 'Ready');
  }

  /**
   * The Pushpaka Vimana: the deck you ride in on.
   *
   * Only the hull is modelled — no canopy. A domed pavilion around the camera
   * looks splendid in a screenshot and blocks the entire view in play, and the
   * point of this sequence is to show the player the island.
   */
  private buildVimana(): void {
    const kit = new Kit();
    const gold = 0xd9a93c;
    const body = 0xc9b48a;

    // Hull below the deck, flaring outward.
    kit.lathe(
      [
        [0, -5.2],
        [3.4, -3.6],
        [5.2, -1.6],
        [5.8, -0.2],
      ],
      [0, 0, 0],
      body,
      { segments: 18, collide: false },
    );
    // The deck itself, with a raised rim.
    kit.cylinder(5.9, 5.6, 0.45, [0, -0.2, 0], shade(body, 1.14), { segments: 20, collide: false });
    kit.torus(5.9, 0.28, [0, 0.1, 0], gold, { rotX: Math.PI / 2, segments: 28, collide: false });
    // Lotus-petal rim, so it reads as a celestial chariot rather than a disc.
    kit.ring(18, 5.9, (px, pz, a) => {
      kit.prism(
        [
          [-0.7, 0],
          [0.7, 0],
          [0, 1.1],
        ],
        0.25,
        [px, -0.1, pz],
        shade(gold, 1.05),
        { rotY: -a + Math.PI / 2, collide: false },
      );
    });
    // Prow, pointing along the flight path (+Z).
    kit.prism(
      [
        [0, 0],
        [7.0, 1.1],
        [6.4, 2.2],
        [0, 1.8],
      ],
      1.0,
      [0, -1.4, 5.4],
      gold,
      { rotY: Math.PI / 2, collide: false },
    );
    // Wings.
    for (const side of [-1, 1]) {
      kit.prism(
        [
          [0, 0],
          [9.0, -1.4],
          [9.6, 0.9],
          [0, 1.8],
        ],
        0.35,
        [side * 5.2, -0.9, 0.5],
        shade(gold, 1.08),
        { rotY: side > 0 ? 0 : Math.PI, collide: false },
      );
    }
    // Low banner posts around the rim — below eye level, so they never obscure.
    kit.ring(6, 5.2, (px, pz, a) => {
      kit.cylinder(0.12, 0.14, 1.1, [px, 0.5, pz], gold, { segments: 5, collide: false });
      kit.box([0.08, 0.7, 0.9], [px, 0.8, pz], 0xd4702a, { rotY: -a, collide: false });
    });

    const built = kit.build();
    this.vimanaMesh = new THREE.Mesh(built.geometry, stoneMaterial());
    this.vimanaMesh.name = 'vimana';
    this.vimanaMesh.castShadow = false;
    this.vimanaMesh.visible = false;
    this.scene.add(this.vimanaMesh);
  }

  // ------------------------------------------------------------------ start

  /** Start a fresh descent over the first chapter's zone. */
  startNewJourney(): void {
    const first = ZONES[0] as Zone;
    const rng = new Rng(`${save.profile.worldSeed}:ride`);
    const target = new THREE.Vector3(first.center[0], 0, first.center[1]);
    // Fly across the island and through the first zone, so the player sees the
    // whole map before choosing where to land.
    // Aim the path across the middle of the island so the crossing shows every
    // era, and clamp both ends inside the world so it never starts over empty sea.
    const angle = rng.range(0, Math.PI * 2);
    const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const centre = new THREE.Vector3(0, 0, 0).lerp(target, 0.55);
    const from = clampToWorld(centre.clone().addScaledVector(dir, 1150).setY(420));
    const to = clampToWorld(target.clone().addScaledVector(dir, -520).setY(360));

    this.rideHeading = Math.atan2(to.x - from.x, to.z - from.z);
    this.beginPlay();
    this.player.startRide({ from, to, duration: 52 });
    this.hud.toast('info', 'Press Space to drop', 'Steer with WASD. The canopy opens automatically.', '🪂', 9000);
    audio.setTheme('flight');
    // Narrated as captions, never as a dialogue, so the crossing keeps moving.
    if (!this.story.prologueSeen()) {
      this.story.markPrologueSeen();
      void this.narration.say(PROLOGUE.map((l) => this.narrationLine(l)));
    }
  }

  /** Resume from the saved position, or start a new journey if there is none. */
  continueJourney(): void {
    const pos = save.profile.lastPosition;
    if (!pos) {
      this.startNewJourney();
      return;
    }
    this.beginPlay();
    this.player.placeAt(new THREE.Vector3(pos[0], pos[1], pos[2]));
    const zone = this.world.zoneAt(pos[0], pos[2]);
    if (zone) this.enterZone(zone, true);
  }

  private beginPlay(): void {
    this.running = true;
    this.paused = false;
    this.sessionStart = Date.now();
    this.hud.show();
    this.hud.setVidya(save.profile.vidya);
    this.showToolbelt();
    this.refreshObjectives();
    audio.startScore();
    this.input.requestLock();
    if (!this.clock.running) this.clock.start();
    this.loop();
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);
    if (!this.running) return;

    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    const blocked = overlayOpen() || this.dialogue.isOpen || this.paused;

    if (!blocked) {
      this.handleHotkeys();
      // The chariot must move before the player, who rides on it.
      this.updateVehicle(dt);
      this.player.update(dt);
      this.updateInteraction(dt);
      this.pillars.update(dt);
      const letter = this.aksharas.update(dt, this.elapsed, this.player.position);
      if (letter) this.foundAkshara(letter);
    } else {
      // Menu keys still work while an overlay is up.
      if (this.input.justPressed('pause') && !overlayOpen() && !this.dialogue.isOpen) this.togglePause();
    }

    this.world.update(dt, this.camera, this.elapsed, this.player.position, this.talkingTo);
    this.camera.getWorldDirection(_look);
    audio.listen(this.camera.position.x, this.camera.position.y, this.camera.position.z, _look.x, _look.y, _look.z);
    this.updateGuide(dt, blocked);
    {
      const flying = this.player.state !== 'ground' && this.player.state !== 'climb' && this.player.state !== 'swim';
      this.combat.update(dt, this.elapsed, this.player.position, blocked || this.dialogue.isOpen || flying);
      this.hud.setHearts(this.combat.hearts, PLAYER_HEARTS, this.combat.enabled && (this.combat.engaged || this.combat.hearts < PLAYER_HEARTS));
    }
    this.labels.setVisible(!blocked || this.dialogue.isOpen);
    this.labels.update(this.world.npcView, this.camera, (id) => this.npcMark(id), this.viewport.clientWidth, this.viewport.clientHeight);
    this.updateVimana();
    this.updateMinimap();
    this.updateHud(blocked);
    this.trackStats(dt);

    const sunDir = _sunDir.copy(this.world.sky.sun.position).sub(this.camera.position).normalize();
    this.post.render(dt, this.elapsed, sunDir, this.world.sky.sun.color);
    if (this.photoPending) {
      this.photoPending = false;
      this.takePhoto();
    }
    // If the post chain has had to step down, the machine is struggling: thin the grass too.
    if (this.post.currentTier !== this.lastTier) {
      this.lastTier = this.post.currentTier;
      this.world.setDetail(this.lastTier === 'full' ? 1 : this.lastTier === 'lite' ? 0.6 : 0.35);
    }
    this.input.endFrame();
  };

  // ------------------------------------------------------------- photo mode

  private takePhoto(): void {
    const shot = captureFrame(this.renderer.domElement);
    shutter();
    const zone = this.world.zoneAt(this.player.position.x, this.player.position.z);
    // A moment for the flash, then the darkroom.
    setTimeout(() => {
      this.input.releaseLock();
      openDarkroom(shot, zone, save.profile.playerName, () => save.countPhoto());
    }, 350);
  }

  // ------------------------------------------------------------- aksharas

  private foundAkshara(a: Akshara): void {
    if (!save.collectAkshara(a.id)) return;
    save.addVidya(25);
    bus.emit('vidya:gain', { amount: 25, reason: `Found an akshara: ${a.script}` });
    const glyph = 'text' in a.glyph ? a.glyph.text : '✦';
    const total = save.profile.creative.aksharas.length;
    this.hud.toast('good', `Akshara found · ${a.script} · ${a.sound}`, `${a.note} (${total} of ${AKSHARAS.length} — see the Varnamala in the Gatha, K)`, glyph, 9000);
    const here = aksharasIn(a.zoneId);
    const got = here.filter((x) => save.profile.creative.aksharas.includes(x.id)).length;
    if (total === 1) {
      void this.narration.say([
        this.narrationLine({ who: 'maitri', text: 'A letter! Somebody shaped that once and meant it to be read. There are more, hidden all over the island. Look near the monuments.' }),
      ]);
    } else if (total === AKSHARAS.length) {
      void this.narration.say([
        this.narrationLine({ who: 'maitri', text: 'Every letter, from the unread fish of the Indus to the clerk\'s Modi hand. Five thousand years of people wanting to be understood. Open the Varnamala and read it through.' }),
      ]);
      audio.success(5);
    } else if (got === here.length) {
      const zone = getZone(a.zoneId);
      this.hud.toast('info', `All three letters of ${zone?.name ?? 'this region'}`, 'Their page of the Varnamala is complete.', '📜', 6000);
    }
  }

  // ------------------------------------------------------------- interaction

  private handleHotkeys(): void {
    if (this.input.justPressed('photo')) {
      this.photoPending = true;
      return;
    }
    if (this.input.justPressed('pause')) {
      this.togglePause();
      return;
    }
    if (this.input.justPressed('codex')) {
      this.openCodex();
      return;
    }
    if (this.input.justPressed('scroll')) {
      this.scrollModal.present();
      return;
    }
    if (this.input.justPressed('map')) {
      this.openMap();
      return;
    }
    if (this.input.justPressed('help')) {
      this.openHelp();
      return;
    }
    for (const [action, index] of [['slot1', 0], ['slot2', 1], ['slot3', 2]] as const) {
      if (this.input.justPressed(action) && this.tool !== index) {
        this.tool = index;
        this.showToolbelt();
        audio.click();
      }
    }
    if (this.player.state === 'ground' && !this.ridingChariot) {
      const left = this.input.mouse.leftEdge;
      if (this.tool === 0 && left) {
        // From the chest, a little to the right, toward the crosshair.
        this.player.getForward(_aim);
        _from.copy(this.player.position).add(_up.set(0, 1.45, 0)).addScaledVector(_side.set(Math.cos(this.player.yaw), 0, -Math.sin(this.player.yaw)), 0.3);
        this.combat.shoot(_from, this.camera.position, _aim);
      } else if ((this.tool === 1 && left) || this.input.justPressed('ability')) {
        this.player.getForward(_aim);
        this.combat.strike(this.player.position, _aim);
      }
    }
    if (this.input.justPressed('track')) {
      const on = !save.settings.guide;
      save.patchSettings({ guide: on });
      this.waypoint.setEnabled(on);
      this.guideTimer = 0; // refresh the card on the very next frame
      this.hud.toast('info', on ? 'Marker on' : 'Marker off', on ? 'The gold marker points at your next step. Press T to hide it.' : 'Press T to show it again.', '◆', 3000);
      return;
    }
    if (this.input.justPressed('cameraToggle')) {
      const mode = this.player.toggleCamera();
      this.hud.toast('info', mode === 'third' ? 'Third person' : 'First person', 'Press V to switch back.', '🎥', 2500);
      return;
    }
  }

  /** Drive the chariot the player is standing in. */
  private updateVehicle(dt: number): void {
    const chariot = this.ridingChariot;
    if (!chariot) return;

    const throttle = (this.input.pressed('forward') ? 1 : 0) + (this.input.pressed('back') ? -1 : 0);
    const steer = (this.input.pressed('right') ? 1 : 0) + (this.input.pressed('left') ? -1 : 0);
    chariot.update(dt, { throttle, steer, handbrake: this.input.pressed('jump') });

    // Swing the camera back behind the chariot once it is moving, unless the
    // player is actively looking around. Without this the camera keeps whatever
    // angle it had when you mounted and you end up driving sideways.
    const looking = Math.abs(this.input.mouse.dx) > 1e-4;
    if (!looking && Math.abs(chariot.speed) > 1) {
      const rate = dt * (1.2 + Math.abs(chariot.speed) * 0.09);
      this.player.yaw = approachAngle(this.player.yaw, chariot.yaw, rate);
    }

    this.player.vehicle = { position: chariot.riderPosition, yaw: chariot.yaw, deckHeight: CHARIOT_DECK_HEIGHT };
  }

  private mountChariot(chariot: Chariot): void {
    chariot.mount();
    this.ridingChariot = chariot;
    this.player.vehicle = { position: chariot.riderPosition, yaw: chariot.yaw, deckHeight: CHARIOT_DECK_HEIGHT };
    this.player.rig.reset();
    this.hud.toast('info', 'Chariot', 'W/S throttle · A/D steer · Space brake · E to step down.', '🐎', 6000);
  }

  private dismountChariot(): void {
    const chariot = this.ridingChariot;
    if (!chariot) return;
    chariot.dismount();
    this.ridingChariot = null;
    this.player.vehicle = null;
    const spot = chariot.dismountPoint();
    this.player.placeAt(new THREE.Vector3(spot.x, spot.y + 0.2, spot.z));
    this.player.yaw = chariot.yaw;
    this.player.rig.reset();
  }

  private updateInteraction(dt: number): void {
    // --- scanning with the Pramana lens (hold right mouse).
    const scanning = this.input.mouse.right && !this.player.isAirborne;
    if (scanning) {
      const forward = this.player.getForward(_fwd);
      const lm = this.world.landmarkInSights(this.camera.position, forward, SCAN_RANGE);
      if (lm && lm.codexId) {
        if (this.scanTarget !== lm.id) {
          this.scanTarget = lm.id;
          this.scanProgress = 0;
        }
        const already = save.hasCodex(lm.codexId);
        this.scanProgress += dt / Math.max(0.5, lm.scanSeconds);
        this.hud.setScan(this.scanProgress, already ? `${lm.name} (known)` : lm.name);
        if (this.scanProgress >= 1) {
          this.scanProgress = 0;
          this.scanTarget = null;
          this.hud.setScan(null);
          this.completeScan(lm.codexId, lm.name);
        }
      } else {
        this.scanTarget = null;
        this.scanProgress = 0;
        this.hud.setScan(0, 'No monument in view');
      }
    } else {
      if (this.scanTarget !== null) {
        this.scanTarget = null;
        this.scanProgress = 0;
      }
      this.hud.setScan(null);
    }

    // --- riding: the only interaction available is stepping down.
    if (this.ridingChariot) {
      this.hud.setInteractPrompt('Step down from the chariot');
      if (this.input.justPressed('interact') || this.input.justPressed('mount')) this.dismountChariot();
      const zone = this.world.zoneAt(this.player.position.x, this.player.position.z);
      if (zone && zone.id !== this.currentZone?.id) this.enterZone(zone, false);
      return;
    }

    // --- the musical pillars at Hampi.
    if (this.pillars.firstVisit(this.player.position)) {
      this.hud.toast(
        'info',
        'The Sangita Mandapa',
        'These pillars ring. Walk up to one and press E to strike it. Try the scale up (Sa Re Ga Ma Pa Dha Ni), then down, and listen for a raga hidden in five of them.',
        '🎶',
        10000,
      );
    }
    const pillar = this.pillars.nearest(this.player.position);
    if (pillar) {
      this.hud.setInteractPrompt(this.pillars.promptFor(pillar));
      if (this.input.justPressed('interact')) this.pillars.strike(pillar);
      return;
    }

    // --- E to interact. A chariot you are standing next to wins, because that
    // is almost always what you meant.
    const chariot = this.world.nearestChariot(this.player.focusPosition, 5.5);
    const near = this.world.nearestInteractable(this.player.focusPosition);
    if (chariot && !scanning) {
      this.hud.setInteractPrompt('Ride the chariot');
      if (this.input.justPressed('interact') || this.input.justPressed('mount')) this.mountChariot(chariot);
    } else if (near && !scanning) {
      this.hud.setInteractPrompt(near.label);
      if (this.input.justPressed('interact')) void this.interact(near);
    } else if (this.player.canClimb && !scanning) {
      this.hud.setInteractPrompt('Climb', 'Space');
    } else {
      this.hud.setInteractPrompt(null);
    }

    // --- zone transitions.
    const zone = this.world.zoneAt(this.player.position.x, this.player.position.z);
    if (zone && zone.id !== this.currentZone?.id) this.enterZone(zone, false);

    this.maybeRunZoneHook();
    if (this.pendingTheme && this.player.state === 'ground') this.applyTheme();
  }

  private applyTheme(): void {
    if (!this.pendingTheme) return;
    audio.setTheme(this.pendingTheme);
    this.pendingTheme = null;
  }

  /**
   * Say a region's story hook the first time the player is standing in it.
   * Deferred until they are on the ground, so the opening flight over eleven
   * regions does not fire eleven hooks into the prologue.
   */
  private maybeRunZoneHook(): void {
    const zone = this.currentZone;
    if (!zone || this.hooked.has(zone.id) || this.player.state !== 'ground') return;
    this.hooked.add(zone.id);
    const lines = this.story.onZoneEnter(zone.id);
    if (lines) void this.narration.say(lines.map((l) => this.narrationLine(l)));
    if (this.story.once('tip:journey')) {
      this.hud.toast('info', 'Lost? Press M', 'Your map, your roadmap and your next step. F1 explains how to play.', '🗺️', 10000);
    }
  }

  private completeScan(codexId: string, landmarkName: string): void {
    const entry = getCodex(codexId);
    if (!entry) return;
    const isNew = save.unlockCodex(codexId);
    save.profile.stats.landmarksScanned++;
    if (isNew) {
      save.addVidya(45);
      audio.success(3);
      this.hud.toast('codex', `Codex: ${entry.title}`, `${landmarkName} — recorded. Press J to read it.`, '📖', 6500);
      bus.emit('codex:unlock', { entryId: codexId });
      this.refreshObjectives();
    } else {
      this.hud.toast('info', 'Already recorded', entry.title, '📖', 2500);
    }
  }

  private async interact(target: Interactable): Promise<void> {
    audio.click();
    switch (target.kind) {
      case 'npc':
        await this.talkToNpc(target);
        break;
      case 'pad':
        this.openFastTravel(target);
        break;
      case 'challenge':
        if (target.challenge) await this.runChallenge(target.challenge, target.zoneId);
        break;
      case 'plaque':
        if (target.plaque) await this.readPlaque(target.plaque);
        break;
    }
  }

  /**
   * Talk to someone. Their lines become a short conversation rather than a
   * toast — a person you can stand and listen to reads as a person, and a
   * notification does not.
   */
  private async talkToNpc(target: Interactable): Promise<void> {
    const npc = target.npc;
    if (!npc) return;
    if (this.dialogue.isOpen) return;

    const spoken = this.spokenTo.has(npc.id);
    this.spokenTo.add(npc.id);
    this.talkingTo = npc.id;

    // Start at a different line each time, so a second visit is not a rerun.
    const start = spoken ? Math.floor(Math.random() * npc.lines.length) : 0;
    const ordered = [...npc.lines.slice(start), ...npc.lines.slice(0, start)];
    const nodes = ordered.map((text, i) => ({
      id: `line-${i}`,
      text,
      ...(i === ordered.length - 1 ? { end: true as const } : { next: `line-${i + 1}` }),
    }));

    await this.dialogue.run({ name: npc.name, role: npc.role, icon: npc.icon }, nodes);
    this.talkingTo = null;

    if (!spoken) {
      save.addVidya(15);
      bus.emit('vidya:gain', { amount: 15, reason: `Spoke with ${npc.name}` });
    }
    if (npc.unlocks && save.unlockCodex(npc.unlocks)) {
      const entry = getCodex(npc.unlocks);
      save.addVidya(25);
      this.hud.toast('codex', `Codex: ${entry?.title ?? npc.unlocks}`, `Learned from ${npc.name}.`, '📖', 6000);
    }

    // A trail advances when its next person is spoken to, in order.
    const step = this.story.onNpcSpoken(npc.id);
    if (step) {
      void this.narration.say([this.narrationLine({ who: 'maitri', text: step.text })]);
      if (step.complete) this.hud.toast('good', step.trail.title, `Trail complete. +${step.trail.vidya} Vidya.`, '🧭', 6000);
    }
    this.refreshObjectives();
  }

  // ------------------------------------------------------------------ story

  /** What a person matters for, for the mark on their nameplate. */
  private npcMark(id: string): NpcMark {
    const met = save.profile.story.met.includes(id);
    const zone = this.currentZone;
    const chapter = zone ? getChapter(zone.id) : undefined;
    if (chapter) {
      const trail = chapter.trail;
      const at = this.story.trailProgress(trail.id);
      if (at < trail.stops.length && trail.stops[at]?.npcId === id) return 'trail';
      if (chapter.anchorNpcId === id && !met) return 'anchor';
    }
    return met ? 'met' : 'new';
  }

  private narrationLine(line: StoryLine): NarrationLine {
    const speaker = line.who === 'ekarupa' ? EKARUPA : MAITRI;
    return { name: speaker.name, role: speaker.role, icon: speaker.icon, text: line.text, voice: line.who, mask: line.mask };
  }

  private speakerLine(speaker: Speaker, text: string): NarrationLine {
    return { name: speaker.name, role: speaker.role, icon: speaker.icon, text, voice: 'npc' };
  }

  /** An anchor’s reflection after a challenge, said once, after any quiz has closed. */
  private sayAnchorBeat(challengeId: string): void {
    const beat = this.story.onChallengeDone(challengeId);
    if (beat) void this.narration.say([this.speakerLine(beat.speaker, beat.text)]);
  }

  private async readPlaque(plaque: NonNullable<Interactable['plaque']>): Promise<void> {
    const wasDone = this.story.plaqueDone(plaque.id);
    await this.plaqueModal.present(plaque);
    if (!wasDone && this.story.plaqueDone(plaque.id)) {
      this.world.setPlaqueCleared(plaque.id);
      this.hud.toast('good', 'The haze lifts', 'A claim corrected, and written onto the Gatha.', '🌫️', 5000);
    }
    this.refreshObjectives();
  }

  /** Maitri restores the panel for a sealed chapter, asks the one question, and hangs it on the scroll. */
  private async runRestoration(zoneId: string): Promise<void> {
    const chapter = getChapter(zoneId);
    if (!chapter || !this.story.restorable(zoneId) || this.dialogue.isOpen) return;

    const outcome = await this.dialogue.run(MAITRI, chapter.restoration);
    // Closed early: the panel stays sealed-but-unrestored, and the scroll offers it again.
    if (!outcome.completed) {
      this.hud.toast('info', 'The panel waits', 'Open the Gatha (K) to restore it whenever you are ready.', '📜', 6000);
      return;
    }
    save.addVidya(outcome.vidya);
    this.story.restorePanel(zoneId, { wise: outcome.wiseChoices, made: outcome.choicesMade });
    audio.bell();
    this.hud.toast('vidya', `Panel restored: ${chapter.panel.title}`, 'The Gatha is a little less clouded.', '📜', 7000);
    this.updateVeil();
    this.refreshObjectives();

    const restored = this.story.panelsRestored();
    if (restored === SABHA_MIN_PANELS) {
      this.hud.toast('info', 'The Sabha can be convened', 'Open the Gatha (K) and call Ekarupa to account.', '🏛️', 8000);
    }
    if (restored === CHAPTERS.length) {
      void this.narration.say([
        this.narrationLine({ who: 'maitri', text: 'All eleven panels are back, and they do not quite touch yet. Open the scroll, and call the Sabha.' }),
      ]);
    }
    // Show the panel the player has just earned.
    this.scrollModal.present(zoneId, true);
  }

  private async runSabha(): Promise<void> {
    const result = await this.sabhaModal.present();
    this.refreshObjectives();
    if (result === 'settled') {
      this.hud.toast('vidya', 'The Sabha is settled', 'The threads are braided. The Twelfth Panel is yours to write.', '🏛️', 8000);
      await this.runTwelfth();
    }
  }

  private async runTwelfth(): Promise<void> {
    await this.twelfthModal.present();
    this.refreshObjectives();
  }

  /** Grey the edges of the screen in proportion to how much of this region is still under the Dhundh. */
  private updateVeil(): void {
    const level = this.currentZone ? this.story.hazeLevel(this.currentZone.id) : 0;
    this.veil.style.opacity = String(Math.round(level * 0.3 * 100) / 100);
  }

  private async runChallenge(challenge: ChallengeSpec, zoneId: string): Promise<void> {
    if (challenge.kind === 'dialogue') {
      const outcome = await this.dialogue.run(challenge.config.speaker, challenge.config.nodes);
      if (!outcome.completed) return;

      let gained = challenge.vidya + outcome.vidya;
      for (const id of [...(challenge.unlocks ?? []), ...outcome.unlocks]) {
        if (save.unlockCodex(id)) {
          const entry = getCodex(id);
          this.hud.toast('codex', `Codex: ${entry?.title ?? id}`, 'Unlocked.', '📖', 5000);
        }
      }
      if (save.completeChallenge(zoneId, challenge.id)) {
        this.hud.toast('good', challenge.name, challenge.teaches, '✓', 8000);
      } else {
        gained = Math.round(gained * 0.3);
      }
      save.addVidya(gained);
      bus.emit('vidya:gain', { amount: gained, reason: challenge.name });
      bus.emit('challenge:finish', { challengeId: challenge.id, success: true, score: outcome.wiseChoices });
      this.refreshObjectives();

      if (challenge.quizAfter && challenge.quizAfter > 0) await this.runQuiz(zoneId, 'challenge', challenge.quizAfter, challenge.name);
      this.sayAnchorBeat(challenge.id);
      return;
    }

    // A playable game, where the kind has one: finish it to complete the
    // challenge, then an optional quiz round follows, as with a conversation.
    if (this.minigames.has(challenge.kind)) {
      const result = await this.minigames.run(challenge);
      if (!result || !result.passed) return;
      this.completeMiniGame(challenge, zoneId, result);
      if (challenge.quizAfter && challenge.quizAfter > 0) await this.runQuiz(zoneId, 'challenge', challenge.quizAfter, challenge.name);
      this.sayAnchorBeat(challenge.id);
      return;
    }

    // Every kind now has a game. Anything that slips through is a content error, not something to fake.
    console.warn(`[challenge] "${challenge.id}" has kind "${challenge.kind}" with no runner`);
  }

  /** Pay out a finished mini-game: codex, Vidya scaled a little by how cleanly it went, and the completion record. */
  private completeMiniGame(challenge: ChallengeSpec, zoneId: string, result: MiniGameResult): void {
    for (const id of challenge.unlocks ?? []) {
      if (save.unlockCodex(id)) {
        const entry = getCodex(id);
        this.hud.toast('codex', `Codex: ${entry?.title ?? id}`, 'Unlocked.', '📖', 5000);
      }
    }
    // Between 70% and 100% of the listed Vidya, by score. Never zero, never a gate.
    let gained = Math.round(challenge.vidya * (0.7 + 0.3 * (result.score / 100)));
    if (save.completeChallenge(zoneId, challenge.id)) {
      this.hud.toast('good', challenge.name, challenge.teaches, '✓', 8000);
    } else {
      gained = Math.round(gained * 0.3);
    }
    save.addVidya(gained);
    bus.emit('vidya:gain', { amount: gained, reason: challenge.name });
    bus.emit('challenge:finish', { challengeId: challenge.id, success: true, score: result.score });
    this.refreshObjectives();
  }

  private async runQuiz(
    zoneId: string | null,
    reason: 'challenge' | 'seal' | 'practice',
    count: number,
    title: string,
  ): Promise<ReturnType<QuizEngine['finish']>> {
    const started = this.quiz.start({ zoneId, reason, count });
    if (!started) {
      this.hud.toast('bad', 'No questions available', 'That should not happen — please report it.', '✕');
      return null;
    }
    const zone = zoneId ? getZone(zoneId) : null;
    const result = await this.quizModal.present({
      title,
      subtitle: zone ? `${zone.name} · ${zone.era}` : 'Mixed questions',
      allowClose: reason !== 'seal',
    });
    // A passed chapter assessment restores its panel, now that the screen is closed.
    const pending = this.story.takePendingRestoration();
    if (pending) await this.runRestoration(pending);
    return result;
  }

  // ----------------------------------------------------------------- zones

  private enterZone(zone: Zone, silent: boolean): void {
    const previous = this.currentZone;
    this.currentZone = zone;
    this.refreshGuide();
    if (previous) bus.emit('zone:exit', { zoneId: previous.id });

    this.world.sky.setPalette(zone.palette);
    if (silent) this.world.sky.applyImmediately(zone.palette);
    // The region's theme starts once the player is on the ground (see maybeRunZoneHook's caller).
    this.pendingTheme = zone.id;
    if (this.player.state === 'ground' || this.player.state === 'swim') this.applyTheme();

    const progress = save.zone(zone.id);
    const firstVisit = !progress.discovered;
    if (firstVisit) {
      progress.discovered = true;
      save.addVidya(60);
      save.markDirty();
    }

    if (!silent) {
      this.hud.announceZone(zone, { storyTitle: getChapter(zone.id)?.title, first: firstVisit });
      if (firstVisit) {
        this.hud.toast('vidya', `Discovered ${zone.name}`, zone.tagline, '🧭', 7000);
        audio.bell();
      }
    }
    bus.emit('zone:enter', { zoneId: zone.id });
    this.updateVeil();
    this.refreshObjectives();
  }

  // --------------------------------------------------------------- guidance

  /** Work out what the player should do next, from their save. Cheap; called when anything changes. */
  private refreshGuide(): void {
    if (!this.world) return;
    const profile = save.profile;
    const zone = this.currentZone;
    let action: NextAction | null = null;
    const here = zone ? chapterProgress(zone, profile) : null;
    if (here && !here.restored) action = nextAction(here, profile);
    else action = journeyAction(profile);
    this.guideAction = action;
  }

  /** Where in the world a next step points, or null if it is something done from a menu. */
  private resolveTarget(target: NextTarget): THREE.Vector3 | null {
    const up = (v: THREE.Vector3, h: number): THREE.Vector3 => _guide.set(v.x, v.y + h, v.z);
    switch (target.kind) {
      case 'landmark': {
        const lm = this.world.landmarks.find((l) => l.id === target.id);
        return lm ? up(lm.position, Math.min(14, Math.max(4, lm.height * 0.6))) : null;
      }
      case 'npc': {
        const it = this.world.interactables.find((i) => i.kind === 'npc' && i.npc?.id === target.id);
        return it ? up(it.position, 3.2) : null;
      }
      case 'challenge': {
        const it = this.world.interactables.find((i) => i.kind === 'challenge' && i.challenge?.id === target.id);
        return it ? up(it.position, 3.4) : null;
      }
      case 'plaque': {
        const it = this.world.interactables.find((i) => i.kind === 'plaque' && i.plaque?.id === target.id);
        return it ? up(it.position, 3) : null;
      }
      case 'travel': {
        const pad = this.world.padFor(target.zoneId);
        return pad ? up(pad.position, 10) : null;
      }
      default:
        return null;
    }
  }

  /** Per frame: place the marker and keep the Next step card honest. */
  private updateGuide(dt: number, blocked: boolean): void {
    const flying = this.player.state === 'vimana' || this.player.state === 'freefall' || this.player.state === 'glide';
    // The first time the player touches ground after the flight, the coach offers to show them around.
    if (flying) this.hasFlown = true;
    else if (this.hasFlown && this.player.state === 'ground') {
      this.hasFlown = false;
      this.coach.start();
    }
    const action = flying || !save.settings.guide ? null : this.guideAction;

    this.guideTimer -= dt;
    const tick = this.guideTimer <= 0;
    if (tick) {
      this.guideTimer = 0.4;
      this.hud.setNext(action ? { title: action.short, how: action.how } : null);
    }
    const pos = action ? this.resolveTarget(action.target) : null;
    if (!action || !pos) {
      this.waypoint.set(null);
      this.guideDistance = null;
      if (tick) this.hud.setNextDistance(null);
      this.runCoach(dt, blocked);
      return;
    }
    this.waypoint.set({ position: pos, label: action.short });
    this.waypoint.setVisible(!blocked && !this.dialogue.isOpen);
    const w = this.viewport.clientWidth || window.innerWidth;
    const h = this.viewport.clientHeight || window.innerHeight;
    const d = this.waypoint.update(this.camera, w, h, this.player.position);
    this.guideDistance = d;
    if (tick) this.hud.setNextDistance(d);
    this.runCoach(dt, blocked);
  }

  private runCoach(dt: number, blocked: boolean): void {
    this.coach.update(dt, {
      active: !blocked && !this.dialogue.isOpen && this.player.state === 'ground',
      yaw: this.player.yaw,
      walked: this.player.distanceWalked,
      markerDistance: save.settings.guide ? this.guideDistance : null,
    });
  }

  private refreshObjectives(): void {
    this.refreshGuide();
    const zone = this.currentZone ?? (ZONES[0] as Zone);
    const progress = save.zone(zone.id);
    const landmarks = zone.landmarks.filter((l) => l.codexId);
    const scanned = landmarks.filter((l) => l.codexId && save.hasCodex(l.codexId)).length;
    const done = progress.challenges.length;

    this.hud.setObjectives(`Chapter ${zone.chapter} · ${zone.name}`, [
      {
        text: `Scan ${landmarks.length} monuments (${scanned}/${landmarks.length})`,
        done: scanned >= landmarks.length,
        active: scanned < landmarks.length,
      },
      {
        text: `Complete ${zone.challenges.length} challenges (${done}/${zone.challenges.length})`,
        done: done >= zone.challenges.length,
        active: scanned >= landmarks.length && done < zone.challenges.length,
      },
      {
        text: progress.sealed ? `Chapter sealed at ${progress.bestSeal}%` : `Seal the chapter (needs ${zone.sealRequires} challenges)`,
        done: progress.sealed,
        active: !progress.sealed && done >= zone.sealRequires,
      },
      ...this.storyObjectives(zone),
    ]);
  }

  /** The story's two rows beside the chapter's own: plaques and the trail. The anchor and panel live in the scroll. */
  private storyObjectives(zone: Zone): ObjectiveRow[] {
    return this.story.objectives(zone).filter((r) => r.id === 'plaques' || r.id === 'trail');
  }

  // ------------------------------------------------------------------- hud

  /**
   * Rebuild the static map markers. Cheap enough to redo whenever discovery
   * state changes, which keeps it honest without any incremental bookkeeping.
   */
  private refreshMapMarkers(): void {
    if (!this.minimap) return;
    const markers: MinimapMarker[] = [];

    for (const lm of this.world.landmarks) {
      if (!lm.codexId) continue;
      const discovered = save.zone(lm.zoneId).discovered;
      markers.push({
        x: lm.position.x,
        z: lm.position.z,
        kind: 'landmark',
        label: lm.name,
        done: save.hasCodex(lm.codexId),
        dim: !discovered,
      });
    }

    for (const it of this.world.interactables) {
      const discovered = save.zone(it.zoneId).discovered;
      if (it.kind === 'challenge' && it.challenge) {
        markers.push({
          x: it.position.x,
          z: it.position.z,
          kind: 'challenge',
          label: it.challenge.name,
          done: save.zone(it.zoneId).challenges.includes(it.challenge.id),
          dim: !discovered,
        });
      } else if (it.kind === 'npc') {
        markers.push({ x: it.position.x, z: it.position.z, kind: 'npc', dim: !discovered });
      } else if (it.kind === 'pad') {
        markers.push({ x: it.position.x, z: it.position.z, kind: 'pad', dim: !discovered });
      }
    }

    this.minimap.setStaticMarkers(markers);
  }

  private updateMinimap(): void {
    const wheel = this.input.mouse.wheel;
    if (wheel !== 0) {
      const range = this.minimap.adjustZoom(wheel > 0 ? 1 : -1);
      this.hud.toast('info', 'Map range', range, '🗺️', 1400);
    }
    const dynamic: MinimapMarker[] = this.world.chariots.map((c) => ({
      x: c.position.x,
      z: c.position.z,
      kind: 'chariot' as const,
      yaw: c.yaw,
    }));
    this.minimap.update(this.player.position.x, this.player.position.z, this.player.yaw, dynamic);
  }

  private updateHud(blocked: boolean): void {
    if (blocked) {
      this.hud.setCrosshair('hidden');
      this.hud.setInteractPrompt(null);
      this.hud.setFlightHint(null);
      return;
    }

    // Compass points of interest: the nearest few signposted monuments.
    const pois: CompassPoi[] = [];
    const px = this.player.position.x;
    const pz = this.player.position.z;
    for (const lm of this.world.landmarks) {
      if (!lm.signposted) continue;
      const dx = lm.position.x - px;
      const dz = lm.position.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > 420) continue;
      pois.push({ bearing: PlayerController.yawTowards(dx, dz), label: lm.name, distance: dist });
    }
    pois.sort((a, b) => a.distance - b.distance);
    this.hud.updateCompass(this.player.yaw, pois.slice(0, 3));

    // Crosshair state.
    if (this.input.mouse.right) this.hud.setCrosshair('scan');
    else if (this.tool === 0 && this.combat.enabled) this.hud.setCrosshair('bow');
    else if (this.world.nearestChariot(this.player.focusPosition, 5.5) || this.world.nearestInteractable(this.player.focusPosition))
      this.hud.setCrosshair('interact');
    else this.hud.setCrosshair('idle');

    if (this.ridingChariot) {
      const kmh = Math.round(Math.abs(this.ridingChariot.speed) * 3.6);
      this.hud.setFlightHint(
        `Chariot · <strong>${kmh} km/h</strong> · <strong>W/S</strong> throttle · <strong>A/D</strong> steer · <strong>Space</strong> brake · <strong>E</strong> to step down`,
      );
      return;
    }

    // Flight guidance.
    switch (this.player.state) {
      case 'vimana':
        this.hud.setFlightHint(
          `<strong>Space</strong> to drop · altitude ${Math.round(this.player.position.y)} m · ${Math.round(
            (1 - this.player.rideProgress) * 100,
          )}% of the crossing left`,
        );
        break;
      case 'freefall':
        this.hud.setFlightHint(
          `<strong>WASD</strong> to steer · <strong>Space</strong> for the canopy · ${Math.round(this.player.altitude())} m`,
        );
        break;
      case 'glide':
        this.hud.setFlightHint(`Gliding · <strong>A/D</strong> turn · <strong>S</strong> flare · ${Math.round(this.player.altitude())} m`);
        break;
      case 'swim':
        this.hud.setFlightHint('Swimming · <strong>Space</strong> to surface');
        break;
      default:
        this.hud.setFlightHint(null);
        break;
    }
  }

  private updateVimana(): void {
    if (!this.vimanaMesh) return;
    const riding = this.player.state === 'vimana';
    this.vimanaMesh.visible = riding;
    if (!riding) return;
    // Deck top sits just under the player's feet; the craft faces the flight path.
    this.vimanaMesh.position.set(
      this.player.ridePosition.x,
      this.player.ridePosition.y - 0.1,
      this.player.ridePosition.z,
    );
    this.vimanaMesh.rotation.y = this.rideHeading;
  }

  private trackStats(dt: number): void {
    this.statsTimer += dt;
    if (this.statsTimer < 5) return;
    this.statsTimer = 0;

    const stats = save.profile.stats;
    stats.playSeconds = Math.round((Date.now() - this.sessionStart) / 1000) + stats.playSeconds;
    this.sessionStart = Date.now();
    stats.distanceWalked = Math.round(stats.distanceWalked + this.player.distanceWalked);
    this.player.distanceWalked = 0;

    if (this.currentZone) {
      save.zone(this.currentZone.id).timeSpent += 5;
      save.profile.lastZone = this.currentZone.id;
    }
    save.profile.lastPosition = [
      Math.round(this.player.position.x * 100) / 100,
      Math.round(this.player.position.y * 100) / 100,
      Math.round(this.player.position.z * 100) / 100,
    ];
    save.markDirty();
  }

  // --------------------------------------------------------------- overlays

  private togglePause(): void {
    if (overlayOpen()) {
      closeOverlay();
      this.paused = false;
      return;
    }
    this.paused = true;
    const { panel, body, foot } = buildPanel({
      title: 'Paused',
      subtitle: `${save.profile.vidya} Vidya · ${save.profile.codex.length} of ${CODEX.length} codex entries`,
      width: 'narrow',
      closable: true,
      onClose: () => this.resume(),
    });

    // Where to go: the things people look for first, as large buttons.
    const go = el('div', 'pause-go');
    const tile = (icon: string, name: string, hint: string, key: string, run: () => void): HTMLElement => {
      const b = el('button', 'pause-tile') as HTMLButtonElement;
      b.type = 'button';
      b.append(el('span', 'pt-icon', icon), el('b', undefined, name), el('small', undefined, hint));
      const k = document.createElement('kbd');
      k.textContent = key;
      b.append(k);
      b.addEventListener('click', () => {
        audio.click();
        run();
      });
      return b;
    };
    go.append(
      tile('🗺️', 'Map & roadmap', 'Where you are, and what to do next', 'M', () => {
        closeOverlay();
        this.paused = false;
        this.openMap();
      }),
      tile('📖', 'How to play', 'The guide: what to do and how', 'F1', () => this.openHelp()),
      tile('📜', 'The Gatha', 'Your scroll, plaques and story', 'K', () => {
        closeOverlay();
        this.paused = false;
        this.scrollModal.present();
      }),
      tile('🔍', 'Codex', 'Everything you have scanned', 'J', () => {
        closeOverlay();
        this.openCodex();
      }),
    );
    body.appendChild(go);

    // Settings, grouped so the page is short and each group says what is in it.
    const group = (title: string, summary: string, ...children: HTMLElement[]): HTMLElement => {
      const d = el('details', 'set-group');
      const sum = el('summary');
      sum.append(el('b', undefined, title), el('small', undefined, summary));
      d.append(sum, ...children);
      return d;
    };
    const restartCoach = button('Show the first steps again', 'btn btn-ghost btn-small');
    restartCoach.addEventListener('click', () => {
      this.resume();
      this.coach.start(true);
    });
    const sample = button('Hear a voice', 'btn btn-ghost btn-small');
    sample.addEventListener('click', () => {
      voice.speak(VOICE_SAMPLE, voice.profileForSpeaker('Maitri'));
    });

    const rows = el('div', 'set-groups');
    rows.append(
      group(
        'My class',
        cloud.membership ? `${cloud.membership.className}, as ${cloud.membership.nickname}` : 'Join your teacher’s class and save your progress',
        (() => {
          const open = button(cloud.membership ? 'Class and cloud save' : 'Join a class', 'btn btn-ghost btn-small');
          open.addEventListener('click', () => presentClassPanel({ onChange: () => void this.loadClassQuestions() }));
          return open;
        })(),
      ),
      group(
        'Guidance',
        'The gold marker and the Next step card',
        toggleRow('Gold marker and Next step card', 'Points at what to do next. Press T to switch it on or off any time.', save.settings.guide, (v) => {
          save.patchSettings({ guide: v });
          this.waypoint.setEnabled(v);
          this.guideTimer = 0;
        }),
        restartCoach,
      ),
      group(
        'Sound and voices',
        'Music, effects, who speaks and how',
        sliderRow('Music', save.settings.musicVolume, 0, 1, (v) => {
          save.patchSettings({ musicVolume: v });
          audio.setVolumes(v, save.settings.sfxVolume);
        }),
        sliderRow('Sound effects', save.settings.sfxVolume, 0, 1, (v) => {
          save.patchSettings({ sfxVolume: v });
          audio.setVolumes(save.settings.musicVolume, v);
        }),
        toggleRow('Spoken voices', voiceHint(), save.settings.voices, (v) => {
          save.patchSettings({ voices: v });
          voice.setEnabled(v);
        }),
        choiceRow(
          'Voice style',
          'Indian: Indian-English speakers. Neutral: British English. Device: your computer’s own voice. Auto picks Indian, unless your device has a natural Indian-English voice of its own.',
          [
            ['auto', 'Auto'],
            ['indian', 'Indian'],
            ['neutral', 'Neutral'],
            ['device', 'Device'],
          ],
          save.settings.voiceSource,
          (v) => {
            save.patchSettings({ voiceSource: v as Settings['voiceSource'] });
            voice.setSource(v as Settings['voiceSource']);
          },
        ),
        sliderRow('Voice volume', save.settings.voiceVolume, 0, 1, (v) => {
          save.patchSettings({ voiceVolume: v });
          voice.setVolume(v);
        }),
        sample,
      ),
      group(
        'Display and comfort',
        'Speed, text, camera and controls',
        toggleRow('Shadows', 'Costs frames on older laptops.', save.settings.shadows, (v) => {
          save.patchSettings({ shadows: v });
          this.renderer.shadowMap.enabled = v;
          this.world.sky.setShadows(v);
        }),
        toggleRow('Cinematic lighting', 'Bloom, sun shafts and colour grading. Steps down by itself if the game runs slowly.', save.settings.cinematic, (v) => {
          save.patchSettings({ cinematic: v });
          this.post.setEnabled(v);
        }),
        toggleRow('Haze shades', 'Shades of the Dhundh to fight in the open country, with the bow (1) or a strike (Q). Off makes the island peaceful.', save.settings.combat, (v) => {
          save.patchSettings({ combat: v });
          this.combat.setEnabled(v);
        }),
        toggleRow('Gentle descent', 'The glider opens automatically and falls never hurt.', save.settings.gentleMode, (v) =>
          save.patchSettings({ gentleMode: v }),
        ),
        toggleRow('Dyslexia-friendly text', 'Wider spacing and a plainer typeface.', save.settings.dyslexiaFont, (v) => {
          save.patchSettings({ dyslexiaFont: v });
          this.applyAccessibility();
        }),
        toggleRow('Head movement', 'Turn off if camera bob makes you uncomfortable.', save.settings.motionBlurFree, (v) =>
          save.patchSettings({ motionBlurFree: v }),
        ),
        sliderRow('Mouse sensitivity', save.settings.mouseSensitivity, 0.2, 3, (v) => {
          save.patchSettings({ mouseSensitivity: v });
          this.input.sensitivity = v;
        }),
      ),
    );
    body.appendChild(rows);

    const practice = button('Practice questions', 'btn btn-ghost');
    practice.addEventListener('click', async () => {
      closeOverlay();
      this.paused = false;
      await this.runQuiz(this.currentZone?.id ?? null, 'practice', 6, 'Practice round');
    });

    const exportBtn = button('Export learning record', 'btn btn-ghost');
    exportBtn.addEventListener('click', () => this.exportReport());

    const resume = button('Resume', 'btn btn-primary');
    resume.addEventListener('click', () => this.resume());

    foot.append(practice, exportBtn, resume);
    mountOverlay('pause', panel, { onEscape: () => this.resume() });
    resume.focus();
  }

  /** Fetch the class's own questions (a no-op when not in a class, or offline). */
  async loadClassQuestions(): Promise<void> {
    // (Read the bank only after the wait: this is first called from the constructor, before the bank exists.)
    const list = await cloud.questions();
    this.bank.setClassQuestions(list);
  }

  private showToolbelt(): void {
    this.hud.setToolbelt(
      [
        { key: '1', icon: '🏹', name: 'Gandiva — the bow: left click to shoot' },
        { key: '2', icon: '🔨', name: 'Shilpa hammer: left click (or Q) to strike' },
        { key: '3', icon: '🔍', name: 'Pramana lens — scan a monument (hold right mouse)' },
      ],
      this.tool,
    );
  }

  /** Set down at the region's landing terrace, at full strength. Nothing is lost. */
  private overwhelmed(): void {
    const zone = this.currentZone ?? this.world.zoneAt(this.player.position.x, this.player.position.z);
    const pad = zone ? this.world.padFor(zone.id) : undefined;
    if (pad) this.player.teleportTo(pad.position.x + 6, pad.position.z + 6);
    this.combat.restore();
    this.hud.setHearts(PLAYER_HEARTS, PLAYER_HEARTS, false);
    this.hud.toast('info', 'The haze overwhelmed you', 'It set you down at the landing terrace. Nothing is lost: try again, or keep your distance.', '🌫️', 6000);
  }

  private resume(): void {
    voice.cancel();
    closeOverlay();
    this.paused = false;
    this.input.requestLock();
  }

  private openCodex(): void {
    const { panel, body, foot } = buildPanel({
      title: 'Codex',
      subtitle: `${save.profile.codex.length} of ${CODEX.length} entries recorded. Scan monuments with the Pramana lens (hold right mouse) to add more.`,
      width: 'wide',
      closable: true,
    });

    const layout = el('div', 'codex-layout');
    const nav = el('div', 'codex-nav');
    const entries = el('div', 'codex-entries');
    layout.append(nav, entries);
    body.appendChild(layout);

    const renderZone = (zoneId: string): void => {
      const list = CODEX.filter((c) => c.zoneId === zoneId);
      entries.replaceChildren(
        ...list.map((entry) => {
          const known = save.hasCodex(entry.id);
          const card = el('article', known ? 'codex-card' : 'codex-card locked');

          const head = el('div', 'cc-head');
          const h4 = el('h4', undefined, known ? entry.title : 'Not yet recorded');
          const badge = el('span', 'src-badge', known ? SOURCE_TEXT[entry.source] : 'Locked');
          badge.dataset.src = entry.source;
          const when = el('span', 'cc-when', known ? entry.when : '—');
          head.append(h4, badge, when);
          card.appendChild(head);

          if (known) {
            for (const para of entry.body) card.appendChild(el('p', undefined, para));
            if (entry.tags.length > 0) {
              const tags = el('div', 'cc-tags');
              for (const t of entry.tags) tags.appendChild(el('span', 'cc-tag', t));
              card.appendChild(tags);
            }
            const note = el('div', 'cc-seealso', SOURCE_NOTE_TEXT[entry.source]);
            card.appendChild(note);
          } else {
            card.appendChild(el('p', undefined, 'Find and scan the monument this belongs to.'));
          }
          return card;
        }),
      );
      for (const b of nav.querySelectorAll('button')) b.classList.toggle('active', b.dataset.zone === zoneId);
    };

    for (const zone of ZONES) {
      const list = CODEX.filter((c) => c.zoneId === zone.id);
      const known = list.filter((c) => save.hasCodex(c.id)).length;
      const b = el('button') as HTMLButtonElement;
      b.type = 'button';
      b.dataset.zone = zone.id;
      b.append(el('span', undefined, zone.name), el('span', 'count', `${known}/${list.length}`));
      b.addEventListener('click', () => {
        audio.click();
        renderZone(zone.id);
      });
      nav.appendChild(b);
    }

    foot.appendChild(el('span', undefined, 'Every entry says what kind of evidence it rests on.'));
    const close = button('Close', 'btn btn-primary');
    close.addEventListener('click', () => this.resume());
    foot.appendChild(close);

    mountOverlay('codex', panel, { onEscape: () => this.resume() });
    renderZone(this.currentZone?.id ?? (ZONES[0] as Zone).id);
  }

  /** The Journey: map, roadmap and how to play. */
  private openMap(): void {
    this.journey.present('map');
  }

  /** Move the player to a region's landing terrace. */
  private travelTo(zoneId: string): void {
    const zone = getZone(zoneId);
    if (!zone) return;
    const pad = this.world.padFor(zone.id);
    const target = pad ? pad.position : new THREE.Vector3(zone.center[0], 0, zone.center[1]);
    this.player.teleportTo(target.x, target.z + 14);
    this.enterZone(zone, false);
    this.input.requestLock();
  }

  /** The chapter assessment for a region. */
  private async runSeal(zoneId: string): Promise<void> {
    const zone = getZone(zoneId);
    if (!zone) return;
    await this.runQuiz(zone.id, 'seal', 8, `${zone.name} — chapter assessment`);
    this.refreshObjectives();
  }

  private openFastTravel(pad: Interactable): void {
    this.hud.toast('info', pad.label, 'Open the map with M to travel to another discovered terrace.', '🛕', 5000);
  }

  private openHelp(): void {
    if (overlayOpen()) closeOverlay();
    this.paused = true;
    presentHowToPlay({ onClose: () => this.resume() });
  }

  private exportReport(): void {
    const payload = save.export();
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bharat-gatha-record-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const weak = this.bank.weakestSkills();
    this.hud.toast(
      'good',
      'Learning record exported',
      weak.length > 0 ? `Weakest so far: ${weak.join(', ')}.` : 'No weak areas yet — keep going.',
      '📄',
      8000,
    );
  }

  // ---------------------------------------------------------------- plumbing

  private applyAccessibility(): void {
    document.body.classList.toggle('dyslexia-friendly', save.settings.dyslexiaFont);
    document.body.classList.toggle('high-contrast', save.settings.highContrast);
  }

  private resize(): void {
    const width = this.viewport.clientWidth || window.innerWidth;
    const height = this.viewport.clientHeight || window.innerHeight;
    const scale = Math.min(2, window.devicePixelRatio) * save.settings.renderScale;
    this.renderer.setPixelRatio(scale);
    this.renderer.setSize(width, height, false);
    this.post.resize(width, height, scale);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }
}

// ---------------------------------------------------------------- UI helpers

const SOURCE_TEXT: Record<string, string> = {
  archaeology: 'Archaeology',
  text: 'Written source',
  epic: 'Epic tradition',
  debate: 'Debated',
};

const SOURCE_NOTE_TEXT: Record<string, string> = {
  archaeology: 'Based on excavated material evidence.',
  text: 'Drawn from a dated written source or inscription.',
  epic: 'From the epic tradition — a cultural narrative, not an archaeological finding.',
  debate: 'Historians genuinely disagree about this.',
};


const CONTROLS: Array<[string, string[]]> = [
  ['Move', ['W', 'A', 'S', 'D']],
  ['Sprint', ['Shift']],
  ['Crouch', ['Ctrl']],
  ['Jump / drop / open canopy', ['Space']],
  ['Interact', ['E']],
  ['Mount / leave a chariot', ['R']],
  ['Switch camera', ['V']],
  ['Scan a monument', ['Right mouse']],
  ['Map and fast travel', ['M']],
  ['Codex', ['J']],
  ['The Gatha — panels, plaques, the story', ['K']],
  ['Photograph and postcard', ['P']],
  ['Pause and settings', ['Esc']],
  ['This help', ['F1']],
  ['Answer a question', ['1', '2', '3', '4']],
  ['Continue', ['Enter']],
];

/** Say honestly which voices this device is using, so a flat or foreign-sounding voice has an explanation. */
function voiceHint(): string {
  if (voice.renderedCount > 0) {
    return `The game ships its own voices (${voice.renderedCount} lines). Your device: ${deviceVoiceHint()}`;
  }
  return deviceVoiceHint();
}

function deviceVoiceHint(): string {
  switch (voice.voiceQuality) {
    case 'indian-english': {
      const n = voice.voiceNames.length;
      return `English (India): ${voice.voiceNames[0]}${n > 1 ? ` and ${n - 1} more` : ''}.`;
    }
    case 'hindi':
      return 'No English (India) voice on this device, so a Hindi voice is reading the lines. Install English (India) in your system speech settings for the best result.';
    case 'other-english':
      return 'No Indian voice on this device, so a standard English voice is speaking. Install English (India) in your system speech settings for the best result.';
    default:
      return voice.supported ? 'No speech voices were found on this device.' : 'This browser cannot speak. Captions only.';
  }
}

function toggleRow(label: string, hint: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
  const row = el('div', 'settings-row');
  const text = el('div');
  text.append(el('span', undefined, label), el('small', undefined, hint));
  const sw = el('button', 'switch') as HTMLButtonElement;
  sw.type = 'button';
  sw.setAttribute('role', 'switch');
  sw.setAttribute('aria-checked', String(value));
  sw.setAttribute('aria-label', label);
  sw.addEventListener('click', () => {
    const next = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(next));
    audio.click();
    onChange(next);
  });
  row.append(text, sw);
  return row;
}

function choiceRow(label: string, hint: string, options: Array<[string, string]>, value: string, onChange: (v: string) => void): HTMLElement {
  const row = el('div', 'settings-row');
  const text = el('div');
  text.append(el('span', undefined, label), el('small', undefined, hint));
  const group = el('div', 'choice-group');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', label);
  for (const [id, name] of options) {
    const b = el('button', 'choice', name) as HTMLButtonElement;
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(id === value));
    b.addEventListener('click', () => {
      for (const other of group.children) other.setAttribute('aria-checked', String(other === b));
      audio.click();
      onChange(id);
    });
    group.appendChild(b);
  }
  row.append(text, group);
  return row;
}

function sliderRow(label: string, value: number, min: number, max: number, onChange: (v: number) => void): HTMLElement {
  const row = el('div', 'settings-row');
  row.appendChild(el('span', undefined, label));
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = '0.05';
  input.value = String(value);
  input.addEventListener('input', () => onChange(Number(input.value)));
  row.appendChild(input);
  return row;
}

/** Rotate towards an angle the short way round. */
function approachAngle(current: number, target: number, maxDelta: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = Math.min(Math.abs(diff), Math.max(0, maxDelta) * (1 + Math.abs(diff)));
  return current + Math.sign(diff) * step;
}


/** Keep a flight waypoint inside the island's bounds. */
function clampToWorld(v: THREE.Vector3): THREE.Vector3 {
  const limit = WORLD_HALF - 120;
  v.x = Math.max(-limit, Math.min(limit, v.x));
  v.z = Math.max(-limit, Math.min(limit, v.z));
  return v;
}

/**
 * Yield so the loading screen can repaint.
 *
 * requestAnimationFrame does not fire in a background tab, which would stall
 * loading forever, so race it against a timer.
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(finish);
    setTimeout(finish, 60);
  });
}

// -------------------------------------------------------------------- boot

async function boot(): Promise<void> {
  const viewport = document.getElementById('viewport');
  const bootScreen = document.getElementById('boot');
  const progressBar = document.querySelector<HTMLElement>('#boot-progress .bp-track > i');
  const progressLabel = document.querySelector<HTMLElement>('#boot-progress .bp-label');
  const actions = document.getElementById('boot-actions');
  const playBtn = document.getElementById('btn-play') as HTMLButtonElement | null;
  const continueBtn = document.getElementById('btn-continue') as HTMLButtonElement | null;
  const howtoBtn = document.getElementById('btn-howto');
  const creditsBtn = document.getElementById('btn-credits');

  if (!viewport || !bootScreen) throw new Error('[boot] page markup is missing');

  // WebGL 2 check, with an honest message rather than a blank screen.
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2')) {
    if (progressLabel) {
      progressLabel.textContent = 'This device does not support WebGL 2, which the game needs to run.';
      progressLabel.style.color = '#e05252';
    }
    return;
  }

  const setProgress = (fraction: number, label: string): void => {
    if (progressBar) progressBar.style.width = `${Math.round(fraction * 100)}%`;
    if (progressLabel) progressLabel.textContent = label;
  };

  document.getElementById('boot-skyline')?.appendChild(buildSkyline());

  const game = new Game(viewport);
  // Handy for debugging from the console; harmless in production.
  (window as unknown as { game?: Game; audio?: typeof audio }).game = game;
  (window as unknown as { audio?: typeof audio }).audio = audio;
  try {
    await game.build(setProgress);
  } catch (err) {
    console.error(err);
    if (progressLabel) {
      progressLabel.textContent = 'Something went wrong while building the world. Check the console.';
      progressLabel.style.color = '#e05252';
    }
    return;
  }

  const progressBlock = document.getElementById('boot-progress');
  if (progressBlock) progressBlock.hidden = true;
  if (actions) actions.hidden = false;
  if (continueBtn && save.hasProgress) continueBtn.hidden = false;

  // The title theme starts on the first touch of the page: browsers do not allow sound before one.
  document.addEventListener(
    'pointerdown',
    () => {
      audio.unlock();
      audio.setTheme('title', 1.5);
      audio.startScore();
    },
    { once: true },
  );

  document.body.classList.add('title-open');
  const launch = (fresh: boolean): void => {
    audio.unlock();
    document.body.classList.remove('title-open');
    bootScreen.hidden = true;
    if (fresh) game.startNewJourney();
    else game.continueJourney();
  };

  playBtn?.addEventListener('click', () => launch(true));
  continueBtn?.addEventListener('click', () => launch(false));
  // Classes need a server. Offer the button only where one answers (or the student is already in a class).
  const classBtn = document.getElementById('btn-class');
  const classDot = document.getElementById('dot-class');
  void (async () => {
    if (!classBtn || !((await cloud.available()) || cloud.membership)) return;
    const paint = (): void => {
      classBtn.textContent = cloud.membership ? `Class: ${cloud.membership.className}` : 'Join a class';
    };
    paint();
    classBtn.hidden = false;
    if (classDot) classDot.hidden = false;
    classBtn.addEventListener('click', () => presentClassPanel({ onChange: () => { paint(); void game.loadClassQuestions(); } }));
    // A saved copy in the cloud that is newer than this device's (played elsewhere since): offer it.
    if (cloud.membership) {
      try {
        const saved = await cloud.pull();
        if (saved && saved.clientUpdatedAt > save.profile.updatedAt + 60_000) {
          document.getElementById('boot')?.classList.add('has-cloud-news');
          classBtn.textContent = `${classBtn.textContent} · newer save found`;
        }
      } catch {
        /* offline: nothing to say */
      }
    }
  })();

  // First-timers get a nudge toward the guide; it never blocks the game.
  const badge = document.getElementById('howto-badge');
  if (badge && !hasSeenIntro() && !save.hasProgress) badge.hidden = false;
  howtoBtn?.addEventListener('click', () => {
    if (badge) badge.hidden = true;
    presentHowToPlay({ fromTitle: true, onStart: () => launch(true) });
  });
  creditsBtn?.addEventListener('click', () => {
    const { panel, body, foot } = buildPanel({ title: 'About this project', closable: true });
    const prose = el('div', 'prose');
    prose.innerHTML = `
      <h3>What this is</h3>
      <p><strong>Bharat Gatha</strong> is an open-world first-person game built for Smart India Hackathon
      problem statement 26208 — toys and games based on Indian civilisation, history and culture.
      It runs entirely in the browser: the world, the music and the sounds of place are
      generated from code, and the spoken lines are pre-rendered voice clips.</p>
      <h3>How it handles history</h3>
      <p>Every factual claim in the codex carries a source kind — <strong>archaeology</strong>,
      <strong>written source</strong>, <strong>epic tradition</strong> or <strong>debated</strong> — so the
      game never blurs an excavation report into an epic narrative, and says plainly where historians
      disagree. One of the quiz generators turns that distinction into a testable skill.</p>
      <h3>Numbers</h3>
      <p>${ZONES.length} regions · ${CODEX.length} codex entries · ${QUESTION_COUNT} authored questions, plus
      procedurally generated ones drawn from the timeline and codex so the supply never runs out.</p>
      <h3>Built with</h3>
      <p>TypeScript, three.js and the Web Audio API. No art assets, no sample libraries and no server; the only audio files are the spoken lines.</p>
      <h3>Team</h3>
      <ul class="team">
        <li>Khyati Kalra <em>BMS25071</em></li>
        <li>Mehar Ravi Arora <em>BMS25083</em></li>
        <li>Pia Gujral <em>BMS25096</em></li>
        <li>Ranvir Vikas Gaikwad <em>BMS25105</em></li>
        <li>Rijul Srivastava <em>BMS25110</em></li>
        <li>Sai Akshit Ram Marella <em>BMS25112</em></li>
        <li>Saksham Aggrawal <em>BMS25113</em></li>
        <li>Samridhi Jain <em>BMS25116</em></li>
      </ul>
    `;
    body.appendChild(prose);
    const close = button('Close', 'btn btn-primary');
    close.addEventListener('click', () => closeOverlay());
    foot.appendChild(close);
    mountOverlay('credits', panel, { onEscape: () => closeOverlay() });
  });
}

void boot();
