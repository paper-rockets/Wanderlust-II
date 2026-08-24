import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshToonNodeMaterial } from 'three/webgpu';
import {
    Fn, vec3, vec4, float, uniform, attribute, texture, uv, mix, clamp,
    smoothstep, positionLocal, positionGeometry, modelWorldMatrix, fract, sin, cos, max, pow
} from 'three/tsl';

const PINE_FILES = [
    { key: 'cluster_grove',    path: 'assets/models/trees_med/pine_forest_cluster.glb', fallbackPath: 'assets/models/trees/pine_forest_cluster.glb', targetHeight: 8.5,  isCluster: true,  footprintRadius: 13.0, boundingRadius: 22.0 },
    { key: 'pine_01_med',      path: 'assets/models/trees_med/pine_tree_01.glb',        fallbackPath: 'assets/models/trees/pine_tree_01.glb',        targetHeight: 6.0,  isCluster: false, footprintRadius: 3.5,  boundingRadius: 7.0 },
    { key: 'pine_02_full',     path: 'assets/models/trees_med/pine_tree_02.glb',        fallbackPath: 'assets/models/trees/pine_tree_02.glb',        targetHeight: 6.0,  isCluster: false, footprintRadius: 3.5,  boundingRadius: 7.0 },
    { key: 'pine_03_dense',    path: 'assets/models/trees_med/pine_tree_03.glb',        fallbackPath: 'assets/models/trees/pine_tree_03.glb',        targetHeight: 6.5,  isCluster: false, footprintRadius: 4.0,  boundingRadius: 7.5 },
    { key: 'pine_04_stylized', path: 'assets/models/trees_med/pine_tree_04.glb',        fallbackPath: 'assets/models/trees/pine_tree_04.glb',        targetHeight: 6.0,  isCluster: false, footprintRadius: 3.5,  boundingRadius: 7.0 },
    { key: 'pine_05_tall',     path: 'assets/models/trees_med/pine_tree_05.glb',        fallbackPath: 'assets/models/trees/pine_tree_05.glb',        targetHeight: 9.5,  isCluster: false, footprintRadius: 4.5,  boundingRadius: 10.5 },
    { key: 'pine_06_ancient',  path: 'assets/models/trees_med/pine_tree_06.glb',        fallbackPath: 'assets/models/trees/pine_tree_06.glb',        targetHeight: 11.5, isCluster: false, footprintRadius: 5.5,  boundingRadius: 12.5 },
    { key: 'pine_07_small',    path: 'assets/models/trees_med/pine_tree_07.glb',        fallbackPath: 'assets/models/trees/pine_tree_07.glb',        targetHeight: 3.5,  isCluster: false, footprintRadius: 2.5,  boundingRadius: 4.5 }
];

// 2 LOD bands (0-200m near, 200-450m mid) - Far band culled for Galaxy Tab S6 Lite
const LOD_BANDS = [
    { name: 'near', maxDist: 200, doubleSided: false, sway: true,  alphaTest: 0.40 },
    { name: 'mid',  maxDist: 450, doubleSided: false, sway: false, alphaTest: 0.50 }
];

const DEFAULT_CELL_SIZE = 32.0;  // 32m cell size reduces cell traversal by ~70%
const REBUILD_DISTANCE = 30.0;
const REBUILD_ROT_DIFF = 0.25;
const REBUILD_FRAMES = 8;

