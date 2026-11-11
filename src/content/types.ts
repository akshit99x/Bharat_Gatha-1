/**
 * Content schema.
 *
 * All history/culture data in this game is declarative. Adding a new region,
 * monument, challenge or question is a data edit — never an engine edit. That
 * is what makes this a *platform* for building heritage games rather than one
 * hard-coded game.
 *
 * One deliberate pedagogical rule runs through the whole schema: every factual
 * claim carries a `source` kind, so the game never silently blurs the line
 * between what archaeology has established, what a text says, what epic
 * tradition narrates, and what scholars still argue about.
 */

import type { RagaName } from '../core/Audio';

// ---------------------------------------------------------------- sourcing

export type SourceType =
  /** Material evidence: excavation, inscription, coin, radiocarbon. */
  | 'archaeology'
  /** A written source whose date/authorship is reasonably established. */
  | 'text'
  /** Narrative from the epic/puranic tradition — cultural truth, not a dig report. */
  | 'epic'
  /** Genuinely contested among historians; the game says so out loud. */
  | 'debate';

export const SOURCE_LABEL: Record<SourceType, string> = {
  archaeology: 'Archaeology',
  text: 'Written source',
  epic: 'Epic tradition',
  debate: 'Debated',
};

export const SOURCE_NOTE: Record<SourceType, string> = {
  archaeology: 'Based on excavated material evidence.',
  text: 'Drawn from a dated written source or inscription.',
  epic: 'From the epic/puranic tradition — a cultural narrative, not an archaeological finding.',
  debate: 'Historians genuinely disagree about this. Both readings are shown.',
};

// ---------------------------------------------------------------- geography

export type BiomeId =
  | 'riverPlain'
  | 'desertFringe'
  | 'mesopotamianDelta'
  | 'dryPlains'
  | 'sal_forest'
  | 'deccanBoulder'
  | 'coastalPalm'
  | 'tropicalIsland'
  | 'gangeticPlain'
  | 'hillGhats'
  | 'coastalDune';

export interface ZonePalette {
  /** Ground tint at low elevation. */
  ground: number;
  /** Ground tint on slopes / high ground. */
  rock: number;
  /** Vegetation tint. */
  foliage: number;
  /** Dominant built-material colour. */
  stone: number;
  /** Sky horizon tint — gives each era its own light. */
  horizon: number;
  /** Zenith tint. */
  zenith: number;
  /** Fog colour. */
  fog: number;
  /** Sun colour. */
  sun: number;
  /** Sun elevation in degrees — time of day per zone. */
  sunElevation: number;
  /** Sun azimuth in degrees. */
  sunAzimuth: number;
}

// ---------------------------------------------------------------- landmarks

/** Each kind maps to a procedural builder in `world/architecture`. */
export type BuilderKind =
  | 'indusCitadel'
  | 'greatBath'
  | 'indusHousing'
  | 'lothalDock'
  | 'ziggurat'
  | 'scribeYard'
  | 'warCamp'
  | 'chariotLine'
  | 'kuruShrine'
  | 'palaceCity'
  | 'hermitage'
  | 'ramSetu'
  | 'lankaFort'
  | 'stupa'
  | 'ashokaPillar'
  | 'nalandaVihara'
  | 'cityGate'
  | 'dravidaTemple'
  | 'bronzeFoundry'
  | 'harbour'
  | 'bazaarStreet'
  | 'stoneChariot'
  | 'boulderField'
  | 'mughalTomb'
  | 'charbagh'
  | 'hillFort'
  | 'konarkTemple'
  | 'jantarMantar'
  | 'nagaraTemple'
  | 'stepwell'
  | 'villageCluster'
  | 'dhow'
  | 'vimanaPad';

