# Kiki's Island Flight - Development Log & Architecture

Welcome to the development log for the **Kiki's Island Flight** project! This document serves as the persistent "memory" of the codebase. If an AI agent is reading this on a new machine, use this file to quickly understand the engine architecture, art style, and optimizations we have built so far.

## 🏗️ Core Architecture
- **Single-File Engine**: The entire game (3D rendering, shaders, music synthesis, physics) exists entirely within `index.html`. There are no external assets, no build tools, and no texture images.
- **Three.js**: Built using raw Three.js via CDN.
- **Infinite Procedural Generation**: The world generates infinitely as Kiki flies. Terrain is mathematically calculated using a 2D Simplex noise algorithm to form islands, rolling hills, and vast oceans.
- **Chunking System**: Terrain is built in a 3x3 chunk grid (each chunk is `CHUNK_SIZE` wide) that dynamically updates as the player crosses chunk boundaries.

## 🎨 Art Style & "Ghibli" Look
- **Zero Textures**: No `.png` or `.jpg` textures are used. All models are composed of pure primitive geometries (Icosahedrons, Boxes, Cylinders).
- **Toon Shading**: A custom `MeshToonMaterial` is used universally, fueled by a generated grayscale `DataTexture` gradient map to create sharp, anime-style cell shading.
- **Procedural Colors**: Props and buildings dynamically assign themselves colors from predefined arrays (e.g., roof colors, rock colors) using `.setColorAt` to create vibrant variety without extra draw calls.

## ⚡ High-Performance Instancing
To keep the game running at 60 FPS, all environment props are pooled and recycled:
- **InstancedMesh**: We use `THREE.InstancedMesh` for EVERYTHING (Grass, Flowers, Rocks, Bushes, Trees, Animals, Clouds).
- **Prop Pooling**: Instead of destroying and recreating objects, the `animate()` loop constantly recycles instances. If an instance falls too far behind the player, its matrix is mathematically moved in front of the player and dropped onto the terrain noise height.
- **Current Load**: The engine currently handles over ~35,000 instances simultaneously (25,000 grass blades, 8,000 flowers, etc.).
- **Shadow Optimization**: Shadow casting/receiving is explicitly disabled for micro-props (grass, flowers) to prevent thousands of shadow-map calculations and reduce visual noise.

## 🌅 Dynamic Lighting Engine
- **Time of Day Cycle**: The game features a 3-stage dynamic lighting engine (`day`, `twilight`, `night`) configured in `envConfigs`.
- **Lerping**: When the user clicks the UI button to change the time, the engine smoothly interpolates `scene.background`, `scene.fog.color`, `ambientLight`, and `directionalLight` simultaneously.
- **Atmospheric Fog Syncing**: The `scene.fog` color is mathematically locked to the `scene.background` color. This ensures that distant objects (like clouds) fade naturally into the skybox color rather than creating hard silhouettes.

## 🌊 Custom Water Shader
- The ocean is a single, massive plane extending across the view.
- We injected a custom WebGL Fragment Shader into a `MeshToonMaterial` (`waterMat.onBeforeCompile`).
- **Ripples**: Ripples are generated purely via shader math (`snoise(uv - time)`).
- **Inland Fading**: The fragment shader actively evaluates the macro terrain noise map (`snoise(vWorldPos.xz)`). If the water detects it is over land (like an inland lake or river), it automatically kills the ripple effect to create perfectly glassy inland water.
- **Depth Darkening**: The water shader calculates distance from the camera and smoothly darkens the water toward the deep horizon to give a beautiful sense of oceanic scale.

## ☁️ Colossal Super Clouds (Skybox)
- Instead of using a heavy HDR skybox image, we built an infinite procedural skybox.
- **Cumulonimbus Algorithm**: 450 puffy `IcosahedronGeometry` blobs are mathematically clustered into 18 towering thunderhead formations on the distant horizon (`y: -100 to +1000`).
- **Infinite Pinning**: The entire `instSuperClouds` mesh is pinned to the player's X/Z coordinates during the `animate` loop. You can never reach them, creating a perfect illusion of an infinite horizon at zero CPU cost.

## 🧹 Flight Physics
- Kiki's broom operates on velocity vectors. Holding `Shift` accelerates forward velocity, while WASD/Arrows control Pitch and Yaw.
- **Wind Trails**: When boosting, procedural wind trails dynamically spawn around Kiki, stretch backward, and slowly fade out via an opacity lerp in the animation loop to simulate high-speed flight.

## 🎵 Procedural Audio Engine
- All audio is synthesized purely through the browser's Web Audio API (`AudioContext`).
- A sequence of soft sine/triangle wave chords procedurally plays to create a relaxing, ambient Ghibli soundtrack.
- Wind rushing sounds are generated using a mathematical noise buffer passed through a low-pass filter linked to the player's flight speed.

---

### 📝 Next Steps & Agent Instructions
If you are picking up this project from here, the user loves high-performance, visually stunning features that do not break the "Zero Texture" rule. Prioritize primitive geometry, custom shader injections, and instance recycling for all new features.
