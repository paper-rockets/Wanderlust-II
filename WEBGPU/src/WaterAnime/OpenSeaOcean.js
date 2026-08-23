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
  sin, cos, atan, abs, dot, cross, normalize, length, mix, pow, max, min, clamp,
  fract, floor, smoothstep, distance, reflect, step, exp, dFdx, dFdy,
  positionLocal, positionWorld, cameraPosition, texture
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
// Gerstner horizontal displacement (Q). Was hardcoded to 0.35, which put the effective Q*ka at
// ~3% of the value where a crest begins to sharpen -- so the surface was a pure sinusoid, and
// waveNormal shaded it as if Q were 1.0. Now a real uniform, and both paths use it.
// Trochoidal sharpening. Crest pinching is governed by the SUM of Q*a*k over all geometry
// waves; at 1.0 the crest becomes a cusp and beyond that the surface self-intersects.
//
// The per-wave a*k is `steepness * sea`, and the default sea state is 0.45 -- so the authored
// spectrum only sums to 0.126, not the 0.28 the steepness column suggests. Q = 0.75 therefore
// put the surface at 0.095 of a cusp: a pure rolling sinusoid, which is what "soft rounded
// mounds" was. Q = 4.5 lands at 0.567, which is visibly trochoidal with a comfortable margin.
// Measured, not guessed -- see the sweep in the session notes.
export const chopStrengthUniform = uniform(4.5);
// Stokes second-order term. Adds -0.5*k*a^2*cos(2f) to the elevation, which lifts the trough
// and pinches the peak WITHOUT changing wave height or the mean water level.
export const crestSharpnessUniform = uniform(0.8);
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

/* ------------------------------------------------------------------
   Micro-surface / specular filtering
   ------------------------------------------------------------------ */
// How aggressively sub-pixel normal detail is converted into roughness instead of being
// point-sampled. 0 = old behaviour (aliased sparkle), 1 = fully filtered.
export const microRoughnessUniform = uniform(1.0);
export const sparkleUniform        = uniform(1.0);   // specular gain multiplier
export const fresnelRoughUniform   = uniform(1.0);   // roughness suppression of grazing mirror

/* ------------------------------------------------------------------
   Whitecap foam driven by the displacement Jacobian
   ------------------------------------------------------------------ */
// J = det(d(displaced xz)/d(parametric xz)). J == 1 on flat water, falls towards 0 as a crest
// steepens and goes negative where the surface folds. Foam starts below this threshold.
//
// This has to be calibrated against the ACTUAL minimum J the spectrum reaches, or no foam ever
// appears. At the default sea state and Q = 4.5 the surface bottoms out at J ~ 0.49, so 0.66
// puts whitecaps on roughly the steepest 6% of the water -- about right for a moderate sea.
// It is deliberately absolute rather than relative: raise the sea state and more of the ocean
// breaks, which is what should happen.
export const foamJacobianUniform   = uniform(0.66);
export const foamTrailUniform      = uniform(1.0);   // length of the trailing wake behind a break
export const foamStreakUniform     = uniform(1.0);   // anisotropy of the foam texture

/* ------------------------------------------------------------------
   Subsurface scattering / light transmission through a crest
   ------------------------------------------------------------------ */
export const sssColorUniform      = uniform(new THREE.Color(0.10, 0.62, 0.55));
export const sssStrengthUniform   = uniform(1.35);
export const sssPowerUniform      = uniform(4.5);
export const sssDistortionUniform = uniform(0.45);

/* ------------------------------------------------------------------
   Beer-Lambert extinction + aerial perspective
   ------------------------------------------------------------------ */
// Per-metre absorption. Red is extinguished ~5x faster than blue, which is the entire reason
// shallow water reads turquoise and deep water reads blue. Calibrated so that at the default
// 6 m shore depth the bottom has essentially stopped contributing.
export const extinctionUniform      = uniform(new THREE.Vector3(0.75, 0.30, 0.16));
export const bottomBrightnessUniform = uniform(1.0);
export const inScatterUniform        = uniform(0.55);
export const aerialStrengthUniform   = uniform(0.85);
export const aerialDistanceUniform   = uniform(7000.0);

/* ============================================================
   Shoreline Depth Field — CPU-baked terrain height texture
   (Phase 1 infrastructure. Populated by WaterAnime/TerrainDepthField.js
    via WaterSystem; consumed by the shore shading in colorNode.)

   Sampling contract for the shore shading pass:
     const fieldUv = positionWorld.xz.sub(depthFieldOriginUniform).div(depthFieldSizeUniform);
     const terrainH = terrainDepthTexNode.sample(fieldUv).r;
     const depth    = waterLevelUniform.sub(terrainH);
   `terrainDepthTexNode` is a stable node created at module load, so the
   graph can never capture null. Its bound DataTexture is swapped in by
   setTerrainDepthTexture() before createOpenSeaMaterial() runs.
   Out of bounds the texture clamps to edge, so also mask on fieldUv
   being inside 0..1 and on depthFieldValidUniform before applying shore FX.
   Until the first bake completes every texel reads DEPTH_FIELD_SENTINEL
   (-1000.0) => "very deep", so all shore effects fall away naturally.
   ============================================================ */

// Sentinel height written into unbaked texels. Anything at/below this is "no data".
export const DEPTH_FIELD_SENTINEL = -1000.0;

// 1x1 placeholder so the TSL graph always has a valid, correctly-formatted
// texture bound. Must match the real field's format/type/filters/wrapping so
// the generated WGSL is identical when the real texture is swapped in.
const _depthFieldPlaceholder = new THREE.DataTexture(
  new Float32Array([DEPTH_FIELD_SENTINEL]), 1, 1, THREE.RedFormat, THREE.FloatType
);
_depthFieldPlaceholder.minFilter = THREE.LinearFilter;
_depthFieldPlaceholder.magFilter = THREE.LinearFilter;
_depthFieldPlaceholder.wrapS = THREE.ClampToEdgeWrapping;
_depthFieldPlaceholder.wrapT = THREE.ClampToEdgeWrapping;
_depthFieldPlaceholder.generateMipmaps = false;
_depthFieldPlaceholder.flipY = false;
_depthFieldPlaceholder.unpackAlignment = 1;
_depthFieldPlaceholder.needsUpdate = true;

