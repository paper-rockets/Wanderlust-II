# Render Performance, Day/Night & Ghibli Foliage — Audit and Implementation Plan

Target build: `E:\Z FUCK CLAUDE` (WebGPU).
Renderer: `WebGPURenderer` (`src/core/Engine.js`). **All shader work must be TSL node-based.
Raw GLSL `ShaderMaterial` / `gl_FragColor` / `WebGLRenderTarget` will not run.**

Reported symptoms: ~3 FPS on a 4K monitor; daytime blown out and unusable; night almost
black with no star field; no trees in the Ghibli biome.

Targets: mobile, tablet, desktop, 4K. **30 fps at 4K is the goal, not 60.**

Web version of this document (same content, easier to read):
<https://claude.ai/code/artifact/51fabb02-f132-4d27-9dc6-500c44c0279e>

---

## 0. THE DUSK LOCK — read this first

The Golden Hour Dusk render is the one look that is signed off. It is **off limits**.
Treat as read-only:

- `envConfigs[1]` — the Dusk row in `src/main.js`
- the `'Golden Hour Dusk (Default)'` preset block in `src/main.js`
- `uDuskFactor` and every expression it feeds in `src/shaders/atmosphere/proceduralSky.js`
- `uRolloffKnee = 0.75` and `buildSoftClipNode` in `src/core/PostProcessing.js`
- god-ray defaults `uIntensity 0.85`, `uDecay 0.927`, `uDensity 0.50`

**Why it is fragile:** `postProcessing.outputColorTransform = false` disables tone mapping
entirely, so the soft-clip knee at 0.75 is the only ceiling in the pipeline. Dusk's saturated
orange light was hand-tuned to sit just underneath it. This is also the direct cause of the
blown-out daytime (see finding 03).

**The rule that makes changes safe:** every new lighting or sky control gets a **neutral value
at dusk** — multiply by `1.0`, add `0.0`. Day and night can then be tuned freely while dusk
provably passes through unchanged.

**Acceptance test for every change:** load on the default dusk preset, screenshot, apply the
change, screenshot from the same position. The images must be identical. If an agent reports
"dusk looks slightly better now", that is a failure, not a bonus.

Verify mechanically, not by eye:

```bash
git show HEAD:src/main.js | tr -d '\r' | grep "Golden Hour Dusk\|{ name: 'Dusk'" | sort > /tmp/b.txt
grep "Golden Hour Dusk\|{ name: 'Dusk'" src/main.js | tr -d '\r' | sort > /tmp/a.txt
diff /tmp/b.txt /tmp/a.txt && echo "dusk unchanged"
```

**Known exception:** the output dither (finding 10) alters every pixel by at most `1/255`,
dusk included. It is below perceptual threshold and it is what fixes the banding, but it is
not a strict zero-change guarantee. Set *Performance → Dither* to `0` for a bit-exact dusk.

---

## 1. Summary in plain language

Three specific pieces of code were eating the frame. The trees were never the problem — they
are the cheapest thing in the project.

1. **The 3 FPS was one effect.** God rays run a 32-iteration loop with a dependent texture
   read per iteration, per pixel, every frame — and never checked whether the sun was
   visible. At 4K with *Render HD* on, that is **1.06 billion texture fetches per frame**. It
   ran at full cost at night, finding nothing.

2. **Daytime was blown out by a disabled setting.** Tone mapping is switched off, so anything
   brighter than 0.75 gets flattened to white. Dusk survives because its light is saturated
   orange — the blue channel never reaches the ceiling. Day's near-white light crosses on all
   three channels at once.

3. **Night had no stars because the code was deleted and never replaced.** A comment claimed
   the procedural sky handled stars; the sky shader contained no star code at all.

Also worth knowing: the **"Global Brightness" slider did nothing**. It wrote
`renderer.toneMappingExposure`, which is inert while post-processing is on. Every adjustment
made with it was a no-op. It is now wired to a real exposure trim.

---

## 2. Status

