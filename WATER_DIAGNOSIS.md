# Ocean & Shoreline — Diagnosis

Status: **most of this has now been implemented** (2026-08-21). See "What was fixed" at the
bottom. The diagnosis text below is preserved as written, so the reasoning behind each change
stays on record.

Supersedes the "Root causes" section of `WATER_SHORE_PLAN.md`, whose line numbers are stale
(it cites `OpenSeaOcean.js:141,143`; that code now lives at `:207,209`). Its causes **C, E, F,
G, H** are all still literally true. Verified against the current tree.

Two complaints drove this:

1. The open ocean is a regular repeating corduroy of parallel ridges, "flat and uniform, no
   life, no movement, completely doesn't move", with white static across the surface.
2. "The connection with the shore is trash" — hard black faceted edges where water meets land.

---

## THE HEADLINE — a one-character physics bug freezes the ocean

`src/WaterAnime/OpenSeaOcean.js:146` (and identically `:161`):

```js
c: uniform(Math.sqrt(9.8 * k)),
```

Deep-water phase speed is **c = √(g/k)**, not **√(g·k)**. The value used is exactly
`g / c_true`, so the dispersion relation is **inverted**: long waves crawl, short waves are
comparatively fast. The exact opposite of how water behaves.

| Wavelength | c used | period used | c correct | period correct |
|---:|---:|---:|---:|---:|
| 160 m | **0.62 m/s** | **258 s** | 15.80 m/s | 10.1 s |
| 88 m | **0.84 m/s** | **105 s** | 11.72 m/s | 7.5 s |
| 42 m | 1.21 m/s | 34.7 s | 8.09 m/s | 5.2 s |
| 20 m | 1.75 m/s | 11.4 s | 5.59 m/s | 3.6 s |
| 9.5 m | 2.55 m/s | 3.7 s | 3.85 m/s | 2.5 s |

**87% of the wave amplitude (2.52 m + 1.01 m of 4.04 m total) sits in components with a
105–258 second period.** The primary swell advances 62 cm per second and takes 4.3 minutes to
move one crest forward. Over any normal viewing period it is a still image.

This alone explains "completely doesn't move". No other cause needs to be invoked.

`getWaterHeightAt` (`:408`, the CPU buoyancy path) uses the same wrong `c`, so at least GPU and
CPU agree with each other. Fixing one requires fixing both.

---

## Part 1 — Why the ocean looks like corduroy

### 1.1 Three of five waves are below the Nyquist limit and alias into giant coherent ridges

`WaterSystem.js:66` — `PlaneGeometry(16000, 16000, 512, 512)` ⇒ **31.25 m per vertex**.
Nyquist wavelength = 62.5 m. Practical minimum for a clean wave ≈ 4× spacing = 125 m.

| # | λ | samples/λ | vs 2d | vs 4d | amp | **aliased λ** | **aliased ridge axis** |
|---|---:|---:|---|---|---:|---:|---|
| 1 | 160 m | 5.12 | ok | ok | 2.521 m | 160 m (clean) | 22.4° |
| 2 | 88 m | 2.82 | ok | **FAIL** | 1.008 m | 88 m (faceted zigzag) | 67.6° |
| 3 | 42 m | 1.34 | **FAIL** | **FAIL** | 0.361 m | **48.1 m** | **41.9°** (true 130.5°) |
| 4 | 20 m | 0.64 | **FAIL** | **FAIL** | 0.115 m | **139.0 m** | **7.1°** (true 141.5°) |
| 5 | 9.5 m | 0.30 | **FAIL** | **FAIL** | 0.034 m | **91.0 m** | **55.6°** (true 31.5°) |

Sub-Nyquist waves do not disappear — they **fold back into large, perfectly coherent ridge
families**. The 20 m chop becomes a **139 m ridge train at 7.1°**, i.e. ridges running almost
exactly along the Z grid axis, evenly spaced to the horizon.

**That is the corduroy, and it is geometric, not artistic.**

