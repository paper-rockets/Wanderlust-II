# Water Shoreline & Wave Realism — Implementation Plan

Target build: `E:\GAME FINAL RUN\WANDERLUST webgpu` (the canonical WebGPU build).
Branch: `restore/golden-hour-look`.
Renderer: `WebGPURenderer` (`src/core/Engine.js:14`). **All shader work must be TSL node-based.
Raw GLSL `ShaderMaterial` / `gl_FragColor` / `WebGLRenderTarget` will not run.**

Goal: fix the bad-looking shoreline, make wave motion read as real water, and add a lighter
sand-coloured band where the water meets land.

---

## 1. Current state — what actually exists

### Water
- `src/WaterAnime/WaterSystem.js` — owns one mesh: `PlaneGeometry(16000, 16000, 512, 512)`
  (**31.25 m per vertex**), `frustumCulled = false`, sits at `y = 2.4`, and is re-centred on the
  camera XZ every frame for an infinite horizon.
- `src/WaterAnime/OpenSeaOcean.js` — the TSL material. 5-component Gerstner sum in
  `wavePosition()`, analytic normals in `waveNormal()`, signed crest in `waveCrest()`,
  3-octave FBM micro-detail, sky reflection, glitter, foam.
- Waves are evaluated in **world space** (`worldXz = localXz.add(cameraPosition.xz)`), so the
  ocean does not swim with the camera. That part is correct — do not "fix" it.
- `MeshBasicNodeMaterial`, `transparent = true`, `side = DoubleSide`, flat
  `waterOpacityUniform = 0.92`.

### Terrain
- **`src/world/TerrainChunkManager.js` is dead code** — `main.js` does not import it. The live
  terrain is inline in `src/main.js` (mesh created ~line 1363, rebuilt by
  `updateTerrainGeometry()` ~line 1406).
- One `PlaneGeometry(4000, 4000, terrainRes, terrainRes)`, `terrainRes = 128` by default
  (`src/config/constants.js:5`, 64 under `LOW_GFX`) → **31.25 m per vertex**.
- Recentred + fully rebuilt on the CPU only when the player moves 150 m (`stepThreshold`).
- Scaled up to **10×** at altitude (`src/main.js:4297`) → 312 m per vertex when flying high.
- Heights come from `getWorldHeight(x, z)` in `src/world/TerrainGenerator.js:123`. Ocean floor is
  a flat `-5.0` wherever the island mask is 0. Vertex colours from `getWorldColor()`.
- `src/world/biomes/terrain-archipelago.js` **already paints a full beach ramp** by height:
  deep water → teal shallows (h 1–2) → wet sand (h 2–2.8) → golden sand (h 2.8–4.5) →
  bleached crest (h 4.5–6.2) → grass. Almost none of it is visible today.

### Dead / unusable water modules
Not imported by `main.js`: `WaterDepthIntersection.js`, `SeabedFloor.js`, `WaterFloor.js`,
`WaterSparkles.js`, `WaterWaveSimulation.js`, `OpenSeaOcean_TestLab.js`.
`WaterDepthIntersection.js` is additionally **unusable** — GLSL `ShaderMaterial` +
`WebGLRenderTarget` + `gl_FragColor`. Do not try to revive it. Leave these files alone.

---

## 2. Root causes

| # | Cause | Effect on screen |
|---|-------|------------------|
| A | Terrain mesh is 31.25 m/vertex (312 m at altitude) | Waterline is a hard faceted polygon; islands read as flat-shaded shards |
| B | `waterOpacityUniform = 0.92`, uniform everywhere | Water is nearly opaque right up to the beach; the sand ramp the terrain already paints is hidden |
| C | Water colour mixes deep↔shallow by **wave crest height**, never by **water depth** | Water 20 cm deep is the same dark teal as water 200 m deep |
| D | No shoreline foam, no run-up, no refraction, no depth fade | Water and land meet at a razor edge with zero interaction |
| E | Gerstner horizontal displacement damped to `0.35` (`OpenSeaOcean.js:141,143`) | Crests never sharpen — sinusoidal swell, not ocean |
| F | FBM detail is a pure UV scroll (`driftA = vec2(time*0.55, time*0.32)`) | Reads as a texture sliding across a surface, not as moving water |
| G | Foam gate is `smoothstep(1.0, 2.0, crest)` — an **absolute** height in metres | At default wave heights foam essentially never fires |
| H | 5 wave components, narrow spread, fixed phases | Visible repeating interference tiling |
| I | Waves keep full amplitude in 0 m of water | Geometry punches through the beach |

---

## 3. Strategy

The enabling piece is **giving the water shader knowledge of the terrain height beneath it**.

**Chosen approach — CPU-baked terrain height texture.** Terrain height is already fully CPU-side
(`getWorldHeight`). Bake it into a `DataTexture` covering the same 4000×4000 footprint as the
terrain mesh, at **512×512 (7.8 m/texel — 4× finer than the terrain mesh)**, and regenerate it in
the same 150 m step that rebuilds the terrain. The water shader samples it and derives
`depth = waterY - terrainHeight`.