export interface Landmark {
  id: string;
  name: string;
  kind: BuilderKind;
  /** Position relative to the zone centre, in world units. */
  offset: [number, number];
  /** Y rotation in degrees. */
  rotation?: number;
  scale?: number;
  /** Scanning this landmark with the Pramana Lens unlocks this codex entry. */
  codexId?: string;
  /** Seconds of steady scanning required. Bigger monuments take longer. */
  scanSeconds?: number;
  /** Builder-specific knobs. */
  opts?: Record<string, number | string | boolean>;
  /** Show the name as a floating label when nearby. */
  signposted?: boolean;
  /** Stand on top of whatever earlier landmark is under this spot (a tower on a fort's summit). */
  stack?: boolean;
}

// ---------------------------------------------------------------- challenges

export type ChallengeKind =
  /** Bow-and-target: precision, moving targets, called shots. */
  | 'archery'
  /** Carry/place parts to rebuild a structure in the right order. */
  | 'assembly'
  /** Reproduce a symmetry or pattern (pietra dura, charbagh, rangoli). */
  | 'pattern'
  /** Match signs between two writing systems or two artefact sets. */
  | 'scriptMatch'
  /** Balance a barter using period weights and goods. */
  | 'trade'
  /** Put events, rulers or layers into chronological order. */
  | 'sequence'
  /** Find and gather specific things across the zone. */
  | 'collect'
  /** A branching conversation with a real ethical choice. */
  | 'dialogue';

interface ChallengeBase {
  id: string;
  name: string;
  /** One line shown in the challenge HUD: what the player must do. */
  brief: string;
  /** The actual learning objective. Surfaced in the report card. */
  teaches: string;
  /** Position relative to the zone centre. */
  offset: [number, number];
  /** Vidya awarded on success. */
  vidya: number;
  /** Codex entries unlocked on success. */
  unlocks?: string[];
  /** Number of quiz questions fired immediately after success (0 = none). */
  quizAfter?: number;
  /** Prompt shown on the interaction pillar. */
  prompt?: string;
}

export interface ArcheryChallenge extends ChallengeBase {
  kind: 'archery';
  config: {
    /** Target rings: [dx, dy(height), dz, radius, points] relative to the stand. */
    targets: Array<{ pos: [number, number, number]; radius: number; points: number; label?: string; moving?: boolean }>;
    arrows: number;
    passScore: number;
    /** Optional: only the labelled target counts (Arjuna's "the eye of the bird"). */
    calledShot?: string;
    timeLimit?: number;
  };
}

export interface AssemblyChallenge extends ChallengeBase {
  kind: 'assembly';
  config: {
    /** Pieces the player picks up and drops into sockets, in correct order. */
    pieces: Array<{ id: string; label: string; size: [number, number, number]; color?: number }>;
    sockets: Array<{ id: string; label: string; pos: [number, number, number]; accepts: string }>;
    /** If true, sockets must be filled in the listed order (teaches sequence). */
    ordered: boolean;
    hint: string;
  };
}

export interface PatternChallenge extends ChallengeBase {
  kind: 'pattern';
  config: {
    gridSize: number;
    /** Symmetry the player must honour. */
    symmetry: 'fourfold' | 'mirror' | 'rotational';
    /** Palette of tile colours available. */
    palette: number[];
    /** Pre-filled quadrant the player must mirror: [x, y, colourIndex]. */
    given: Array<[number, number, number]>;
    hint: string;
  };
}

export interface ScriptMatchChallenge extends ChallengeBase {
  kind: 'scriptMatch';
  config: {
    /** Left column — glyph or artefact. */
    left: Array<{ id: string; glyph: string; caption: string }>;
    /** Right column — meaning. Matched by shared id. */
    right: Array<{ id: string; label: string }>;
    note: string;
  };
}

export interface TradeChallenge extends ChallengeBase {
  kind: 'trade';
  config: {
    /** Goods the player can load onto the pan balance. */
    goods: Array<{ id: string; label: string; unitMass: number; glyph: string }>;
    /** Harappan binary weights available, in ratio units. */
    weights: number[];
    /** Target mass in ratio units. */
    target: number;
    note: string;
  };
}

export interface SequenceChallenge extends ChallengeBase {
  kind: 'sequence';
  config: {
    /** Items in CORRECT order; the game shuffles them for the player. */
    items: Array<{ id: string; label: string; when: string; detail: string }>;
    note: string;
  };
}