Aggravating factor: `WaterSystem.js:144-145` sets the mesh position to the raw camera position
with **no grid snapping**, so the sampling lattice slides continuously beneath a world-locked
wave field. The aliased pattern is pinned to the viewer and slides with them — it never reads
as waves passing by.

### 1.2 Wave directions are clustered into three axes, two of them near-parallel pairs

| # | λ | direction | heading | ridge axis (mod 180°) |
|---|---:|---|---:|---:|
| 1 | 160 m | (0.92, 0.38) | 22.4° | **22.4°** |
| 5 | 9.5 m | (−0.85, −0.52) | 211.5° | **31.5°** |
| 2 | 88 m | (0.38, 0.92) | 67.6° | 67.6° |
| 3 | 42 m | (−0.65, 0.76) | 130.5° | **130.5°** |
| 4 | 20 m | (0.78, −0.62) | 321.5° | **141.5°** |

Waves 1 & 5 are **9.0° apart**; waves 3 & 4 are **11.0° apart**. Only three distinct ridge
orientations across five components, two of them near-parallel doublets that constructively
reinforce into long straight ridges.

**Landmine:** `setWindDirection` (`:182-193`) makes this dramatically worse. At the default 45%
spread it packs all five waves into a **45° fan with wave 0 exactly on the wind axis** —
maximal corduroy — and permanently discards the authored directions. It only fires if the Wind
Direction slider is touched, but it is one drag away.
`randomizeSeaSpectrum` (`:166-180`) is no better: it produces exactly **two** direction
clusters, and three of its five wavelengths are still sub-Nyquist.

### 1.3 Horizontal displacement is hardcoded to 0.35, so crests never sharpen

`:207` and `:209`:

```js
p.x.addAssign(a.mul(w.dx).mul(cos(f)).mul(0.35));
p.z.addAssign(a.mul(w.dz).mul(cos(f)).mul(0.35));
```

Not a uniform, not exposed. With `steepness·sea = 0.099` for the primary swell, the effective
Q·ka ≈ 0.035 — about **3% of the value at which a Gerstner crest begins to sharpen**. The
result is a pure sinusoid, not an ocean.

Meanwhile `waveNormal` (`:233-250`) shades **as if Q = 1** and also omits
`swellWavelengthUniform` from its `q` term. The lighting describes a surface that does not
exist.

### 1.4 Normals and geometry disagree by construction

`waveNormal` is fed `positionWorld.xz` and evaluates the **continuous** wave field; the mesh
carries the **31.25 m-sampled** field. Shading shows waves the silhouette does not have.

Also: `waveCrest` and `waveNormal` are evaluated at the *already horizontally displaced*
position rather than the parametric grid coordinate, so foam and tint are sampled at a
different point from the vertex they belong to. Small (max ~0.88 m) but wrong.

### 1.5 The surface is genuinely near-flat as configured

Max normal slope is `Σ(steepness) · sea = 0.63 × 0.45 = 0.284` ⇒ ~16° maximum tilt, and only
if all five components align. `seaUniform = 0.45` (`:27`) halves everything.

---

## Part 2 — Where the white static comes from

`:377-382`:

```js
const glitter = pow(max(dot(N, H), 0.0), 500.0).mul(mix(0.4, 3.4, glitterNoise));
```

**Exponent 500 on a per-pixel-aliased normal.** A specular lobe that narrow is a delta
function; feed it a normal that is effectively random per pixel and you get isolated
blown-out pixels with no spatial or temporal coherence — textbook TV static.

Real glints require the normal to be **filtered** (LEAN / Toksvig / roughness widening with
the pixel footprint). `grep dFdx|fwidth|roughness|mipLevel` over the file returns **nothing**.
At 500 m with a ~15 m eye height a pixel spans ~17 m of water; at 1 km, ~66 m. The 9.5 m and
20 m normal terms alias per-pixel from ~300 m outward; the FBM (feature size 0.12–1.2 m)
aliases from ~10 m outward.

