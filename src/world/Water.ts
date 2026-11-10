import * as THREE from 'three';
import { WORLD_SIZE, SEA_LEVEL, type Terrain } from './Terrain';

/**
 * The sea.
 *
 * One large plane with the waves done in the vertex shader — three crossing
 * sine trains plus a fresnel term for the horizon sheen. No textures, no
 * reflections, no render targets: it has to stay cheap because it covers most
 * of the screen when you are gliding in.
 */

const WATER_VERT = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying float vWave;

void main() {
  vec3 p = position;
  // Three crossing wave trains at different scales read as open water.
  float w =
    sin(p.x * 0.013 + uTime * 0.9) * 0.55 +
    sin(p.y * 0.017 - uTime * 0.7) * 0.42 +
    sin((p.x + p.y) * 0.031 + uTime * 1.45) * 0.22;
  p.z += w;
  vWave = w;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * The sea samples the terrain's own height, so it knows how deep it is at every
 * point. That is what lets it do what water does at a shore: go turquoise and
 * clear over the shallows, deepen to blue, wash up in lines of foam, and let the
 * sand show through where it is thin.
 */
const WATER_FRAG = /* glsl */ `
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTime;
uniform float uSea;
uniform float uHalf;
uniform sampler2D uHeight;
varying vec3 vWorld;
varying float vWave;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vec3 view = normalize(cameraPosition - vWorld);

  // How deep is it here? Terrain height is stored over the island's square; beyond it, deep sea.
  vec2 uv = (vWorld.xz + uHalf) / (uHalf * 2.0);
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float ground = texture2D(uHeight, clamp(uv, 0.0, 1.0)).r;
  float depth = mix(60.0, uSea - ground, inside);
  depth = max(depth, 0.0);

  // Small ripples tilt the normal, which is what the sun glitters on.
  vec2 q = vWorld.xz;
  float r1 = vnoise(q * 0.35 + vec2(uTime * 0.25, uTime * 0.1));
  float r2 = vnoise(q * 0.9 - vec2(uTime * 0.2, uTime * 0.31));
  float r3 = vnoise(q * 2.4 + vec2(uTime * 0.4, -uTime * 0.2));
  vec3 n = normalize(vec3((r1 - 0.5) * 0.35 + (r2 - 0.5) * 0.28 + (r3 - 0.5) * 0.14, 1.0, (r2 - 0.5) * 0.3 + (r3 - 0.5) * 0.2 - (r1 - 0.5) * 0.3));

  // Colour by depth: clear turquoise over the shallows, then through teal to the deep blue.
  vec3 turquoise = vec3(0.30, 0.74, 0.70);
  vec3 col = mix(turquoise, uShallow, smoothstep(0.6, 6.0, depth));
  col = mix(col, uDeep, smoothstep(5.0, 40.0, depth));

  // Fresnel: grazing angles go pale and reflective.
  float fres = pow(1.0 - clamp(dot(view, n), 0.0, 1.0), 3.0);
  col = mix(col, uFogColor * 0.92 + vec3(0.06), fres * 0.55);

  // Sun glitter on the ripple crests.
  vec3 sun = normalize(uSunDir);
  float spec = pow(max(dot(reflect(-view, n), sun), 0.0), 90.0);
  col += uSunColor * spec * 1.15;
  col += uSunColor * smoothstep(0.25, 0.9, vWave) * 0.05;

  // Surf: lines of foam that wash up the shallows and fade.
  float lap = sin(depth * 2.6 - uTime * 1.0 + r1 * 3.0) * 0.5 + 0.5;
  float band = smoothstep(3.4, 0.2, depth);
  float foam = band * smoothstep(0.52, 0.95, lap * (0.55 + r2 * 0.7));
  foam += smoothstep(0.7, 0.0, depth) * (0.55 + r3 * 0.4);
  foam = clamp(foam, 0.0, 1.0);
  col = mix(col, vec3(0.96, 0.98, 0.97), foam * 0.85);

  float dist = length(cameraPosition - vWorld);
  float fog = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uFogColor, fog);

  // Thin water lets the seabed show; it thickens with depth. Foam is opaque.
  float alpha = mix(0.32, 0.93, smoothstep(0.0, 7.0, depth));
  alpha = mix(alpha, 0.98, foam);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Water {
  readonly mesh: THREE.Mesh;
  private readonly uniforms: {
    uTime: { value: number };
    uShallow: { value: THREE.Color };
    uDeep: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uFogColor: { value: THREE.Color };
    uFogNear: { value: number };
    uFogFar: { value: number };
    uSea: { value: number };
    uHalf: { value: number };
    uHeight: { value: THREE.Texture };
  };
  private readonly heightTexture: THREE.DataTexture;

  constructor(terrain: Terrain) {
    this.heightTexture = bakeHeights(terrain);
    this.uniforms = {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color(0x4e9aa8) },
      uDeep: { value: new THREE.Color(0x11313f) },
      uSunColor: { value: new THREE.Color(0xffd9a4) },
      uSunDir: { value: new THREE.Vector3(0.3, 0.6, 0.7) },
      uFogColor: { value: new THREE.Color(0xdcb98f) },
      uFogNear: { value: WORLD_SIZE * 0.1 },
      uFogFar: { value: WORLD_SIZE * 0.6 },
      uSea: { value: SEA_LEVEL },
      uHalf: { value: WORLD_SIZE / 2 },
      uHeight: { value: this.heightTexture },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Enough segments for the waves to be visible, few enough to be free.
    const geo = new THREE.PlaneGeometry(WORLD_SIZE * 2.2, WORLD_SIZE * 2.2, 140, 140);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.name = 'sea';
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = SEA_LEVEL;
    this.mesh.renderOrder = 5;
    this.mesh.frustumCulled = false;
  }

  update(elapsed: number, sunDir: THREE.Vector3, sunColor: THREE.Color, fogColor: THREE.Color): void {
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uSunDir.value.copy(sunDir);
    this.uniforms.uSunColor.value.copy(sunColor);
    this.uniforms.uFogColor.value.copy(fogColor);
  }

  dispose(): void {
    this.heightTexture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}


/** The terrain's heights over the whole island, baked once into a half-float texture the sea can read. */
function bakeHeights(terrain: Terrain): THREE.DataTexture {
  const N = 512;
  const half = WORLD_SIZE / 2;
  const data = new Uint16Array(N * N);
  for (let j = 0; j < N; j++) {
    const z = -half + ((j + 0.5) / N) * WORLD_SIZE;
    for (let i = 0; i < N; i++) {
      const x = -half + ((i + 0.5) / N) * WORLD_SIZE;
      data[j * N + i] = THREE.DataUtils.toHalfFloat(terrain.heightAt(x, z));
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