| # | Work order | State | Notes |
|---|---|---|---|
| WO-1 | Frame governor / render scale | **Done** | `src/core/DeviceTier.js` (new) |
| WO-2 | God-ray gate + sample tiering | **Done** | half-res still outstanding |
| WO-3 | Day exposure & night lighting | **Done** | dusk pinned to exactly 1.0 |
| WO-4 | Star field in procedural sky | **Done** | |
| WO-5 | Terrain rebuild cost | **Partial** | cache + dead-work fixed; time-slicing outstanding |
| WO-6 | Ghibli tree system | **Done** | `src/entities/GhibliTreeSystem.js` (new) |
| WO-7 | Tree editor panel | **Done** | |
| WO-8 | Sky octave tiering | **Partial** | render-order change deliberately not done |
| WO-9 | Frustum culling restored | **Done** | |
| WO-10 | Flight model registry cleanup | **Done** | |
| WO-11 | Milky Way quality | **Done** | |
| WO-12 | Output dither / anti-banding | **Done** | |

### Files changed

```
M src/config/FlightModelsConfig.js
M src/core/Engine.js
M src/core/PostProcessing.js
M src/main.js
M src/shaders/atmosphere/proceduralSky.js
M src/world/TerrainGenerator.js
+ src/core/DeviceTier.js          (new)
+ src/entities/GhibliTreeSystem.js (new)
```

### Measured

| Metric | Before | After |
|---|---:|---:|
| God-ray fetches/frame, 4K worst case | 1,061 M | 265 M — or 0 at night |
| Max framebuffer at 4K | 33.2 Mpx | 8.3 Mpx |
| Terrain colour evaluations per vertex | 2 | 1 |
| Island-data cache hit rate in terrain loop | ~0 % | high (keyed map) |
| Tree atlas texture uploads | 9 | 1 |
| Ghibli trees placed (default density) | 0 | 1,285 |
| Tree rebuild cost per frame | — | 1.5 ms avg / 4.4 ms peak |

**Not yet measured:** actual FPS on the 4K monitor. The browser pane used for verification
does not composite, which stalls `requestAnimationFrame` entirely, so systems were validated
by driving them directly and by forcing `compileAsync` + one `renderAsync`. The arithmetic on
the two big wins is solid — 4× fewer pixels, and a pass that stops running at night — but the
real number is unconfirmed.

---

## 3. Findings, ranked by measured cost

### 01 — God rays run at full resolution, always, even below the horizon
`src/core/PostProcessing.js`

32-iteration loop, one dependent texture read each, per pixel, every frame. No early exit, no
downsampling, no sun-visibility check.

| Display | Pixels | Fetches/frame | Est. GPU cost |
|---|---:|---:|---:|
| 1080p, DPR 1 | 2,073,600 | 66 M | ~4 ms |
| 4K, DPR 1.5 (Engine clamp) | 8,294,400 | 265 M | ~30 ms |
| 4K, DPR 2 (*Render HD*) | 33,177,600 | 1,061 M | ~120 ms+ |

The bottom row is the 3 FPS. `Engine.js` clamped DPR to 1.5, but the *Render HD* toggle in
`main.js` silently overrode it to 2.0.

**Fixed.** The node is now **removed from the shader graph** when the sun is off screen —
multiplying by a uniform saves nothing, the loop still executes. Asymmetric on/off thresholds
(`>0.01` on, `<0.001` off) give hysteresis so a sun on the horizon cannot thrash the shader
recompile. Sample count is tiered 32 / 24 / 16 / 8, with `uDensity` compensated so ray length
is unchanged.

**Outstanding:** half-resolution ray buffer (needs a second render target in the TSL pipeline).

---

### 02 — No resolution budget; the renderer scaled up on the screens that needed scaling down
`src/core/Engine.js`, `src/main.js` resize handler

Pixel ratio was set once at boot and once from the HD toggle. The `resize` handler called
`setSize()` but never re-evaluated pixel ratio, and nothing measured whether the machine could
sustain the resolution it was given.

**Fixed.** New `src/core/DeviceTier.js` caps by **total pixel count**, not device ratio:

| Tier | Pixel budget | God-ray samples | Sky octaves | Tree density |
|---|---:|---:|---:|---:|
| mobile | 2.3 M | 8 | 2 | 0.35 |
| tablet | 4.0 M | 16 | 3 | 0.55 |
| desktop | 8.3 M | 24 | 4 | 1.0 |
| desktop-high | 8.3 M | 32 | 4 | 1.6 |

8.3 M is 4K native, so a 4K panel renders at native with no upscale and no downscale.

**Adaptive resolution** samples frame time over a 90-frame window and moves render scale in
0.1 steps, floored at 0.6, targeting 33 ms. It uses the **median, not the mean**, so one
terrain hitch cannot drop the whole resolution — plus a 1.5 s cooldown and a 3-window "good
streak" before scaling back up. Touching the manual *Render Scale* slider turns auto off so
the two cannot fight.