Why this wins: **the shore gradient becomes painted, not tessellated.** A 7.8 m-resolution depth
field lets the sand band, foam line and opacity falloff be smooth even though the underlying
terrain geometry is a 31 m polygon soup. It fixes cause A visually without touching terrain
tessellation or costing frame time (currently 22 FPS — do not make it worse).

Rejected: a scene depth prepass. Correct in principle, but expensive, and it fights the existing
`PostProcessing` chain that the golden-hour look depends on (`outputColorTransform = false`).

---

## 4. Work items

### Phase 1 — Depth field infrastructure

**New file `src/WaterAnime/TerrainDepthField.js`**

```js
export class TerrainDepthField {
  // res = 512, worldSize = 4000 (must track the terrain mesh footprint)
  constructor(res = 512, worldSize = 4000)
  // Rebuild the R32F DataTexture around a new centre. Call from updateTerrainGeometry().
  rebuild(centerX, centerZ, getWorldHeight)
  get texture()          // THREE.DataTexture, RedFormat, FloatType, LinearFilter, ClampToEdgeWrap
  get originUniform()    // uniform(vec2(centerX - worldSize/2, centerZ - worldSize/2))
  get sizeUniform()      // uniform(worldSize)
}
```

- `THREE.DataTexture(Float32Array, res, res, THREE.RedFormat, THREE.FloatType)`,
  `minFilter = magFilter = THREE.LinearFilter`, `wrapS = wrapT = THREE.ClampToEdgeWrapping`,
  `needsUpdate = true` after each rebuild.
- 512×512 = 262 144 `getWorldHeight` calls per rebuild. That is too slow for one frame. **Amortise
  it**: rebuild in row-blocks across frames (e.g. 32 rows/frame → 16 frames), double-buffered so
  the live texture is never half-written. Rebuilds only trigger every 150 m of travel, so there is
  plenty of headroom.
- Outside the baked footprint the shader must fall back to "deep" — clamp the UV and let
  `ClampToEdgeWrapping` + a `smoothstep` on distance-from-centre fade the shore effects out.

**`src/WaterAnime/OpenSeaOcean.js` — add uniforms only in this phase (no logic changes):**

```js
export const terrainDepthTexUniform   = /* texture node, wired by WaterSystem */;
export const depthFieldOriginUniform  = uniform(new THREE.Vector2(0, 0));
export const depthFieldSizeUniform    = uniform(4000.0);
export const depthFieldValidUniform   = uniform(0.0);   // 0 until first bake completes
export const waterLevelUniform        = uniform(2.4);   // must mirror openSeaMesh.position.y

// Shore appearance
export const sandColorUniform         = uniform(new THREE.Color(0.85, 0.80, 0.62));
export const shoreShallowColorUniform = uniform(new THREE.Color(0.32, 0.72, 0.70));
export const shoreDepthUniform        = uniform(6.0);   // metres over which deep→sand ramps
export const shoreOpacityUniform      = uniform(0.10);  // alpha at depth 0
export const shoreFoamWidthUniform    = uniform(2.2);   // metres of foam band
export const shoreFoamSpeedUniform    = uniform(0.8);
export const shoreFoamStrengthUniform = uniform(1.0);
export const shoreRefractionUniform   = uniform(0.35);
```

**`src/WaterAnime/WaterSystem.js`**
- Own a `TerrainDepthField` instance; expose `rebuildDepthField(cx, cz)` and
  `tickDepthField()` (for the amortised bake).
- Wire the texture into the material via TSL `texture(field.texture)`.
- Keep `waterLevelUniform` in sync inside `setHeight(y)`.

**`src/main.js`**
- Inside `updateTerrainGeometry()` (~line 1406), after `gridX`/`gridZ` are computed, call
  `animeWaterSystem.rebuildDepthField(gridX, gridZ)`.
- In the render loop next to the existing `animeWaterSystem.update(...)` (~line 4011), call
  `animeWaterSystem.tickDepthField()`.
- Guard everything on `animeWaterSystem` being non-null.

### Phase 2a — Shore shading (`OpenSeaOcean.js`, `colorNode` + `positionNode`)

1. **Sample depth.** `uv = (P.xz - origin) / size`; `terrainH = texture(depthTex, uv).r`;
   `depth = waterLevelUniform.sub(terrainH)`. Multiply all shore effects by
   `depthFieldValidUniform` and by an in-bounds mask so the open ocean is untouched.
2. **Depth colour ramp.** `shoreT = smoothstep(shoreDepthUniform, 0.0, depth)` then
   `body = mix(body, shoreShallowColor, shoreT)` and
   `body = mix(body, sandColor, pow(shoreT, 2.2))`. This is the "lighter colour right at shore
   like sand" the user asked for.
