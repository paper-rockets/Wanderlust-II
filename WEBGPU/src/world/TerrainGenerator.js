// Master Procedural Terrain Generator Algorithm

import * as THREE from 'three';
import { snoise } from './Noise.js';
import { ZONES } from './BiomeManager.js';

function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

const ZONE_OCEAN = ZONES.find(z => z.name.includes('Ocean')) || ZONES[0];
const ZONE_ARCHIPELAGO = ZONES.find(z => z.name.includes('Archipelago')) || ZONES[0];
const ZONE_GHIBLI = ZONES.find(z => z.name.includes('Ghibli')) || ZONES[1];
const ZONE_PLAINS = ZONES.find(z => z.name.includes('Golden')) || ZONES[2];
const ZONE_MISTY = ZONES.find(z => z.name.includes('Misty')) || ZONES[3];
const ZONE_JUNGLE = ZONES.find(z => z.name.includes('Jungle')) || ZONES[4];
const ZONE_CRYSTAL = ZONES.find(z => z.name.includes('Crystal')) || ZONES[5];
const ZONE_DESERT = ZONES.find(z => z.name.includes('Desert')) || ZONES[7];
const ZONE_CANYON = ZONES.find(z => z.name.includes('Canyon')) || ZONES[8];
const ZONE_NORTHPOLE = ZONES.find(z => z.name.includes('North Pole')) || ZONES[9];

function getBiomeFromTempMoist(temp, moist) {
    if (temp < 0.33) {
        return (moist > 0.50) ? ZONE_NORTHPOLE : ZONE_MISTY;
    } else if (temp <= 0.66) {
        return (moist > 0.50) ? ZONE_GHIBLI : ZONE_PLAINS;
    } else {
        if (moist > 0.50) {
            return ZONE_JUNGLE;
        } else {
            return (moist < 0.20) ? ZONE_CANYON : ZONE_DESERT;
        }
    }
}

const _tempC1 = new THREE.Color();
const _tempC2 = new THREE.Color();

// Island data is the single most expensive thing in terrain generation: 7 simplex-noise
// evaluations per call, and it is called ~7 times per terrain vertex.
//
// The previous cache was a single slot. The terrain loop samples (x,z), then (x-12,z),
// (x+12,z), (x,z-12), (x,z+12) for normals -- so every call evicted the one before it and
// the hit rate was effectively zero. A small keyed map turns those 7 calls into at most 2.
// Sized against the largest single consumer, not the smallest. The water depth-field bake
// (TerrainDepthField) streams 16,384 samples per tick and 262,144 per full rebuild, so a
// 24k cap was being blown ~11 times per rebuild -- and each clear() also wiped the terrain
// rebuild's own locality, which is what the cache exists for.
const _islandCache = new Map();
const ISLAND_CACHE_LIMIT = 96000;

export function clearIslandCache() {
    _islandCache.clear();
}

export function computeIslandData(worldX, worldZ) {
    const warpX = snoise(worldX / 120000.0, worldZ / 120000.0) * 8000.0;
    const warpZ = snoise(worldX / 120000.0 + 150.0, worldZ / 120000.0 + 150.0) * 8000.0;
    const wx = worldX + warpX;
    const wz = worldZ + warpZ;

    const octave1 = snoise(wx / 120000.0, wz / 120000.0) * 0.55;
    const octave2 = snoise(wx / 45000.0 + 80.0, wz / 45000.0 - 80.0) * 0.30;
    const octave3 = snoise(wx / 15000.0 + 240.0, wz / 15000.0 + 240.0) * 0.15;

    const rawElev = (octave1 + octave2 + octave3) * 0.5 + 0.5;
    const elev = Math.pow(Math.max(0.0, rawElev), 1.3);

    const tempRaw = snoise(wx / 150000.0 + 300.0, wz / 150000.0 - 300.0);
    const temp = tempRaw * 0.5 + 0.5;

    const moistRaw = snoise(wx / 180000.0 + 700.0, wz / 180000.0 + 700.0);
    const moist = moistRaw * 0.5 + 0.5;

    if (elev < 0.52) {
        return { mask: 0.0, b1: ZONE_OCEAN, b2: ZONE_OCEAN, w1: 1.0, w2: 0.0, mainBiome: ZONE_OCEAN, elev, temp, moist };
    }

    let mask = smoothstep(0.52, 0.56, elev);

    const isCrystalPlateau = (elev > 0.78) && (Math.abs(temp - 0.5) < 0.06) && (Math.abs(moist - 0.5) < 0.06);
    if (isCrystalPlateau) {
        return { mask: 1.0, b1: ZONE_CRYSTAL, b2: ZONE_CRYSTAL, w1: 1.0, w2: 0.0, mainBiome: ZONE_CRYSTAL, elev, temp, moist };
    }

    if (elev < 0.56) {
        const shoreBiome = (temp > 0.5) ? ZONE_ARCHIPELAGO : ZONE_OCEAN;
        const inlandBiome = getBiomeFromTempMoist(temp, moist);
        const blend = smoothstep(0.52, 0.56, elev);
        return {
            mask,
            b1: shoreBiome,
            b2: inlandBiome,
            w1: 1.0 - blend,
            w2: blend,
            mainBiome: (blend > 0.5) ? inlandBiome : shoreBiome,
            elev, temp, moist
        };
    }

    const b1 = getBiomeFromTempMoist(temp, moist);
    const tempShift = (temp < 0.33) ? temp + 0.15 : ((temp > 0.66) ? temp - 0.15 : (moist > 0.5 ? temp + 0.15 : temp - 0.15));
    const b2 = getBiomeFromTempMoist(tempShift, moist);

    const tempBoundary = (temp < 0.33) ? Math.abs(temp - 0.33) : Math.abs(temp - 0.66);
    const w2 = smoothstep(0.10, 0.0, tempBoundary) * 0.4;
    const w1 = 1.0 - w2;

    return {
        mask: 1.0,
        b1,
        b2,
        w1,
        w2,
        mainBiome: (w1 >= 0.5) ? b1 : b2,
        elev, temp, moist
    };
}

