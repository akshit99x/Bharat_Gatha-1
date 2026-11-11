import { startAmbience, type AmbienceHandle } from './Ambience';
import type { Out } from './voices';
import type { AmbienceKind, AmbienceLayer } from './themes';

/**
 * Sound that lives in a place.
 *
 * A region's score and weather are everywhere; these are not. A stepwell has a trickle you hear as you
 * come near, a bronze foundry rings, a harbour has surf and gulls, a temple has its bells. Each is a
 * `PannerNode` at the landmark's position, so the sound comes from the right direction and fades with
 * distance. Only the few nearest are ever running, and one that is out of earshot costs nothing.
 *
 * The sounds themselves are the same synthesised layers the regional ambience uses.
 */

export interface EmitterSource {
  id: string;
  /** Landmark kind from the content, which decides what the place sounds like. */
  kind: string;
  x: number;
  y: number;
  z: number;
  /** Rough footprint radius in metres; bigger places can be heard from further. */
  radius: number;
}

const SOUNDS: Record<string, AmbienceLayer[]> = {
  stepwell: [{ kind: 'fountain', level: 0.95 }, { kind: 'frogs', level: 0.35 }],
  charbagh: [{ kind: 'fountain', level: 1 }, { kind: 'birds', level: 0.5 }],
  greatBath: [{ kind: 'fountain', level: 0.8 }],
  villageCluster: [{ kind: 'crowd', level: 0.55 }, { kind: 'crows', level: 0.3 }],
  indusHousing: [{ kind: 'crowd', level: 0.6 }],
  bazaarStreet: [{ kind: 'crowd', level: 1 }],
  scribeYard: [{ kind: 'crowd', level: 0.25 }],
  bronzeFoundry: [{ kind: 'forge', level: 1 }],
  dravidaTemple: [{ kind: 'bells', level: 0.85 }],
  nagaraTemple: [{ kind: 'bells', level: 0.8 }],
  konarkTemple: [{ kind: 'bells', level: 0.7 }, { kind: 'wind', level: 0.3 }],
  kuruShrine: [{ kind: 'bells', level: 0.6 }, { kind: 'wind', level: 0.5 }],
  stupa: [{ kind: 'bells', level: 0.55 }, { kind: 'birds', level: 0.4 }],
  nalandaVihara: [{ kind: 'bells', level: 0.5 }, { kind: 'birds', level: 0.4 }],
  hermitage: [{ kind: 'birds', level: 0.8 }, { kind: 'wind', level: 0.25 }],
  harbour: [{ kind: 'waves', level: 0.9 }, { kind: 'gulls', level: 0.7 }],
  lothalDock: [{ kind: 'waves', level: 0.7 }, { kind: 'gulls', level: 0.5 }],
  dhow: [{ kind: 'waves', level: 0.8 }],
  ramSetu: [{ kind: 'waves', level: 1 }, { kind: 'gulls', level: 0.6 }],
  warCamp: [{ kind: 'crowd', level: 0.5 }, { kind: 'horn', level: 0.5 }],
  hillFort: [{ kind: 'wind', level: 0.9 }, { kind: 'crows', level: 0.4 }],
  lankaFort: [{ kind: 'wind', level: 0.7 }, { kind: 'crows', level: 0.5 }],
  cityGate: [{ kind: 'crowd', level: 0.45 }],
  palaceCity: [{ kind: 'crowd', level: 0.3 }, { kind: 'birds', level: 0.4 }],
  mughalTomb: [{ kind: 'fountain', level: 0.5 }, { kind: 'birds', level: 0.35 }],
  boulderField: [{ kind: 'wind', level: 0.6 }, { kind: 'crows', level: 0.3 }],
};

/** How far each place is audible, as a multiple of its own size (with a floor). */
const MIN_EARSHOT = 70;
const MAX_ACTIVE = 4;

interface Active {
  source: EmitterSource;
  panner: PannerNode;
  gain: GainNode;
  handle: AmbienceHandle;
  out: Out;
}

type Placed = EmitterSource & { layers: AmbienceLayer[]; earshot: number };