function cellHash(cx, cz, slot) {
    let h = Math.imul(cx, 374761393) + Math.imul(cz, 668265263) + Math.imul(slot, 2654435761);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class StylizedPineSystemLowPower {
    constructor(opts) {
        this.scene = opts.scene;
        this.camera = opts.camera || null;
        this.gltfLoader = opts.gltfLoader;
        this.resolveAssetUrl = opts.resolveAssetUrl || ((p) => p);
        this.uTime = opts.uTime;
        this.gradientMap = opts.gradientMap || null;
        this.getWorldHeight = opts.getWorldHeight;
        this.getBiomeAt = opts.getBiomeAt;
        this.getIslandData = opts.getIslandData;
        this.getPathStrength = opts.getPathStrength || (() => 0);
        this.densityScale = opts.densityScale !== undefined ? opts.densityScale : 0.4;

        this.ready = false;
        this.enabled = true;
        this.meshes = [];
        this._byVariantBand = [];
        this._dummy = new THREE.Object3D();
        this._lastFocusX = Infinity;
        this._lastFocusZ = Infinity;
        this._lastCamYaw = 0;
        this._walk = null;
        this._collected = [];
        this.lastCounts = { near: 0, mid: 0 };
        this.leafTexture = null;

        // Frustum Culling
        this._frustum = new THREE.Frustum();
        this._projScreenMatrix = new THREE.Matrix4();
        this._sphere = new THREE.Sphere();

        // Shading Uniforms
        this.uLeafBottom     = uniform(new THREE.Color('#1c3b23'));
        this.uLeafTop        = uniform(new THREE.Color('#5c8338'));
        this.uLeafVarColor   = uniform(new THREE.Color('#1e4430'));
        this.uLeafBrightness = uniform(1.05);
        this.uLeafGradPower  = uniform(1.1);
        this.uLeafVarStrength= uniform(0.5);

        this.uBarkBase       = uniform(new THREE.Color('#2e1b10'));
        this.uBarkTop        = uniform(new THREE.Color('#5c3a21'));
        this.uBarkBrightness = uniform(1.35);

        this.uWindStrength   = uniform(0.8);
        this.uTreeScale      = uniform(1.0);

        // Low-power pool sizes
        this.poolSizes = {
            near: 150,
            mid:  250
        };

        this.minElevation = 1.0;
        this.maxElevation = 140.0;
        this.density = 0.55;
        this.scaleMul = 1.0;
        this.cellSize = DEFAULT_CELL_SIZE;
        this.currentPreset = 'auto';
    }

    async load() {
        const gltfs = await Promise.all(PINE_FILES.map(f =>
            new Promise((res) => {
                const cleanPath = f.path.replace(/^\.?\//, '');
                const cleanFallback = (f.fallbackPath || '').replace(/^\.?\//, '');
                const candidateUrls = [
                    this.resolveAssetUrl(f.path),
                    `./${cleanPath}`,
                    cleanPath,
                    `public/${cleanPath}`,
                    `./public/${cleanPath}`,
                    f.fallbackPath ? this.resolveAssetUrl(f.fallbackPath) : null,
                    cleanFallback ? `./${cleanFallback}` : null,
                    cleanFallback ? cleanFallback : null
                ].filter(Boolean);

                const tryLoad = (idx) => {
                    if (idx >= candidateUrls.length) {
                        return res(null);
                    }
                    this.gltfLoader.load(
                        candidateUrls[idx],
                        (gltf) => res(gltf),
                        undefined,
                        () => tryLoad(idx + 1)
                    );
                };
                tryLoad(0);
            })
        ));

        // Extract shared leaf texture
        gltfs.forEach(gltf => {
            if (gltf && !this.leafTexture) {
                gltf.scene.traverse(c => {
                    if (c.isMesh && c.material && !this.leafTexture) {
                        const mats = Array.isArray(c.material) ? c.material : [c.material];
                        mats.forEach(m => {
                            if (!m || !m.map || this.leafTexture) return;
                            const matName = (m.name || '').toLowerCase();
                            const meshName = (c.name || '').toLowerCase();
                            const isBark = matName.includes('trunk') || matName.includes('bark') ||
                                           meshName.includes('trunk') || meshName.includes('bark');
                            if (!isBark) {
                                this.leafTexture = m.map;
                            }
                        });
                    }
                });
            }
        });

        gltfs.forEach((gltf, vi) => {
            if (!gltf) return;
            const geo = this._extractMergedGeometry(gltf, PINE_FILES[vi].targetHeight);
            if (!geo) return;

            const row = [];
            LOD_BANDS.forEach((band) => {
                const mat = this._buildMaterial(band);
                const count = this.poolSizes[band.name] || 150;

                const instGeo = geo.clone();
                const seasonArr = new Float32Array(count);
                instGeo.setAttribute('aSeason', new THREE.InstancedBufferAttribute(seasonArr, 1));

                const mesh = new THREE.InstancedMesh(instGeo, mat, count);
                mesh.name = `${PINE_FILES[vi].key}_${band.name}`;
                mesh.castShadow = false;
                mesh.receiveShadow = false;
                mesh.count = 0;
                mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), band.maxDist + 40);
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

                const m = Array.isArray(c.material) ? c.material[0] : c.material;
                const matName = (m && m.name) ? m.name.toLowerCase() : '';
                const meshName = (c.name || '').toLowerCase();
                const isBark = meshName.includes('trunk') || meshName.includes('bark') ||
                               matName.includes('trunk') || matName.includes('bark') ? 1.0 : 0.0;

                const nVerts = g.attributes.position.count;
                const barkArr = new Float32Array(nVerts).fill(isBark);
                g.setAttribute('aIsBark', new THREE.BufferAttribute(barkArr, 1));

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
        merged.translate(0, -bb.min.y, 0);
        merged.scale(s, s, s);

        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        return merged;
    }

    _buildMaterial(band) {
        const mat = new MeshToonNodeMaterial({
            gradientMap: this.gradientMap || undefined,
            side: THREE.FrontSide,
            transparent: false,
            alphaTest: band.alphaTest,
            depthWrite: true,
            dithering: false
        });

        const aIsBark = attribute('aIsBark', 'float');
        const aSeason = attribute('aSeason', 'float');

        if (this.leafTexture) {
            const texMap = texture(this.leafTexture, uv());
            const finalAlpha = mix(texMap.a, float(1.0), aIsBark);
            mat.opacityNode = finalAlpha;
            mat.alphaNode = finalAlpha;
        }

        mat.colorNode = Fn(() => {
            const localY = clamp(positionLocal.y.div(8.5), 0.0, 1.0);

            const spBottom = this.uLeafBottom;
            const spTop    = this.uLeafTop;
            const auBottom = vec3(1.00, 0.69, 0.21);
            const auTop    = vec3(1.00, 0.10, 0.06);
            const wiBottom = vec3(0.13, 0.23, 0.24);
            const wiTop    = vec3(0.92, 0.96, 0.98);

            const isAutumn = smoothstep(float(0.4), float(0.6), aSeason);
            const isWinter = smoothstep(float(1.4), float(1.6), aSeason);

            const nonWinterBottom = mix(spBottom, auBottom, isAutumn);
            const nonWinterTop    = mix(spTop, auTop, isAutumn);

            const leafColBottom = mix(nonWinterBottom, wiBottom, isWinter);
            const leafColTop    = mix(nonWinterTop, wiTop, isWinter);

            const gradT = pow(localY, this.uLeafGradPower);
            const leafBase = mix(leafColBottom, leafColTop, gradT);

            const barkCol = mix(this.uBarkBase, this.uBarkTop, smoothstep(float(0.0), float(0.6), localY)).mul(this.uBarkBrightness);
            return mix(leafBase, barkCol, aIsBark);
        })();

        if (band.sway) {
            mat.positionNode = Fn(() => {
                const p = positionLocal.toVar();
                const origin = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0));
                const w1 = sin(this.uTime.mul(1.4).add(origin.x.mul(0.025)).add(origin.z.mul(0.02))).mul(0.05);
                const heightFactor = max(0.0, positionGeometry.y).div(6.0);
                const totalSway = w1.mul(heightFactor).mul(this.uWindStrength);
                p.x.addAssign(totalSway);
                return p;
            })();
        }

        return mat;
    }

    _isValidSite(cx, cz, footprintRadius = 13.0, isCluster = true) {
        const biome = this.getBiomeAt(cx, cz);
        if (!biome || !biome.name) return null;
        const bName = biome.name.toLowerCase();

        if (bName.includes('crystal') || bName.includes('jungle') || bName.includes('desert') || bName.includes('ocean')) {
            return null;
        }

        const centerH = this.getWorldHeight(cx, cz);
        if (centerH < this.minElevation || centerH > this.maxElevation) return null;

        const island = this.getIslandData(cx, cz);
        if (!island || island.mask < 0.04) return null;
        if (this.getPathStrength(cx, cz) >= 0.35) return null;

        const isMisty = bName.includes('misty') || bName.includes('mountain') || bName.includes('north');
        return { h: centerH, isMisty };
    }

    _visitCell(cx, cz, focusX, focusZ, maxDistSq, out, frustum) {
        const ddx = (cx + 0.5) * this.cellSize - focusX;
        const ddz = (cz + 0.5) * this.cellSize - focusZ;
        const distSq = ddx * ddx + ddz * ddz;
        if (distSq > maxDistSq) return;

        const d = this.density;
        const fill = cellHash(cx, cz, 0);

        if (fill < 0.75 * d) {
            const jx = (cellHash(cx, cz, 1) - 0.5) * 0.5;
            const jz = (cellHash(cx, cz, 2) - 0.5) * 0.5;
            const x = (cx + 0.5 + jx) * this.cellSize;
            const z = (cz + 0.5 + jz) * this.cellSize;

            const site = this._isValidSite(x, z, PINE_FILES[0].footprintRadius, true);
            if (site !== null) {
                this._sphere.center.set(x, site.h, z);
                this._sphere.radius = PINE_FILES[0].boundingRadius + 15.0;

                if (!frustum || frustum.intersectsSphere(this._sphere)) {
                    let season = site.isMisty ? 2.0 : ((cellHash(cx, cz, 7) < 0.10) ? 1.0 : 0.0);
                    const r = cellHash(cx, cz, 3);
                    out.push({
                        x, y: site.h, z,
                        variant: 0,
                        rot: r * Math.PI * 2.0,
                        scale: (0.90 + cellHash(cx, cz, 4) * 0.25) * this.scaleMul,
                        season,
                        dist: Math.sqrt(distSq)
                    });
                }
            }
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

            if (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.aSeason) {
                mesh.geometry.attributes.aSeason.setX(idx, c.season);
            }

            perMeshCount[c.variant][band] = idx + 1;
        }

        const counts = { near: 0, mid: 0 };
        this._byVariantBand.forEach((row, vi) => {
            row.forEach((mesh, bi) => {
                mesh.count = perMeshCount[vi][bi];
                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.aSeason) {
                    mesh.geometry.attributes.aSeason.needsUpdate = true;
                }
                mesh.boundingSphere.center.set(focusX, 0, focusZ);
                mesh.boundingSphere.radius = LOD_BANDS[bi].maxDist + 40;
                mesh.frustumCulled = true;
                counts[LOD_BANDS[bi].name] += mesh.count;
            });
        });
        this.lastCounts = counts;
    }

    update(focusX, focusZ, activeCamera = null) {
        if (!this.ready || !this.enabled) return;

        const cam = activeCamera || this.camera;
        let frustum = null;
        if (cam) {
            this._projScreenMatrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
            this._frustum.setFromProjectionMatrix(this._projScreenMatrix);
            frustum = this._frustum;
        }

        if (this._walk) {
            const w = this._walk;
            const perFrame = Math.ceil(w.total / REBUILD_FRAMES);
            const end = Math.min(w.total, w.i + perFrame);

            for (let i = w.i; i < end; i++) {
                const dx = (i % w.width) - w.radius;
                const dz = ((i / w.width) | 0) - w.radius;
                this._visitCell(w.baseCX + dx, w.baseCZ + dz, w.focusX, w.focusZ, w.maxDistSq, this._collected, frustum);
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
        const distMovedSq = dx * dx + dz * dz;

        let camRotDiff = 0;
        if (cam) {
            const curYaw = cam.rotation ? cam.rotation.y : 0;
            camRotDiff = Math.abs(curYaw - this._lastCamYaw);
        }

        if (distMovedSq < REBUILD_DISTANCE * REBUILD_DISTANCE && camRotDiff < REBUILD_ROT_DIFF) return;

        this._lastFocusX = focusX;
        this._lastFocusZ = focusZ;
        if (cam && cam.rotation) this._lastCamYaw = cam.rotation.y;

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

    setVisible(visible) {
        this.enabled = visible;
        this.meshes.forEach(m => { m.visible = visible; });
    }
}