Compounding:
- `effectiveDetail` (`:346-352`) reaches ~3.6 and multiplies a raw **height difference**, never
  divided by the 0.1 m epsilon — so it is not a slope. Net normal perturbation of order
  0.15–0.7 on a unit vector: random tilts of 8–35°.
- Intensity is multiplied up to **3.4×** by `glitterNoise` and added on top of the sky
  reflection with no clamp in this node.
- It never fades: `:382` floors the LOD factor at **0.4** at any distance.

`WaterSparkles.js` is **not** the source — it is not imported anywhere.

### 2.1 The distance LOD makes the horizon worse, not better

`:330-333`, threshold 1800 m. Beyond it the LOD kills FBM detail normals and colour turbulence
entirely — but it does **not** kill the analytic Gerstner normal, which keeps full-strength
9.5 m and 20 m components at 8 km, and it floors glitter at 40%.

So beyond 1800 m you get an untextured mirror carrying full sub-metre normal detail plus 40%
of a `pow(…,500)` specular. **That is the horizon static.**

### 2.2 The FBM hash numerically dies at world coordinates

`:266-272`:

```js
const hash2 = Fn(([p]) => {
  const h = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(h).mul(43758.5453)).mul(2.0).sub(1.0);
});
```

Fed **absolute world coordinates**, with `WORLD_LENGTH = 210000` (`BiomeManager.js:27`). The
glitter path uses `xz.mul(2.1)` and `fbm` scales ×4.11 internally, so the hash input reaches
|p| ≈ 8.6 × 10⁵ at the plane edge and ~1.8 × 10⁶ mid-world. `dot(·, 311.7)` puts the `sin`
argument at 10⁷–10⁸, where fp32 ulp is 1–16.

**The angle is quantised coarser than a radian.** Adjacent noise cells collapse onto identical
hashes and the gradients degenerate into a coarse periodic set. The micro-detail is not detail
— it is a low-order periodic artifact that changes discontinuously. Another source of regular
banding *and* a second source of the static.

**Empirical test:** the ocean should look measurably different near the origin than 50 km out.

---

## Part 3 — The shoreline was never written

**Phase 1 and Phase 3 of `WATER_SHORE_PLAN.md` shipped. Phase 2a — the entire shore look — was
never implemented.**

| Plan item | Status |
|---|---|
| Phase 1 — `TerrainDepthField`, uniforms, `WaterSystem` wiring, `main.js` hooks | **Done and working** |
| 2a.1 sample depth in shader | **Not written** |
| 2a.2 depth colour ramp / sand band | **Not written** |
| 2a.3 depth-driven opacity + `depthWrite=false` + `renderOrder` | **Not written** |
| 2a.4 shoreline foam band | **Not written** |
| 2a.5 shallow-water wave damping (GPU + CPU) | **Not written** |
| 2a.6 refraction wobble | **Not written** |
| 2b.7–10 wave realism | **Not written** |
| Phase 3 — GUI + modal + JSON persistence | **Done — driving nothing** |

### 3.1 Twelve shore uniforms are declared, wired to sliders, and read by nothing

`OpenSeaOcean.js:109-121` declares them all. The only `.sample()` of the depth texture in the
entire repo is **inside a block comment** (`:62-65`) describing how it *should* be sampled.

The real `colorNode` (`:325-394`) and `positionNode` (`:322-323`) contain **zero** references
to `terrainDepthTexNode`, `depthFieldOriginUniform`, `depthFieldSizeUniform`,
`depthFieldValidUniform`, `waterLevelUniform`, `sandColorUniform`, `shoreShallowColorUniform`,
`shoreDepthUniform`, `shoreOpacityUniform`, `shoreFoamWidthUniform`, `shoreFoamSpeedUniform`,
`shoreFoamStrengthUniform`, or `shoreRefractionUniform`.

They are referenced only by `WaterEditorGUI.js:112-119` and `WaterModalUI.js:879-904`.
**The eight shore sliders in the water modal move uniforms no shader consumes.**
`environment_settings.json` even persists a `presets/*/water/shore` block — and nothing in
`src/` reads that file at all.

