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

export const biomeWaterHeights = {
    'Archipelago': 2.4,
    'Ghibli Land': 2.4,
    'Misty Mountains': 2.4,
    'Lush Jungle': 2.4,
    'Crystal Land': 2.4,
    'Magical Sanctuary': 2.4,
    'Desert Dunes': 2.4,
    'North Pole': 2.4,
    'Open Ocean': 2.4
};

export const globalTerrainParams = {
    globalHeightMultiplier: 1.0,
    globalNoiseScale: 1.0
};

export function getWorldWaterHeight(worldX, worldZ) {
    const wts = zoneWeights(worldZ);
    let wh = 0;
    for (let i = 0; i < wts.length; i++) {
        const zn = ZONES[wts[i].idx];
        const baseWh = (biomeWaterHeights[zn.name] !== undefined) ? biomeWaterHeights[zn.name] : 2.4;
        wh += baseWh * wts[i].w;
    }
    return wh;
}

const _tempC1 = new THREE.Color();
const _tempC2 = new THREE.Color();

export const worldOriginOffset = new THREE.Vector2(0, 0);

export function setWorldOriginOffset(x, z) {
    worldOriginOffset.set(x, z);
}

export function getBiomeAt(worldX, worldZ) {
    const wz = wrapZ(worldZ + worldOriginOffset.y);
    const idx = zoneIdxAt(wz);
    return ZONES[idx] || ZONES[0];
}

export function getWorldHeight(worldX, worldZ) {
    const wx = worldX + worldOriginOffset.x;
    const wz = worldZ + worldOriginOffset.y;
    const wts = zoneWeights(wz);
    let h = 0;
    for (let i = 0; i < wts.length; i++) {
        const zn = ZONES[wts[i].idx];
        const scale = ((biomeScales[zn.name] !== undefined) ? biomeScales[zn.name] : 1.0) * globalTerrainParams.globalNoiseScale;
        const hMult = ((biomeHeights[zn.name] !== undefined) ? biomeHeights[zn.name] : 1.0) * globalTerrainParams.globalHeightMultiplier;
        let rawH = zn.module.getHeight(wx * scale, wz * scale, snoise);
        if (zn.archT) rawH = zn.module.getHeight(wx * scale, wz * scale, snoise, zn.archT(wts[i].t));
        h += (rawH * hMult) * wts[i].w;
    }
    return h;
}

export function getWorldColor(h, worldX, worldZ, targetColor) {
    const wx = worldX + worldOriginOffset.x;
    const wz = worldZ + worldOriginOffset.y;
    const wts = zoneWeights(wz);
    if (wts.length === 1) {
        const zn = ZONES[wts[0].idx];
        zn.module.getColor(h, wx, wz, snoise, targetColor, smoothstep);
        return;
    }
    const zn1 = ZONES[wts[0].idx];
    const zn2 = ZONES[wts[1].idx];
    zn1.module.getColor(h, wx, wz, snoise, _tempC1, smoothstep);
    zn2.module.getColor(h, wx, wz, snoise, _tempC2, smoothstep);
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

export function getPathStrength(x, z) {
    const scale = 0.002;
    const n1 = snoise(x * scale, z * scale);
    const n2 = snoise(x * scale * 2 + 1000, z * scale * 2 + 1000) * 0.3;
    let path = Math.abs(n1 + n2);
    let mask = smoothstep(0.15, 0.0, path);
    return mask;
}
