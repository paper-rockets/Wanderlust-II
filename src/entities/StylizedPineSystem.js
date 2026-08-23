// Stylized Pine Biome Tree System
// =========================================================================================
// Procedural, instanced, LOD-managed placement of 3D Stylized Pines with custom
// TSL shaders (Spring & Autumn gradients, trunk bark, and synchronized wind sway).

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshToonNodeMaterial } from 'three/webgpu';
import {
    Fn, vec3, vec4, float, uniform, attribute, texture, uv, mix, clamp,
    smoothstep, positionLocal, positionGeometry, modelWorldMatrix, fract, sin, cos, max, pow
} from 'three/tsl';

const PINE_FILES = [
    { key: 'pine_01_med',      path: 'assets/models/trees/pine_tree_01.glb', targetHeight: 6.0 },
    { key: 'pine_02_full',     path: 'assets/models/trees/pine_tree_02.glb', targetHeight: 6.0 },
    { key: 'pine_03_dense',    path: 'assets/models/trees/pine_tree_03.glb', targetHeight: 6.0 },
    { key: 'pine_04_stylized', path: 'assets/models/trees/pine_tree_04.glb', targetHeight: 6.0 },
    { key: 'pine_05_tall',     path: 'assets/models/trees/pine_tree_05.glb', targetHeight: 9.0 },
    { key: 'pine_06_ancient',  path: 'assets/models/trees/pine_tree_06.glb', targetHeight: 11.0 },
    { key: 'pine_07_small',    path: 'assets/models/trees/pine_tree_07.glb', targetHeight: 3.0 },
    { key: 'pine_08_sapling',  path: 'assets/models/trees/pine_tree_08.glb', targetHeight: 2.0 }
];

const LOD_BANDS = [
    { name: 'near', maxDist: 160,  doubleSided: true,  sway: true,  alphaTest: 0.35 },
    { name: 'mid',  maxDist: 480,  doubleSided: false, sway: true,  alphaTest: 0.50 },
    { name: 'far',  maxDist: 1200, doubleSided: false, sway: false, alphaTest: 0.62 }
];

const DEFAULT_CELL_SIZE = 32.0;  // world units; minimum tree spacing
const REBUILD_DISTANCE = 50.0;   // rebuild field when camera/focus moves this far
const REBUILD_FRAMES = 18;       // sliced cell walk frames

