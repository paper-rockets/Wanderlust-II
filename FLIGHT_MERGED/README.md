# Wanderlust - Flight Merged (Pre-WebGPU Milestone)

## Overview
This build represents the advanced multi-biome procedural engine milestone immediately prior to the WebGPU migration. It features multi-biome procedural streaming across 6 dynamic landscapes, advanced particle systems, procedural audio, and high-performance instanced diorama rendering.

---

## Quick Start (Run Locally)

### Development Server
```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```

The application will be accessible at:
- http://localhost:8090/

---

## Controls
- Pitch & Yaw (Steering): W / A / S / D or Arrow Keys
- Boost Flight: Hold Shift (Spawns dynamic aerodynamic wind trails)
- Camera Orbit: Mouse movement / drag
- Time of Day Cycle: In-game UI button (Smoothly lerps between Day, Twilight, and Night)

---

## Key Architecture & Engine Features
- Zero External Texture Rule: 100% of terrain, trees, grass, buildings, clouds, and water are generated procedurally using WebGL primitives and GLSL math.
- Infinite Multi-Biome Chunking: World terrain streams dynamically in a 3x3 grid around the player across 6 distinct biomes:
  1. Plains: Gentle rolling hills and dense wildflower fields.
  2. Ghibli Valley: Emerald grass, procedural Ghibli oaks, and floating seeds.
  3. Lush Jungle: High tropical canopies, crooked trunks, and localized volumetric fog.
  4. Archipelago: Oceanic islands, glassy lagoons, and seagull companion AI.
  5. Mountains: Rugged alpine peaks and dense spruce forests.
  6. Crystal Land: Bioluminescent crystal spires and glowing flora.
- 35,000+ Instanced Props: Micro-props (grass, flowers, rocks, trees) use matrix recycling pool loops (THREE.InstancedMesh) to maintain peak framerates without garbage collection pauses.
- Custom Ocean Fragment Shader: Shader logic (waterMat.onBeforeCompile) generates procedural surface ripples, depth darkening, and inland water ripple-suppression over island heightmaps.
- Infinite Cloud Super-Clusters: 450 puffy IcosahedronGeometry shapes clustered into 18 cumulonimbus formations pinned infinitely to camera position.
- Procedural Web Audio API: Ambient synth chord progressions and speed-linked low-pass wind noise generated natively in-browser.

---

## Repository Structure
```
FLIGHT_MERGED/
├── index.html                  # Core Single-File 3D Production Engine
├── DEVELOPMENT_LOG.md          # Architecture & Project Timeline Log
├── TerrainEditor.js            # Real-Time In-Game Terrain Heightmap & Biome Tweaker
├── particleWhaleGenerator.js   # Ambient Sky Particle Whale System
├── terrain-plains.js           # Plains Biome Generation Module
├── terrain-ghibli.js           # Ghibli Valley Biome Module
├── terrain-jungle.js           # Lush Jungle Biome Module
├── terrain-archipelago.js      # Archipelago Biome Module
├── terrain-mountains.js        # Mountains Biome Module
├── terrain-magical.js          # Magical Biome Module
├── terrain-crystal.js          # Crystal Land Biome Module
├── kiki-draco.glb              # Draco-Compressed Kiki Character Model
├── kiki-lowpoly.glb            # Low-Poly Kiki Model Variant
├── Princess.glb                # Secondary Character Model
└── package.json                # Project Dependencies & Vite Scripts
```
