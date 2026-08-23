/**
 * OpenSeaOcean_TestLab.js — Dedicated Water Movement Research & Testing Module
 *
 * ISOLATED COPY of the Wanderlust Ocean system specifically for experimenting with,
 * benchmarking, and fine-tuning 5 advanced wave movement algorithms extracted from
 * top ocean shaders:
 *
 * 1. Engine 0 (Baseline): Current Wanderlust 8-Wave Gerstner Swell + Domain Warp
 * 2. Engine 1 (TDM Seascape): Multi-Octave Matrix Choppy Wave Synthesis
 * 3. Engine 2 (Dave Hoskins Rough Seas): Turbulent Harmonic Rolling Swells
 * 4. Engine 3 (Trochoidal Sharp Gerstner): Peak-Pinched Trochoids with Horizontal Mass Drag
 * 5. Engine 4 (Directional Exponential): Exponential Trochoidal Waves with Directional Drift
 * 6. Engine 5 (Curling Wave Derivatives): Multi-Derivative Asymmetric Wind-Leaning Crests
 */

import * as THREE from 'three/webgpu';
import {
  Fn, uniform, float, vec2, vec3, vec4,
  sin, cos, atan, abs, dot, cross, normalize, length, mix, pow, max, min, clamp,
  fract, floor, smoothstep, distance, reflect,
  positionLocal, positionWorld, cameraPosition
} from 'three/tsl';

/* ============================================================
   Uniforms — Controlled live by Water Test Lab GUI
   ============================================================ */
export const activeEngineUniform = uniform(0); // 0=Baseline, 1=TDM, 2=Hoskins, 3=SharpGerstner, 4=ExpTrochoid, 5=CurlingDeriv

export const timeUniform = uniform(0.00001);
export const seaUniform = uniform(0.5);
export const speedUniform = uniform(1.0);
export const waveHeightUniform = uniform(1.2);
export const waveChoppinessUniform = uniform(3.5);
export const oceanScaleUniform = uniform(1.0);
export const swellWavelengthUniform = uniform(1.0);
export const windAngleUniform = uniform(45.0); // degrees
export const waveOctavesUniform = uniform(5); // 1-8 octaves

export const detailAmountUniform = uniform(1.0);
export const foamAmountUniform = uniform(1.0);
export const waterOpacityUniform = uniform(0.92);
export const foamThresholdUniform = uniform(0.65);

export const sunDirUniform = uniform(new THREE.Vector3(0.5, 0.7, 0.5).normalize());
export const sunColorUniform = uniform(new THREE.Color(1.0, 0.95, 0.85));
export const horizonColorUniform = uniform(new THREE.Color(0.52, 0.68, 0.82));
export const zenithColorUniform = uniform(new THREE.Color(0.07, 0.2, 0.42));
export const deepColorUniform = uniform(new THREE.Color(0.015, 0.09, 0.11));
export const shallowColorUniform = uniform(new THREE.Color(0.06, 0.32, 0.36));

/* ============================================================
   Common Math & Noise TSL Nodes
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

// Capillary detail noise
const detailHeight = Fn(([xz, time]) => {
  const driftA = vec2(time.mul(0.55), time.mul(0.32));
  const driftB = vec2(time.mul(-0.4), time.mul(0.5));
  return fbm(xz.mul(0.85).add(driftA)).add(fbm(xz.mul(2.1).add(driftB)).mul(0.45));
});

/* ============================================================
   ENGINE 0: Baseline Wanderlust 8-Component Gerstner Waves
   ============================================================ */
export const WAVES_BASELINE = [
  { dir: [0.95, 0.31], wavelength: 220.0, steepness: 0.18, phase: 0.0 },
  { dir: [0.82, 0.57], wavelength: 130.0, steepness: 0.22, phase: 1.1 },
  { dir: [0.25, 0.97], wavelength: 75.0, steepness: 0.16, phase: 2.4 },
  { dir: [-0.55, 0.84], wavelength: 45.0, steepness: 0.13, phase: 3.6 },
  { dir: [-0.72, 0.69], wavelength: 28.0, steepness: 0.10, phase: 4.8 },
  { dir: [0.68, -0.73], wavelength: 16.0, steepness: 0.07, phase: 5.3 },
  { dir: [-0.88, -0.47], wavelength: 9.0, steepness: 0.04, phase: 0.7 },
  { dir: [0.42, -0.91], wavelength: 5.5, steepness: 0.03, phase: 2.1 }
];