function cellHash(cx, cz, slot) {
    let h = Math.imul(cx, 374761393) + Math.imul(cz, 668265263) + Math.imul(slot, 2654435761);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class StylizedPineSystem {
    constructor(opts) {
        this.scene = opts.scene;
        this.gltfLoader = opts.gltfLoader;
        this.resolveAssetUrl = opts.resolveAssetUrl || ((p) => p);
        this.uTime = opts.uTime;
        this.gradientMap = opts.gradientMap || null;
        this.getWorldHeight = opts.getWorldHeight;
        this.getBiomeAt = opts.getBiomeAt;
        this.getIslandData = opts.getIslandData;
        this.getPathStrength = opts.getPathStrength || (() => 0);
        this.densityScale = opts.densityScale !== undefined ? opts.densityScale : 1.0;

        this.ready = false;
        this.enabled = true;
        this.meshes = [];
        this._byVariantBand = [];
        this._dummy = new THREE.Object3D();
        this._lastFocusX = Infinity;
        this._lastFocusZ = Infinity;
        this._walk = null;
        this._collected = [];
        this.lastCounts = { near: 0, mid: 0, far: 0 };

        // Uniforms for shaders
        this.uLeafBottom     = uniform(new THREE.Color('#1c3b23'));
        this.uLeafTop        = uniform(new THREE.Color('#5c8338'));
        this.uLeafVarColor   = uniform(new THREE.Color('#1e4430'));
        this.uLeafBrightness = uniform(1.05);
        this.uLeafGradPower  = uniform(1.1);
        this.uLeafVarStrength= uniform(0.6);
        this.uLeafVarScale   = uniform(0.08);

        this.uBarkBase       = uniform(new THREE.Color('#2e1b10'));
        this.uBarkTop        = uniform(new THREE.Color('#5c3a21'));
        this.uBarkBrightness = uniform(1.35);

        this.uWindStrength   = uniform(1.0);
        this.uTreeScale      = uniform(1.0);

        // Pool sizes per band
        const d = this.densityScale;
        this.poolSizes = {
            near: Math.max(32, Math.round(900 * d)),
            mid:  Math.max(64, Math.round(2000 * d)),
            far:  Math.max(96, Math.round(3600 * d))
        };

        // Placement settings
        this.minElevation = 4.0;
        this.maxElevation = 85.0;
        this.maxSlope = 0.65;
        this.density = 1.0;
        this.scaleMul = 1.0;
        this.cellSize = DEFAULT_CELL_SIZE;
        this.currentPreset = 'spring';
    }

    setPreset(name) {
        this.currentPreset = name;
        if (name === 'autumn') {
            this.uLeafBottom.value.set('#ffaf36');
            this.uLeafTop.value.set('#ff1910');
            this.uLeafVarColor.value.set('#8f2409');
            this.uLeafBrightness.value = 1.1;
        } else {
            this.uLeafBottom.value.set('#1c3b23');
            this.uLeafTop.value.set('#5c8338');
            this.uLeafVarColor.value.set('#1e4430');
            this.uLeafBrightness.value = 1.05;
        }
    }

    async load() {
        const gltfs = await Promise.all(PINE_FILES.map(f =>
            new Promise((res, rej) => this.gltfLoader.load(this.resolveAssetUrl(f.path), res, undefined, rej))
        ));

        gltfs.forEach((gltf, vi) => {
            const geo = this._extractMergedGeometry(gltf, PINE_FILES[vi].targetHeight);
            if (!geo) return;

            const row = [];
            LOD_BANDS.forEach((band) => {
                const mat = this._buildMaterial(band);
                const pool = this.poolSizes[band.name];
                const count = Math.max(8, Math.round(pool / PINE_FILES.length));
                const mesh = new THREE.InstancedMesh(geo, mat, count);
                mesh.name = `${PINE_FILES[vi].key}_${band.name}`;
                mesh.castShadow = band.name === 'near';
                mesh.receiveShadow = true;
                mesh.count = 0;
                mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), band.maxDist + 60);
                mesh.frustumCulled = false;
                this.scene.add(mesh);
                row.push(mesh);
                this.meshes.push(mesh);
            });
            this._byVariantBand.push(row);
        });

        this.ready = this._byVariantBand.length > 0;
        return this.ready;
    }

    _extractMergedGeometry(gltf, targetHeight) {
        gltf.scene.updateMatrixWorld(true);
        const subGeos = [];

        gltf.scene.traverse(c => {
            if (c.isMesh && c.geometry) {
                const g = c.geometry.clone();
                g.applyMatrix4(c.matrixWorld);

                const isBark = (c.name && c.name.toLowerCase().includes('trunk')) ||
                               (c.material && c.material.name && c.material.name.toLowerCase().includes('trunk')) ||
                               (c.material && c.material.name && c.material.name.includes('011')) ? 1.0 : 0.0;

                const nVerts = g.attributes.position.count;
                const barkArr = new Float32Array(nVerts).fill(isBark);
                g.setAttribute('aIsBark', new THREE.BufferAttribute(barkArr, 1));

                // Clean extraneous attributes for instancing performance
                if (g.attributes.tangent) g.deleteAttribute('tangent');
                if (g.attributes.color) g.deleteAttribute('color');

                subGeos.push(g);
            }
        });

        if (subGeos.length === 0) return null;

        let merged = subGeos.length === 1 ? subGeos[0] : BufferGeometryUtils.mergeGeometries(subGeos, false);
        if (!merged) return null;

        merged.computeBoundingBox();
        const bb = merged.boundingBox;
        const h = bb.max.y - bb.min.y;
        const s = h > 0 ? targetHeight / h : 1.0;
        merged.translate(0, -bb.min.y, 0); // sit firmly on ground (Y=0)
        merged.scale(s, s, s);

        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        return merged;
    }

    _buildMaterial(band) {
        const mat = new MeshToonNodeMaterial({
            gradientMap: this.gradientMap || undefined,
            side: band.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
            transparent: false,
            alphaTest: band.alphaTest,
            depthWrite: true,
            dithering: true
        });

        const aIsBark = attribute('aIsBark', 'float');

        mat.colorNode = Fn(() => {
            const localY = clamp(positionLocal.y.div(6.0), 0.0, 1.0);

            // Per-instance hash for natural color variation
            const origin = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0));
            const instHash = fract(sin(origin.x.mul(12.9898).add(origin.z.mul(78.233))).mul(43758.5453));

            // Foliage Gradient
            const gradT = pow(localY, this.uLeafGradPower);
            const leafBase = mix(this.uLeafBottom, this.uLeafTop, gradT);

            // Subtle foliage tonal variation
            const varNoise = instHash.sub(0.5).mul(this.uLeafVarStrength);
            const variedLeaf = mix(leafBase, this.uLeafVarColor, varNoise.mul(0.5)).mul(this.uLeafBrightness);

            // Bark Gradient
            const barkCol = mix(this.uBarkBase, this.uBarkTop, smoothstep(float(0.0), float(0.6), localY)).mul(this.uBarkBrightness);

            return mix(variedLeaf, barkCol, aIsBark);
        })();

        if (band.sway) {
            mat.positionNode = Fn(() => {
                const p = positionLocal.toVar();
                const origin = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0));

                // Multi-frequency wind oscillation
                const w1 = sin(this.uTime.mul(1.4).add(origin.x.mul(0.025)).add(origin.z.mul(0.02))).mul(0.06);
                const w2 = cos(this.uTime.mul(2.5).add(origin.x.mul(0.05)).add(origin.z.mul(0.035))).mul(0.03);
                const flutter = sin(this.uTime.mul(3.8).add(positionGeometry.y.mul(2.0))).mul(0.015);

                const heightFactor = max(0.0, positionGeometry.y).div(6.0);
                const mask = heightFactor.mul(heightFactor); // Quadratic curve: 0 at base, sways at crown

                const totalSway = w1.add(w2).add(flutter).mul(mask).mul(this.uWindStrength);

                p.x.addAssign(totalSway);
                p.z.addAssign(totalSway.mul(0.7));
                p.y.subAssign(abs(totalSway).mul(0.08));

                return p;
            })();
        }

        return mat;
    }

    _isValidSite(x, z) {
        const biome = this.getBiomeAt(x, z);
        if (!biome || !biome.name) return null;

        // Populate Highland, Ghibli, and Plains
        const isTargetBiome = biome.name.includes('Ghibli') ||
                              biome.name.includes('Misty') ||
                              biome.name.includes('Mountain') ||
                              biome.name.includes('Plains') ||
                              biome.name.includes('Highland');
        if (!isTargetBiome) return null;

        const island = this.getIslandData(x, z);
        if (!island || island.mask < 0.25) return null;

        const h = this.getWorldHeight(x, z);
        if (h < this.minElevation || h > this.maxElevation) return null;

        if (this.getPathStrength(x, z) >= 0.20) return null;

        const hx = this.getWorldHeight(x + 8, z);
        const hz = this.getWorldHeight(x, z + 8);
        const slope = Math.max(Math.abs(hx - h), Math.abs(hz - h)) / 8.0;
        if (slope > this.maxSlope) return null;

        return h;
    }

    _visitCell(cx, cz, focusX, focusZ, maxDistSq, out) {
        const ddx = (cx + 0.5) * this.cellSize - focusX;
        const ddz = (cz + 0.5) * this.cellSize - focusZ;
        const distSq = ddx * ddx + ddz * ddz;
        if (distSq > maxDistSq) return;

        const fill = cellHash(cx, cz, 0);
        const d = this.density;
        let slots = 0;
        if (fill < 0.65 * d) slots = 1;
        if (fill < 0.35 * d) slots = 2;
        if (fill < 0.12 * d) slots = 3;
        if (slots <= 0) return;

        for (let s = 0; s < slots; s++) {
            const jx = cellHash(cx, cz, s * 3 + 1);
            const jz = cellHash(cx, cz, s * 3 + 2);
            const x = (cx + jx) * this.cellSize;
            const z = (cz + jz) * this.cellSize;

            const h = this._isValidSite(x, z);
            if (h === null) continue;

            const r = cellHash(cx, cz, s * 3 + 3);
            const grove = (Math.sin(x * 0.003) * Math.cos(z * 0.003) + 1.0) * 0.5;
            let variant;
            if (r < 0.25) {
                variant = Math.floor(cellHash(cx, cz, s * 3 + 4) * PINE_FILES.length);
            } else {
                variant = Math.floor((grove * 0.75 + cellHash(cx, cz, s * 3 + 4) * 0.25) * PINE_FILES.length);
            }
            variant = Math.min(PINE_FILES.length - 1, Math.max(0, variant));

            out.push({
                x, y: h, z,
                variant,
                rot: r * Math.PI * 2.0,
                scale: (0.85 + cellHash(cx, cz, s * 3 + 5) * 0.35) * this.scaleMul,
                dist: Math.sqrt(distSq)
            });
        }
    }

    _commit(focusX, focusZ) {
        const perMeshCount = this._byVariantBand.map(row => row.map(() => 0));
        const dummy = this._dummy;

        this._collected.sort((a, b) => a.dist - b.dist);

        for (const c of this._collected) {
            let band = -1;
            for (let b = 0; b < LOD_BANDS.length; b++) {
                if (c.dist <= LOD_BANDS[b].maxDist) { band = b; break; }
            }
            if (band < 0) continue;

            const row = this._byVariantBand[c.variant];
            if (!row) continue;
            const mesh = row[band];
            if (!mesh) continue;

            const idx = perMeshCount[c.variant][band];
            if (idx >= mesh.instanceMatrix.count) continue;

            dummy.position.set(c.x, c.y, c.z);
            dummy.rotation.set(0, c.rot, 0);
            dummy.scale.setScalar(c.scale);
            dummy.updateMatrix();
            mesh.setMatrixAt(idx, dummy.matrix);
            perMeshCount[c.variant][band] = idx + 1;
        }

        const counts = { near: 0, mid: 0, far: 0 };
        this._byVariantBand.forEach((row, vi) => {
            row.forEach((mesh, bi) => {
                mesh.count = perMeshCount[vi][bi];
                mesh.instanceMatrix.needsUpdate = true;
                mesh.boundingSphere.center.set(focusX, 0, focusZ);
                mesh.boundingSphere.radius = LOD_BANDS[bi].maxDist + 60;
                mesh.frustumCulled = true;
                counts[LOD_BANDS[bi].name] += mesh.count;
            });
        });
        this.lastCounts = counts;
    }

    update(focusX, focusZ) {
        if (!this.ready || !this.enabled) return;

        if (this._walk) {
            const w = this._walk;
            const perFrame = Math.ceil(w.total / REBUILD_FRAMES);
            const end = Math.min(w.total, w.i + perFrame);

            for (let i = w.i; i < end; i++) {
                const dx = (i % w.width) - w.radius;
                const dz = ((i / w.width) | 0) - w.radius;
                this._visitCell(w.baseCX + dx, w.baseCZ + dz, w.focusX, w.focusZ, w.maxDistSq, this._collected);
            }
            w.i = end;

            if (w.i >= w.total) {
                this._commit(w.focusX, w.focusZ);
                this._walk = null;
            }
            return;
        }

        const dx = focusX - this._lastFocusX;
        const dz = focusZ - this._lastFocusZ;
        if (dx * dx + dz * dz < REBUILD_DISTANCE * REBUILD_DISTANCE) return;

        this._lastFocusX = focusX;
        this._lastFocusZ = focusZ;

        const maxDist = LOD_BANDS[LOD_BANDS.length - 1].maxDist;
        const radius = Math.ceil(maxDist / this.cellSize);
        const width = radius * 2 + 1;

        this._collected = [];
        this._walk = {
            baseCX: Math.floor(focusX / this.cellSize),
            baseCZ: Math.floor(focusZ / this.cellSize),
            focusX, focusZ,
            maxDistSq: maxDist * maxDist,
            radius, width,
            total: width * width,
            i: 0
        };
    }

    respawn() {
        this._lastFocusX = Infinity;
        this._lastFocusZ = Infinity;
        this._walk = null;
        this._collected = [];
        this.meshes.forEach(m => { m.count = 0; m.instanceMatrix.needsUpdate = true; });
    }

    setVisible(visible) {
        this.enabled = visible;
        this.meshes.forEach(m => { m.visible = visible; });
        if (visible) this.respawn();
    }

    setCellSize(newCellSize) {
        if (Math.abs(this.cellSize - newCellSize) < 0.5) return;
        this.cellSize = Math.max(10.0, newCellSize);
        this.respawn();
    }
}