Tiers can be forced for testing: `localStorage.wl_forceTier = 'mobile'`.

---

### 03 — Daytime blown out because tone mapping is disabled
`src/core/PostProcessing.js`, `src/core/Engine.js`

`Engine.js` sets `ACESFilmicToneMapping` with exposure 1.8. `PostProcessing.js` then sets
`outputColorTransform = false`, which makes **both inert**. Nothing tone-maps. The only
ceiling is `buildSoftClipNode`, a Reinhard roll starting at 0.75.

| Phase | Ambient | Directional | Total | Light colour | Result |
|---|---:|---:|---:|---|---|
| Day | 1.2 | 2.4 | 3.6 | `#fffaeb` near-white | all 3 channels clip → white |
| Dusk | 1.1 | 3.2 | 4.3 | `#ffaa00` saturated | blue stays low → colour survives |
| Night | 0.8 | 1.8 | 2.6 | `#88bbff` dim blue | dome forced to near-black |

Dusk has *more* total light than day and looks better, because saturation keeps one channel
away from the ceiling. Day's near-white light pushes red, green and blue over the knee
simultaneously and everything above 0.75 collapses toward the same white.

**Fixed** with a per-phase exposure multiply applied immediately before the soft clip:

```js
// src/core/PostProcessing.js — rgb only; scaling alpha would be wrong
export const uPhaseExposure = uniform(1.0);

// src/main.js — dusk has NO slider and is hard-pinned
timePhase === 0 ? params.dayExposure      // 0.62
: timePhase === 2 ? params.nightExposure  // 1.35
: 1.0                                     // DUSK — locked
```

The lerp also **snaps** to the target once within 0.0005, so returning to dusk from another
phase lands on exactly 1.0 rather than 0.9999.

Day light energy also cut at source (`ambI 1.2 → 0.75`, `dirI 2.4 → 1.6`) and hue pulled off
pure white. Night moonlight raised (`0.8/1.8 → 1.05/2.2`). Both phases have full colour and
intensity controls in a new **Daylight** folder and the existing **Moonlight & Night** folder.

---

### 04 — Night had no stars: the code was deleted and never replaced
`src/main.js`, `src/shaders/atmosphere/proceduralSky.js`

An 8,000-point star field was built, added to the scene, then hard-disabled every frame:

```js
// Hide old star field — procedural sky handles stars now
starMaterial.opacity = 0;
starField.visible = false;
```

The procedural sky did not handle stars. Searching it for "star" returned nothing. Its entire
night contribution was one constant, mixed at factor 1.0 — which also threw away the horizon
gradient, sun haze and mid-sky band, leaving a flat dome at ~2 % luminance.

**Fixed.**

- Two star scales — coarse bright over fine faint — from hashed 3D cell lookup on the view
  direction, jittered within each cell so they do not sit on a visible lattice
- Magnitude variation (a few bright, many faint) and uncorrelated slow twinkle
- Stars fade near the horizon, as real ones do through thicker atmosphere
- Night mix is now **0.82, not 1.0**, so a trace of horizon gradient survives and the world
  keeps a skyline
- Dead `starField` object and its per-frame writes deleted
- New sliders: Star Density, Star Brightness, Star Twinkle, Night Sky Lift — **all multiplied
  by `uNightFactor`**, which is exactly 0 at dusk

---

### 05 — Terrain rebuild is a 55 ms freeze, half of it duplicated work
`src/main.js` `updateTerrainGeometry`, `src/world/TerrainGenerator.js`

Every 150 world units the whole 4000×4000 plane is rebuilt on the main thread in one blocking
loop. At res 128 that is 16,641 vertices, each triggering ~137 simplex-noise evaluations:

| Per vertex | Calls | Note |
|---|---:|---|
| `getWorldHeight` (centre + 4 normal taps) | 5 | each = island data + 2 biome height fns |
| `getWorldColor` | 2 | **second was dead** — result overwritten |
| `getBiomeAt` | 1 | recomputed island data again |
| `getPathStrength` | 1 | 2 noise taps |

The one-entry memo cache in `getIslandData` made it worse: the loop interleaves `(x,z)`,
`(x−12,z)`, `(x+12,z)`… so every call evicted the previous one. Hit rate ~0 %.

