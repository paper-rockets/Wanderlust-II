const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

// 1. Add new imports at the top
const importIdx = lines.findIndex(l => l.includes("import * as THREE from 'three';"));
const newImports = `
import { PlayerPhysics } from './src/physics/PlayerPhysics.js';
import { CameraManager } from './src/physics/CameraManager.js';
import { setupGodMode, toggleGodMode } from './src/physics/GodMode.js';
`;
lines.splice(importIdx + 1, 0, newImports);

let newLines = lines.join('\n').split('\n');

// 2. Remove movement variables
const mvStart = newLines.findIndex(l => l.includes('// --- 4. Movement Variables ---'));
const mvEnd = newLines.findIndex(l => l.includes('function tickMovement(')) - 1;

if (mvStart !== -1 && mvEnd !== -1 && mvStart < mvEnd) {
    newLines.splice(mvStart, mvEnd - mvStart + 1);
}

newLines = newLines.join('\n').split('\n');

// 3. Remove tickMovement
const tickStart = newLines.findIndex(l => l.includes('function tickMovement('));
const tickEnd = newLines.findIndex(l => l.includes('let envConfigs = [')) - 1;

if (tickStart !== -1 && tickEnd !== -1 && tickStart < tickEnd) {
    newLines.splice(tickStart, tickEnd - tickStart + 1);
}

newLines = newLines.join('\n').split('\n');

// 4. Initialize PlayerPhysics and CameraManager right before animate
const animStart = newLines.findIndex(l => l.includes('function animate() {'));
if (animStart !== -1) {
    const instances = `
    let playerPhysics;
    let cameraManager;
    `;
    newLines.splice(animStart, 0, instances);
}

newLines = newLines.join('\n').split('\n');

// Now in animate(), initialize playerPhysics if undefined
const rawDtLine = newLines.findIndex(l => l.includes('let rawDt = (nowAnimTime - lastAnimTime) / 1000.0;'));
if (rawDtLine !== -1) {
    const initCode = `
        if (!playerPhysics && typeof playerGrp !== 'undefined') {
            playerPhysics = new PlayerPhysics(playerGrp);
            cameraManager = new CameraManager(camera, cameraBase, cameraZoomDist);
        }
    `;
    newLines.splice(rawDtLine + 1, 0, initCode);
}
newLines = newLines.join('\n').split('\n');


// 5. Replace the physics update and camera update in animate()
const updateStart = newLines.findIndex(l => l.includes('const isBraking = keys.space || touchState.brake;'));
const updateEnd = newLines.findIndex(l => l.includes('camera.updateProjectionMatrix();'));

if (updateStart !== -1 && updateEnd !== -1 && updateStart < updateEnd) {
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
    `;
    newLines.splice(updateStart, updateEnd - updateStart + 1, replacement);
}

newLines = newLines.join('\n').split('\n');

// 6. Fix updateInstances call to use playerPhysics.currentYaw
const instIdx = newLines.findIndex(l => l.includes('updateInstances(playerGrp.position.x, playerGrp.position.z, time, dt, currentYaw);'));
if (instIdx !== -1) {
    newLines[instIdx] = newLines[instIdx].replace('currentYaw', 'playerPhysics ? playerPhysics.currentYaw : 0');
}

// 7. Fix velocity reference for trails
const trailVelIdx = newLines.findIndex(l => l.includes('z += velocity * 3.0 * dt;'));
if (trailVelIdx !== -1) {
    newLines[trailVelIdx] = newLines[trailVelIdx].replace('velocity', 'playerPhysics ? playerPhysics.velocity : 18.0');
}

// 8. Fix velocity reference for wind audio
const windVelIdx = newLines.findIndex(l => l.includes('const speedFactor = Math.max(0, Math.min(1, (velocity - 15) / 30));'));
if (windVelIdx !== -1) {
    newLines[windVelIdx] = newLines[windVelIdx].replace('velocity', 'playerPhysics ? playerPhysics.velocity : 18.0');
}

// 9. Fix God Mode setup in click listener
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
    // remove the next line `renderPass.camera = camera;`
    newLines.splice(godDisable + 1, 1);
}


fs.writeFileSync('index.html', newLines.join('\n'));
console.log('Physics surgery complete');
