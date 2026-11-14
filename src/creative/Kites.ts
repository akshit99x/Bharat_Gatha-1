import * as THREE from 'three';
import type { World } from '../world/World';

/**
 * Patangs over Agra: paper kites flown from the bazaar and from Fatehpur Sikri, each on a long sagging
 * string, swinging in a slow figure-eight on the wind with its tail fluttering. Kite-flying appears in
 * paintings of Mughal and later court life; here it simply makes the sky above the city feel lived in.
 */

const SPOTS: ReadonlyArray<readonly [string, number]> = [
  ['agra-bazaar', 4],
  ['agra-sikri', 4],
  ['agra-gate', 2],
];
const RANGE = 700;
const PAPER = [0xd7372b, 0xf4a300, 0x2e8b57, 0x3949ab, 0xe0608a, 0xf2c230, 0x1e9bb0, 0xffffff];
const TAIL = 10;
const STRING = 18;

interface Kite {
  anchor: THREE.Vector3;
  /** Where it hangs on the wind, relative to the anchor. */
  rest: THREE.Vector3;
  body: THREE.Mesh;
  tail: THREE.Line;
  string: THREE.Line;
  phase: number;
}

function kiteGeometry(a: number, b: number): THREE.BufferGeometry {
  // A diamond, wider than tall, in two colours split down the spine, with a small fringe triangle at the foot.
  const w = 0.55;
  const top = 0.6;
  const bot = -0.7;
  const pos = [
    0, top, 0, -w, 0, 0, 0, bot, 0,
    0, top, 0, 0, bot, 0, w, 0, 0,
    -0.12, bot + 0.02, 0, 0.12, bot + 0.02, 0, 0, bot - 0.22, 0,
  ];
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  const col: number[] = [];
  for (let i = 0; i < 3; i++) col.push(ca.r, ca.g, ca.b);
  for (let i = 0; i < 3; i++) col.push(cb.r, cb.g, cb.b);
  for (let i = 0; i < 3; i++) col.push(ca.r, ca.g, ca.b);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

const _wind = new THREE.Vector3(0.8, 0, -0.6).normalize();
const _p = new THREE.Vector3();
const _mid = new THREE.Vector3();

export class Kites {
  readonly group = new THREE.Group();
  private readonly kites: Kite[] = [];
  private readonly centre = new THREE.Vector3();

  constructor(world: World) {
    this.group.name = 'kites';
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.96 });
    const lineMat = new THREE.LineBasicMaterial({ color: 0xf2ead8, transparent: true, opacity: 0.55 });
    let seed = 7;
    const rnd = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    let count = 0;
    for (const [id, n] of SPOTS) {
      const lm = world.landmarks.find((l) => l.id === id);
      if (!lm) continue;
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const d = 14 + rnd() * 30;
        const g = world.standPoint(lm.position.x + Math.cos(a) * d, lm.position.z + Math.sin(a) * d, 30);
        const anchor = new THREE.Vector3(g.x, g.y + 1.2, g.z);
        const reach = 30 + rnd() * 22;
        const rest = _wind.clone().multiplyScalar(reach * 0.55).add(new THREE.Vector3((rnd() - 0.5) * 12, reach * 0.8, (rnd() - 0.5) * 12));
        const c1 = PAPER[Math.floor(rnd() * PAPER.length)] as number;
        let c2 = PAPER[Math.floor(rnd() * PAPER.length)] as number;
        if (c2 === c1) c2 = 0xffffff;
        const body = new THREE.Mesh(kiteGeometry(c1, c2), mat);
        body.scale.setScalar(2.4 + rnd() * 0.8);
        const tail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new Array(TAIL).fill(0).map(() => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: c2 }));
        const string = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new Array(STRING).fill(0).map(() => new THREE.Vector3())), lineMat);
        for (const o of [body, tail, string]) o.frustumCulled = false;
        this.group.add(body, tail, string);
        this.kites.push({ anchor, rest, body, tail, string, phase: rnd() * 20 });
        this.centre.add(anchor);
        count++;
      }
    }
    if (count) this.centre.divideScalar(count);
  }

  update(elapsed: number, player: THREE.Vector3): void {
    const near = this.kites.length > 0 && player.distanceTo(this.centre) < RANGE;
    this.group.visible = near;
    if (!near) return;
    for (const k of this.kites) {
      const t = elapsed * 0.35 + k.phase;
      // A lazy figure-eight on the wind, with a quicker jitter from gusts.
      _p.copy(k.anchor).add(k.rest);
      _p.x += Math.sin(t) * 6 + Math.sin(elapsed * 2.3 + k.phase) * 0.5;
      _p.y += Math.sin(t * 2) * 2.5;
      _p.z += Math.cos(t) * 4;
      k.body.position.copy(_p);
      // Face into the wind, nose up, rolling with the swing.
      k.body.lookAt(_p.x - _wind.x * 10, _p.y + 3, _p.z - _wind.z * 10);
      k.body.rotateZ(Math.cos(t) * 0.5);
      k.body.updateMatrixWorld();

      // The string sags between hand and kite.
      const sp = k.string.geometry.getAttribute('position') as THREE.BufferAttribute;
      const span = k.anchor.distanceTo(_p);
      for (let i = 0; i < STRING; i++) {
        const u = i / (STRING - 1);
        _mid.lerpVectors(k.anchor, _p, u);
        _mid.y -= Math.sin(u * Math.PI) * span * 0.06;
        sp.setXYZ(i, _mid.x, _mid.y, _mid.z);
      }
      sp.needsUpdate = true;

      // The tail streams downwind and flutters.
      const tp = k.tail.geometry.getAttribute('position') as THREE.BufferAttribute;
      const base = _mid.set(0, -0.92, 0).applyMatrix4(k.body.matrixWorld);
      for (let i = 0; i < TAIL; i++) {
        const u = i / (TAIL - 1);
        tp.setXYZ(
          i,
          base.x + _wind.x * u * 3.4 + Math.sin(elapsed * 6 + u * 5 + k.phase) * 0.25 * u,
          base.y - u * 4.2,
          base.z + _wind.z * u * 3.4 + Math.cos(elapsed * 5 + u * 4 + k.phase) * 0.25 * u,
        );
      }
      tp.needsUpdate = true;
    }
  }
}