Measured: **2.28 M noise calls, ≈55 ms in Node.** Browser 1.5–3× slower, phone 5–10× — so
**150 ms to half a second of freeze** on mobile, every few seconds of flight. At res 256 it is
9 M calls and ~220 ms even on desktop.

**Fixed:** deleted the duplicate `getWorldColor`; replaced the single-slot cache with a Map
keyed on coordinates quantised to 0.5 units (stride collision-tested across ±60,000 world
units); hoisted a `new THREE.Color()` that allocated once per vertex; removed a `console.log`
firing at 5 % probability inside the hot loop.

**Outstanding (WO-5b):** time-slice the rebuild across frames, ~2,000 vertices per frame.
Risk: a visible seam if the mesh renders mid-update — double-buffer the position array
(~200 KB) to avoid it. Longer term, move to a Web Worker with a transferable `Float32Array`.

---

### 06 — Sky dome shades every pixel, then gets painted over
`src/shaders/atmosphere/proceduralSky.js`

`renderOrder = -1000` means it draws **first**. Its fragment shader is the most expensive in
the project — three domain-warped FBM evaluations, four octaves each, four hash-and-sin ops
per octave: roughly **48 transcendental ops per pixel**. On a ground shot where terrain fills
70 % of the screen, 70 % of that is thrown away.

**Partially fixed.** FBM octaves are tiered 4/3/2 with amplitudes renormalised per tier, so a
2-octave sky keeps the same overall contrast rather than looking washed out. The night block
is also now behind a **uniform branch** (`If(uNightFactor > 0.001)`), so star and galaxy maths
does not execute at day or dusk at all.

**Deliberately not done (WO-8b).** Giving the sky a **high** render order so depth rejection
kills occluded pixels is worth 40–70 % of the heaviest pass in the scene. It is also the
change most likely to expose latent transparency-sorting bugs, because the current order masks
sorting that was never tested any other way. **Check water surface, ground fog and cloud
sprites explicitly, and keep it as its own revertable commit.**

---

### 07 — Frustum culling was off on every instanced object
`src/main.js` — `frustumCulled = false` in 16 places

Seventeen instanced meshes — ten pine species, rocks, bushes, flowers, four cloud layers,
birds — all had culling disabled. ~970 pine instances plus 300 clouds plus birds were
vertex-shaded every frame regardless of camera direction. The flag was off because the meshes
are recycled around the player, which makes the geometry's bounding sphere stale instantly.

**Fixed** for the tree meshes (the highest instance counts). An explicit `boundingSphere` is
set per frame — centred on the focus point, radius = spawn radius + 120 m. Three.js `Frustum`
honours `object.boundingSphere` over the geometry's, so this is correct and cheap. Padding is
generous on purpose: the saving is the whole-mesh reject, not a tight fit.

Clouds and birds were left alone — few, large, and the pop risk outweighs the saving.

---

### 08 — Tree placement re-randomises, so the forest is never the same twice
`src/main.js` pine recycle pass

The existing pine system uses rejection sampling with `Math.random()`: up to 14 attempts per
instance, capped at 60 per frame across all species.

- **Not deterministic** — fly away and back and the forest is completely different
- **Starved** — the per-frame cap means dense forest fills in visibly slowly
- **Expensive** — every rejected attempt still pays the full noise chain

**Fixed for the new system** with deterministic cell hashing. Same cell always yields the same
trees, forever. No sampling loop, no random, no popping; minimum spacing comes free from the
cell size:

```js
function cellHash(cx, cz, slot) {
  let h = Math.imul(cx, 374761393) + Math.imul(cz, 668265263) + Math.imul(slot, 2654435761);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
```

Retro-fitting the existing pines to the same scheme is optional and would be a separate work
order.

---

### 09 — Three tree files, one atlas, nine texture uploads
`public/assets/Trees/Ghibli/*.glb`

Verified by hashing the embedded images: all three GLBs carry **byte-identical textures**
(base colour `md5 5ae66749…`, normal `9fc7b283…`, roughness `8afb0b1d…`).

| Approach | Textures | VRAM w/ mips |
|---|---:|---:|
| Naive — three separate loads | 9 | ≈48 MB |
| Deduped, all slots kept | 3 | ≈16 MB |
| Deduped, base colour only — **shipped** | 1 | ≈5.3 MB |

Normal and roughness do nothing under a toon material, which quantises lighting to a gradient
ramp. Both dropped, along with the `TANGENT` attribute that existed only to support them
(16 bytes per vertex of pure waste).