const wavePhaseBaseline = (w, xz, time) => {
  const len = Math.hypot(w.dir[0], w.dir[1]) || 1.0;
  const k = (2 * Math.PI) / w.wavelength;
  const c = Math.sqrt(9.8 * k);
  const dir = vec2(w.dir[0] / len, w.dir[1] / len);
  return float(k).mul(dot(dir, xz).sub(time.mul(c))).add(w.phase);
};

const waveEngine0_Baseline = Fn(([localXz, time]) => {
  const worldXz = localXz.add(cameraPosition.xz).mul(oceanScaleUniform);
  const p = vec3(localXz.x, float(0.0), localXz.y).toVar();

  for (const w of WAVES_BASELINE) {
    const k = (2 * Math.PI) / w.wavelength;
    const len = Math.hypot(w.dir[0], w.dir[1]) || 1.0;
    const dx = w.dir[0] / len;
    const dz = w.dir[1] / len;
    const a = float(w.steepness).mul(seaUniform).div(k).mul(swellWavelengthUniform).mul(waveHeightUniform);
    const f = wavePhaseBaseline(w, worldXz, time);
    p.x.addAssign(a.mul(dx).mul(cos(f)).mul(0.35));
    p.y.addAssign(a.mul(sin(f)));
    p.z.addAssign(a.mul(dz).mul(cos(f)).mul(0.35));
  }
  return p;
});

/* ============================================================
   ENGINE 1: TDM Seascape Multi-Octave Matrix Choppy Waves
   Extracted from: "Seascape" (Alexander Alekseev / TDM)
   ============================================================ */
const seaOctaveTDM = Fn(([uv, choppy]) => {
  const n = gradNoise(uv);
  const p = uv.add(n);
  const wv = float(1.0).sub(abs(sin(p)));
  const swv = abs(cos(p));
  const blended = mix(wv, swv, wv);
  const shape = float(1.0).sub(pow(clamp(blended.x.mul(blended.y), float(0.0), float(1.0)), float(0.65)));
  return pow(clamp(shape, float(0.0), float(1.0)), choppy);
});

const waveEngine1_TDMSeascape = Fn(([localXz, time]) => {
  const worldXz = localXz.add(cameraPosition.xz).mul(oceanScaleUniform).mul(0.025);
  const p = vec3(localXz.x, float(0.0), localXz.y).toVar();

  const seaTime = time.mul(0.8).mul(speedUniform);
  const freq = float(0.16).mul(swellWavelengthUniform);
  const amp = float(1.8).mul(waveHeightUniform).mul(seaUniform);
  const choppy = waveChoppinessUniform;

  const uv = worldXz.toVar();
  uv.x.mulAssign(0.75);

  const totalH = float(0.0).toVar();
  const curFreq = freq.toVar();
  const curAmp = amp.toVar();
  const curChoppy = choppy.toVar();

  // Matrix rotation per octave: mat2(1.6, 1.2, -1.2, 1.6)
  for (let i = 0; i < 6; i++) {
    const d1 = seaOctaveTDM(uv.add(seaTime).mul(curFreq), curChoppy);
    const d2 = seaOctaveTDM(uv.sub(seaTime).mul(curFreq), curChoppy);
    totalH.addAssign(d1.add(d2).mul(curAmp));

    // Matrix domain rotation: uv = mat2 * uv
    const nextUvX = uv.x.mul(1.6).add(uv.y.mul(1.2));
    const nextUvY = uv.x.mul(-1.2).add(uv.y.mul(1.6));
    uv.x.assign(nextUvX);
    uv.y.assign(nextUvY);

    curFreq.mulAssign(1.85);
    curAmp.mulAssign(0.24);
    curChoppy.assign(mix(curChoppy, float(1.0), float(0.2)));
  }

  // Horizontal crest compression
  const gradX = sin(worldXz.x.mul(0.2).add(seaTime)).mul(0.4);
  const gradZ = cos(worldXz.y.mul(0.2).add(seaTime)).mul(0.4);
  p.x.addAssign(gradX.mul(waveHeightUniform));
  p.y.assign(totalH);
  p.z.addAssign(gradZ.mul(waveHeightUniform));

  return p;
});

/* ============================================================
   ENGINE 2: Dave Hoskins' Rough Seas Turbulent Wave Swell
   Extracted from: "Rough Seas" (David Hoskins)
   ============================================================ */