export function getIslandData(worldX, worldZ) {
    // Quantise to 0.5 units. Island data varies over tens of thousands of units, so half a
    // metre is far below any visible change, and it makes the neighbouring normal taps hit.
    // Stride must exceed twice the maximum quantised |z| or distinct points collide.
    // 2^22 covers +/-1,048,576 world units on Z; the whole biome map lives inside +/-100k.
    const key = Math.round(worldX * 2) * 4194304 + (Math.round(worldZ * 2) + 2097152);
    const hit = _islandCache.get(key);
    if (hit !== undefined) return hit;

    const res = computeIslandData(worldX, worldZ);
    if (_islandCache.size >= ISLAND_CACHE_LIMIT) {
        // Evict the oldest half rather than clearing outright. Map iterates in insertion
        // order, so this keeps recent (spatially local) entries alive instead of throwing
        // away every hit the moment a streaming consumer fills the table.
        let toDrop = _islandCache.size >> 1;
        for (const k of _islandCache.keys()) {
            _islandCache.delete(k);
            if (--toDrop <= 0) break;
        }
    }
    _islandCache.set(key, res);
    return res;
}

export function getBiomeAt(worldX, worldZ) {
    if (worldX === undefined || isNaN(worldX) || worldZ === undefined || isNaN(worldZ)) {
        return ZONE_OCEAN || ZONES[0];
    }
    const data = getIslandData(worldX, worldZ);
    if (!data) return ZONE_OCEAN || ZONES[0];
    if (data.mask === 0) return ZONE_OCEAN || ZONES[0];
    return data.mainBiome || ZONE_OCEAN || ZONES[0];
}

export function getWorldHeight(worldX, worldZ) {
    const data = getIslandData(worldX, worldZ);
    const oceanFloor = -5.0;
    if (data.mask === 0) return oceanFloor;

    let h1 = data.b1.module.getHeight(worldX, worldZ, snoise);
    if (data.b1.archT) h1 = data.b1.module.getHeight(worldX, worldZ, snoise, data.b1.archT(1.0));
    
    let h2 = data.b2.module.getHeight(worldX, worldZ, snoise);
    if (data.b2.archT) h2 = data.b2.module.getHeight(worldX, worldZ, snoise, data.b2.archT(1.0));

    const smoothW = data.w2 * data.w2 * (3.0 - 2.0 * data.w2);

    const tWeight = 4.0 * data.w2 * (1.0 - data.w2);
    const conformFactor = 1.0 - tWeight * 0.65;
    const targetBase = 18.0;

    h1 = targetBase + (h1 - targetBase) * conformFactor;
    h2 = targetBase + (h2 - targetBase) * conformFactor;

    let h = h1 * (1.0 - smoothW) + h2 * smoothW;
    h = (h - oceanFloor) * data.mask + oceanFloor;
    return Math.max(oceanFloor, h);
}

export function getWorldColor(h, worldX, worldZ, targetColor) {
    const data = getIslandData(worldX, worldZ);
    if (data.mask === 0) {
        ZONE_OCEAN.module.getColor(h, worldX, worldZ, snoise, targetColor, smoothstep);
        return;
    }

    data.b1.module.getColor(h, worldX, worldZ, snoise, _tempC1, smoothstep);
    data.b2.module.getColor(h, worldX, worldZ, snoise, _tempC2, smoothstep);

    const smoothW = data.w2 * data.w2 * (3.0 - 2.0 * data.w2);
    targetColor.copy(_tempC1).lerp(_tempC2, smoothW);
    return;
}