---

### 10 — Dark-sky banding
`src/core/PostProcessing.js`

Specific cause: `outputColorTransform = false` means **linear** values land on an 8-bit canvas
with no sRGB encode. sRGB encoding is exactly what normally gives dark tones most of the
available code values. Without it, a night sky spanning linear 0.02–0.08 gets roughly 15
distinct 8-bit values across the whole screen, and every boundary is a visible band.

The sRGB encode cannot be restored — that is the transform dusk was tuned against.

**Fixed** with **TPDF dither** as the final node, after the soft clip. Triangular (sum of two
interleaved-gradient-noise samples) rather than uniform: TPDF is the distribution that fully
*decorrelates* quantisation error from the signal. Uniform noise only reduces banding; TPDF
removes it. Static rather than animated — at 1/255 a fixed screen-space pattern is invisible,
while animated noise reads as shimmer on a still camera.

Slider at **Performance → Dither (anti-band)**; default `1.0` = exactly one LSB.

> This is the one change that alters dusk output, by at most 1/255 per channel. Set to `0` for
> a bit-exact dusk at the cost of the banding returning.

---

### 11 — Milky Way read as blue fog
`src/shaders/atmosphere/proceduralSky.js`

The first implementation was one flat-tinted FBM sampled in an odd projection
(`dir.xz * 6 + dir.y * 4`), which produced a blurry blob rather than a galaxy.

**Rewritten** around a proper **galactic-plane coordinate frame** — a normal plus two in-plane
axes — so noise stretches *along* the band and compresses *across* it. That is what produces
filaments instead of smears. On top of that frame:

- **Three noise scales**: where the band swells, filaments, fine mottling
- **Dust lanes** — independent thresholded noise subtracted from the core. The dark rifts are
  the single biggest thing that makes it read as the Milky Way rather than a bright streak
- **Galactic core** — one brighter, warmer swelling along the band; without it the band is
  uniform and reads as procedural
- **Two colours** — cool blue-white arms blending to a warm core
- **Star density boosted inside the band**, with those stars picking up its colour, which ties
  the glow to the star field instead of layering unrelated fog over it
- Gaussian falloffs (tight core lane at `exp(-30d²)` plus broad halo at `exp(-5d²)`) rather
  than a linear ramp — a hard edge looks like a painted stripe

Controls under **Moonlight & Night → Milky Way**: strength, dust lanes, arm colour, core
colour. Default strength raised 0.5 → 0.9.

---

## 4. The Ghibli tree system

`src/entities/GhibliTreeSystem.js`

### What the assets actually contain

| File | Verts | Tris | Height | Spread | Canopy / trunk verts |
|---|---:|---:|---:|---|---:|
| `Background_Tree_Atlas_001_alt` | 104 | 101 | 11.40 | 11.4 × 29.3 | 98 / 6 |
| `Background_Tree_Atlas_002_alt` | 46 | 36 | 7.44 | 7.4 × 18.2 | 36 / 10 |
| `Background_Tree_Atlas_003_alt` | 114 | 109 | 7.05 | 6.7 × 26.0 | 106 / 8 |

All three ship a custom vertex attribute `_IS_CANOPY` — float, 0 on trunk, 1 on canopy.
**That is the trunk/canopy separation, already baked in by the artist.** No geometry surgery
needed. GLTFLoader lowercases unknown attributes, so it arrives in code as `_is_canopy`.

They are alpha-masked, double-sided card clusters with base at `y = 0`, so they sit on the
ground with no offset. At 36–109 triangles, **geometry is a non-issue** — ten thousand is
700 K triangles, which a phone handles. The cost is entirely **fill rate** from alpha-tested
overdraw, which is why the LOD scheme targets pixels rather than polygons.

### Placement

Deterministic cell hashing on **34 m cells**. Each cell hashes to 0–3 candidates depending on
density. A candidate is kept if:

- biome is Ghibli Land
- terrain height between the min/max elevation sliders
- island mask ≥ 0.35 and path strength < 0.20 (same tests the pines use)
- local slope below threshold, so trees do not grow out of cliff faces

Species comes from a low-frequency field so you get **groves** of one type rather than an even
shuffle, with 18 % mixed undergrowth breaking up the boundaries. Global thresholds are the
measured 33/67 quantiles of that field (`−0.2097` / `0.2093`), so all three get equal share
overall while any given place still favours one. Rotation and ±17 % scale jitter also come
from the hash.