const waveEngine2_DaveHoskins = Fn(([localXz, time]) => {
  const worldXz = localXz.add(cameraPosition.xz).mul(oceanScaleUniform).mul(0.015);
  const p = vec3(localXz.x, float(0.0), localXz.y).toVar();

  const tim = time.mul(0.6).mul(speedUniform);
  const h = float(0.0).toVar();
  const a = float(2.4).mul(waveHeightUniform).mul(seaUniform).toVar();

  const uv = worldXz.toVar();
  uv.x.subAssign(tim.mul(2.0));

  // 2D Rotation: cos(0.43), sin(0.52)
  const cosR = float(0.9089);
  const sinR = float(0.4969);

  for (let i = 0; i < 6; i++) {
    const t = float(1.08 - i * 0.16).mul(tim);
    const r = gradNoise(uv.mul(2.1).add(t)).mul(float(i * 0.18));
    
    const y1 = cos(uv.x.sub(t)).add(1.0);
    const y2 = float(1.0).sub(abs(sin(uv.x.sub(t))));
    const s = mix(y1, y2, clamp(r, 0.0, 1.0));
    
    const y1z = cos(uv.y.sub(t)).add(1.0);
    const y2z = float(1.0).sub(abs(sin(uv.y.sub(t))));
    const sz = mix(y1z, y2z, clamp(r, 0.0, 1.0));

    h.addAssign(s.add(sz).mul(a));
    a.mulAssign(0.58);

    // Rotate domain
    const rotX = uv.x.mul(cosR).add(uv.y.mul(sinR)).mul(1.38);
    const rotY = uv.x.mul(-sinR).add(uv.y.mul(cosR)).mul(1.38);
    uv.x.assign(rotX.add(19.9));
    uv.y.assign(rotY.add(19.9));
  }

  p.y.assign(h.sub(2.0));
  return p;
});

/* ============================================================
   ENGINE 3: Sharp Trochoidal Gerstner Waves with Peak Drag
   Extracted from: Gerstner Sharp Wave Model (#define PI...)
   ============================================================ */
const waveEngine3_SharpGerstner = Fn(([localXz, time]) => {
  const worldXz = localXz.add(cameraPosition.xz).mul(oceanScaleUniform);
  const p = vec3(localXz.x, float(0.0), localXz.y).toVar();

  const angles = [0.35, 1.12, 2.45, 3.89, 5.02, 0.78];
  const wavelengths = [180.0, 95.0, 52.0, 26.0, 13.0, 6.5];
  const amps = [1.2, 0.75, 0.45, 0.25, 0.12, 0.06];

  for (let i = 0; i < 6; i++) {
    const angle = angles[i];
    const wl = wavelengths[i] * swellWavelengthUniform.value;
    const k = (2.0 * Math.PI) / wl;
    const speed = Math.sqrt(9.8 * k) * 0.7;
    const dir = vec2(Math.cos(angle), Math.sin(angle));
    const amp = amps[i] * waveHeightUniform.value * seaUniform.value;

    const phase = float(speed).mul(time).mul(speedUniform);
    const f = float(k).mul(dot(dir, worldXz)).add(phase);

    const s = sin(f);
    const c = cos(f);

    // Peak pinched shape: sign(s) * |s|^sharpness
    const sharpness = waveChoppinessUniform.mul(0.35).add(1.0);
    const waveShape = mix(s, pow(abs(s), sharpness), float(0.5)).mul(float(amp));

    // Horizontal mass drag pulls vertices towards wave crests
    const drag = float(amp * 0.4).mul(c);
    p.x.addAssign(dir.x.mul(drag));
    p.y.addAssign(waveShape);
    p.z.addAssign(dir.y.mul(drag));
  }

  return p;
});

/* ============================================================
   ENGINE 4: Directional Exponential Waves with Horizontal Drag
   Extracted from: Untitled.txt (Fast Raymarched Ocean Waves)
   ============================================================ */
