/**
 * Local save profile.
 *
 * Everything lives in one JSON blob in localStorage. It is versioned and
 * migrated forward, and it doubles as the learning record that the Report Card
 * screen exports — a teacher can collect those JSON files and see exactly which
 * concepts a class is weak on.
 */

export const SAVE_KEY = 'bharat-gatha/profile/v1';
export const SAVE_VERSION = 4;

export interface QuestionRecord {
  /** Times the learner has seen this question. */
  seen: number;
  /** Times answered correctly. */
  right: number;
  /** Consecutive correct answers — drives the spaced-repetition weight. */
  streak: number;
  /** ms epoch of the last time it was asked. */
  last: number;
}

export interface ZoneProgress {
  discovered: boolean;
  /** Challenge ids completed in this zone. */
  challenges: string[];
  /** Chapter seal earned (end-of-zone quiz passed). */
  sealed: boolean;
  /** Best seal score as a percentage. */
  bestSeal: number;
  /** Seconds spent inside the zone. */
  timeSpent: number;
}

/** What the player wrote on the Twelfth Panel. Ids only; the text comes from the codex. */
export interface TwelfthPanel {
  /** Three things they are sure of: archaeology or written-source codex ids. */
  sure: string[];
  /** One thing they hold on tradition: an epic codex id. */
  tradition: string;
  /** One thing they still do not know: a debated codex id. */
  open: string;
  /** A name they want remembered: a zone id whose forgotten maker they chose. */
  remembered: string;
  writtenAt: number;
}

/**
 * Story progress.
 *
 * Kept deliberately small and id-based — the story's text lives in
 * `content/story`, so a save never goes stale when a line is reworded.
 */
export interface StoryState {
  /** The vimana prologue has played. */
  prologueSeen: boolean;
  /** Region of the very first landing, so the landing line is only ever said once. */
  firstZone: string | null;
  /** Narration ids already delivered (hooks, anchor beats, trail payoffs). */
  seen: string[];
  /** NPC ids the player has spoken to — persisted so trails survive a reload. */
  met: string[];
  /** Plaque id → progress. */
  plaques: Record<string, { done: boolean; tries: number }>;
  /** Zone ids whose panel has been restored. */
  panels: string[];
  /** Trail id → stops completed. */
  trails: Record<string, number>;
  /** Zone id → whether the restoration choice was the open-minded one. */
  choices: Record<string, 'open' | 'comfort'>;
  /** Totals behind the ending's wording. Never shown as a score, never deducted. */
  comfortPicks: number;
  openPicks: number;
  /** Plaque ids settled in the Sabha. */
  sabhaSettled: string[];
  sabhaDone: boolean;
  twelfth: TwelfthPanel | null;
}

function emptyStory(): StoryState {
  return {
    prologueSeen: false,
    firstZone: null,
    seen: [],
    met: [],
    plaques: {},
    panels: [],
    trails: {},
    choices: {},
    comfortPicks: 0,
    openPicks: 0,
    sabhaSettled: [],
    sabhaDone: false,
    twelfth: null,
  };
}

export interface Profile {
  version: number;
  createdAt: number;
  updatedAt: number;
  playerName: string;
  worldSeed: string;
  vidya: number;
  /** Codex entry ids the learner has unlocked by scanning or completing content. */
  codex: string[];
  /** Zone id → progress. */
  zones: Record<string, ZoneProgress>;
  /** Quest id → completed objective ids. */
  quests: Record<string, string[]>;
  /** The Gatha: panels restored, plaques corrected, choices made. */
  story: StoryState;
  /** Question id → performance record. */
  questions: Record<string, QuestionRecord>;
  /** Totals for the report card. */
  stats: {
    quizAsked: number;
    quizRight: number;
    challengesDone: number;
    distanceWalked: number;
    playSeconds: number;
    landmarksScanned: number;
  };
  settings: Settings;
  /** Last position so "Continue" drops the player back where they were. */
  lastPosition: [number, number, number] | null;
  lastZone: string | null;
}

export interface Settings {
  lang: 'en' | 'hi';
  mouseSensitivity: number;
  invertY: boolean;
  musicVolume: number;
  sfxVolume: number;
  renderScale: number;
  shadows: boolean;
  /** Bloom, sun shafts, colour grade. Steps itself down automatically on slow machines. */
  cinematic: boolean;
  motionBlurFree: boolean;
  dyslexiaFont: boolean;
  highContrast: boolean;
  subtitles: boolean;
  /** When on, the glider deploys automatically and falling cannot hurt you. */
  gentleMode: boolean;
  /** Spoken lines, using the device's Indian-English voices where it has them. */
  voices: boolean;
  voiceVolume: number;
  /** Where lines without a human recording come from. Auto: the game's Indian-English voice, unless the device has a natural Indian-English one. */
  voiceSource: 'auto' | 'indian' | 'neutral' | 'device';
  /** The gold marker and Next step card pointing at what to do next. */
  guide: boolean;
  /** Haze shades to fight in the open country. */
  combat: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en',
  mouseSensitivity: 1,
  invertY: false,
  musicVolume: 0.65,
  sfxVolume: 0.75,
  renderScale: 1,
  shadows: true,
  cinematic: true,
  motionBlurFree: true,
  dyslexiaFont: false,
  highContrast: false,
  subtitles: true,
  gentleMode: true,
  voices: true,
  voiceVolume: 0.9,
  voiceSource: 'auto',
  guide: true,
  combat: true,
};