### LOD

Three bands differing in **material, not geometry** — at ~100 triangles there is nothing worth
decimating and every millisecond is in the fragment stage:

| Band | Range | Sides | Wind | alphaTest | Purpose |
|---|---|---|---|---:|---|
| near | 0 – 140 m | double | yes | 0.35 | full quality where it is seen |
| mid | 140 – 420 m | single | yes | 0.50 | halves fragment work |
| far | 420 – 1100 m | single | no | 0.62 | silhouette only |
| — | 1100 m + | culled | — | — | terrain tint carries it |

**Raising `alphaTest` with distance is the important trick**: it discards more fragments
earlier, directly buying back the fill rate alpha-masked foliage costs, and reduces the
shimmer thin alpha edges produce once smaller than a pixel.

Nine `InstancedMesh` objects total (3 variants × 3 bands) = nine draw calls.

### Keeping the cost off the frame

A full sweep at 1,100 m visits ~4,200 cells and costs ~30 ms in one burst — a visible hitch
every 55 m of movement. So the **cell walk itself is sliced across 18 frames**, not just the
buffer write. Measured **1.5 ms average, 4.4 ms peak**. The instance buffer is committed only
once the whole field is known, so it is never shown half-populated.

### Density

| Density | Trees within 1,100 m | Reads as |
|---:|---:|---|
| 0.5 | 632 | open parkland |
| 1.0 | 1,285 | default |
| 1.6 | 2,058 | closed canopy |
| 2.0 | 2,296 | maximum |

Variant 001 is 29 m across at source scale and is scaled to 17 m height, so its canopy spans
roughly **43 m** in world units. These are tree *clusters*, not single trunks. At density 1.0
average spacing is ~49 m, so crowns already overlap — from the air that reads as continuous
forest.

### Colour control

The material reads `_is_canopy` and mixes two independently editable ramps:

```
canopy = mix(canopyShadow, canopyLit, heightGradient) → canopyTip at the crown
trunk  = mix(trunkBase, trunkTop, heightGradient)
final  = mix(trunk, canopy, _is_canopy)
```

The atlas is **multiplied** by these ramps rather than replaced, so painted detail survives
while the palette stays editable. A *Texture vs Palette* slider blends between raw atlas and a
flat stylised look. Wind sway is weighted by `_is_canopy` as well as height, so trunks stay
rigid and only the crown moves.

Controls: **Ghibli Trees → Background Tree Atlas** (density, scale, elevation min/max, max
slope, wind, texture-vs-palette, per-tree variation, live instance readout) and a **Colors**
subfolder with five pickers.

---

## 5. Flight model registry (WO-10)

`src/config/FlightModelsConfig.js`

**Facing corrected** — the convention in this file is that correctly-oriented models use
`rotY: 180`; the birds sat at `0` and therefore faced the camera:

| Model | Before | After |
|---|---:|---:|
| American Robin | 0 | 180 |
| Eastern Wood-Pewee | 0 | 180 |
| American Bittern | 0 | 180 |
| Scarlet Macaw | 0 | 180 |
| Blue Morpho Butterfly | 90 | 270 |

**Removed from the picker:** Tropical Parrot, Porco Rosso Seaplane, Stylized WW1 Plane,
Felixstowe F2A.

> The `.glb` files themselves are still on disk in `public/flight_models/`. Only the registry
> entries were removed, which is what takes them out of the picker. Deleting the files is a
> separate, irreversible step — say so explicitly if you want it.

---

## 6. Remaining work orders

Each is self-contained and can be handed to a separate agent.

### WO-8b — Sky render order · high value, high risk
Give the sky dome a high render order so it draws after opaque geometry and depth rejection
kills occluded pixels.
- **Files:** `src/shaders/atmosphere/proceduralSky.js` (`mesh.renderOrder`)
- **Done when:** ground-level frame time drops measurably and nothing sorts wrongly
- **Risk:** the current order masks transparency sorting never tested another way. Check water
  surface, ground fog and cloud sprites explicitly. Own commit so it can be reverted alone.

### WO-2b — Half-resolution god rays · medium
Render the ray pass into a half-res target and upsample; a further 4× on top of the tiering.
- **Files:** `src/core/PostProcessing.js` — needs a second render target in the TSL pipeline
- **Risk:** downsampling a pass reading high-contrast edges causes crawling on thin geometry.
  Bilinear upsample plus a light blur usually handles it; if it still shimmers, 0.75 scale
  keeps most of the saving.

