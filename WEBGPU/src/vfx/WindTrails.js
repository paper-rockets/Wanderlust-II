// Wingtip Wind Trail Ribbons VFX

import * as THREE from 'three';

export class WindTrailsVFX {
    constructor(scene) {
        this.scene = scene;
        this.trailCount = 60;
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.trailCount * 3);
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

        this.material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
        this.line = new THREE.Line(this.geometry, this.material);
        this.scene.add(this.line);
    }

    update(playerPosition) {
        if (!playerPosition) return;
        for (let i = this.trailCount - 1; i > 0; i--) {
            this.positions[i * 3 + 0] = this.positions[(i - 1) * 3 + 0];
            this.positions[i * 3 + 1] = this.positions[(i - 1) * 3 + 1];
            this.positions[i * 3 + 2] = this.positions[(i - 1) * 3 + 2];
        }
        this.positions[0] = playerPosition.x;
        this.positions[1] = playerPosition.y;
        this.positions[2] = playerPosition.z;
        this.geometry.attributes.position.needsUpdate = true;
    }
}
