/**
 * OpenSeaOcean.js — Realtime WebGPU / TSL Gerstner Ocean Simulation
 *
 * Core Three.js TSL wave & FBM micro-surface shader adapted from:
 * "Open Sea — Realtime Ocean" (Kimi AI Prototype)
 * https://qdtipu6rd2myk.ok.kimi.link/?id=2077778000455245824&share_id=19f6b13b-b432-8eb2-8000-0000c67df4cd
 *
 * Enhanced for Wanderlust with:
 * - Dynamic interactive GUI & modal editor controls
 * - Dynamic object ripples & Kelvin V-wake shockwave physics
 * - Realtime CPU wave height/normal buoyancy calculations for player & aircraft
 * - Horizon concealment & biome lighting integration
 */

import * as THREE from 'three/webgpu';
import {
  Fn, uniform, float, vec2, vec3, vec4,
  sin, cos, atan, abs, dot, cross, normalize, length, mix, pow, max, clamp,
  fract, floor, smoothstep, distance, reflect,
  positionLocal, positionWorld, cameraPosition
} from 'three/tsl';

/* ============================================================
   Uniforms — Shared across ocean TSL nodes and GUI Editor
   ============================================================ */
export const timeUniform = uniform(0.00001);
export const seaUniform = uniform(0.45);
export const speedUniform = uniform(1.0);
export const detailAmountUniform = uniform(1.0);
export const foamAmountUniform = uniform(1.0);
export const waterOpacityUniform = uniform(0.92);
export const foamEnabledUniform = uniform(1.0);
export const chopPatchinessUniform = uniform(1.0);
export const waveHeightUniform = uniform(1.0);
export const oceanScaleUniform = uniform(1.0);
export const swellWavelengthUniform = uniform(1.0);
export const foamDecayUniform = uniform(1.0);
export const qualityModeUniform = uniform(1.0); // 1.0 = High / Cinematic, 0.0 = Performance (High FPS)
export const distanceLodUniform = uniform(1.0); // 1.0 = Distance LOD active, 0.0 = Off
export const lodDistanceThresholdUniform = uniform(1800.0);

export const sunDirUniform = uniform(new THREE.Vector3(0, 1, 0));
export const sunColorUniform = uniform(new THREE.Color(1, 1, 1));
export const horizonColorUniform = uniform(new THREE.Color(0.52, 0.68, 0.82));
export const zenithColorUniform = uniform(new THREE.Color(0.07, 0.2, 0.42));
export const deepColorUniform = uniform(new THREE.Color(0.015, 0.09, 0.11));
export const shallowColorUniform = uniform(new THREE.Color(0.06, 0.32, 0.36));

// Object reaction uniforms
export const objPosUniform = uniform(new THREE.Vector3(0, 0, 0));
export const objRadiusUniform = uniform(2.0);
export const objActiveUniform = uniform(0.0);
export const objRippleStrengthUniform = uniform(1.0);
export const foamSpreadUniform = uniform(0.65);
export const foamOpacityUniform = uniform(1.0);

/* ============================================================
   Gerstner Swell — 5 Multi-directional Spectral Components
   ============================================================ */
export let WAVE_PARAMS = [
  // Primary ocean swell - long wavelength (160m), high amplitude
  { dir: [0.92, 0.38], wavelength: 160.0, steepness: 0.22, phase: 0.0 },
  // Secondary cross-swell (88m)
  { dir: [0.38, 0.92], wavelength: 88.0, steepness: 0.16, phase: 1.4 },
  // Medium choppy wind wave (42m)
  { dir: [-0.65, 0.76], wavelength: 42.0, steepness: 0.12, phase: 2.8 },
  // High-frequency surface chop (20m)
  { dir: [0.78, -0.62], wavelength: 20.0, steepness: 0.08, phase: 4.1 },
  // Capillary detail wave (9.5m)
  { dir: [-0.85, -0.52], wavelength: 9.5, steepness: 0.05, phase: 5.5 }
];