Because the TSL graph never references them, they are almost certainly stripped at graph build
and never reach the WGSL.

### 3.2 The depth field itself works perfectly

- `WaterSystem.js:50` — `new TerrainDepthField(512, 4000, 32)` ⇒ **7.81 m per texel**, footprint
  matches the terrain mesh exactly.
- `main.js:1805` `rebuildDepthField()` inside `updateTerrainGeometry()`; `main.js:4668`
  `tickDepthField()` every frame.
- `TerrainDepthField.js:141-147` bakes 32 rows/tick = 16,384 `getWorldHeight` calls per frame,
  262,144 total, 16 ticks. Double-buffered, published atomically with its origin.
- `depthFieldValidUniform` correctly reaches `1.0` (`:171`) ~16 frames after the first terrain
  build.

**The infrastructure is correct, live, and feeds nothing.**

> Fixed 2026-08-21: the bake's 262,144 streaming samples were blowing the 24,000-entry
> `_islandCache` in `TerrainGenerator.js` ~11 times per rebuild, and each `clear()` also wiped
> the terrain rebuild's own locality. Cap raised to 96,000 with oldest-half eviction instead of
> a full clear.

### 3.3 Why the shore edge is black — it is not a shadow

Looking down at shallow water, `dot(N,V) ≈ 0.7`, so the Fresnel term (`:372-375`) collapses to
**0.022**. The sky reflection that brightens the distant ocean vanishes and you get essentially
pure body colour: linear `(0.037, 0.20, 0.23)`.

`PostProcessing.js:25` sets `outputColorTransform = false`, so there is **no sRGB encode**.
That linear value writes as 8-bit **(9, 51, 59)** — visually black.

Bright, fully-lit `MeshStandardNodeMaterial` terrain against near-black water, hard boundary.
Not a shadow, not the terrain ramp, not depth sorting. Shadows are ruled out entirely: the
water is `MeshBasicNodeMaterial` and receives no lighting at all.

### 3.4 Why the waterline is blocky — both meshes are 31.25 m/quad

The terrain is 4000/128 = 31.25 m. The water is 16000/512 = **31.25 m**. Two 31 m grids
intersecting produce exactly that stair-stepping.

And `getWorldHeight` returns a flat **−5.0** wherever `mask === 0`
(`TerrainGenerator.js:144-145`), so the seabed is a plateau that jumps to island height across
a single 31 m polygon. **There is no shelf for a gradient to live on even if one existed.**

### 3.5 Water is 92% opaque everywhere

`:393` — `return vec4(color, waterOpacityUniform)` with `waterOpacityUniform = 0.92` (`:31`).
Constant from the abyss to a centimetre over the sand.

The archipelago biome already paints a wet-sand → golden-sand ramp
(`terrain-archipelago.js:40-56`). It contributes **8%** and is invisible.
**There is no beach because the beach is underneath opaque water.**

Also: `transparent = true` and `side = DoubleSide` are set (`:317-319`) but `depthWrite` is
left at its default `true`, and the mesh has **no `renderOrder`**. Plan item 2a.3 required
`depthWrite = false` plus an explicit render order. Not currently causing the black, but it
will bite the moment depth-faded alpha is introduced.

### 3.6 There is no surf line

The only foam term (`:384-388`) gates on `smoothstep(1.0, 2.0, crest)` — **wave height, not
water depth**.

Correcting the old plan: this *does* fire (max crest ≈ 4.04 m), so open-ocean whitecaps work.
But foam at the shoreline is statistically identical to foam 5 km out. There is no
`smoothstep(shoreFoamWidth, 0.0, depth)` band, no run-up oscillation, no waterline highlight.

And because 87% of the amplitude sits in the 105–258 s components (see headline), the foam
patches are quasi-static too.

### 3.7 Waves keep 100% amplitude at zero depth

`wavePosition` (`:200-212`), `waveCrest` (`:253-261`) and `getWaterHeightAt` (`:402-412`) have
**no depth term**.

