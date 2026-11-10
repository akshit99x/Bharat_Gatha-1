import { audio } from '../core/Audio';
import { voice, type SpeechHandle } from '../core/Voice';
import type { Mask } from '../content/story';
import { el } from './overlay';

/**
 * Non-blocking captions.
 *
 * The opening flight and every region hook are narrated here rather than in the
 * dialogue box, because the dialogue box stops the game and the vimana ride
 * must not freeze for a conversation. Lines queue, each holds for as long as it
 * takes to read, and Enter skips the one on screen.
 */

export interface NarrationLine {
  name: string;
  role?: string;
  icon: string;
  text: string;
  /** 'maitri' and 'npc' read warm; 'ekarupa' reads grey and a little too smooth. */
  voice: 'maitri' | 'ekarupa' | 'npc';
  mask?: Mask;
}

/** Characters revealed per second. Fast enough not to drag, slow enough to feel spoken. */
const TYPE_CPS = 72;
/** How long a finished line stays up: a reading allowance, with a floor so short lines are not a flash. */
const linger = (text: string): number => Math.max(2200, Math.min(7000, text.length * 32));

const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export class Narration {
  private readonly root: HTMLElement;
  private readonly name: HTMLElement;
  private readonly role: HTMLElement;
  private readonly icon: HTMLElement;
  private readonly text: HTMLElement;
  private readonly queue: Array<{ line: NarrationLine; done: () => void }> = [];
  private timer: number | null = null;
  private current: (() => void) | null = null;
  /** Cancels the typing animation on the line now showing. Null once the line is fully shown. */
  private finishTyping: (() => void) | null = null;
  private raf = 0;
  private speech: SpeechHandle | null = null;
  private paused = false;
  private showing: { line: NarrationLine; done: () => void } | null = null;

  constructor() {
    this.root = el('div', 'narration');
    this.root.hidden = true;
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    this.icon = el('div', 'nr-icon');
    const who = el('div', 'nr-who');
    this.name = el('span', 'nr-name');
    this.role = el('span', 'nr-role');
    who.append(this.name, this.role);
    this.text = el('p', 'nr-text');
    const hint = el('span', 'nr-hint', 'Enter to skip');
    const body = el('div', 'nr-body');
    body.append(who, this.text);
    this.root.append(this.icon, body, hint);
    document.body.appendChild(this.root);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.root.hidden) this.skip();
    });
  }

  get active(): boolean {
    return !this.root.hidden;
  }

  /**
   * Hold the captions while a conversation or a puzzle is up. The voice engine
   * speaks one line at a time, so a caption talking behind a dialogue would cut
   * it off — and then move on without anybody having heard it.
   */
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.speech?.cancel();
    this.speech = null;
    cancelAnimationFrame(this.raf);
    this.finishTyping = null;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    // Put the interrupted line back at the front so it is heard in full afterwards.
    if (this.showing) this.queue.unshift(this.showing);
    this.showing = null;
    this.current = null;
    this.root.hidden = true;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.queue.length > 0 && this.timer === null && this.current === null) this.next();
  }

  /** Say a run of lines in order. Resolves when the last one has finished. */
  say(lines: readonly NarrationLine[]): Promise<void> {
    if (lines.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      lines.forEach((line, i) => {
        this.queue.push({ line, done: i === lines.length - 1 ? resolve : () => undefined });
      });
      if (!this.paused && this.timer === null && this.current === null) this.next();
    });
  }

  /** Drop everything queued and hide the box. Pending promises resolve. */
  clear(): void {
    this.speech?.cancel();
    this.speech = null;
    this.showing = null;
    cancelAnimationFrame(this.raf);
    this.finishTyping = null;
    this.text.classList.remove('typing');
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    const finishing = this.current;
    this.current = null;
    const waiting = this.queue.splice(0);
    this.root.hidden = true;
    finishing?.();
    for (const q of waiting) q.done();
  }

  /** First Enter completes the line being typed; the next one moves on. */
  private skip(): void {
    if (this.finishTyping) {
      this.finishTyping();
      return;
    }
    this.speech?.cancel();
    this.speech = null;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    const finishing = this.current;
    this.current = null;
    finishing?.();
    this.next();
  }

  private next(): void {
    if (this.paused) return;
    const item = this.queue.shift();
    if (!item) {
      this.showing = null;
      this.root.hidden = true;
      return;
    }
    this.showing = item;
    const { line } = item;
    this.root.hidden = false;
    this.root.dataset.voice = line.voice;
    if (line.mask) this.root.dataset.mask = line.mask;
    else delete this.root.dataset.mask;
    this.icon.textContent = line.icon;
    this.name.textContent = line.name;
    this.role.textContent = line.role ?? '';
    // Restart the entry animation on every line.
    this.root.classList.remove('nr-in');
    void this.root.offsetWidth;
    this.root.classList.add('nr-in');

    // Speak the line. When a voice is available the caption stays up until the
    // voice has finished; otherwise it falls back to a reading allowance.
    const speech = voice.speak(line.text, voice.profileForSpeaker(line.name));
    this.speech = speech;
    if (!speech.audible) audio.pluck(line.voice === 'ekarupa' ? 147 : 392, 0.1);

    this.current = item.done;

    const settle = (): void => {
      this.finishTyping = null;
      this.text.classList.remove('typing');
      this.text.textContent = line.text;
      const advance = (): void => {
        this.timer = null;
        this.speech = null;
        const finishing = this.current;
        this.current = null;
        finishing?.();
        this.next();
      };
      if (speech.audible) {
        // Wait for the voice, then a short breath before the next line.
        void speech.done.then(() => {
          if (this.current !== item.done) return; // skipped or cleared meanwhile
          this.timer = window.setTimeout(advance, 700);
        });
      } else {
        this.timer = window.setTimeout(advance, linger(line.text));
      }
    };

    if (reducedMotion()) {
      settle();
      return;
    }

    // Typewriter: reveal by elapsed time, not by interval ticks, so a slow frame never slows the speech.
    this.text.classList.add('typing');
    this.text.textContent = '';
    const started = performance.now();
    // Keep the caption in step with the voice: about 14 characters a second at normal pace.
    const typeCps = speech.audible ? 14 * voice.profileForSpeaker(line.name).rate : TYPE_CPS;
    const tick = (now: number): void => {
      // A recording knows its own length: pace the words to it (finishing just before the voice does).
      const cps = speech.recorded && speech.seconds ? line.text.length / (speech.seconds * 0.94) : typeCps;
      const shown = Math.min(line.text.length, Math.floor(((now - started) / 1000) * cps));
      this.text.textContent = line.text.slice(0, shown);
      if (shown < line.text.length) this.raf = requestAnimationFrame(tick);
      else settle();
    };
    this.finishTyping = () => {
      cancelAnimationFrame(this.raf);
      settle();
    };
    this.raf = requestAnimationFrame(tick);
  }
}
