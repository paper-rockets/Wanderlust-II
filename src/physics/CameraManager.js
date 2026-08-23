import * as THREE from 'three';

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
    }
    
    update(delta, playerGrp, currentYaw, isBoosting) {
        const defaultCamDist = this.cameraZoomDist;
        const defaultCamHeight = this.cameraZoomDist * 0.15;
        
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
        
        // Anchor camera base directly to player position to eliminate translational lag jitter during framerate fluctuations
        this.cameraBase.position.copy(playerGrp.position);
        
        // Speed zoom effect
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, isBoosting ? this.BASE_FOV + 12 : this.BASE_FOV, 1.0 - Math.exp(-5.0 * delta));
        this.camera.up.set(0, 1, 0);
        this.camera.rotation.z = 0;
        this.camera.updateProjectionMatrix();
    }
    
    setZoom(dist) {
        this.cameraZoomDist = Math.max(5.0, Math.min(300.0, dist));
    }
}
