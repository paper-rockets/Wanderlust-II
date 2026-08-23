const fs = require('fs');

function rebuild() {
    let content = fs.readFileSync('src/main.js', 'utf8');
    let lines = content.split('\n');

    // --- SPLICE 5.1 ---
    const threeImportIdx = lines.findIndex(l => l.includes("import * as THREE from 'three';"));
    const imports51 = `
import { LOW_GFX, TERRAIN_RES } from '../config/constants.js';
import { snoise } from '../world/Noise.js';
import { ZONES, WORLD_LENGTH, BLEND_WIDTH } from '../world/BiomeManager.js';
import { getBiomeAt, getWorldHeight, getWorldColor, getIslandData } from '../world/TerrainGenerator.js';
`;
    if (threeImportIdx !== -1) { lines.splice(threeImportIdx, 0, imports51); }

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
    let isPhotoMode = false;
    let photoControls = null;
    let isInitializingGui = true;`;
        newLines.splice(qStart, qEnd - qStart + 1, replacement);
    }
    newLines = newLines.join('\n').split('\n');
    const bStart = newLines.findIndex(l => l.includes('// PROCEDURAL NOISE & MULTI-BIOMES SETUP'));
    const bEnd = newLines.findIndex(l => l.includes('function toggleMapExpand() {')) - 1; 
    if (bStart !== -1 && bEnd !== -1) { newLines.splice(bStart, bEnd - bStart + 1); }


    // --- SPLICE 5.2 ---
    newLines = newLines.join('\n').split('\n');
    const importIdx2 = newLines.findIndex(l => l.includes("import * as THREE from 'three';"));
    const imports52 = `
import { scene, camera, renderer, clock } from '../core/Engine.js';
import { composer, bloomPass, godRaysPass, summerPass, initPostProcessingUI } from '../core/PostProcessing.js';
`;
    if (importIdx2 !== -1) { newLines.splice(importIdx2 + 1, 0, imports52); }

    newLines = newLines.join('\n').split('\n');
    const startIdx2 = newLines.findIndex(l => l.includes("const container = document.getElementById('app');"));
    const endIdx2 = newLines.findIndex(l => l.includes("// 2. LIGHTING")) - 1;
    if (startIdx2 !== -1 && endIdx2 !== -1) {
        const replacement2 = `
    initPostProcessingUI();
    // (Engine & PostProcessing initialized via modules)
    `;
        newLines.splice(startIdx2, endIdx2 - startIdx2 + 1, replacement2);
    }
    
    const clockIdx = newLines.findIndex(l => l.includes('const clock = new THREE.Clock();'));
    if (clockIdx !== -1) { newLines.splice(clockIdx, 1); }


    // --- SPLICE 5.3 ---
    newLines = newLines.join('\n').split('\n');
    const importIdx3 = newLines.findIndex(l => l.includes("import * as THREE from 'three';"));
    const imports53 = `
import { PlayerPhysics } from '../physics/PlayerPhysics.js';
import { CameraManager } from '../physics/CameraManager.js';
import { setupGodMode, toggleGodMode } from '../physics/GodMode.js';
`;
    if (importIdx3 !== -1) { newLines.splice(importIdx3 + 1, 0, imports53); }

    newLines = newLines.join('\n').split('\n');
    const mvStart = newLines.findIndex(l => l.includes('// --- 4. Movement Variables ---'));
    const mvEnd = newLines.findIndex(l => l.includes('function tickMovement(')) - 1;
    if (mvStart !== -1 && mvEnd !== -1) { newLines.splice(mvStart, mvEnd - mvStart + 1); }

    newLines = newLines.join('\n').split('\n');
    const tickStart = newLines.findIndex(l => l.includes('function tickMovement('));
    const tickEnd = newLines.findIndex(l => l.includes('let envConfigs = [')) - 1;
    if (tickStart !== -1 && tickEnd !== -1) { newLines.splice(tickStart, tickEnd - tickStart + 1); }

    newLines = newLines.join('\n').split('\n');
    const animStart = newLines.findIndex(l => l.includes('function animate() {'));
    if (animStart !== -1) {
        newLines.splice(animStart, 0, `\n    let playerPhysics;\n    let cameraManager;\n    `);
    }

    newLines = newLines.join('\n').split('\n');
    const rawDtLine = newLines.findIndex(l => l.includes('let rawDt = (nowAnimTime - lastAnimTime) / 1000.0;'));
    if (rawDtLine !== -1) {
        newLines.splice(rawDtLine + 1, 0, `
        if (!playerPhysics && typeof playerGrp !== 'undefined') {
            playerPhysics = new PlayerPhysics(playerGrp);
            cameraManager = new CameraManager(camera, cameraBase, cameraZoomDist);
        }
        `);
    }

    newLines = newLines.join('\n').split('\n');
    const updateStart = newLines.findIndex(l => l.includes('const isBraking = keys.space || touchState.brake;'));
    const updateEnd = newLines.findIndex(l => l.includes('camera.updateProjectionMatrix();'));
    if (updateStart !== -1 && updateEnd !== -1) {
        const replacement = `
        const isBraking = keys.space || touchState.brake;
        const isBoosting = keys.shift || touchState.boost;
        
        const inputState = {
            forward: true,
            up: keys.w || touchState.y < -0.1,
            down: keys.s || touchState.y > 0.1,
            left: keys.a || touchState.x < -0.1,
            right: keys.d || touchState.x > 0.1
        };

        if (playerPhysics) {
            playerPhysics.update(dt, inputState, isBraking, isBoosting, isFlightPaused);
            
            if (cameraManager) {
                cameraManager.update(dt, playerGrp, playerPhysics.currentYaw, isBoosting);
                if (isGodMode && godControls) godControls.update();
            }
        }

        starField.position.copy(playerGrp.position); // Track player to create infinite distance illusion
        if (typeof toonCloudDome !== 'undefined') {
            toonCloudDome.position.copy(playerGrp.position);
            toonCloudMat.uniforms.uTime.value = time;
            toonCloudMat.uniforms.uCloudDensity.value = (typeof cloudParams !== 'undefined' && typeof cloudParams.density !== 'undefined') ? cloudParams.density : 1.0;
            toonCloudMat.uniforms.uEnableClouds.value = (typeof cloudParams !== 'undefined' && cloudParams.enableClouds) ? 1.0 : 0.0;
            toonCloudMat.uniforms.uSkyColor.value.setHex(envConfigs[timePhase].bg);
            toonCloudMat.uniforms.uCloudColor.value.setHex(envConfigs[timePhase].cloudCol);
        }

        if (typeof playerVisuals !== 'undefined') playerVisuals.rotation.x = THREE.MathUtils.lerp(playerVisuals.rotation.x, 0, 1.0 - Math.exp(-5.0 * dt));

        if (params.showTerrain) updateTerrainGeometry(playerGrp.position.x, playerGrp.position.z);
        waterUniforms.uTime.value = time;
        waterMesh.position.x = playerGrp.position.x;
        waterMesh.position.z = playerGrp.position.z;
        if (typeof animeWaterSystem !== 'undefined' && animeWaterSystem) {
            animeWaterSystem.update(dt, time, (typeof isGodMode !== 'undefined' && isGodMode && typeof godCamera !== 'undefined') ? godCamera : camera);
            if (playerGrp.position.y < 15.0) {
                animeWaterSystem.emitRipple(playerGrp.position.x, playerGrp.position.z, time);
            }
        }

        if(typeof window.fogGroup !== 'undefined' && window.fogGroup.visible) {
            window.fogUniforms.uTime.value = time;
            window.fogGroup.position.x = playerGrp.position.x;
            window.fogGroup.position.z = playerGrp.position.z;
            const currentFogMat = window.fogGroup.children[0].material;
            currentFogMat.color.lerp(scene.fog.color, 0.01); 
        }
    `;
        newLines.splice(updateStart, updateEnd - updateStart + 1, replacement);
    }

    newLines = newLines.join('\n').split('\n');
    const instIdx = newLines.findIndex(l => l.includes('updateInstances(playerGrp.position.x, playerGrp.position.z, time, dt, currentYaw);'));
    if (instIdx !== -1) { newLines[instIdx] = newLines[instIdx].replace('currentYaw', 'playerPhysics ? playerPhysics.currentYaw : 0'); }

    const trailVelIdx = newLines.findIndex(l => l.includes('z += velocity * 3.0 * dt;'));
    if (trailVelIdx !== -1) { newLines[trailVelIdx] = newLines[trailVelIdx].replace('velocity', 'playerPhysics ? playerPhysics.velocity : 18.0'); }

    const windVelIdx = newLines.findIndex(l => l.includes('const speedFactor = Math.max(0, Math.min(1, (velocity - 15) / 30));'));
    if (windVelIdx !== -1) { newLines[windVelIdx] = newLines[windVelIdx].replace('velocity', 'playerPhysics ? playerPhysics.velocity : 18.0'); }

    const godCamStart = newLines.findIndex(l => l.includes('if (!godCamera) {'));
    const godCamEnd = newLines.findIndex(l => l.includes('renderPass.camera = godCamera;'));
    if (godCamStart !== -1 && godCamEnd !== -1) {
        const godRepl = `
            if (!godCamera) {
                const gm = setupGodMode(scene, cameraBase, renderer, playerGrp);
                godCamera = gm.godCamera;
                godControls = gm.godControls;
            }
            toggleGodMode(isGodMode, godCamera, camera, godControls, playerGrp, (cam) => {
                renderPass.camera = cam;
            });
    `;
        newLines.splice(godCamStart, godCamEnd - godCamStart + 1, godRepl);
    }

    newLines = newLines.join('\n').split('\n');
    const godDisable = newLines.findIndex(l => l.includes('if (godControls) godControls.enabled = false;'));
    if (godDisable !== -1) {
        newLines[godDisable] = `
            toggleGodMode(isGodMode, godCamera, camera, godControls, playerGrp, (cam) => {
                renderPass.camera = cam;
            });
    `;
        newLines.splice(godDisable + 1, 1);
    }

    fs.writeFileSync('src/main.js', newLines.join('\n'));
    console.log('src/main.js completely rebuilt successfully!');
}

rebuild();