const waveEngine4_ExpTrochoid = Fn(([localXz, time]) => {
  const worldXz = localXz.add(cameraPosition.xz).mul(oceanScaleUniform).mul(0.02);
  const p = vec3(localXz.x, float(0.0), localXz.y).toVar();

  const pos = worldXz.toVar();
  const h = float(0.0).toVar();
  const iterAmp = float(1.4).mul(waveHeightUniform).mul(seaUniform).toVar();
  const iterFreq = float(1.0).mul(swellWavelengthUniform).toVar();
  const speed = float(0.7).mul(speedUniform);

  const dragMult = float(0.048).mul(waveChoppinessUniform.mul(0.2));

  for (let i = 0; i < 6; i++) {
    const angle = float(i * 1.25);
    const dir = vec2(cos(angle), sin(angle));

    const x = dot(dir, pos).mul(iterFreq).add(time.mul(speed));
    const wave = exp(sin(x).sub(1.0));
    const dx = wave.mul(cos(x));

    h.addAssign(wave.mul(iterAmp));

    // Drag domain coordinates along wave propagation direction
    pos.x.addAssign(dir.x.mul(dx).mul(dragMult));
    pos.y.addAssign(dir.y.mul(dx).mul(dragMult));

    iterAmp.mulAssign(0.55);
    iterFreq.mulAssign(1.85);
  }

  p.y.assign(h.sub(1.5));
  return p;
});

/* ============================================================
   ENGINE 5: Multi-Derivative Curling Wave Model
   Extracted from: float random (vec2 uv){.txt
   ============================================================ */
const waveEngine5_CurlingDerivatives = Fn(([localXz, time]) => {
  const worldXz = localXz.add(cameraPosition.xz).mul(oceanScaleUniform).mul(0.03);
  const p = vec3(localXz.x, float(0.0), localXz.y).toVar();

  const timeScale = time.mul(1.5).mul(speedUniform);
  const lacunarity = float(1.35);
  const freq = float(0.6).mul(swellWavelengthUniform).toVar();
  const amp = float(1.2).mul(waveHeightUniform).mul(seaUniform).toVar();
  const gain = float(0.65);

  const sum = float(0.0).toVar();
  const derivative = vec2(0.0, 0.0).toVar();

  for (let i = 0; i < 6; i++) {
    const angle = float(i * 0.95);
    const direction = normalize(vec2(cos(angle), sin(angle)));

    const dotP = dot(direction, worldXz.add(derivative));
    const waveExp = exp(sin(dotP.mul(freq).add(timeScale)).sub(0.8));
    const wave = amp.mul(waveExp.sub(0.2));

    const lastD = freq.mul(amp).mul(waveExp).mul(direction).mul(cos(dotP.mul(freq).add(timeScale)));
    derivative.addAssign(lastD.mul(0.35));

    freq.mulAssign(lacunarity);
    amp.mulAssign(gain);
    sum.addAssign(wave);
  }

  // Leaning crest vertex shift in the wind direction
  p.x.addAssign(derivative.x.mul(0.5));
  p.y.assign(sum.sub(1.2));
  p.z.addAssign(derivative.y.mul(0.5));

  return p;
});

/* ============================================================
   Master Multiplexer — Selects Wave Position dynamically
   ============================================================ */
export const wavePositionLab = Fn(([localXz, time]) => {
  const p0 = waveEngine0_Baseline(localXz, time);
  const p1 = waveEngine1_TDMSeascape(localXz, time);
  const p2 = waveEngine2_DaveHoskins(localXz, time);
  const p3 = waveEngine3_SharpGerstner(localXz, time);
  const p4 = waveEngine4_ExpTrochoid(localXz, time);
  const p5 = waveEngine5_CurlingDerivatives(localXz, time);

  // Switch based on activeEngineUniform
  const is0 = activeEngineUniform.equal(0);
  const is1 = activeEngineUniform.equal(1);
  const is2 = activeEngineUniform.equal(2);
  const is3 = activeEngineUniform.equal(3);
  const is4 = activeEngineUniform.equal(4);

  const res = mix(
    p5,
    mix(
      p4,
      mix(
        p3,
        mix(
          p2,
          mix(p0, p1, is1),
          is2
        ),
        is3
      ),
      is4
    ),
    is0.or(is1).or(is2).or(is3).or(is4)
  );

  return res;
});

/* ============================================================
   Finite Difference Normal Estimation for Any Wave Engine
   ============================================================ */
export const waveNormalLab = Fn(([rawXz, time]) => {
  const eps = float(0.25);
  const pCenter = wavePositionLab(rawXz, time);
  const pRight = wavePositionLab(rawXz.add(vec2(eps, float(0.0))), time);
  const pForward = wavePositionLab(rawXz.add(vec2(float(0.0), eps)), time);

  const tangent = pRight.sub(pCenter);
  const binormal = pForward.sub(pCenter);
  return normalize(cross(binormal, tangent));
});

