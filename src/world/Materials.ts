import * as THREE from 'three';

/**
 * Material registry.
 *
 * Almost everything built in this game shares ONE material and carries its
 * colour in a vertex-colour attribute. That is what lets us merge an entire
 * monument — drum, dome, railing, four gateways — into a single draw call while
 * still giving each part its own stone colour.
 */

/**
 * Holes in the ground. A stepwell or a sunken bath is dug below ground level, so the terrain has to be
 * cut away over it or the ground simply covers it. Each is a rectangle (centre x/z, half extents) with a
 * yaw; the terrain shader discards inside them, and Terrain.heightAt drops to the pit's floor.
 */
export const MAX_PITS = 24;
export const terrainPits = {
  rect: { value: Array.from({ length: MAX_PITS }, () => new THREE.Vector4(0, 0, 0, 0)) },
  rot: { value: Array.from({ length: MAX_PITS }, () => new THREE.Vector2(1, 0)) },
  count: { value: 0 },
};

/** Shared clock for the foliage's wind. World.update advances it each frame. */
export const shaderTime = { value: 0 };

const NOISE_GLSL = /* glsl */ `
float bgHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float bgNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(bgHash(i + vec3(0, 0, 0)), bgHash(i + vec3(1, 0, 0)), f.x), mix(bgHash(i + vec3(0, 1, 0)), bgHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(bgHash(i + vec3(0, 0, 1)), bgHash(i + vec3(1, 0, 1)), f.x), mix(bgHash(i + vec3(0, 1, 1)), bgHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}
`;

/**
 * Give a vertex-coloured material surface life.
 *
 * Everything in the world is one flat colour per vertex, which at a glance reads
 * as plastic. These additions cost nothing in draw calls: world-space noise at
 * three scales weathers the colour, the base of anything darkens and dirties
 * where it meets the ground, and, for instanced foliage only, the wind bends
 * things in proportion to how high they stand. Rocks are excluded from the sway
 * by their grey: stone has no saturation, leaves and bark do.
 */
function weather(mat: THREE.MeshStandardMaterial, kind: 'stone' | 'terrain'): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shaderTime;
    if (kind === 'terrain') {
      shader.uniforms.uPit = terrainPits.rect;
      shader.uniforms.uPitRot = terrainPits.rot;
      shader.uniforms.uPitCount = terrainPits.count;
    }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying vec3 vWPos;
         varying float vObjY;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vObjY = position.y;
         #ifdef USE_INSTANCING
           ${kind === 'stone' ? `
           {
             float sat = abs(color.r - color.g) + abs(color.g - color.b);
             float foliage = smoothstep(0.05, 0.14, sat);
             float h = max(position.y, 0.0);
             vec3 iw = (instanceMatrix * vec4(position, 1.0)).xyz;
             float gust = sin(uTime * 0.7 + iw.x * 0.02) * 0.5 + 0.5;
             float ph = uTime * 1.5 + iw.x * 0.31 + iw.z * 0.23;
             float amp = 0.014 * h * foliage * (0.55 + gust * 0.9);
             transformed.x += sin(ph) * amp;
             transformed.z += cos(ph * 0.83 + 1.3) * amp;
           }` : ''}
         #endif`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         #ifdef USE_INSTANCING
           vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
         #endif`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWPos;
         varying float vObjY;
         ${kind === 'terrain' ? `uniform vec4 uPit[${MAX_PITS}];
         uniform vec2 uPitRot[${MAX_PITS}];
         uniform int uPitCount;` : ''}
         ${NOISE_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         ${kind === 'terrain' ? `
         for (int i = 0; i < ${MAX_PITS}; i++) {
           if (i >= uPitCount) break;
           vec2 d = vWPos.xz - uPit[i].xy;
           vec2 q = vec2(d.x * uPitRot[i].x - d.y * uPitRot[i].y, d.x * uPitRot[i].y + d.y * uPitRot[i].x);
           if (abs(q.x) < uPit[i].z && abs(q.y) < uPit[i].w) discard;
         }` : ''}
         {
           float n1 = bgNoise(vWPos * ${kind === 'terrain' ? '0.045' : '0.55'});
           float n2 = bgNoise(vWPos * ${kind === 'terrain' ? '0.31' : '2.6'});
           float n3 = bgNoise(vWPos * ${kind === 'terrain' ? '1.7' : '10.5'});
           float w = (n1 - 0.5) * ${kind === 'terrain' ? '0.26' : '0.24'} + (n2 - 0.5) * 0.16 + (n3 - 0.5) * 0.09;
           diffuseColor.rgb *= 1.0 + w;
           // Variation in hue as well as value, so it does not read as one tone going lighter and darker.
           diffuseColor.rgb += (vec3(n1 - 0.5, n2 - 0.5, 0.5 - n1) * 0.04);
           ${kind === 'stone' ? `
           // Where a thing meets the ground it is damper, dirtier and in shadow.
           float base = 1.0 - smoothstep(0.0, 2.8, vObjY);
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.66, 0.6, 0.52), base * 0.6);
           diffuseColor.rgb *= mix(0.8, 1.0, smoothstep(0.0, 1.6, vObjY));
           ` : ''}
         }`,
      );
  };
  mat.customProgramCacheKey = () => `weather-${kind}`;
}

let sharedOpaque: THREE.MeshStandardMaterial | null = null;
let sharedUnlit: THREE.MeshBasicMaterial | null = null;
const cache = new Map<string, THREE.Material>();

/** The workhorse: vertex-coloured, shadow-receiving stone/brick/timber. */
export function stoneMaterial(): THREE.MeshStandardMaterial {
  if (!sharedOpaque) {
    sharedOpaque = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.02,
      flatShading: false,
    });
    weather(sharedOpaque, 'stone');
  }
  return sharedOpaque;
}

/** For markers, holograms and UI-ish world elements that should ignore light. */
export function unlitMaterial(): THREE.MeshBasicMaterial {
  if (!sharedUnlit) {
    sharedUnlit = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  }
  return sharedUnlit;
}

export interface SolidOptions {
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  flatShading?: boolean;
  depthWrite?: boolean;
}

/** A cached single-colour material, for the few things that cannot share. */
export function solid(color: number, opts: SolidOptions = {}): THREE.MeshStandardMaterial {
  const key = `s|${color}|${JSON.stringify(opts)}`;
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshStandardMaterial;
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.8,
    metalness: opts.metalness ?? 0.03,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    flatShading: opts.flatShading ?? false,
    depthWrite: opts.depthWrite ?? true,
  });
  cache.set(key, mat);
  return mat;
}

/** Terrain uses its own material so we can tune it independently. */
export function terrainMaterial(): THREE.MeshStandardMaterial {
  const key = 'terrain';
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshStandardMaterial;
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    flatShading: false,
  });
  weather(mat, 'terrain');
  cache.set(key, mat);
  return mat;
}

/** Glow material for pickups, scan targets and challenge markers. */
export function glowMaterial(color: number, opacity = 0.55): THREE.MeshBasicMaterial {
  const key = `g|${color}|${opacity}`;
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshBasicMaterial;
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });
  cache.set(key, mat);
  return mat;
}

// ------------------------------------------------------------------ colours

/** Multiply a hex colour by a scalar, clamped. Handy for shading variants. */
export function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

/** Linear blend between two hex colours. */
export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export function disposeMaterials(): void {
  sharedOpaque?.dispose();
  sharedUnlit?.dispose();
  sharedOpaque = null;
  sharedUnlit = null;
  for (const mat of cache.values()) mat.dispose();
  cache.clear();
}
