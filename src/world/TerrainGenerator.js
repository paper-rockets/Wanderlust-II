// Master Procedural Terrain Generator Algorithm (100% 001 Scale & Continuous Z-Axis Flight Corridor)

import * as THREE from 'three';
import { snoise } from './Noise.js';
import { ZONES, wrapZ, zoneIdxAt, zoneWeights } from './BiomeManager.js';

function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

export const biomeHeights = {
    'Archipelago': 1.0,
    'Ghibli Land': 0.35,
    'Misty Mountains': 1.0,
    'Lush Jungle': 1.0,
    'Crystal Land': 1.0,
    'Magical Sanctuary': 1.0,
    'Desert Dunes': 1.0,
    'North Pole': 1.0,
    'Open Ocean': 1.0
};

export const biomeScales = {
    'Archipelago': 1.0,
    'Ghibli Land': 1.0,
    'Misty Mountains': 1.0,
    'Lush Jungle': 1.0,
    'Crystal Land': 1.0,
    'Magical Sanctuary': 1.0,
    'Desert Dunes': 1.0,
    'North Pole': 1.0,
    'Open Ocean': 1.0
};

export const globalTerrainParams = {
    globalHeightMultiplier: 1.0,
    globalNoiseScale: 1.0
};

const _tempC1 = new THREE.Color();
const _tempC2 = new THREE.Color();

export function getBiomeAt(worldX, worldZ) {
    const wz = wrapZ(worldZ);
    const idx = zoneIdxAt(wz);
    return ZONES[idx] || ZONES[0];
}

export function getWorldHeight(worldX, worldZ) {
    const wts = zoneWeights(worldZ);
    let h = 0;
    for (let i = 0; i < wts.length; i++) {
        const zn = ZONES[wts[i].idx];
        const scale = ((biomeScales[zn.name] !== undefined) ? biomeScales[zn.name] : 1.0) * globalTerrainParams.globalNoiseScale;
        const hMult = ((biomeHeights[zn.name] !== undefined) ? biomeHeights[zn.name] : 1.0) * globalTerrainParams.globalHeightMultiplier;
        let rawH = zn.module.getHeight(worldX * scale, worldZ * scale, snoise);
        if (zn.archT) rawH = zn.module.getHeight(worldX * scale, worldZ * scale, snoise, zn.archT(wts[i].t));
        h += (rawH * hMult) * wts[i].w;
    }
    return h;
}

export function getWorldColor(h, worldX, worldZ, targetColor) {
    const wts = zoneWeights(worldZ);
    if (wts.length === 1) {
        const zn = ZONES[wts[0].idx];
        zn.module.getColor(h, worldX, worldZ, snoise, targetColor, smoothstep);
        return;
    }
    const zn1 = ZONES[wts[0].idx];
    const zn2 = ZONES[wts[1].idx];
    zn1.module.getColor(h, worldX, worldZ, snoise, _tempC1, smoothstep);
    zn2.module.getColor(h, worldX, worldZ, snoise, _tempC2, smoothstep);
    targetColor.copy(_tempC1).lerp(_tempC2, wts[1].w);
}

export function getIslandData(worldX, worldZ) {
    const biome = getBiomeAt(worldX, worldZ);
    return {
        mask: 1.0,
        b1: biome,
        b2: biome,
        w1: 1.0,
        w2: 0.0,
        mainBiome: biome
    };
}
