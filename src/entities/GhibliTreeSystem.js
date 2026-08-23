// Unified Procedural Tree & Foliage System
// =========================================================================================
// Multi-species, instanced, LOD-managed placement supporting:
// - Tier 1 Desktop (Default), Tier 2 Mobile, Tier 3 Flight Ultra
// - Full Tree Catalog: Pines, Pines Unreal Pack, Broadleaf/Aspen, Oaks, Ghibli Atlas Cards (001-010), Palms & Custom Slot
// - Independent per-species toggles & placement parameters (Density, Elevation Min/Max, Slope, Scale)
// - Real-time hot-reload / respawn in the flight world

import * as THREE from 'three';
import { MeshToonNodeMaterial } from 'three/webgpu';
import {
    Fn, vec3, vec4, float, uniform, attribute, texture, uv, mix, clamp,
    smoothstep, positionLocal, positionGeometry, modelWorldMatrix, fract, sin, cos, max
} from 'three/tsl';

// Available Quality Tiers
export const QUALITY_TIERS = {
    DESKTOP: 'Tier1_Desktop',
    MOBILE: 'Tier2_Mobile',
    FLIGHT_ULTRA: 'Tier3_Flight_Ultra'
};

// Master Tree Species Catalog
export const DEFAULT_SPECIES_CATALOG = [
    // --- 1. TIER OPTIMIZED PINES (Default Active) ---
    {
        key: 'Pine_Large_1',
        name: 'Pine Large 1',
        category: 'Pines',
        type: 'tier',
        enabled: true,
        height: 22.0,
        density: 1.0,
        minElev: 10.0,
        maxElev: 110.0,
        maxSlope: 0.85,
        scale: 1.0
    },
    {
        key: 'Pine_Large_2',
        name: 'Pine Large 2',
        category: 'Pines',
        type: 'tier',
        enabled: true,
        height: 17.0,
        density: 1.0,
        minElev: 8.0,
        maxElev: 95.0,
        maxSlope: 0.80,
        scale: 1.0
    },
    {
        key: 'Pine_Medium',
        name: 'Pine Medium',
        category: 'Pines',
        type: 'tier',
        enabled: true,
        height: 15.0,
        density: 1.0,
        minElev: 6.8,
        maxElev: 85.0,
        maxSlope: 0.75,
        scale: 1.0
    },

    // --- 2. PINES PACK (Unreal Extract) ---
    {
        key: 'Pine_Tall_01',
        name: 'Pine Tall 01',
        category: 'Pines Pack',
        type: 'pack',
        packFolder: 'assets/Trees/Pines_Pack/Pine_Tall_01',
        enabled: true,
        height: 24.0,
        density: 0.9,
        minElev: 10.0,
        maxElev: 115.0,
        maxSlope: 0.85,
        scale: 1.0
    },
    {
        key: 'Pine_Tall_02',
        name: 'Pine Tall 02',
        category: 'Pines Pack',
        type: 'pack',
        packFolder: 'assets/Trees/Pines_Pack/Pine_Tall_02',
        enabled: false,
        height: 22.0,
        density: 0.9,
        minElev: 10.0,
        maxElev: 110.0,
        maxSlope: 0.85,
        scale: 1.0
    },
    {
        key: 'Pine_Mid_01',
        name: 'Pine Mid 01',
        category: 'Pines Pack',
        type: 'pack',
        packFolder: 'assets/Trees/Pines_Pack/Pine_Mid_01',
        enabled: true,
        height: 16.0,
        density: 0.9,
        minElev: 8.0,
        maxElev: 90.0,
        maxSlope: 0.80,
        scale: 1.0
    },
    {
        key: 'Pine_Small_01',
        name: 'Pine Small 01',
        category: 'Pines Pack',
        type: 'pack',
        packFolder: 'assets/Trees/Pines_Pack/Pine_Small_01',
        enabled: false,
        height: 10.0,
        density: 0.8,
        minElev: 6.8,
        maxElev: 75.0,
        maxSlope: 0.70,
        scale: 1.0
    },
    {
        key: 'Pine_Dead_01',
        name: 'Pine Dead 01',
        category: 'Pines Pack',
        type: 'pack',
        packFolder: 'assets/Trees/Pines_Pack/Pine_Dead_01',
        enabled: false,
        height: 15.0,
        density: 0.3,
        minElev: 15.0,
        maxElev: 120.0,
        maxSlope: 0.90,
        scale: 1.0
    },

    // --- 3. BROADLEAF & ASPEN ---
    {
        key: 'Aspen_Large_1',
        name: 'Aspen Large 1',
        category: 'Broadleaf',
        type: 'tier',
        enabled: true,
        height: 20.0,
        density: 0.8,
        minElev: 6.5,
        maxElev: 52.0,
        maxSlope: 0.55,
        scale: 1.0
    },
    {
        key: 'Aspen_Large_2',
        name: 'Aspen Large 2',
        category: 'Broadleaf',
        type: 'tier',
        enabled: false,
        height: 20.0,
        density: 0.8,
        minElev: 6.5,
        maxElev: 52.0,
        maxSlope: 0.55,
        scale: 1.0
    },
    {
        key: 'Ash_Large',
        name: 'Ash Large',
        category: 'Broadleaf',
        type: 'tier',
        enabled: true,
        height: 18.0,
        density: 0.8,
        minElev: 6.5,
        maxElev: 48.0,
        maxSlope: 0.50,
        scale: 1.0
    },
    {
        key: 'Ash_Medium',
        name: 'Ash Medium',
        category: 'Broadleaf',
        type: 'tier',
        enabled: false,
        height: 14.0,
        density: 0.8,
        minElev: 6.5,
        maxElev: 45.0,
        maxSlope: 0.50,
        scale: 1.0
    },

    // --- 4. OAKS ---
    {
        key: 'Oak_Large_1',
        name: 'Oak Large 1',
        category: 'Oaks',
        type: 'tier',
        enabled: true,
        height: 19.0,
        density: 0.7,
        minElev: 5.5,
        maxElev: 42.0,
        maxSlope: 0.45,
        scale: 1.0
    },
    {
        key: 'Oak_Large_2',
        name: 'Oak Large 2',
        category: 'Oaks',
        type: 'tier',
        enabled: false,
        height: 19.0,
        density: 0.7,
        minElev: 5.5,
        maxElev: 42.0,
        maxSlope: 0.45,
        scale: 1.0
    },

    // --- 5. GHIBLI ATLAS BACKGROUND CARDS ---
    {
        key: 'Ghibli_Card_001',
        name: 'Ghibli Atlas 001',
        category: 'Ghibli Cards',
        type: 'direct',
        path: 'assets/Trees/Ghibli/Background_Tree_Atlas_001_alt.glb',
        enabled: false,
        height: 17.0,
        density: 0.6,
        minElev: 6.8,
        maxElev: 55.0,
        maxSlope: 0.55,
        scale: 1.0
    },
    {
        key: 'Ghibli_Card_002',
        name: 'Ghibli Atlas 002',
        category: 'Ghibli Cards',
        type: 'direct',
        path: 'assets/Trees/Ghibli/Background_Tree_Atlas_002_alt.glb',
        enabled: false,
        height: 12.0,
        density: 0.6,
        minElev: 6.8,
        maxElev: 55.0,
        maxSlope: 0.55,
        scale: 1.0
    },
    {
        key: 'Ghibli_Card_003',
        name: 'Ghibli Atlas 003',
        category: 'Ghibli Cards',
        type: 'direct',
        path: 'assets/Trees/Ghibli/Background_Tree_Atlas_003_alt.glb',
        enabled: false,
        height: 13.5,
        density: 0.6,
        minElev: 6.8,
        maxElev: 55.0,
        maxSlope: 0.55,
        scale: 1.0
    },
    {
        key: 'Ghibli_Card_004',
        name: 'Ghibli Atlas 004',
        category: 'Ghibli Cards',
        type: 'direct',
        path: 'assets/Trees/Ghibli/Background_Tree_Atlas_004_alt.glb',
        enabled: false,
        height: 14.0,
        density: 0.6,
        minElev: 6.8,
        maxElev: 55.0,
        maxSlope: 0.55,
        scale: 1.0
    },
    {
        key: 'Ghibli_Card_005',
        name: 'Ghibli Atlas 005',
        category: 'Ghibli Cards',
        type: 'direct',
        path: 'assets/Trees/Ghibli/Background_Tree_Atlas_005_alt.glb',
        enabled: false,
        height: 15.0,
        density: 0.6,
        minElev: 6.8,
        maxElev: 55.0,
        maxSlope: 0.55,
        scale: 1.0
    },
    {
        key: 'Ghibli_Card_006',
        name: 'Ghibli Atlas 006',
        category: 'Ghibli Cards',
        type: 'direct',
        path: 'assets/Trees/Ghibli/Background_Tree_Atlas_006_alt.glb',
        enabled: false,
        height: 16.0,
        density: 0.6,
        minElev: 6.8,
        maxElev: 55.0,
        maxSlope: 0.55,
        scale: 1.0
    },

    // --- 6. ADDITIONAL STYLIZED WORKING MODELS ---
    {
        key: 'Pine_Ghibli_02',
        name: 'Pine Ghibli 02',
        category: 'Additional Pines',
        type: 'direct',
        path: 'assets/Trees/Working Folder/Pine_Ghibli_02.glb',
        enabled: false,
        height: 16.0,
        density: 0.8,
        minElev: 8.0,
        maxElev: 80.0,
        maxSlope: 0.70,
        scale: 1.0
    },
    {
        key: 'Pine_Stylized_03',
        name: 'Pine Stylized 03',
        category: 'Additional Pines',
        type: 'direct',
        path: 'assets/Trees/Working Folder/Pine_Stylized_03_Tree.glb',
        enabled: false,
        height: 15.0,
        density: 0.8,
        minElev: 8.0,
        maxElev: 80.0,
        maxSlope: 0.70,
        scale: 1.0
    },
    {
        key: 'Pine_Model_A_2',
        name: 'Pine Model A2',
        category: 'Additional Pines',
        type: 'direct',
        path: 'assets/Trees/Working Folder/Pine model  A (2).glb',
        enabled: false,
        height: 16.0,
        density: 0.8,
        minElev: 8.0,
        maxElev: 80.0,
        maxSlope: 0.70,
        scale: 1.0
    },

    // --- 7. PALMS & EXOTICS ---
    {
        key: 'Palm_Tropical_01',
        name: 'Palm Tropical 01',
        category: 'Palms & Exotics',
        type: 'direct',
        path: 'assets/Trees/Working Folder/Palm_Tropical_01.glb',
        enabled: false,
        height: 12.0,
        density: 0.5,
        minElev: 2.0,
        maxElev: 18.0,
        maxSlope: 0.35,
        scale: 1.0
    },
    {
        key: 'Realistic_Baobab',
        name: 'Baobab Tree',
        category: 'Palms & Exotics',
        type: 'direct',
        path: 'assets/Trees/01/realistic_baobab_tree.glb',
        enabled: false,
        height: 20.0,
        density: 0.3,
        minElev: 4.0,
        maxElev: 28.0,
        maxSlope: 0.30,
        scale: 1.0
    },

    // --- 8. CUSTOM USER MODEL SLOT ---
    {
        key: 'Custom_Tree_Slot',
        name: 'Custom Tree Slot',
        category: 'Custom Slot',
        type: 'custom',
        customPath: 'assets/Trees/Working Folder/Pine model  A (4).glb',
        enabled: false,
        height: 16.0,
        density: 1.0,
        minElev: 6.0,
        maxElev: 90.0,
        maxSlope: 0.75,
        scale: 1.0
    }
];

