// terrainWorker.js - Background Web Worker for Procedural Terrain Geometry Generation
// Offloads Simplex noise, biome blending, normals, and vertex colors from the main thread.

import { getWorldHeight, getWorldColor, globalTerrainParams } from '../TerrainGenerator.js';

self.onmessage = function (e) {
    const { id, gridX, gridZ, terrainSize, terrainRes, params } = e.data;

    if (params) {
        if (params.globalHeightMultiplier !== undefined) {
            globalTerrainParams.globalHeightMultiplier = params.globalHeightMultiplier;
        }
        if (params.globalNoiseScale !== undefined) {
            globalTerrainParams.globalNoiseScale = params.globalNoiseScale;
        }
    }

    const segments = terrainRes;
    const vertexCount = (segments + 1) * (segments + 1);
    
    // Allocate contiguous typed arrays
    const posArray = new Float32Array(vertexCount * 3);
    const normArray = new Float32Array(vertexCount * 3);
    const colArray = new Float32Array(vertexCount * 3);

    const halfSize = terrainSize * 0.5;
    const innerRadius = halfSize * 0.72;
    const segSize = terrainSize / segments;

    const tempColor = { r: 1, g: 1, b: 1, copy(c) { this.r = c.r; this.g = c.g; this.b = c.b; return this; }, lerp(c, t) { this.r += (c.r - this.r) * t; this.g += (c.g - this.g) * t; this.b += (c.b - this.b) * t; return this; } };

    let ptr = 0;
    let colPtr = 0;

    for (let iy = 0; iy <= segments; iy++) {
        const localZ = iy * segSize - halfSize;
        const worldZ = localZ + gridZ;

        for (let ix = 0; ix <= segments; ix++) {
            const localX = ix * segSize - halfSize;
            const worldX = localX + gridX;

            let h = getWorldHeight(worldX, worldZ);

            // Perimeter edge skirt
            const edgeDist = Math.max(Math.abs(localX), Math.abs(localZ));
            if (edgeDist > innerRadius) {
                const t = Math.max(0, Math.min(1, (edgeDist - innerRadius) / (halfSize - innerRadius)));
                const skirtT = 1.0 - t * t * (3.0 - 2.0 * t);
                h = 2.4 + (h - 2.4) * skirtT;
            }

            // Positions (X, Y, Z in Three.js rotated plane: localX, h, localZ)
            posArray[ptr]     = localX;
            posArray[ptr + 1] = h;
            posArray[ptr + 2] = localZ;

            // Finite difference surface normals
            const hL = getWorldHeight(worldX - 12, worldZ);
            const hR = getWorldHeight(worldX + 12, worldZ);
            const hD = getWorldHeight(worldX, worldZ - 12);
            const hU = getWorldHeight(worldX, worldZ + 12);
            
            const nx = hL - hR;
            const ny = 24.0;
            const nz = hD - hU;
            const len = Math.hypot(nx, ny, nz) || 1.0;

            normArray[ptr]     = nx / len;
            normArray[ptr + 1] = ny / len;
            normArray[ptr + 2] = nz / len;

            // Vertex biome colors
            getWorldColor(h, worldX, worldZ, tempColor);
            colArray[colPtr]     = tempColor.r;
            colArray[colPtr + 1] = tempColor.g;
            colArray[colPtr + 2] = tempColor.b;

            ptr += 3;
            colPtr += 3;
        }
    }

    // Transfer buffers back with 0-copy transferables
    self.postMessage(
        {
            id,
            gridX,
            gridZ,
            posArray,
            normArray,
            colArray
        },
        [posArray.buffer, normArray.buffer, colArray.buffer]
    );
};
