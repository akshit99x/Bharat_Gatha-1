import { Composer, type Bar, type NoteEvent } from './Composer';
import { startAmbience, type AmbienceHandle } from './Ambience';
import { buildImpulse } from './reverb';
import { noteHz } from './theory';
import { THEMES, type Theme } from './themes';
import { VOICES, bellStrike, manjira, playBol, tanpura, type Out } from './voices';

/**
 * The conductor: turns a theme into sound on the audio clock.
 *
 * It owns one *session* per theme — a composer, an ambience, and a fade — and
 * crossfades between them when the player walks from one region into the next,
 * so the music changes the way weather does rather than cutting. Everything is
 * scheduled ahead of time against `ctx.currentTime` (never against timers), so a
 * slow frame in the game cannot make a note late. The same code renders
 * offline for testing: give it an `OfflineAudioContext` and call `pump` for
 * the length you want.
 */

interface Session {
  theme: Theme;
  composer: Composer;
  ambience: AmbienceHandle;
  fade: GainNode;
  ambFade: GainNode;
  wetFade: GainNode;
  out: Out;
  nextBar: number;
  stopAt?: number;
}

/** How far ahead of the clock to schedule, in seconds. */
const LOOKAHEAD = 1.6;

export class Conductor {
  private current: Session | null = null;
  private readonly retiring: Session[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly destination: AudioNode,
    private readonly room: AudioNode,
  ) {}

  get themeId(): string | null {
    return this.current?.theme.id ?? null;
  }

  /** Begin (or move to) a theme, crossfading from whatever is playing. */
  setTheme(theme: Theme | null, fadeSeconds = 3): void {
    if (theme?.id === this.current?.theme.id) return;
    const now = this.ctx.currentTime;

    if (this.current) {
      const old = this.current;
      old.fade.gain.cancelScheduledValues(now);
      old.fade.gain.setValueAtTime(old.fade.gain.value, now);
      old.fade.gain.linearRampToValueAtTime(0, now + fadeSeconds);
      for (const g of [old.ambFade, old.wetFade]) {
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(0, now + fadeSeconds);
      }
      old.stopAt = now + fadeSeconds + 0.3;
      old.ambience.stop(old.stopAt);
      this.retiring.push(old);
      this.current = null;
    }
    if (!theme) return;

    const fade = this.ctx.createGain();
    fade.gain.setValueAtTime(0, now);
    fade.gain.linearRampToValueAtTime(theme.level, now + fadeSeconds);
    fade.connect(this.destination);
    const ambFade = this.ctx.createGain();
    ambFade.gain.setValueAtTime(0, now);
    ambFade.gain.linearRampToValueAtTime(1, now + fadeSeconds);
    ambFade.connect(this.destination);

    // Dry goes through the fade. Wet goes to the shared room through its own fade, scaled by
    // this theme's reverb, so an old theme's echo dies with it instead of lingering.
    const dry = this.ctx.createGain();
    dry.connect(fade);
    const wet = this.ctx.createGain();
    wet.gain.value = theme.reverb;
    const wetFade = this.ctx.createGain();
    wetFade.gain.setValueAtTime(0, now);
    wetFade.gain.linearRampToValueAtTime(1, now + fadeSeconds);
    wet.connect(wetFade).connect(this.room);
    const out: Out = { dry, wet };

    const start = now + 0.35;
    this.current = {
      theme,
      composer: new Composer(theme),
      ambience: startAmbience(this.ctx, ambFade, out, theme.ambience, theme.id, start),
      fade,
      ambFade,
      wetFade,
      out,
      nextBar: start,
    };
  }

  /** Schedule everything due before `until`. Called by a timer in play and in one go offline. */
  pump(until: number): void {
    const s = this.current;
    if (s) {
      while (s.nextBar < until) {
        const bar = s.composer.nextBar();
        this.schedule(s, bar, s.nextBar);
        s.nextBar += bar.duration;
      }
      s.ambience.schedule(until);
    }
    // Let a faded-out session go.
    for (let i = this.retiring.length - 1; i >= 0; i--) {
      const r = this.retiring[i] as Session;
      if (r.stopAt !== undefined && this.ctx.currentTime > r.stopAt + 6) {
        for (const n of [r.fade, r.ambFade, r.wetFade, r.out.dry, r.out.wet]) {
          try {
            n.disconnect();
          } catch {
            /* ignore */
          }
        }
        this.retiring.splice(i, 1);
      }
    }
  }

  /** Run in real time: keep scheduling a little ahead of the clock. */
  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.pump(this.ctx.currentTime + LOOKAHEAD), 250);
    this.pump(this.ctx.currentTime + LOOKAHEAD);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.setTheme(null, 0.6);
  }

  // ---------------------------------------------------------------- playing

  private schedule(s: Session, bar: Bar, at: number): void {
    const { theme, out } = s;
    const sa = noteHz(theme.tonic);
    for (const ev of bar.events) {
      const when = at + ev.t;
      if (ev.kind === 'drum') {
        playBol(this.ctx, out, when, ev.bol, ev.vel, theme.kit, sa);
        continue;
      }
      this.playNote(out, when, ev);
    }
  }

  private playNote(out: Out, when: number, ev: NoteEvent): void {
    const hz = noteHz(ev.midi);
    switch (ev.voice) {
      case 'tanpura':
        tanpura(this.ctx, out, when, hz, ev.vel);
        return;
      case 'bell':
        bellStrike(this.ctx, out, when, hz, ev.vel);
        return;
      case 'manjira':
        manjira(this.ctx, out, when, ev.vel);
        return;
      default:
        VOICES[ev.voice](this.ctx, out, when, {
          hz,
          dur: ev.dur,
          vel: ev.vel,
          ...(ev.glideFromMidi !== undefined ? { glideFrom: noteHz(ev.glideFromMidi) } : {}),
          ...(ev.pan !== undefined ? { pan: ev.pan } : {}),
          ...(ev.wet !== undefined ? { wet: ev.wet } : {}),
        });
    }
  }
}

/** The shared room: one convolver, returning to `destination`. */
export function buildRoom(ctx: BaseAudioContext, destination: AudioNode): AudioNode {
  const convolver = ctx.createConvolver();
  convolver.buffer = buildImpulse(ctx);
  const ret = ctx.createGain();
  ret.gain.value = 0.75;
  convolver.connect(ret).connect(destination);
  return convolver;
}

/**
 * Render a theme to a buffer, offline. Used by tests to check levels and
 * silence without a speaker; the code path is the one the game plays.
 */
export async function renderTheme(themeId: string, seconds: number, sampleRate = 44100): Promise<AudioBuffer> {
  const theme = THEMES[themeId];
  if (!theme) throw new Error(`Unknown theme "${themeId}"`);
  const ctx = new OfflineAudioContext(2, Math.floor(sampleRate * seconds), sampleRate);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  comp.connect(ctx.destination);
  const bus = ctx.createGain();
  bus.gain.value = 0.55;
  bus.connect(comp);
  const conductor = new Conductor(ctx, bus, buildRoom(ctx, bus));
  conductor.setTheme(theme, 0.05);
  conductor.pump(seconds + 1);
  return ctx.startRendering();
}
