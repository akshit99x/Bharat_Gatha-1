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
 */

export interface VoiceProfile {
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
  cancel(): void;
}

export type VoiceQuality = 'indian-english' | 'hindi' | 'other-english' | 'none';

const SILENT: SpeechHandle = { done: Promise.resolve(), audible: false, cancel: () => undefined };

/**
 * How Indian names and terms should be *heard*, not seen. English voices read
 * "Dhundh" and "Gathak" as English words; these respellings steer them to
 * something close to the real sound. Only the spoken text is changed.
 */
const SAY_AS: Array<[RegExp, string]> = [
  [/\bDhundh\b/g, 'Dhoondh'],
  [/\bEkarupa\b/g, 'Ekaroopa'],
  [/\bMaitri\b/g, 'Maitree'],
  [/\bGathak\b/g, 'Gaathak'],
  [/\bGatha\b/g, 'Gaatha'],
  [/\bSabha\b/g, 'Sabhaa'],
  [/\bVimana\b/g, 'Vimaana'],
  [/\bPramana\b/g, 'Pramaana'],
  [/\bVidya\b/g, 'Vidyaa'],
  [/\bdhamma\b/gi, 'dhamma'],
  [/\bSulh-i-kul\b/g, 'Sulh-e-kul'],
  [/\bChakravyuha\b/g, 'Chakravyooha'],
  [/\bVibhishana\b/g, 'Vibheeshana'],
  [/\bRavana\b/g, 'Raavana'],
  [/\bRama\b/g, 'Raama'],
  [/\bSita\b/g, 'Seetaa'],
  [/\bAshoka\b/g, 'Ashoka'],
  [/\bKalinga\b/g, 'Kalinga'],
  [/\bMahabharata\b/g, 'Mahaabhaarata'],
  [/\bRamayana\b/g, 'Raamaayana'],
  [/\bUttaramerur\b/g, 'Uttaramerur'],
  [/\bKunjaramallan\b/g, 'Kunjaramallan'],
  [/\bBrahmi\b/g, 'Braahmi'],
  [/\bKharosthi\b/g, 'Kharoshthi'],
  [/\bsulh\b/gi, 'sulh'],
  [/\bjizya\b/g, 'jizya'],
  [/\bStupa\b/gi, 'stoopa'],
  [/\bMeluhha\b/g, 'Meluhha'],
  [/\bShilpa\b/g, 'Shilpa'],
  [/\bBhadra\b/g, 'Bhadraa'],
  [/\bMaratha\b/g, 'Maraathaa'],
  [/\bHampi\b/g, 'Hampee'],
  [/\bKonark\b/g, 'Konaark'],
  [/\bChola\b/g, 'Chola'],
  [/\bVijayanagara\b/g, 'Vijayanagara'],
  [/\bIbadat Khana\b/g, 'Ibaadat Khaana'],
  [/\bTaj\b/g, 'Taaj'],
];

export function pronounceable(text: string): string {
  let out = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s*—\s*/g, ', ').replace(/…/g, '...');
  for (const [pattern, spoken] of SAY_AS) out = out.replace(pattern, spoken);
  return out;
}

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

const langOf = (v: SpeechSynthesisVoice): string => v.lang.replace('_', '-').toLowerCase();

export class VoiceEngine {
  private readonly synth: SpeechSynthesis | null;
  private pool: SpeechSynthesisVoice[] = [];
  private quality: VoiceQuality = 'none';
  private enabled = true;
  private volume = 0.9;
  private generation = 0;
  private onSpeaking: ((speaking: boolean) => void) | null = null;

  constructor() {
    this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    if (!this.synth) return;
    this.refresh();
    // Voices load asynchronously in most browsers.
    this.synth.addEventListener?.('voiceschanged', () => this.refresh());
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
    if (name === 'Maitri') return this.profileFor(name, 'maitri');
    if (name === 'Ekarupa') return this.profileFor(name, 'ekarupa');
    return this.profileFor(name, 'npc');
  }

  private voiceFor(profile: VoiceProfile): SpeechSynthesisVoice | null {
    if (this.pool.length === 0) return null;
    return this.pool[profile.slot % this.pool.length] ?? this.pool[0] ?? null;
  }

  speak(text: string, profile: VoiceProfile): SpeechHandle {
    const synth = this.synth;
    if (!synth || !this.enabled || this.volume <= 0) return SILENT;
    if (this.pool.length === 0) this.refresh();
    const voice = this.voiceFor(profile);
    if (!voice) return SILENT;

    this.cancel();
    const mine = ++this.generation;
    const parts = chunks(pronounceable(text));
    let cancelled = false;
    let finish: () => void = () => undefined;
    const done = new Promise<void>((resolve) => (finish = resolve));

    // Some engines never fire `end`; a generous estimate keeps a caption from hanging.
    const estimateMs = (text.length / (14 * profile.rate)) * 1000;
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
      u.pitch = profile.pitch;
      u.rate = profile.rate;
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
      cancel: () => {
        cancelled = true;
        if (this.generation === mine) synth.cancel();
        end();
      },
    };
  }

  /** Stop whatever is being said. */
  cancel(): void {
    if (!this.synth) return;
    this.generation++;
    this.synth.cancel();
    this.onSpeaking?.(false);
  }
}

export const voice = new VoiceEngine();
