// Instanced Bioluminescent Crystal Manager

import * as THREE from 'three';
import crystalFrag from '../shaders/props/crystal.frag.glsl?raw';

export class InstancedCrystals {
    constructor(scene, count = 250) {
        this.scene = scene;
        this.count = count;

        this.geoCrystal = new THREE.ConeGeometry(3, 12, 5);
        this.matCrystal = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.1,
            metalness: 0.1,
            transmission: 0.6,
            thickness: 1.2,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide
        });

        this.matCrystal.onBeforeCompile = (shader) => {
            shader.uniforms.crystalGlow = { value: 0.0 };
            shader.uniforms.baseGlow = { value: 1.8 };
            shader.uniforms.nightGlowMult = { value: 1.5 };
            shader.uniforms.uCustomColors = { value: [
                new THREE.Color('#6a00ff'), new THREE.Color('#ff0066'),
                new THREE.Color('#ff6600'), new THREE.Color('#ffcc00'),
                new THREE.Color('#00ffaa'), new THREE.Color('#00aaff')
            ]};
            shader.uniforms.flyHue = { value: 0.0 };
            shader.uniforms.flyContrast = { value: 1.0 };
            shader.uniforms.uTime = { value: 0.0 };
            this.matCrystal.userData.shader = shader;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>\nvarying vec3 vPositionC;\nvarying vec3 vWorldNormalC;\nvarying vec3 vWorldPosC;`
            ).replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>\nvPositionC = position;`
            ).replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>
                 #if defined( USE_INSTANCING )
                     vWorldPosC = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
                     vWorldNormalC = normalize((modelMatrix * instanceMatrix * vec4(normal, 0.0)).xyz);
                 #else
                     vWorldPosC = (modelMatrix * vec4(transformed, 1.0)).xyz;
                     vWorldNormalC = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                 #endif`
            );

            shader.fragmentShader = crystalFrag + shader.fragmentShader;
        };

        this.instMesh = new THREE.InstancedMesh(this.geoCrystal, this.matCrystal, this.count);
        this.instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.instMesh.frustumCulled = false;
        this.scene.add(this.instMesh);

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.count; i++) {
            dummy.position.set(0, -9999, 0);
            dummy.updateMatrix();
            this.instMesh.setMatrixAt(i, dummy.matrix);
        }
        this.instMesh.instanceMatrix.needsUpdate = true;
    }

    update(time, inCrystalBiome, playerPos) {
        this.instMesh.visible = inCrystalBiome;
        if (!inCrystalBiome) return;

        if (this.matCrystal.userData.shader) {
            this.matCrystal.userData.shader.uniforms.uTime.value = time;
        }

        const crystalDist = 1200;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.count; i++) {
            this.instMesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
            
            if (dummy.position.y < -500 || Math.abs(dummy.position.x - playerPos.x) > crystalDist || Math.abs(dummy.position.z - playerPos.z) > crystalDist) {
                const s = (30 + Math.random() * 60) * 3;
                let dx = (Math.random() - 0.5) * crystalDist * 2.0;
                let dz = (Math.random() - 0.5) * crystalDist * 2.0;
                dummy.position.set(playerPos.x + dx, 0, playerPos.z + dz);
                dummy.scale.set(s * 0.3, s, s * 0.3);
                dummy.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.4);
                dummy.updateMatrix();
                this.instMesh.setMatrixAt(i, dummy.matrix);
            }
        }
        this.instMesh.instanceMatrix.needsUpdate = true;
    }
}
