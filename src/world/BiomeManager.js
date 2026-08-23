// Biome Manager & Adjacency Matrix (100% Icon-Free, Zero-GC Optimized)

import terrainArch from './biomes/terrain-archipelago.js';
import terrainGhibli from './biomes/terrain-ghibli.js';
import terrainMtn from './biomes/terrain-mountains.js';
import terrainJungle from './biomes/terrain-jungle.js';
import terrainCrystal from './biomes/terrain-crystal.js';
import terrainMagical from './biomes/terrain-magical.js';
import terrainDesert from './biomes/terrain-desert.js';
import terrainNorthPole from './biomes/terrain-northpole.js';

export const ZONES = [
    { start:      0, end:  16000, module: terrainArch,     treesOk: true,  name: 'Archipelago',        archT: (t) => t * 2.0 },
    { start:  16000, end:  40000, module: terrainGhibli,   treesOk: true,  name: 'Ghibli Land'         },
    { start:  40000, end:  70000, module: terrainMtn,      treesOk: false, name: 'Misty Mountains'     },
    { start:  70000, end: 100000, module: terrainJungle,   treesOk: true,  name: 'Lush Jungle'          },
    { start: 100000, end: 130000, module: terrainCrystal,  treesOk: false, name: 'Crystal Land'         },
    { start: 130000, end: 155000, module: terrainMagical,  treesOk: true,  name: 'Magical Sanctuary'    },
    { start: 155000, end: 180000, module: terrainDesert,   treesOk: false, name: 'Desert Dunes'        },
    { start: 180000, end: 205000, module: terrainNorthPole,treesOk: false, name: 'North Pole'          },
    { start: 205000, end: 215000, module: terrainArch,     treesOk: false, name: 'Open Ocean'           },
];

export const WORLD_LENGTH = 215000;
export const BLEND_WIDTH  = 2500;

export function wrapZ(worldZ) {
    return ((worldZ % WORLD_LENGTH) + WORLD_LENGTH) % WORLD_LENGTH;
}

export function zoneIdxAt(wrappedZ) {
    for (let i = 0; i < ZONES.length; i++) {
        if (wrappedZ >= ZONES[i].start && wrappedZ < ZONES[i].end) return i;
    }
    return 0;
}

export function zoneT(wrappedZ, idx) {
    const zn = ZONES[idx];
    const range = zn.end - zn.start;
    if (range <= 0) return 0.0;
    const t = (wrappedZ - zn.start) / range;
    return Math.max(0.0, Math.min(1.0, t));
}

function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

// Pre-allocated static buffers to avoid GC allocations in hot vertex loop
const _resultOne = [{ idx: 0, w: 1.0, t: 0.0 }];
const _resultTwo = [
    { idx: 0, w: 1.0, t: 0.0 },
    { idx: 0, w: 0.0, t: 0.0 }
];

export function zoneWeights(worldZ) {
    const wz = wrapZ(worldZ);
    const currIdx = zoneIdxAt(wz);
    const currZone = ZONES[currIdx];
    const nextIdx = (currIdx + 1) % ZONES.length;
    const distToBoundary = currZone.end - wz;

    if (distToBoundary < BLEND_WIDTH) {
        const blendFactor = distToBoundary / BLEND_WIDTH;
        const w1 = smoothstep(0, 1, blendFactor);
        const w2 = 1.0 - w1;
        _resultTwo[0].idx = currIdx;
        _resultTwo[0].w = w1;
        _resultTwo[0].t = zoneT(wz, currIdx);
        _resultTwo[1].idx = nextIdx;
        _resultTwo[1].w = w2;
        _resultTwo[1].t = zoneT(wz, nextIdx);
        return _resultTwo;
    } else {
        _resultOne[0].idx = currIdx;
        _resultOne[0].w = 1.0;
        _resultOne[0].t = zoneT(wz, currIdx);
        return _resultOne;
    }
}
