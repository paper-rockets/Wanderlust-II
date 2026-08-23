const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

// 1. Add new imports around line 218 (before THREE import)
const threeImportIdx = lines.findIndex(l => l.includes("import * as THREE from 'three';"));

const newImports = `
import { LOW_GFX, TERRAIN_RES } from './src/config/constants.js';
import { snoise } from './src/world/Noise.js';
import { ZONES, WORLD_LENGTH, BLEND_WIDTH } from './src/world/BiomeManager.js';
import { getBiomeAt, getWorldHeight, getWorldColor, getIslandData } from './src/world/TerrainGenerator.js';
`;
lines.splice(threeImportIdx, 0, newImports);

// We need to re-find indices after splice
let newLines = lines.join('\n').split('\n');

const qStart = newLines.findIndex(l => l.includes('// ===== QUALITY TIER ====='));
const qEnd = newLines.findIndex(l => l.includes('let isInitializingGui = true;'));

if (qStart !== -1 && qEnd !== -1) {
    const replacement = `    let isWindOn = false;
    let isRainOn = false;
    let isWindTrailsOn = true;
    let isFlightPaused = false;
    let isShadowsOn = !LOW_GFX;
    let isTreeShadowsOn = false;
    let shadowDistMode = LOW_GFX ? 'Close' : 'Med';
    let isBloomOn = !LOW_GFX;
    let isHD = !LOW_GFX;
    let cameraZoomDist = 12.0;
    let currentFrame = 0;
    let logicTimer = 0;
    let animeWaterSystem = null;
    let animeWaterGUI = null;
    let terrainRes = TERRAIN_RES;
    
    let isGodMode = false;
    let godCamera = null;
    let godControls = null;
    let isInitializingGui = true;`;
    newLines.splice(qStart, qEnd - qStart + 1, replacement);
}

// Re-split
newLines = newLines.join('\n').split('\n');

const bStart = newLines.findIndex(l => l.includes('// PROCEDURAL NOISE & MULTI-BIOMES SETUP'));
const bEnd = newLines.findIndex(l => l.includes('function toggleMapExpand() {')) - 1; 

if (bStart !== -1 && bEnd !== -1) {
    newLines.splice(bStart, bEnd - bStart + 1);
}

fs.writeFileSync('index.html', newLines.join('\n'));
console.log('Surgery complete');