export let WAVES = WAVE_PARAMS.map(({ dir, wavelength, steepness, phase }) => {
  const len = Math.hypot(dir[0], dir[1]) || 1.0;
  const k = (2 * Math.PI) / wavelength;
  return {
    dx: uniform(dir[0] / len),
    dz: uniform(dir[1] / len),
    k: uniform(k),
    c: uniform(Math.sqrt(9.8 * k)),
    steepness: uniform(steepness),
    phase: uniform(phase || 0.00001)
  };
});

export function updateWaveUniforms(i) {
  const p = WAVE_PARAMS[i];
  const w = WAVES[i];
  const len = Math.hypot(p.dir[0], p.dir[1]) || 1.0;
  const k = (2 * Math.PI) / p.wavelength;
  
  w.dx.value = p.dir[0] / len;
  w.dz.value = p.dir[1] / len;
  w.k.value = k;
  w.c.value = Math.sqrt(9.8 * k);
  w.steepness.value = p.steepness;
  w.phase.value = p.phase;
}

export function randomizeSeaSpectrum() {
  for (let i = 0; i < WAVES.length; i++) {
    const angle = (Math.random() * 0.9 - 0.45) + (i % 2 === 0 ? 0 : Math.PI * 0.62);
    const wavelength = 160.0 * Math.pow(0.55, i) * (0.85 + Math.random() * 0.35);
    const steepness = 0.22 * Math.pow(0.72, i) * (0.8 + Math.random() * 0.4);
    
    WAVE_PARAMS[i] = {
      dir: [Math.cos(angle), Math.sin(angle)],
      wavelength: Math.max(wavelength, 2.0),
      steepness: Math.max(steepness, 0.01),
      phase: Math.random() * Math.PI * 2
    };
    updateWaveUniforms(i);
  }
}

export function setWindDirection(angleDeg, spreadPercent = 45) {
  const mainAngleRad = (angleDeg * Math.PI) / 180;
  const spreadFactor = spreadPercent / 100.0;
  WAVES.forEach((w, i) => {
    const spreadOffset = ((i % 2 === 0 ? 1 : -1) * (i * 0.25)) * spreadFactor;
    const finalAngle = mainAngleRad + spreadOffset;
    WAVE_PARAMS[i].dir[0] = Math.cos(finalAngle);
    WAVE_PARAMS[i].dir[1] = Math.sin(finalAngle);
    w.dx.value = Math.cos(finalAngle);
    w.dz.value = Math.sin(finalAngle);
  });
}

// phase: f = k * (dot(direction, xz) - time * c) + phase (wrapped to [0, 2*PI) to avoid precision loss)
const TWO_PI_NODE = float(Math.PI * 2.0);
const wavePhase = (w, xz, time) => {
  const rawPhase = w.k.mul(dot(vec2(w.dx, w.dz), xz).sub(time.mul(w.c))).add(w.phase);
  return fract(rawPhase.div(TWO_PI_NODE)).mul(TWO_PI_NODE);
};

// displaced surface point for a given parametric xz (sampled in world space for true physical waves)
const wavePosition = Fn(([localXz, time, sea]) => {
  const worldXz = localXz.add(cameraPosition.xz);
  const xz = worldXz.mul(oceanScaleUniform).toVar();
  const p = vec3(localXz.x, float(0.0), localXz.y).toVar();
  for (const w of WAVES) {
    const a = w.steepness.mul(sea).div(w.k).mul(swellWavelengthUniform).mul(waveHeightUniform);
    const f = wavePhase(w, xz, time);
    p.x.addAssign(a.mul(w.dx).mul(cos(f)).mul(0.35));
    p.y.addAssign(a.mul(sin(f)));
    p.z.addAssign(a.mul(w.dz).mul(cos(f)).mul(0.35));
  }
  return p;
});