function emptyProfile(): Profile {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    playerName: 'Yatri',
    worldSeed: 'bharat-gatha',
    vidya: 0,
    codex: [],
    zones: {},
    quests: {},
    story: emptyStory(),
    questions: {},
    stats: {
      quizAsked: 0,
      quizRight: 0,
      challengesDone: 0,
      distanceWalked: 0,
      playSeconds: 0,
      landmarksScanned: 0,
    },
    settings: { ...DEFAULT_SETTINGS },
    lastPosition: null,
    lastZone: null,
  };
}

export class SaveStore {
  private data: Profile;
  private flushTimer: number | null = null;

  constructor() {
    this.data = load();
  }

  get profile(): Profile {
    return this.data;
  }

  get settings(): Settings {
    return this.data.settings;
  }

  /** True when there is meaningful progress worth a "Continue" button. */
  get hasProgress(): boolean {
    // An empty entry is created the moment anything *looks* at a region, so only count real play.
    const played = Object.values(this.data.zones).some((z) => z.discovered || z.challenges.length > 0 || z.sealed || z.timeSpent > 0);
    return this.data.vidya > 0 || this.data.codex.length > 0 || played;
  }

  zone(zoneId: string): ZoneProgress {
    let z = this.data.zones[zoneId];
    if (!z) {
      z = { discovered: false, challenges: [], sealed: false, bestSeal: 0, timeSpent: 0 };
      this.data.zones[zoneId] = z;
    }
    return z;
  }

  question(id: string): QuestionRecord {
    let q = this.data.questions[id];
    if (!q) {
      q = { seen: 0, right: 0, streak: 0, last: 0 };
      this.data.questions[id] = q;
    }
    return q;
  }

  hasCodex(id: string): boolean {
    return this.data.codex.includes(id);
  }

  unlockCodex(id: string): boolean {
    if (this.hasCodex(id)) return false;
    this.data.codex.push(id);
    this.markDirty();
    return true;
  }

  addVidya(amount: number): void {
    this.data.vidya = Math.max(0, Math.round(this.data.vidya + amount));
    this.markDirty();
  }

  completeChallenge(zoneId: string, challengeId: string): boolean {
    const z = this.zone(zoneId);
    if (z.challenges.includes(challengeId)) return false;
    z.challenges.push(challengeId);
    this.data.stats.challengesDone++;
    this.markDirty();
    return true;
  }

  recordAnswer(questionId: string, correct: boolean): void {
    const rec = this.question(questionId);
    rec.seen++;
    rec.last = Date.now();
    if (correct) {
      rec.right++;
      rec.streak++;
      this.data.stats.quizRight++;
    } else {
      rec.streak = 0;
    }
    this.data.stats.quizAsked++;
    this.markDirty();
  }

  get story(): StoryState {
    return this.data.story;
  }

  /** Mark a quest objective done. Returns true the first time. */
  completeObjective(questId: string, objectiveId: string): boolean {
    const list = (this.data.quests[questId] ??= []);
    if (list.includes(objectiveId)) return false;
    list.push(objectiveId);
    this.markDirty();
    return true;
  }

  patchSettings(patch: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.markDirty();
  }

  /** Debounced write — called from hot paths safely. */
  markDirty(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 1200);
  }

  flush(): void {
    this.data.updatedAt = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('[Save] could not persist profile', err);
    }
  }

  reset(): void {
    this.data = emptyProfile();
    this.flush();
  }

  /** Full learning record, for the teacher export. */
  export(): string {
    return JSON.stringify({ exportedAt: new Date().toISOString(), profile: this.data }, null, 2);
  }
}

function load(): Profile {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    // Private browsing / blocked storage — play in-memory.
    return emptyProfile();
  }
  if (!raw) return emptyProfile();
  try {
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return migrate(parsed);
  } catch {
    console.warn('[Save] corrupt profile, starting fresh');
    return emptyProfile();
  }
}

function migrate(input: Partial<Profile>): Profile {
  const base = emptyProfile();
  const merged: Profile = {
    ...base,
    ...input,
    stats: { ...base.stats, ...(input.stats ?? {}) },
    settings: { ...base.settings, ...(input.settings ?? {}) },
    zones: input.zones ?? {},
    quests: input.quests ?? {},
    story: { ...base.story, ...(input.story ?? {}) },
    questions: input.questions ?? {},
    codex: Array.isArray(input.codex) ? input.codex : [],
    version: SAVE_VERSION,
  };
  return merged;
}

export const save = new SaveStore();
