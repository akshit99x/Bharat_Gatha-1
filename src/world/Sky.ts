import * as THREE from 'three';
import type { ZonePalette } from '../content/types';
import { WORLD_SIZE } from './Terrain';

/**
 * Sky, sun and fog.
 *
 * Each zone carries its own light: the Indus wakes at dawn, Kurukshetra sits
 * under a low dusty sun, the Setu is at sunset, Konark at noon. Crossing a
 * border lerps the whole lighting rig over a few seconds, which does more for
 * the sense of travelling through eras than any amount of geometry.
 */

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uTime;
uniform float uCloud;
varying vec3 vDir;

// Cheap value noise, enough for soft cloud banding.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += vnoise(p) * amp;
    p *= 2.03;
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float up = max(d.y, 0.0);

  vec3 col = mix(uHorizon, uZenith, pow(up, 0.42));
  // Soften the band just below the horizon so the sea does not meet a hard edge.
  col = mix(uHorizon * 0.72, col, smoothstep(-0.12, 0.06, d.y));

  float s = max(dot(d, normalize(uSunDir)), 0.0);
  // Broad atmospheric glow, then the disc itself.
  col += uSunColor * pow(s, 6.0) * 0.30;
  col += uSunColor * pow(s, 220.0) * 0.55;
  col += uSunColor * smoothstep(0.9994, 0.9998, s) * 7.0;

  // Clouds: projected onto a flat plane above, faded out near the horizon.
  if (uCloud > 0.001 && d.y > 0.02) {
    vec2 uv = d.xz / max(d.y, 0.08) * 0.55;
    float n = fbm(uv * 0.9 + vec2(uTime * 0.004, uTime * 0.0021));
    float n2 = fbm(uv * 2.3 - vec2(uTime * 0.007, 0.0));
    float cloud = smoothstep(0.52, 0.78, n * 0.75 + n2 * 0.35);
    cloud *= smoothstep(0.02, 0.3, d.y) * uCloud;
    vec3 lit = mix(vec3(0.82, 0.80, 0.78), uSunColor, 0.35 + pow(s, 3.0) * 0.5);
    col = mix(col, lit, cloud * 0.85);
  }

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

interface LightTarget {
  horizon: THREE.Color;
  zenith: THREE.Color;
  fog: THREE.Color;
  sun: THREE.Color;
  sunDir: THREE.Vector3;
}

/** Half-width of the area round the player that gets shadows, in metres. */
const SHADOW_EXTENT = 95;
const _snap = new THREE.Vector3();

export class Sky {
  readonly mesh: THREE.Mesh;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly ambient: THREE.AmbientLight;
  readonly fog: THREE.Fog;

  private readonly uniforms: {
    uHorizon: { value: THREE.Color };
    uZenith: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uTime: { value: number };
    uCloud: { value: number };
  };

  private readonly current: LightTarget;
  private readonly target: LightTarget;