/* ============================================================
   Create Ocean Test Lab Material
   ============================================================ */
export const createOceanTestLabMaterial = () => {
  const mat = new THREE.MeshBasicNodeMaterial();
  mat.transparent = true;
  mat.side = THREE.DoubleSide;

  const scaledTime = timeUniform.mul(speedUniform);

  // Dynamic vertex displacement
  const displacedP = wavePositionLab(positionLocal.xz, scaledTime);
  mat.positionNode = vec3(displacedP.x, displacedP.y, displacedP.z);

  // Shading & Lighting
  mat.colorNode = Fn(() => {
    const P = positionWorld.toVar();
    const xz = P.xz;

    const N = waveNormalLab(positionLocal.xz, scaledTime).toVar();
    const V = normalize(cameraPosition.sub(P)).toVar();

    // Micro capillary detail
    const h0 = detailHeight(xz, scaledTime);
    const hx = detailHeight(xz.add(vec2(0.1, 0.0)), scaledTime);
    const hz = detailHeight(xz.add(vec2(0.0, 0.1)), scaledTime);
    const microDetail = vec3(h0.sub(hx), 0.0, h0.sub(hz)).mul(detailAmountUniform).mul(1.2);
    const finalN = normalize(N.add(microDetail)).toVar();

    // Sun specular highlight
    const R = reflect(V.negate(), finalN);
    const specAngle = max(dot(R, sunDirUniform), 0.0);
    const sunSpec = pow(specAngle, float(64.0)).mul(sunColorUniform).mul(2.2);

    // Fresnel reflection
    const fresnel = pow(float(1.0).sub(max(dot(V, finalN), 0.0)), float(4.0)).mul(0.75);

    // Water Body Color (Deep -> Shallow based on wave height)
    const heightFactor = clamp(P.y.mul(0.25).add(0.5), 0.0, 1.0);
    const waterColor = mix(deepColorUniform, shallowColorUniform, heightFactor).toVar();

    // Sky reflection
    const skyReflect = mix(horizonColorUniform, zenithColorUniform, max(R.y, 0.0));
    waterColor.assign(mix(waterColor, skyReflect, fresnel));

    // Foam at wave crests
    const foamMask = smoothstep(foamThresholdUniform, float(1.2), P.y.mul(0.35).add(h0.mul(0.2)));
    const foamColor = vec3(0.95, 0.98, 1.0);
    waterColor.assign(mix(waterColor, foamColor, foamMask.mul(foamAmountUniform)));

    // Add specular
    waterColor.addAssign(sunSpec);

    return vec4(waterColor, waterOpacityUniform);
  })();

  return mat;
};

/* ============================================================
   CPU Wave Height Sampler for Buoyancy Physics in Test Lab
   ============================================================ */
export function sampleWaveHeightCPU(x, z, time, engineIndex = 0) {
  // Baseline Gerstner
  if (engineIndex === 0) {
    let y = 0;
    for (const w of WAVES_BASELINE) {
      const len = Math.hypot(w.dir[0], w.dir[1]) || 1.0;
      const k = (2 * Math.PI) / (w.wavelength * swellWavelengthUniform.value);
      const c = Math.sqrt(9.8 * k);
      const a = (w.steepness * seaUniform.value * waveHeightUniform.value) / k;
      const phase = k * ((w.dir[0] / len) * x + (w.dir[1] / len) * z - time * c * speedUniform.value) + w.phase;
      y += a * Math.sin(phase);
    }
    return y;
  }
  // TDM Choppy
  else if (engineIndex === 1) {
    const t = time * 0.8 * speedUniform.value;
    let totalH = 0;
    let freq = 0.16 * swellWavelengthUniform.value * 0.025;
    let amp = 1.8 * waveHeightUniform.value * seaUniform.value;
    let ux = x * 0.75;
    let uz = z;
    for (let i = 0; i < 4; i++) {
      const s1 = Math.sin((ux + t) * freq);
      const s2 = Math.sin((ux - t) * freq);
      totalH += (s1 + s2) * amp * 0.5;
      const nX = ux * 1.6 + uz * 1.2;
      const nY = -ux * 1.2 + uz * 1.6;
      ux = nX; uz = nY;
      freq *= 1.85;
      amp *= 0.25;
    }
    return totalH;
  }
  // Fallback rough estimate
  return Math.sin(x * 0.05 + time * 2.0) * waveHeightUniform.value * 0.8;
}
