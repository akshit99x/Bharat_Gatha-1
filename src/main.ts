import * as THREE from 'three';
import './styles/main.css';

import { Input } from './core/Input';
import { bus } from './core/EventBus';
import { save } from './core/Save';
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
import { PlaqueModal } from './ui/PlaqueModal';
import { ScrollModal } from './ui/ScrollModal';
import { SabhaModal } from './ui/SabhaModal';
import { TwelfthModal } from './ui/TwelfthModal';
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
 * This wires the four systems together — terrain, procedural monuments, the
 * first-person controller and the quiz engine — plus enough HUD and interaction
 * to actually play them. The per-challenge mini-game runtimes (archery,
 * assembly, pattern, trade, sequencing, collection) are not built yet; their
 * posts currently show the brief and run the challenge's quiz round, and the
 * dialogue challenges run in full.
 */

const SCAN_RANGE = 150;

/** Reused each frame so the scan probe allocates nothing. */
const _fwd = new THREE.Vector3();

class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clock = new THREE.Clock();

  private readonly input: Input;
  private readonly hud: Hud;
  private readonly bank: QuestionBank;
  private readonly quiz: QuizEngine;
  private readonly quizModal: QuizModal;
  private readonly dialogue = new DialogueBox();
  private readonly story = new StoryEngine(save);
  private readonly narration = new Narration();
  private readonly plaqueModal = new PlaqueModal(this.story);
  private readonly sabhaModal = new SabhaModal(this.story);
  private readonly twelfthModal = new TwelfthModal(this.story, () => save.profile.playerName);
  private readonly scrollModal: ScrollModal;
  private readonly veil: HTMLElement;
  /** Regions whose story hook has been checked this session — one cheap lookup per frame. */
  private readonly hooked = new Set<string>();

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

    // A little wider than first person: the point of the over-the-shoulder view
    // is seeing more of where you are heading.
    this.camera = new THREE.PerspectiveCamera(78, 1, 0.1, WORLD_HALF * 3.4);
    this.scene.add(this.camera);

    this.input = new Input(this.renderer.domElement);
    this.input.sensitivity = save.settings.mouseSensitivity;
    this.input.invertY = save.settings.invertY;

    this.hud = new Hud();
    this.bank = new QuestionBank(save);
    this.quiz = new QuizEngine(this.bank, save);
    this.quizModal = new QuizModal(this.quiz);

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
    voice.setVolume(save.settings.voiceVolume);
    // The score ducks while anybody is speaking.
    voice.watch((speaking) => audio.duck(speaking));
    this.applyAccessibility();

    window.addEventListener('resize', () => this.resize());
    this.resize();

    // Overlays suspend gameplay input and release the pointer.
    bus.on('ui:open', () => {
      this.input.setSuspended(true);
      this.input.releaseLock();
      this.hud.dimObjectives(true);
    });
    bus.on('ui:close', () => {
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

    const contentProblems = [...validateContent(), ...validateQuestions(), ...validateStory()];
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

    // Lift the haze from plaques already corrected in a previous session.
    for (const chapter of CHAPTERS) for (const p of chapter.plaques) if (this.story.plaqueDone(p.id)) this.world.setPlaqueCleared(p.id, true);

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
    this.hud.setToolbelt(
      [
        { key: '1', icon: '🏹', name: 'Gandiva — the bow' },
        { key: '2', icon: '🔨', name: 'Shilpa tools — build and repair' },
        { key: '3', icon: '🔍', name: 'Pramana lens — scan a monument (hold right mouse)' },
      ],
      2,
    );
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
    } else {
      // Menu keys still work while an overlay is up.
      if (this.input.justPressed('pause') && !overlayOpen() && !this.dialogue.isOpen) this.togglePause();
    }

    this.world.update(dt, this.camera, this.elapsed);
    this.updateVimana();
    this.updateMinimap();
    this.updateHud(blocked);
    this.trackStats(dt);

    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  };

  // ------------------------------------------------------------- interaction

  private handleHotkeys(): void {
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
    } else {
      this.hud.setInteractPrompt(null);
    }

    // --- zone transitions.
    const zone = this.world.zoneAt(this.player.position.x, this.player.position.z);
    if (zone && zone.id !== this.currentZone?.id) this.enterZone(zone, false);

    this.maybeRunZoneHook();
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

    // Start at a different line each time, so a second visit is not a rerun.
    const start = spoken ? Math.floor(Math.random() * npc.lines.length) : 0;
    const ordered = [...npc.lines.slice(start), ...npc.lines.slice(0, start)];
    const nodes = ordered.map((text, i) => ({
      id: `line-${i}`,
      text,
      ...(i === ordered.length - 1 ? { end: true as const } : { next: `line-${i + 1}` }),
    }));

    await this.dialogue.run({ name: npc.name, role: npc.role, icon: npc.icon }, nodes);

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

    // The other six challenge kinds do not have their mini-game runtimes yet.
    // Rather than pretend, show the brief and what it is meant to teach, then
    // run the associated quiz round so the learning still happens.
    const shown = await this.showChallengeBrief(challenge);
    if (!shown) return;
    const count = challenge.quizAfter && challenge.quizAfter > 0 ? challenge.quizAfter : 3;
    const result = await this.runQuiz(zoneId, 'challenge', count, challenge.name);
    if (result && result.percent >= 60) {
      if (save.completeChallenge(zoneId, challenge.id)) {
        for (const id of challenge.unlocks ?? []) {
          if (save.unlockCodex(id)) {
            const entry = getCodex(id);
            this.hud.toast('codex', `Codex: ${entry?.title ?? id}`, 'Unlocked.', '📖', 5000);
          }
        }
        save.addVidya(challenge.vidya);
        bus.emit('vidya:gain', { amount: challenge.vidya, reason: challenge.name });
        this.hud.toast('good', challenge.name, challenge.teaches, '✓', 8000);
        this.refreshObjectives();
        this.sayAnchorBeat(challenge.id);
      }
    }
  }

  private showChallengeBrief(challenge: ChallengeSpec): Promise<boolean> {
    return new Promise((resolve) => {
      const { panel, body, foot } = buildPanel({
        title: challenge.name,
        subtitle: KIND_LABEL[challenge.kind],
        closable: true,
        onClose: () => {
          closeOverlay();
          resolve(false);
        },
      });

      const prose = el('div', 'prose');
      const task = el('h3', undefined, 'The task');
      const taskP = el('p', undefined, challenge.brief);
      const teaches = el('h3', undefined, 'What this teaches');
      const teachesP = el('p', undefined, challenge.teaches);
      prose.append(task, taskP, teaches, teachesP);

      const note = el('p', undefined, '');
      note.style.cssText =
        'margin-top:1.4rem;padding:0.8rem 1rem;border-left:2px solid var(--gold);background:rgb(232 180 75 / 0.08);border-radius:0 8px 8px 0;font-size:0.84rem;';
      note.textContent =
        'The interactive version of this challenge is not built yet. For now the questions it leads to are asked directly, so the content is here even though the mini-game is not.';
      prose.appendChild(note);

      body.appendChild(prose);

      const cancel = button('Not now', 'btn btn-ghost');
      cancel.addEventListener('click', () => {
        closeOverlay();
        resolve(false);
      });
      const go = button('Answer the questions', 'btn btn-primary');
      go.addEventListener('click', () => {
        closeOverlay();
        resolve(true);
      });
      foot.append(cancel, go);

      mountOverlay('challenge-brief', panel, {
        onEscape: () => {
          closeOverlay();
          resolve(false);
        },
      });
      go.focus();
    });
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
    if (previous) bus.emit('zone:exit', { zoneId: previous.id });

    this.world.sky.setPalette(zone.palette);
    if (silent) this.world.sky.applyImmediately(zone.palette);
    audio.setRaga(zone.raga, zone.tonic ?? 50);

    const progress = save.zone(zone.id);
    const firstVisit = !progress.discovered;
    if (firstVisit) {
      progress.discovered = true;
      save.addVidya(60);
      save.markDirty();
    }

    if (!silent) {
      this.hud.announceZone(zone);
      if (firstVisit) {
        this.hud.toast('vidya', `Discovered ${zone.name}`, zone.tagline, '🧭', 7000);
        audio.conch();
      }
    }
    bus.emit('zone:enter', { zoneId: zone.id });
    this.updateVeil();
    this.refreshObjectives();
  }

  private refreshObjectives(): void {
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

    const rows = el('div');
    rows.append(
      toggleRow('Shadows', 'Costs frames on older laptops.', save.settings.shadows, (v) => {
        save.patchSettings({ shadows: v });
        this.renderer.shadowMap.enabled = v;
        this.world.sky.setShadows(v);
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
      sliderRow('Voice volume', save.settings.voiceVolume, 0, 1, (v) => {
        save.patchSettings({ voiceVolume: v });
        voice.setVolume(v);
      }),
    );
    body.appendChild(rows);

    const practice = button('Practice questions', 'btn btn-ghost');
    practice.addEventListener('click', async () => {
      closeOverlay();
      this.paused = false;
      await this.runQuiz(this.currentZone?.id ?? null, 'practice', 6, 'Practice round');
    });

    const sample = button('Hear a voice', 'btn btn-ghost');
    sample.addEventListener('click', () => {
      voice.speak(
        'Namaste, Gathak. I am Maitri, keeper of the Gatha. If you can hear this, the voices are working.',
        voice.profileForSpeaker('Maitri'),
      );
    });

    const exportBtn = button('Export learning record', 'btn btn-ghost');
    exportBtn.addEventListener('click', () => this.exportReport());

    const resume = button('Resume', 'btn btn-primary');
    resume.addEventListener('click', () => this.resume());

    foot.append(practice, sample, exportBtn, resume);
    mountOverlay('pause', panel, { onEscape: () => this.resume() });
    resume.focus();
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

  private openMap(): void {
    const { panel, body, foot } = buildPanel({
      title: 'The Island',
      subtitle: 'Eleven eras on one landmass. Discovered terraces can be travelled to directly.',
      closable: true,
    });

    const list = el('div');
    list.style.cssText = 'display:grid;gap:0.5rem;';
    for (const zone of ZONES) {
      const progress = save.zone(zone.id);
      const row = el('button', 'quiz-opt') as HTMLButtonElement;
      row.type = 'button';
      row.style.gridTemplateColumns = 'auto 1fr auto';
      const chapter = el('span', 'qo-key', String(zone.chapter));
      const label = el('span');
      label.innerHTML = `<b>${escapeHtml(zone.name)}</b> <span style="opacity:0.6">${escapeHtml(zone.era)}</span><br><span style="opacity:0.7;font-size:0.82rem">${escapeHtml(
        zone.tagline,
      )}</span>`;
      const state = el('span', 'qo-mark', progress.sealed ? '🔔' : progress.discovered ? '◆' : '·');
      state.style.opacity = '1';
      row.append(chapter, label, state);
      if (!progress.discovered) row.disabled = true;
      row.addEventListener('click', () => {
        audio.click();
        closeOverlay();
        this.paused = false;
        const pad = this.world.padFor(zone.id);
        const target = pad ? pad.position : new THREE.Vector3(zone.center[0], 0, zone.center[1]);
        this.player.teleportTo(target.x, target.z + 14);
        this.enterZone(zone, false);
        this.input.requestLock();
      });
      list.appendChild(row);
    }
    body.appendChild(list);

    const sealable = this.currentZone ? save.zone(this.currentZone.id) : null;
    if (this.currentZone && sealable && sealable.challenges.length >= this.currentZone.sealRequires) {
      const seal = button(sealable.sealed ? 'Retake chapter assessment' : 'Take the chapter assessment', 'btn btn-primary');
      const zone = this.currentZone;
      seal.addEventListener('click', async () => {
        closeOverlay();
        this.paused = false;
        await this.runQuiz(zone.id, 'seal', 8, `${zone.name} — chapter assessment`);
        this.refreshObjectives();
      });
      foot.appendChild(seal);
    } else {
      foot.appendChild(el('span', undefined, 'Complete more challenges here to unlock the chapter assessment.'));
    }

    const close = button('Close', 'btn btn-ghost');
    close.addEventListener('click', () => this.resume());
    foot.appendChild(close);

    mountOverlay('map', panel, { onEscape: () => this.resume() });
  }

  private openFastTravel(pad: Interactable): void {
    this.hud.toast('info', pad.label, 'Open the map with M to travel to another discovered terrace.', '🛕', 5000);
  }

  private openHelp(): void {
    const { panel, body, foot } = buildPanel({
      title: 'How to play',
      subtitle: 'Keyboard and mouse',
      closable: true,
    });
    const grid = el('div', 'key-grid');
    for (const [action, keys] of CONTROLS) {
      const row = el('div', 'key-row');
      row.appendChild(el('span', undefined, action));
      const wrap = el('span', 'keys');
      for (const k of keys) {
        const kbd = document.createElement('kbd');
        kbd.textContent = k;
        wrap.appendChild(kbd);
      }
      row.appendChild(wrap);
      grid.appendChild(row);
    }
    body.appendChild(grid);
    const close = button('Got it', 'btn btn-primary');
    close.addEventListener('click', () => this.resume());
    foot.appendChild(close);
    mountOverlay('help', panel, { onEscape: () => this.resume() });
    close.focus();
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

const KIND_LABEL: Record<string, string> = {
  archery: 'Archery challenge',
  assembly: 'Assembly challenge',
  pattern: 'Pattern challenge',
  scriptMatch: 'Script-matching challenge',
  trade: 'Trade and weights challenge',
  sequence: 'Sequencing challenge',
  collect: 'Collection challenge',
  dialogue: 'Conversation',
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
  ['Pause and settings', ['Esc']],
  ['This help', ['F1']],
  ['Answer a question', ['1', '2', '3', '4']],
  ['Continue', ['Enter']],
];

/** Say honestly which voices this device is using, so a flat or foreign-sounding voice has an explanation. */
function voiceHint(): string {
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

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

  const game = new Game(viewport);
  // Handy for debugging from the console; harmless in production.
  (window as unknown as { game?: Game }).game = game;
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

  const launch = (fresh: boolean): void => {
    audio.unlock();
    bootScreen.hidden = true;
    if (fresh) game.startNewJourney();
    else game.continueJourney();
  };

  playBtn?.addEventListener('click', () => launch(true));
  continueBtn?.addEventListener('click', () => launch(false));
  howtoBtn?.addEventListener('click', () => {
    const { panel, body, foot } = buildPanel({ title: 'How to play', closable: true });
    const grid = el('div', 'key-grid');
    for (const [action, keys] of CONTROLS) {
      const row = el('div', 'key-row');
      row.appendChild(el('span', undefined, action));
      const wrap = el('span', 'keys');
      for (const k of keys) {
        const kbd = document.createElement('kbd');
        kbd.textContent = k;
        wrap.appendChild(kbd);
      }
      row.appendChild(wrap);
      grid.appendChild(row);
    }
    body.appendChild(grid);
    const close = button('Close', 'btn btn-primary');
    close.addEventListener('click', () => closeOverlay());
    foot.appendChild(close);
    mountOverlay('help', panel, { onEscape: () => closeOverlay() });
  });
  creditsBtn?.addEventListener('click', () => {
    const { panel, body, foot } = buildPanel({ title: 'About this project', closable: true });
    const prose = el('div', 'prose');
    prose.innerHTML = `
      <h3>What this is</h3>
      <p><strong>Bharat Gatha</strong> is an open-world first-person game built for Smart India Hackathon
      problem statement 26208 — toys and games based on Indian civilisation, history and culture.
      It runs entirely in the browser with no downloads: all geometry and all audio are generated
      procedurally from code.</p>
      <h3>How it handles history</h3>
      <p>Every factual claim in the codex carries a source kind — <strong>archaeology</strong>,
      <strong>written source</strong>, <strong>epic tradition</strong> or <strong>debated</strong> — so the
      game never blurs an excavation report into an epic narrative, and says plainly where historians
      disagree. One of the quiz generators turns that distinction into a testable skill.</p>
      <h3>Numbers</h3>
      <p>${ZONES.length} regions · ${CODEX.length} codex entries · ${QUESTION_COUNT} authored questions, plus
      procedurally generated ones drawn from the timeline and codex so the supply never runs out.</p>
      <h3>Built with</h3>
      <p>TypeScript, three.js and the Web Audio API. No art assets, no sample libraries, no server.</p>
    `;
    body.appendChild(prose);
    const close = button('Close', 'btn btn-primary');
    close.addEventListener('click', () => closeOverlay());
    foot.appendChild(close);
    mountOverlay('credits', panel, { onEscape: () => closeOverlay() });
  });
}

void boot();