// Stable texture node. Never reassigned - only its bound texture value changes,
// which THREE.NodeSampledTexture.update() picks up automatically each frame.
export const terrainDepthTexNode = texture(_depthFieldPlaceholder);
// Alias under the name used in WATER_SHORE_PLAN.md; same node object.
export const terrainDepthTexUniform = terrainDepthTexNode;

// Separate node for the VERTEX stage. The vertex shader has no implicit derivatives, so it
// must sample with an explicit LOD; keeping that on its own node avoids forcing the fragment
// path to do the same. Both nodes are rebound together by setTerrainDepthTexture().
export const terrainDepthTexNodeVS = texture(_depthFieldPlaceholder);

/**
 * Binds the baked terrain-height DataTexture to the shared depth-field node.
 * Call this BEFORE createOpenSeaMaterial() so the graph is built against the
 * real texture (a later call still works - the binding is refreshed per frame).
 * @param {THREE.DataTexture} tex
 */
export function setTerrainDepthTexture(tex) {
  if (!tex) return;
  terrainDepthTexNode.value = tex;
  terrainDepthTexNodeVS.value = tex;
}

export const depthFieldOriginUniform  = uniform(new THREE.Vector2(0, 0));
export const depthFieldSizeUniform    = uniform(4000.0);
export const depthFieldValidUniform   = uniform(0.0);   // 0 until the first bake completes
export const waterLevelUniform        = uniform(2.4);   // mirrors openSeaMesh.position.y

export const sandColorUniform         = uniform(new THREE.Color(0.85, 0.80, 0.62));
export const shoreShallowColorUniform = uniform(new THREE.Color(0.32, 0.72, 0.70));
export const shoreDepthUniform        = uniform(6.0);
export const shoreOpacityUniform      = uniform(0.10);
export const shoreFoamWidthUniform    = uniform(2.2);
export const shoreFoamSpeedUniform    = uniform(0.8);
export const shoreFoamStrengthUniform = uniform(1.0);
export const shoreRefractionUniform   = uniform(0.35);

/* ============================================================
   Gerstner Swell — 5 Multi-directional Spectral Components
   ============================================================ */
export let WAVE_PARAMS = [
  // Re-authored 2026-08-21. The previous spectrum (160/88/42/20/9.5 m) put THREE of five
  // components below the Nyquist limit of the 31.25 m vertex grid. Sub-Nyquist waves do not
  // disappear -- they fold back into large coherent ridge families (the 20 m chop aliased into
  // a 139 m ridge train at 7.1 deg, almost exactly along the Z grid axis). That was the
  // corduroy. See WATER_DIAGNOSIS.md part 1.1.
  //
  // Now: the three longest waves carry the geometry (4.5-10.9 samples per wavelength), and
  // everything shorter contributes to the NORMAL only, where there is no vertex grid to alias
  // against. Ridge axes are spread with a 17 deg minimum separation (was 9 deg, which produced
  // near-parallel reinforcing doublets).
  { dir: [ 0.927,  0.375], wavelength: 340.0, steepness: 0.100, phase: 0.0 },  // primary swell
  { dir: [ 0.454,  0.891], wavelength: 215.0, steepness: 0.090, phase: 1.4 },  // secondary swell
  { dir: [ 0.998,  0.070], wavelength: 141.0, steepness: 0.075, phase: 2.8 },  // tertiary swell
  { dir: [-0.087,  0.996], wavelength:  83.0, steepness: 0.060, phase: 4.1 },  // wind wave (partial geo)
  { dir: [-0.743,  0.669], wavelength:  44.0, steepness: 0.050, phase: 5.5 },  // chop (normals only)
  { dir: [-0.906,  0.423], wavelength:  19.0, steepness: 0.038, phase: 2.1 }   // fine chop (normals only)
];

// Vertex spacing of the ocean mesh (16000 / 512). Anything shorter than ~4x this cannot be
// represented in geometry without aliasing.
export const OCEAN_VERTEX_SPACING = 16000.0 / 512.0;   // 31.25 m

const _smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * How much of a wave may be expressed in GEOMETRY.
 * 0 below the Nyquist wavelength, ramping to 1 at 4x the vertex spacing.
 * Waves below the cut still shade (via waveNormal) -- they just stop aliasing the mesh.
 */
export function geometryWeightFor(wavelength) {
  return _smoothstep(2.0 * OCEAN_VERTEX_SPACING, 4.0 * OCEAN_VERTEX_SPACING, wavelength);
}

/**
 * Deep-water phase speed. c = sqrt(g / k), NOT sqrt(g * k).
 *
 * The original code used sqrt(9.8 * k), which is exactly g / c_true -- an INVERTED dispersion
 * relation. It made the 340 m swell travel at 0.62 m/s with a 258 second period, i.e. a still
 * image. This one-line error was the whole of "the water doesn't move".
 */
function phaseSpeedFor(k) {
  return Math.sqrt(9.8 / k);
}

