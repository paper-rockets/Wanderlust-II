// Ocean Fish Schools and Whale Pathing Simulation

import * as THREE from 'three';

export class AquaticLife {
    constructor(scene, isLowGfx = false) {
        this.scene = scene;
        this.isLowGfx = isLowGfx;
        this.whaleMesh = null;
        this.initWhale();
    }

    initWhale() {
        const geo = new THREE.ConeGeometry(8, 35, 8);
        geo.rotateX(Math.PI / 2);
        const mat = new THREE.MeshToonMaterial({ color: 0x2b4c7e });
        this.whaleMesh = new THREE.Mesh(geo, mat);
        this.whaleMesh.position.set(0, -12, 500);
        this.scene.add(this.whaleMesh);
    }

    update(time, playerPos) {
        if (this.whaleMesh) {
            this.whaleMesh.position.x = playerPos.x + Math.sin(time * 0.2) * 800;
            this.whaleMesh.position.z = playerPos.z + Math.cos(time * 0.2) * 800;
            this.whaleMesh.rotation.y = time * 0.2 + Math.PI / 2;
        }
    }
}