export class Emitters {
  private sources: Placed[] = [];
  private readonly active = new Map<string, Active>();
  private level = 1;

  constructor(
    private readonly ctx: AudioContext,
    private readonly dest: AudioNode,
  ) {}

  /** Replace the set of places. Anything with no sound defined for its kind is ignored. */
  setSources(list: readonly EmitterSource[]): void {
    for (const a of [...this.active.values()]) this.release(a, 0);
    this.sources = list
      .filter((s) => SOUNDS[s.kind])
      .map((s) => ({ ...s, layers: SOUNDS[s.kind] as AmbienceLayer[], earshot: Math.max(MIN_EARSHOT, s.radius * 2.2) }));
  }

  setLevel(v: number): void {
    this.level = v;
  }

  /** Call every frame with the listener's position and facing. */
  update(x: number, y: number, z: number, fx: number, fy: number, fz: number): void {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const l = ctx.listener;
    if (l.positionX) {
      l.positionX.setTargetAtTime(x, t, 0.03);
      l.positionY.setTargetAtTime(y, t, 0.03);
      l.positionZ.setTargetAtTime(z, t, 0.03);
      l.forwardX.setTargetAtTime(fx, t, 0.03);
      l.forwardY.setTargetAtTime(fy, t, 0.03);
      l.forwardZ.setTargetAtTime(fz, t, 0.03);
      l.upX.setValueAtTime(0, t);
      l.upY.setValueAtTime(1, t);
      l.upZ.setValueAtTime(0, t);
    } else {
      l.setPosition(x, y, z);
      l.setOrientation(fx, fy, fz, 0, 1, 0);
    }

    // The nearest places that are within earshot, up to the cap.
    const near: Array<{ s: Placed; d: number }> = [];
    for (const s of this.sources) {
      const d = Math.hypot(s.x - x, s.y - y, s.z - z);
      if (d < s.earshot) near.push({ s, d });
    }
    near.sort((a, b) => a.d - b.d);
    const wanted = new Set(near.slice(0, MAX_ACTIVE).map((n) => n.s.id));

    for (const a of [...this.active.values()]) if (!wanted.has(a.source.id)) this.release(a, 1.2);

    for (const { s, d } of near.slice(0, MAX_ACTIVE)) {
      let a = this.active.get(s.id);
      if (!a) a = this.start(s);
      // A gentle curve to silence at the edge of earshot, so nothing pops in or out.
      const edge = 1 - d / s.earshot;
      const target = this.level * Math.min(1, edge * 2.4) ** 1.4;
      a.gain.gain.setTargetAtTime(target, t, 0.4);
      a.handle.schedule(t + 1.2);
    }
  }

  private start(s: Placed): Active {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = Math.max(8, s.radius * 0.6);
    panner.maxDistance = s.earshot;
    panner.rolloffFactor = 1.1;
    panner.positionX.value = s.x;
    panner.positionY.value = s.y + 2;
    panner.positionZ.value = s.z;
    gain.connect(panner).connect(this.dest);
    // Event layers want a dry and a wet bus; here both simply lead to the panner.
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    wet.connect(gain);
    const out: Out = { dry: gain, wet };
    const handle = startAmbience(ctx, gain, out, s.layers, `emitter:${s.id}`, ctx.currentTime);
    const a: Active = { source: s, panner, gain, handle, out };
    this.active.set(s.id, a);
    return a;
  }

  private release(a: Active, fade: number): void {
    const t = this.ctx.currentTime;
    a.gain.gain.cancelScheduledValues(t);
    a.gain.gain.setTargetAtTime(0, t, Math.max(0.01, fade / 3));
    a.handle.stop(t + fade + 0.2);
    window.setTimeout(() => {
      a.gain.disconnect();
      a.panner.disconnect();
      a.out.wet.disconnect();
    }, (fade + 0.5) * 1000);
    this.active.delete(a.source.id);
  }
}

export const EMITTER_KINDS: readonly string[] = Object.keys(SOUNDS);
export type { AmbienceKind };
