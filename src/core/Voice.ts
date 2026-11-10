/**
 * Spoken voices.
 *
 * The game ships no audio files, so speech comes from the browser's own
 * synthesiser (`speechSynthesis`) — which keeps the bundle small and works
 * offline wherever the device has voices installed. We ask for Indian voices:
 * English as spoken in India (`en-IN`) first, since every line in the game is
 * English, with Hindi (`hi-IN`) and then any English voice as fallbacks, and we
 * say plainly in the settings which one the device is actually using.
 *
 * A speaker is never given a gender. Voices are assigned by a stable hash of the
 * speaker's name — so the same person always sounds the same — with a small
 * pitch and pace shift so a device with two voices still sounds like a crowd.
 * Maitri and Ekarupa are fixed: Maitri warm and unhurried, Ekarupa lower,
 * slower and a little too smooth.
 *
 * Voices, in order of preference: a human recording (public/voices); then, unless the device has a
 * natural Indian-English voice of its own, one of the game's two pre-rendered neural voice sets
 * (public/voices/clear: clear British English; public/voices/accent: an Indian-English accent that is
 * harder to understand); then the device's synthesiser. The player chooses between them in Settings.
 *
 * Recorded voices come first. If `public/voices/manifest.json` lists a clip for a line (see
 * docs/VOICE_RECORDING.md), a real person's recording plays; any line without one falls back to the
 * synthesiser, so recordings can be added a few at a time, in any order, with nothing breaking.
 */

import { voiceKey } from './voiceKey';
import { pronounceable } from './pronounce';

export { pronounceable };

export interface VoiceProfile {
  /** Who is speaking. Needed to find a recording of the line. */
  speaker?: string;
  /** Which voice in the pool. Slots wrap, so any number is safe. */
  slot: number;
  pitch: number;
  rate: number;
}

export interface SpeechHandle {
  /** Resolves when the line has been spoken, cancelled, or could not be spoken at all. */
  done: Promise<void>;
  /** True if something is actually being said (false when voices are off or unavailable). */
  audible: boolean;
  /** True when this is a human recording rather than the synthesiser. */
  recorded: boolean;
  /** Length of a recording once known, so captions can be paced to it. Null for synthesised speech. */
  readonly seconds: number | null;
  cancel(): void;
}

/** Where spoken lines come from when there is no human recording. */
export type VoiceSource = 'auto' | 'clear' | 'accent' | 'device';

export type VoiceQuality = 'indian-english' | 'hindi' | 'other-english' | 'none';

const SILENT: SpeechHandle = { done: Promise.resolve(), audible: false, recorded: false, seconds: null, cancel: () => undefined };

/** Split into sentences of a safe length. Several engines silently stop on long utterances. */
function chunks(text: string): string[] {
  const sentences = text.match(/[^.!?;:]+[.!?;:]?\s*/g) ?? [text];
  const out: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > 170 && cur) {
      out.push(cur.trim());
      cur = s;
    } else cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Prefer neural and network voices, which sound far less synthetic than the local fallbacks. */
function rank(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  if (/natural|neural/.test(n)) return 0;
  if (/google/.test(n)) return 1;
  if (/microsoft/.test(n)) return 2;
  if (/siri|enhanced|premium/.test(n)) return 1;
  return 3;
}

/** Neural and network voices already carry natural prosody; bending their pitch only makes them sound processed. */
function isNatural(v: SpeechSynthesisVoice | null): boolean {
  return !!v && /natural|neural|online|enhanced|premium|siri|wavenet/i.test(v.name);
}

const langOf = (v: SpeechSynthesisVoice): string => v.lang.replace('_', '-').toLowerCase();

export class VoiceEngine {
  private readonly synth: SpeechSynthesis | null;
  private pool: SpeechSynthesisVoice[] = [];
  private quality: VoiceQuality = 'none';
  private enabled = true;
  private volume = 0.9;
  private generation = 0;
  private onSpeaking: ((speaking: boolean) => void) | null = null;
  /** Recorded lines: key -> file. Empty until (and unless) a manifest is found. */
  private clips = new Map<string, string>();
  private clipBase = '';
  /** Pre-rendered neural lines, per set: key -> file. */
  private clear = new Map<string, string>();
  private accent = new Map<string, string>();
  private source: VoiceSource = 'auto';
  private playing: HTMLAudioElement | null = null;