### WO-5b — Time-slice the terrain rebuild · medium
Process ~2,000 vertices per frame with a running index, flagging `needsUpdate` once at the end.
- **Files:** `src/main.js` `updateTerrainGeometry`
- **Done when:** no frame exceeds 20 ms while the terrain grid moves
- **Risk:** visible seam if the mesh renders mid-update. Double-buffer the position array
  (~200 KB) and the problem disappears.

### WO-13 — Real-device mobile pass · validation
The device tiers are an informed estimate, not a measurement. WebGPU on Android is recent and
on iOS newer still.
- **Files:** `src/core/DeviceTier.js` — `PIXEL_BUDGET`, `TIER_SETTINGS`
- **Done when:** each tier holds its frame-time target on representative hardware
- **Note:** force a tier with `localStorage.wl_forceTier`

### WO-14 — Preset compatibility · polish
New keys (`dayExposure`, `nightExposure`, `exposureTrim`, `renderScale`, `autoResolution`, the
tree parameters, the Milky Way parameters) are missing from previously saved presets.
- **Files:** `src/main.js` preset load path
- **Done when:** an old saved preset loads without producing `undefined` uniforms
- **Risk:** an undefined uniform is a black screen, not a warning. Every new parameter needs a
  default at read time.

### WO-15 — Moon rendering · unreviewed
The moon currently renders as a flat white disc with a hard blue ring. Not investigated.

---

## 7. Risk register

**Dusk drift.** The biggest risk. Every change here touches code dusk flows through.
Mitigation is the neutral-value rule plus the mechanical diff check in section 0.

**The soft-clip knee is load-bearing.** `uRolloffKnee = 0.75` and
`outputColorTransform = false` are not mistakes; they are a deliberate workaround for ACES
desaturating the sky, and the file comment says so. Adding a proper filmic curve later is the
architecturally correct fix but would **require retuning dusk**, which is off the table. The
per-phase exposure multiplier works within the constraint rather than replacing it.

**Alpha-masked foliage is a fill-rate trap.** These trees are cheap in triangles, expensive in
pixels. Flying low through a dense grove is the worst case. If frame time spikes near the
ground, **shrink the near-band range rather than thinning the forest** — thinning is visible,
range reduction is not.

**Adaptive resolution can feel like the screen is breathing.** Mitigated with a median filter,
a 3-window good-streak requirement and a 1.5 s cooldown. If it still reads as unstable, widen
the thresholds rather than disabling it — the alternative is a fixed resolution that is wrong
on most machines.

**Preset compatibility.** An `undefined` uniform is a black screen, not a warning. WO-14.

**WebGPU on mobile is uneven.** The tiers are a starting estimate, not a measurement. WO-13.

**Pre-existing noise, unrelated to any of this.** The console shows repeated
`ERR_CONNECTION_REFUSED` against `localhost:9100/api/load-scene` and `/api/list-models` — a
separate editor backend that is not running. Harmless, but it hides real errors.

---

## 8. New GUI controls

| Folder | Control | Notes |
|---|---|---|
| Performance | Auto Resolution | adaptive scaling on/off |
| Performance | Render Scale | manual 0.5–1.0; turns auto off |
| Performance | Detected Tier | read-only diagnostic |
| Performance | Dither (anti-band) | 0 = off, 1 = one LSB |
| Environment → Daylight | Day Exposure | 0.25–1.5, default 0.62 |
| Environment → Daylight | Sunlight / Fill colour + power, sky, fog | |
| Environment → Moonlight & Night | Global Brightness | now functional |
| Environment → Moonlight & Night | Night Exposure | default 1.35 |
| Environment → Moonlight & Night | Star Density / Brightness / Twinkle | |
| Environment → Moonlight & Night | Night Sky Lift | |
| … → Milky Way | Strength, Dust Lanes, Arm Colour, Core Colour | |
| Ghibli Trees → Background Tree Atlas | Visible, Density, Scale, Elevation Min/Max, Max Slope, Wind Sway, Texture vs Palette, Per-Tree Variation, Instances readout | |
| … → Colors | Canopy Shadow / Lit / Tip, Trunk Base / Top | |

**Removed:** *Render HD* (it forced DPR 2.0 on top of the boot clamp — a 4× cost multiplier on
4K, presented as a quality switch).