  constructor(shadows: boolean) {
    const initial = makeTarget({
      horizon: 0xf3bc7e,
      zenith: 0x5f7fb4,
      fog: 0xdcb98f,
      sun: 0xffd9a4,
      sunElevation: 25,
      sunAzimuth: 100,
      ground: 0,
      rock: 0,
      foliage: 0,
      stone: 0,
    });
    this.current = initial;
    this.target = makeTarget({
      horizon: 0xf3bc7e,
      zenith: 0x5f7fb4,
      fog: 0xdcb98f,
      sun: 0xffd9a4,
      sunElevation: 25,
      sunAzimuth: 100,
      ground: 0,
      rock: 0,
      foliage: 0,
      stone: 0,
    });

    this.uniforms = {
      uHorizon: { value: this.current.horizon.clone() },
      uZenith: { value: this.current.zenith.clone() },
      uSunColor: { value: this.current.sun.clone() },
      uSunDir: { value: this.current.sunDir.clone() },
      uTime: { value: 0 },
      uCloud: { value: 0.55 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), material);
    this.mesh.name = 'sky';
    // Drawn first, never culled, never occludes anything.
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    this.mesh.scale.setScalar(WORLD_SIZE * 1.6);

    this.fog = new THREE.Fog(this.current.fog.getHex(), WORLD_SIZE * 0.08, WORLD_SIZE * 0.52);

    this.sun = new THREE.DirectionalLight(this.current.sun.getHex(), 2.3);
    this.sun.castShadow = shadows;
    if (shadows) {
      this.sun.shadow.mapSize.set(2048, 2048);
      this.sun.shadow.camera.near = 1;
      this.sun.shadow.camera.far = 700;
      // A tight box round the player: about 9 cm of ground per shadow texel instead of 23, which is the
      // difference between a soft smudge and a shadow with an edge.
      const extent = SHADOW_EXTENT;
      const cam = this.sun.shadow.camera;
      cam.left = -extent;
      cam.right = extent;
      cam.top = extent;
      cam.bottom = -extent;
      cam.updateProjectionMatrix();
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.42;
    }

    this.hemi = new THREE.HemisphereLight(this.current.zenith.getHex(), 0x6b5a44, 1.15);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.38);
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.mesh);
    scene.add(this.sun);
    scene.add(this.sun.target);
    scene.add(this.hemi);
    scene.add(this.ambient);
    scene.fog = this.fog;
  }

  /** Request a new lighting mood. The transition is interpolated in `update`. */
  setPalette(palette: ZonePalette): void {
    const t = makeTarget(palette);
    this.target.horizon.copy(t.horizon);
    this.target.zenith.copy(t.zenith);
    this.target.fog.copy(t.fog);
    this.target.sun.copy(t.sun);
    this.target.sunDir.copy(t.sunDir);
  }

  /** Snap immediately, for the first frame after loading. */
  applyImmediately(palette: ZonePalette): void {
    this.setPalette(palette);
    this.blend(1);
  }

  update(dt: number, cameraPosition: THREE.Vector3, elapsed: number): void {
    this.blend(Math.min(1, dt * 0.55));
    this.uniforms.uTime.value = elapsed;
    // Keep the sky centred on the camera so it never clips.
    this.mesh.position.copy(cameraPosition);
    // Shadow camera follows the player, which is what keeps a 2k map usable
    // across a 3.6 km island.
    // Moved in whole shadow texels, so shadow edges do not crawl as the player walks.
    const texel = (SHADOW_EXTENT * 2) / 2048;
    _snap.set(Math.round(cameraPosition.x / texel) * texel, cameraPosition.y, Math.round(cameraPosition.z / texel) * texel);
    this.sun.target.position.copy(_snap);
    this.sun.position.copy(_snap).addScaledVector(this.current.sunDir, 320);
  }

  private blend(k: number): void {
    const c = this.current;
    const t = this.target;
    c.horizon.lerp(t.horizon, k);
    c.zenith.lerp(t.zenith, k);
    c.fog.lerp(t.fog, k);
    c.sun.lerp(t.sun, k);
    c.sunDir.lerp(t.sunDir, k).normalize();

    this.uniforms.uHorizon.value.copy(c.horizon);
    this.uniforms.uZenith.value.copy(c.zenith);
    this.uniforms.uSunColor.value.copy(c.sun);
    this.uniforms.uSunDir.value.copy(c.sunDir);

    this.fog.color.copy(c.fog);
    this.sun.color.copy(c.sun);
    // A low sun is a weaker sun — but never so weak that a dawn zone becomes
    // unreadable, which matters more here than physical accuracy.
    this.sun.intensity = 1.9 + Math.max(0, c.sunDir.y) * 1.7;
    this.hemi.color.copy(c.zenith);
    this.hemi.groundColor.copy(c.fog).multiplyScalar(0.72);
  }

  setShadows(enabled: boolean): void {
    this.sun.castShadow = enabled;
  }

  setClouds(amount: number): void {
    this.uniforms.uCloud.value = Math.max(0, Math.min(1, amount));
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

function makeTarget(palette: ZonePalette): LightTarget {
  const el = THREE.MathUtils.degToRad(palette.sunElevation);
  const az = THREE.MathUtils.degToRad(palette.sunAzimuth);
  return {
    horizon: new THREE.Color(palette.horizon),
    zenith: new THREE.Color(palette.zenith),
    fog: new THREE.Color(palette.fog),
    sun: new THREE.Color(palette.sun),
    sunDir: new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize(),
  };
}
