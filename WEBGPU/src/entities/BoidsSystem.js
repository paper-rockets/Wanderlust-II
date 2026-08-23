// Bird Flocking Simulation (Boids) System

import * as THREE from 'three';
import birdFlapVert from '../shaders/entities/birdFlap.vert.glsl?raw';

export class BoidsSystem {
    constructor(scene, count = 60) {
        this.scene = scene;
        this.count = count;

        const geoBird = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            0, 0, 0.4,   -0.8, 0, -0.2,   0, 0, -0.4,
            0, 0, 0.4,    0, 0, -0.4,     0.8, 0, -0.2
        ]);
        geoBird.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geoBird.computeVertexNormals();

        this.matBird = new THREE.MeshToonMaterial({ color: 0xd6e5f5, side: THREE.DoubleSide });
        this.matBird.onBeforeCompile = (shader) => {
            shader.uniforms.time = { value: 0 };
            shader.vertexShader = birdFlapVert + shader.vertexShader;
            this.matBird.userData.shader = shader;
        };

        this.instBirds = new THREE.InstancedMesh(geoBird, this.matBird, this.count);
        this.instBirds.castShadow = true;
        this.instBirds.frustumCulled = false;
        this.scene.add(this.instBirds);

        this.birdData = new Float32Array(this.count * 6);
        for (let i = 0; i < this.count; i++) {
            this.birdData[i * 6 + 0] = (Math.random() - 0.5) * 600;
            this.birdData[i * 6 + 1] = 60 + Math.random() * 80;
            this.birdData[i * 6 + 2] = (Math.random() - 0.5) * 600;
            this.birdData[i * 6 + 3] = (Math.random() - 0.5) * 10;
            this.birdData[i * 6 + 4] = (Math.random() - 0.5) * 2;
            this.birdData[i * 6 + 5] = (Math.random() - 0.5) * 10;
        }
    }

    update(time, playerPos) {
        if (this.matBird.userData.shader) {
            this.matBird.userData.shader.uniforms.time.value = time;
        }

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.count; i++) {
            let px = this.birdData[i * 6 + 0];
            let py = this.birdData[i * 6 + 1];
            let pz = this.birdData[i * 6 + 2];
            let vx = this.birdData[i * 6 + 3];
            let vy = this.birdData[i * 6 + 4];
            let vz = this.birdData[i * 6 + 5];

            px += vx * 0.016;
            py += vy * 0.016;
            pz += vz * 0.016;

            if (Math.abs(px - playerPos.x) > 400) px = playerPos.x - Math.sign(px - playerPos.x) * 390;
            if (Math.abs(pz - playerPos.z) > 400) pz = playerPos.z - Math.sign(pz - playerPos.z) * 390;

            this.birdData[i * 6 + 0] = px;
            this.birdData[i * 6 + 1] = py;
            this.birdData[i * 6 + 2] = pz;

            dummy.position.set(px, py, pz);
            dummy.scale.set(6, 6, 6);
            dummy.rotation.y = Math.atan2(vx, vz);
            dummy.updateMatrix();
            this.instBirds.setMatrixAt(i, dummy.matrix);
        }
        this.instBirds.instanceMatrix.needsUpdate = true;
    }
}
