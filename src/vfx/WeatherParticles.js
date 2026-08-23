// Weather Rain Particles & Ambient Pollen VFX - WebGPU Native TSL Pipeline
// Runs continuous particle simulation directly on the GPU, eliminating CPU loops and per-frame buffer uploads.

import * as THREE from 'three';
import { PointsNodeMaterial } from 'three/webgpu';
import { Fn, vec3, float, uniform, positionLocal, mod } from 'three/tsl';

export class WeatherParticlesVFX {
    constructor(scene, particleCount = 1500) {
        this.scene = scene;
        this.particleCount = particleCount;
        this.uTime = uniform(0.0);
        this.uSpeed = uniform(150.0);

        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.particleCount * 3);
        for (let i = 0; i < this.particleCount; i++) {
            this.positions[i * 3 + 0] = (Math.random() - 0.5) * 400;
            this.positions[i * 3 + 1] = Math.random() * 200 - 50;
            this.positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
        }
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

        this.material = new PointsNodeMaterial({
            color: 0x93c5fd,
            size: 1.8,
            transparent: true,
            opacity: 0.6,
            depthWrite: false
        });

        // WebGPU GPU-evaluated particle motion: Zero CPU loop, Zero PCIe buffer re-upload
        this.material.positionNode = Fn(() => {
            const p = positionLocal;
            const yOffset = this.uTime.mul(this.uSpeed);
            const wrappedY = mod(p.y.sub(yOffset).add(float(50.0)), float(200.0)).sub(float(50.0));
            return vec3(p.x, wrappedY, p.z);
        })();

        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false;
        this.scene.add(this.points);
    }

    update(dt, playerPosition) {
        if (!playerPosition) return;
        this.points.position.copy(playerPosition);
        this.uTime.value += dt;
    }

    dispose() {
        if (this.geometry) this.geometry.dispose();
        if (this.material) this.material.dispose();
        if (this.points && this.points.parent) {
            this.points.parent.remove(this.points);
        }
    }
}
