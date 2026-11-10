import * as THREE from 'three';
import { shaderTime } from './Materials';
import type { Terrain } from './Terrain';
import { SEA_LEVEL } from './Terrain';

/**
 * Birds in the sky: loose flocks wheeling over the land.
 *
 * Each is three triangles (a body and two wings) whose wing tips are lifted and dropped in the vertex
 * shader, so the whole flock is one draw call and the flapping costs nothing on the CPU. Flocks circle
 * on slow orbits around points that drift with the player, so there are always some overhead without
 * them ever following you. Over open water they are kept a little higher, as gulls would be.
 */

const FLOCKS = 4;
const PER_FLOCK = 9;

function birdGeometry(): THREE.BufferGeometry {
  // x = span, z = forward. `wing` is 0 on the body and 1 at the wing tips (sign = side).
  const pos = [
    // body
    0, 0, 0.55, -0.1, 0, -0.35, 0.1, 0, -0.35,
    // left wing (two panels so the bend reads)
    -0.08, 0, 0.1, -0.9, 0, -0.12, -0.12, 0, -0.32,
    // right wing
    0.08, 0, 0.1, 0.12, 0, -0.32, 0.9, 0, -0.12,
  ];
  const wing = [0, 0, 0, 0, -1, 0, 0, 0, 1];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('wing', new THREE.Float32BufferAttribute(wing, 1));
  return g;
}

export class Birds {
  readonly mesh: THREE.InstancedMesh;
  private readonly seed: Float32Array;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly centre = new THREE.Vector3();

  constructor(private readonly terrain: Terrain) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x2c2622, side: THREE.DoubleSide, fog: true });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = shaderTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float wing;\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
{
  float phase = instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.21;
  float flap = sin(uTime * 7.5 + phase) * 0.55 + 0.25;
  transformed.y += abs(wing) * flap * 0.9 * (abs(transformed.x) + 0.2);
}`,
        );
    };
    const total = FLOCKS * PER_FLOCK;
    this.mesh = new THREE.InstancedMesh(birdGeometry(), mat, total);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.name = 'birds';
    this.seed = new Float32Array(total * 3);
    for (let i = 0; i < total; i++) {
      const f = Math.floor(i / PER_FLOCK);
      // Per bird: offset within the flock, own speed, own height.
      this.seed[i * 3] = ((i * 2654435761) % 1000) / 1000 + f;
      this.seed[i * 3 + 1] = (((i * 40503) % 997) / 997) * 2 - 1;
      this.seed[i * 3 + 2] = (((i * 69069) % 991) / 991) * 2 - 1;
    }
  }

  update(focus: THREE.Vector3, elapsed: number): void {
    for (let i = 0; i < FLOCKS * PER_FLOCK; i++) {
      const f = Math.floor(i / PER_FLOCK);
      const r1 = this.seed[i * 3 + 1] as number;
      const r2 = this.seed[i * 3 + 2] as number;
      // Each flock orbits a point that is itself wandering slowly round the player.
      const wander = elapsed * (0.018 + f * 0.007) + f * 1.9;
      this.centre.set(focus.x + Math.cos(wander) * (80 + f * 45), 0, focus.z + Math.sin(wander * 1.2) * (80 + f * 45));
      const radius = 34 + f * 12 + r1 * 8;
      const speed = (0.11 + f * 0.012) * (1 + r2 * 0.12);
      const a = elapsed * speed + f * 2.1 + r1 * 0.35;
      const x = this.centre.x + Math.cos(a) * radius;
      const z = this.centre.z + Math.sin(a) * radius;
      const ground = Math.max(this.terrain.heightAt(x, z), SEA_LEVEL);
      const y = Math.max(ground + 24 + f * 6 + r2 * 5 + Math.sin(a * 2.3 + i) * 3, focus.y + 8);
      // Face along the orbit's tangent, and lean into the turn.
      this.e.set(0.04 * Math.sin(elapsed * 2 + i), -a, 0.32, 'YXZ');
      this.q.setFromEuler(this.e);
      const size = 2.7 + (r1 + 1) * 0.5;
      this.m.compose(this.p.set(x, y, z), this.q, this.s.set(size, size, size));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