3. **Depth-driven opacity — this is the single highest-impact change.** Replace the flat alpha:
   `alpha = mix(shoreOpacityUniform, waterOpacityUniform, smoothstep(0.0, 3.5, depth))`.
   The water now *fades out* as it meets the beach instead of ending at a hard line, and the
   archipelago biome's existing wet-sand/golden-sand vertex colours finally show through.
   Set `oceanMaterial.depthWrite = false` and give the mesh an explicit `renderOrder` so the
   terrain beneath resolves correctly.
4. **Shoreline foam.** Band at the waterline:
   `foamBand = smoothstep(shoreFoamWidth, 0.0, depth) * smoothstep(-0.3, 0.15, depth)`,
   animated with `sin(depth * 2.4 - time * shoreFoamSpeed)` so it surges in and out like run-up,
   broken up by the existing `fbm()` so it is not a clean ring. Add a tighter, brighter line at
   `depth ≈ 0`. Composite over the existing open-ocean foam, do not replace it.
5. **Wave damping in shallows.** In `wavePosition()` **and** `waveCrest()`, scale amplitude by
   `smoothstep(0.0, 6.0, depth)`. Stops metre-high waves standing in ankle-deep water and stops
   geometry punching through the beach. `getWaterHeightAt()` (the CPU buoyancy path, line 336)
   must get the equivalent damping or the player will float at the wrong height near shore.
6. **Refraction wobble.** Offset the shore sample UV by `N.xz * shoreRefractionUniform * depth01`
   — cheap, and it sells looking *through* water.

### Phase 2b — Wave realism (`OpenSeaOcean.js`, wave functions)

7. **Un-damp horizontal displacement.** `0.35` → `~0.9` on the `p.x`/`p.z` terms (line 141/143),
   with a total-steepness clamp (sum of `steepness` across components ≲ 1.0) so crests peak
   instead of looping. This is what turns sine swell into ocean.
8. **Broaden the spectrum.** Go from 5 to 7 components, widen the directional spread, give each a
   Phillips-style amplitude falloff and a slight per-component speed jitter so the interference
   pattern stops visibly tiling. Keep `WAVE_PARAMS` exported and keep `updateWaveUniforms(i)`,
   `randomizeSeaSpectrum()` and `setWindDirection()` working — the GUI calls them.
9. **Kill the sliding-texture read.** `detailHeight()` currently scrolls FBM UVs linearly. Replace
   with two counter-rotating FBM layers at different scales, advected along the dominant wave
   direction and phase-linked to `crest`, so detail rides the swell instead of sliding over it.
10. **Fix the foam gate.** `smoothstep(1.0, 2.0, crest)` is absolute metres. Normalise it against
    the current spectrum amplitude (`crest / maxCrest`) so foam fires at any wave height, and add
    slope-based foam: foam where the surface is steep **and** rising
    (`dot(N, up)` low + `crest` derivative positive).

### Phase 3 — GUI + persistence

11. `src/WaterAnime/WaterEditorGUI.js` — add a **Shore** folder: sand colour, shallow colour,
    shore depth, shore opacity, foam width, foam speed, foam strength, refraction.
12. `src/WaterAnime/WaterModalUI.js` — mirror the same controls in the modal (match the existing
    `oc-slider` / `oc-value` markup pattern) and include them in the reset-to-default path.
13. Persist under a new `water.shore` block in `environment_settings.json` (both the repo root
    copy and `public/environment_settings.json` — they are kept identical).

---

## 5. Constraints

- **Do not regress the golden-hour look.** `postProcessing.outputColorTransform = false`,
  `uHaloStrength = 0.0`, sky mode `flat`, bloom off, `fogIntensity 3.5`, `exposure 1.9`,
  god-ray intensity 0.65.
- **Frame budget.** The build currently runs at ~22 FPS. Every added texture fetch is paid per
  water pixel — the ocean covers most of the screen. Gate the shore work behind the existing
  `effectiveLodFactor` / `qualityModeUniform` so it costs nothing beyond the near field, and
  early-out when `depthFieldValidUniform` is 0.
- **TSL only.** No GLSL strings, no `WebGLRenderTarget`, no `gl_FragColor`.
- **Keep the CPU wave physics in sync.** `getWaterHeightAt()` / `getWaterNormalAt()` are used for
  player and aircraft buoyancy. Any change to the wave sum must be mirrored there or the player
  will visibly float above or sink into the surface.
- **Do not touch** the dead water modules, the terrain tessellation, or the post-processing chain.

## 6. Verification

- `npm run dev`, fly to **Archipelago** (Navigation panel) and hover a shoreline at low altitude.
- Expected: soft sand-coloured band at the waterline, water fading to near-transparent over the
  beach, an animated foam line surging in and out, no hard polygon edge, crests that peak rather
  than roll sinusoidally.
- Check FPS before/after at the same spot; check the shore effects vanish cleanly in open ocean
  and at high altitude (where the depth field footprint is left behind).
