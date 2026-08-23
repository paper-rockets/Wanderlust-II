import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getWorldHeight } from '../world/TerrainGenerator.js';

const _flyFwd = new THREE.Vector3();
const _flyRight = new THREE.Vector3();
const _flyUp = new THREE.Vector3(0, 1, 0);

export function setupGodMode(scene, cameraBase, renderer, playerGrp) {
    // Huge far clipping plane (10M units) so zooming out and going high never clips terrain/world
    const godCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 10000000);
    godCamera.position.set(0, 150, 400);

    // CRITICAL: Attach godCamera directly to scene (world space), NOT cameraBase!
    // Adding to cameraBase caused cameraBase slerp/lerp to distort OrbitControls during scrolling and orbiting.
    scene.add(godCamera);

    const godControls = new OrbitControls(godCamera, renderer.domElement);
    godControls.minDistance = 0.5;
    godControls.maxDistance = 10000000; // Unlimited zoom out distance
    godControls.minPolarAngle = 0.0001; // Allow looking straight down from high altitude
    godControls.maxPolarAngle = Math.PI - 0.0001; // Full 180-degree vertical freedom
    godControls.zoomSpeed = 1.6;
    godControls.panSpeed = 1.6;
    godControls.rotateSpeed = 1.0;
    godControls.enableDamping = true;
    godControls.dampingFactor = 0.08;
    godControls.screenSpacePanning = true;
    godControls.zoomToCursor = true; // Zoom directly towards cursor position on screen
    godControls.enabled = false;
    
    godControls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };
    
    godControls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
    };

    if (playerGrp) {
        godControls.target.copy(playerGrp.position);
    }
    godControls.update();

    return { godCamera, godControls };
}

export function clampGodCameraAboveTerrainAndWater(godControls, godCamera, waterLevel = 2.4) {
    const effWaterY = (waterLevel !== undefined && waterLevel !== null) ? waterLevel : 2.4;
    const minWaterClearance = 2.5;
    const minTerrainClearance = 2.0;

    // 1. Clamp godControls.target
    if (godControls && godControls.target) {
        const targetTerrainH = getWorldHeight(godControls.target.x, godControls.target.z);
        const minTargetY = Math.max(targetTerrainH + 1.0, effWaterY + 1.0);
        if (godControls.target.y < minTargetY) {
            godControls.target.y = minTargetY;
        }
    }

    // 2. Clamp godCamera.position
    if (godCamera) {
        const camTerrainH = getWorldHeight(godCamera.position.x, godCamera.position.z);
        const minCamY = Math.max(camTerrainH + minTerrainClearance, effWaterY + minWaterClearance);
        if (godCamera.position.y < minCamY) {
            godCamera.position.y = minCamY;
        }
        godCamera.updateMatrixWorld(true);
    }
}

export function toggleGodMode(isGodMode, godCamera, camera, godControls, playerGrp, updateWaterCamera, waterLevel = 2.4) {
    if (isGodMode) {
        // Copy exact world position and orientation of active player camera
        camera.getWorldPosition(godCamera.position);
        camera.getWorldQuaternion(godCamera.quaternion);

        godCamera.far = 10000000;
        godCamera.updateProjectionMatrix();

        godControls.enabled = true;
        if (playerGrp) {
            godControls.target.copy(playerGrp.position);
        }
        clampGodCameraAboveTerrainAndWater(godControls, godCamera, waterLevel);
        godControls.update();
        if (updateWaterCamera) updateWaterCamera(godCamera);
    } else {
        godControls.enabled = false;
        if (updateWaterCamera) updateWaterCamera(camera);
    }
}

export function updateGodMode(dt, keys, godControls, godCamera, waterLevel = 2.4) {
    if (!godControls || !godControls.enabled) return;

    // Process smooth OrbitControls damping and mouse/wheel updates
    godControls.update();

    if (keys) {
        // Dynamically scale movement speed based on distance/height so panning high in the sky feels fast and responsive
        const currentDist = godCamera.position.distanceTo(godControls.target);
        const speedMult = Math.max(1.0, currentDist * 0.05, godCamera.position.y * 0.05);
        const moveSpeed = (keys.shift ? 400.0 : 100.0) * speedMult * dt;

        godCamera.getWorldDirection(_flyFwd);
        _flyFwd.y = 0;
        _flyFwd.normalize();

        _flyRight.crossVectors(_flyFwd, _flyUp).normalize();

        const moveDelta = new THREE.Vector3();

        if (keys.w || keys.ArrowUp) moveDelta.addScaledVector(_flyFwd, moveSpeed);
        if (keys.s || keys.ArrowDown) moveDelta.addScaledVector(_flyFwd, -moveSpeed);
        if (keys.d || keys.ArrowRight) moveDelta.addScaledVector(_flyRight, moveSpeed);
        if (keys.a || keys.ArrowLeft) moveDelta.addScaledVector(_flyRight, -moveSpeed);

        // Vertical elevation controls: Space or E to move up, Q to move down
        if (keys.space || keys.e) moveDelta.y += moveSpeed;
        if (keys.q) moveDelta.y -= moveSpeed;

        if (moveDelta.lengthSq() > 0) {
            godCamera.position.add(moveDelta);
            godControls.target.add(moveDelta);
        }
    }

    clampGodCameraAboveTerrainAndWater(godControls, godCamera, waterLevel);
}

