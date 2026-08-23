// Dynamic Terrain Geometry Grid Manager

import * as THREE from 'three';
import { getWorldHeight, getWorldColor, getBiomeAt } from './TerrainGenerator.js';

export class TerrainChunkManager {
    constructor(scene, terrainMat, terrainRes = 128) {
        this.scene = scene;
        this.terrainMat = terrainMat;
        this.terrainRes = terrainRes;
        
        this.lastTerrainGridX = -999999;
        this.lastTerrainGridZ = -999999;
        this.tempVec = new THREE.Vector3();
        this.tempColor = new THREE.Color();
        this.colorPath = new THREE.Color(0xa68059);

        this.terrainGeo = new THREE.PlaneGeometry(4000, 4000, terrainRes, terrainRes);
        this.terrainGeo.rotateX(-Math.PI / 2);
        this.terrain = new THREE.Mesh(this.terrainGeo, this.terrainMat);
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);
    }

    getPathStrength(x, z) {
        return 0; // Procedural path fallback
    }

    update(playerX, playerZ) {
        const stepThreshold = 150;
        if (Math.hypot(playerX - this.lastTerrainGridX, playerZ - this.lastTerrainGridZ) < stepThreshold) return;
        
        const gridX = Math.round(playerX / stepThreshold) * stepThreshold;
        const gridZ = Math.round(playerZ / stepThreshold) * stepThreshold;
        
        this.terrain.position.set(gridX, 0, gridZ);
        
        const pos = this.terrainGeo.attributes.position;
        if (!this.terrainGeo.attributes.color) {
            this.terrainGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
        }
        const colors = this.terrainGeo.attributes.color;
        const norm = this.terrainGeo.attributes.normal;

        for (let i = 0; i < pos.count; i++) {
            const worldX = pos.getX(i) + gridX;
            const worldZ = pos.getZ(i) + gridZ;
            const h = getWorldHeight(worldX, worldZ);
            pos.setY(i, h);

            const hL = getWorldHeight(worldX - 12, worldZ);
            const hR = getWorldHeight(worldX + 12, worldZ);
            const hD = getWorldHeight(worldX, worldZ - 12);
            const hU = getWorldHeight(worldX, worldZ + 12);
            this.tempVec.set(hL - hR, 24.0, hD - hU).normalize();
            norm.setXYZ(i, this.tempVec.x, this.tempVec.y, this.tempVec.z);

            getWorldColor(h, worldX, worldZ, this.tempColor);
            
            const pathMask = this.getPathStrength(worldX, worldZ);
            if (pathMask > 0 && h > 2.0 && h < 25.0) {
                const currentBiome = getBiomeAt(worldX, worldZ);
                if (currentBiome && currentBiome.name && currentBiome.name.includes('North Pole')) {
                    this.tempColor.lerp(new THREE.Color(0xd0edff), pathMask * 0.35);
                } else if (!currentBiome || !currentBiome.name || (!currentBiome.name.includes('Crystal') && !currentBiome.name.includes('Ocean') && !currentBiome.name.includes('Desert') && !currentBiome.name.includes('Canyon'))) {
                    this.tempColor.lerp(this.colorPath, pathMask * 0.85);
                }
            }

            colors.setXYZ(i, this.tempColor.r, this.tempColor.g, this.tempColor.b);
        }
        
        pos.needsUpdate = true;
        colors.needsUpdate = true;
        norm.needsUpdate = true;
        
        this.lastTerrainGridX = gridX;
        this.lastTerrainGridZ = gridZ;
    }
}