// Distance LOD bands
const LOD_BANDS = [
    { name: 'near', maxDist: 140,  doubleSided: true,  sway: true,  alphaTest: 0.35, lodIdx: 0 },
    { name: 'mid',  maxDist: 420,  doubleSided: false, sway: true,  alphaTest: 0.50, lodIdx: 1 },
    { name: 'far',  maxDist: 1100, doubleSided: false, sway: false, alphaTest: 0.62, lodIdx: 2 }
];

const DEFAULT_CELL_SIZE = 34.0;
const REBUILD_DISTANCE = 55.0;
const REBUILD_FRAMES = 18;

function cellHash(cx, cz, slot) {
    let h = Math.imul(cx, 374761393) + Math.imul(cz, 668265263) + Math.imul(slot, 2654435761);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class GhibliTreeSystem {
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

        // Active Tier: Desktop is Default!
        this.tier = opts.tier || QUALITY_TIERS.DESKTOP;

        this.ready = false;
        this.enabled = true;
        this.meshes = [];            // flat list of all active InstancedMeshes
        this._speciesInstances = {}; // key -> [nearMesh, midMesh, farMesh]
        this._speciesList = JSON.parse(JSON.stringify(DEFAULT_SPECIES_CATALOG));
        this._dummy = new THREE.Object3D();
        this._lastFocusX = Infinity;
        this._lastFocusZ = Infinity;
        this._walk = null;
        this._collected = [];
        this.lastCounts = { near: 0, mid: 0, far: 0, total: 0 };

        // Global Appearance & Placement Controls
        this.uCanopyShadow = uniform(new THREE.Color(0x2c5233));
        this.uCanopyLit    = uniform(new THREE.Color(0x6aa34a));
        this.uCanopyTip    = uniform(new THREE.Color(0x9ec96a));
        this.uTrunkBase    = uniform(new THREE.Color(0x3d2b1c));
        this.uTrunkTop     = uniform(new THREE.Color(0x6b4c33));
        this.uTintSpread   = uniform(0.18);
        this.uAtlasMix     = uniform(0.75);
        this.uWindStrength = uniform(1.0);
        this.uTreeScale    = uniform(1.0);

        // Global Placement Rules
        this.minElevation = 6.0;
        this.maxElevation = 110.0;
        this.maxSlope = 0.85;
        this.density = 1.0;
        this.scaleMul = 1.0;
        this.cellSize = DEFAULT_CELL_SIZE;

        const d = this.densityScale;
        this.poolSizes = {
            near: Math.max(32, Math.round(900 * d)),
            mid:  Math.max(64, Math.round(2000 * d)),
            far:  Math.max(96, Math.round(3500 * d))
        };
    }

    // ---------------------------------------------------------------------------------
    // SPECIES MANAGEMENT
    // ---------------------------------------------------------------------------------
    getSpeciesList() {
        return this._speciesList;
    }

    getSpecies(key) {
        return this._speciesList.find(s => s.key === key);
    }

    setSpeciesEnabled(key, enabled) {
        const s = this.getSpecies(key);
        if (s) {
            s.enabled = !!enabled;
            this._updateMeshVisibility(key);
            this.respawn();
        }
    }

    setSpeciesDensity(key, density) {
        const s = this.getSpecies(key);
        if (s) {
            s.density = Math.max(0.0, Math.min(3.0, density));
            this.respawn();
        }
    }

    setSpeciesElevation(key, minElev, maxElev) {
        const s = this.getSpecies(key);
        if (s) {
            if (minElev !== undefined) s.minElev = minElev;
            if (maxElev !== undefined) s.maxElev = maxElev;
            this.respawn();
        }
    }

    setSpeciesSlope(key, maxSlope) {
        const s = this.getSpecies(key);
        if (s) {
            s.maxSlope = maxSlope;
            this.respawn();
        }
    }

    setSpeciesScale(key, scale) {
        const s = this.getSpecies(key);
        if (s) {
            s.scale = scale;
            this.respawn();
        }
    }

    setCustomTreePath(path, height = 16.0) {
        const s = this.getSpecies('Custom_Tree_Slot');
        if (s) {
            s.customPath = path;
            s.height = height;
            this.reload();
        }
    }

    setTier(tierName) {
        if (this.tier === tierName) return;
        this.tier = tierName;
        this.reload();
    }

    _updateMeshVisibility(key) {
        const s = this.getSpecies(key);
        const meshes = this._speciesInstances[key];
        if (meshes && s) {
            meshes.forEach(m => { m.visible = this.enabled && s.enabled; });
        }
    }

    // ---------------------------------------------------------------------------------
    // LOADING & INSTANCING
    // ---------------------------------------------------------------------------------
    async load() {
        this.dispose();

        for (const sp of this._speciesList) {
            try {
                await this._loadSpecies(sp);
            } catch (err) {
                console.warn(`[GhibliTreeSystem] Could not load species ${sp.name}:`, err.message);
            }
        }

        this.ready = Object.keys(this._speciesInstances).length > 0;
        return this.ready;
    }

    async reload() {
        await this.load();
        this.respawn();
    }

    async _loadSpecies(species) {
        // Resolve LOD URLs for this species
        const bandUrls = LOD_BANDS.map(band => {
            if (species.type === 'tier') {
                return `assets/Trees/${this.tier}/${species.key}/${species.key}_LOD${band.lodIdx}.glb`;
            } else if (species.type === 'pack') {
                return `${species.packFolder}/${species.key}_LOD${band.lodIdx}.glb`;
            } else if (species.type === 'direct') {
                return species.path;
            } else if (species.type === 'custom') {
                return species.customPath || species.path;
            }
            return `assets/Trees/${this.tier}/${species.key}/${species.key}_LOD0.glb`;
        });

        // Load GLTFs
        const gltfs = await Promise.all(bandUrls.map(url =>
            new Promise((resolve, reject) => {
                this.gltfLoader.load(this.resolveAssetUrl(url), resolve, undefined, () => {
                    // Fallback to Tier 1 Desktop if specific tier missing
                    const fbUrl = `assets/Trees/Tier1_Desktop/${species.key}/${species.key}_LOD0.glb`;
                    this.gltfLoader.load(this.resolveAssetUrl(fbUrl), resolve, undefined, reject);
                });
            })
        ));

        // Extract shared atlas
        let speciesAtlas = null;
        for (const gltf of gltfs) {
            gltf.scene.traverse(c => {
                if (!speciesAtlas && c.isMesh && c.material && c.material.map) {
                    speciesAtlas = c.material.map;
                }
            });
            if (speciesAtlas) break;
        }

        if (speciesAtlas) {
            speciesAtlas.colorSpace = THREE.SRGBColorSpace;
            speciesAtlas.generateMipmaps = true;
            speciesAtlas.minFilter = THREE.LinearMipmapLinearFilter;
        }

        const row = [];
        LOD_BANDS.forEach((band, bi) => {
            const gltf = gltfs[bi] || gltfs[0];
            const geo = this._extractGeometry(gltf, species.height);
            if (!geo) return;

            const mat = this._buildMaterial(band, speciesAtlas);
            const pool = Math.max(16, Math.round(this.poolSizes[band.name] / 4));
            const mesh = new THREE.InstancedMesh(geo, mat, pool);

            mesh.name = `${species.key}_${band.name}`;
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            mesh.count = 0;
            mesh.visible = this.enabled && species.enabled;
            mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), band.maxDist + 60);
            mesh.frustumCulled = false;

            this.scene.add(mesh);
            row.push(mesh);
            this.meshes.push(mesh);
        });

        this._speciesInstances[species.key] = row;
    }

    _extractGeometry(gltf, targetHeight) {
        gltf.scene.updateMatrixWorld(true);
        let source = null;
        gltf.scene.traverse(c => { if (!source && c.isMesh) source = c; });
        if (!source) return null;

        const g = source.geometry.clone();
        g.applyMatrix4(source.matrixWorld);

        g.computeBoundingBox();
        const bb = g.boundingBox;
        const h = bb.max.y - bb.min.y;
        const s = h > 0 ? targetHeight / h : 1.0;
        g.translate(0, -bb.min.y, 0);
        g.scale(s, s, s);

        if (g.attributes.tangent) g.deleteAttribute('tangent');
        if (g.attributes.color) g.deleteAttribute('color');

        if (!g.attributes._is_canopy && !g.attributes._aisbark) {
            const n = g.attributes.position.count;
            const arr = new Float32Array(n);
            const posArr = g.attributes.position;
            for (let i = 0; i < n; i++) arr[i] = posArr.getY(i) > targetHeight * 0.28 ? 1 : 0;
            g.setAttribute('_is_canopy', new THREE.BufferAttribute(arr, 1));
        } else if (g.attributes._aisbark && !g.attributes._is_canopy) {
            const n = g.attributes._aisbark.count;
            const arr = new Float32Array(n);
            const barkArr = g.attributes._aisbark;
            for (let i = 0; i < n; i++) arr[i] = barkArr.getX(i) > 0.5 ? 0 : 1;
            g.setAttribute('_is_canopy', new THREE.BufferAttribute(arr, 1));
        }

        g.computeBoundingBox();
        g.computeBoundingSphere();
        return g;
    }

    _buildMaterial(band, speciesAtlas) {
        const mat = new MeshToonNodeMaterial({
            gradientMap: this.gradientMap || undefined,
            side: band.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
            transparent: false,
            alphaTest: band.alphaTest,
            depthWrite: true,
            dithering: true
        });

        const isCanopy = attribute('_is_canopy', 'float');
        const atlasSample = speciesAtlas ? texture(speciesAtlas, uv()) : null;

        mat.colorNode = Fn(() => {
            const localY = clamp(positionLocal.y.div(18.0), 0.0, 1.0);

            const origin = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0));
            const instHash = fract(sin(origin.x.mul(12.9898).add(origin.z.mul(78.233))).mul(43758.5453));
            const tint = float(1.0).sub(this.uTintSpread.mul(0.5)).add(instHash.mul(this.uTintSpread));

            const canopyLow = mix(this.uCanopyShadow, this.uCanopyLit, smoothstep(float(0.10), float(0.62), localY));
            const canopyCol = mix(canopyLow, this.uCanopyTip, smoothstep(float(0.58), float(0.98), localY)).mul(tint);
            const trunkCol = mix(this.uTrunkBase, this.uTrunkTop, smoothstep(float(0.0), float(0.45), localY));

            const palette = mix(trunkCol, canopyCol, isCanopy);
            if (!atlasSample) return palette;

            const tinted = atlasSample.rgb.mul(palette).mul(1.8);
            return mix(palette, tinted, this.uAtlasMix);
        })();

        if (atlasSample) mat.opacityNode = atlasSample.a;

        if (band.sway) {
            mat.positionNode = Fn(() => {
                const p = positionLocal.toVar();
                const origin = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0));

                const w1 = sin(this.uTime.mul(1.5).add(origin.x.mul(0.03)).add(origin.z.mul(0.025))).mul(0.055);
                const w2 = cos(this.uTime.mul(2.6).add(origin.x.mul(0.06)).add(origin.z.mul(0.04))).mul(0.028);
                const gust = sin(this.uTime.mul(4.0).add(origin.x.mul(0.12))).mul(0.012);

                const heightF = max(0.0, positionGeometry.y).div(18.0);
                const swayAmt = w1.add(w2).add(gust)
                    .mul(heightF.mul(1.5))
                    .mul(isCanopy)
                    .mul(this.uWindStrength);

                p.x.addAssign(swayAmt);
                p.z.addAssign(swayAmt.mul(0.7));
                return p;
            })();
        }

        return mat;
    }

    // ---------------------------------------------------------------------------------
    // PROCEDURAL PLACEMENT
    // ---------------------------------------------------------------------------------
    _isValidSite(x, z, species) {
        const biome = this.getBiomeAt(x, z);
        if (!biome || !biome.name || !biome.name.includes('Ghibli')) return null;

        const island = this.getIslandData(x, z);
        if (!island || island.mask < 0.35) return null;

        const h = this.getWorldHeight(x, z);
        const minE = species ? Math.max(this.minElevation, species.minElev) : this.minElevation;
        const maxE = species ? Math.min(this.maxElevation, species.maxElev) : this.maxElevation;
        if (h < minE || h > maxE) return null;

        if (this.getPathStrength(x, z) >= 0.20) return null;

        const hx = this.getWorldHeight(x + 8, z);
        const hz = this.getWorldHeight(x, z + 8);
        const slope = Math.max(Math.abs(hx - h), Math.abs(hz - h)) / 8.0;
        const maxS = species ? Math.min(this.maxSlope, species.maxSlope) : this.maxSlope;
        if (slope > maxS) return null;

        return h;
    }

    _visitCell(cx, cz, focusX, focusZ, maxDistSq, out) {
        const ddx = (cx + 0.5) * this.cellSize - focusX;
        const ddz = (cz + 0.5) * this.cellSize - focusZ;
        const distSq = ddx * ddx + ddz * ddz;
        if (distSq > maxDistSq) return;

        const activeSpecies = this._speciesList.filter(s => s.enabled && this._speciesInstances[s.key]);
        if (activeSpecies.length === 0) return;

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

            const r = cellHash(cx, cz, s * 3 + 3);
            const grove = Math.sin(x * 0.0016) * Math.cos(z * 0.0013);
            const spIdx = Math.floor(Math.abs(grove + r * 0.5) * activeSpecies.length) % activeSpecies.length;
            const chosenSpecies = activeSpecies[spIdx];

            if (r > chosenSpecies.density) continue;

            const h = this._isValidSite(x, z, chosenSpecies);
            if (h === null) continue;

            out.push({
                x, y: h, z,
                speciesKey: chosenSpecies.key,
                rot: r * Math.PI * 2.0,
                scale: (0.85 + cellHash(cx, cz, s * 3 + 5) * 0.34) * this.scaleMul * chosenSpecies.scale,
                dist: Math.sqrt(distSq)
            });
        }
    }

    _commit(focusX, focusZ) {
        const perMeshCount = {};
        Object.keys(this._speciesInstances).forEach(k => {
            perMeshCount[k] = [0, 0, 0];
        });

        const dummy = this._dummy;
        this._collected.sort((a, b) => a.dist - b.dist);

        for (const c of this._collected) {
            let band = -1;
            for (let b = 0; b < LOD_BANDS.length; b++) {
                if (c.dist <= LOD_BANDS[b].maxDist) { band = b; break; }
            }
            if (band < 0) continue;

            const meshes = this._speciesInstances[c.speciesKey];
            if (!meshes) continue;
            const mesh = meshes[band];
            if (!mesh) continue;

            const idx = perMeshCount[c.speciesKey][band];
            if (idx >= mesh.instanceMatrix.count) continue;

            dummy.position.set(c.x, c.y, c.z);
            dummy.rotation.set(0, c.rot, 0);
            dummy.scale.setScalar(c.scale);
            dummy.updateMatrix();
            mesh.setMatrixAt(idx, dummy.matrix);
            perMeshCount[c.speciesKey][band] = idx + 1;
        }

        const counts = { near: 0, mid: 0, far: 0, total: 0 };
        Object.keys(this._speciesInstances).forEach(key => {
            const meshes = this._speciesInstances[key];
            meshes.forEach((mesh, bi) => {
                mesh.count = perMeshCount[key][bi];
                mesh.instanceMatrix.needsUpdate = true;
                mesh.boundingSphere.center.set(focusX, 0, focusZ);
                mesh.boundingSphere.radius = LOD_BANDS[bi].maxDist + 60;
                mesh.frustumCulled = true;
                counts[LOD_BANDS[bi].name] += mesh.count;
                counts.total += mesh.count;
            });
        });
        this.lastCounts = counts;
    }

    // ---------------------------------------------------------------------------------
    // PER-FRAME UPDATE
    // ---------------------------------------------------------------------------------
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

        const moved = Math.hypot(focusX - this._lastFocusX, focusZ - this._lastFocusZ);
        if (moved < REBUILD_DISTANCE) return;

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
            radius, width,
            total: width * width,
            maxDistSq: maxDist * maxDist,
            i: 0
        };
    }

    setCellSize(v) {
        const next = Math.max(14.0, Math.min(90.0, v));
        if (Math.abs(next - this.cellSize) < 0.01) return;
        this.cellSize = next;
        this.respawn();
    }

    respawn() {
        this._lastFocusX = Infinity;
        this._lastFocusZ = Infinity;
        this._walk = null;
        this._collected = [];
    }

    setVisible(v) {
        this.enabled = v;
        this.meshes.forEach(m => { m.visible = v; });
    }

    setColor(which, hex) {
        const u = {
            canopyShadow: this.uCanopyShadow,
            canopyLit: this.uCanopyLit,
            canopyTip: this.uCanopyTip,
            trunkBase: this.uTrunkBase,
            trunkTop: this.uTrunkTop
        }[which];
        if (u) u.value.set(hex);
    }

    dispose() {
        this.meshes.forEach(m => {
            this.scene.remove(m);
            if (m.material) m.material.dispose();
        });
        this.meshes.length = 0;
        this._speciesInstances = {};
    }
}
