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

let _cacheIslandX = NaN, _cacheIslandZ = NaN, _cacheIslandResult = null;

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

export const worldOriginOffset = new THREE.Vector2(0, 0);

export function setWorldOriginOffset(x, z) {
    worldOriginOffset.set(x, z);
    _cacheIslandX = NaN;
    _cacheIslandZ = NaN;
}

export function getIslandData(rawX, rawZ) {
    const worldX = rawX + worldOriginOffset.x;
    const worldZ = rawZ + worldOriginOffset.y;
    if (worldX === _cacheIslandX && worldZ === _cacheIslandZ && _cacheIslandResult) {
        return _cacheIslandResult;
    }
    const res = computeIslandData(worldX, worldZ);
    _cacheIslandX = worldX;
    _cacheIslandZ = worldZ;
    _cacheIslandResult = res;
    return res;
}

export function getBiomeAt(worldX, worldZ) {
    const data = getIslandData(worldX, worldZ);
    if (data.mask === 0) return ZONE_OCEAN;
    return data.mainBiome;
}

export function getWorldHeight(rawX, rawZ) {
    const wx = rawX + worldOriginOffset.x;
    const wz = rawZ + worldOriginOffset.y;
    const data = getIslandData(rawX, rawZ);
    const oceanFloor = -5.0;
    if (data.mask === 0) return oceanFloor;

    let h1 = data.b1.module.getHeight(wx, wz, snoise);
    if (data.b1.archT) h1 = data.b1.module.getHeight(wx, wz, snoise, data.b1.archT(1.0));
    
    let h2 = data.b2.module.getHeight(wx, wz, snoise);
    if (data.b2.archT) h2 = data.b2.module.getHeight(wx, wz, snoise, data.b2.archT(1.0));

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

export function getWorldColor(h, rawX, rawZ, targetColor) {
    const wx = rawX + worldOriginOffset.x;
    const wz = rawZ + worldOriginOffset.y;
    const data = getIslandData(rawX, rawZ);
    if (data.mask === 0) {
        ZONE_OCEAN.module.getColor(h, wx, wz, snoise, targetColor, smoothstep);
        return;
    }

    data.b1.module.getColor(h, wx, wz, snoise, _tempC1, smoothstep);
    data.b2.module.getColor(h, wx, wz, snoise, _tempC2, smoothstep);

    const smoothW = data.w2 * data.w2 * (3.0 - 2.0 * data.w2);
    targetColor.copy(_tempC1).lerp(_tempC2, smoothW);
    return;
}
