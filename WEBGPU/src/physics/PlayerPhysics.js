import * as THREE from 'three';
import { getWorldHeight, getBiomeAt } from '../world/TerrainGenerator.js';

export class PlayerPhysics {
    constructor(characterGroup) {
        this.character = characterGroup;
        
        this.currentYaw = 0;   
        this.currentPitch = 0; 
        this.currentRoll = 0;
        this.turnVelocity = 0;
        this.maxTurnSpeed = 1.0; 
        this.turnAcceleration = 2.0; 
        this.maxBankAngle = Math.PI / 6; 
        this.maxPitchAngle = Math.PI / 10; 
        this.velocity = 18.0; 
        this.maxAltitude = 3500;

        // Shared Temps
        this.eulerRotation = new THREE.Euler(0, 0, 0, 'YXZ');
        this.targetQuaternion = new THREE.Quaternion();
        this.tempVec1 = new THREE.Vector3();
    }

    update(delta, inputState, isBraking, isBoosting, isFlightPaused, treeGrid) {
        if (isFlightPaused) return;

        // Accelerate/Decelerate
        const targetSpeed = isBraking ? 0.0 : (isBoosting ? 250.0 : 18.0);
        this.velocity += (targetSpeed - this.velocity) * delta * (isBraking ? 3.0 : (isBoosting ? 1.5 : 1.0));

        // Steering
        const decaySteer = 1.0 - Math.exp(-3.5 * delta);
        const decayRoll = 1.0 - Math.exp(-1.5 * delta);
        const decayPitch = 1.0 - Math.exp(-1.5 * delta);
        const decayCharacterQuat = 1.0 - Math.exp(-5.0 * delta);

        if (inputState.left) {
            this.turnVelocity += this.turnAcceleration * delta;
        } else if (inputState.right) {
            this.turnVelocity -= this.turnAcceleration * delta;
        } else {
            this.turnVelocity = THREE.MathUtils.lerp(this.turnVelocity, 0, decaySteer); 
        }
        
        this.turnVelocity = Math.max(-this.maxTurnSpeed, Math.min(this.maxTurnSpeed, this.turnVelocity));
        this.currentYaw += this.turnVelocity * delta;

        // Banking
        let targetRoll = (this.turnVelocity / this.maxTurnSpeed) * this.maxBankAngle;
        this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, targetRoll, decayRoll); 

        // Altitude Control
        let targetPitch = -0.18; // Default
        if (inputState.up) { 
            targetPitch = this.maxPitchAngle; 
        } else if (inputState.down) {
            targetPitch = -this.maxPitchAngle; 
        }
        this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, targetPitch, decayPitch);

        // Apply Rotations
        this.eulerRotation.set(this.currentPitch, this.currentYaw, this.currentRoll, 'YXZ');
        this.targetQuaternion.setFromEuler(this.eulerRotation);
        
        // Soft camera auto-leveling
        if (!inputState.left && !inputState.right && !inputState.up && !inputState.down) {
            this.character.quaternion.slerp(this.targetQuaternion, 1.0 - Math.exp(-1.2 * delta)); 
        } else {
            this.character.quaternion.slerp(this.targetQuaternion, decayCharacterQuat); 
        }

        // Forward Flight
        this.tempVec1.set(0, 0, -1); 
        this.tempVec1.applyQuaternion(this.character.quaternion);
        
        this.character.position.add(this.tempVec1.multiplyScalar(this.velocity * delta));

        // Anti-Clipping Floor Constraint (strictly above terrain and sea level)
        const seaLevelY = 2.4;
        const groundY = Math.max(getWorldHeight(this.character.position.x, this.character.position.z), seaLevelY);
        const minimumFlightHeight = 24;
        
        // In Lush Jungle, raise the floor so Kiki flies above the canopy (trees are ~36m tall)
        const biome = getBiomeAt(this.character.position.x, this.character.position.z);
        const inJungle = biome && biome.name && biome.name.toLowerCase().includes('jungle');
        const canopyHeight = inJungle ? 42 : 18; // clearance above ground/sea

        // Auto-swoop to avoid terrain collisions
        const targetMinY = groundY + (inJungle ? 65 : 45);
        if (this.character.position.y < targetMinY) {
            const depth = targetMinY - this.character.position.y;
            const swoopPitch = Math.min(Math.PI / 4, depth / 40.0);
            this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, swoopPitch, 1.0 - Math.exp(-3.0 * delta));
            this.character.rotation.set(this.currentPitch, this.currentYaw, 0, 'YXZ');
            
            if (this.character.position.y < groundY + canopyHeight) {
                this.character.position.y += (groundY + canopyHeight - this.character.position.y) * (1.0 - Math.exp(-5.0 * delta));
            }
        }
        
        this.character.position.y = Math.min(Math.max(this.character.position.y, groundY + canopyHeight, minimumFlightHeight), this.maxAltitude);

        // Tree Collisions disabled - Kiki flies above the jungle canopy
    }
}
