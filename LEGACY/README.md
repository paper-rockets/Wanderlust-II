# Wanderlust - Legacy Ghibli Flight Prototype (v1)

## Origin & Project Story
This build represents the very first foundational prototype of Wanderlust, originally created using Google AI Studio. What began as a single exploratory line of code quickly grew into an obsessive rabbit hole of iterative enhancements, shader experiments, mathematical terrain modeling, sleepless late-night development sessions, and relentless refinement that ultimately gave birth to the broader Wanderlust project (WebGL & WebGPU).

This repository folder preserves the complete, playable historical milestone in its original form, optimized for demonstration and comparison.

---

## Technical Overview
The legacy prototype is a standalone, browser-based flight simulation crafted with Three.js and custom Non-Photorealistic Rendering (NPR) shaders designed to capture the hand-painted aesthetic of Studio Ghibli films.

### Key Architectural Systems:
1. Procedural Infinite Terrain:
   - Dynamic 2D Simplex noise elevation and biome blending with real-time sliding mesh updates centered on the player.
   - Procedurally generated paths, coastlines, and village layouts.

2. Cel-Shading Pipeline:
   - Quantized 2-tone stepped lighting ramp using custom 1D DataTextures (`MeshToonMaterial`).
   - Custom GLSL vertex shader hooks for real-time wind oscillations across instanced grass blades.
   - ACES Filmic Tone Mapping paired with UnrealBloom post-processing passes for atmospheric bloom.

3. Procedural Flora & Fauna:
   - 6 procedurally assembled low-poly tree archetypes (Pines, Bonsai, Sakura Cherry Blossoms) merged with vertex color attributes.
   - Flocking boid algorithms for flying bird flocks and schooling fish beneath the ocean surface.

4. Flight Dynamics & Camera:
   - Smoothed velocity-based steering, banking, and pitch controls.
   - Predictive lookahead terrain slope detection for automatic contour ascension.
   - Strictly leveled camera rig orientation preserving clean horizon tracking.

5. Dynamic Environment & Web Audio:
   - 3-phase lighting system transitioning between Day, Dusk, and Twilight.
   - Procedural Web Audio API sound engine generating real-time wind noise filters and synthesizer melodic sequences.

---

## Getting Started Locally

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Installation & Launch
1. Navigate into the legacy subfolder:
   ```bash
   cd LEGACY
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the development server:
   ```bash
   npm run dev
   ```

4. Open your browser:
   - http://localhost:8080/