  constructor() {
    this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    if (!this.synth) return;
    this.refresh();
    // Voices load asynchronously in most browsers.
    this.synth.addEventListener?.('voiceschanged', () => this.refresh());
  }

  /** Look for recorded voices. Safe to call whenever; a missing manifest simply means "none yet". */
  async loadRecordings(base = import.meta.env.BASE_URL ?? '/'): Promise<number> {
    this.clipBase = `${base}voices/`;
    const load = async (path: string): Promise<Map<string, string>> => {
      try {
        const res = await fetch(`${base}${path}`, { cache: 'no-cache' });
        if (!res.ok) return new Map();
        const data = (await res.json()) as { clips?: Record<string, string> };
        return new Map(Object.entries(data.clips ?? {}));
      } catch {
        return new Map();
      }
    };
    [this.clips, this.clear, this.accent] = await Promise.all([
      load('voices/manifest.json'),
      load('voices/clear/manifest.json'),
      load('voices/accent/manifest.json'),
    ]);
    return this.clips.size + Math.max(this.clear.size, this.accent.size);
  }

  setSource(source: VoiceSource): void {
    this.source = source;
  }

  /** How many lines have a human recording. */
  get recordedCount(): number {
    return this.clips.size;
  }

  /** How many lines have a pre-rendered neural voice (in the larger set). */
  get renderedCount(): number {
    return Math.max(this.clear.size, this.accent.size);
  }

  /** True when the device itself offers a natural-sounding Indian-English voice. */
  get deviceHasNaturalVoice(): boolean {
    return this.quality === 'indian-english' && isNatural(this.pool[0] ?? null);
  }

  get supported(): boolean {
    return this.synth !== null;
  }

  get voiceQuality(): VoiceQuality {
    return this.quality;
  }

  /** Names of the voices in use, for the settings screen. */
  get voiceNames(): string[] {
    return this.pool.map((v) => v.name);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.cancel();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
  }

  /** Called with true when speech starts and false when it ends, so music can duck under it. */
  watch(fn: (speaking: boolean) => void): void {
    this.onSpeaking = fn;
  }

  /** The pre-rendered file for this line under the player's choice, as [folder, file], or null. */
  private renderedFor(key: string): [string, string] | null {
    if (this.source === 'device') return null;
    // Auto trusts the device when it has a natural Indian-English voice of its own.
    if (this.source === 'auto' && this.deviceHasNaturalVoice) return null;
    const order: Array<['clear' | 'accent', Map<string, string>]> =
      this.source === 'accent' ? [['accent', this.accent], ['clear', this.clear]] : [['clear', this.clear], ['accent', this.accent]];
    for (const [folder, map] of order) {
      const file = map.get(key);
      if (file) return [folder, file];
    }
    return null;
  }

  private refresh(): void {
    if (!this.synth) return;
    const all = this.synth.getVoices();
    const by = (pred: (l: string) => boolean): SpeechSynthesisVoice[] =>
      all.filter((v) => pred(langOf(v))).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

    const indianEnglish = by((l) => l === 'en-in' || l.startsWith('en-in'));
    const hindi = by((l) => l.startsWith('hi'));
    const english = by((l) => l.startsWith('en-gb') || l.startsWith('en-au') || l.startsWith('en'));

    if (indianEnglish.length > 0) {
      this.pool = indianEnglish;
      this.quality = 'indian-english';
    } else if (hindi.length > 0) {
      this.pool = hindi;
      this.quality = 'hindi';
    } else if (english.length > 0) {
      this.pool = english;
      this.quality = 'other-english';
    } else {
      this.pool = [];
      this.quality = 'none';
    }
  }

  /** The two fixed voices, and a stable one for everybody else. */
  profileFor(name: string, kind: 'maitri' | 'ekarupa' | 'npc'): VoiceProfile {
    if (kind === 'maitri') return { slot: 0, pitch: 1.02, rate: 0.94 };
    if (kind === 'ekarupa') return { slot: 1, pitch: 0.7, rate: 0.82 };
    const h = hash(name);
    // Slot 0 and 1 are Maitri and Ekarupa, so people start from 2 — but wrap into a small pool gracefully.
    return {
      slot: 2 + (h % 7),
      pitch: 0.84 + ((h >>> 5) % 100) / 100 * 0.34,
      rate: 0.9 + ((h >>> 12) % 100) / 100 * 0.12,
    };
  }