export let WAVES = WAVE_PARAMS.map(({ dir, wavelength, steepness, phase }) => {
  const len = Math.hypot(dir[0], dir[1]) || 1.0;
  const k = (2 * Math.PI) / wavelength;
  return {
    dx: uniform(dir[0] / len),
    dz: uniform(dir[1] / len),
    k: uniform(k),
    c: uniform(phaseSpeedFor(k)),
    steepness: uniform(steepness),
    phase: uniform(phase || 0.00001),
    geo: uniform(geometryWeightFor(wavelength)),
    // The Stokes harmonic has HALF the wavelength, so it needs its own Nyquist gate or the
    // crest-sharpening term would itself alias into the ridges we just removed.
    geo2: uniform(geometryWeightFor(wavelength * 0.5))
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
  w.c.value = phaseSpeedFor(k);
  w.steepness.value = p.steepness;
  w.phase.value = p.phase;
  w.geo.value = geometryWeightFor(p.wavelength);
  w.geo2.value = geometryWeightFor(p.wavelength * 0.5);
}

export function randomizeSeaSpectrum() {
  // Previously produced exactly TWO direction clusters and three sub-Nyquist wavelengths.
  // Now: golden-angle direction spread (never clusters) and a wavelength ladder whose top
  // three entries always stay above the geometry cut.
  const base = Math.random() * Math.PI * 2;
  const ladder = [340, 215, 141, 83, 44, 19];
  for (let i = 0; i < WAVES.length; i++) {
    const angle = base + i * 2.39996323 + (Math.random() - 0.5) * 0.35;  // golden angle
    const wavelength = (ladder[i] !== undefined ? ladder[i] : 19) * (0.88 + Math.random() * 0.24);
    const steepness = 0.10 * Math.pow(0.86, i) * (0.85 + Math.random() * 0.3);

    WAVE_PARAMS[i] = {
      dir: [Math.cos(angle), Math.sin(angle)],
      wavelength: Math.max(wavelength, 8.0),
      steepness: Math.max(steepness, 0.01),
      phase: Math.random() * Math.PI * 2
    };
    updateWaveUniforms(i);
  }
}

export function setWindDirection(angleDeg, spreadPercent = 45) {
  // The old version packed all components into a narrow fan with wave 0 exactly on the wind
  // axis -- maximal corduroy, and it permanently discarded the authored directions.
  //
  // Real wind seas ARE directional, but the long swell should stay closest to the wind axis
  // while short chop fans out widest, and no two components should end up near-parallel.
  // Offsets alternate sign and grow with index, scaled to a full +/-75 deg at 100% spread.
  const mainAngleRad = (angleDeg * Math.PI) / 180;
  const spreadFactor = Math.max(0, Math.min(1.5, spreadPercent / 100.0));
  const FAN = [0.10, -0.34, 0.58, -0.82, 1.06, -1.30];   // radians at spread = 1.0
  WAVES.forEach((w, i) => {
    const finalAngle = mainAngleRad + (FAN[i % FAN.length] * spreadFactor);
    WAVE_PARAMS[i].dir[0] = Math.cos(finalAngle);
    WAVE_PARAMS[i].dir[1] = Math.sin(finalAngle);
    w.dx.value = Math.cos(finalAngle);
    w.dz.value = Math.sin(finalAngle);
  });
}

// phase: f = k * (dot(direction, xz) - time * c) + phase
const wavePhase = (w, xz, time) =>
  w.k.mul(dot(vec2(w.dx, w.dz), xz).sub(time.mul(w.c))).add(w.phase);

// displaced surface point for a given parametric xz (sampled in world space for true physical waves)
const wavePosition = Fn(([localXz, time, sea, shallowFade]) => {
  const worldXz = localXz.add(cameraPosition.xz);
  const xz = worldXz.mul(oceanScaleUniform).toVar();
  const p = vec3(localXz.x, float(0.0), localXz.y).toVar();
  for (const w of WAVES) {
    // w.geo is 0 for wavelengths the vertex grid cannot represent. Those waves still shade
    // (waveNormal uses them at full strength) but no longer alias the mesh into ridges.
    const a = w.steepness.mul(sea).div(w.k)
      .mul(swellWavelengthUniform).mul(waveHeightUniform)
      .mul(w.geo).mul(shallowFade);
    const f = wavePhase(w, xz, time);
    const q = chopStrengthUniform;
    // Stokes 2nd order: eta = a*sin(f) - 0.5*k*a^2*cos(2f). At the crest (f = pi/2) the second
    // term is +0.5*k*a^2 and at the trough it is -0.5*k*a^2, so the peak sharpens and the
    // trough flattens while the mean stays at zero. Gated by geo2 -- the harmonic is half the
    // wavelength and must clear Nyquist in its own right.
    const pinch = a.mul(a).mul(w.k).mul(0.5).mul(cos(f.mul(2.0)))
      .mul(crestSharpnessUniform).mul(w.geo2);
    p.x.addAssign(a.mul(w.dx).mul(cos(f)).mul(q));
    p.y.addAssign(a.mul(sin(f)).sub(pinch));
    p.z.addAssign(a.mul(w.dz).mul(cos(f)).mul(q));
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

// Analytic tangent/binormal derivatives — stable broad normals.
// Returns vec4(normal.xyz, lostSlopeVariance). The w channel is the slope energy that was
// deliberately faded out by `sharpness`; the shading pass turns it back into ROUGHNESS instead
// of letting it vanish, which is what stops the specular from sparkling at distance.
const waveNormal = Fn(([rawXz, time, sea, sharpness]) => {
  const xz = rawXz.mul(oceanScaleUniform).toVar();
  const tangent = vec3(1.0, 0.0, 0.0).toVar();
  const binormal = vec3(0.0, 0.0, 1.0).toVar();
  const lostVar = float(0.0).toVar();
  for (const w of WAVES) {
    // Now includes swellWavelengthUniform and the real chop strength, so the shading finally
    // describes the surface that is actually being displaced.
    //
    // `sharpness` fades the SHORT waves out with distance. Their normal contribution is what
    // aliases per-pixel into static once a pixel covers more water than a wavelength; the long
    // swell (w.geo == 1) is left untouched so the horizon keeps its shape.
    const shortFade = mix(sharpness, float(1.0), w.geo);

    // a*k for this component -- the VERTICAL rise per unit distance travelled.
    const akFull = w.steepness.mul(sea).mul(waveHeightUniform).mul(swellWavelengthUniform);
    const ak = akFull.mul(shortFade);

    // Q*a*k -- the HORIZONTAL compression. Differentiating the Gerstner map
    //   P = (x + SUM Q*a*d.x*cos f,  SUM a*sin f,  z + SUM Q*a*d.z*cos f)
    // gives dP/dx = (1 - SUM Q*a*k*d.x^2*sin f,  SUM a*k*d.x*cos f,  -SUM Q*a*k*d.x*d.z*sin f).
    // Q appears on the horizontal components ONLY. The vertical term carries a*k alone --
    // chop drags the surface sideways, it does not make the wave taller.
    //
    // Applying Q to the vertical term too tilted the shading normal by 13 deg mean / 34 deg max
    // where the real geometry tilts 2.5 / 7.7. At the old Q = 0.75 that was a harmless 25%
    // undershoot; at Q = 4.5 it became a 4.5x OVERSHOOT, and a narrow specular lobe riding
    // those normals drew long bright lines along every crest.
    const qk = ak.mul(chopStrengthUniform);

    // Slope energy removed by shortFade. Variance of a sinusoidal slope of amplitude A is
    // A^2/2, so accumulate the squared difference and halve it.
    const lost = akFull.sub(ak);
    lostVar.addAssign(lost.mul(lost).mul(0.5));

    const f = wavePhase(w, xz, time);
    const s = sin(f);
    const co = cos(f);
    tangent.x.subAssign(qk.mul(w.dx.mul(w.dx)).mul(s));
    tangent.y.addAssign(ak.mul(w.dx).mul(co));
    tangent.z.subAssign(qk.mul(w.dx.mul(w.dz)).mul(s));
    binormal.x.subAssign(qk.mul(w.dx.mul(w.dz)).mul(s));
    binormal.y.addAssign(ak.mul(w.dz).mul(co));
    binormal.z.subAssign(qk.mul(w.dz.mul(w.dz)).mul(s));
  }
  return vec4(normalize(cross(binormal, tangent)), lostVar);
});

/**
 * One pass over the spectrum returning everything the shading needs from the swell:
 *   .x  signed crest height (m)          -> tint, subsurface, surf run-up
 *   .y  displacement Jacobian determinant -> whitecaps
 *   .zw horizontal orbital offset (m)     -> advects the micro-detail with the wave
 *
 * The Jacobian is the real whitecap criterion. For a Gerstner sum the horizontal map is
 *   x' = x + Q*SUM(a*dx*cos f),   z' = z + Q*SUM(a*dz*cos f)
 * so with g = Q*a*k (== Q * steepness),
 *   dx'/dx = 1 - SUM(g*dx*dx*sin f)      dx'/dz =   - SUM(g*dx*dz*sin f)
 *   dz'/dx =   - SUM(g*dx*dz*sin f)      dz'/dz = 1 - SUM(g*dz*dz*sin f)
 * J = 1 on flat water, drops as a crest steepens, and goes NEGATIVE where the surface folds
 * back on itself — i.e. exactly where a real wave is breaking. Foam gated on J is therefore
 * born along crest lines and inherits their shape, instead of being round noise blobs.
 */
const waveSurface = Fn(([rawXz, time, sea, shallowFade]) => {
  const xz = rawXz.mul(oceanScaleUniform).toVar();
  const h = float(0.0).toVar();
  const jxx = float(0.0).toVar();
  const jzz = float(0.0).toVar();
  const jxz = float(0.0).toVar();
  const offX = float(0.0).toVar();
  const offZ = float(0.0).toVar();
  for (const w of WAVES) {
    const a = w.steepness.mul(sea).div(w.k)
      .mul(swellWavelengthUniform).mul(waveHeightUniform)
      .mul(w.geo).mul(shallowFade);
    const f = wavePhase(w, xz, time);
    const sf = sin(f);
    const cf = cos(f);

    const pinch = a.mul(a).mul(w.k).mul(0.5).mul(cos(f.mul(2.0)))
      .mul(crestSharpnessUniform).mul(w.geo2);
    h.addAssign(a.mul(sf).sub(pinch));

    // g = Q * a * k, the per-wave steepness actually applied to the horizontal displacement.
    const g = a.mul(w.k).mul(chopStrengthUniform);
    jxx.addAssign(g.mul(w.dx).mul(w.dx).mul(sf));
    jzz.addAssign(g.mul(w.dz).mul(w.dz).mul(sf));
    jxz.addAssign(g.mul(w.dx).mul(w.dz).mul(sf));

    const ha = a.mul(cf).mul(chopStrengthUniform);
    offX.addAssign(ha.mul(w.dx));
    offZ.addAssign(ha.mul(w.dz));
  }
  const J = float(1.0).sub(jxx).mul(float(1.0).sub(jzz)).sub(jxz.mul(jxz));
  return vec4(h, J, offX, offZ);
});

/**
 * Jacobian only, for the lagged samples that produce foam TRAILS.
 * J(x, t - tau) answers "was this patch of water breaking tau seconds ago"; because the wave
 * field travels, taking the max over several lags smears the foam backwards along the
 * propagation direction and gives the stretched, dissipating streaks that round noise cannot.
 */
const waveJacobianAt = Fn(([rawXz, time, sea, shallowFade]) => {
  const xz = rawXz.mul(oceanScaleUniform).toVar();
  const jxx = float(0.0).toVar();
  const jzz = float(0.0).toVar();
  const jxz = float(0.0).toVar();
  for (const w of WAVES) {
    const a = w.steepness.mul(sea).div(w.k)
      .mul(swellWavelengthUniform).mul(waveHeightUniform)
      .mul(w.geo).mul(shallowFade);
    const sf = sin(wavePhase(w, xz, time));
    const g = a.mul(w.k).mul(chopStrengthUniform);
    jxx.addAssign(g.mul(w.dx).mul(w.dx).mul(sf));
    jzz.addAssign(g.mul(w.dz).mul(w.dz).mul(sf));
    jxz.addAssign(g.mul(w.dx).mul(w.dz).mul(sf));
  }
  return float(1.0).sub(jxx).mul(float(1.0).sub(jzz)).sub(jxz.mul(jxz));
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

/* ------------------------------------------------------------------
   Band-limited FBM
   ------------------------------------------------------------------
   The unfiltered fbm above is point-sampled. Its finest octave is ~0.12 m across; a pixel
   covers that much water by roughly 120 m out, and everything beyond is therefore white noise
   evaluated once per pixel. That is the "severe specular grain and pixel sparkle": the noise
   itself is not what glitters, but it perturbs the normal randomly per pixel and a narrow
   specular lobe turns random normals into isolated blown-out pixels.

   The fix is the standard one: fade each octave out as it approaches the pixel footprint, and
   book-keep the slope variance that was removed so the shading pass can widen the specular
   lobe by exactly that amount (Toksvig / LEAN in spirit — normal detail becomes roughness,
   rather than disappearing or aliasing).
   ------------------------------------------------------------------ */

// 1 while the feature is larger than a pixel, 0 once it is sub-pixel. Deliberately tuned to
// hold on until roughly the Nyquist limit rather than fading a full octave early -- fading
// early costs visible surface texture, and the residual is caught by the roughness term.
const octaveWeight = Fn(([lambdaM, fp]) =>
  clamp(lambdaM.div(max(fp, float(0.0001))).sub(0.8), 0.0, 1.0)
);

// lambda0 = world size, in metres, of one unit of `p`.
const fbmBL = Fn(([p, lambda0, fp]) => {
  const w0 = octaveWeight(lambda0, fp);
  const w1 = octaveWeight(lambda0.div(2.04), fp);
  const w2 = octaveWeight(lambda0.div(4.11), fp);
  return gradNoise(p).mul(w0)
    .add(gradNoise(p.mul(2.04).add(vec2(17.3, 9.1))).mul(0.5).mul(w1))
    .add(gradNoise(p.mul(4.11).add(vec2(42.7, 28.6))).mul(0.25).mul(w2));
});

// Slope variance discarded by fbmBL, per unit amplitude. Octave i has amplitude 0.5^i and
// wavenumber 2.04^i / lambda0, so its slope amplitude is (1.02^i / lambda0); variance is half
// the square of that. Returned normalised by lambda0 so callers can scale by their amplitude.
const fbmLostVariance = Fn(([lambda0, fp]) => {
  const s0 = float(1.0).div(lambda0);
  const s1 = float(1.02).div(lambda0);
  const s2 = float(1.0404).div(lambda0);
  return s0.mul(s0).mul(octaveWeight(lambda0, fp).oneMinus())
    .add(s1.mul(s1).mul(octaveWeight(lambda0.div(2.04), fp).oneMinus()))
    .add(s2.mul(s2).mul(octaveWeight(lambda0.div(4.11), fp).oneMinus()))
    .mul(0.5);
});

/**
 * Animated capillary-scale detail height field.
 *
 * `orbit` is the horizontal Gerstner orbital offset at this point. Feeding it into the sample
 * position makes the micro-detail ride the swell — bunching on the face of a crest and
 * stretching in the trough — instead of the pure UV scroll it used to be, which read as a
 * texture sliding across a static surface.
 */
const detailHeight = Fn(([xz, time, fp, orbit]) => {
  const driftA = vec2(time.mul(0.55), time.mul(0.32));
  const driftB = vec2(time.mul(-0.4), time.mul(0.5));
  const driftC = vec2(time.mul(0.9), time.mul(-0.7));
  const advected = xz.sub(orbit.mul(0.6));
  return fbmBL(advected.mul(0.85).add(driftA), float(1.176), fp)
    .add(fbmBL(advected.mul(2.1).add(driftB), float(0.476), fp).mul(0.45))
    // Capillary scale, ~22 cm. Only affordable BECAUSE the band limiting above removes it
    // cleanly the moment it goes sub-pixel; point-sampled it would be pure grain.
    .add(fbmBL(advected.mul(4.6).add(driftC), float(0.217), fp).mul(0.22));
});

// Matching lost-variance for detailHeight. The frequency of each term is already carried by its
// lambda0, so the only extra factor is the term's own weight, squared.
const detailLostVariance = Fn(([fp]) =>
  fbmLostVariance(float(1.176), fp)
    .add(fbmLostVariance(float(0.476), fp).mul(0.45 * 0.45))
    .add(fbmLostVariance(float(0.217), fp).mul(0.22 * 0.22))
);

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
   Shore depth sampling  (Phase 2a — was specified and never written)
   ============================================================ */

/**
 * Water depth in metres at a world XZ, from the CPU-baked terrain height field.
 * Returns a large positive number ("very deep") whenever the field is unavailable, so every
 * shore effect degrades to open ocean rather than popping.
 */
const sampleWaterDepth = Fn(([worldXz]) => {
  const uv = worldXz.sub(depthFieldOriginUniform).div(depthFieldSizeUniform).toVar();
  // The texture clamps to edge, so outside the footprint we must mask explicitly or the
  // border texel would smear a fake shoreline across the whole horizon.
  const inside = step(0.0, uv.x).mul(step(uv.x, 1.0))
    .mul(step(0.0, uv.y)).mul(step(uv.y, 1.0));
  const terrainH = terrainDepthTexNode.sample(uv).r;
  const rawDepth = waterLevelUniform.sub(terrainH);
  // Unbaked texels hold DEPTH_FIELD_SENTINEL (-1000), which yields a huge depth already.
  return mix(float(9999.0), rawDepth, inside.mul(depthFieldValidUniform));
});

/* ============================================================
   Create Open Sea NodeMaterial
   ============================================================ */
export const createOpenSeaMaterial = () => {
  const oceanMaterial = new THREE.MeshBasicNodeMaterial();
  oceanMaterial.transparent = true;
  oceanMaterial.side = THREE.DoubleSide;

  const scaledTime = timeUniform.mul(speedUniform);

  // Waves must die as the water shallows out, or the surface swings several metres up and down
  // through the beach face every cycle (the swinging waterline in WATER_DIAGNOSIS.md 3.7).
  // Sampled at the undisplaced grid position; explicit level 0 because the vertex stage has no
  // derivatives and the field has no mips.
  const vtxWorldXz = positionLocal.xz.add(cameraPosition.xz);
  const vtxUv = vtxWorldXz.sub(depthFieldOriginUniform).div(depthFieldSizeUniform);
  const vtxInside = step(0.0, vtxUv.x).mul(step(vtxUv.x, 1.0))
    .mul(step(0.0, vtxUv.y)).mul(step(vtxUv.y, 1.0));
  const vtxTerrainH = terrainDepthTexNodeVS.sample(vtxUv).level(0).r;
  const vtxDepth = mix(float(9999.0), waterLevelUniform.sub(vtxTerrainH),
                       vtxInside.mul(depthFieldValidUniform));
  const shallowFade = smoothstep(0.0, shoreDepthUniform.mul(0.9), vtxDepth);

  const gerstnerP = wavePosition(positionLocal.xz, scaledTime, seaUniform, shallowFade);
  oceanMaterial.positionNode = vec3(gerstnerP.x, gerstnerP.y, gerstnerP.z);

  oceanMaterial.colorNode = Fn(() => {
    const P = positionWorld.toVar();
    const xz = P.xz;
    const camDist = distance(cameraPosition, P).toVar();

    // ---- Pixel footprint, measured rather than guessed ---------------------
    // World metres covered by one pixel, straight from the screen-space derivatives of the
    // shaded position. The old code approximated this as camDist/600, which ignores FOV,
    // resolution, and the cosine of the view angle -- and a grazing view of the ocean is exactly
    // the case where a pixel covers the most water.
    //
    // A grazing pixel is a long thin SLIVER: metres of water along the view direction, but
    // centimetres across it. Filtering everything to the long axis is what makes near water
    // read as a smooth sheet with no texture on it. So the footprint is split, the way an
    // anisotropic sampler splits it:
    //   fpDetail (short axis) decides how much surface texture survives  -> keeps it crisp
    //   fpSpec   (long axis)  decides how wide the specular lobe gets    -> keeps it calm
    // Texture detail is cheap to keep and expensive to lose; specular fireflies are the
    // opposite, so each gets the footprint that suits it.
    const dpx = length(dFdx(P.xz)).toVar();
    const dpy = length(dFdy(P.xz)).toVar();
    const fp = min(dpx, dpy).toVar();
    const fpSpec = max(dpx, dpy).toVar();

    // Distance LOD factor: 1.0 up close (<250m), smoothly scales down towards distance
    const distLod = smoothstep(lodDistanceThresholdUniform, float(250.0), camDist);
    const effectiveLodFactor = mix(float(1.0), distLod, distanceLodUniform);
    const effectiveQuality = mix(float(0.55), float(1.0), qualityModeUniform);

    // Short swell components stop being resolvable at roughly the same range. Their slope
    // energy is not thrown away -- waveNormal returns it in .w and it becomes roughness below.
    const footprint = clamp(camDist.div(600.0), 0.0, 1.0).toVar();
    const sharpness = float(1.0).sub(footprint.mul(0.92));

    const depth = sampleWaterDepth(xz).toVar();
    const shallowFadeF = smoothstep(0.0, shoreDepthUniform.mul(0.9), depth).toVar();

    const n4 = waveNormal(xz, scaledTime, seaUniform, sharpness).toVar();
    const n0 = n4.xyz.toVar();
    const swellLostVar = n4.w.toVar();

    // crest height, folding Jacobian, and horizontal orbital offset in one pass
    const surf = waveSurface(xz, scaledTime, seaUniform, shallowFadeF).toVar();
    const crest = surf.x.toVar();
    const jacobian = surf.y.toVar();
    const orbit = surf.zw.toVar();

    const h0 = detailHeight(xz, scaledTime, fp, orbit);
    const hx = detailHeight(xz.add(vec2(0.1, 0.0)), scaledTime, fp, orbit);
    const hz = detailHeight(xz.add(vec2(0.0, 0.1)), scaledTime, fp, orbit);

    const chopMask = fbmBL(xz.mul(0.045).add(vec2(scaledTime.mul(0.018), scaledTime.mul(-0.012))),
                           float(22.2), fp).mul(0.5).add(0.5);
    const nonUniformChop = mix(float(0.35), float(1.65), chopMask.mul(chopPatchinessUniform));
    const crestChopMult = mix(float(0.55), float(1.45), smoothstep(-0.4, 1.1, crest));

    const effectiveDetail = float(1.5)
      .mul(seaUniform.mul(0.6).add(0.4))
      .mul(detailAmountUniform)
      .mul(effectiveLodFactor)
      .mul(effectiveQuality)
      .mul(nonUniformChop)
      .mul(crestChopMult)
      .toVar();

    // No blanket distance fade here any more: fbmBL already removed exactly the octaves that
    // cannot be resolved, octave by octave, which is both sharper up close and cleaner far away.
    const detailGain = effectiveDetail.mul(0.1).toVar();
    const detail = vec3(h0.sub(hx), 0.0, h0.sub(hz)).mul(detailGain);
    const N = normalize(n0.add(detail)).toVar();

    const V = normalize(cameraPosition.sub(P)).toVar();

    // ---- Micro-facet roughness: the actual cure for the sparkle ------------
    // Detail we filtered out still physically exists; it just cannot be resolved by this pixel.
    // Feeding its slope variance back in as ROUGHNESS (rather than dropping it, or point
    // sampling it as before) converts pixel-level glitter into coherent sheen. This is
    // Toksvig's normal-map filtering argument applied to procedural detail.
    // Deliberately measured against the LONG axis: detail that survives band limiting can still
    // alias along a sliver, so for specular purposes treat it as unresolved.
    const detailVar = detailLostVariance(fpSpec).mul(0.01).mul(detailGain).mul(detailGain);
    const microVar = detailVar.add(swellLostVar).mul(microRoughnessUniform).toVar();
    // Calibrated so the lobe runs from ~520 (mirror-smooth, right under the camera) down to
    // ~40 by a few hundred metres, which is where it has to land to stay calm. Retuned when the
    // Q bug came off the vertical normal term: swellLostVar dropped ~20x, so the constant went
    // up by the same factor.
    const gloss = float(1.0).div(float(1.0).add(microVar.mul(20000.0))).toVar();
    const roughness = gloss.oneMinus().toVar();

    /* ---------------- Water body colour ---------------------------------- */

    const colorTurbulence = fbmBL(xz.mul(0.035).add(vec2(scaledTime.mul(0.015), scaledTime.mul(-0.01))),
                                  float(28.6), fp).mul(0.28).mul(effectiveLodFactor);
    // Open-ocean back-scatter: what deep water looks like when no bottom contributes at all.
    const openBody = mix(
      deepColorUniform,
      shallowColorUniform,
      clamp(crest.mul(0.25).add(0.48).add(colorTurbulence), 0.0, 1.0)
    ).toVar();

    // ---- Beer-Lambert transmission to the sea bed --------------------------
    // The bottom is seen through a tilted surface, so the lookup is displaced by the surface
    // normal -- that is what makes the sand ripple and wobble under the waves.
    const refrXz = xz.add(N.xz.mul(shoreRefractionUniform.mul(3.0)));
    const depthR = max(sampleWaterDepth(refrXz), float(0.0)).toVar();
    // exp(-sigma * d * 2): down through the column and back up to the eye. sigma is per-channel,
    // so red dies within a metre or so while blue survives several. That single fact is what
    // makes shallow water turquoise and deep water blue, and it replaces the hand-mixed shore
    // ramp that used to fake it.
    const T = exp(extinctionUniform.mul(min(depthR, float(60.0))).mul(-2.0)).toVar();
    const body = mix(openBody, sandColorUniform.mul(bottomBrightnessUniform), T).toVar();
    // Light scattered back out of the column itself. Vanishes once red is gone (deep water) and
    // once there is no column left to scatter in (T.b -> 1, ankle deep), so it peaks in the
    // knee-to-waist band where the turquoise actually lives.
    body.addAssign(shoreShallowColorUniform.mul(T.r.oneMinus().mul(T.b)).mul(inScatterUniform));

    // ---- Subsurface scattering through the crest ---------------------------
    // Backlight transmitted through thin water. It peaks where the water is THIN and STEEP --
    // the lip of a crest with the sun behind it -- so it has to be driven by slope and
    // elevation, not by a bare view-vs-sun dot product spread over the whole surface.
    const sssH = normalize(sunDirUniform.add(N.mul(sssDistortionUniform))).toVar();
    const backLit = pow(clamp(dot(V, sssH.negate()), 0.0, 1.0), sssPowerUniform);
    // Horizontal slope magnitude (= sin of the tilt), not 1 - cos(tilt). With the normals now
    // correctly tilting only a few degrees, 1 - N.y is a few THOUSANDTHS and the old gate
    // multiplied the whole subsurface term away to nothing.
    const crestSteep = clamp(length(N.xz).mul(8.0), 0.0, 1.0);
    const crestLift = clamp(
      crest.div(max(seaUniform.mul(waveHeightUniform).mul(3.0), float(0.25))), 0.0, 1.0);
    const sss = backLit.mul(crestSteep).mul(crestLift)
      .mul(sssStrengthUniform).mul(effectiveLodFactor);
    body.addAssign(sssColorUniform.mul(sunColorUniform).mul(sss));

    /* ---------------- Reflection + Fresnel -------------------------------- */

    const R = reflect(V.negate(), N).toVar();
    // skyColor() already blends to hazeColor below the horizon (dir.y < 0), so below-horizon
    // reflections show the dark ocean haze rather than the bright near-horizon sky. The old
    // clamp (R.y >= 0.04) pushed every tilted-crest reflection up to the bright horizon colour,
    // which was the direct cause of the bright parallel lines along every wave crest at Q=4.5.

    const NdotV = clamp(dot(N, V), 0.0, 1.0).toVar();
    const fresnelRaw = float(0.02).add(float(0.98).mul(pow(NdotV.oneMinus(), 5.0)));
    // A rough surface is never a perfect grazing mirror, and never drops to a bare 2% seen from
    // straight above. Compressing the Schlick curve towards its mean in proportion to the
    // micro-roughness keeps the horizon from banding into a white strip and stops the top-down
    // view from going flat and dead.
    const fresnel = mix(fresnelRaw, fresnelRaw.mul(0.55).add(0.10),
                        clamp(roughness.mul(fresnelRoughUniform), 0.0, 1.0));
    const color = mix(body, skyColor(R), fresnel).toVar();

    /* ---------------- Specular ------------------------------------------- */

    const H = normalize(sunDirUniform.add(V));
    // Band-limited: once this noise is sub-pixel it collapses to a constant 0.5, which makes
    // the modulation below exactly 1.0. That is the difference between a sparkling ocean and TV
    // static -- the noise stops being sampled once it can no longer be seen.
    const glitterNoise = fbmBL(xz.mul(2.1).add(vec2(scaledTime.mul(-0.4), scaledTime.mul(0.5))),
                               float(0.476), fp).mul(0.5).add(0.5);
    // Lobe width and gain both follow the filtered roughness now, rather than a camera-distance
    // ramp, so a grazing near-field pixel is filtered just as hard as a distant one.
    const specPower = max(float(520.0).mul(gloss), float(14.0)).toVar();
    const specGain = float(2.6).mul(gloss).mul(sparkleUniform).toVar();
    const NdotH = max(dot(N, H), 0.0).toVar();
    const glitter = pow(NdotH, specPower).mul(specGain).mul(glitterNoise.mul(0.6).add(0.7));
    const sheen = pow(NdotH, mix(float(48.0), float(14.0), roughness)).mul(0.12);
    color.addAssign(sunColorUniform.mul(glitter.add(sheen)).mul(effectiveLodFactor));

    /* ---------------- Foam ------------------------------------------------ */

    // ---- Whitecaps from the folding criterion ------------------------------
    // Foam is born where the Jacobian collapses -- along the crest line of a breaking wave --
    // so it inherits the crest's shape and direction for free. Sampling the same criterion at
    // earlier times and taking the maximum leaves foam behind the crest as it travels, which is
    // the dissipating trail. Round detached blobs were the symptom of gating isotropic noise on
    // crest HEIGHT instead.
    const jacLag1 = waveJacobianAt(xz, scaledTime.sub(foamTrailUniform.mul(1.1)),
                                   seaUniform, shallowFadeF);
    const jacLag2 = waveJacobianAt(xz, scaledTime.sub(foamTrailUniform.mul(2.7)),
                                   seaUniform, shallowFadeF);
    const breakAt = Fn(([j, w]) =>
      smoothstep(foamJacobianUniform, foamJacobianUniform.sub(0.35), j).mul(w));
    const capRaw = max(breakAt(jacobian, float(1.0)),
                       max(breakAt(jacLag1, float(0.55)), breakAt(jacLag2, float(0.22)))).toVar();

    // Foam texture stretched ALONG the swell axis and advected with it, so the streaks run the
    // way the water is actually moving instead of sitting there as isotropic clumps.
    const sdir = vec2(WAVES[0].dx, WAVES[0].dz);
    const sperp = vec2(WAVES[0].dz.negate(), WAVES[0].dx);
    const alongAxis = dot(xz, sdir).sub(scaledTime.mul(WAVES[0].c).mul(0.35));
    const acrossAxis = dot(xz, sperp);
    const streakUv = vec2(alongAxis.mul(0.07), acrossAxis.mul(0.55));
    const foamStreak = fbmBL(streakUv, float(1.82), fp).mul(0.5).add(0.5);
    const streakMask = mix(float(1.0), smoothstep(0.18, 0.8, foamStreak), foamStreakUniform).toVar();

    const capFoam = capRaw.mul(streakMask);

    const foamNoise = fbmBL(xz.mul(1.1).add(vec2(scaledTime.mul(0.22), scaledTime.mul(0.14))),
                            float(0.909), fp).mul(0.5).add(0.5);

    // ---- The surf line -----------------------------------------------------
    // Gated on DEPTH, so it follows the bathymetry contour rather than the polygon edge. The
    // crest term phases the run-up with the incoming swell, so surf arrives in sets and reaches
    // further up the beach behind a big wave.
    const runUp = sin(depth.mul(2.4)
        .sub(scaledTime.mul(shoreFoamSpeedUniform).mul(2.2))
        .add(crest.mul(1.1)))
      .mul(0.5).add(0.5);
    const shoreBand = smoothstep(shoreFoamWidthUniform.mul(2.0), 0.0, depth);
    const waterline = smoothstep(0.35, 0.0, abs(depth)).mul(0.65);
    const shoreFoam = shoreBand.mul(runUp.mul(0.75).add(0.25))
      .mul(mix(float(1.0), streakMask, 0.5))
      .mul(foamNoise.mul(0.5).add(0.6))
      .add(waterline)
      .mul(shoreFoamStrengthUniform);

    const foam = capFoam.add(shoreFoam)
      .mul(foamAmountUniform).mul(foamEnabledUniform).mul(foamDecayUniform).toVar();
    const foamMask = clamp(foam.mul(0.85), 0.0, 1.0).toVar();

    color.assign(mix(color, vec3(0.92, 0.96, 1.0), foamMask));

    /* ---------------- Aerial perspective ---------------------------------- */

    // Exponential extinction towards the horizon colour. The old single smoothstep(8000, 15500)
    // meant water 3 km away was rendered with no atmosphere between it and the eye at all,
    // which is why the mid distance read as a flat painted sheet rather than receding.
    const aerial = float(1.0)
      .sub(exp(camDist.div(max(aerialDistanceUniform, float(1.0))).negate()))
      .mul(aerialStrengthUniform);
    color.assign(mix(color, horizonColorUniform, clamp(aerial, 0.0, 1.0)));
    // Hard dissolve at the rim of the 16 km plane so its edge never shows.
    color.assign(mix(color, horizonColorUniform, smoothstep(9000.0, 15500.0, camDist)));

    /* ---------------- Alpha ------------------------------------------------ */

    const depthAlpha = mix(shoreOpacityUniform, waterOpacityUniform,
                           smoothstep(0.0, shoreDepthUniform, depth));
    // Foam is aerated spray sitting ON the water, not water. Letting the 10% shore alpha
    // multiply it away is why the surf line was invisible exactly where it matters most.
    const alpha = max(depthAlpha, foamMask.mul(foamOpacityUniform));

    return vec4(color, clamp(alpha, 0.0, 1.0));
  })();

  return oceanMaterial;
};

/* ============================================================
   CPU Wave Physics — for real-time player/boat buoyancy
   ============================================================ */
function _waveAmplitude(w, sea) {
  return (w.steepness.value * sea * swellWavelengthUniform.value
    * waveHeightUniform.value * w.geo.value) / w.k.value;
}

export function getWaterHeightAt(rawX, rawZ, time, sea) {
  const targetX = rawX * oceanScaleUniform.value;
  const targetZ = rawZ * oceanScaleUniform.value;
  const Q = chopStrengthUniform.value;
  const t = time * speedUniform.value;

  // A Gerstner surface is PARAMETRIC: the vertex authored at (px, pz) is drawn at
  // (px + Qsum, pz + Qsum). Sampling the height at the world position directly therefore reads
  // the wrong point, and the error grows with Q -- which the trochoidal chop above just raised
  // from 0.75 to 2.4. Two fixed-point iterations invert the horizontal displacement and put the
  // buoyancy back on the surface the player can actually see.
  let px = targetX;
  let pz = targetZ;
  for (let iter = 0; iter < 2; iter++) {
    let dx = 0;
    let dz = 0;
    for (const w of WAVES) {
      const a = _waveAmplitude(w, sea);
      const f = w.k.value * (w.dx.value * px + w.dz.value * pz - t * w.c.value) + w.phase.value;
      const ha = Q * a * Math.cos(f);
      dx += ha * w.dx.value;
      dz += ha * w.dz.value;
    }
    px = targetX - dx;
    pz = targetZ - dz;
  }

  // Must mirror wavePosition exactly, Stokes harmonic included, or buoyancy floats the player
  // on waves the mesh does not actually have.
  let y = 0;
  for (const w of WAVES) {
    const a = _waveAmplitude(w, sea);
    const f = w.k.value * (w.dx.value * px + w.dz.value * pz - t * w.c.value) + w.phase.value;
    const pinch = 0.5 * w.k.value * a * a * Math.cos(2 * f)
      * crestSharpnessUniform.value * w.geo2.value;
    y += a * Math.sin(f) - pinch;
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