// Outward circular wave ripples and Kelvin V-wake shockwaves produced by object interaction
const objectRippleDisplacement = Fn(([xz, time, objPos, objRadius, objActive, rippleStr]) => {
  const d = xz.sub(objPos.xz);
  const dist = distance(xz, objPos.xz);
  const r = max(dist.sub(objRadius.mul(0.8)), 0.0);
  const fade = smoothstep(16.0, 0.0, r).mul(smoothstep(0.0, 0.3, r));

  const wave1 = sin(dist.mul(2.2).sub(time.mul(3.6)));
  const wave2 = sin(dist.mul(4.8).sub(time.mul(5.2))).mul(0.35);
  const radialPattern = wave1.add(wave2).mul(0.18);

  const vAngle = abs(atan(d.x, d.y));
  const vWakeMask = smoothstep(0.85, 0.25, vAngle).mul(smoothstep(18.0, 0.5, dist));
  const vWakePattern = sin(dist.mul(1.8).sub(time.mul(4.2))).mul(0.26).mul(vWakeMask);

  return radialPattern.add(vWakePattern).mul(fade).mul(objActive).mul(rippleStr);
});

// analytic tangent/binormal derivatives — stable broad normals
const waveNormal = Fn(([rawXz, time, sea]) => {
  const xz = rawXz.mul(oceanScaleUniform).toVar();
  const tangent = vec3(1.0, 0.0, 0.0).toVar();
  const binormal = vec3(0.0, 0.0, 1.0).toVar();
  for (const w of WAVES) {
    const q = w.steepness.mul(sea).mul(waveHeightUniform);
    const f = wavePhase(w, xz, time);
    const s = sin(f);
    const co = cos(f);
    tangent.x.subAssign(q.mul(w.dx.mul(w.dx)).mul(s));
    tangent.y.addAssign(q.mul(w.dx).mul(co));
    tangent.z.subAssign(q.mul(w.dx.mul(w.dz)).mul(s));
    binormal.x.subAssign(q.mul(w.dx.mul(w.dz)).mul(s));
    binormal.y.addAssign(q.mul(w.dz).mul(co));
    binormal.z.subAssign(q.mul(w.dz.mul(w.dz)).mul(s));
  }
  return normalize(cross(binormal, tangent));
});

// signed crest height, drives tint / subsurface / foam
const waveCrest = Fn(([rawXz, time, sea]) => {
  const xz = rawXz.mul(oceanScaleUniform).toVar();
  const h = float(0.0).toVar();
  for (const w of WAVES) {
    const a = w.steepness.mul(sea).div(w.k).mul(swellWavelengthUniform).mul(waveHeightUniform);
    h.addAssign(a.mul(sin(wavePhase(w, xz, time))));
  }
  return h;
});

/* ============================================================
   Procedural gradient noise + 3-octave FBM
   ============================================================ */
const hash2 = Fn(([p]) => {
  const h = vec2(
    dot(p, vec2(127.1, 311.7)),
    dot(p, vec2(269.5, 183.3))
  );
  return fract(sin(h).mul(43758.5453)).mul(2.0).sub(1.0);
});

const gradNoise = Fn(([p]) => {
  const i = floor(p);
  const f = fract(p);
  const u = f.mul(f).mul(f.mul(f.mul(6.0).sub(15.0)).add(10.0));
  const n00 = dot(hash2(i), f);
  const n10 = dot(hash2(i.add(vec2(1.0, 0.0))), f.sub(vec2(1.0, 0.0)));
  const n01 = dot(hash2(i.add(vec2(0.0, 1.0))), f.sub(vec2(0.0, 1.0)));
  const n11 = dot(hash2(i.add(vec2(1.0, 1.0))), f.sub(vec2(1.0, 1.0)));
  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
});

