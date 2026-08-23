// Weather Rain Particles & Ambient Pollen VFX

import * as THREE from 'three';

export class WeatherParticlesVFX {
    constructor(scene, particleCount = 1000) {
        this.scene = scene;
        this.particleCount = particleCount;

        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.particleCount * 3);
        for (let i = 0; i < this.particleCount; i++) {
            this.positions[i * 3 + 0] = (Math.random() - 0.5) * 400;
            this.positions[i * 3 + 1] = Math.random() * 200;
            this.positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
        }
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

        this.material = new THREE.PointsMaterial({
            color: 0x93c5fd,
            size: 1.5,
            transparent: true,
            opacity: 0.5
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.points);
    }

    update(dt, playerPosition) {
        if (!playerPosition) return;
        this.points.position.copy(playerPosition);
        const pos = this.geometry.attributes.position;
        for (let i = 0; i < this.particleCount; i++) {
            let y = pos.getY(i);
            y -= 150 * dt;
            if (y < -50) y = 150;
            pos.setY(i, y);
        }
        pos.needsUpdate = true;
    }
}
