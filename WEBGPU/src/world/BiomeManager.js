// Biome Manager & Adjacency Matrix

import terrainArch from './biomes/terrain-archipelago.js';
import terrainGhibli from './biomes/terrain-ghibli.js';
import terrainPlains from './biomes/terrain-plains.js';
import terrainMtn from './biomes/terrain-mountains.js';
import terrainCrystal from './biomes/terrain-crystal.js';
import terrainJungle from './biomes/terrain-jungle.js';
import terrainDesert from './biomes/terrain-desert.js';
import terrainCanyon from './biomes/terrain-canyon.js';
import terrainNorthPole from './biomes/terrain-northpole.js';
import { snoise } from './Noise.js';

export const ZONES = [
    { start:      0, end:   8000, module: terrainArch,     treesOk: true,  name: '🏝️ Archipelago',        archT: (t) => t * 2.0 },
    { start:   8000, end:  16000, module: terrainGhibli,   treesOk: true,  name: '🌲 Ghibli Land'         },
    { start:  16000, end:  24000, module: terrainPlains,   treesOk: true,  name: '🌾 Vast Plains'          },
    { start:  24000, end:  40000, module: terrainMtn,      treesOk: false, name: '🏔️ Misty Mountains'     },
    { start:  40000, end:  70000, module: terrainJungle,   treesOk: true,  name: '🌴 Lush Jungle'          },
    { start:  70000, end: 104000, module: terrainCrystal,  treesOk: false, name: '💎 Crystal Land'         },
    { start: 104000, end: 120000, module: terrainArch,     treesOk: false, name: '🌊 Open Ocean'           },
    { start: 120000, end: 150000, module: terrainDesert,   treesOk: false, name: '🏜️ Desert Dunes'        },
    { start: 150000, end: 180000, module: terrainCanyon,   treesOk: false, name: '⛰️ Badlands Canyon'      },
    { start: 180000, end: 210000, module: terrainNorthPole,treesOk: false, name: '❄️ North Pole'          },
];

export const WORLD_LENGTH = 210000;
export const BLEND_WIDTH  = 3500;

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
        return [
            { idx: currIdx, w: w1, t: zoneT(wz, currIdx) },
            { idx: nextIdx, w: w2, t: zoneT(wz, nextIdx) }
        ];
    } else {
        return [{ idx: currIdx, w: 1.0, t: zoneT(wz, currIdx) }];
    }
}

export const BIOME_ADJACENCY = {
    '❄️ North Pole':       { temp: 'Cold',      neighbors: ['🏔️ Misty Mountains', '🌊 Open Ocean'] },
    '🏔️ Misty Mountains': { temp: 'Cold',      neighbors: ['❄️ North Pole', '🌲 Ghibli Land', '💎 Crystal Land'] },
    '🌲 Ghibli Land':     { temp: 'Temperate', neighbors: ['🏔️ Misty Mountains', '🌾 Vast Plains', '🌴 Lush Jungle'] },
    '🌾 Vast Plains':     { temp: 'Temperate', neighbors: ['🌲 Ghibli Land', '⛰️ Badlands Canyon', '🏜️ Desert Dunes'] },
    '🌴 Lush Jungle':      { temp: 'Hot',       neighbors: ['🌲 Ghibli Land', '🏝️ Archipelago', '💎 Crystal Land'] },
    '⛰️ Badlands Canyon': { temp: 'Hot',       neighbors: ['🌾 Vast Plains', '🏜️ Desert Dunes'] },
    '🏜️ Desert Dunes':    { temp: 'Hot',       neighbors: ['🌾 Vast Plains', '⛰️ Badlands Canyon', '💎 Crystal Land'] },
    '🏝️ Archipelago':    { temp: 'Warm',      neighbors: ['🌴 Lush Jungle', '🌲 Ghibli Land', '🌾 Vast Plains'] },
    '💎 Crystal Land':    { temp: 'Magical',   neighbors: ['🏔️ Misty Mountains', '🌴 Lush Jungle', '🏜️ Desert Dunes'] }
};

export const BARRIER_BIOMES = ['🏔️ Misty Mountains', '🌴 Lush Jungle', '🏜️ Desert Dunes'];