The water plane sits at `y = 2.4`; the archipelago wet-sand band is `h = 2.0–2.8`. A ±2.5 m
primary swell drives the surface from **−0.1 to +4.9**, straight through the entire beach face,
every cycle. The waterline is not merely coarse — it is **swinging several metres inland and
back** continuously.

---

## Part 4 — Dead code and loose ends

- **`SeabedFloor.js`, `WaterFloor.js`, `WaterDepthIntersection.js`, `WaterSparkles.js`,
  `WaterWaveSimulation.js` — none are imported anywhere.** `main.js` imports only
  `WaterSystem`, `WaterModalUI`, `WaterEditorGUI` and six uniforms from `OpenSeaOcean`.
  `SeabedFloor` and `WaterFloor` also use raw GLSL (`gl_FragColor`, `ShaderMaterial`) and
  **cannot run under `WebGPURenderer`** regardless. There is nothing under the water except
  the terrain plane.
- **`objectRippleDisplacement`** (`:215-230`) is defined and never called, and
  `objActiveUniform` is hard-zeroed every frame (`WaterSystem.js:152`). **Zero object
  interaction with the water.**
- **The horizon fade barely engages.** `:391` uses `smoothstep(8000.0, 15500.0, camDist)`, but
  the plane is 16000 wide and camera-centred, so the mesh edge sits at **8000 m** along the
  cardinal axes, where the fade is exactly 0. It reaches only ~44% at the extreme corners. Along
  ±X/±Z the ocean terminates at full saturation with no atmospheric blend.
- **Module split:** `WaterSystem.js:1` imports `three` while `OpenSeaOcean.js:15` imports
  `three/webgpu`. The `Mesh`/`PlaneGeometry` handed to the renderer come from a different module
  instance than the node material. It works, but it is fragile.
- **`terrainScale`** (`main.js:4990`) is computed and never applied to `terrain.scale` — dead
  variable. Harmless: it means the terrain and depth-field footprints never diverge at altitude.

---

## Suggested order when this is picked up

1. **Fix the dispersion relation** (`√(g·k)` → `√(g/k)`, both `:146` and `:161`, plus the CPU
   path at `:408`). One line, and it is the difference between a still image and an ocean.
   Do this first and re-evaluate everything else — a moving surface may change what still
   looks wrong.
2. **Move sub-Nyquist waves out of geometry.** Geometry carries swell only (λ > ~125 m);
   everything shorter becomes normal/detail. This is the corduroy fix.
3. **Snap the water mesh to a grid** so the sampling lattice stops sliding under the wave field.
4. **Filter the specular** — widen roughness with the pixel footprint, or drop the exponent
   hard with distance. This is the static fix.
5. **Then shore:** sample the depth field that already exists, and implement 2a.1–2a.6.
   Depth-based wave damping (2a.5) also fixes the swinging waterline.
6. Re-seed the wave directions with real spread, and fix `setWindDirection` so it cannot
   collapse the spectrum into a 45° fan.


---

# What was fixed — 2026-08-21

