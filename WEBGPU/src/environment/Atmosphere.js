// Atmosphere & Celestial Day/Night Cycle Manager

import * as THREE from 'three';

export const ENV_CONFIGS = [
    { bg: 0x8cbce6, fog: 0x8cbce6, amb: 0xdcf2ff, dir: 0xfffaeb, ambI: 0.9, dirI: 2.5, starOp: 0, sunY: 1500, moonY: -1500 }, // Day
    { bg: 0xffa07a, fog: 0xffa07a, amb: 0xffdab9, dir: 0xffaa00, ambI: 1.1, dirI: 3.2, starOp: 0, sunY: 160, moonY: 200 },   // Dusk
    { bg: 0x162d5a, fog: 0x224888, amb: 0x7788bb, dir: 0xffbb55, ambI: 1.5, dirI: 3.5, starOp: 1.0, sunY: -8000, moonY: 1600 } // Night
];

export class AtmosphereManager {
    constructor(scene, isLowGfx = false) {
        this.scene = scene;
        this.isLowGfx = isLowGfx;
        this.timePhase = 0; // 0: Day, 1: Dusk, 2: Night

        this.scene.background = new THREE.Color(ENV_CONFIGS[0].bg);
        this.scene.fog = new THREE.FogExp2(ENV_CONFIGS[0].fog, 0.00035);

        // Starfield
        const starGeo = new THREE.BufferGeometry();
        const starCount = this.isLowGfx ? 500 : 2500;
        const starPositions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            starPositions[i * 3 + 0] = (Math.random() - 0.5) * 8000;
            starPositions[i * 3 + 1] = Math.random() * 3000 + 200;
            starPositions[i * 3 + 2] = (Math.random() - 0.5) * 8000;
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.5, transparent: true, opacity: 0 });
        this.starField = new THREE.Points(starGeo, this.starMat);
        this.starField.visible = false;
        this.scene.add(this.starField);

        this.tempColor = new THREE.Color();
    }

    setTimePhase(phase) {
        this.timePhase = phase % ENV_CONFIGS.length;
    }

    update(dt, lighting, playerPos) {
        const target = ENV_CONFIGS[this.timePhase];
        const decayEnv = 1.0 - Math.exp(-2.0 * dt);

        this.scene.background.lerp(this.tempColor.setHex(target.bg), decayEnv);
        this.scene.fog.color.lerp(this.tempColor.setHex(target.fog), decayEnv);

        if (lighting) {
            lighting.ambientLight.color.lerp(this.tempColor.setHex(target.amb), decayEnv);
            lighting.ambientLight.intensity += (target.ambI - lighting.ambientLight.intensity) * decayEnv;
            lighting.dirLight.color.lerp(this.tempColor.setHex(target.dir), decayEnv);
        }

        this.starMat.opacity += (target.starOp - this.starMat.opacity) * decayEnv;
        this.starField.visible = this.starMat.opacity > 0.02;

        if (playerPos) {
            this.starField.position.copy(playerPos);
        }
    }
}