const fbm = Fn(([p]) =>
  gradNoise(p)
    .add(gradNoise(p.mul(2.04).add(vec2(17.3, 9.1))).mul(0.5))
    .add(gradNoise(p.mul(4.11).add(vec2(42.7, 28.6))).mul(0.25))
);

// animated capillary-scale detail height field
const detailHeight = Fn(([xz, time]) => {
  const driftA = vec2(time.mul(0.55), time.mul(0.32));
  const driftB = vec2(time.mul(-0.4), time.mul(0.5));
  return fbm(xz.mul(0.85).add(driftA)).add(fbm(xz.mul(2.1).add(driftB)).mul(0.45));
});

const skyColor = Fn(([rawDir]) => {
  const dir = normalize(rawDir).toVar();
  const up = clamp(dir.y, -0.15, 1.0);
  const sky = mix(horizonColorUniform, zenithColorUniform, pow(max(up, 0.0), 0.42)).toVar();

  const hazeColor = deepColorUniform.mul(1.4).add(horizonColorUniform.mul(0.25));
  sky.assign(mix(sky, hazeColor, smoothstep(-0.15, 0.0, dir.y).oneMinus()));

  const s = max(dot(dir, sunDirUniform), 0.0);
  sky.addAssign(sunColorUniform.mul(pow(s, 22.0)).mul(0.2));                 
  sky.addAssign(sunColorUniform.mul(smoothstep(0.9994, 0.9998, s)).mul(20.0)); 

  return sky;
});

/* ============================================================
   Create Open Sea NodeMaterial
   ============================================================ */