| Finding | Status |
|---|---|
| Inverted dispersion, sqrt(g*k) to sqrt(g/k) | **Fixed.** Primary swell period 258 s to 14.8 s |
| Sub-Nyquist waves aliasing into corduroy | **Fixed.** Re-authored spectrum, geometry weight per wave |
| Ridge-axis doublets 9 deg apart | **Fixed.** New spread, 17 deg minimum separation |
| setWindDirection collapsing the spectrum | **Fixed.** New fan, long swell nearest the wind axis |
| randomizeSeaSpectrum two-cluster / sub-Nyquist | **Fixed.** Golden-angle spread, Nyquist-safe ladder |
| Hardcoded 0.35 horizontal chop | **Fixed.** chopStrengthUniform, default 0.75 |
| waveNormal shading a surface that does not exist | **Fixed.** Now includes chop + swell wavelength |
| Detail normal used height diff, not slope | **Fixed.** Divided by the sample epsilon |
| pow(.,500) specular on aliased normals (static) | **Fixed.** Lobe widens + gain drops with footprint |
| Mesh sliding under a world-locked wave field | **Fixed.** Grid-snapped to the 31.25 m cell |
| CPU buoyancy disagreeing with geometry | **Fixed.** Mirrors the geometry weight |
| Shore uniforms declared but never read | **Fixed.** Depth field is now sampled |
| Flat 0.92 opacity everywhere | **Fixed.** Depth-driven alpha, 0.10 at the waterline |
| No sand / shallow colour ramp | **Fixed.** Depth-graded, quadratic falloff |
| No surf line (foam gated on wave height) | **Fixed.** Depth-gated band + travelling run-up |
| Waves at full amplitude in zero depth | **Fixed.** Vertex-stage depth damping |
| depthWrite true, no renderOrder | **Fixed.** depthWrite=false, renderOrder=10 |
| Camera dipping under the sea | **Fixed.** Rig lifted to clear the crests |
| Depth bake thrashing the island cache | **Fixed.** Cap 24k to 96k, oldest-half eviction |

## Verified

- Geometry waves at **10.88 / 6.88 / 4.51** samples per wavelength (all above the 4x threshold);
  44 m and 19 m carry **zero** geometry weight.
- Periods: **14.8 / 11.7 / 9.5 / 7.3 / 5.3 / 3.5 s**.
- Full WGSL compile of scene + post chain, no errors, including the vertex-stage depth sample.
- Depth field bakes in exactly **16 ticks** and matches getWorldHeight exactly.
- Shoreline transect: alpha 0.92 to 0.10 across the waterline, surf foam peaking at **0.99**
  exactly at depth 0 and falling off both ways.

## Still open

- **Not visually reviewed.** Everything above is verified numerically and by compilation. Nobody
  has looked at it running. Colour and intensity values are first estimates.
- **Terrain draw distance.** The terrain plane is 4000x4000 (2 km from the player) while the
  water is 16000x16000 (8 km). Land runs out 4x sooner than the ocean, which is why the terrain
  edge is visible with fog off. Needs a low-resolution far-terrain ring.
- **FBM hash precision death at world coordinates** (part 2.2) - not addressed.
- **Horizon fade never engages** (part 4) - not addressed.
- **objectRippleDisplacement** is still dead code; no object interaction with the water.

---

# Round 2 — surface realism, 2026-08-21

The corduroy and the frozen ocean were gone, but the surface still read as a displaced rubber
sheet. Five complaints, five causes. All are in `src/WaterAnime/OpenSeaOcean.js`; every new knob
is a slider on the new **Surface** tab of the ocean editor.

| Complaint | Cause | Fix |
|---|---|---|
| Specular grain, pixel sparkle | FBM detail down to 12 cm was point-sampled; a pixel covers that much water by ~120 m out, so a `pow(.,420)` lobe was reading random per-pixel normals | Band-limited FBM (`fbmBL`) fades each octave as it approaches the pixel footprint; the removed slope variance is converted into roughness (`gloss`), which widens and dims the lobe instead of dropping the detail |
| Round detached foam clumps | `smoothstep(0.5,0.95, fbm) * smoothstep(1,2, crest)` — isotropic noise gated on crest HEIGHT | Foam gated on the displacement **Jacobian** (`waveSurface().y`). Foam is born on the crest line and inherits its shape. Lagged Jacobian samples (t−1.1 s, t−2.7 s) leave a dissipating trail behind the moving crest; the foam texture is stretched along the swell axis |
| Soft rounded mounds, no trochoid | `Q = 0.75` put `SUM(Q*a*k)` at **0.095** of a cusp. The steepness column is scaled by `sea = 0.45`, which the earlier note missed | `Q = 4.5` → `SUM(Q*a*k) = 0.567`. Plus a Stokes second-order term `−0.5*k*a²*cos(2f)`, Nyquist-gated on its own half-wavelength via `geo2`, which pinches the peak and flattens the trough without changing wave height |
| Flat turquoise patches, no SSS | `pow(dot(V, sunDir),3) * crest` — a screen-wide term with no geometry in it | Backlight through the crest: `pow(dot(V, −normalize(L + N*distortion)), p)` gated on **slope** and elevation, so it peaks on thin steep lips |
| No depth extinction, no aerial perspective | Deep↔shallow mixed by crest height; horizon was one `smoothstep(8000,15500)` | Per-channel Beer-Lambert `exp(−sigma*d*2)` with `sigma = (0.75, 0.30, 0.16)/m`, so red dies in ~1 m and the turquoise→blue ramp is physical rather than painted. Aerial perspective is now exponential from the camera |