  /** Profile for whoever is speaking, by name: Maitri and Ekarupa are fixed, everyone else is hashed. */
  profileForSpeaker(name: string): VoiceProfile {
    const base = name === 'Maitri' ? this.profileFor(name, 'maitri') : name === 'Ekarupa' ? this.profileFor(name, 'ekarupa') : this.profileFor(name, 'npc');
    return { ...base, speaker: name };
  }

  private voiceFor(profile: VoiceProfile): SpeechSynthesisVoice | null {
    if (this.pool.length === 0) return null;
    return this.pool[profile.slot % this.pool.length] ?? this.pool[0] ?? null;
  }

  speak(text: string, profile: VoiceProfile): SpeechHandle {
    if (!this.enabled || this.volume <= 0) return SILENT;
    const key = profile.speaker ? voiceKey(profile.speaker, text) : undefined;
    const file = key ? this.clips.get(key) : undefined;
    if (file) {
      const clip = this.playClip(`${this.clipBase}${file}`);
      if (clip) return clip;
    }
    const made = key ? this.renderedFor(key) : null;
    if (made) {
      const clip = this.playClip(`${this.clipBase}${made[0]}/${made[1]}`);
      if (clip) return clip;
    }
    const synth = this.synth;
    if (!synth) return SILENT;
    if (this.pool.length === 0) this.refresh();
    const voice = this.voiceFor(profile);
    if (!voice) return SILENT;
    // A neural voice keeps its own pitch (within a hair) and pace; only the older engines are bent
    // to make one voice into several people.
    const natural = isNatural(voice);
    const pitch = natural ? 1 + (profile.pitch - 1) * 0.18 : profile.pitch;
    const rate = natural ? 0.97 + (profile.rate - 0.95) * 0.35 : profile.rate;

    this.cancel();
    const mine = ++this.generation;
    const parts = chunks(pronounceable(text));
    let cancelled = false;
    let finish: () => void = () => undefined;
    const done = new Promise<void>((resolve) => (finish = resolve));

    // Some engines never fire `end`; a generous estimate keeps a caption from hanging.
    const estimateMs = (text.length / (14 * rate)) * 1000;
    const watchdog = window.setTimeout(() => end(), estimateMs * 2.4 + 2500);

    const end = (): void => {
      window.clearTimeout(watchdog);
      if (this.generation === mine) this.onSpeaking?.(false);
      finish();
    };

    const next = (i: number): void => {
      if (cancelled || this.generation !== mine) return end();
      const part = parts[i];
      if (part === undefined) return end();
      const u = new SpeechSynthesisUtterance(part);
      u.voice = voice;
      u.lang = voice.lang;
      u.pitch = pitch;
      u.rate = rate;
      u.volume = this.volume;
      u.onend = () => next(i + 1);
      u.onerror = () => end();
      synth.speak(u);
    };

    this.onSpeaking?.(true);
    next(0);

    return {
      done,
      audible: true,
      recorded: false,
      seconds: null,
      cancel: () => {
        cancelled = true;
        if (this.generation === mine) synth.cancel();
        end();
      },
    };
  }

  /** Play one recorded clip. Returns null if it cannot be started, so the caller can fall back. */
  private playClip(url: string): SpeechHandle | null {
    if (typeof Audio === 'undefined') return null;
    this.cancel();
    const mine = ++this.generation;
    const el = new Audio(url);
    el.volume = this.volume;
    this.playing = el;
    let seconds: number | null = null;
    let settled = false;
    let finish: () => void = () => undefined;
    const done = new Promise<void>((resolve) => (finish = resolve));
    const end = (): void => {
      if (settled) return;
      settled = true;
      if (this.playing === el) this.playing = null;
      if (this.generation === mine) this.onSpeaking?.(false);
      finish();
    };
    el.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(el.duration)) seconds = el.duration;
    });
    el.addEventListener('ended', end);
    // A clip that fails to load must never leave the game waiting in silence.
    el.addEventListener('error', end);
    this.onSpeaking?.(true);
    void el.play().catch(end);
    return {
      done,
      audible: true,
      recorded: true,
      get seconds() {
        return seconds;
      },
      cancel: () => {
        el.pause();
        end();
      },
    };
  }

  /** Stop whatever is being said. */
  cancel(): void {
    this.generation++;
    if (this.playing) {
      this.playing.pause();
      this.playing = null;
    }
    if (!this.synth) return;
    this.synth.cancel();
    this.onSpeaking?.(false);
  }
}

export const voice = new VoiceEngine();