export interface CollectChallenge extends ChallengeBase {
  kind: 'collect';
  config: {
    /** Scattered pickups: positions relative to the challenge anchor. */
    items: Array<{ id: string; label: string; pos: [number, number, number]; glyph: string; decoy?: boolean }>;
    /** How many real items are needed. */
    need: number;
    note: string;
  };
}

export interface DialogueChallenge extends ChallengeBase {
  kind: 'dialogue';
  config: {
    speaker: { name: string; role: string; icon: string };
    /** Dialogue graph; starts at the first node. */
    nodes: DialogueNode[];
  };
}

export type ChallengeSpec =
  | ArcheryChallenge
  | AssemblyChallenge
  | PatternChallenge
  | ScriptMatchChallenge
  | TradeChallenge
  | SequenceChallenge
  | CollectChallenge
  | DialogueChallenge;

export interface DialogueNode {
  id: string;
  text: string;
  /** Terminal node — reaching it ends the conversation. */
  end?: boolean;
  /** Awarded when this node is reached. */
  vidya?: number;
  unlocks?: string[];
  choices?: Array<{
    label: string;
    /** Shown immediately after choosing, before moving on. */
    reply?: string;
    goto?: string;
    /** Marks the historically/ethically defensible reading. */
    wise?: boolean;
    /** A short note explaining why this choice matters. */
    note?: string;
  }>;
  /**
   * Where to go when the node offers no choices. `goto` and `next` are
   * synonyms — `goto` wins if both are given — so a node reads the same way
   * whether it branches or simply continues.
   */
  goto?: string;
  next?: string;
}

// ---------------------------------------------------------------- npcs

export interface NpcSpec {
  id: string;
  name: string;
  role: string;
  icon: string;
  offset: [number, number];
  /** Body tint. */
  color?: number;
  /** Short lines shown when spoken to; cycles. */
  lines: string[];
  /** Optional codex unlocked the first time you speak. */
  unlocks?: string;
}

// ---------------------------------------------------------------- codex

export interface CodexEntry {
  id: string;
  zoneId: string;
  title: string;
  /** Human-readable date range, e.g. "c. 2600–1900 BCE". */
  when: string;
  source: SourceType;
  /** Paragraphs. Written for a 12–16 year old without talking down. */
  body: string[];
  tags: string[];
  seeAlso?: string[];
}

// ---------------------------------------------------------------- questions

export interface Question {
  id: string;
  zoneId: string;
  /** 1 = recall, 2 = understanding, 3 = application/analysis. */
  difficulty: 1 | 2 | 3;
  stem: string;
  /** Optional framing text, e.g. a quotation or a scenario. */
  context?: string;
  options: string[];
  /** Index into `options` as authored. Option order is shuffled at runtime. */
  answer: number;
  explain: string;
  tags: string[];
  /** Learning-objective bucket, aggregated in the report card. */
  skill: string;
}

// ---------------------------------------------------------------- zones

export interface Zone {
  id: string;
  name: string;
  /** Name in an Indian script, shown alongside the English. */
  nameLocal: string;
  era: string;
  /** Signed years for the timeline: negative = BCE. Used by generated questions. */
  eraStart: number;
  eraEnd: number;
  tagline: string;
  blurb: string;
  /** World-space centre [x, z]. */
  center: [number, number];
  /** Radius of the zone's terrain influence and "you have entered" trigger. */
  radius: number;
  /** Target ground height at the centre. */
  plateau: number;
  biome: BiomeId;
  raga: RagaName;
  /** Drone tonic as a MIDI note — lower for ancient zones. */
  tonic?: number;
  palette: ZonePalette;
  landmarks: Landmark[];
  challenges: ChallengeSpec[];
  npcs: NpcSpec[];
  /** Zone sits on its own island, separated by sea. */
  island?: boolean;
  /** Chapter order for the guided path. Roaming ignores this. */
  chapter: number;
  /** Vidya needed before the chapter seal quiz unlocks. */
  sealRequires: number;
}