Also fixed along the way:

- **Whitecaps never fired.** The Jacobian threshold shipped at 0.58 but the surface bottomed out
  at J = 0.71, so foam coverage was exactly 0%. Threshold is now calibrated against the measured
  minimum (0.49 at the default sea state) — 0.66 gives ~6% coverage.
- **The surf line was invisible.** Alpha at the waterline is 0.10, and foam was multiplied by it.
  Foam is aerated spray sitting *on* the water, so alpha is now `max(depthAlpha, foam)`.
- **Buoyancy read the wrong point.** A Gerstner surface is parametric; sampling height at the
  world position ignores the horizontal displacement, and that error scales with Q. Two
  fixed-point iterations invert it — mean error 1.4 cm on ~9 m waves.
- **Grazing pixels lost all texture.** A grazing pixel is a long thin sliver. Filtering to its
  long axis smooths near water into a sheet, so the footprint is split: the short axis governs
  how much surface detail survives, the long axis governs how wide the specular lobe gets.
- `shoreRefractionUniform` was declared but never read; it now displaces the sea-bed lookup by
  the surface normal, so the sand ripples under the waves.

Verified by generating the material's WGSL headlessly and compiling it on the real WebGPU
device: 0 errors, 0 warnings, vertex 11.5 KB / fragment 121 KB.

## Follow-up — the "odd lines", same day

Raising Q to 4.5 exposed a latent error in `waveNormal`. Differentiating the Gerstner map

```
P = (x + SUM Q*a*d.x*cos f,   SUM a*sin f,   z + SUM Q*a*d.z*cos f)
```

gives `dP/dx = (1 - SUM Q*a*k*d.x^2*sin f,  SUM a*k*d.x*cos f,  -SUM Q*a*k*d.x*d.z*sin f)`.
**Q appears on the horizontal components only** — chop drags the surface sideways, it does not
make the wave taller. The code applied the same `q` (chop included) to the vertical rise as well.

Measured against the true slope of the geometry over an 800 m patch:

| | mean tilt | max tilt |
|---|---:|---:|
| `waveNormal` as written | **13.0 deg** | **34.0 deg** |
| correct derivation | 3.0 deg | 8.5 deg |
| true slope of the displaced geometry | 2.5 deg | 7.7 deg |

At the old `Q = 0.75` this was a harmless 25% undershoot. At `Q = 4.5` it became a 4.5x
overshoot, and a `pow(.,520)` specular lobe riding 34-degree normals drew a bright line along
every crest — the "odd lines". Fixed; the shading normal now matches the geometry it describes.

Two knock-on retunes, both forced by the same change:

- The SSS steepness gate was `1 - N.y`, which is a few thousandths once the normals tilt only a
  few degrees. Now `length(N.xz)` (the sine of the tilt), scaled to reach 1.0 at the steepest crests.
- `swellLostVar` lost its Q factor and dropped ~20x, so the roughness constant went from 800 to
  20000 to keep the specular lobe running 520 (close) down to ~40 (a few hundred metres out).

Ruled out along the way, with evidence rather than argument: the noise hash does **not** lose
precision at world-scale coordinates (290 unique values per 400 samples in f32), and neither the
Jacobian whitecap mask nor the anisotropic streak noise shows linear structure when rendered
over a 300 m patch.
