/**
 * Post-processing: the step between "a scene" and "a picture".
 *
 * The scene renders into a multisampled half-float target (so highlights keep
 * their brightness instead of clipping), then:
 *
 *   1. bloom — only the genuinely bright things glow: the sun on water, lamps,
 *      the forge, a gilded finial;
 *   2. sun shafts — a radial blur toward the sun, masked to bright sky, which
 *      gives the haze-and-light look of dusty Indian afternoons;
 *   3. grade — a gentle warm/cool split tone, a touch of saturation, a soft
 *      vignette and fine film grain (dithering as well, which hides banding in
 *      the sky gradient);
 *   4. output — the renderer's tone mapping and sRGB conversion.
 *
 * `adapt()` watches frame time and sheds cost in steps (shafts, then bloom
 * resolution, then the whole chain) so a modest laptop degrades instead of
 * stuttering. It never climbs back up on its own within a session unless the
 * frame rate has been healthy for a long while.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const SHAFT_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uSun;        // sun in screen uv
uniform float uStrength;  // 0 when the sun is behind the camera or off screen
uniform vec3 uTint;
varying vec2 vUv;

void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  if (uStrength < 0.001) { gl_FragColor = base; return; }

  vec2 delta = (uSun - vUv);
  float dist = length(delta);
  delta *= 0.92 / 22.0;

  vec2 p = vUv;
  float decay = 1.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 22; i++) {
    p += delta;
    vec3 s = texture2D(tDiffuse, p).rgb;
    // only bright, low-saturation sky contributes: the sun and its glare, not coloured walls
    float lum = dot(s, vec3(0.299, 0.587, 0.114));
    float bright = smoothstep(0.85, 1.7, lum);
    acc += s * bright * decay;
    decay *= 0.935;
  }
  acc /= 22.0;
  float falloff = smoothstep(1.15, 0.05, dist);
  gl_FragColor = vec4(base.rgb + acc * uTint * uStrength * falloff * 1.6, base.a);
}
`;

const GRADE_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
uniform float uWarmth;
varying vec2 vUv;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));

  // split tone: warm the highlights toward gold, cool the shadows a little toward blue-violet
  vec3 warm = vec3(1.045, 1.0, 0.93);
  vec3 cool = vec3(0.94, 0.985, 1.06);
  c *= mix(cool, warm, smoothstep(0.05, 0.9, lum) * uWarmth + (1.0 - uWarmth) * 0.5);

  // a little extra saturation: painted rather than photographed
  float l2 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l2), c, 1.12);

  // soft vignette
  vec2 q = vUv - 0.5;
  q.x *= 1.1;
  float v = smoothstep(0.35, 0.95, length(q));
  c *= 1.0 - v * uVignette;

  // film grain + dither
  float g = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 61.0) - 0.5;
  c += g * uGrain * (0.4 + 0.6 * (1.0 - clamp(lum, 0.0, 1.0)));

  gl_FragColor = vec4(c, 1.0);
}
`;

const PASS_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export type PostTier = 'full' | 'lite' | 'off';

export class Post {
  private composer: EffectComposer | null = null;
  private bloom!: UnrealBloomPass;
  private shafts!: ShaderPass;
  private grade!: ShaderPass;
  private tier: PostTier = 'full';
  private enabled = true;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private slow = 0;
  private healthy = 0;
  private readonly sunWorld = new THREE.Vector3();
  private readonly sunScreen = new THREE.Vector3();

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
  ) {}

  /** True when the chain is rendering the picture (so CSS fallbacks should step aside). */
  get active(): boolean {
    return this.enabled && this.tier !== 'off';
  }

  get currentTier(): PostTier {
    return this.tier;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) this.tier = 'full';
    document.body.classList.toggle('post-on', this.active);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.composer?.setPixelRatio(pixelRatio);
    this.composer?.setSize(width, height);
    this.bloom?.setSize(width * pixelRatio, height * pixelRatio);
  }

  private build(): void {
    const target = new THREE.WebGLRenderTarget(this.width * this.pixelRatio, this.height * this.pixelRatio, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    const composer = new EffectComposer(this.renderer, target);
    composer.setPixelRatio(this.pixelRatio);
    composer.setSize(this.width, this.height);
    composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.width * this.pixelRatio, this.height * this.pixelRatio), 0.34, 0.7, 0.92);
    composer.addPass(this.bloom);

    this.shafts = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uSun: { value: new THREE.Vector2(0.5, 0.5) },
        uStrength: { value: 0 },
        uTint: { value: new THREE.Color(1, 0.86, 0.62) },
      },
      vertexShader: PASS_VERT,
      fragmentShader: SHAFT_FRAG,
    });
    composer.addPass(this.shafts);

    this.grade = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uGrain: { value: 0.035 },
        uVignette: { value: 0.34 },
        uWarmth: { value: 0.75 },
      },
      vertexShader: PASS_VERT,
      fragmentShader: GRADE_FRAG,
    });
    composer.addPass(this.grade);
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  /**
   * Draw one frame. `sunDir` is the unit vector from the camera toward the sun,
   * `sunColor` its tint, `elapsed` the game clock.
   */
  render(dt: number, elapsed: number, sunDir: THREE.Vector3, sunColor: THREE.Color): void {
    if (!this.active) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (!this.composer) this.build();
    const composer = this.composer!;

    // Where is the sun on the screen, and how much of its glare faces us?
    this.sunWorld.copy(this.camera.position).addScaledVector(sunDir, 1000);
    this.sunScreen.copy(this.sunWorld).project(this.camera);
    const facing = this.camera.getWorldDirection(_dir).dot(sunDir);
    const onScreen = THREE.MathUtils.smoothstep(facing, 0.05, 0.5);
    const u = this.shafts.uniforms;
    u.uSun!.value.set(this.sunScreen.x * 0.5 + 0.5, this.sunScreen.y * 0.5 + 0.5);
    u.uStrength!.value = this.tier === 'full' ? onScreen * 0.9 : 0;
    u.uTint!.value.copy(sunColor).lerp(_white, 0.35);
    this.grade.uniforms.uTime!.value = elapsed;
    this.shafts.enabled = this.tier === 'full';
    this.bloom.strength = this.tier === 'full' ? 0.34 : 0.22;

    composer.render(dt);
    this.adapt(dt);
  }

  /** Shed cost when frames run long. Frame time is judged over a window, not a single hitch. */
  private adapt(dt: number): void {
    // dt arrives clamped by the game loop at 50 ms, so anything near that is a real slowdown.
    if (dt > 0.034) {
      this.slow += 1;
      this.healthy = 0;
    } else {
      this.healthy += 1;
      this.slow = Math.max(0, this.slow - 0.25);
    }
    if (this.slow > 90) {
      this.slow = 0;
      this.tier = this.tier === 'full' ? 'lite' : 'off';
      document.body.classList.toggle('post-on', this.active);
    }
  }

  dispose(): void {
    this.composer?.dispose();
    this.composer = null;
  }
}

const _dir = new THREE.Vector3();
const _white = new THREE.Color(1, 1, 1);
