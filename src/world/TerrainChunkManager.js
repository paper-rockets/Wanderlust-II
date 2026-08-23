// Dynamic Terrain Geometry Grid Manager with Web Worker Threading & Zero-Copy Transfers
// Scale: 8000x8000 Corridor Grid

import * as THREE from 'three';
import { getWorldHeight, getWorldColor, globalTerrainParams } from './TerrainGenerator.js';

export class TerrainChunkManager {
    constructor(scene, terrainMat, terrainRes = 256) {
        this.scene = scene;
        this.terrainMat = terrainMat;
        this.terrainRes = terrainRes;
        this.terrainSize = 8000;
        
        this.lastTerrainGridX = -999999;
        this.lastTerrainGridZ = -999999;
        this.pendingGridX = null;
        this.pendingGridZ = null;
        this.jobCounter = 0;
        this.isWorkerBusy = false;
        this.worker = null;

        this.tempVec = new THREE.Vector3();
        this.tempColor = new THREE.Color();
        this.colorPath = new THREE.Color(0xa68059);

        this.terrainGeo = new THREE.PlaneGeometry(this.terrainSize, this.terrainSize, terrainRes, terrainRes);
        this.terrainGeo.rotateX(-Math.PI / 2);

        const posCount = this.terrainGeo.attributes.position.count;
        this.terrainGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(posCount * 3), 3));

        this.terrain = new THREE.Mesh(this.terrainGeo, this.terrainMat);
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);

        this._initWorker();
    }

    _initWorker() {
        if (typeof Worker !== 'undefined') {
            try {
                this.worker = new Worker(new URL('./workers/terrainWorker.js', import.meta.url), { type: 'module' });
                this.worker.onmessage = (e) => this._onWorkerResult(e.data);
                this.worker.onerror = (err) => {
                    console.warn('[TerrainChunkManager] Worker failed, falling back to sync mode:', err);
                    this.worker = null;
                };
            } catch (err) {
                console.warn('[TerrainChunkManager] Worker instantiation failed:', err);
                this.worker = null;
            }
        }
    }

    _onWorkerResult(data) {
        const { id, gridX, gridZ, posArray, normArray, colArray } = data;
        this.isWorkerBusy = false;

        // Apply geometry buffers directly
        const pos = this.terrainGeo.attributes.position;
        const norm = this.terrainGeo.attributes.normal;
        const colors = this.terrainGeo.attributes.color;

        pos.array.set(posArray);
        pos.needsUpdate = true;

        norm.array.set(normArray);
        norm.needsUpdate = true;

        colors.array.set(colArray);
        colors.needsUpdate = true;

        this.terrain.position.set(gridX, 0, gridZ);
        this.lastTerrainGridX = gridX;
        this.lastTerrainGridZ = gridZ;

        // If another position was queued while the worker was busy, dispatch it immediately
        if (this.pendingGridX !== null && this.pendingGridZ !== null &&
            (this.pendingGridX !== this.lastTerrainGridX || this.pendingGridZ !== this.lastTerrainGridZ)) {
            const nextX = this.pendingGridX;
            const nextZ = this.pendingGridZ;
            this.pendingGridX = null;
            this.pendingGridZ = null;
            this._dispatchJob(nextX, nextZ);
        }
    }

    _dispatchJob(gridX, gridZ) {
        if (!this.worker) {
            this._updateSynchronous(gridX, gridZ);
            return;
        }

        this.isWorkerBusy = true;
        this.jobCounter++;
        this.worker.postMessage({
            id: this.jobCounter,
            gridX,
            gridZ,
            terrainSize: this.terrainSize,
            terrainRes: this.terrainRes,
            params: {
                globalHeightMultiplier: globalTerrainParams.globalHeightMultiplier,
                globalNoiseScale: globalTerrainParams.globalNoiseScale
            }
        });
    }

    getPathStrength(x, z) {
        return 0; // Procedural path fallback
    }

    forceUpdate() {
        this.lastTerrainGridX = -999999;
        this.lastTerrainGridZ = -999999;
    }

    update(playerX, playerZ) {
        const vertexSpacing = this.terrainSize / this.terrainRes;
        const gridX = Math.floor(playerX / vertexSpacing) * vertexSpacing;
        const gridZ = Math.floor(playerZ / vertexSpacing) * vertexSpacing;
        
        if (gridX === this.lastTerrainGridX && gridZ === this.lastTerrainGridZ) return;

        // First frame bootstrap: run synchronously so the world isn't blank for a frame
        if (this.lastTerrainGridX === -999999) {
            this._updateSynchronous(gridX, gridZ);
            return;
        }

        if (this.isWorkerBusy) {
            this.pendingGridX = gridX;
            this.pendingGridZ = gridZ;
            return;
        }

        this._dispatchJob(gridX, gridZ);
    }

    _updateSynchronous(gridX, gridZ) {
        this.terrain.position.set(gridX, 0, gridZ);
        
        const pos = this.terrainGeo.attributes.position;
        const halfSize = this.terrainSize * 0.5;
        const innerRadius = halfSize * 0.72;

        if (!this.terrainGeo.attributes.color) {
            this.terrainGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
        }
        const colors = this.terrainGeo.attributes.color;
        const norm = this.terrainGeo.attributes.normal;

        for (let i = 0; i < pos.count; i++) {
            const localX = pos.getX(i);
            const localZ = pos.getZ(i);
            const worldX = localX + gridX;
            const worldZ = localZ + gridZ;
            let h = getWorldHeight(worldX, worldZ);

            // Perimeter edge skirt
            const edgeDist = Math.max(Math.abs(localX), Math.abs(localZ));
            if (edgeDist > innerRadius) {
                const t = Math.max(0, Math.min(1, (edgeDist - innerRadius) / (halfSize - innerRadius)));
                const skirtT = 1.0 - t * t * (3.0 - 2.0 * t);
                h = 2.4 + (h - 2.4) * skirtT;
            }

            pos.setY(i, h);

            const hL = getWorldHeight(worldX - 12, worldZ);
            const hR = getWorldHeight(worldX + 12, worldZ);
            const hD = getWorldHeight(worldX, worldZ - 12);
            const hU = getWorldHeight(worldX, worldZ + 12);
            this.tempVec.set(hL - hR, 24.0, hD - hU).normalize();
            norm.setXYZ(i, this.tempVec.x, this.tempVec.y, this.tempVec.z);

            getWorldColor(h, worldX, worldZ, this.tempColor);
            colors.setXYZ(i, this.tempColor.r, this.tempColor.g, this.tempColor.b);
        }
        
        pos.needsUpdate = true;
        colors.needsUpdate = true;
        norm.needsUpdate = true;
        
        this.lastTerrainGridX = gridX;
        this.lastTerrainGridZ = gridZ;
    }

    dispose() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        if (this.terrainGeo) this.terrainGeo.dispose();
    }
}
