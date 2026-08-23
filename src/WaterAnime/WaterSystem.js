import * as THREE from 'three';
import {
  createOpenSeaMaterial,
  timeUniform,
  seaUniform,
  speedUniform,
  detailAmountUniform,
  foamAmountUniform,
  waterOpacityUniform,
  waveHeightUniform,
  oceanScaleUniform,
  swellWavelengthUniform,
  deepColorUniform,
  shallowColorUniform,
  horizonColorUniform,
  zenithColorUniform,
  sunColorUniform,
  sunDirUniform,
  objPosUniform,
  objActiveUniform,
  qualityModeUniform,
  distanceLodUniform,
  lodDistanceThresholdUniform,
  getWaterHeightAt,
  getWaterNormalAt
} from './OpenSeaOcean.js';

export class WaterSystem {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;

        // Resolution geometries cache
        this.geometries = {
            '512': this._createPlaneGeo(512),
            '256': this._createPlaneGeo(256),
            '128': this._createPlaneGeo(128)
        };

        this.meshResolution = '512';
        this.qualityMode = 'high'; // 'high' | 'performance'
        this.distanceLod = true;

        this.openSeaMaterial = createOpenSeaMaterial();
        this.openSeaMesh = new THREE.Mesh(this.geometries['512'], this.openSeaMaterial);
        this.openSeaMesh.frustumCulled = false;
        this.openSeaMesh.position.y = 2.4;
        this.scene.add(this.openSeaMesh);

        this.visible = true;
    }

    _createPlaneGeo(segments) {
        const geo = new THREE.PlaneGeometry(16000, 16000, segments, segments);
        geo.rotateX(-Math.PI / 2);
        return geo;
    }

    setMeshResolution(res) {
        const key = String(res);
        if (this.geometries[key] && this.openSeaMesh) {
            this.openSeaMesh.geometry = this.geometries[key];
            this.meshResolution = key;
        }
    }

    setQualityMode(mode) {
        this.qualityMode = mode;
        if (mode === 'performance') {
            qualityModeUniform.value = 0.0;
            distanceLodUniform.value = 1.0;
            this.setMeshResolution(128);
        } else {
            qualityModeUniform.value = 1.0;
            distanceLodUniform.value = 1.0;
            this.setMeshResolution(512);
        }
    }

    setDistanceLod(enabled) {
        this.distanceLod = !!enabled;
        distanceLodUniform.value = this.distanceLod ? 1.0 : 0.0;
    }

    setVisible(visible) {
        this.visible = visible;
        if (this.openSeaMesh) this.openSeaMesh.visible = visible;
    }

    setHeight(y) {
        if (this.openSeaMesh) this.openSeaMesh.position.y = y;
    }

    getWaterHeight(x, z, time = 0) {
        const baseHeight = this.openSeaMesh ? this.openSeaMesh.position.y : 2.4;
        return baseHeight + getWaterHeightAt(x, z, time || timeUniform.value, seaUniform.value);
    }

    getWaterNormal(x, z, time = 0) {
        return getWaterNormalAt(x, z, time || timeUniform.value, seaUniform.value);
    }

    update(dt, elapsedTime, camera, playerPos = null, sunDir = null) {
        if (!this.visible) return;

        timeUniform.value = elapsedTime;

        if (sunDir) {
            sunDirUniform.value.copy(sunDir).normalize();
        }

        // Ocean plane follows camera in XZ for infinite horizon, quantized to mesh cell size to eliminate vertex swimming and popping
        if (this.openSeaMesh && camera) {
            if (!this._tempCamPos) this._tempCamPos = new THREE.Vector3();
            camera.getWorldPosition(this._tempCamPos);
            const segments = parseInt(this.meshResolution, 10) || 512;
            const cellSize = 16000.0 / segments;
            this.openSeaMesh.position.x = Math.floor(this._tempCamPos.x / cellSize) * cellSize;
            this.openSeaMesh.position.z = Math.floor(this._tempCamPos.z / cellSize) * cellSize;
        }

        // Player tracking
        if (playerPos) {
            objPosUniform.value.copy(playerPos);
        }
        objActiveUniform.value = 0.0;
    }

    dispose() {
        if (this.openSeaMesh) {
            this.scene.remove(this.openSeaMesh);
            this.openSeaMesh.geometry.dispose();
            this.openSeaMesh.material.dispose();
        }
    }
}
