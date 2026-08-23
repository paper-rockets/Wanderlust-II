// Stylized Pine Biome Tree System
// =========================================================================================
// Procedural, instanced, LOD-managed placement of 3D Stylized Pine Clusters & Trees.
// Features:
// - Natural organic forest groves via multi-tree cluster instancing + individual accent pines
// - Multi-point footprint validation: strict 10-20m cliff drop exclusion & flat terrain anchoring
// - Biome exclusion rules: No pines in Crystal Land, Lush Jungle, Desert Dunes, Open Ocean
// - Automatic seasonal distribution: 100% White Snowy Pines in Misty Mountains, 90% Spring / 10% Autumn elsewhere
// - Active camera frustum & view cone culling: zero wasted draws for trees behind or outside view
// - 3 LOD distance bands (near 0-220m, mid 220-650m, far 650-1500m) with TSL WebGPU shaders

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshToonNodeMaterial } from 'three/webgpu';
import {
    Fn, vec3, vec4, float, uniform, attribute, texture, uv, mix, clamp,
    smoothstep, positionLocal, positionGeometry, modelWorldMatrix, fract, sin, cos, max, pow, abs
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

const LOD_BANDS = [
    { name: 'near', maxDist: 220,  doubleSided: true,  sway: true,  alphaTest: 0.35 },
    { name: 'mid',  maxDist: 650,  doubleSided: false, sway: true,  alphaTest: 0.50 },
    { name: 'far',  maxDist: 1500, doubleSided: false, sway: false, alphaTest: 0.65 }
];

const DEFAULT_CELL_SIZE = 38.0;  // world units per cell
const REBUILD_DISTANCE = 25.0;   // rebuild field when camera moves this far
const REBUILD_ROT_DIFF = 0.20;   // rebuild when camera rotates by ~11.5 degrees
const REBUILD_FRAMES = 12;       // sliced cell walk frames

function cellHash(cx, cz, slot) {
    let h = Math.imul(cx, 374761393) + Math.imul(cz, 668265263) + Math.imul(slot, 2654435761);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class StylizedPineSystem {
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
        this.densityScale = opts.densityScale !== undefined ? opts.densityScale : 1.0;

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
        this.lastCounts = { near: 0, mid: 0, far: 0 };
        this.leafTexture = null;

        // Frustum Culling
        this._frustum = new THREE.Frustum();
        this._projScreenMatrix = new THREE.Matrix4();
        this._sphere = new THREE.Sphere();

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

        // Pool sizes per band (clusters pack ~9 trees each)
        const d = this.densityScale;
        this.poolSizes = {
            near: Math.max(64, Math.round(1400 * d)),
            mid:  Math.max(128, Math.round(3200 * d)),
            far:  Math.max(192, Math.round(5200 * d))
        };

        // Placement settings
        this.minElevation = 2.0;
        this.maxElevation = 120.0;
        this.maxSlope = 0.45;
        this.density = 1.0;
        this.scaleMul = 1.0;
        this.cellSize = DEFAULT_CELL_SIZE;
        this.currentPreset = 'auto'; // 'auto' (90% Spring, 10% Autumn, Misty Winter), 'spring', 'autumn', 'winter'
    }

    setPreset(name) {
        this.currentPreset = name;
        if (name === 'autumn') {
            this.uLeafBottom.value.set('#ffaf36');
            this.uLeafTop.value.set('#ff1910');
            this.uLeafVarColor.value.set('#8f2409');
            this.uLeafBrightness.value = 1.1;
            this.uBarkBase.value.set('#2e1b10');
            this.uBarkTop.value.set('#5c3a21');
        } else if (name === 'winter') {
            this.uLeafBottom.value.set('#203a3d');
            this.uLeafTop.value.set('#eaf5fa');
            this.uLeafVarColor.value.set('#8bb6c9');
            this.uLeafBrightness.value = 1.15;
            this.uBarkBase.value.set('#222426');
            this.uBarkTop.value.set('#484c50');
        } else if (name === 'spring') {
            this.uLeafBottom.value.set('#1c3b23');
            this.uLeafTop.value.set('#5c8338');
            this.uLeafVarColor.value.set('#1e4430');
            this.uLeafBrightness.value = 1.05;
            this.uBarkBase.value.set('#2e1b10');
            this.uBarkTop.value.set('#5c3a21');
        }
        this.respawn();
    }

    async load() {
        const gltfs = await Promise.all(PINE_FILES.map(f =>
            new Promise((res) => {
                const primaryUrl = this.resolveAssetUrl(f.path);
                this.gltfLoader.load(primaryUrl, res, undefined, () => {
                    // Fallback path
                    const fallbackUrl = this.resolveAssetUrl(f.fallbackPath);
                    this.gltfLoader.load(fallbackUrl, res, undefined, (err) => {
                        console.error('Failed to load pine model:', f.key, err);
                        res(null);
                    });
                });
            })
        ));

        // Extract shared leaf texture from loaded gltf
        gltfs.forEach(gltf => {
            if (gltf && !this.leafTexture) {
                gltf.scene.traverse(c => {
                    if (c.isMesh && c.material && c.material.map && !this.leafTexture) {
                        this.leafTexture = c.material.map;
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
                const pool = this.poolSizes[band.name];
                // Allocate more pool to cluster (variant 0) than individual accent trees
                const count = PINE_FILES[vi].isCluster
                    ? Math.max(16, Math.round(pool * 0.45))
                    : Math.max(8, Math.round((pool * 0.55) / (PINE_FILES.length - 1)));

                const instGeo = geo.clone();
                // Add instanced attribute for per-tree seasonal coloring (0 = Spring, 1 = Autumn, 2 = Winter)
                const seasonArr = new Float32Array(count);
                instGeo.setAttribute('aSeason', new THREE.InstancedBufferAttribute(seasonArr, 1));

                const mesh = new THREE.InstancedMesh(instGeo, mat, count);
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
        const aSeason = attribute('aSeason', 'float'); // 0.0 = Spring, 1.0 = Autumn, 2.0 = Winter

        if (this.leafTexture) {
            const texMap = texture(this.leafTexture, uv());
            mat.opacityNode = mix(texMap.a, float(1.0), aIsBark);
        }

        mat.colorNode = Fn(() => {
            const localY = clamp(positionLocal.y.div(6.0), 0.0, 1.0);

            // Per-instance hash for natural color variation
            const origin = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0));
            const instHash = fract(sin(origin.x.mul(12.9898).add(origin.z.mul(78.233))).mul(43758.5453));

            // Spring Palette
            const spBottom = vec3(0.11, 0.23, 0.14); // #1c3b23
            const spTop    = vec3(0.36, 0.51, 0.22); // #5c8338
            const spVar    = vec3(0.12, 0.27, 0.19); // #1e4430

            // Autumn Palette
            const auBottom = vec3(1.00, 0.69, 0.21); // #ffaf36
            const auTop    = vec3(1.00, 0.10, 0.06); // #ff1910
            const auVar    = vec3(0.56, 0.14, 0.04); // #8f2409

            // Winter Palette (Misty Mountains Snowy White Pines)
            const wiBottom = vec3(0.13, 0.23, 0.24); // #203a3d
            const wiTop    = vec3(0.92, 0.96, 0.98); // #eaf5fa (Snow)
            const wiVar    = vec3(0.55, 0.71, 0.79); // #8bb6c9 (Frost)

            // Select season colors dynamically per instance
            const isAutumn = smoothstep(float(0.4), float(0.6), aSeason);
            const isWinter = smoothstep(float(1.4), float(1.6), aSeason);

            const nonWinterBottom = mix(spBottom, auBottom, isAutumn);
            const nonWinterTop    = mix(spTop, auTop, isAutumn);
            const nonWinterVar    = mix(spVar, auVar, isAutumn);

            const leafColBottom = mix(nonWinterBottom, wiBottom, isWinter);
            const leafColTop    = mix(nonWinterTop, wiTop, isWinter);
            const leafColVar    = mix(nonWinterVar, wiVar, isWinter);

            // Foliage Gradient
            const gradT = pow(localY, this.uLeafGradPower);
            const leafBase = mix(leafColBottom, leafColTop, gradT);

            // Subtle foliage tonal variation
            const varNoise = instHash.sub(0.5).mul(this.uLeafVarStrength);
            const variedLeaf = mix(leafBase, leafColVar, varNoise.mul(0.5)).mul(this.uLeafBrightness);

            // Bark Color (Warm timber for Spring/Autumn, cool slate for Winter)
            const warmBarkBase = vec3(0.18, 0.11, 0.06); // #2e1b10
            const warmBarkTop  = vec3(0.36, 0.23, 0.13); // #5c3a21
            const coolBarkBase = vec3(0.13, 0.14, 0.15); // #222426
            const coolBarkTop  = vec3(0.28, 0.30, 0.31); // #484c50

            const curBarkBase = mix(warmBarkBase, coolBarkBase, isWinter);
            const curBarkTop  = mix(warmBarkTop, coolBarkTop, isWinter);
            const barkCol = mix(curBarkBase, curBarkTop, smoothstep(float(0.0), float(0.6), localY)).mul(this.uBarkBrightness);

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
                const mask = heightFactor.mul(heightFactor);

                const totalSway = w1.add(w2).add(flutter).mul(mask).mul(this.uWindStrength);

                p.x.addAssign(totalSway);
                p.z.addAssign(totalSway.mul(0.7));
                p.y.subAssign(abs(totalSway).mul(0.08));

                return p;
            })();
        }

        return mat;
    }

    _isValidSite(cx, cz, footprintRadius = 13.0, isCluster = true) {
        const biome = this.getBiomeAt(cx, cz);
        if (!biome || !biome.name) return null;

        const bName = biome.name.toLowerCase();

        // 1. Strict Excluded Biomes Check
        if (bName.includes('crystal') ||
            bName.includes('jungle') ||
            bName.includes('desert') ||
            bName.includes('ocean')) {
            return null;
        }

        // 2. Allowed Biomes Check
        const isAllowed = biome.treesOk !== false ||
                          bName.includes('archipelago') ||
                          bName.includes('ghibli') ||
                          bName.includes('misty') ||
                          bName.includes('mountain') ||
                          bName.includes('magical') ||
                          bName.includes('plains') ||
                          bName.includes('highland') ||
                          bName.includes('north');
        if (!isAllowed) return null;

        // 3. Center height & elevation bounds
        const centerH = this.getWorldHeight(cx, cz);
        if (centerH < this.minElevation || centerH > this.maxElevation) return null;

        // 4. Center island & path checks
        const island = this.getIslandData(cx, cz);
        if (!island || island.mask < 0.16) return null;
        if (this.getPathStrength(cx, cz) >= 0.18) return null;

        // 5. Multi-Point Perimeter Sampling (Flatter terrain check: max slope / cliff delta within footprint)
        const cliffMaxDelta = isCluster ? 4.8 : 3.2;
        const angles = [0, 45, 90, 135, 180, 225, 270, 315];
        for (let i = 0; i < angles.length; i++) {
            const rad = angles[i] * 0.0174532925;
            const sx = cx + Math.cos(rad) * footprintRadius;
            const sz = cz + Math.sin(rad) * footprintRadius;

            const sh = this.getWorldHeight(sx, sz);
            const deltaH = Math.abs(sh - centerH);
            if (deltaH > cliffMaxDelta) return null;

            const sIsland = this.getIslandData(sx, sz);
            if (!sIsland || sIsland.mask < 0.14) return null;
            if (this.getPathStrength(sx, sz) >= 0.20) return null;
        }

        // 6. Extended 18m Cliff Drop Exclusion (ensure not on the immediate verge of a cliff)
        if (isCluster) {
            const outerRadius = 18.0;
            const outerAngles = [0, 90, 180, 270];
            for (let i = 0; i < outerAngles.length; i++) {
                const rad = outerAngles[i] * 0.0174532925;
                const ox = cx + Math.cos(rad) * outerRadius;
                const oz = cz + Math.sin(rad) * outerRadius;
                const oh = this.getWorldHeight(ox, oz);
                if (Math.abs(oh - centerH) > 8.5) return null;
            }
        }

        const isMisty = bName.includes('misty') || bName.includes('mountain') || bName.includes('north');
        return {
            h: centerH,
            isMisty: isMisty
        };
    }

    _visitCell(cx, cz, focusX, focusZ, maxDistSq, out, frustum) {
        const ddx = (cx + 0.5) * this.cellSize - focusX;
        const ddz = (cz + 0.5) * this.cellSize - focusZ;
        const distSq = ddx * ddx + ddz * ddz;
        if (distSq > maxDistSq) return;

        const d = this.density;
        const fill = cellHash(cx, cz, 0);

        // 1. Check Primary Forest Grove Cluster
        if (fill < 0.62 * d) {
            const jx = (cellHash(cx, cz, 1) - 0.5) * 0.5;
            const jz = (cellHash(cx, cz, 2) - 0.5) * 0.5;
            const x = (cx + 0.5 + jx) * this.cellSize;
            const z = (cz + 0.5 + jz) * this.cellSize;

            const site = this._isValidSite(x, z, PINE_FILES[0].footprintRadius, true);
            if (site !== null) {
                // Camera Frustum & View Cone Test
                this._sphere.center.set(x, site.h, z);
                this._sphere.radius = PINE_FILES[0].boundingRadius + 18.0;

                if (!frustum || frustum.intersectsSphere(this._sphere)) {
                    let season = 0.0;
                    if (this.currentPreset === 'auto') {
                        if (site.isMisty) {
                            season = 2.0; // 100% White Pines in Misty Mountains
                        } else {
                            const sHash = cellHash(cx, cz, 7);
                            season = (sHash < 0.10) ? 1.0 : 0.0; // 90% Spring, 10% Autumn
                        }
                    } else if (this.currentPreset === 'autumn') {
                        season = 1.0;
                    } else if (this.currentPreset === 'winter') {
                        season = 2.0;
                    }

                    const r = cellHash(cx, cz, 3);
                    out.push({
                        x, y: site.h, z,
                        variant: 0, // cluster_grove
                        rot: r * Math.PI * 2.0,
                        scale: (0.90 + cellHash(cx, cz, 4) * 0.25) * this.scaleMul,
                        season,
                        dist: Math.sqrt(distSq)
                    });
                }
            }
        }

        // 2. Individual Tree Accent Scatter (adds natural organic variety around clusters and on hilltops)
        const accentFill = cellHash(cx, cz, 10);
        if (accentFill < 0.45 * d) {
            const jx2 = cellHash(cx, cz, 11);
            const jz2 = cellHash(cx, cz, 12);
            const x2 = (cx + jx2) * this.cellSize;
            const z2 = (cz + jz2) * this.cellSize;

            // Pick an individual tree variant (indices 1 to 7)
            const vIdx = 1 + Math.floor(cellHash(cx, cz, 13) * (PINE_FILES.length - 1));
            const cfg = PINE_FILES[Math.min(PINE_FILES.length - 1, vIdx)];

            const site2 = this._isValidSite(x2, z2, cfg.footprintRadius, false);
            if (site2 !== null) {
                this._sphere.center.set(x2, site2.h, z2);
                this._sphere.radius = cfg.boundingRadius + 14.0;

                if (!frustum || frustum.intersectsSphere(this._sphere)) {
                    let season2 = 0.0;
                    if (this.currentPreset === 'auto') {
                        if (site2.isMisty) {
                            season2 = 2.0;
                        } else {
                            const sHash2 = cellHash(cx, cz, 14);
                            season2 = (sHash2 < 0.10) ? 1.0 : 0.0;
                        }
                    } else if (this.currentPreset === 'autumn') {
                        season2 = 1.0;
                    } else if (this.currentPreset === 'winter') {
                        season2 = 2.0;
                    }

                    const r2 = cellHash(cx, cz, 15);
                    out.push({
                        x: x2, y: site2.h, z: z2,
                        variant: vIdx,
                        rot: r2 * Math.PI * 2.0,
                        scale: (0.85 + cellHash(cx, cz, 16) * 0.35) * this.scaleMul,
                        season: season2,
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

            // Update per-instance season attribute
            if (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.aSeason) {
                mesh.geometry.attributes.aSeason.setX(idx, c.season);
            }

            perMeshCount[c.variant][band] = idx + 1;
        }

        const counts = { near: 0, mid: 0, far: 0 };
        this._byVariantBand.forEach((row, vi) => {
            row.forEach((mesh, bi) => {
                mesh.count = perMeshCount[vi][bi];
                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.aSeason) {
                    mesh.geometry.attributes.aSeason.needsUpdate = true;
                }
                mesh.boundingSphere.center.set(focusX, 0, focusZ);
                mesh.boundingSphere.radius = LOD_BANDS[bi].maxDist + 60;
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

    respawn() {
        this._lastFocusX = Infinity;
        this._lastFocusZ = Infinity;
        this._walk = null;
        this._collected = [];
        this.meshes.forEach(m => {
            m.count = 0;
            m.instanceMatrix.needsUpdate = true;
            if (m.geometry && m.geometry.attributes && m.geometry.attributes.aSeason) {
                m.geometry.attributes.aSeason.needsUpdate = true;
            }
        });
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
