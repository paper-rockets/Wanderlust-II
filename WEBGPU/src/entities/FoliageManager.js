// Instanced Billboard Vegetation & Foliage Manager

import * as THREE from 'three';
import treeBillboardVert from '../shaders/props/treeBillboard.glsl?raw';

export class FoliageManager {
    constructor(scene, isLowGfx = false) {
        this.scene = scene;
        this.isLowGfx = isLowGfx;

        this.treeUniforms = {
            uPlayerPos: { value: new THREE.Vector3(0, 0, 0) },
            uTreeScale: { value: 1.5 }
        };

        this.matTree = new THREE.MeshToonMaterial({ vertexColors: true, dithering: true });
        this.matTree.onBeforeCompile = (shader) => {
            shader.uniforms.uPlayerPos = this.treeUniforms.uPlayerPos;
            shader.uniforms.uTreeScale = this.treeUniforms.uTreeScale;
            shader.vertexShader = treeBillboardVert + shader.vertexShader;
        };

        this.treeMeshes = [];
    }

    update(playerPos) {
        this.treeUniforms.uPlayerPos.value.copy(playerPos);
    }
}
