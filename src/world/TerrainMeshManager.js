import * as THREE from 'three';
import { snoise } from './Noise.js';
import { getWorldHeight, getWorldColor } from './TerrainGenerator.js';

export class TerrainMeshManager {
    constructor({ scene, terrainMat, terrainRes = 128, terrainSize = 8000 }) {
        this.scene = scene;
        this.terrainRes = terrainRes;
        this.terrainSize = terrainSize;

        this.terrainGeo = new THREE.PlaneGeometry(this.terrainSize, this.terrainSize, this.terrainRes, this.terrainRes);
        this.terrainGeo.rotateX(-Math.PI / 2);
        this.terrain = new THREE.Mesh(this.terrainGeo, terrainMat);
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);

        this.lastTerrainGridX = -9999;
        this.lastTerrainGridZ = -9999;
        this.lastDepthFieldGridX = -999999;
        this.lastDepthFieldGridZ = -999999;

        this.tempColor = new THREE.Color();
    }

    _smoothstep(edge0, edge1, x) {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    }

    update(playerX, playerZ, animeWaterSystem) {
        const stepThreshold = 80;
        if (Math.hypot(playerX - this.lastTerrainGridX, playerZ - this.lastTerrainGridZ) < stepThreshold) return;

        const gridX = Math.round(playerX / stepThreshold) * stepThreshold;
        const gridZ = Math.round(playerZ / stepThreshold) * stepThreshold;

        if (animeWaterSystem && Math.hypot(gridX - this.lastDepthFieldGridX, gridZ - this.lastDepthFieldGridZ) > 200) {
            animeWaterSystem.rebuildDepthField(gridX, gridZ);
            this.lastDepthFieldGridX = gridX;
            this.lastDepthFieldGridZ = gridZ;
        }

        this.terrain.position.set(gridX, 0, gridZ);

        const pos = this.terrainGeo.attributes.position;
        const norm = this.terrainGeo.attributes.normal;
        const halfSize = this.terrainSize * 0.5;
        const innerRadius = halfSize * 0.72;
        const N = this.terrainRes + 1;

        // 1. Single-pass height calculation
        for (let i = 0; i < pos.count; i++) {
            const localX = pos.getX(i);
            const localZ = pos.getZ(i);
            const worldX = localX + gridX;
            const worldZ = localZ + gridZ;
            let h = getWorldHeight(worldX, worldZ);

            // Perimeter edge skirt
            const edgeDist = Math.max(Math.abs(localX), Math.abs(localZ));
            if (edgeDist > innerRadius) {
                const skirtT = this._smoothstep(halfSize, innerRadius, edgeDist);
                h = 2.4 + (h - 2.4) * skirtT;
            }

            pos.setY(i, h);
        }

        // 2. Direct grid normal calculation from buffer
        const cellSpacing = this.terrainSize / this.terrainRes;
        const twoSpacing = cellSpacing * 2.0;
        for (let r = 0; r < N; r++) {
            const rOffset = r * N;
            const rPrev = Math.max(0, r - 1) * N;
            const rNext = Math.min(N - 1, r + 1) * N;
            for (let c = 0; c < N; c++) {
                const idx = rOffset + c;
                const hL = pos.getY(rOffset + Math.max(0, c - 1));
                const hR = pos.getY(rOffset + Math.min(N - 1, c + 1));
                const hD = pos.getY(rPrev + c);
                const hU = pos.getY(rNext + c);
                const dx = hL - hR;
                const dz = hD - hU;
                const invLen = 1.0 / Math.sqrt(dx * dx + twoSpacing * twoSpacing + dz * dz);
                norm.setXYZ(idx, dx * invLen, twoSpacing * invLen, dz * invLen);
            }
        }

        // 3. Vertex color computation
        if (!this.terrainGeo.attributes.color) {
            this.terrainGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
        }
        const colors = this.terrainGeo.attributes.color;
        for (let i = 0; i < pos.count; i++) {
            const localX = pos.getX(i);
            const localZ = pos.getZ(i);
            const worldX = localX + gridX;
            const worldZ = localZ + gridZ;
            const h = pos.getY(i);
            getWorldColor(h, worldX, worldZ, this.tempColor);
            colors.setXYZ(i, this.tempColor.r, this.tempColor.g, this.tempColor.b);
        }

        pos.needsUpdate = true;
        norm.needsUpdate = true;
        colors.needsUpdate = true;

        this.lastTerrainGridX = gridX;
        this.lastTerrainGridZ = gridZ;
    }
}