export const createOpenSeaMaterial = () => {
  const oceanMaterial = new THREE.MeshBasicNodeMaterial();
  oceanMaterial.transparent = true;
  oceanMaterial.side = THREE.DoubleSide;
  oceanMaterial.depthWrite = true;
  oceanMaterial.depthTest = true;
  oceanMaterial.polygonOffset = true;
  oceanMaterial.polygonOffsetFactor = 1.0;
  oceanMaterial.polygonOffsetUnits = 1.0;

  const scaledTime = timeUniform.mul(speedUniform);
  const gerstnerP = wavePosition(positionLocal.xz, scaledTime, seaUniform);
  oceanMaterial.positionNode = vec3(gerstnerP.x, gerstnerP.y, gerstnerP.z);

  oceanMaterial.colorNode = Fn(() => {
    const P = positionWorld.toVar();
    const xz = P.xz;
    const camDist = distance(cameraPosition, P).toVar();

    // Distance LOD factor: 1.0 up close (<250m), smoothly scales down towards distance
    const distLod = smoothstep(lodDistanceThresholdUniform, float(250.0), camDist);
    const effectiveLodFactor = mix(float(1.0), distLod, distanceLodUniform);
    const effectiveQuality = mix(float(0.55), float(1.0), qualityModeUniform);

    const n0 = waveNormal(xz, scaledTime, seaUniform);
    const crest = waveCrest(xz, scaledTime, seaUniform).toVar();

    const h0 = detailHeight(xz, scaledTime);
    const hx = detailHeight(xz.add(vec2(0.1, 0.0)), scaledTime);
    const hz = detailHeight(xz.add(vec2(0.0, 0.1)), scaledTime);

    const chopMask = fbm(xz.mul(0.045).add(vec2(scaledTime.mul(0.018), scaledTime.mul(-0.012)))).mul(0.5).add(0.5);
    const nonUniformChop = mix(float(0.35), float(1.65), chopMask.mul(chopPatchinessUniform));
    const crestChopMult = mix(float(0.55), float(1.45), smoothstep(-0.4, 1.1, crest));

    const effectiveDetail = float(1.5)
      .mul(seaUniform.mul(0.6).add(0.4))
      .mul(detailAmountUniform)
      .mul(effectiveLodFactor)
      .mul(effectiveQuality)
      .mul(nonUniformChop)
      .mul(crestChopMult);

    const detail = vec3(h0.sub(hx), 0.0, h0.sub(hz)).mul(effectiveDetail);
    const N = normalize(n0.add(detail)).toVar();

    const V = normalize(cameraPosition.sub(P)).toVar();

    const colorTurbulence = fbm(xz.mul(0.035).add(vec2(scaledTime.mul(0.015), scaledTime.mul(-0.01)))).mul(0.28).mul(effectiveLodFactor);
    const body = mix(
      deepColorUniform,
      shallowColorUniform,
      clamp(crest.mul(0.25).add(0.48).add(colorTurbulence), 0.0, 1.0)
    ).toVar();
    const sss = pow(max(dot(V, sunDirUniform), 0.0), 3.0).mul(max(crest, 0.0)).mul(0.18);
    body.addAssign(mix(shallowColorUniform, sunColorUniform, 0.5).mul(sss));

    const R = reflect(V.negate(), N).toVar();
    R.y.assign(max(R.y, 0.04));
    R.assign(normalize(R));

    const fresnel = float(0.02).add(
      float(0.98).mul(pow(max(dot(N, V), 0.0).oneMinus(), 5.0))
    );
    const color = mix(body, skyColor(R), fresnel).toVar();

    const H = normalize(sunDirUniform.add(V));
    const glitterNoise = fbm(xz.mul(2.1).add(vec2(scaledTime.mul(-0.4), scaledTime.mul(0.5))))
      .mul(0.5).add(0.5);
    const glitter = pow(max(dot(N, H), 0.0), 500.0).mul(mix(0.4, 3.4, glitterNoise));
    const sheen = pow(max(dot(N, H), 0.0), 48.0).mul(0.12);
    color.addAssign(sunColorUniform.mul(glitter.add(sheen)).mul(effectiveLodFactor.mul(0.6).add(0.4)));

    const foamNoise = fbm(xz.mul(1.1).add(vec2(scaledTime.mul(0.22), scaledTime.mul(0.14))))
      .mul(0.5).add(0.5);
    const foam = smoothstep(0.5, 0.95, foamNoise).mul(smoothstep(1.0, 2.0, crest)).mul(foamAmountUniform).mul(foamEnabledUniform).mul(foamDecayUniform);

    color.assign(mix(color, vec3(0.92, 0.96, 1.0), clamp(foam.mul(0.85), 0.0, 1.0)));

    // Atmospheric horizon concealment — pushed to far distance to preserve vibrant mid-range ocean
    color.assign(mix(color, horizonColorUniform, smoothstep(8000.0, 15500.0, camDist)));

    return vec4(color, waterOpacityUniform);
  })();

  return oceanMaterial;
};

/* ============================================================
   CPU Wave Physics — for real-time player/boat buoyancy
   ============================================================ */
export function getWaterHeightAt(rawX, rawZ, time, sea) {
  const x = rawX * oceanScaleUniform.value;
  const z = rawZ * oceanScaleUniform.value;
  const TWO_PI = Math.PI * 2.0;
  let y = 0;
  for (const w of WAVES) {
    const a = (w.steepness.value * sea * swellWavelengthUniform.value) / w.k.value;
    let f = w.k.value * (w.dx.value * x + w.dz.value * z - time * speedUniform.value * w.c.value) + w.phase.value;
    f = ((f % TWO_PI) + TWO_PI) % TWO_PI;
    y += a * Math.sin(f) * waveHeightUniform.value;
  }
  return y;
}

export function getWaterNormalAt(x, z, time, sea) {
  const eps = 0.15;
  const h0 = getWaterHeightAt(x, z, time, sea);
  const hx = getWaterHeightAt(x + eps, z, time, sea);
  const hz = getWaterHeightAt(x, z + eps, time, sea);
  const dx = (hx - h0) / eps;
  const dz = (hz - h0) / eps;
  return new THREE.Vector3(-dx, 1.0, -dz).normalize();
}
