import * as THREE from 'three';
import { getWorldHeight } from '../world/TerrainGenerator.js';

const _tempCamWorldPos = new THREE.Vector3();

export class CameraManager {
    constructor(camera, cameraBase, initialZoomDist = 12.0) {
        this.camera = camera;
        this.cameraBase = cameraBase;
        
        this.baseTargetQuat = new THREE.Quaternion();
        this.eulerRotation = new THREE.Euler(0, 0, 0, 'YXZ');
        this.quatIdentity = new THREE.Quaternion();
        
        // Settings
        this.BASE_FOV = 60;
        this.cameraZoomDist = initialZoomDist;
        this.minTerrainClearance = 8.0;
        this.minWaterClearance = 16.0; // Enforces minimum elevation above sea level
    }
    
    update(delta, playerGrp, currentYaw, isBoosting, waterLevel = 2.4) {
        const defaultCamDist = this.cameraZoomDist;
        const defaultCamHeight = this.cameraZoomDist * 0.18;
        
        // Smoothly lerp camera to default distance using exponential decay
        const decayZoom = 1.0 - Math.exp(-5.0 * delta);
        this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, defaultCamDist, decayZoom);
        this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, defaultCamHeight, decayZoom);
        
        // Match player yaw for the base
        const decayCameraBaseQuat = 1.0 - Math.exp(-2.8 * delta);
        const decayCameraQuat = 1.0 - Math.exp(-2.0 * delta);

        this.eulerRotation.set(0, currentYaw, 0, 'YXZ'); 
        this.baseTargetQuat.setFromEuler(this.eulerRotation);
        
        this.cameraBase.quaternion.slerp(this.baseTargetQuat, decayCameraBaseQuat); 
        this.camera.quaternion.slerp(this.quatIdentity, decayCameraQuat);
        
        // Single unified cameraBase tracking pass per frame (exponential lerp)
        const decayCamPos = 1.0 - Math.exp(-22.0 * delta);
        this.cameraBase.position.lerp(playerGrp.position, decayCamPos);
        
        // Speed zoom effect
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, isBoosting ? this.BASE_FOV + 12 : this.BASE_FOV, 1.0 - Math.exp(-5.0 * delta));
        this.camera.up.set(0, 1, 0);
        this.camera.rotation.z = 0;
        this.camera.updateProjectionMatrix();

        // Enforce terrain and water height constraints to prevent camera going underground or underwater
        this.clampAboveTerrainAndWater(playerGrp, waterLevel);
    }

    clampAboveTerrainAndWater(playerGrp, waterLevel = 2.4) {
        this.camera.updateMatrixWorld(true);
        this.camera.getWorldPosition(_tempCamWorldPos);

        const effWaterY = (waterLevel !== undefined && waterLevel !== null) ? waterLevel : 2.4;

        // 1. Direct height check at camera's world coordinates
        const camTerrainH = getWorldHeight(_tempCamWorldPos.x, _tempCamWorldPos.z);
        let minRequiredCamY = Math.max(camTerrainH + this.minTerrainClearance, effWaterY + this.minWaterClearance);

        // 2. Line of sight check between player and camera to prevent clipping through terrain ridges
        if (playerGrp && playerGrp.position) {
            const pX = playerGrp.position.x;
            const pY = playerGrp.position.y;
            const pZ = playerGrp.position.z;
            const cX = _tempCamWorldPos.x;
            const cZ = _tempCamWorldPos.z;

            const steps = Math.max(4, Math.min(10, Math.ceil(this.cameraZoomDist / 25)));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const sampleX = pX + (cX - pX) * t;
                const sampleZ = pZ + (cZ - pZ) * t;
                const sampleTerrainH = getWorldHeight(sampleX, sampleZ);
                const sampleFloor = Math.max(sampleTerrainH + this.minTerrainClearance, effWaterY + this.minWaterClearance);
                
                const reqY = pY + (sampleFloor - pY) / t;
                if (reqY > minRequiredCamY) {
                    minRequiredCamY = reqY;
                }
            }
        }

        // 3. Lift cameraBase if camera is below minimum required height
        if (_tempCamWorldPos.y < minRequiredCamY) {
            const liftAmount = minRequiredCamY - _tempCamWorldPos.y;
            this.cameraBase.position.y += liftAmount;
            this.camera.updateMatrixWorld(true);
        }
    }
    
    setZoom(dist) {
        this.cameraZoomDist = Math.max(5.0, Math.min(300.0, dist));
    }
}
