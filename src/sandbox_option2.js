import terrainArch from './world/biomes/terrain-archipelago.js';
import terrainGhibli from './world/biomes/terrain-ghibli.js';
import terrainPlains from './world/biomes/terrain-plains.js';
import terrainMtn from './world/biomes/terrain-mountains.js';
import terrainCrystal from './world/biomes/terrain-crystal.js';
import terrainJungle from './world/biomes/terrain-jungle.js';
import terrainDesert, { desertColors } from './world/biomes/terrain-desert.js';
import terrainCanyon from './world/biomes/terrain-canyon.js';
import terrainNorthPole, { northPoleColors } from './world/biomes/terrain-northpole.js';

import { WaterSystem } from './WaterAnime/WaterSystem.js';
import { WaterModalUI } from './WaterAnime/WaterModalUI.js';
import { WaterEditorGUI } from './WaterAnime/WaterEditorGUI.js';
import { zenithColorUniform, horizonColorUniform, sunColorUniform, sunDirUniform, deepColorUniform, shallowColorUniform } from './WaterAnime/OpenSeaOcean.js';
import { TreeBillboardEditor } from './ui/TreeBillboardEditor.js';
import { GroundFogEditor, cleanBiomeName, DEFAULT_BIOME_FOG_CONFIGS } from './ui/GroundFogEditor.js';
import { TimeOfDayExporter } from './environment/TimeOfDayExporter.js';
import { WorldStudioOverlay } from './ui/WorldStudioOverlay.js';


import { LOW_GFX, TERRAIN_RES } from './config/constants.js';
import { snoise } from './world/Noise.js';
import { ZONES, WORLD_LENGTH, BLEND_WIDTH } from './world/BiomeManager.js';
import { getBiomeAt, getWorldHeight, getWorldColor, getIslandData } from './world/TerrainGenerator.js';

    import * as THREE from 'three';

import { PlayerPhysics } from './physics/PlayerPhysics.js';
import { CameraManager } from './physics/CameraManager.js';
import { createProceduralSky } from './shaders/atmosphere/proceduralSky.js';
import { BIOME_SKY_CONFIGS, WEATHER_PRESETS } from './environment/BiomeSkyConfigs.js';
import { setupGodMode, toggleGodMode, updateGodMode } from './physics/GodMode.js';


import { MeshToonNodeMaterial, MeshStandardNodeMaterial, MeshBasicNodeMaterial, PointsNodeMaterial } from 'three/webgpu';
import { uniform, texture, Fn, positionLocal, abs, positionGeometry, sin, step, positionWorld, normalWorld, cameraPosition, float, vec2, vec3, vec4, dot, fract, mix, pow, clamp, normalize, smoothstep as tslSmoothstep, attribute } from 'three/tsl';
import { scene, camera, renderer, clock, applyRenderBudget } from './core/Engine.js';
import { deviceTier, tierSettings, budgetedPixelRatio, AdaptiveResolution, describeTier } from './core/DeviceTier.js';
import { GhibliTreeSystem } from './entities/GhibliTreeSystem.js';
import { postProcessing as composer, scenePass, initPostProcessing, bloomPass, godRaysPass, initPostProcessingUI, uRolloffKnee, setGodRaySunVisible, uPhaseExposure, uDitherAmount } from './core/PostProcessing.js';

    import { initTerrainEditor } from '../TerrainEditor.js';
    import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
    import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
    import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
    import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { LensflareMesh, LensflareElement } from 'three/addons/objects/LensflareMesh.js';
    import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
    import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
    import { ToonShaderManager } from './vfx/ToonShaderManager.js';
    import { createTerrainMaterial } from './shaders/materials/TerrainNodeMaterial.js';
    import { createTreeMaterial } from './shaders/materials/TreeNodeMaterial.js';
    import { windSwayNode } from './shaders/materials/WindSwayNode.js';
    import { FLIGHT_MODELS } from './config/FlightModelsConfig.js';
    import { FlightModelManager } from './entities/FlightModelManager.js';
    import { BiplaneEngineAudio } from './audio/BiplaneEngineAudio.js';
    import { AMBIENT_TRACKS } from './audio/AmbientMusic.js';
    const tracks = AMBIENT_TRACKS;

    // Wait for WebGPU Backend to initialize before doing ANY graph or material allocations
    await renderer.init();

    const BASE_URL = import.meta.env.BASE_URL || './';
    function resolveAssetUrl(p) {
        if (!p) return p;
        if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:') || p.startsWith('blob:')) return p;
        const cleanPath = p.replace(/^\.?\//, '');
        const cleanBase = BASE_URL.endsWith('/') ? BASE_URL : (BASE_URL + '/');
        return `${cleanBase}${cleanPath}`;
    }

    let isWindOn = false;
    let isRainOn = false;
    let isWindTrailsOn = true;
    let isFlightPaused = false;
    let isShadowsOn = !LOW_GFX;
    let isTreeShadowsOn = false;
    let shadowDistMode = LOW_GFX ? 'Close' : 'Med';
    let isBloomOn = false;
    // Adaptive resolution: samples frame time and nudges the render scale. Targets ~30fps
    // (4K does not need 60). Hysteresis in AdaptiveResolution stops the screen breathing.
    const adaptiveRes = new AdaptiveResolution({
        onScaleChange: (scale) => {
            applyRenderBudget(scale);
            if (typeof params !== 'undefined') params.renderScale = scale;
            if (composer && typeof composer.setSize === 'function') {
                composer.setSize(window.innerWidth, window.innerHeight);
            }
        }
    });
    let cameraZoomDist = parseFloat(localStorage.getItem('wl_zoomDist')) || (deviceTier === 'mobile' ? 22.0 : 12.0);
    if (deviceTier === 'mobile' && cameraZoomDist < 14.0) cameraZoomDist = 22.0;
    let currentFrame = 0;
    let logicTimer = 0;
    let animeWaterSystem = null;
    let animeWaterGUI = null;
    let waterEditorFolder = null;
    let stdFolder = null;
    let terrainRes = TERRAIN_RES;
    let playerGrp;
    
    let isGodMode = false;
    let godCamera = null;
    let godControls = null;
    let cameraBase = null;
    let isInitializingGui = true;

    // Clouds config
    let CLOUD_COUNT = LOW_GFX ? 40 : 150;
    let HIGH_CLOUD_COUNT = LOW_GFX ? 0 : 24;
    let WISPY_CLOUD_COUNT = 0; // flight-merged ships these off
    let MEGA_CLOUD_COUNT = LOW_GFX ? 0 : 24;



    const loadedCustomModels = [];
    let selectedModelIndex = -1;
    let customModelBaseScale = 1.0;
    let customModelScaleMult = 1.0;
    let customModelOffsetX = 0.0;
    let customModelOffsetY = 0.0;
    let customModelOffsetZ = 0.0;
    let customModelRotationY = 0.0;
    let customModelFolder = null;
    let modelDropdownController = null;
    const customModelControllers = {};

    let _mapEl = null;
    let _isMapExpanded = false;
    let _mapCtx = null;
    let _mapCanvas = null;
    let _lastMapX = -999999;
    let _lastMapZ = -999999;
    let _mapZoomLevel = 1.0;
    let _lastZoomState = 1.0;
    let _lastExpandedState = false;

    function toggleMapExpand() {
        _isMapExpanded = !_isMapExpanded;
        _mapEl = document.getElementById('world-map');
        const mapTitle = document.getElementById('map-title-text');
        const expandBtn = document.getElementById('expand-map-btn');

        if (_mapEl) {
            if (_isMapExpanded) {
                _mapEl.style.width = '520px';
                _mapEl.style.left = '50%';
                _mapEl.style.top = '50%';
                _mapEl.style.bottom = 'auto';
                _mapEl.style.transform = 'translate(-50%, -50%)';
                if (mapTitle) mapTitle.innerText = '🗺️ EXPANDED WORLD MAP (PRESS M TO CLOSE)';
                if (expandBtn) expandBtn.innerText = '🗹';
            } else {
                _mapEl.style.width = '230px';
                _mapEl.style.left = '20px';
                _mapEl.style.bottom = '20px';
                _mapEl.style.top = 'auto';
                _mapEl.style.transform = 'none';
                if (mapTitle) mapTitle.innerText = '🗺️ RADAR MAP';
                if (expandBtn) expandBtn.innerText = '⤢';
            }
        }
        _lastMapX = -999999;
    }

    function initMapUI() {
        _mapEl = document.getElementById('world-map');
        _mapCanvas = document.getElementById('map-canvas');
        if (_mapCanvas) {
            _mapCtx = _mapCanvas.getContext('2d');
            _mapCanvas.style.cursor = 'crosshair';
            _mapCanvas.addEventListener('click', (e) => {
                const rect = _mapCanvas.getBoundingClientRect();
                const normX = (e.clientX - rect.left) / rect.width - 0.5;
                const normY = (e.clientY - rect.top) / rect.height - 0.5;
                
                const baseSize = _isMapExpanded ? WORLD_LENGTH : 80000;
                const radarSize = baseSize / _mapZoomLevel;

                if (typeof playerGrp !== 'undefined') {
                    const targetX = playerGrp.position.x + normX * radarSize;
                    const targetZ = playerGrp.position.z + normY * radarSize;
                    playerGrp.position.set(targetX, Math.max(15, getWorldHeight(targetX, targetZ) + 15), targetZ);
                    lastTerrainGridX = -999999;
                    _lastMapX = -999999;
                }
            });
        }

        const expandMapBtn = document.getElementById('expand-map-btn');
        if (expandMapBtn) {
            expandMapBtn.addEventListener('click', () => toggleMapExpand());
        }

        const zoomInBtn = document.getElementById('zoom-in-btn');
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                _mapZoomLevel = Math.min(16.0, _mapZoomLevel * 1.6);
                _lastMapX = -999999;
            });
        }

        const zoomOutBtn = document.getElementById('zoom-out-btn');
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                _mapZoomLevel = Math.max(0.05, _mapZoomLevel / 1.6);
                _lastMapX = -999999;
            });
        }

        if (_mapCanvas) {
            _mapCanvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (e.deltaY > 0) {
                    _mapZoomLevel = Math.max(0.05, _mapZoomLevel / 1.25);
                } else {
                    _mapZoomLevel = Math.min(16.0, _mapZoomLevel * 1.25);
                }
                _lastMapX = -999999;
            }, { passive: false });
        }

        const closeMapBtn = document.getElementById('close-map-btn');
        if (closeMapBtn) {
            closeMapBtn.addEventListener('click', () => {
                if (_mapEl) _mapEl.style.display = 'none';
                if (typeof params !== 'undefined') params.showMap = false;
            });
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'm' || e.key === 'M') {
                if (!e.target || (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA')) {
                    if (_mapEl && _mapEl.style.display === 'none') {
                        _mapEl.style.display = 'block';
                    } else {
                        toggleMapExpand();
                    }
                }
            }
        });
    }
    initMapUI();

    const _mapColors = {
        '🏝️ Archipelago':       '#2a6aad',
        '🌲 Ghibli Land':       '#4a9640',
        '🌾 Golden Plains':     '#c8a832',
        '🏔️ Misty Mountains':   '#6b7280',
        '🌴 Lush Jungle':        '#2eb85c',
        '💎 Crystal Land':      '#5b8fa8',
        '🌊 Open Ocean':        '#1d4ed8',
        '🏜️ Desert Dunes':      '#d97706',
        '⛰️ Badlands Canyon':   '#9a3412',
        '❄️ North Pole':        '#93e5fa',
    };

    let _mapBgCanvas, _mapBgCtx;


    function _drawWorldMap() {
        if (typeof playerGrp === 'undefined') return;
        if (!_mapCanvas) _mapCanvas = document.getElementById('map-canvas');
        if (_mapCanvas && !_mapCtx) _mapCtx = _mapCanvas.getContext('2d');
        if (!_mapCanvas || !_mapCtx) return;
        
        const W = _isMapExpanded ? 480 : 200;
        const H = _isMapExpanded ? 480 : 200;

        if (_mapCanvas.width !== W || _mapCanvas.height !== H) {
            _mapCanvas.width = W;
            _mapCanvas.height = H;
        }

        if (!_mapBgCanvas) {
            _mapBgCanvas = document.createElement('canvas');
            _mapBgCtx = _mapBgCanvas.getContext('2d');
        }

        if (_mapBgCanvas.width !== W || _mapBgCanvas.height !== H) {
            _mapBgCanvas.width = W;
            _mapBgCanvas.height = H;
            _lastMapX = -999999;
        }

        const px = playerGrp.position.x;
        const pz = playerGrp.position.z;

        const stateChanged = (_lastExpandedState !== _isMapExpanded) || (_lastZoomState !== _mapZoomLevel);
        if (stateChanged) {
            _lastExpandedState = _isMapExpanded;
            _lastZoomState = _mapZoomLevel;
            _lastMapX = -999999;
        }

        // Re-render heavy noise background ONLY when player moves significantly or zoom/size changed
        if (Math.hypot(px - _lastMapX, pz - _lastMapZ) > 80 || stateChanged) {
            _lastMapX = px;
            _lastMapZ = pz;

            const baseSize = _isMapExpanded ? WORLD_LENGTH : 80000;
            const radarSize = baseSize / _mapZoomLevel;
            const pxStart = px - radarSize / 2;
            const pzStart = pz - radarSize / 2;
            
            const res = _isMapExpanded ? 60 : 40;
            const step = radarSize / res;
            const pxStep = W / res;
            
            _mapBgCtx.clearRect(0, 0, W, H);
            for (let i = 0; i < res; i++) {
                for (let j = 0; j < res; j++) {
                    const sampleX = pxStart + i * step;
                    const sampleZ = pzStart + j * step;
                    
                    const data = getIslandData(sampleX, sampleZ);
                    if (data.mask === 0) {
                        _mapBgCtx.fillStyle = '#1a4a8c'; // Deep ocean blue
                    } else {
                        _mapBgCtx.fillStyle = _mapColors[data.mainBiome.name] || '#88cc88';
                    }
                    _mapBgCtx.fillRect(i * pxStep, j * pxStep, pxStep + 0.5, pxStep + 0.5);
                }
            }
        }
        
        _mapCtx.clearRect(0, 0, W, H);
        _mapCtx.drawImage(_mapBgCanvas, 0, 0);
        
        // Draw Red Player Dot in center
        _mapCtx.fillStyle = '#ff3333';
        _mapCtx.beginPath();
        _mapCtx.arc(W / 2, H / 2, _isMapExpanded ? 6 : 4, 0, Math.PI * 2);
        _mapCtx.fill();
        _mapCtx.strokeStyle = '#ffffff';
        _mapCtx.lineWidth = 1.5;
        _mapCtx.stroke();
        
        const infoText = document.getElementById('map-info-text');
        if (infoText) {
            const rx = Math.round(px);
            const rz = Math.round(pz);
            const currentBiome = getBiomeAt(px, pz);
            const bName = currentBiome ? currentBiome.name : 'Unknown';
            const zoomStr = _mapZoomLevel >= 1.0 ? `${_mapZoomLevel.toFixed(1)}x` : `${_mapZoomLevel.toFixed(2)}x`;
            infoText.innerText = `X: ${rx}m | Z: ${rz}m | BIOME: ${bName} | ZOOM: ${zoomStr}`;
        }
    }

    let flightModelDropdownController = null;
    let soundMuteController = null;
    let engineSoundController = null;
    let trackDropdownController = null;
    let flightFolder = null;
    let audioFolder = null;
    let presetsFolder = null;
    let presetDropdownControllers = [];

    const gui = new GUI({ title: 'Controls & Settings' });
    const origGuiOpen = gui.open.bind(gui);
    gui.open = function(t = true) {
        if (this.$children) this.$children.style.height = '';
        this.domElement.classList.remove('transition');
        return origGuiOpen(t);
    };
    const origGuiClose = gui.close.bind(gui);
    gui.close = function() {
        if (this.$children) this.$children.style.height = '';
        this.domElement.classList.remove('transition');
        return origGuiClose();
    };
    const params = {
        worldMode: 'Islands',
        sceneFog: true,
        showFog: true,
        fogIntensity: 3.5,   // dense golden-hour fog; higher = denser (far = 800/fogIntensity)
        terrainSmoothing: 0.0,
        trails: isWindTrailsOn, lockSunToPlayer: true,
        shadows: isShadowsOn,
        treeShadows: isTreeShadowsOn,
        shadowDist: shadowDistMode,
        bloom: isBloomOn,
        terrainRes: String(terrainRes),
        autoResolution: true,
        renderScale: 1.0,
        exposureTrim: 1.0,
        dayExposure: 0.62,
        nightExposure: 1.35,
        treeColor0: '#ffffff',
        treeColor1: '#ddff88',
        treeColor2: '#88cc99',
        treeColor3: '#778855',
        treeColor4: '#aaffaa',
        treeColor5: '#bbdd99',
        treeColor6: '#669966',
        summerFilter: !LOW_GFX,
        modelVisible: true,
        wind: isWindOn,
        rain: isRainOn,
        fogPlane: false,
        godRays: true,
        godRayIntensity: 0.65,
        godRayDensity: 0.50,
        godRayDecay: 0.927,
        lumMin: 0.85,
        lumMax: 0.97,
        sunAltitude: 160,
        sunAzimuth: 0,
        lockSunToPlayer: true,
        sunDistance: 20000,
        sunDiscScale: 1.8,
        highlightKnee: 0.75,
        horizonGlow: 0.45,
        treeScale: 1.5,
        ghibliTreeScale: 1.2,
        ghibliTreeDensity: 1.0,
        ghibliTreeMinDist: 4.5,
        ghibliTreeMinHeight: 6.8,
        ghibliTreeMaxHeight: 58.0,
        ghibliTreeWindSway: 1.0,
        quality: LOW_GFX ? 'Low' : 'Regular',
        showTerrain: true,
        showWater: true,
        showTrees: true,
        showProceduralSky: true,
        skyRenderMode: 'Gradient + Clouds',
        enableProceduralClouds: true,
        enableSkydome: false,
        daySkydomeTexture: Math.random() > 0.5 ? '1' : '2',
        nightSkydomeTexture: '2', // Default to 2 because it has the transparency mask
        showClouds: true,
        showCloudsRegular: false,
        showCloudsHigh: false,
        showCloudsWispy: false,
        showCloudsMega: false,
        cloudScaleRegular: 1.0,
        cloudScaleHigh: 1.0,
        cloudScaleWispy: 1.0,
        cloudScaleMega: 1.0,
        cloudCountRegular: LOW_GFX ? 40 : 150,
        cloudCountHigh: LOW_GFX ? 0 : 24,
        cloudCountWispy: LOW_GFX ? 0 : 30,
        cloudCountMega: LOW_GFX ? 0 : 24,
        showCloudsHorizon: false,
        showVolumetricClouds: false,
        cloudCountHorizon: LOW_GFX ? 0 : 45,
        cloudScaleHorizon: 1.0,
        showBirds: true,
        showFogPlanes: false,
        showCrystals: false,
        showMap: false,
        showGUI: false,
        exposure: 1.9,
        shadeMode: 'original',
        rainSize: 2.0,
        rainIntensity: 1.0,
        rainWindX: 1.0,
        rainWindY: 0.5,
        biomeFogOffset: 0,
        birdCount: 60,
        birdScale: 0.8,
        birdFlockRadius: 35,
        birdFlockSpread: 12,
        birdMaxSpeed: 45,
        godMode: false,
    };
    window.params = params;

    const toonShaderManager = new ToonShaderManager();

    let timePhase = (localStorage.getItem('wl_timePhase') !== null) ? parseInt(localStorage.getItem('wl_timePhase')) : 1; // Default to 1: Dusk

    let envConfigs = [
        {name: 'Day', bg: 0x3f7fc4, mid: 0x74add9, fog: 0xbcd2e2, amb: 0xcfe6f7, dir: 0xfff3d8, ambI: 0.75, dirI: 1.60, starOp: 0, sunY: 10000, moonY: -8000, glintCol: 0xfff0d0, cloudCol: 0xfdf7e8},
        {name: 'Dusk', bg: 0x2a5090, mid: 0xc85078, fog: 0xffa07a, amb: 0xffdab9, dir: 0xffaa00, ambI: 1.1, dirI: 3.2, starOp: 0, sunY: 160, moonY: 200, glintCol: 0xffaa00, cloudCol: 0xfffaec},
        {name: 'Twilight', bg: 0x0a1330, mid: 0x1b2f5c, fog: 0x24406e, amb: 0x6b82ad, dir: 0x9ecbff, ambI: 1.05, dirI: 2.2, starOp: 1.0, sunY: -8000, moonY: 9000, glintCol: 0x8cc4ff, cloudCol: 0x33507d}
    ];

    // ==========================================
    // SAVE / LOAD PRESETS & PROFILES
    // ==========================================
    const DEFAULT_PRESETS = {
        'Golden Hour Dusk (Default)': {
            name: 'Golden Hour Dusk (Default)',
            timePhase: 1,
            sunAltitude: 160,
            envConfigs: [
                { name: 'Day', bg: 0x4a90d9, mid: 0x7ab4e6, fog: 0xc8dce8, amb: 0xdcf2ff, dir: 0xfffaeb, ambI: 1.2, dirI: 2.4, starOp: 0, sunY: 10000, moonY: -8000, glintCol: 0xfff0d0, cloudCol: 0xfffaec },
                { name: 'Dusk', bg: 0x2a5090, mid: 0xc85078, fog: 0xffa07a, amb: 0xffdab9, dir: 0xffaa00, ambI: 1.1, dirI: 3.2, starOp: 0, sunY: 160, moonY: 200, glintCol: 0xffaa00, cloudCol: 0xfffaec },
                { name: 'Twilight', bg: 0x040816, mid: 0x0f1d3a, fog: 0x16284d, amb: 0x556688, dir: 0x88bbff, ambI: 0.8, dirI: 1.8, starOp: 1.0, sunY: -8000, moonY: 9000, glintCol: 0x66aaff, cloudCol: 0x223355 }
            ],
            params: {
                sceneFog: true,
                fogIntensity: 3.5,
                sunAltitude: 160,
                godRays: true,
                bloom: true,
                skyRenderMode: 'Gradient Regular'
            }
        },
        'Bright Daylight (Noon)': {
            name: 'Bright Daylight (Noon)',
            timePhase: 0,
            sunAltitude: 10000,
            envConfigs: [
                { name: 'Day', bg: 0x4a90d9, mid: 0x7ab4e6, fog: 0xc8dce8, amb: 0xdcf2ff, dir: 0xfffaeb, ambI: 1.2, dirI: 2.4, starOp: 0, sunY: 10000, moonY: -8000, glintCol: 0xfff0d0, cloudCol: 0xfffaec },
                { name: 'Dusk', bg: 0x2a5090, mid: 0xc85078, fog: 0xffa07a, amb: 0xffdab9, dir: 0xffaa00, ambI: 1.1, dirI: 3.2, starOp: 0, sunY: 160, moonY: 200, glintCol: 0xffaa00, cloudCol: 0xfffaec },
                { name: 'Twilight', bg: 0x040816, mid: 0x0f1d3a, fog: 0x16284d, amb: 0x556688, dir: 0x88bbff, ambI: 0.8, dirI: 1.8, starOp: 1.0, sunY: -8000, moonY: 9000, glintCol: 0x66aaff, cloudCol: 0x223355 }
            ],
            params: {
                sceneFog: true,
                fogIntensity: 3.5,
                sunAltitude: 10000,
                godRays: true,
                bloom: true,
                skyRenderMode: 'Gradient Regular'
            }
        },
        'Midnight Moonlight (Twilight)': {
            name: 'Midnight Moonlight (Twilight)',
            timePhase: 2,
            sunAltitude: -8000,
            envConfigs: [
                { name: 'Day', bg: 0x4a90d9, mid: 0x7ab4e6, fog: 0xc8dce8, amb: 0xdcf2ff, dir: 0xfffaeb, ambI: 1.2, dirI: 2.4, starOp: 0, sunY: 10000, moonY: -8000, glintCol: 0xfff0d0, cloudCol: 0xfffaec },
                { name: 'Dusk', bg: 0x2a5090, mid: 0xc85078, fog: 0xffa07a, amb: 0xffdab9, dir: 0xffaa00, ambI: 1.1, dirI: 3.2, starOp: 0, sunY: 160, moonY: 200, glintCol: 0xffaa00, cloudCol: 0xfffaec },
                { name: 'Twilight', bg: 0x040816, mid: 0x0f1d3a, fog: 0x16284d, amb: 0x556688, dir: 0x88bbff, ambI: 0.8, dirI: 1.8, starOp: 1.0, sunY: -8000, moonY: 9000, glintCol: 0x66aaff, cloudCol: 0x223355 }
            ],
            params: {
                sceneFog: true,
                fogIntensity: 3.5,
                sunAltitude: -8000,
                godRays: false,
                bloom: true,
                skyRenderMode: 'Gradient Regular'
            }
        }
    };

    function showVisualToast(msg) {
        if (typeof flightModelManager !== 'undefined' && flightModelManager && flightModelManager.showToast) {
            flightModelManager.showToast(msg);
            return;
        }
        let toast = document.getElementById('wl-visual-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'wl-visual-toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '24px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.background = 'rgba(15, 23, 42, 0.9)';
            toast.style.color = '#fff';
            toast.style.padding = '8px 18px';
            toast.style.borderRadius = '20px';
            toast.style.fontFamily = 'system-ui, sans-serif';
            toast.style.fontSize = '13px';
            toast.style.zIndex = '99999';
            toast.style.pointerEvents = 'none';
            toast.style.transition = 'opacity 0.3s ease';
            document.body.appendChild(toast);
        }
        toast.innerText = msg;
        toast.style.opacity = '1';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            if (toast) toast.style.opacity = '0';
        }, 2200);
    }

    let timeOfDayExporter = null;

    const settingsManager = {
        presetName: 'My Dusk Look 1',
        loadPreset: 'Golden Hour Dusk (Default)',
        saveSetting: (customName) => {
            const name = (typeof customName === 'string' && customName.trim())
                ? customName.trim()
                : (settingsManager.presetName.trim() || `Look ${new Date().toLocaleTimeString()}`);

            const currentGuiData = gui ? gui.save() : null;
            const currentEnvConfigs = (typeof envConfigs !== 'undefined') ? JSON.parse(JSON.stringify(envConfigs)) : null;
            const currentParams = {};
            for (let k in params) {
                if (typeof params[k] !== 'function') currentParams[k] = params[k];
            }
            const currentCloudParams = (typeof cloudParams !== 'undefined') ? JSON.parse(JSON.stringify(cloudParams)) : null;
            const currentModelId = (typeof flightModelManager !== 'undefined' && flightModelManager)
                ? (flightModelManager.getCurrentConfig()?.id || 'mitsubishi_b2m2')
                : 'kiki';

            const presetData = {
                name: name,
                timePhase: timePhase,
                guiData: currentGuiData,
                envConfigs: currentEnvConfigs,
                params: currentParams,
                cloudParams: currentCloudParams,
                modelId: currentModelId,
                timestamp: Date.now()
            };

            const saved = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
            saved[name] = presetData;
            localStorage.setItem('wl_custom_presets', JSON.stringify(saved));
            settingsManager.loadPreset = name;
            updateAllPresetDropdowns(name);
            showVisualToast(`Saved Preset: ${name}`);
        },
        loadSetting: (presetName) => {
            const target = presetName || settingsManager.loadPreset;
            if (!target) return;

            if (DEFAULT_PRESETS[target]) {
                const def = DEFAULT_PRESETS[target];
                if (typeof window.setTimePhase === 'function') {
                    window.setTimePhase(def.timePhase);
                } else {
                    timePhase = def.timePhase;
                }
                if (def.envConfigs && Array.isArray(def.envConfigs) && typeof envConfigs !== 'undefined') {
                    for (let i = 0; i < def.envConfigs.length; i++) {
                        if (envConfigs[i]) Object.assign(envConfigs[i], def.envConfigs[i]);
                    }
                }
                if (def.params) {
                    Object.assign(params, def.params);
                }
                if (gui) {
                    gui.controllersRecursive().forEach(c => c.updateDisplay());
                }
                showVisualToast(`Loaded: ${target}`);
                return;
            }

            const saved = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
            if (saved[target]) {
                const p = saved[target];
                if (p.envConfigs && Array.isArray(p.envConfigs) && typeof envConfigs !== 'undefined') {
                    for (let i = 0; i < p.envConfigs.length; i++) {
                        if (envConfigs[i]) Object.assign(envConfigs[i], p.envConfigs[i]);
                    }
                }
                if (p.timePhase !== undefined) {
                    if (typeof window.setTimePhase === 'function') {
                        window.setTimePhase(p.timePhase);
                    } else {
                        timePhase = p.timePhase;
                    }
                }
                if (p.params) {
                    Object.assign(params, p.params);
                }
                if (p.cloudParams && typeof cloudParams !== 'undefined') {
                    Object.assign(cloudParams, p.cloudParams);
                }
                if (p.modelId && typeof flightModelManager !== 'undefined' && flightModelManager) {
                    flightModelManager.setModelById(p.modelId);
                }
                if (p.guiData && gui) {
                    gui.load(p.guiData);
                }
                if (gui) {
                    gui.controllersRecursive().forEach(c => c.updateDisplay());
                }
                showVisualToast(`Loaded Preset: ${target}`);
            }
        },
        deleteSetting: () => {
            const target = settingsManager.loadPreset;
            if (DEFAULT_PRESETS[target]) {
                showVisualToast(`Cannot delete default preset: ${target}`);
                return;
            }
            const saved = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
            if (saved[target]) {
                delete saved[target];
                localStorage.setItem('wl_custom_presets', JSON.stringify(saved));
                settingsManager.loadPreset = 'Golden Hour Dusk (Default)';
                updateAllPresetDropdowns('Golden Hour Dusk (Default)');
                showVisualToast(`Deleted Preset: ${target}`);
            }
        },
        reset: () => {
            settingsManager.loadSetting('Golden Hour Dusk (Default)');
        },
        exportFullBackup: () => {
            const backup = {
                wanderlust_version: '2.0',
                timestamp: new Date().toISOString(),
                timePhase: timePhase,
                envConfigs: (typeof envConfigs !== 'undefined') ? JSON.parse(JSON.stringify(envConfigs)) : [],
                params: Object.assign({}, params),
                cloudParams: (typeof cloudParams !== 'undefined') ? JSON.parse(JSON.stringify(cloudParams)) : {},
                biomeFogSettings: window.biomeFogSettings || {},
                biomeSkyConfigs: window.BIOME_SKY_CONFIGS || {},
                customPresets: JSON.parse(localStorage.getItem('wl_custom_presets') || '{}')
            };
            const jsonStr = JSON.stringify(backup, null, 2);
            navigator.clipboard.writeText(jsonStr).then(() => {
                showVisualToast('Full Backup copied to clipboard');
            }).catch(() => {
                prompt('Copy Full Backup JSON:', jsonStr);
            });
            try {
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `wanderlust_full_backup_${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch(e) {}
        },
        importFullBackup: () => {
            const input = prompt('Paste Wanderlust Full Backup JSON:');
            if (!input) return;
            try {
                const data = JSON.parse(input);
                if (data.envConfigs && Array.isArray(data.envConfigs) && typeof envConfigs !== 'undefined') {
                    for (let i = 0; i < data.envConfigs.length; i++) {
                        if (envConfigs[i]) Object.assign(envConfigs[i], data.envConfigs[i]);
                    }
                }
                if (data.params) {
                    Object.assign(params, data.params);
                }
                if (data.cloudParams && typeof cloudParams !== 'undefined') {
                    Object.assign(cloudParams, data.cloudParams);
                }
                if (data.biomeFogSettings) {
                    window.biomeFogSettings = Object.assign({}, window.biomeFogSettings || {}, data.biomeFogSettings);
                }
                if (data.biomeSkyConfigs && window.BIOME_SKY_CONFIGS) {
                    window.BIOME_SKY_CONFIGS = Object.assign({}, window.BIOME_SKY_CONFIGS, data.biomeSkyConfigs);
                }
                if (data.customPresets) {
                    localStorage.setItem('wl_custom_presets', JSON.stringify(data.customPresets));
                }
                if (data.timePhase !== undefined) {
                    if (typeof window.setTimePhase === 'function') window.setTimePhase(data.timePhase);
                    else timePhase = data.timePhase;
                }
                updateAllPresetDropdowns();
                if (gui) gui.controllersRecursive().forEach(c => c.updateDisplay());
                if (typeof updateAtmoParamsFromPhase === 'function') updateAtmoParamsFromPhase();
                showVisualToast('Restored Full Backup Successfully');
            } catch(e) {
                alert('Invalid JSON Backup: ' + e.message);
            }
        },
        exportPresets: () => {
            const saved = localStorage.getItem('wl_custom_presets') || '{}';
            navigator.clipboard.writeText(saved).then(() => {
                showVisualToast('Copied Presets JSON to clipboard');
            }).catch(() => {
                prompt('Copy Presets JSON:', saved);
            });
        },
        importPresets: () => {
            const input = prompt('Paste Presets JSON:');
            if (!input) return;
            try {
                const parsed = JSON.parse(input);
                const current = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
                Object.assign(current, parsed);
                localStorage.setItem('wl_custom_presets', JSON.stringify(current));
                updateAllPresetDropdowns();
                showVisualToast('Imported Presets successfully');
            } catch(e) {
                alert('Invalid JSON: ' + e.message);
            }
        }
    };

    // Initialize World & Biome Studio Overlay immediately (Option 2)
    const worldStudio = new WorldStudioOverlay({
        get envConfigs() { return typeof envConfigs !== 'undefined' ? envConfigs : []; },
        get timePhase() { return typeof timePhase !== 'undefined' ? timePhase : 1; },
        get params() { return params; },
        get cloudParams() { return typeof cloudParams !== 'undefined' ? cloudParams : {}; },
        settingsManager,
        teleportToBiome: (name) => {
            if (typeof teleportToBiome === 'function') teleportToBiome(name);
        },
        setTimePhase: (phase) => {
            if (typeof window.setTimePhase === 'function') window.setTimePhase(phase);
            else if (typeof setTimePhase === 'function') setTimePhase(phase);
            else timePhase = phase;
            if (typeof updateAtmoParamsFromPhase === 'function') updateAtmoParamsFromPhase();
            if (gui) gui.controllersRecursive().forEach(c => c.updateDisplay());
        },
        refreshScene: () => {
            if (typeof updateAtmoParamsFromPhase === 'function') updateAtmoParamsFromPhase();
            if (gui) gui.controllersRecursive().forEach(c => c.updateDisplay());
        }
    });
    window.worldStudio = worldStudio;

    let isUpdatingPresetDropdown = false;
    function updateAllPresetDropdowns(selectedName) {
        if (isUpdatingPresetDropdown) return;
        isUpdatingPresetDropdown = true;
        try {
            const saved = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
            const defaultKeys = Object.keys(DEFAULT_PRESETS);
            const customKeys = Object.keys(saved);
            const options = [...defaultKeys, ...customKeys];

            presetDropdownControllers.forEach(ctrl => {
                if (ctrl && typeof ctrl.options === 'function') {
                    ctrl.options(options);
                    if (selectedName) {
                        ctrl.setValue(selectedName);
                    }
                }
            });
        } catch (err) {
            console.warn('Error updating preset dropdown:', err);
        } finally {
            isUpdatingPresetDropdown = false;
        }
    }

    const perfFolder = gui.addFolder('Performance');
    perfFolder.add(params, 'quality', ['Regular', 'Low']).name('Quality').onChange(v => {
        localStorage.setItem('gfxQuality', v === 'Low' ? 'low' : 'regular');
        if (!isInitializingGui) location.reload();
    });
    perfFolder.add(params, 'autoResolution').name('Auto Resolution').onChange(v => {
        adaptiveRes.setEnabled(v);
        if (v) { adaptiveRes.reset(); applyRenderBudget(1.0); }
        else { applyRenderBudget(params.renderScale); }
    });
    perfFolder.add(params, 'renderScale', 0.5, 1.0, 0.05).name('Render Scale').onChange(v => {
        // Manual choice wins: turn auto off so the two don't fight over the framebuffer.
        if (params.autoResolution) { params.autoResolution = false; adaptiveRes.setEnabled(false); gui.controllersRecursive().forEach(c => c.updateDisplay && c.updateDisplay()); }
        applyRenderBudget(v);
    });
    perfFolder.add({ tier: describeTier() }, 'tier').name('Detected Tier').disable();
    // Anti-banding. 0 = off (banding returns), 1 = correct 1-LSB dither, higher = visible grain.
    perfFolder.add({ dither: uDitherAmount.value }, 'dither', 0.0, 3.0, 0.1).name('Dither (anti-band)')
        .onChange(v => uDitherAmount.value = v);
    perfFolder.add(params, 'terrainRes', ['256', '128', '64']).name('Terrain Res').onChange(v => {
        terrainRes = parseInt(v);
        const newGeo = new THREE.PlaneGeometry(4000, 4000, terrainRes, terrainRes);
        newGeo.rotateX(-Math.PI / 2);
        terrain.geometry.dispose();
        terrain.geometry = newGeo;
        terrainGeo = newGeo;
        lastTerrainGridX = -9999;
    });
    perfFolder.add(params, 'shadows').name('Shadows').onChange(v => {
        isShadowsOn = v;
        dirLight.castShadow = isShadowsOn;
    });
    perfFolder.add(params, 'treeShadows').name('Tree Shadows').onChange(v => {
        isTreeShadowsOn = v;
        if (typeof treeMeshes !== 'undefined') treeMeshes.forEach(mesh => mesh.castShadow = isTreeShadowsOn);
    });
    perfFolder.add(params, 'shadowDist', ['Close', 'Med', 'Far']).name('Shadow Dist').onChange(v => {
        shadowDistMode = v;
        if (shadowDistMode === 'Close') { dirLight.shadow.mapSize.width = 1024; dirLight.shadow.mapSize.height = 1024; }
        else if (shadowDistMode === 'Med') { dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048; }
        else { dirLight.shadow.mapSize.width = 4096; dirLight.shadow.mapSize.height = 4096; }
        if (dirLight.shadow.map) { dirLight.shadow.map.dispose(); dirLight.shadow.map = null; }
    });
    perfFolder.add(params, 'bloom').name('Bloom').onChange(v => {
        isBloomOn = v;
        bloomPass.enabled = isBloomOn;
    });
    perfFolder.add({
        saveAll: () => settingsManager.saveSetting()
    }, 'saveAll').name('Save All Settings');
    perfFolder.add({
        resetAll: () => settingsManager.reset()
    }, 'resetAll').name('Reset to Default');


    // Actions for GUI
    const guiActions = {
        switchModel: () => document.getElementById('char-toggle').click(),
        openCrystalEditor: () => {
            const crystalEditor = document.getElementById('crystal-editor');
            if (crystalEditor) crystalEditor.style.display = crystalEditor.style.display === 'none' ? 'block' : 'none';
        },
        toggleMusic: () => document.getElementById('music-toggle').click(),
        nextTrack: () => document.getElementById('track-toggle').click(),
        fullscreen: () => document.getElementById('fullscreen-toggle').click()
    };
    
    // Add Navigation folder (Go To Biome)
    const navFolder = gui.addFolder('Navigation');
    navFolder.domElement.classList.add('nav-biome-grid');
    const navStyle = document.createElement('style');
    navStyle.textContent = '.nav-biome-grid:not(.closed) > .children { display: grid !important; grid-template-columns: 1fr 1fr; gap: 0; }';
    document.head.appendChild(navStyle);
    const navParams = { maxAltitude: 3500 };
    ZONES.forEach(zn => {
        navParams[zn.name] = () => {
            teleportToBiome(zn.name);
        };
        const ctrl = navFolder.add(navParams, zn.name).name(`${zn.name}`);
        ctrl.domElement.style.minWidth = '0';
    });
    navFolder.add(navParams, 'maxAltitude', 500, 15000, 100).name('Max Altitude').onChange(v => {
        if (playerPhysics) playerPhysics.maxAltitude = v;
    });

    // Add Editor folder (Terrain Editor, Edit Crystals, Tree Editor, Custom Models)
    const editorFolder = gui.addFolder('Editor');
    editorFolder.add({ openTerrainEditor: () => {
        if (window.toggleTerrainEditor) {
            window.toggleTerrainEditor();
        } else {
            const btn = document.getElementById('editor-toggle');
            if (btn) btn.click();
        }
    }}, 'openTerrainEditor').name('Terrain Editor');
    editorFolder.add({ openCrystalEditor: () => {
        const crystalEditor = document.getElementById('crystal-editor');
        if (crystalEditor) crystalEditor.style.display = crystalEditor.style.display === 'none' ? 'block' : 'none';
    }}, 'openCrystalEditor').name('Edit Crystals');
    editorFolder.add({ openTreeBillboardEditor: () => {
        if (window.treeBillboardEditor) {
            window.treeBillboardEditor.togglePanel(true);
        }
    }}, 'openTreeBillboardEditor').name('Tree & Billboard Editor');

    editorFolder.add({ loadCustomModel: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.glb,.gltf';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file && window.loadCustomModelInGame) {
                window.loadCustomModelInGame(file);
            }
        };
        input.click();
    }}, 'loadCustomModel').name('Load Custom Toon Model');

    customModelFolder = editorFolder.addFolder('Custom Model');
    customModelFolder.close();

    params.selectedModelIdx = 0;
    modelDropdownController = customModelFolder.add(params, 'selectedModelIdx', { 'No models': 0 }).name('Active Model').onChange(v => {
        selectedModelIndex = v;
        if (window.syncSlidersToSelectedModel) window.syncSlidersToSelectedModel();
    });

    params.customModelScale = 1.0;
    params.customModelY = 0.0;
    params.customModelX = 0.0;
    params.customModelZ = 0.0;
    params.customModelRot = 0;

    customModelControllers.scale = customModelFolder.add(params, 'customModelScale', 0.1, 5.0, 0.05).name('Scale multiplier').onChange(v => {
        const model = loadedCustomModels[selectedModelIndex];
        if (model) {
            model.userData.scaleMult = v;
            if (window.updateCustomModelTransform) window.updateCustomModelTransform(model);
        }
    });
    customModelControllers.y = customModelFolder.add(params, 'customModelY', -15.0, 30.0, 0.1).name('Height offset').onChange(v => {
        const model = loadedCustomModels[selectedModelIndex];
        if (model) {
            model.userData.offsetY = v;
            if (window.updateCustomModelTransform) window.updateCustomModelTransform(model);
        }
    });
    customModelControllers.x = customModelFolder.add(params, 'customModelX', -2000.0, 2000.0, 0.5).name('Position X').onChange(v => {
        const model = loadedCustomModels[selectedModelIndex];
        if (model) {
            model.userData.offsetX = v;
            if (window.updateCustomModelTransform) window.updateCustomModelTransform(model);
        }
    });
    customModelControllers.z = customModelFolder.add(params, 'customModelZ', -2000.0, 2000.0, 0.5).name('Position Z').onChange(v => {
        const model = loadedCustomModels[selectedModelIndex];
        if (model) {
            model.userData.offsetZ = v;
            if (window.updateCustomModelTransform) window.updateCustomModelTransform(model);
        }
    });
    customModelControllers.rot = customModelFolder.add(params, 'customModelRot', 0, 360, 5).name('Rotation Y').onChange(v => {
        const model = loadedCustomModels[selectedModelIndex];
        if (model) {
            model.userData.rotationY = v * Math.PI / 180;
            if (window.updateCustomModelTransform) window.updateCustomModelTransform(model);
        }
    });

    customModelFolder.add({ cloneModel: () => {
        if (window.cloneSelectedModel) window.cloneSelectedModel();
    }}, 'cloneModel').name('Clone Selected');

    customModelFolder.add({ deleteModel: () => {
        if (window.deleteSelectedModel) window.deleteSelectedModel();
    }}, 'deleteModel').name('Delete Selected');

    // Flight Models Folder
    flightFolder = gui.addFolder('Flight Models');
    const flightModelOptions = {};
    FLIGHT_MODELS.forEach(m => {
        flightModelOptions[m.name] = m.id;
    });
    const flightParams = {
        modelId: 'kiki',
        animSpeed: 1.0,
        nextModel: () => { if (typeof flightModelManager !== 'undefined' && flightModelManager) flightModelManager.nextModel(); },
        prevModel: () => { if (typeof flightModelManager !== 'undefined' && flightModelManager) flightModelManager.prevModel(); }
    };
    flightModelDropdownController = flightFolder.add(flightParams, 'modelId', flightModelOptions)
        .name('Active Model')
        .onChange(id => {
            if (typeof flightModelManager !== 'undefined' && flightModelManager) {
                const cur = flightModelManager.getCurrentConfig();
                if (!cur || cur.id !== id) {
                    flightModelManager.setModelById(id);
                }
            }
        });
    flightFolder.add(flightParams, 'nextModel').name('Next Model');
    flightFolder.add(flightParams, 'prevModel').name('Previous Model');
    flightFolder.add(params, 'modelVisible').name('Model Visible').onChange(v => {
        isModelVisible = v;
        updateModelVisibility();
    });
    flightFolder.add(flightParams, 'animSpeed', 0.1, 3.0, 0.1).name('Anim Speed').onChange(v => {
        if (typeof flightModelManager !== 'undefined' && flightModelManager) flightModelManager.setAnimSpeed(v);
    });

    // Audio & Sound Folder
    audioFolder = gui.addFolder('Audio & Sound');
    const audioParams = {
        soundEnabled: true,
        engineSound: true,
        engineVolume: 0.038,
        music: false,
        autoAdvance: true,
        currentTrack: tracks[0].name,
        nextTrack: () => {
            if (typeof selectMusicTrack === 'function') {
                selectMusicTrack(currentTrack + 1);
            } else {
                document.getElementById('track-toggle')?.click();
            }
        },
        wind: isWindOn,
        toggleMasterSound: () => { if (typeof setSoundMuted === 'function') setSoundMuted(!isSoundMuted); },
        toggleEngineSound: () => { if (typeof setEngineSoundEnabled === 'function') setEngineSoundEnabled(!isEngineSoundOn); }
    };
    soundMuteController = audioFolder.add(audioParams, 'soundEnabled')
        .name('Sound Enabled')
        .onChange(v => {
            if (typeof setSoundMuted === 'function' && isSoundMuted !== !v) {
                setSoundMuted(!v);
            }
        });
    engineSoundController = audioFolder.add(audioParams, 'engineSound')
        .name('Biplane Engine Sound')
        .onChange(v => {
            if (typeof setEngineSoundEnabled === 'function' && isEngineSoundOn !== !!v) {
                setEngineSoundEnabled(v);
            }
        });
    audioFolder.add(audioParams, 'engineVolume', 0.0, 0.2, 0.005)
        .name('Engine Volume')
        .onChange(v => {
            if (typeof biplaneAudio !== 'undefined' && biplaneAudio) biplaneAudio.setVolume(v);
        });
    audioFolder.add(audioParams, 'music').name('Music').onChange(v => {
        const btn = document.getElementById('music-toggle');
        if (btn) btn.click();
    });
    audioFolder.add(audioParams, 'autoAdvance').name('Auto-Advance Songs').onChange(v => {
        isAutoAdvance = !!v;
    });
    trackDropdownController = audioFolder.add(audioParams, 'currentTrack', tracks.map(t => t.name))
        .name('Current Track')
        .onChange(name => {
            const idx = tracks.findIndex(t => t.name === name);
            if (idx !== -1 && idx !== currentTrack && typeof selectMusicTrack === 'function') {
                selectMusicTrack(idx);
            }
        });
    audioFolder.add(audioParams, 'nextTrack').name('Next Track');
    audioFolder.add(params, 'wind').name('Wind Sound').onChange(v => {
        isWindOn = v;
    });
    audioFolder.add(audioParams, 'toggleMasterSound').name('Toggle Master Sound');
    audioFolder.add(audioParams, 'toggleEngineSound').name('Toggle Engine Sound');

    // Ghibli Trees GUI Folder
    const ghibliTreeFolder = gui.addFolder('Ghibli Trees');
    ghibliTreeFolder.add(params, 'showTrees').name('Trees Visible').onChange(v => {
        if (typeof treeMeshes !== 'undefined') treeMeshes.forEach(m => m.visible = v);
        if (window.instJungleTreeParts) window.instJungleTreeParts.forEach(m => m.visible = v);
        if (window.instPalmTreeParts) window.instPalmTreeParts.forEach(m => m.visible = v);
    });
    // These drive BOTH tree systems: the legacy instanced pines AND the Background Tree Atlas
    // trees. Wiring only the pines is what made "Tree Scale" look dead -- the trees actually on
    // screen in Ghibli Land are the atlas ones.
    const _bgTrees = () => window.ghibliTrees;

    ghibliTreeFolder.add(params, 'ghibliTreeScale', 0.2, 3.5, 0.05).name('Tree Scale').onChange(v => {
        if (typeof window.updateGhibliTreeScale === 'function') window.updateGhibliTreeScale(v);
        const t = _bgTrees();
        if (t) { t.scaleMul = v; t.respawn(); }
    });
    ghibliTreeFolder.add(params, 'ghibliTreeDensity', 0.1, 3.0, 0.05).name('Tree Density').onChange(v => {
        if (typeof window.respawnGhibliTrees === 'function') window.respawnGhibliTrees();
        const t = _bgTrees();
        if (t) { t.density = v; t.respawn(); }
    });
    ghibliTreeFolder.add(params, 'ghibliTreeMinDist', 6.0, 30.0, 0.5).name('Min Spacing').onChange(v => {
        if (typeof window.respawnGhibliTrees === 'function') window.respawnGhibliTrees();
        // Cell size IS the spacing guarantee for the atlas trees, so this maps directly.
        const t = _bgTrees();
        if (t && typeof t.setCellSize === 'function') t.setCellSize(v * 2.4);
    });
    ghibliTreeFolder.add(params, 'ghibliTreeMinHeight', 0.0, 40.0, 0.5).name('Elevation Min').onChange(v => {
        if (typeof window.respawnGhibliTrees === 'function') window.respawnGhibliTrees();
        const t = _bgTrees();
        if (t) { t.minElevation = v; t.respawn(); }
    });
    ghibliTreeFolder.add(params, 'ghibliTreeMaxHeight', 25.0, 120.0, 1.0).name('Elevation Max').onChange(v => {
        if (typeof window.respawnGhibliTrees === 'function') window.respawnGhibliTrees();
        const t = _bgTrees();
        if (t) { t.maxElevation = v; t.respawn(); }
    });
    ghibliTreeFolder.add(params, 'ghibliTreeWindSway', 0.0, 3.0, 0.1).name('Wind Sway').onChange(v => {
        if (typeof treeUniforms !== 'undefined' && treeUniforms && treeUniforms.uTreeScale) {
            treeUniforms.uTreeScale.value = 1.5 * v;
        }
        const t = _bgTrees();
        if (t) t.uWindStrength.value = v;
    });
    ghibliTreeFolder.add({ respawn: () => {
        if (typeof window.respawnGhibliTrees === 'function') window.respawnGhibliTrees();
        if (window.ghibliTrees) window.ghibliTrees.respawn();
    }}, 'respawn').name('Respawn Trees');

    // ---- Background Tree Atlas (the three Ghibli card trees) ----
    // Separate subfolder so these do not collide with the legacy pine controls above.
    const bgTreeParams = {
        visible: true,
        density: 1.0,
        scale: 1.0,
        elevMin: 6.8,
        elevMax: 58.0,
        maxSlope: 0.55,
        wind: 1.0,
        atlasMix: 0.75,
        tintSpread: 0.18,
        canopyShadow: '#2c5233',
        canopyLit: '#6aa34a',
        canopyTip: '#9ec96a',
        trunkBase: '#3d2b1c',
        trunkTop: '#6b4c33',
        counts: '—'
    };
    const bgTreeFolder = ghibliTreeFolder.addFolder('Background Tree Atlas');
    const _tsys = () => window.ghibliTrees;
    const _respawnBg = () => { if (_tsys()) _tsys().respawn(); };

    // Scale / Density / Elevation / Wind live on the PARENT folder and drive both tree
    // systems. Only atlas-specific controls belong here, so there is exactly one slider
    // per concept.
    bgTreeFolder.add(bgTreeParams, 'visible').name('Visible').onChange(v => { if (_tsys()) _tsys().setVisible(v); });
    bgTreeFolder.add(bgTreeParams, 'maxSlope', 0.1, 2.0, 0.05).name('Max Slope').onChange(v => { if (_tsys()) { _tsys().maxSlope = v; _respawnBg(); } });
    bgTreeFolder.add(bgTreeParams, 'atlasMix', 0.0, 1.0, 0.05).name('Texture vs Palette').onChange(v => { if (_tsys()) _tsys().uAtlasMix.value = v; });
    bgTreeFolder.add(bgTreeParams, 'tintSpread', 0.0, 0.6, 0.02).name('Per-Tree Variation').onChange(v => { if (_tsys()) _tsys().uTintSpread.value = v; });

    const bgColorFolder = bgTreeFolder.addFolder('Colors');
    bgColorFolder.addColor(bgTreeParams, 'canopyShadow').name('Canopy Shadow').onChange(v => { if (_tsys()) _tsys().setColor('canopyShadow', v); });
    bgColorFolder.addColor(bgTreeParams, 'canopyLit').name('Canopy Lit').onChange(v => { if (_tsys()) _tsys().setColor('canopyLit', v); });
    bgColorFolder.addColor(bgTreeParams, 'canopyTip').name('Canopy Tip').onChange(v => { if (_tsys()) _tsys().setColor('canopyTip', v); });
    bgColorFolder.addColor(bgTreeParams, 'trunkBase').name('Trunk Base').onChange(v => { if (_tsys()) _tsys().setColor('trunkBase', v); });
    bgColorFolder.addColor(bgTreeParams, 'trunkTop').name('Trunk Top').onChange(v => { if (_tsys()) _tsys().setColor('trunkTop', v); });

    // Live instance readout, for tuning density against the frame budget
    const bgCountCtrl = bgTreeFolder.add(bgTreeParams, 'counts').name('Instances (N/M/F)').disable();
    setInterval(() => {
        const t = _tsys();
        if (!t || !bgCountCtrl) return;
        const c = t.lastCounts;
        bgTreeParams.counts = `${c.near} / ${c.mid} / ${c.far}`;
        bgCountCtrl.updateDisplay();
    }, 700);

    function setGodMode(enabled) {
        const target = typeof enabled === 'boolean' ? enabled : !isGodMode;
        if (isGodMode === target) return;
        isGodMode = target;
        params.godMode = isGodMode;

        if (isGodMode) {
            if (typeof params !== 'undefined') {
                params.groundFog = false;
                params.godRays = false;
                if (typeof isWindTrailsOn !== 'undefined') params.trails = false;
                params.wind = false;
                params.rain = false;
                params.sceneFog = false;
                params.showClouds = false;
            }
            // Automatically hide ALL cloud layers in God Mode
            if (typeof instClouds !== 'undefined') instClouds.visible = false;
            if (typeof instHighClouds !== 'undefined') instHighClouds.visible = false;
            if (typeof instWispyClouds !== 'undefined') instWispyClouds.visible = false;
            if (typeof instMegaClouds !== 'undefined') instMegaClouds.visible = false;
            if (typeof toonCloudMat !== 'undefined' && toonCloudMat.uniforms && toonCloudMat.uniforms.uEnableClouds) toonCloudMat.uniforms.uEnableClouds.value = 0.0;

            if (typeof scene !== 'undefined' && scene.fog) { scene.fog.near = 100000; scene.fog.far = 200000; }
            if (typeof groundFog !== 'undefined') groundFog.visible = false;
            if (typeof godRaysGroup !== 'undefined') godRaysGroup.visible = false;
            if (typeof windTrailsGroup !== 'undefined') windTrailsGroup.visible = false;
            
            if (typeof debugFolder !== 'undefined') debugFolder.open();
            if (typeof envFolder !== 'undefined') envFolder.open();
            isFlightPaused = true;
            const pauseToggle = document.getElementById('pause-toggle');
            if (pauseToggle) pauseToggle.innerText = '▶';

            if (!godCamera) {
                const gm = setupGodMode(scene, cameraBase, renderer, playerGrp);
                godCamera = gm.godCamera;
                godControls = gm.godControls;
            }
            const curWaterY = (animeWaterSystem && animeWaterSystem.waterLevel !== undefined) ? animeWaterSystem.waterLevel : 2.4;
            toggleGodMode(isGodMode, godCamera, camera, godControls, playerGrp, (cam) => {
                if (typeof scenePass !== 'undefined' && scenePass) scenePass.camera = cam;
            }, curWaterY);
        } else {
            if (typeof params !== 'undefined') {
                params.showClouds = true;
            }
            if (typeof instClouds !== 'undefined') instClouds.visible = true;
            if (typeof instHighClouds !== 'undefined') instHighClouds.visible = true;
            if (typeof instWispyClouds !== 'undefined') instWispyClouds.visible = true;
            if (typeof instMegaClouds !== 'undefined') instMegaClouds.visible = true;
            if (typeof toonCloudMat !== 'undefined' && toonCloudMat.uniforms && toonCloudMat.uniforms.uEnableClouds) toonCloudMat.uniforms.uEnableClouds.value = 1.0;

            const curWaterY = (animeWaterSystem && animeWaterSystem.waterLevel !== undefined) ? animeWaterSystem.waterLevel : 2.4;
            toggleGodMode(isGodMode, godCamera, camera, godControls, playerGrp, (cam) => {
                if (typeof scenePass !== 'undefined' && scenePass) scenePass.camera = cam;
            }, curWaterY);
        }

        const btn = document.getElementById('god-mode-btn');
        if (btn) {
            btn.innerText = '▲';
            btn.style.color = isGodMode ? '#ff4444' : 'rgba(255, 255, 255, 0.95)';
            btn.style.textShadow = isGodMode ? '0 0 10px rgba(255, 68, 68, 0.9), 0 1px 3px rgba(0, 0, 0, 0.5)' : '0 1px 3px rgba(0, 0, 0, 0.35), 0 0 8px rgba(0, 0, 0, 0.2)';
            btn.style.transform = isGodMode ? 'scale(1.15)' : 'scale(1.0)';
            btn.title = isGodMode ? 'God Mode: ON (Free Camera Active) [G]' : 'Toggle God Mode (Free Camera) [G]';
        }

        if (typeof gui !== 'undefined' && gui) {
            gui.controllersRecursive().forEach(c => {
                if (c.property === 'godMode') c.updateDisplay();
            });
        }
    }
    window.setGodMode = setGodMode;

    function setAllFogEnabled(enabled) {
        params.showFog = enabled;
        params.sceneFog = enabled;
        if (!enabled) {
            if (typeof scene !== 'undefined' && scene.fog) {
                scene.fog.near = 100000;
                scene.fog.far = 200000;
            }
            if (typeof window.fogGroup !== 'undefined') {
                window.fogGroup.visible = false;
            }
            if (typeof groundFog !== 'undefined') {
                groundFog.visible = false;
            }
        } else {
            if (typeof scene !== 'undefined' && scene.fog && typeof playerGrp !== 'undefined' && playerGrp.position) {
                const dynamicFar = (800 + Math.max(0, playerGrp.position.y - 300.0) * 2.2) / (params.fogIntensity || 3.5);
                const dynamicNear = (10 + Math.max(0, playerGrp.position.y - 300.0) * 0.4) / (params.fogIntensity || 3.5);
                scene.fog.near = dynamicNear;
                scene.fog.far = dynamicFar;
            }
            if (typeof window.fogGroup !== 'undefined') {
                window.fogGroup.visible = params.showFogPlanes;
            }
        }

        if (typeof gui !== 'undefined' && gui) {
            gui.controllersRecursive().forEach(c => {
                if (c.property === 'sceneFog' || c.property === 'showFog') {
                    c.updateDisplay();
                }
            });
        }
    }
    window.setAllFogEnabled = setAllFogEnabled;

    const debugFolder = gui.addFolder('Debug Render');
    debugFolder.add(params, 'godMode').name('God Mode (Free Cam) [G]').listen().onChange(v => setGodMode(v));
    debugFolder.add(params, 'showProceduralSky').name('Procedural Sky').onChange(v => {
        if (typeof window.setSkyRenderMode === 'function') {
            if (!v) {
                window.setSkyRenderMode('Flat Solid');
            } else {
                window.setSkyRenderMode(params.enableProceduralClouds ? 'Gradient + Clouds' : 'Gradient Regular');
            }
        }
    });
    debugFolder.add(params, 'skyRenderMode', ['Gradient + Clouds', 'Gradient Regular', 'Flat Solid'])
        .name('Sky Mode')
        .onChange(v => {
            if (typeof window.setSkyRenderMode === 'function') window.setSkyRenderMode(v);
        });

    debugFolder.add(params, 'showTerrain').name('Terrain').onChange(v => { terrain.visible = v; });

    debugFolder.add(params, 'showWater').name('Ocean Visible').onChange(v => {
        if (animeWaterSystem) animeWaterSystem.setVisible(v);
    });

    debugFolder.add(params, 'showTrees').name('Trees').onChange(v => { treeMeshes.forEach(m => m.visible = v); if(typeof instBillboardTrees !== 'undefined') instBillboardTrees.visible = false; if(typeof instJungleBillboardTrees !== 'undefined') instJungleBillboardTrees.visible = false; if(window.instJungleTreeParts) window.instJungleTreeParts.forEach(m => m.visible = v); if(window.instPalmTreeParts) window.instPalmTreeParts.forEach(m => m.visible = v); });
    function updateCloudScale(instMesh, newMulti, oldMulti) {
        if (typeof instMesh === 'undefined') return;
        const ratio = newMulti / oldMulti;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < instMesh.count; i++) {
            instMesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
            dummy.scale.multiplyScalar(ratio);
            dummy.updateMatrix();
            instMesh.setMatrixAt(i, dummy.matrix);
        }
        instMesh.instanceMatrix.needsUpdate = true;
    }
    debugFolder.add(params, 'showFog').name('All Fog').listen().onChange(v => setAllFogEnabled(v));
    debugFolder.add(params, 'showFogPlanes').name('Fog Planes').listen().onChange(v => { if(typeof window.fogGroup !== 'undefined') window.fogGroup.visible = v; });
    debugFolder.add(params, 'showBirds').name('Birds').onChange(v => { if(typeof instBirds !== 'undefined') instBirds.visible = v; if(typeof flockGrp !== 'undefined') flockGrp.visible = v; });
    debugFolder.add(params, 'showCrystals').name('Crystals').onChange(v => { instCrystals.visible = v; });

    const shadingFolder = debugFolder.addFolder('Shade Mode');
    shadingFolder.add(params, 'shadeMode', ['original', 'cel', 'flat'])
        .name('Mode (1/2/3)')
        .onChange(v => toonShaderManager.apply(scene, v));

    debugFolder.add(params, 'showMap').name('World Map').onChange(v => { const el = document.getElementById('world-map'); if(el) el.style.display = v ? 'block' : 'none'; });

    // Bird & Flock Settings
    const birdFolder = debugFolder.addFolder('Bird & Flock Settings');
    params.birdCount = LOW_GFX ? 12 : 40;
    params.birdScale = 0.42;
    params.birdColor = '#d6e5f5';
    params.birdFlockRadius = 22;
    params.birdFlockSpread = 9;
    params.birdMaxSpeed = 35;

    birdFolder.add(params, 'birdCount', 0, 120, 1).name('Bird Count').onChange(v => {
        instBirds.count = Math.min(v, MAX_BIRD_COUNT);
        instBirds.instanceMatrix.needsUpdate = true;
    });
    birdFolder.add(params, 'birdScale', 0.1, 2.0, 0.05).name('Bird Size');
    birdFolder.addColor(params, 'birdColor').name('Bird Color').onChange(v => {
        matBird.color.set(v);
    });
    birdFolder.add(params, 'birdFlockRadius', 5, 80, 1).name('Flock Radius');
    birdFolder.add(params, 'birdFlockSpread', 1, 30, 1).name('Flock Spread');
    birdFolder.add(params, 'birdMaxSpeed', 10, 80, 1).name('Max Speed');
    birdFolder.close();
    
    function teleportToBiome(biomeName) {
        if (typeof playerGrp === 'undefined') return;
        
        const zn = ZONES.find(z => z.name === biomeName);
        if (!zn) return;

        // Smart Search for Islands Mode
        const SEARCH_STEP = 14000;
        let radius = 0;
        let found = false;
        let targetX = playerGrp.position.x, targetZ = playerGrp.position.z;
        
        while (!found && radius < 120) {
            for (let x = -radius; x <= radius; x++) {
                for (let z = -radius; z <= radius; z++) {
                    if (Math.max(Math.abs(x), Math.abs(z)) !== radius) continue; // Only search outer edge ring
                    
                    const sampleX = playerGrp.position.x + x * SEARCH_STEP;
                    const sampleZ = playerGrp.position.z + z * SEARCH_STEP;
                    const data = getIslandData(sampleX, sampleZ);
                    
                    if (data.mask > 0.2 && data.mainBiome.name === biomeName) {
                        targetX = sampleX;
                        targetZ = sampleZ;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            radius++;
        }
        playerGrp.position.set(targetX, 100, targetZ);
        
        lastTerrainGridX = -9999;
        lastTerrainGridZ = -9999;
        
        if (typeof navParams !== 'undefined' && typeof navFolder !== 'undefined') {
            navParams.biome = biomeName;
            navFolder.controllersRecursive().forEach(c => c.updateDisplay());
        }
    }

    function toggleGUI(show) {
        const guiEl = document.querySelector('.lil-gui.root') || (gui && gui.domElement);
        if (!guiEl) return;
        
        const isDisplayNone = guiEl.style.display === 'none' || (typeof window !== 'undefined' && window.getComputedStyle(guiEl).display === 'none');
        const isAccordionClosed = guiEl.classList.contains('closed') || (gui && gui._closed);
        const isHeightZero = gui && gui.$children && (gui.$children.style.height === '0px' || (guiEl.style.display !== 'none' && gui.$children.clientHeight === 0));
        
        const shouldBeVisible = typeof show === 'boolean' ? show : (isDisplayNone || isAccordionClosed || isHeightZero);
        
        if (shouldBeVisible) {
            guiEl.style.display = '';
            guiEl.classList.remove('closed');
            guiEl.classList.remove('transition');
            if (gui) {
                gui._closed = false;
                if (gui.$children) gui.$children.style.height = '';
                if (gui.$title) gui.$title.setAttribute('aria-expanded', 'true');
                if (typeof gui.foldersRecursive === 'function') {
                    gui.foldersRecursive().forEach(f => {
                        if (f && f.domElement) f.domElement.classList.remove('transition');
                        if (f && f.$children && !f._closed) f.$children.style.height = '';
                    });
                }
            }
        } else {
            guiEl.style.display = 'none';
            guiEl.classList.remove('transition');
            if (gui && gui.$children) {
                gui.$children.style.height = '';
            }
        }
        params.showGUI = shouldBeVisible;
        
        const cogBtn = document.getElementById('gui-toggle-btn');
        if (cogBtn) {
            cogBtn.style.opacity = shouldBeVisible ? '1' : '0.85';
            cogBtn.style.transform = shouldBeVisible ? 'rotate(45deg)' : 'none';
        }
    }

    debugFolder.add(params, 'showGUI').name('Settings Panel').onChange(v => toggleGUI(v));
    debugFolder.add(params, 'godRays').name('God Rays').onChange(v => { godRaysPass.enabled = v; });
    debugFolder.add(params, 'godRayIntensity', 0, 2, 0.05).name('Ray Intensity').onChange(v => { godRaysPass.uniforms.uIntensity.value = v; });

    const guiToggleBtn = document.getElementById('gui-toggle-btn');
    if (guiToggleBtn) {
        guiToggleBtn.addEventListener('click', () => toggleGUI());
    }
    toggleGUI(false);

    function openOceanInGui() {
        toggleGUI(true);
        if (animeWaterGUI && animeWaterGUI.gui) {
            animeWaterGUI.gui.open();
            animeWaterGUI.gui.domElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    const oceanToggleBtn = document.getElementById('ocean-toggle-btn');
    if (oceanToggleBtn) {
        oceanToggleBtn.addEventListener('click', openOceanInGui);
    }

    window.addEventListener('keydown', (e) => {
        if ((e.key === 'o' || e.key === 'O') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            if (window.waterModalUI) window.waterModalUI.toggle();
            else openOceanInGui();
        }
        if ((e.key === 'g' || e.key === 'G') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            setGodMode();
        }
    });

    // Shade mode hotkeys: 1=original, 2=hard cel, 3=flat/gouache
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const modeMap = { '1': 'original', '2': 'cel', '3': 'flat' };
        if (modeMap[e.key]) {
            params.shadeMode = modeMap[e.key];
            toonShaderManager.apply(scene, params.shadeMode);
            gui.controllersRecursive().forEach(c => { if (c.property === 'shadeMode') c.updateDisplay(); });
        }
    });

    const fsToggleBtn = document.getElementById('fullscreen-toggle');
    const topFullscreenBtn = document.getElementById('top-fullscreen-btn');

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.body.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    if (fsToggleBtn) {
        fsToggleBtn.addEventListener('click', toggleFullscreen);
    }
    if (topFullscreenBtn) {
        topFullscreenBtn.addEventListener('click', toggleFullscreen);
    }

    document.addEventListener('fullscreenchange', () => {
        const isFS = !!document.fullscreenElement;
        if (fsToggleBtn) {
            fsToggleBtn.innerText = isFS ? '🗵' : '⛶';
        }
        if (topFullscreenBtn) {
            topFullscreenBtn.innerText = isFS ? '🗵' : '⛶';
        }
    });

    const sparkleBtn = document.getElementById('sparkle-btn');
    if (sparkleBtn) {
        sparkleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const charBtn = document.getElementById('char-toggle');
            if (charBtn) charBtn.click();
            sparkleBtn.style.transform = 'scale(1.3) rotate(45deg)';
            setTimeout(() => {
                sparkleBtn.style.transform = '';
            }, 250);
        });
    }
    
    // Mobile Drawer Event Handlers
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const drawerMusicBtn = document.getElementById('drawer-music-btn');
    const drawerGodBtn = document.getElementById('drawer-god-btn');
    const normalGodBtn = document.getElementById('god-mode-btn');
    const musicToggleBtn = document.getElementById('music-toggle');
    
    if (mobileMenuBtn && mobileDrawer) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileDrawer.classList.toggle('open');
            mobileMenuBtn.innerText = mobileDrawer.classList.contains('open') ? '✕' : '⚙️';
        });

        document.addEventListener('click', (e) => {
            if (mobileDrawer.classList.contains('open') && !mobileDrawer.contains(e.target) && e.target !== mobileMenuBtn) {
                mobileDrawer.classList.remove('open');
                mobileMenuBtn.innerText = '⚙️';
            }
        });
    }

    if (drawerMusicBtn && musicToggleBtn) {
        setTimeout(() => {
            drawerMusicBtn.innerText = musicToggleBtn.innerText;
        }, 1000);

        drawerMusicBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            musicToggleBtn.click();
            setTimeout(() => {
                drawerMusicBtn.innerText = musicToggleBtn.innerText;
            }, 50);
        });
    }

    if (drawerGodBtn) {
        setTimeout(() => {
            const isGod = isGodMode;
            drawerGodBtn.innerText = isGod ? 'God Mode: ON' : 'God Mode: OFF';
            drawerGodBtn.style.color = isGod ? '#ff4444' : '#ffaa00';
        }, 1000);

        drawerGodBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setGodMode();
            setTimeout(() => {
                const isGod = isGodMode;
                drawerGodBtn.innerText = isGod ? 'God Mode: ON' : 'God Mode: OFF';
                drawerGodBtn.style.color = isGod ? '#ff4444' : '#ffaa00';
            }, 50);
        });
    }
    

    
    document.getElementById('pause-toggle').addEventListener('click', () => {
        isFlightPaused = !isFlightPaused;
        document.getElementById('pause-toggle').innerText = isFlightPaused ? '▶' : '⏸';
    });

    if (normalGodBtn) {
        normalGodBtn.addEventListener('click', () => {
            setGodMode();
        });
    }



    const clickRaycaster = new THREE.Raycaster();
    const clickMouse = new THREE.Vector2();



    const trailsToggleBtn = document.getElementById('trails-toggle');
    if (trailsToggleBtn) {
        trailsToggleBtn.addEventListener('click', () => {
            isWindTrailsOn = !isWindTrailsOn;
            trailsToggleBtn.innerText = `Wind Trails: ${isWindTrailsOn ? 'ON' : 'OFF'}`;
        });
    }
    


    window.addEventListener('wheel', (e) => {
        if ((window.editorState && window.editorState.isEditorMode) || isGodMode) return;
        cameraZoomDist += Math.sign(e.deltaY) * 4.0;
        cameraZoomDist = Math.max(5.0, Math.min(300.0, cameraZoomDist));
        if (cameraManager) cameraManager.setZoom(cameraZoomDist);
        localStorage.setItem('wl_zoomDist', cameraZoomDist);
    }, { passive: true });
    


    // ==========================================
    // 1. CORE SETUP & TOON RENDERER
    // ==========================================
    



    initPostProcessingUI();
    godRaysPass.uniforms.uIntensity.value = params.godRayIntensity;
    
    // 2. LIGHTING
    // ==========================================
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);


    // ==========================================
    // GIANT FLOATING CRYSTALS (Instanced)
    // ==========================================
    const CRYSTAL_COUNT = 8;
    const geoCrystal = new THREE.OctahedronGeometry(1, 1).toNonIndexed();
    geoCrystal.scale(1, 3, 1);
    geoCrystal.computeVertexNormals();

    const matCrystal = new MeshStandardNodeMaterial({
        roughness: 0.08,
        metalness: 0.15,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
    });

    const uCrystalGlow = uniform(0.0);
    const uBaseGlow = uniform(1.8);
    const uNightGlowMult = uniform(1.5);

    matCrystal.colorNode = Fn(() => {
        const tC = clamp(positionLocal.y.add(3.0).div(6.0), 0.0, 1.0);
        const col1 = vec3(0.42, 0.0, 1.0);
        const col2 = vec3(1.0, 0.0, 0.4);
        const col3 = vec3(0.0, 0.85, 1.0);
        const grad = mix(mix(col1, col2, tC), col3, tC);
        
        // Fresnel rim glow
        const viewDir = normalize(cameraPosition.sub(positionWorld));
        const fresnel = pow(float(1.0).sub(abs(dot(viewDir, normalWorld))), 3.0);
        return vec4(mix(grad, vec3(1.0), fresnel.mul(0.5)), 1.0);
    })();

    matCrystal.emissiveNode = Fn(() => {
        const viewDir = normalize(cameraPosition.sub(positionWorld));
        const fresnel = pow(float(1.0).sub(abs(dot(viewDir, normalWorld))), 3.0);
        const innerGlow = fresnel.mul(0.4).add(0.15);
        return vec3(0.6, 0.2, 1.0).mul(uBaseGlow.mul(innerGlow).add(uCrystalGlow.mul(uNightGlowMult)));
    })();

    const instCrystals = new THREE.InstancedMesh(geoCrystal, matCrystal, CRYSTAL_COUNT);
    instCrystals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instCrystals.frustumCulled = false;
    instCrystals.visible = false;
    scene.add(instCrystals);
    
    // Position them far away initially so they don't pop in at 0,0,0
    const dummyC = new THREE.Object3D();
    for(let i=0; i<CRYSTAL_COUNT; i++) {
        dummyC.position.set(0, -9999, 0);
        dummyC.updateMatrix();
        instCrystals.setMatrixAt(i, dummyC.matrix);
    }
    instCrystals.instanceMatrix.needsUpdate = true;

    // Crystal Editor UI Hooks
    const getElem = (id) => document.getElementById(id);
    if (getElem('c-roughness')) {
        getElem('c-roughness').addEventListener('input', (e) => matCrystal.roughness = parseFloat(e.target.value));
        getElem('c-metalness').addEventListener('input', (e) => matCrystal.metalness = parseFloat(e.target.value));
        getElem('c-transmission').addEventListener('input', (e) => matCrystal.transmission = parseFloat(e.target.value));
        getElem('c-thickness').addEventListener('input', (e) => matCrystal.thickness = parseFloat(e.target.value));
        getElem('c-fly-opacity').addEventListener('input', (e) => matCrystal.opacity = parseFloat(e.target.value));

        getElem('c-fly-hue').addEventListener('input', (e) => {
            if(matCrystal.userData.shader) matCrystal.userData.shader.uniforms.flyHue.value = parseFloat(e.target.value);
        });
        getElem('c-fly-contrast').addEventListener('input', (e) => {
            if(matCrystal.userData.shader) matCrystal.userData.shader.uniforms.flyContrast.value = parseFloat(e.target.value);
        });
        getElem('c-baseGlow').addEventListener('input', (e) => {
            if(matCrystal.userData.shader) matCrystal.userData.shader.uniforms.baseGlow.value = parseFloat(e.target.value);
        });
        getElem('c-nightGlow').addEventListener('input', (e) => {
            if(matCrystal.userData.shader) matCrystal.userData.shader.uniforms.nightGlowMult.value = parseFloat(e.target.value);
        });

        function updateCrystalColors() {
            if (matCrystal.userData.shader && matCrystal.userData.shader.uniforms.uCustomColors) {
                const flyColors = [
                    getElem('c-f-col0').value, getElem('c-f-col1').value,
                    getElem('c-f-col2').value, getElem('c-f-col3').value,
                    getElem('c-f-col4').value, getElem('c-f-col5').value
                ];
                for(let i=0; i<6; i++) {
                    matCrystal.userData.shader.uniforms.uCustomColors.value[i].set(flyColors[i]);
                }
            }
        }
        for(let i=0; i<6; i++) {
            if(getElem('c-f-col'+i)) getElem('c-f-col'+i).addEventListener('input', updateCrystalColors);
        }
    }


    const dirLight = new THREE.DirectionalLight(0xfffaeb, 1.4); // warm bright sunlight
    dirLight.position.set(150, 200, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    dirLight.shadow.camera.top = 120;
    dirLight.shadow.camera.bottom = -120;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.002;
    dirLight.shadow.normalBias = 1.5;
    scene.add(dirLight);

    // Sun Glare (Lensflare)
    const staticSun = new THREE.Group();
    staticSun.position.set(0, 1500, -20000); // Massive distance so Kiki can fly towards it
    scene.add(staticSun);

    const flareTextureLoader = new THREE.TextureLoader();
    const textureFlare0 = flareTextureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/lensflare/lensflare0.png');
    const textureFlare3 = flareTextureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/lensflare/lensflare3.png');
    const lensflare = new LensflareMesh();
    lensflare.addElement(new LensflareElement(textureFlare0, 1600, 0, dirLight.color)); // Massive permanent horizon glare
    lensflare.addElement(new LensflareElement(textureFlare3, 60, 0.6));
    lensflare.addElement(new LensflareElement(textureFlare3, 70, 0.7));
    lensflare.addElement(new LensflareElement(textureFlare3, 120, 0.9));
    lensflare.addElement(new LensflareElement(textureFlare3, 70, 1.0));
    staticSun.add(lensflare);

    // Physical Sun Sphere
    const sunGeo = new THREE.SphereGeometry(600, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }); // fog: false makes it glow through atmosphere
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    staticSun.add(sunMesh);

    // Glowing 3D Moon Sphere & Atmospheric Halo
    const staticMoon = new THREE.Group();
    scene.add(staticMoon);
    const moonGeo = new THREE.SphereGeometry(450, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeffff, fog: false });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    staticMoon.add(moonMesh);

    const haloGeo = new THREE.SphereGeometry(650, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x88c8ff, transparent: true, opacity: 0.3, fog: false, side: THREE.BackSide });
    const moonHalo = new THREE.Mesh(haloGeo, haloMat);
    staticMoon.add(moonHalo);



    // ==========================================
    // 3. TOON MATERIALS
    // ==========================================
    const gradientColors = new Uint8Array([
        160, 160, 160, 255, // Shadows
        255, 255, 255, 255  // Light
    ]);
    const gradientMap = new THREE.DataTexture(gradientColors, 2, 1, THREE.RGBAFormat);
    gradientMap.needsUpdate = true;
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.generateMipmaps = false;

    const matRock = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, dithering: true });
    const matBush = new THREE.MeshToonMaterial({ color: 0x48a868, gradientMap, dithering: true });
    const matCloud = new THREE.MeshToonMaterial({ color: 0xfffaec, transparent: true, opacity: 0.65, gradientMap, dithering: true });
    const matWispyCloud = new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, gradientMap, dithering: true });
    const matFlower = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, dithering: true });
    function createSandNoiseTexture(size = 256) {
        const data = new Uint8Array(size * size * 4);
        for (let i = 0; i < size * size * 4; i += 4) {
            const v = Math.floor(Math.random() * 256);
            data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
        }
        const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    }
    const sandNoiseMap = createSandNoiseTexture(256);

    const terrainUniforms = {
        uTime: uniform(0),
        uSunDir: uniform(new THREE.Vector3(0.3, 0.8, 0.5)),
        uSandNoiseMap: texture(sandNoiseMap),
        uShimmerMult: uniform(1.0)
    };

    const terrainMat = createTerrainMaterial(
        terrainUniforms.uTime,
        terrainUniforms.uSunDir,
        terrainUniforms.uSandNoiseMap,
        terrainUniforms.uShimmerMult
    );
    const treeUniforms = {
        uPlayerPos: uniform(new THREE.Vector3(0, 0, 0)),
        uTreeScale: uniform(1.5)
    };
    window.treeUniforms = treeUniforms;
    
    const matTree = createTreeMaterial(
        terrainUniforms.uTime,
        terrainUniforms.uSunDir,
        treeUniforms.uTreeScale,
        gradientMap
    );







    // ==========================================
    // 5. TERRAIN MESH WITH VERTEX COLORS
    // ==========================================
    let terrainGeo = new THREE.PlaneGeometry(4000, 4000, terrainRes, terrainRes); 
    terrainGeo.rotateX(-Math.PI / 2);
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    scene.add(terrain);

    let lastTerrainGridX = -9999;
    let lastTerrainGridZ = -9999;
    let lastTerrainScale = 1.0;
    let terrainScale = 1.0;

    const colorDeepWater = new THREE.Color(0x1a4a8c);
    const colorShallowWater = new THREE.Color(0x4da9e8); // Matches the waterMesh exactly
    const colorSand = new THREE.Color(0xf2e1b8);
    const colorIslandGrass = new THREE.Color(0x76d149);
    const colorEmeraldGrass = new THREE.Color(0x56b847);
    const colorOliveGrass = new THREE.Color(0x8cc440);
    const colorHigh = new THREE.Color(0x89e05e); // Grass High
    const colorIslandRock = new THREE.Color(0x8a725a);
    const colorDirt = new THREE.Color(0xdcb58a); 
    const colorPath = new THREE.Color(0xbd9973); // dirt path color
    const tempColor = new THREE.Color();
    const patchColor = new THREE.Color();

    function smoothstep(edge0, edge1, x) {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    }

    function distToSegment(px, pz, ax, az, bx, bz) {
        const l2 = (ax - bx)**2 + (az - bz)**2;
        if (l2 === 0) return Math.hypot(px - ax, pz - az);
        let t = ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (ax + t * (bx - ax)), pz - (az + t * (bz - az)));
    }

    function getPathStrength(x, z) {
        const scale = 0.002;
        const n1 = snoise(x * scale, z * scale);
        const n2 = snoise(x * scale * 2 + 1000, z * scale * 2 + 1000) * 0.3;
        let path = Math.abs(n1 + n2);
        let mask = smoothstep(0.15, 0.0, path); // wider, softer path
        return mask;
    }

    // Hoisted: this was allocated fresh inside the per-vertex loop, 16,641 times per rebuild.
    const COLOR_FROST_PATH = new THREE.Color(0xd0edff);

    function updateTerrainGeometry(playerX, playerZ) {
        const stepThreshold = 150;
        if (Math.hypot(playerX - lastTerrainGridX, playerZ - lastTerrainGridZ) < stepThreshold) return;
        
        const gridX = Math.round(playerX / stepThreshold) * stepThreshold;
        const gridZ = Math.round(playerZ / stepThreshold) * stepThreshold;
        
        // Re-bake the water shoreline depth field over the same footprint.
        // Cheap here: the height sampling is amortised by tickDepthField() in the render loop.
        if (animeWaterSystem) animeWaterSystem.rebuildDepthField(gridX, gridZ);
        
        terrain.position.set(gridX, 0, gridZ);
        
        const pos = terrainGeo.attributes.position;
        if (!terrainGeo.attributes.color) {
            terrainGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
            terrainGeo.setAttribute('aBiomeType', new THREE.BufferAttribute(new Float32Array(pos.count), 1));
        }
        const colors = terrainGeo.attributes.color;
        const biomeTypes = terrainGeo.attributes.aBiomeType;
        const norm = terrainGeo.attributes.normal;

        for (let i = 0; i < pos.count; i++) {
            const worldX = pos.getX(i) + gridX;
            const worldZ = pos.getZ(i) + gridZ;
            const h = getWorldHeight(worldX, worldZ);
            pos.setY(i, h);

            // Fast analytical heightmap normals (avoids expensive computeVertexNormals triangle pass)
            const hL = getWorldHeight(worldX - 12, worldZ);
            const hR = getWorldHeight(worldX + 12, worldZ);
            const hD = getWorldHeight(worldX, worldZ - 12);
            const hU = getWorldHeight(worldX, worldZ + 12);
            tempVec1.set(hL - hR, 24.0, hD - hU).normalize();
            norm.setXYZ(i, tempVec1.x, tempVec1.y, tempVec1.z);

            // Single colour evaluation. This used to run TWICE per vertex with the first
            // result written to the buffer and then immediately overwritten — pure dead work
            // across 16,641 vertices, every rebuild.
            getWorldColor(h, worldX, worldZ, tempColor);

            // Add dirt / frost path
            const pathMask = getPathStrength(worldX, worldZ);
            const currentBiome = getBiomeAt(worldX, worldZ);
            
            let bType = 0.0;
            if (currentBiome && currentBiome.name) {
                if (currentBiome.name.includes('Desert')) bType = 1.0;
                else if (currentBiome.name.includes('North Pole')) bType = 2.0;
                else if (currentBiome.name.includes('Canyon')) bType = 3.0;
            }
            biomeTypes.setX(i, bType);

            if (pathMask > 0 && h > 2.0 && h < 25.0) {
                if (currentBiome && currentBiome.name && currentBiome.name.includes('North Pole')) {
                    tempColor.lerp(COLOR_FROST_PATH, pathMask * 0.35);
                } else if (!currentBiome || !currentBiome.name || (!currentBiome.name.includes('Crystal') && !currentBiome.name.includes('Ocean') && !currentBiome.name.includes('Desert') && !currentBiome.name.includes('Canyon'))) {
                    tempColor.lerp(colorPath, pathMask * 0.85);
                }
            }

            colors.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
        }
        
        pos.needsUpdate = true;
        colors.needsUpdate = true;
        biomeTypes.needsUpdate = true;
        norm.needsUpdate = true;
        
        lastTerrainGridX = gridX;
        lastTerrainGridZ = gridZ;
    }

    // ==========================================
    // 6. INSTANCED DIORAMA PROPS
    // ==========================================
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const ROCK_COUNT = 0;
    const BUSH_COUNT = 0;
    const FLOWER_COUNT = 0; // Optimized for FPS
    const TREE_MULT = 0.15; // Doubled tree count so entire landscape and horizon are filled with dense forests
    
    function applyColor(geometry, colorHex, isBark = false) {
        const color = new THREE.Color(colorHex);
        const colors = [];
        const count = geometry.attributes.position.count;
        for (let i = 0; i < count; i++) {
            colors.push(color.r, color.g, color.b);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const isBarkArr = new Float32Array(count);
        isBarkArr.fill(isBark ? 1.0 : 0.0);
        geometry.setAttribute('aIsBark', new THREE.BufferAttribute(isBarkArr, 1));
    }

    // Tree 1: Tall Pine with Organic Rounded Crown
    const t1Geos = [];
    const t1Trunk = new THREE.CylinderGeometry(0.35, 0.55, 2.5, 6);
    t1Trunk.translate(0, 1.25, 0);
    applyColor(t1Trunk, 0x4d3222, true);
    t1Geos.push(t1Trunk);
    for(let i=0; i<3; i++) {
        const cone = new THREE.ConeGeometry(2.4 - i*0.6, 2.8, 8);
        cone.translate(0, 3 + i*1.7, 0);
        applyColor(cone, i === 0 ? 0x194d22 : (i === 1 ? 0x236830 : 0x32853f), false);
        t1Geos.push(cone);
    }
    const t1Crown = new THREE.DodecahedronGeometry(1.0, 1);
    t1Crown.scale(1.0, 1.4, 1.0);
    t1Crown.translate(0, 8.2, 0);
    applyColor(t1Crown, 0x4ca84f, false);
    t1Geos.push(t1Crown);
    const geoTree1 = BufferGeometryUtils.mergeGeometries(t1Geos.map(g => g.index ? g.toNonIndexed() : g), false);

    // Tree 2: Wide Lush Cypress with Dome Top
    const t2Geos = [];
    const t2Trunk = new THREE.CylinderGeometry(0.45, 0.75, 2.2, 6);
    t2Trunk.translate(0, 1.1, 0);
    applyColor(t2Trunk, 0x4a2f1e, true);
    t2Geos.push(t2Trunk);
    for(let i=0; i<3; i++) {
        const cone = new THREE.ConeGeometry(3.2 - i*0.7, 3.0, 8);
        cone.translate(0, 2.6 + i*1.6, 0);
        applyColor(cone, i === 0 ? 0x15441e : (i === 1 ? 0x205e2a : 0x2d7c38), false);
        t2Geos.push(cone);
    }
    const t2Crown = new THREE.DodecahedronGeometry(1.2, 1);
    t2Crown.scale(1.1, 1.3, 1.1);
    t2Crown.translate(0, 7.8, 0);
    applyColor(t2Crown, 0x429944, false);
    t2Geos.push(t2Crown);
    const geoTree2 = BufferGeometryUtils.mergeGeometries(t2Geos.map(g => g.index ? g.toNonIndexed() : g), false);

    // Tree 3: Round Lush Pine with Rounded Tip
    const t3Geos = [];
    const t3Trunk = new THREE.CylinderGeometry(0.35, 0.55, 3.5, 6);
    t3Trunk.translate(0, 1.75, 0);
    applyColor(t3Trunk, 0x4a2f1e, true);
    t3Geos.push(t3Trunk);
    const t3Leaf1 = new THREE.ConeGeometry(2.6, 3.2, 8);
    t3Leaf1.translate(0, 4.0, 0);
    applyColor(t3Leaf1, 0x1a4f23, false);
    t3Geos.push(t3Leaf1);
    const t3Leaf2 = new THREE.ConeGeometry(2.0, 2.8, 8);
    t3Leaf2.translate(0, 5.8, 0);
    applyColor(t3Leaf2, 0x277435, false);
    t3Geos.push(t3Leaf2);
    const t3Crown = new THREE.DodecahedronGeometry(1.2, 1);
    t3Crown.scale(1.0, 1.3, 1.0);
    t3Crown.translate(0, 7.8, 0);
    applyColor(t3Crown, 0x3d9441, false);
    t3Geos.push(t3Crown);
    const geoTree3 = BufferGeometryUtils.mergeGeometries(t3Geos.map(g => g.index ? g.toNonIndexed() : g), false);

    // Tree 4: Rich Emerald Pine with Crown Dome
    const t4Geos = [];
    const t4Trunk = new THREE.CylinderGeometry(0.35, 0.65, 3.0, 6);
    t4Trunk.translate(0, 1.5, 0);
    applyColor(t4Trunk, 0x462d1d, true);
    t4Geos.push(t4Trunk);
    const t4Leaf1 = new THREE.ConeGeometry(2.8, 3.0, 8);
    t4Leaf1.translate(0, 3.6, 0);
    applyColor(t4Leaf1, 0x14401c, false);
    t4Geos.push(t4Leaf1);
    const t4Leaf2 = new THREE.ConeGeometry(2.1, 2.6, 8);
    t4Leaf2.translate(0, 5.2, 0);
    applyColor(t4Leaf2, 0x21632d, false);
    t4Geos.push(t4Leaf2);
    const t4Crown = new THREE.DodecahedronGeometry(1.1, 1);
    t4Crown.scale(1.0, 1.3, 1.0);
    applyColor(t4Crown, 0x34823c, false);
    t4Geos.push(t4Crown);
    const geoTree4 = BufferGeometryUtils.mergeGeometries(t4Geos.map(g => g.index ? g.toNonIndexed() : g), false);

    // Tree 5: Fluffy Rounded Bonsai / Ancient Oak (No cut-off tops!)
    const t5Geos = [];
    const t5Trunk = new THREE.CylinderGeometry(0.6, 1.2, 3.5, 6);
    t5Trunk.translate(0, 1.75, 0);
    applyColor(t5Trunk, 0x7a6f5e);
    t5Geos.push(t5Trunk);
    
    const leavesPos = [
        {x: 0, y: 5.5, z: 0, s: 1.3, col: 0x88c94e},
        {x: 2.1, y: 4.2, z: 0, s: 1.1, col: 0x6bb846},
        {x: -1.9, y: 3.8, z: 0.6, s: 1.0, col: 0x5ea83b},
        {x: 1.0, y: 4.6, z: -1.3, s: 0.95, col: 0x78bd44}
    ];
    leavesPos.forEach(pos => {
        const leaf = new THREE.DodecahedronGeometry(1.8 * pos.s, 1);
        leaf.scale(1.0, 0.78, 1.0); // Natural rounded canopy cloud
        leaf.translate(pos.x, pos.y, pos.z);
        applyColor(leaf, pos.col);
        t5Geos.push(leaf);
    });
    const geoTree5 = BufferGeometryUtils.mergeGeometries(t5Geos.map(g => g.index ? g.toNonIndexed() : g), false);

    // Tree 6: Pink Cherry Blossom & Autumn Amber Mix
    const t6Geos = [];
    const t6Trunk = new THREE.CylinderGeometry(0.3, 0.6, 3, 3);
    t6Trunk.translate(0, 1.5, 0);
    applyColor(t6Trunk, 0xa87f5e);
    t6Geos.push(t6Trunk);

    const blossomPos = [
        {x: 0, y: 4.8, z: 0, s: 1.6, col: 0xffa6c9},
        {x: -1.2, y: 3.8, z: 0.8, s: 1.3, col: 0xffb5d2},
        {x: 1.2, y: 4.1, z: -0.6, s: 1.4, col: 0xf5a15b} // Subtle autumn amber touch
    ];
    blossomPos.forEach(pos => {
        const leaf = new THREE.DodecahedronGeometry(1.5 * pos.s, 1);
        leaf.scale(1, 0.8, 1);
        leaf.translate(pos.x, pos.y, pos.z);
        applyColor(leaf, pos.col);
        t6Geos.push(leaf);
    });
    const geoTree6 = BufferGeometryUtils.mergeGeometries(t6Geos.map(g => g.index ? g.toNonIndexed() : g), false);

    
    const wallColors = [0xfef0c8, 0xebaf9b, 0x82bfa8, 0x6e9ca8, 0xe1d9c1, 0xffffff, 0xcbe3d6]; 
    const roofColors = [0xd95a53, 0x4a7c8c, 0x5a6351, 0x8a7b6b, 0x8a4538, 0x566d8f];
    const woodColor = 0x5c4033;
    const windowColor = 0x223344;
     
    const matWalls = wallColors.map(c => new THREE.MeshToonMaterial({ color: c, gradientMap: gradientMap }));
    const matRoofs = roofColors.map(c => new THREE.MeshToonMaterial({ color: c, gradientMap: gradientMap }));
    const matWoodDark = new THREE.MeshToonMaterial({ color: woodColor, gradientMap: gradientMap });
    const matWindowDark = new THREE.MeshToonMaterial({ color: windowColor, gradientMap: gradientMap });
    const matBushDark = new THREE.MeshToonMaterial({ color: 0x3a6b4a, gradientMap: gradientMap });
    const matStone = new THREE.MeshToonMaterial({ color: 0x9e9e9e, gradientMap: gradientMap });
    const matMetal = new THREE.MeshToonMaterial({ color: 0x5a5a6a, gradientMap: gradientMap });
    const matShutter = new THREE.MeshToonMaterial({ color: 0x418a7a, gradientMap: gradientMap });

    const matClothes = [
        new THREE.MeshToonMaterial({ color: 0xdd4444, gradientMap: gradientMap }),
        new THREE.MeshToonMaterial({ color: 0x4488dd, gradientMap: gradientMap }),
        new THREE.MeshToonMaterial({ color: 0xdddd44, gradientMap: gradientMap }),
        new THREE.MeshToonMaterial({ color: 0xeeeeee, gradientMap: gradientMap })
    ];

    function createAntenna() {
        const grp = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3), matMetal);
        pole.position.y = 1.5;
        grp.add(pole);
        const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2), matMetal);
        cross.rotation.z = Math.PI/2;
        cross.position.y = 2.5;
        grp.add(cross);
        const cross2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5), matMetal);
        cross2.rotation.z = Math.PI/2;
        cross2.position.y = 2.0;
        grp.add(cross2);
        return grp;
    }

    function createBalcony(w, d, matBase, matRail) {
        const balc = new THREE.Group();
        const baseGeo = new THREE.BoxGeometry(w, 0.4, d);
        const base = new THREE.Mesh(baseGeo, matBase);
        base.castShadow = true;
        balc.add(base);
                 
        const railGeo = new THREE.BoxGeometry(0.2, 1.2, d);
        const railL = new THREE.Mesh(railGeo, matRail);
        railL.position.set(-w/2 + 0.1, 0.6, 0);
        railL.castShadow = true;
        balc.add(railL);
                 
        const railR = new THREE.Mesh(railGeo, matRail);
        railR.position.set(w/2 - 0.1, 0.6, 0);
        railR.castShadow = true;
        balc.add(railR);
                 
        const railFGeo = new THREE.BoxGeometry(w, 1.2, 0.2);
        const railF = new THREE.Mesh(railFGeo, matRail);
        railF.position.set(0, 0.6, d/2 - 0.1);
        railF.castShadow = true;
        balc.add(railF);
        return balc;
    }

    function createWindow(w, h) {
        const winGeo = new THREE.BoxGeometry(w, h, 0.2);
        const win = new THREE.Mesh(winGeo, matWindowDark);
        
        const frameGeoL = new THREE.BoxGeometry(0.3, h + 0.6, 0.4);
        const frameL = new THREE.Mesh(frameGeoL, matWoodDark);
        frameL.position.set(-w/2 - 0.15, 0, 0);
        win.add(frameL);
        const frameR = new THREE.Mesh(frameGeoL, matWoodDark);
        frameR.position.set(w/2 + 0.15, 0, 0);
        win.add(frameR);
        const frameTGeo = new THREE.BoxGeometry(w + 0.9, 0.3, 0.4);
        const frameT = new THREE.Mesh(frameTGeo, matWoodDark);
        frameT.position.set(0, h/2 + 0.15, 0);
        win.add(frameT);
        const frameB = new THREE.Mesh(frameTGeo, matWoodDark);
        frameB.position.set(0, -h/2 - 0.15, 0);
        win.add(frameB);
        return win;
    }

    function createWindowWithShutters(w, h, sMat) {
        const win = createWindow(w, h);
        if (Math.random() > 0.3) {
            const shutterGeo = new THREE.BoxGeometry(w/2 * 0.9, h, 0.15);
            const shutterL = new THREE.Mesh(shutterGeo, sMat);
            shutterL.position.set(-w/2 - w/4, 0, 0.1);
            win.add(shutterL);
            const shutterR = new THREE.Mesh(shutterGeo, sMat);
            shutterR.position.set(w/2 + w/4, 0, 0.1);
            win.add(shutterR);
        }
        if (Math.random() > 0.5) {
            const planterGeo = new THREE.BoxGeometry(w + 0.4, 0.4, 0.6);
            const planter = new THREE.Mesh(planterGeo, matWoodDark);
            planter.position.set(0, -h/2 - 0.2, 0.3);
            win.add(planter);
            const bushGeo = new THREE.DodecahedronGeometry(0.3, 0);
            for(let i=0; i<3; i++) {
                const b = new THREE.Mesh(bushGeo, matBushDark);
                b.position.set(-w/2 + i*(w/2), -h/2 + 0.1, 0.4);
                win.add(b);
            }
        }
        return win;
    }

    // Other Geometries
    const geoRock = new THREE.DodecahedronGeometry(2.5, 0); // 36-triangle low poly boulders
    
    const geoBush = new THREE.IcosahedronGeometry(2, 0);
    const geoFlowerStem = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 3);
    geoFlowerStem.translate(0, 0.2, 0);
    const geoFlowerHead = new THREE.OctahedronGeometry(0.35, 0); // Ultra low poly 8-triangle gem head
    geoFlowerHead.translate(0, 0.5, 0);
    geoFlowerHead.scale(1, 0.5, 1);
    const geoFlower = BufferGeometryUtils.mergeGeometries([geoFlowerStem.toNonIndexed(), geoFlowerHead.toNonIndexed()]);

    const b3 = new THREE.ConeGeometry(0.15, 0.6, 3);
    b3.translate(0, 0.3, 0);
    b3.rotateX(-0.2);

    const geoCloud = new THREE.IcosahedronGeometry(25, 2);
    geoCloud.scale(2.0, 1.0, 1.5); 
    const cpos = geoCloud.attributes.position;
    for (let i = 0; i < cpos.count; i++) {
        let x = cpos.getX(i);
        let y = cpos.getY(i);
        let z = cpos.getZ(i);
        if (y < 0) {
            y *= 0.3;
        } else {
            let billow = Math.sin(x * 0.2) * Math.cos(z * 0.2) * 4.0;
            y += Math.max(0, billow);
        }
        cpos.setXYZ(i, x, y, z);
    }
    geoCloud.computeVertexNormals();

    // Meshes — 10 Distinct 3D Stylized Pine Tree Instanced Meshes
    const GHIBLI_TREE_CONFIGS = [
        { key: 'pine_ghibli_02', name: 'Pine Ghibli 02 (Majestic)', path: 'assets/Pines/Pine_Ghibli_02.glb', count: 120, height: 22.0, fallbackGeo: geoTree1, clusterGroup: 0 },
        { key: 'pine_model_a2', name: 'Pine Model A (Tall)', path: 'assets/Pines/Pine model  A (2).glb', count: 120, height: 22.0, fallbackGeo: geoTree2, clusterGroup: 0 },
        { key: 'pine_model_a3', name: 'Pine Model A (Dense)', path: 'assets/Pines/Pine model  A (3).glb', count: 110, height: 21.0, fallbackGeo: geoTree3, clusterGroup: 0 },
        { key: 'pine_model_a4', name: 'Pine Model A (Highland)', path: 'assets/Pines/Pine model  A (4).glb', count: 110, height: 20.0, fallbackGeo: geoTree4, clusterGroup: 1 },
        { key: 'pine_model_a5', name: 'Pine Model A (Spire)', path: 'assets/Pines/Pine model  A (5).glb', count: 90, height: 22.0, fallbackGeo: geoTree1, clusterGroup: 1 },
        { key: 'pine_model_a6', name: 'Pine Model A (Tiered)', path: 'assets/Pines/Pine model  A (6).glb', count: 80, height: 22.0, fallbackGeo: geoTree3, clusterGroup: 1 },
        { key: 'pine_model_a7', name: 'Pine Model A (Alpine)', path: 'assets/Pines/Pine model  A (7).glb', count: 90, height: 18.0, fallbackGeo: geoTree2, clusterGroup: 2 },
        { key: 'pine_model_a8', name: 'Pine Model A (Small)', path: 'assets/Pines/Pine model  A (8).glb', count: 90, height: 14.0, fallbackGeo: geoTree3, clusterGroup: 2 },
        { key: 'pine_model_b1', name: 'Pine Model B (Grove 1)', path: 'assets/Pines/Pine model B (1).glb', count: 80, height: 12.0, fallbackGeo: geoTree1, clusterGroup: 2 },
        { key: 'pine_model_b2', name: 'Pine Model B (Grove 2)', path: 'assets/Pines/Pine model B (2).glb', count: 80, height: 10.0, fallbackGeo: geoTree4, clusterGroup: 2 }
    ];
    const PINE_CONFIGS = GHIBLI_TREE_CONFIGS;

    const pineTreeMeshes = PINE_CONFIGS.map(cfg => {
        const mesh = new THREE.InstancedMesh(cfg.fallbackGeo, matTree, cfg.count);
        mesh.name = cfg.key;
        mesh.maxCount = cfg.count;
        mesh.config = cfg;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        // Initialize all instances far below ground so spawn loop will recycle them
        const initDummy = new THREE.Object3D();
        initDummy.position.set(0, -1000, 0);
        initDummy.scale.set(0, 0, 0);
        initDummy.updateMatrix();
        for (let i = 0; i < cfg.count; i++) {
            mesh.setMatrixAt(i, initDummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        scene.add(mesh);
        return mesh;
    });

    const instTree1 = pineTreeMeshes[0]; // backward-compatibility alias
    const treeMeshes = [...pineTreeMeshes];

    // ==========================================
    // DISTANT HORIZON BILLBOARD TREES (DISABLED EVERYWHERE)
    // ==========================================
    const BILLBOARD_TREE_COUNT = 0;
    const texLoader = new THREE.TextureLoader();
    const billboardTex = texLoader.load(resolveAssetUrl('assets/tree_billboard_pine_1_norm.png'));
    billboardTex.colorSpace = THREE.SRGBColorSpace;

    const billboardMat = new MeshToonNodeMaterial({
        map: billboardTex,
        alphaTest: 0.25,
        transparent: false,
        side: THREE.DoubleSide,
        dithering: true
    });

    const billboardGeo = new THREE.PlaneGeometry(12, 21.6);
    billboardGeo.translate(0, 10.8, 0);

    const instBillboardTrees = new THREE.InstancedMesh(billboardGeo, billboardMat, 1);
    instBillboardTrees.frustumCulled = false;
    instBillboardTrees.visible = false;
    // Billboard trees disabled everywhere - not added to scene

    const jungleBillboardTex = texLoader.load(resolveAssetUrl('assets/tree_billboard_jungle1.png'));
    jungleBillboardTex.colorSpace = THREE.SRGBColorSpace;
    const jungleBillboardMat = new MeshToonNodeMaterial({
        map: jungleBillboardTex,
        alphaTest: 0.25,
        transparent: false,
        side: THREE.DoubleSide,
        dithering: true
    });

    const jungleBillboardGeo = billboardGeo.clone();
    const instJungleBillboardTrees = new THREE.InstancedMesh(jungleBillboardGeo, jungleBillboardMat, 1);
    instJungleBillboardTrees.frustumCulled = false;
    instJungleBillboardTrees.visible = false;
    // Billboard trees disabled everywhere - not added to scene

    // Exact color matching palette derived directly from 3D GLB Pine tree foliage colors
    const billboardTints = [
        new THREE.Color(0x52c439), // Vibrant Ghibli Spring Green (exact 3D tree match)
        new THREE.Color(0x2ea84b), // Lush Emerald Green (exact 3D tree match)
        new THREE.Color(0x44c838), // Rich Meadow Green (exact 3D tree match)
        new THREE.Color(0x64d848), // Bright Sunlit Green (exact 3D tree match)
        new THREE.Color(0x38b000)  // Deep Forest Green
    ];

    treeMeshes.forEach(mesh => {
        mesh.maxCount = mesh.count;
    });


    const instRocks = new THREE.InstancedMesh(geoRock, matRock, Math.max(1, ROCK_COUNT));
    instRocks.count = ROCK_COUNT;
    const instBushes = new THREE.InstancedMesh(geoBush, matBush, Math.max(1, BUSH_COUNT));
    instBushes.count = BUSH_COUNT;
    const MAX_CLOUD_COUNT = 300;
    const instClouds = new THREE.InstancedMesh(geoCloud, matCloud, MAX_CLOUD_COUNT);
    instClouds.count = CLOUD_COUNT;
    const instFlowers = new THREE.InstancedMesh(geoFlower, matFlower, Math.max(1, FLOWER_COUNT));
    instFlowers.count = FLOWER_COUNT;





    const ICEBERG_COUNT = 40;
    const iceGeos = [];
    const iceBase = new THREE.ConeGeometry(5.0, 8, 5);
    iceBase.translate(0, 2.0, 0);
    applyColor(iceBase, 0x8adeef);
    iceGeos.push(iceBase);
    const icePeak = new THREE.ConeGeometry(3.0, 6, 4);
    icePeak.translate(0.8, 6.5, 0.5);
    icePeak.rotateZ(0.12);
    applyColor(icePeak, 0xc5f0fa);
    iceGeos.push(icePeak);
    const iceShoulder = new THREE.DodecahedronGeometry(3.5, 0);
    iceShoulder.scale(1.3, 0.7, 1.1);
    iceShoulder.translate(-1.5, 2.5, 1.0);
    applyColor(iceShoulder, 0x67d4e8);
    iceGeos.push(iceShoulder);
    const iceSub = new THREE.ConeGeometry(4.5, 5, 5);
    iceSub.translate(0, -1.5, 0);
    iceSub.rotateX(Math.PI);
    applyColor(iceSub, 0x38bdf8);
    iceGeos.push(iceSub);
    const geoIceberg = BufferGeometryUtils.mergeGeometries(iceGeos.map(g => g.index ? g.toNonIndexed() : g), false);

    const matIceberg = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.15,
        metalness: 0.05,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide
    });
    const instIcebergs = new THREE.InstancedMesh(geoIceberg, matIceberg, ICEBERG_COUNT);
    const tmpIce = new THREE.Object3D();
    for (let i = 0; i < ICEBERG_COUNT; i++) {
        tmpIce.position.set(0, -1000, 0);
        tmpIce.updateMatrix();
        instIcebergs.setMatrixAt(i, tmpIce.matrix);
    }
    scene.add(instIcebergs);

    const rockColors = [0xe5d4ba, 0xcbb192, 0xd8c8b8, 0x8a7b69, 0xd2c0a3];
    const tempRockColor = new THREE.Color();
    for (let i = 0; i < ROCK_COUNT; i++) {
        tempRockColor.setHex(rockColors[Math.floor(Math.random() * rockColors.length)]);
        instRocks.setColorAt(i, tempRockColor);
    }

    const flowerColors = [0xffffff, 0xffd700, 0xffa8d1, 0x4da9e8, 0xff6b6b]; // white, yellow, pink, blue, red
    const tempFlowerColor = new THREE.Color();
    for (let i = 0; i < FLOWER_COUNT; i++) {
        tempFlowerColor.setHex(flowerColors[Math.floor(Math.random() * flowerColors.length)]);
        instFlowers.setColorAt(i, tempFlowerColor);
    }
    
    // Initialize Open Sea Ocean WebGPU System
    animeWaterSystem = new WaterSystem(scene, renderer);
    animeWaterSystem.setVisible(params.showWater);
    window.waterModalUI = new WaterModalUI(animeWaterSystem);
    animeWaterGUI = new WaterEditorGUI(animeWaterSystem, gui);

    // ==========================================
    // RAIN SYSTEM
    // ==========================================
    class RainSystem {
        constructor(scene) {
            this.scene = scene;
            this.count = 30000;
            const positions = new Float32Array(this.count * 3);
            const rand = new Float32Array(this.count);
            for(let i=0; i<this.count; i++) {
                positions[i*3] = (Math.random() - 0.5) * 300;
                positions[i*3+1] = Math.random() * 100;
                positions[i*3+2] = (Math.random() - 0.5) * 300;
                rand[i] = Math.random();
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
            
            const uTime = uniform(0.0);
            const uCamPos = uniform(new THREE.Vector3());
            const uSize = uniform(2.0);
            const uWind = uniform(new THREE.Vector2(0, 0));
            const uIntensity = uniform(1.0);
            const uAngle = uniform(0.0);

            this.uniforms = { uTime, uCamPos, uSize, uWind, uIntensity, uAngle };
            
            const aRand = attribute('aRand', 'float');

            const material = new PointsNodeMaterial({
                transparent: true,
                depthWrite: false,
                colorNode: vec4(0.4, 0.5, 0.7, uIntensity.mul(0.6)),
                sizeNode: uSize.mul(aRand.mul(0.5).add(0.5))
            });

            this.mesh = new THREE.Points(geometry, material);
            this.mesh.frustumCulled = false;
            this.mesh.visible = false;
            this.scene.add(this.mesh);
        }
        
        update(time, cam, params) {
            this.mesh.visible = params.rain;
            if (!params.rain) return;
            this.uniforms.uTime.value = time;
            this.uniforms.uCamPos.value.copy(cam.position);
            this.uniforms.uSize.value = params.rainSize || 2.0;
            this.uniforms.uIntensity.value = params.rainIntensity || 1.0;
            
            let wx = 1.0; let wy = 0.5;
            if (params.rainWindX !== undefined) {
                wx = params.rainWindX;
                wy = params.rainWindY;
            }
            this.uniforms.uWind.value.set(wx, wy);
            this.uniforms.uAngle.value = Math.atan2(wx * 20.0, -70.0);
        }
    }
    
    window.rainSystem = new RainSystem(scene);

    // ==========================================
    // VOLUMETRIC GROUND FOG (GOD RAYS & PER-BIOME ATMOSPHERE)
    // ==========================================
    const fogGroup = new THREE.Group();
    const fogGeo = new THREE.PlaneGeometry(4500, 4500);
    fogGeo.rotateX(-Math.PI / 2);
    const fogUniforms = {
        uTime: uniform(0),
        uFogIntensity: uniform(0.8),
        uFogOpacity: uniform(0.8),
        uFogDrift: uniform(1.0),
        uFogTurbulence: uniform(1.0),
        uFogNear: uniform(10.0),
        uFogFar: uniform(1750.0)
    };

    const hash = Fn(([p]) => {
        return fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453123));
    });

    const noise = Fn(([p]) => {
        const i = p.floor();
        const f = p.fract();
        const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
        return mix(
            mix(hash(i.add(vec2(0.0, 0.0))), hash(i.add(vec2(1.0, 0.0))), u.x),
            mix(hash(i.add(vec2(0.0, 1.0))), hash(i.add(vec2(1.0, 1.0))), u.x),
            u.y
        );
    });

    const getFogAlphaFn = Fn(([wPos, camPos, uTime, uDrift, uTurb, uNear, uFar, uIntensity, uOpacity]) => {
        const scaledTime = uTime.mul(uDrift.mul(0.03));
        const uv = wPos.xz.mul(0.0025).mul(uTurb);
        const yOffset = wPos.y.mul(0.2);
        const n1 = noise(uv.add(vec2(scaledTime.add(yOffset), scaledTime.mul(0.66))));
        const n2 = noise(uv.mul(2.0).sub(vec2(scaledTime.mul(0.7).sub(yOffset), scaledTime.mul(-1.0))));
        const noiseAlpha = tslSmoothstep(-0.2, 0.8, n1.add(n2.mul(0.5)));
        
        const dist = wPos.xz.sub(camPos.xz).length();
        const edgeFade = float(1.0).sub(tslSmoothstep(uFar.mul(0.75), uFar, dist));
        const nearFade = tslSmoothstep(uNear, uNear.mul(4.0), dist);
        
        return noiseAlpha.mul(edgeFade).mul(nearFade).mul(uOpacity).mul(uIntensity).mul(0.3);
    });

    const fogMat = new MeshBasicNodeMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        fog: false
    });
    
    fogMat.opacityNode = getFogAlphaFn(
        positionWorld,
        cameraPosition,
        fogUniforms.uTime,
        fogUniforms.uFogDrift,
        fogUniforms.uFogTurbulence,
        fogUniforms.uFogNear,
        fogUniforms.uFogFar,
        fogUniforms.uFogIntensity,
        fogUniforms.uFogOpacity
    );

    // Stack 3 planes for cheap 3D parallax volumetric effect
    for(let i = 0; i < 3; i++) {
        const p = new THREE.Mesh(fogGeo, fogMat);
        p.position.y = 12 + i * 16;
        p.receiveShadow = false;
        fogGroup.add(p);
    }
    fogGroup.visible = false;
    // scene.add(fogGroup); // Ground fog over terrain completely removed
    window.fogGroup = fogGroup;
    window.fogUniforms = fogUniforms;
    window.fogMat = fogMat;
    window.biomeFogSettings = {};

    window.getBiomeAt = getBiomeAt;
    const groundFogEditor = new GroundFogEditor();
    groundFogEditor.startBiomePolling();
    window.groundFogEditor = groundFogEditor;

    treeMeshes.forEach(mesh => {
        mesh.castShadow = false; // MASSIVE FPS GAIN: Stop rendering 9,000+ complex trees into the shadow depth map
        mesh.receiveShadow = true;
    instRocks.visible = false;
    [instBushes, instFlowers].forEach(mesh => {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        scene.add(mesh);
    });
        mesh.frustumCulled = false; 
        scene.add(mesh);
    });

    instClouds.castShadow = true;
    instClouds.frustumCulled = false;
    scene.add(instClouds);

    // Super High Cumulonimbus Clouds & See-Through Wispy Clouds
    const baseCloudSpheres = [];
    const mainPillar = new THREE.DodecahedronGeometry(150, 1).toNonIndexed();
    mainPillar.scale(1, 1.2, 1);
    baseCloudSpheres.push(mainPillar);
    
    const fluff1 = new THREE.DodecahedronGeometry(110, 1).toNonIndexed();
    fluff1.translate(120, -30, 40);
    baseCloudSpheres.push(fluff1);
    
    const fluff2 = new THREE.DodecahedronGeometry(90, 1).toNonIndexed();
    fluff2.translate(-100, -50, 80);
    baseCloudSpheres.push(fluff2);
    
    const fluff3 = new THREE.DodecahedronGeometry(130, 1).toNonIndexed();
    fluff3.translate(-40, 20, -110);
    baseCloudSpheres.push(fluff3);

    const fluff4 = new THREE.DodecahedronGeometry(80, 1).toNonIndexed();
    fluff4.translate(60, 60, 90);
    baseCloudSpheres.push(fluff4);

    const highCloudGeo = BufferGeometryUtils.mergeGeometries(baseCloudSpheres);
    highCloudGeo.computeVertexNormals();
    const highCloudMat = new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    
    const MAX_HIGH_CLOUD_COUNT = 100;
    const instHighClouds = new THREE.InstancedMesh(highCloudGeo, highCloudMat, MAX_HIGH_CLOUD_COUNT);
    instHighClouds.count = HIGH_CLOUD_COUNT;
    instHighClouds.frustumCulled = false;
    scene.add(instHighClouds);

    const MAX_WISPY_CLOUD_COUNT = 100;
    const instWispyClouds = new THREE.InstancedMesh(geoCloud, matWispyCloud, MAX_WISPY_CLOUD_COUNT);
    instWispyClouds.count = WISPY_CLOUD_COUNT;
    instWispyClouds.frustumCulled = false;
    scene.add(instWispyClouds);

    // Far-Distance Mega Painted Clouds (Visible when Kiki climbs high)
    const MAX_MEGA_CLOUD_COUNT = 100;
    const megaCloudMat = new THREE.MeshToonMaterial({ color: 0xfff6e3, transparent: true, opacity: 0.88 });
    const instMegaClouds = new THREE.InstancedMesh(highCloudGeo, megaCloudMat, MAX_MEGA_CLOUD_COUNT);
    instMegaClouds.count = MEGA_CLOUD_COUNT;
    instMegaClouds.frustumCulled = false;
    scene.add(instMegaClouds);
    
    // Initialize all cloud instance matrices so they don't render a giant mass at origin (0,0,0)
    const dummyInit = new THREE.Object3D();
    dummyInit.position.set(0, -1000, 0); // Force teleport on first frame!
    dummyInit.scale.set(0, 0, 0);
    dummyInit.scale.set(0, 0, 0);
    dummyInit.updateMatrix();
    for (let i = 0; i < MAX_CLOUD_COUNT; i++) instClouds.setMatrixAt(i, dummyInit.matrix);
    for (let i = 0; i < MAX_HIGH_CLOUD_COUNT; i++) instHighClouds.setMatrixAt(i, dummyInit.matrix);
    for (let i = 0; i < MAX_WISPY_CLOUD_COUNT; i++) instWispyClouds.setMatrixAt(i, dummyInit.matrix);
    for (let i = 0; i < MAX_MEGA_CLOUD_COUNT; i++) instMegaClouds.setMatrixAt(i, dummyInit.matrix);


    
    // Apply Pastel Colors to Clouds
    let pastelColors = [0xffd1dc, 0xd1ffd1, 0xd1e8ff, 0xfffdd1, 0xe8d1ff];
    const tempCloudColor = new THREE.Color();
    for (let i = 0; i < CLOUD_COUNT; i++) {
        if (Math.random() > 0.5) tempCloudColor.setHex(pastelColors[Math.floor(Math.random() * pastelColors.length)]);
        else tempCloudColor.setHex(0xffffff);
        instClouds.setColorAt(i, tempCloudColor);
    }
    for (let i = 0; i < HIGH_CLOUD_COUNT; i++) {
        if (Math.random() > 0.5) tempCloudColor.setHex(pastelColors[Math.floor(Math.random() * pastelColors.length)]);
        else tempCloudColor.setHex(0xffffff);
        instHighClouds.setColorAt(i, tempCloudColor);
    }
    if (instClouds.instanceColor) instClouds.instanceColor.needsUpdate = true;
    if (instHighClouds.instanceColor) instHighClouds.instanceColor.needsUpdate = true;
    
    instFlowers.receiveShadow = false;
    instFlowers.castShadow = false;
    if (FLOWER_COUNT > 0) scene.add(instFlowers);
    
    // ==========================================
    // PROCEDURAL SKYDOME (replaces PNG cubemap + SpiralNoiseC cloud dome)
    // ==========================================
    const { mesh: proceduralSkyMesh, material: proceduralSkyMat, uniforms: skyUniforms } = createProceduralSky();
    window._skyDbg = skyUniforms;
    scene.add(proceduralSkyMesh);

    // SKY MODE. "flat" reproduces flight-merged (WebGL): the procedural dome is hidden and a solid
    // background colour carries the sky, which the dense fog fades geometry into. The dome is kept
    // in the scene so it can be toggled back on from the Cloud Editor.
    // Why flat is the default: with postProcessing.outputColorTransform = false there is no
    // tonemapping to roll off highlights, so the dome horizon gradient exceeds 1.0 and hard-clips
    // to a full-width white band across the screen. Solid background has no such gradient.
    let skyRenderMode = localStorage.getItem("wl_skyRenderMode") || "Gradient + Clouds";
    function setSkyRenderMode(mode) {
        skyRenderMode = mode;
        localStorage.setItem("wl_skyRenderMode", skyRenderMode);
        params.skyRenderMode = mode;

        if (mode === "Gradient + Clouds") {
            proceduralSkyMesh.visible = true;
            params.showProceduralSky = true;
            params.enableProceduralClouds = true;
            if (skyUniforms.uEnableProceduralClouds) skyUniforms.uEnableProceduralClouds.value = 1.0;
            if (skyUniforms.uGradientSkyEnabled) skyUniforms.uGradientSkyEnabled.value = 1.0;
            scene.background = null;
        } else if (mode === "Gradient Regular") {
            proceduralSkyMesh.visible = true;
            params.showProceduralSky = true;
            params.enableProceduralClouds = false;
            if (skyUniforms.uEnableProceduralClouds) skyUniforms.uEnableProceduralClouds.value = 0.0;
            if (skyUniforms.uGradientSkyEnabled) skyUniforms.uGradientSkyEnabled.value = 1.0;
            scene.background = null;
        } else if (mode === "Flat Solid") {
            proceduralSkyMesh.visible = false;
            params.showProceduralSky = false;
            params.enableProceduralClouds = false;
            const curTarget = (typeof envConfigs !== 'undefined' && envConfigs[timePhase]) ? envConfigs[timePhase] : { bg: 0x8cbce6 };
            scene.background = new THREE.Color(curTarget.bg);
        }

        if (typeof gui !== 'undefined' && gui) {
            gui.controllersRecursive().forEach(c => {
                if (c.property === 'skyRenderMode' || c.property === 'showProceduralSky' || c.property === 'enableProceduralClouds') {
                    c.updateDisplay();
                }
            });
        }
    }
    setSkyRenderMode(skyRenderMode);
    window.setSkyRenderMode = setSkyRenderMode;
    window.applySkyMode = (m) => setSkyRenderMode(m === "flat" ? "Flat Solid" : "Gradient + Clouds");
    let currentWeather = 'clear';

    // --- REMOVED: old toon cloud dome + cubemap skybox ---
    // Kept as dead code reference, remove once procedural sky is validated
    const _OLD_SKYDOME_REMOVED = true; // marker
    if (false) { // dead code block
    const toonCloudGeo = new THREE.SphereGeometry(22000, 32, 16);
    const toonCloudMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        uniforms: {
            uTime: { value: 0 },
            uSunDir: { value: new THREE.Vector3(-0.077, 0.5, 0.577).normalize() },
            uCloudDensity: { value: 1.0 },
            uCloudHeight: { value: 800.0 },
            uSkyColor: { value: new THREE.Color(0x8cbce6) },
            uCloudColor: { value: new THREE.Color(0xfffaec) },
            uEnableClouds: { value: 1.0 }
        },
        vertexShader: `
            varying vec3 vWorldPos;
            varying vec3 vViewDir;
            void main() {
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                vViewDir = normalize(worldPos.xyz - cameraPosition);
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uSunDir;
            uniform float uCloudDensity;
            uniform float uCloudHeight;
            uniform vec3 uSkyColor;
            uniform vec3 uCloudColor;
            uniform float uEnableClouds;

            varying vec3 vWorldPos;
            varying vec3 vViewDir;

            const float nudge = 0.739513;
            float normalizer = 1.0 / sqrt(1.0 + nudge*nudge);

            float SpiralNoiseC(vec3 p) {
                float n = 0.0;
                float iter = 1.0;
                for (int i = 0; i < 5; i++) {
                    vec3 spin = sin(p * iter);
                    n += -abs(spin.x + spin.y + spin.z) / iter;
                    p.xy += vec2(p.y, -p.x) * nudge;
                    p.xy *= normalizer;
                    p.xz += vec2(p.z, -p.x) * nudge;
                    p.xz *= normalizer;
                    iter *= 1.733733;
                }
                return n;
            }

            float getCloud(vec3 pos) {
                vec3 p = pos * 0.0012 + vec3(uTime * 0.015, 0.0, uTime * 0.008);
                float noise = SpiralNoiseC(p);
                float heightFalloff = smoothstep(100.0, 1200.0, pos.y) * smoothstep(5000.0, 2000.0, pos.y);
                float coverage = (uCloudDensity * 0.8 - 0.7); // Tweak coverage to create holes
                float cloudVal = noise * 0.5 + coverage + heightFalloff * 0.6;
                return clamp(cloudVal, 0.0, 1.0);
            }

            void main() {
                if (uEnableClouds < 0.5 || vViewDir.y < -0.05) {
                    discard;
                }

                vec3 dir = normalize(vViewDir);
                float rayT = (uCloudHeight - cameraPosition.y) / max(dir.y, 0.01);
                
                if (rayT <= 0.0 || rayT > 16000.0) {
                    discard;
                }

                vec3 pos = cameraPosition + dir * rayT;
                float cloudDensity = getCloud(pos);

                if (cloudDensity < 0.01) {
                    discard;
                }

                float alpha = smoothstep(0.01, 0.45, cloudDensity);
                float diff = clamp(dot(vec3(0.0, 1.0, 0.0), uSunDir), 0.5, 1.0);
                
                vec3 col = mix(uCloudColor, uCloudColor * 1.15, diff * 0.3);

                gl_FragColor = vec4(col, alpha * 0.95);
            }
        `
    });

    const toonCloudDome = new THREE.Mesh(toonCloudGeo, toonCloudMat);
    // scene.add(toonCloudDome);
    


    // ==========================================
    // SKYDOME
    // ==========================================
    let daySkyboxMesh;
    let nightSkyboxMesh;
    const skyboxTexLoader = new THREE.TextureLoader();

    // Skydome Implementation
    const skydomeGeo = new THREE.BoxGeometry(18000, 18000, 18000, 16, 16, 16);
    const dayFaces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const dayMats = dayFaces.map(face => {
        const tex = skyboxTexLoader.load(`assets/skydome/day/${params.daySkydomeTexture}/${face}.png`);
        tex.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshBasicMaterial({
            map: tex,
            side: THREE.BackSide,
            fog: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.0
        });
    });
    daySkyboxMesh = new THREE.Mesh(skydomeGeo, dayMats);
    daySkyboxMesh.renderOrder = -1;
    scene.add(daySkyboxMesh);

    const nightFaces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const nightMats = nightFaces.map(face => {
        const tex = skyboxTexLoader.load(`assets/skydome/night/${params.nightSkydomeTexture}/${face}.png`);
        tex.colorSpace = THREE.SRGBColorSpace;
        const matArgs = {
            map: tex,
            side: THREE.BackSide,
            fog: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.0
        };
        if (face !== 'ny' && params.nightSkydomeTexture === '2') {
            const trTex = skyboxTexLoader.load(`assets/skydome/night/${params.nightSkydomeTexture}/${face} tr.png`);
            matArgs.alphaMap = trTex;
        }
        return new THREE.MeshBasicMaterial(matArgs);
    });
    nightSkyboxMesh = new THREE.Mesh(skydomeGeo, nightMats);
    nightSkyboxMesh.renderOrder = -2;
    scene.add(nightSkyboxMesh);
    } // end dead code block

    // Initialize all to hidden
    const dummyMatrix = new THREE.Matrix4();
    dummyMatrix.makeScale(0, 0, 0);
    dummyMatrix.setPosition(0, -1000, 0);
    [...treeMeshes, instRocks, instBushes, instClouds, instFlowers].forEach(mesh => {
        for(let i=0; i<mesh.count; i++) {
            mesh.setMatrixAt(i, dummyMatrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    });



    // ===================================================
    // 6.5 BOIDS (BIRDS)
    // ==========================================
    const BIRD_COUNT = LOW_GFX ? 12 : 40;
    const geoBird = new THREE.BufferGeometry();
    const s = 0.8;
    const bVerts = new Float32Array([
        // Head / Body spine
        0, 0.1*s, 1.8*s,    -0.2*s, 0, 0.4*s,      0.2*s, 0, 0.4*s,
        -0.2*s, 0, 0.4*s,   -0.15*s, 0.05*s, -1.2*s,  0.2*s, 0, 0.4*s,
        0.2*s, 0, 0.4*s,    -0.15*s, 0.05*s, -1.2*s,  0.15*s, 0.05*s, -1.2*s,
        // Tail feathers
        -0.15*s, 0.05*s, -1.2*s,  -0.5*s, 0.1*s, -2.0*s,  0.15*s, 0.05*s, -1.2*s,
        0.15*s, 0.05*s, -1.2*s,   -0.5*s, 0.1*s, -2.0*s,  0.5*s, 0.1*s, -2.0*s,
        // Left Wing Inner
        -0.2*s, 0, 0.6*s,   -1.6*s, 0.1*s, 0.1*s,  -0.2*s, 0, -0.6*s,
        // Left Wing Outer Tip
        -1.6*s, 0.1*s, 0.1*s, -3.2*s, 0.2*s, -0.5*s, -1.4*s, 0.05*s, -0.5*s,
        // Right Wing Inner
        0.2*s, 0, 0.6*s,    0.2*s, 0, -0.6*s,      1.6*s, 0.1*s, 0.1*s,
        // Right Wing Outer Tip
        1.6*s, 0.1*s, 0.1*s,  1.4*s, 0.05*s, -0.5*s,  3.2*s, 0.2*s, -0.5*s
    ]);
    geoBird.setAttribute('position', new THREE.BufferAttribute(bVerts, 3));
    geoBird.computeVertexNormals();
    
    const matBird = new MeshToonNodeMaterial({ color: 0xd6e5f5, side: THREE.DoubleSide, gradientMap });
    matBird.positionNode = Fn(() => {
        let transformed = positionLocal.toVar();
        const wingDist = abs(positionGeometry.x);
        const flap = sin(terrainUniforms.uTime.mul(9.0).add(wingDist.mul(0.5))).mul(wingDist).mul(0.35);
        const isWing = step(0.3, wingDist);
        transformed.y.addAssign(flap.mul(isWing));
        return transformed;
    })();

    const MAX_BIRD_COUNT = 120;
    const instBirds = new THREE.InstancedMesh(geoBird, matBird, MAX_BIRD_COUNT);
    instBirds.count = BIRD_COUNT;
    instBirds.castShadow = true;
    instBirds.frustumCulled = false;
    scene.add(instBirds);

    const birdData = new Float32Array(MAX_BIRD_COUNT * 6);
    for (let i = 0; i < MAX_BIRD_COUNT; i++) {
        birdData[i * 6 + 0] = (Math.random() - 0.5) * 600;
        birdData[i * 6 + 1] = 60 + Math.random() * 80;
        birdData[i * 6 + 2] = (Math.random() - 0.5) * 600;
        birdData[i * 6 + 3] = (Math.random() - 0.5) * 10;
        birdData[i * 6 + 4] = (Math.random() - 0.5) * 2;
        birdData[i * 6 + 5] = (Math.random() - 0.5) * 10;
    }

    const HIGH_BIRD_COUNT = 0;
    const instHighBirds = new THREE.InstancedMesh(geoBird, matBird, Math.max(1, HIGH_BIRD_COUNT));
    instHighBirds.count = HIGH_BIRD_COUNT;
    instHighBirds.castShadow = true;
    instHighBirds.frustumCulled = false;
    if (HIGH_BIRD_COUNT > 0) scene.add(instHighBirds);

    const highBirdData = new Float32Array(HIGH_BIRD_COUNT * 6);
    for (let i = 0; i < HIGH_BIRD_COUNT; i++) {
        highBirdData[i * 6 + 0] = (Math.random() - 0.5) * 1200;
        highBirdData[i * 6 + 1] = 300 + Math.random() * 200; // High altitude!
        highBirdData[i * 6 + 2] = (Math.random() - 0.5) * 1200;
        highBirdData[i * 6 + 3] = (Math.random() - 0.5) * 10;
        highBirdData[i * 6 + 4] = (Math.random() - 0.5) * 2;
        highBirdData[i * 6 + 5] = (Math.random() - 0.5) * 10;
    }

    // ==========================================
    // FISH AND WHALE
    // ==========================================
    // WIND TRAILS
    // ==========================================
    const trailGeo = new THREE.BoxGeometry(0.1, 0.1, 10.0);
    const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
    const instTrails = new THREE.InstancedMesh(trailGeo, trailMat, 100);
    instTrails.frustumCulled = false;
    scene.add(instTrails);

    const trailsData = new Float32Array(100 * 4); 
    for(let i=0; i<100; i++) {
       trailsData[i*4] = (Math.random() - 0.5) * 80;
       trailsData[i*4+1] = (Math.random() - 0.5) * 60;
       trailsData[i*4+2] = (Math.random() - 0.5) * 100;
       trailsData[i*4+3] = Math.random();
    }

    function updateBirdsGen(data, inst, count, tX, tY, tZ, time, dt, centerPull) {
        for (let i = 0; i < count; i++) {
            let px = data[i * 6 + 0], py = data[i * 6 + 1], pz = data[i * 6 + 2];
            let vx = data[i * 6 + 3], vy = data[i * 6 + 4], vz = data[i * 6 + 5];

            let cx = 0, cy = 0, cz = 0;
            let sx = 0, sy = 0, sz = 0;
            let ax = 0, ay = 0, az = 0;
            let n = 0;

            for (let j = 0; j < count; j++) {
                if (i === j) continue;
                let dx = px - data[j * 6 + 0], dy = py - data[j * 6 + 1], dz = pz - data[j * 6 + 2];
                let distSq = dx*dx + dy*dy + dz*dz;
                
                if (distSq < 1200) { 
                    cx += data[j * 6 + 0]; cy += data[j * 6 + 1]; cz += data[j * 6 + 2];
                    ax += data[j * 6 + 3]; ay += data[j * 6 + 4]; az += data[j * 6 + 5];
                    n++;
                }
                if (distSq < 400) { 
                    sx += dx; sy += dy; sz += dz;
                }
            }

            if (n > 0) {
                cx /= n; cy /= n; cz /= n;
                ax /= n; ay /= n; az /= n;
                vx += (cx - px) * 0.4 * dt;
                vy += (cy - py) * 0.4 * dt;
                vz += (cz - pz) * 0.4 * dt;
                vx += (ax - vx) * 0.1 * dt;
                vy += (ay - vy) * 0.1 * dt;
                vz += (az - vz) * 0.1 * dt;
            }
            
            vx += sx * 1.8 * dt; vy += sy * 1.8 * dt; vz += sz * 1.8 * dt;

            // Give each bird an offset slot around Kiki so they soar gracefully around her rather than clumping
            let formAngle = (i / count) * Math.PI * 2.0;
            let formRadius = (params.birdFlockRadius || 22) + (i % 6) * (params.birdFlockSpread || 9);
            let targetX = tX + Math.cos(formAngle) * formRadius;
            let targetY = tY + ((i % 5) - 2) * 3.5;
            let targetZ = tZ + Math.sin(formAngle) * formRadius;

            let tx = targetX - px, ty = targetY - py, tz = targetZ - pz;
            let dToT = Math.sqrt(tx*tx + ty*ty + tz*tz);
            if (dToT > 3) {
                let pullFactor = (dToT > 100) ? centerPull * 4.0 : centerPull * 1.2;
                vx += (tx / dToT) * pullFactor * dt;
                vy += (ty / dToT) * pullFactor * dt;
                vz += (tz / dToT) * pullFactor * dt;
            }

            let maxSpd = (centerPull > 3.0 && typeof velocity !== 'undefined') ? Math.max(40, velocity * 1.2) : (params.birdMaxSpeed || 35);
            let spd = Math.sqrt(vx*vx + vy*vy + vz*vz);
            if (spd > maxSpd) { vx *= maxSpd/spd; vy *= maxSpd/spd; vz *= maxSpd/spd; }
            if (spd < 15) { vx *= 15/spd; vy *= 15/spd; vz *= 15/spd; }

            px += vx * dt; py += vy * dt; pz += vz * dt;
            data[i * 6 + 0] = px; data[i * 6 + 1] = py; data[i * 6 + 2] = pz;
            data[i * 6 + 3] = vx; data[i * 6 + 4] = vy; data[i * 6 + 5] = vz;

            dummy.position.set(px, py, pz);
            let targetYaw = Math.atan2(vx, vz);
            let roll = Math.max(-0.6, Math.min(0.6, sx * 0.05));
            dummy.rotation.set(roll, targetYaw, Math.sin(time * 12 + i) * 0.35);
            dummy.scale.setScalar(params.birdScale || 0.42);
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
    }

    function updateBirds(playerX, playerY, playerZ, time, dt) {
        const activeBirdCount = instBirds.count;
        updateBirdsGen(birdData, instBirds, activeBirdCount, playerX, playerY + 14, playerZ, time, dt, 5.0);
        updateBirdsGen(highBirdData, instHighBirds, HIGH_BIRD_COUNT, 0, 400, 0, time, dt, 2.0);
    }

    const dummy = new THREE.Object3D();

    const treeGrid = new Map();
    const TREE_CELL_SIZE = 15;
    function getTreeCell(x, z) {
        const cx = (Math.floor(x / TREE_CELL_SIZE) + 32768) & 0xFFFF;
        const cz = (Math.floor(z / TREE_CELL_SIZE) + 32768) & 0xFFFF;
        return (cx << 16) | cz;
    }

    const treeDist = 520; // Focused tree spawn radius so trees are dense around the player!
    let isPrewarming = false;

    function isTreeZone(worldX, worldZ) {
        return getBiomeAt(worldX, worldZ).treesOk;
    }

    let prevGhibliTreeScale = params.ghibliTreeScale || 1.2;
    function updateGhibliTreeScale(newScale) {
        if (!newScale || newScale <= 0) return;
        const ratio = newScale / prevGhibliTreeScale;
        prevGhibliTreeScale = newScale;
        const dummyObj = new THREE.Object3D();
        pineTreeMeshes.forEach(mesh => {
            const count = mesh.maxCount || mesh.count;
            let changed = false;
            for (let i = 0; i < count; i++) {
                mesh.getMatrixAt(i, dummyObj.matrix);
                dummyObj.matrix.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);
                if (dummyObj.position.y > -500) {
                    dummyObj.scale.multiplyScalar(ratio);
                    dummyObj.updateMatrix();
                    mesh.setMatrixAt(i, dummyObj.matrix);
                    changed = true;
                }
            }
            if (changed) mesh.instanceMatrix.needsUpdate = true;
        });
    }
    window.updateGhibliTreeScale = updateGhibliTreeScale;

    function respawnGhibliTrees() {
        treeGrid.clear();
        const dummyObj = new THREE.Object3D();
        dummyObj.position.set(0, -1000, 0);
        dummyObj.scale.set(0, 0, 0);
        dummyObj.updateMatrix();
        pineTreeMeshes.forEach(mesh => {
            const count = mesh.maxCount || mesh.count;
            for (let i = 0; i < count; i++) {
                mesh.setMatrixAt(i, dummyObj.matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
        });
    }
    window.respawnGhibliTrees = respawnGhibliTrees;

    function updateInstances(playerX, playerZ, time, dt, playerYaw) {
        const dist = 850; 
        
        logicTimer += dt;
        const shouldUpdateTerrain = logicTimer >= (1.0 / 15.0);
        if (shouldUpdateTerrain) {
            logicTimer = 0;
        }
        


        // Clouds
        const cloudScale = 1.0 + Math.min(1.0, Math.max(0.0, (playerGrp.position.y - 300.0) / 11700.0)) * 4.0;
        const cloudDist = 1200 * cloudScale;
        const cloudTeleportDist = cloudDist * 1.15;
        for (let i = 0; i < CLOUD_COUNT; i++) {
            instClouds.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
            
            if (Math.abs(dummy.position.x - playerX) > cloudTeleportDist || Math.abs(dummy.position.z - playerZ) > cloudTeleportDist || dummy.position.y < -500) {
                const angle = Math.random() * Math.PI * 2.0;
                const r = cloudDist * (0.6 + Math.random() * 0.38);
                dummy.position.set(
                    playerX + Math.cos(angle) * r,
                    280 + Math.random() * 120,
                    playerZ + Math.sin(angle) * r
                );
                dummy.rotation.set(0, Math.random() * Math.PI, 0);
                let s = (1.3 + Math.random() * 2.2) * params.cloudScaleRegular;
                dummy.scale.set(s * (0.8 + Math.random() * 0.8), s * (0.5 + Math.random() * 0.6), s * (0.8 + Math.random() * 0.8));
            }
            dummy.position.x += 4.0 * dt;
            dummy.position.z += 1.5 * dt;
            dummy.updateMatrix();
            instClouds.setMatrixAt(i, dummy.matrix);
        }
        instClouds.instanceMatrix.needsUpdate = true;

        // High Cumulonimbus Clouds
        const highCloudDist = 3500;
        const highCloudTeleport = highCloudDist * 1.15;
        for (let i = 0; i < HIGH_CLOUD_COUNT; i++) {
            instHighClouds.getMatrixAt(i, dummy.matrix);
            dummy.position.setFromMatrixPosition(dummy.matrix);
            if (Math.abs(dummy.position.x - playerX) > highCloudTeleport || Math.abs(dummy.position.z - playerZ) > highCloudTeleport || dummy.position.y < -500) {
                const angle = Math.random() * Math.PI * 2.0;
                const r = highCloudDist * (0.6 + Math.random() * 0.38);
                dummy.position.set(
                    playerX + Math.cos(angle) * r,
                    1200 + Math.random() * 500,
                    playerZ + Math.sin(angle) * r
                );
                dummy.rotation.set(0, Math.random() * Math.PI, 0);
                dummy.scale.set((1.5 + Math.random() * 2.0) * params.cloudScaleHigh, (0.8 + Math.random() * 1.0) * params.cloudScaleHigh, (1.5 + Math.random() * 2.0) * params.cloudScaleHigh);
            }
            dummy.position.x += 1.5 * dt;
            dummy.updateMatrix();
            instHighClouds.setMatrixAt(i, dummy.matrix);
        }
        instHighClouds.instanceMatrix.needsUpdate = true;

        // See-Through Wispy Clouds
        const wispyDist = 1400 * cloudScale;
        const wispyTeleport = wispyDist * 1.15;
        for (let i = 0; i < WISPY_CLOUD_COUNT; i++) {
            instWispyClouds.getMatrixAt(i, dummy.matrix);
            dummy.position.setFromMatrixPosition(dummy.matrix);
            if (Math.abs(dummy.position.x - playerX) > wispyTeleport || Math.abs(dummy.position.z - playerZ) > wispyTeleport || dummy.position.y < -500) {
                const angle = Math.random() * Math.PI * 2.0;
                const r = wispyDist * (0.6 + Math.random() * 0.38);
                dummy.position.set(
                    playerX + Math.cos(angle) * r,
                    230 + Math.random() * 150,
                    playerZ + Math.sin(angle) * r
                );
                dummy.rotation.set(0, Math.random() * Math.PI, 0);
                dummy.scale.set((2.0 + Math.random() * 1.5) * params.cloudScaleWispy, (0.4 + Math.random() * 0.4) * params.cloudScaleWispy, (1.8 + Math.random() * 1.5) * params.cloudScaleWispy);
            }
            dummy.position.x += 5.0 * dt;
            dummy.updateMatrix();
            instWispyClouds.setMatrixAt(i, dummy.matrix);
        }
        instWispyClouds.instanceMatrix.needsUpdate = true;

        // Distant Mega Painted Clouds (Hovering at max altitude horizon)
        const megaDist = 3800;
        const megaTeleport = megaDist * 1.15;
        for (let i = 0; i < MEGA_CLOUD_COUNT; i++) {
            instMegaClouds.getMatrixAt(i, dummy.matrix);
            dummy.position.setFromMatrixPosition(dummy.matrix);
            if (Math.abs(dummy.position.x - playerX) > megaTeleport || Math.abs(dummy.position.z - playerZ) > megaTeleport || dummy.position.y < -500) {
                const ang = Math.random() * Math.PI * 2.0;
                const r = megaDist * (0.6 + Math.random() * 0.38);
                dummy.position.set(
                    playerX + Math.cos(ang) * r,
                    450 + Math.random() * 400,
                    playerZ + Math.sin(ang) * r
                );
                dummy.rotation.set(0, Math.random() * Math.PI, 0);
                dummy.scale.set((3.0 + Math.random() * 2.5) * params.cloudScaleMega, (1.4 + Math.random() * 1.2) * params.cloudScaleMega, (3.0 + Math.random() * 2.5) * params.cloudScaleMega);
            }
            dummy.position.x += 0.8 * dt;
            dummy.updateMatrix();
            instMegaClouds.setMatrixAt(i, dummy.matrix);
        }
        instMegaClouds.instanceMatrix.needsUpdate = true;

        // Distant Horizon Clouds (Billboarded PNGs)


        // === TREE VISIBILITY: runs EVERY FRAME (not gated by shouldUpdateTerrain) ===
        // We calculate treesPossibleNearby here so we can fully hide tree meshes and save massive GPU vertex processing
        let treesPossibleNearby = false;
        {
            const isFreeCamVis = (window.editorState && window.editorState.isEditorMode) || isGodMode;
            const visFocusX = isFreeCamVis ? (isGodMode ? godCamera.position.x : camera.position.x) : playerX;
            const visFocusZ = isFreeCamVis ? (isGodMode ? godCamera.position.z : camera.position.z) : playerZ;
            
            const checkDist = 800; // max tree radius
            const points = [
                { x: visFocusX, z: visFocusZ },
                { x: visFocusX + checkDist, z: visFocusZ },
                { x: visFocusX - checkDist, z: visFocusZ },
                { x: visFocusX, z: visFocusZ + checkDist },
                { x: visFocusX, z: visFocusZ - checkDist }
            ];
            
            for (let pIdx = 0; pIdx < points.length; pIdx++) {
                const p = points[pIdx];
                const biome = getBiomeAt(p.x, p.z);
                const islandData = getIslandData(p.x, p.z);
                if (biome && biome.treesOk && islandData.mask > 0.0) {
                    treesPossibleNearby = true;
                    break;
                }
            }

            // Check BOTH b1 and b2 — at biome borders mainBiome may still be non-jungle
            // even though the terrain is visually blending into jungle
            const _visData = getIslandData(visFocusX, visFocusZ);
            const _b1Jungle = _visData.b1 && _visData.b1.name && _visData.b1.name.toLowerCase().includes('jungle');
            const _b2Jungle = _visData.b2 && _visData.b2.name && _visData.b2.name.toLowerCase().includes('jungle');
            const _inJungle = _b1Jungle || _b2Jungle;
            
            const showAnyTrees = params.showTrees && treesPossibleNearby;
            
            if (treeMeshes) treeMeshes.forEach(m => m.visible = showAnyTrees && !_inJungle);
            if (window.instPalmTreeParts) window.instPalmTreeParts.forEach(m => m.visible = showAnyTrees && !_inJungle);
            if (typeof instBillboardTrees !== 'undefined') instBillboardTrees.visible = false;
            if (typeof instJungleBillboardTrees !== 'undefined') instJungleBillboardTrees.visible = false;
            if (window.instJungleTreeParts) window.instJungleTreeParts.forEach(m => m.visible = showAnyTrees);
        }

        if (shouldUpdateTerrain) {
            // Center tree updates on camera position when in editor/freecam/God Mode or player when flying
            const isFreeCam = (window.editorState && window.editorState.isEditorMode) || isGodMode;
            const focusX = isFreeCam ? (isGodMode ? godCamera.position.x : camera.position.x) : playerX;
            const focusZ = isFreeCam ? (isGodMode ? godCamera.position.z : camera.position.z) : playerZ;
            
            // Ghibli biome trees: deterministic cell-hash placement, three LOD bands.
            // Runs on the same focus point as the pines so editor/God-mode freecam works.
            if (ghibliTrees && ghibliTrees.ready) {
                ghibliTrees.update(focusX, focusZ);
            }


            // STRICT 800-METER TREE RADIUS WITH SEAMLESS PROGRESSIVE LOD HANDOFF
            const activeTreeDist = 800;
            const dense3dRadius = 420; // 3D GLB trees spawn from 0m to 420m
            const billboardMinDist = 380; // Billboards spawn from 380m out to 800m (40m overlap ring)
            const billboardMaxDist = 800;
            // Re-enable frustum culling on the recycled instanced meshes.
            //
            // These all had frustumCulled = false, so every instance was submitted every frame
            // regardless of where the camera pointed -- ~970 pines plus jungle and palm parts
            // vertex-shaded while facing the other way. The flag was off because the meshes are
            // recycled around the player, which makes the geometry's own bounding sphere stale
            // instantly. Setting an explicit sphere centred on the focus point fixes that
            // properly: culling comes back and nothing pops, because the radius is padded well
            // past the spawn radius rather than fitted tightly.
            {
                const cullRadius = dense3dRadius + 120;   // spawn radius + tallest tree + slack
                const applyCullSphere = (m) => {
                    if (!m) return;
                    if (!m.boundingSphere) m.boundingSphere = new THREE.Sphere();
                    m.boundingSphere.center.set(focusX, 40, focusZ);
                    m.boundingSphere.radius = cullRadius;
                    m.frustumCulled = true;
                };
                if (typeof treeMeshes !== 'undefined') treeMeshes.forEach(applyCullSphere);
                if (window.instJungleTreeParts) window.instJungleTreeParts.forEach(applyCullSphere);
                if (window.instPalmTreeParts) window.instPalmTreeParts.forEach(applyCullSphere);
            }

            if (params.showTrees) {
                const playerBiome = getBiomeAt(focusX, focusZ);
                const playerInJungle = playerBiome && playerBiome.name ? playerBiome.name.toLowerCase().includes('jungle') : false;
                let treeSpawnAttemptsThisFrame = 0;
                const MAX_TREE_SPAWN_ATTEMPTS = 60;

                // Multi-scale spatial noise for natural species grove clustering
                function getForestClusterGroup(x, z) {
                    const n1 = Math.sin(x * 0.005 + z * 0.004) * Math.cos(x * 0.004 - z * 0.005);
                    const n2 = Math.sin(x * 0.012 + z * 0.010) * 0.3;
                    const val = n1 + n2;
                    if (val < -0.15) return 0;      // Grove A: Majestic / Tall Mountain Pines (Var 1, 2, 3)
                    else if (val < 0.25) return 1; // Grove B: Dense Alpine Evergreen Pines (Var 4, Fast, Fast 1)
                    else return 2;                 // Grove C: Highland Dwarf Pines & Saplings (Small 1, 2, 3, Sapling)
                }

                // 1. Update all 10 distinct stylized pine tree meshes with natural species groves
                pineTreeMeshes.forEach((mesh, pIdx) => {
                    const count = mesh.maxCount || mesh.count;
                    const clusterGroup = (mesh.config && mesh.config.clusterGroup !== undefined) ? mesh.config.clusterGroup : 0;
                    let meshUpdated = false;
                    for (let i = (currentFrame + pIdx * 2) % 15; i < count; i += 15) {
                        mesh.getMatrixAt(i, dummy.matrix);
                        dummy.position.setFromMatrixPosition(dummy.matrix);

                        // Optimization: if already despawned and no trees can spawn nearby, skip completely!
                        if (dummy.position.y < -500 && !treesPossibleNearby) {
                            continue;
                        }

                        // Also evict any pine that snuck into a jungle tile (biome border cleanup)
                        const treeBiome = getBiomeAt(dummy.position.x, dummy.position.z);
                        const treeInJungle = dummy.position.y > 0 && treeBiome && treeBiome.name && treeBiome.name.toLowerCase().includes('jungle');
                        if (playerInJungle || treeInJungle || Math.abs(dummy.position.x - focusX) > dense3dRadius || Math.abs(dummy.position.z - focusZ) > dense3dRadius || dummy.position.y < -500) {
                            if (dummy.position.y > 0) {
                                treeGrid.delete(getTreeCell(dummy.position.x, dummy.position.z));
                            }

                            let valid = false;
                            let nx, nz, h, pathVal, bName = '';
                            let attempts = 0;

                            if (!playerInJungle && treesPossibleNearby) {
                                while(!valid && attempts < 14 && treeSpawnAttemptsThisFrame < MAX_TREE_SPAWN_ATTEMPTS) {
                                    nx = focusX + (Math.random() - 0.5) * dense3dRadius * 2.0;
                                    nz = focusZ + (Math.random() - 0.5) * dense3dRadius * 2.0;

                                    // Natural species grove clustering filter (85% affinity for matching grove, 15% mixed undergrowth)
                                    const localGrove = getForestClusterGroup(nx, nz);
                                    if (localGrove !== clusterGroup && Math.random() > 0.15) {
                                        attempts++;
                                        continue;
                                    }

                                    // Tree density filter
                                    const treeDensity = params.ghibliTreeDensity !== undefined ? params.ghibliTreeDensity : 1.0;
                                    if (treeDensity < 1.0 && Math.random() > treeDensity) {
                                        attempts++;
                                        continue;
                                    }

                                    h = getWorldHeight(nx, nz);
                                    pathVal = getPathStrength(nx, nz);
                                    const bObj = getBiomeAt(nx, nz);
                                    bName = bObj && bObj.name ? bObj.name : '';

                                    let isGhibli = bName.includes('Ghibli Land');
                                    let isForest = true;
                                    let biomeMatch = isGhibli || (!bName.toLowerCase().includes('jungle') && !bName.includes('Crystal Land') && !bName.includes('Desert') && !bName.includes('Canyon') && !bName.includes('North Pole') && !bName.includes('Misty'));
                                    let islandMaskOk = (getIslandData(nx, nz).mask >= 0.35);

                                    let minElev = params.ghibliTreeMinHeight !== undefined ? params.ghibliTreeMinHeight : 6.8;
                                    let maxElev = params.ghibliTreeMaxHeight !== undefined ? params.ghibliTreeMaxHeight : 58.0;
                                    let elevationValid = (h >= minElev && h <= maxElev) && islandMaskOk;

                                    let minDist = params.ghibliTreeMinDist !== undefined ? params.ghibliTreeMinDist : 14.0;
                                    if (treeDensity > 1.0) {
                                        minDist = Math.max(6.0, minDist / Math.sqrt(treeDensity));
                                    }
                                    let minDistSq = minDist * minDist;

                                    if (isForest && elevationValid && pathVal < 0.20 && isTreeZone(nx, nz) && biomeMatch) {
                                        let cx = Math.floor(nx / TREE_CELL_SIZE);
                                        let cz = Math.floor(nz / TREE_CELL_SIZE);
                                        let tooClose = false;
                                        for (let dx = -1; dx <= 1 && !tooClose; dx++) {
                                            for (let dz = -1; dz <= 1 && !tooClose; dz++) {
                                                const ncx = (cx + dx + 32768) & 0xFFFF;
                                                const ncz = (cz + dz + 32768) & 0xFFFF;
                                                let neighbor = treeGrid.get((ncx << 16) | ncz);
                                                if (neighbor) {
                                                    if ((neighbor.x - nx)**2 + (neighbor.z - nz)**2 < minDistSq) tooClose = true;
                                                }
                                            }
                                        }
                                        if (!tooClose) valid = true;
                                    }
                                    attempts++;
                                    treeSpawnAttemptsThisFrame++;
                                }
                            }

                            if (valid) {
                                treeGrid.set(getTreeCell(nx, nz), {x: nx, z: nz});
                                dummy.position.set(nx, h, nz);
                                dummy.rotation.set(0, Math.random() * Math.PI * 2.0, 0);
                                const curScale = params.ghibliTreeScale !== undefined ? params.ghibliTreeScale : 1.2;
                                let baseS = (0.90 + Math.random() * 0.40) * curScale;
                                dummy.scale.set(baseS * (0.92 + Math.random() * 0.16), baseS * (0.94 + Math.random() * 0.12), baseS * (0.92 + Math.random() * 0.16));
                            } else {
                                dummy.position.set(0, -1000, 0);
                                dummy.scale.set(0, 0, 0);
                            }
                            dummy.updateMatrix();
                            mesh.setMatrixAt(i, dummy.matrix);
                            meshUpdated = true;
                        }
                    }
                    if (meshUpdated) mesh.instanceMatrix.needsUpdate = true;
                });

                // 2. Update jungle trees (instJungleTreeParts)
                if (window.instJungleTreeParts && window.instJungleTreeParts.length > 0) {
                    const firstPart = window.instJungleTreeParts[0];
                    const countJ = firstPart.count;
                    let jungleUpdated = false;
                    for (let i = (currentFrame + 5) % 15; i < countJ; i += 15) {
                        firstPart.getMatrixAt(i, dummy.matrix);
                        dummy.position.setFromMatrixPosition(dummy.matrix);

                        // Optimization: if already despawned and no trees can spawn nearby, skip completely!
                        if (dummy.position.y < -500 && !treesPossibleNearby) {
                            continue;
                        }

                        if (Math.abs(dummy.position.x - focusX) > dense3dRadius || Math.abs(dummy.position.z - focusZ) > dense3dRadius || dummy.position.y < -500) {
                            if (dummy.position.y > 0) {
                                treeGrid.delete(getTreeCell(dummy.position.x, dummy.position.z));
                            }

                            let valid = false;
                            let nx, nz, h, pathVal, bName = '';
                            let attempts = 0;

                            if (treesPossibleNearby) {
                                while(!valid && attempts < 12 && treeSpawnAttemptsThisFrame < MAX_TREE_SPAWN_ATTEMPTS) {
                                    nx = focusX + (Math.random() - 0.5) * dense3dRadius * 2.0;
                                    nz = focusZ + (Math.random() - 0.5) * dense3dRadius * 2.0;
                                    h = getWorldHeight(nx, nz);
                                    pathVal = getPathStrength(nx, nz);
                                    const bObj = getBiomeAt(nx, nz);
                                    bName = bObj && bObj.name ? bObj.name : '';

                                    let isForest = true;
                                    let biomeMatch = bName.includes('Jungle');
                                    let islandMaskOk = (getIslandData(nx, nz).mask >= 0.35);
                                    
                                    // Jungle trees spawn all the way up the canopy hills!
                                    let elevationValid = (h >= 6.8 && h <= 110.0) && islandMaskOk;

                                    if (isForest && elevationValid && pathVal < 0.20 && isTreeZone(nx, nz) && biomeMatch) {
                                        let cx = Math.floor(nx / TREE_CELL_SIZE);
                                        let cz = Math.floor(nz / TREE_CELL_SIZE);
                                        let tooClose = false;
                                        for (let dx = -1; dx <= 1 && !tooClose; dx++) {
                                            for (let dz = -1; dz <= 1 && !tooClose; dz++) {
                                                const ncx = (cx + dx + 32768) & 0xFFFF;
                                                const ncz = (cz + dz + 32768) & 0xFFFF;
                                                let neighbor = treeGrid.get((ncx << 16) | ncz);
                                                if (neighbor) {
                                                    if ((neighbor.x - nx)**2 + (neighbor.z - nz)**2 < 36) tooClose = true;
                                                }
                                            }
                                        }
                                        if (!tooClose) valid = true;
                                    }
                                    attempts++;
                                    treeSpawnAttemptsThisFrame++;
                                }
                            }

                            if (valid) {
                                treeGrid.set(getTreeCell(nx, nz), {x: nx, z: nz});
                                dummy.position.set(nx, h, nz);
                                dummy.rotation.set(0, Math.random() * Math.PI * 2.0, 0);
                                let baseS = 1.6 + Math.random() * 1.0; // Giant canopy trees!
                                dummy.scale.set(baseS * (0.92 + Math.random() * 0.16), baseS * (0.94 + Math.random() * 0.12), baseS * (0.92 + Math.random() * 0.16));

                                window.instJungleTreeParts.forEach(part => {
                                    const leafHslAttr = part.geometry.getAttribute('aLeafHslShift');
                                    const barkHslAttr = part.geometry.getAttribute('aBarkHslShift');
                                    if (leafHslAttr && barkHslAttr) {
                                        if (window.treeBillboardEditor) {
                                            const activeVars = window.treeBillboardEditor.getActiveVariants();
                                            if (activeVars.length > 0) {
                                                const v = activeVars[Math.floor(Math.random() * activeVars.length)];
                                                leafHslAttr.setXYZ(i, v.leafHueShift / 360.0, v.leafSatShift / 100.0, v.leafLitShift / 100.0);
                                                barkHslAttr.setXYZ(i, v.barkHueShift / 360.0, v.barkSatShift / 100.0, v.barkLitShift / 100.0);
                                            } else {
                                                leafHslAttr.setXYZ(i, 0.0, 0.0, 0.0);
                                                barkHslAttr.setXYZ(i, 0.0, 0.0, 0.0);
                                            }
                                        }
                                        leafHslAttr.needsUpdate = true;
                                        barkHslAttr.needsUpdate = true;
                                    }
                                });
                            } else {
                                dummy.position.set(0, -1000, 0);
                                dummy.scale.set(0, 0, 0);
                            }
                            dummy.updateMatrix();
                            window.instJungleTreeParts.forEach(part => {
                                part.setMatrixAt(i, dummy.matrix);
                            });
                            jungleUpdated = true;
                        }
                    }
                    if (jungleUpdated) {
                        window.instJungleTreeParts.forEach(part => {
                            part.instanceMatrix.needsUpdate = true;
                        });
                    }
                }

                // 3. Update Palm trees near water (window.instPalmTreeParts)
                if (window.instPalmTreeParts && window.instPalmTreeParts.length > 0) {
                    const firstPart = window.instPalmTreeParts[0];
                    const countP = firstPart.count;
                    let palmUpdated = false;
                    for (let i = (currentFrame + 10) % 15; i < countP; i += 15) {
                        firstPart.getMatrixAt(i, dummy.matrix);
                        dummy.position.setFromMatrixPosition(dummy.matrix);

                        // Optimization: if already despawned and no trees can spawn nearby, skip completely!
                        if (dummy.position.y < -500 && !treesPossibleNearby) {
                            continue;
                        }

                        if (Math.abs(dummy.position.x - focusX) > dense3dRadius || Math.abs(dummy.position.z - focusZ) > dense3dRadius || dummy.position.y < -500) {
                            if (dummy.position.y > 0) {
                                treeGrid.delete(getTreeCell(dummy.position.x, dummy.position.z));
                            }

                            let valid = false;
                            let nx, nz, h, pathVal, bName = '';
                            let attempts = 0;

                            if (treesPossibleNearby) {
                                while(!valid && attempts < 25 && treeSpawnAttemptsThisFrame < MAX_TREE_SPAWN_ATTEMPTS) {
                                    nx = focusX + (Math.random() - 0.5) * dense3dRadius * 2.0;
                                    nz = focusZ + (Math.random() - 0.5) * dense3dRadius * 2.0;
                                    h = getWorldHeight(nx, nz);
                                    pathVal = getPathStrength(nx, nz);
                                    const bObj = getBiomeAt(nx, nz);
                                    bName = bObj && bObj.name ? bObj.name : '';

                                    let islandMaskOk = (getIslandData(nx, nz).mask >= 0.35);
                                    // Water edge elevation range: strictly near water level (6.1m to 12.0m)
                                    let elevationValid = (h >= 6.1 && h <= 12.0) && islandMaskOk;
                                    // Palm trees don't belong in Ghibli Land
                                    let biomeAllowed = !bName.includes('Ghibli Land');

                                    if (elevationValid && biomeAllowed && pathVal < 0.20 && isTreeZone(nx, nz)) {
                                        let cx = Math.floor(nx / TREE_CELL_SIZE);
                                        let cz = Math.floor(nz / TREE_CELL_SIZE);
                                        let tooClose = false;
                                        for (let dx = -1; dx <= 1 && !tooClose; dx++) {
                                            for (let dz = -1; dz <= 1 && !tooClose; dz++) {
                                                const ncx = (cx + dx + 32768) & 0xFFFF;
                                                const ncz = (cz + dz + 32768) & 0xFFFF;
                                                let neighbor = treeGrid.get((ncx << 16) | ncz);
                                                if (neighbor) {
                                                    if ((neighbor.x - nx)**2 + (neighbor.z - nz)**2 < 25) tooClose = true;
                                                }
                                            }
                                        }
                                        if (!tooClose) valid = true;
                                    }
                                    attempts++;
                                    treeSpawnAttemptsThisFrame++;
                                }
                            }

                            if (valid) {
                                treeGrid.set(getTreeCell(nx, nz), {x: nx, z: nz});
                                dummy.position.set(nx, h, nz);
                                dummy.rotation.set(0, Math.random() * Math.PI * 2.0, 0);
                                let baseS = 1.0 + Math.random() * 0.3;
                                dummy.scale.set(baseS * (0.95 + Math.random() * 0.1), baseS * (0.95 + Math.random() * 0.1), baseS * (0.95 + Math.random() * 0.1));

                                window.instPalmTreeParts.forEach(part => {
                                    const leafHslAttr = part.geometry.getAttribute('aLeafHslShift');
                                    const barkHslAttr = part.geometry.getAttribute('aBarkHslShift');
                                    if (leafHslAttr && barkHslAttr) {
                                        leafHslAttr.setXYZ(i, 0.0, 0.0, 0.0);
                                        barkHslAttr.setXYZ(i, 0.0, 0.0, 0.0);
                                        leafHslAttr.needsUpdate = true;
                                        barkHslAttr.needsUpdate = true;
                                    }
                                });
                            } else {
                                dummy.position.set(0, -1000, 0);
                                dummy.scale.set(0, 0, 0);
                            }
                            dummy.updateMatrix();
                            window.instPalmTreeParts.forEach(part => {
                                part.setMatrixAt(i, dummy.matrix);
                            });
                            palmUpdated = true;
                        }
                    }
                    if (palmUpdated) {
                        window.instPalmTreeParts.forEach(part => {
                            part.instanceMatrix.needsUpdate = true;
                        });
                    }
                }

            // Single Billboard Tree (DISABLED EVERYWHERE)
            }

        } // End of shouldUpdateTerrain block

        // Animals


    }

    // ==========================================
    // 7. PLAYER SETUP
    // ==========================================
    playerGrp = new THREE.Group();
    playerGrp.position.set(0, 50, 0);
    scene.add(playerGrp);
    window.playerGrp = playerGrp;

    const playerVisuals = new THREE.Group();
    playerGrp.add(playerVisuals);

    const proxyGeo = new THREE.BoxGeometry(1.5, 0.5, 3);
    const proxyMat = new THREE.MeshToonMaterial({ color: 0xcc4444, gradientMap });
    const proxyMesh = new THREE.Mesh(proxyGeo, proxyMat);
    proxyMesh.castShadow = true;
    playerVisuals.add(proxyMesh);

    // Dual Warm Illumination Lights on Both Sides of Kiki
    const kikiLeftLight = new THREE.PointLight(0xffaa44, 2.5, 300, 1.2);
    kikiLeftLight.position.set(-35, 15, 10);
    playerVisuals.add(kikiLeftLight);

    const kikiRightLight = new THREE.PointLight(0xffaa44, 2.5, 300, 1.2);
    kikiRightLight.position.set(35, 15, 10);
    playerVisuals.add(kikiRightLight);

    // Load GLTF Model Loaders
    const gltfLoader = new GLTFLoader();
    
    // Initialize DRACOLoader for compressed GLB meshes
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    gltfLoader.setDRACOLoader(dracoLoader);
    
    // Initialize KTX2Loader for compressed textures
    const ktx2Loader = new KTX2Loader()
        .setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/libs/basis/')
        .detectSupport(renderer);
    gltfLoader.setKTX2Loader(ktx2Loader);
    
    // Initialize MeshoptDecoder for compressed geometries
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // Flight Model Manager initialization
    const flightModelManager = new FlightModelManager(playerVisuals, gltfLoader, resolveAssetUrl);
    window.flightModelManager = flightModelManager;

    // ==========================================
    // GHIBLI BIOME TREES (procedural, instanced, LOD)
    // ==========================================
    const ghibliTrees = new GhibliTreeSystem({
        scene,
        gltfLoader,
        resolveAssetUrl,
        uTime: terrainUniforms.uTime,
        gradientMap,
        getWorldHeight,
        getBiomeAt,
        getIslandData,
        getPathStrength,
        densityScale: tierSettings.treeDensity
    });
    window.ghibliTrees = ghibliTrees;
    ghibliTrees.load().then(ok => {
        if (ok) {
            console.info(`[Wanderlust] Ghibli trees ready — pools near/mid/far =`,
                ghibliTrees.poolSizes, `(tier ${deviceTier})`);
            ghibliTrees.respawn();
        } else {
            console.warn('[Wanderlust] Ghibli tree system failed to build geometry');
        }
    }).catch(err => console.error('[Wanderlust] Ghibli tree load failed:', err));

    let isModelVisible = true;
    let isSoundMuted = false;
    let isEngineSoundOn = true;

    // Procedural Biplane Engine Audio
    const biplaneAudio = new BiplaneEngineAudio(null);
    window.biplaneAudio = biplaneAudio;

    function onFlightModelChanged(cfg) {
        if (!cfg) return;
        const isPlane = !!cfg.isPlane;
        if (biplaneAudio) {
            if (isPlane && isEngineSoundOn && !isSoundMuted) {
                biplaneAudio.setActive(true);
            } else {
                biplaneAudio.setActive(false);
            }
        }
        const topEngineBtn = document.getElementById('top-engine-btn');
        if (topEngineBtn) {
            topEngineBtn.style.display = isPlane ? 'inline-flex' : 'none';
        }
        const charBtn = document.getElementById('char-toggle');
        if (charBtn) {
            charBtn.innerText = `MODEL: ${cfg.name.toUpperCase()}`;
        }
        const topModelDisplay = document.getElementById('top-model-display');
        if (topModelDisplay) {
            topModelDisplay.textContent = cfg.name;
        }
        if (typeof flightModelDropdownController !== 'undefined' && flightModelDropdownController) {
            if (flightModelDropdownController.getValue() !== cfg.id) {
                flightModelDropdownController.setValue(cfg.id);
            }
        }
    }

    // Initialize initial state for engine button based on starting model
    const initCfg = flightModelManager.getCurrentConfig();
    if (initCfg) {
        onFlightModelChanged(initCfg);
    }

    window.addEventListener('flight-model-changed', (e) => {
        if (e.detail && e.detail.config) {
            onFlightModelChanged(e.detail.config);
        }
    });

    // Sound control functions
    function setSoundMuted(muted) {
        isSoundMuted = !!muted;
        if (biplaneAudio) {
            biplaneAudio.setMuted(isSoundMuted);
        }
        if (windGain && audioCtx) {
            if (isSoundMuted) {
                windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
            }
        }
        if (musicGain && audioCtx) {
            musicGain.gain.setTargetAtTime(isSoundMuted ? 0 : 0.5, audioCtx.currentTime, 0.05);
        }
        const soundBtn = document.getElementById('sound-toggle-btn');
        if (soundBtn) {
            soundBtn.innerText = isSoundMuted ? 'SOUND: OFF' : 'SOUND: ON';
        }
        if (typeof soundMuteController !== 'undefined' && soundMuteController) {
            soundMuteController.setValue(!isSoundMuted);
        }
    }
    window.setSoundMuted = setSoundMuted;

    function setEngineSoundEnabled(enabled) {
        isEngineSoundOn = !!enabled;
        if (biplaneAudio) {
            biplaneAudio.setEnabled(isEngineSoundOn);
            const curCfg = flightModelManager.getCurrentConfig();
            if (curCfg && curCfg.isPlane && isEngineSoundOn && !isSoundMuted) {
                biplaneAudio.setActive(true);
            } else {
                biplaneAudio.setActive(false);
            }
        }
        const topEngineBtn = document.getElementById('top-engine-btn');
        if (topEngineBtn) {
            topEngineBtn.style.opacity = isEngineSoundOn ? '1' : '0.45';
            topEngineBtn.style.color = isEngineSoundOn ? '#4ade80' : 'rgba(255, 255, 255, 0.6)';
            topEngineBtn.title = isEngineSoundOn ? 'Engine Sound: ON (Click to Mute)' : 'Engine Sound: OFF (Click to Enable)';
        }
        const engineBtn = document.getElementById('engine-sound-btn');
        if (engineBtn) {
            engineBtn.innerText = isEngineSoundOn ? 'ENGINE: ON' : 'ENGINE: OFF';
        }
        const engineToggleBtn = document.getElementById('engine-sound-toggle');
        if (engineToggleBtn) {
            engineToggleBtn.innerText = isEngineSoundOn ? 'Engine Sound: ON' : 'Engine Sound: OFF';
        }
        if (typeof engineSoundController !== 'undefined' && engineSoundController) {
            engineSoundController.setValue(isEngineSoundOn);
        }
    }
    window.setEngineSoundEnabled = setEngineSoundEnabled;

    function updateModelVisibility() {
        if (flightModelManager) {
            flightModelManager.setVisible(isModelVisible);
        }
        const btn = document.getElementById('invis-toggle');
        if (btn) btn.innerText = isModelVisible ? 'Model: VISIBLE' : 'Model: INVISIBLE';
    }

    document.getElementById('invis-toggle')?.addEventListener('click', () => {
        isModelVisible = !isModelVisible;
        updateModelVisibility();
        if (typeof params !== 'undefined') params.modelVisible = isModelVisible;
    });

    document.getElementById('char-toggle')?.addEventListener('click', () => {
        if (flightModelManager) {
            flightModelManager.nextModel();
        }
    });

    document.getElementById('sound-toggle-btn')?.addEventListener('click', () => {
        setSoundMuted(!isSoundMuted);
    });

    document.getElementById('engine-sound-btn')?.addEventListener('click', () => {
        setEngineSoundEnabled(!isEngineSoundOn);
    });

    document.getElementById('engine-sound-toggle')?.addEventListener('click', () => {
        setEngineSoundEnabled(!isEngineSoundOn);
    });

    document.getElementById('top-engine-btn')?.addEventListener('click', () => {
        setEngineSoundEnabled(!isEngineSoundOn);
    });

    document.getElementById('top-music-btn')?.addEventListener('click', () => {
        document.getElementById('music-toggle')?.click();
    });

    // Top Bar Minimal Model Switcher UI Initialization
    const topModelDisplay = document.getElementById('top-model-display');
    const topModelPrev = document.getElementById('top-model-prev-btn');
    const topModelNext = document.getElementById('top-model-next-btn');

    if (topModelDisplay && initCfg) {
        topModelDisplay.textContent = initCfg.name;
    }

    if (topModelDisplay) {
        topModelDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof flightModelManager !== 'undefined' && flightModelManager) {
                flightModelManager.nextModel();
            }
        });
    }

    if (topModelPrev) {
        topModelPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof flightModelManager !== 'undefined' && flightModelManager) {
                flightModelManager.prevModel();
            }
        });
    }

    if (topModelNext) {
        topModelNext.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof flightModelManager !== 'undefined' && flightModelManager) {
                flightModelManager.nextModel();
            }
        });
    }

    window.updateCustomModelTransform = function(model) {
        if (!model) return;
        const ud = model.userData;
        model.position.x = ud.offsetX;
        model.position.z = ud.offsetZ;
        const h = getWorldHeight(ud.offsetX, ud.offsetZ);
        model.position.y = h + ud.offsetY;
        const s = ud.baseScale * ud.scaleMult;
        model.scale.set(s, s, s);
        model.rotation.y = ud.rotationY;
    };

    window.syncSlidersToSelectedModel = function() {
        const model = loadedCustomModels[selectedModelIndex];
        if (!model) return;
        
        const ud = model.userData;
        
        // Temporarily disable callbacks or manually change params value to avoid double calls
        params.customModelScale = ud.scaleMult;
        params.customModelY = ud.offsetY;
        params.customModelX = ud.offsetX;
        params.customModelZ = ud.offsetZ;
        params.customModelRot = Math.round(ud.rotationY * 180 / Math.PI);
        
        if (customModelControllers.scale) customModelControllers.scale.updateDisplay();
        if (customModelControllers.y) customModelControllers.y.updateDisplay();
        if (customModelControllers.x) {
            customModelControllers.x.min(ud.offsetX - 100);
            customModelControllers.x.max(ud.offsetX + 100);
            customModelControllers.x.updateDisplay();
        }
        if (customModelControllers.z) {
            customModelControllers.z.min(ud.offsetZ - 100);
            customModelControllers.z.max(ud.offsetZ + 100);
            customModelControllers.z.updateDisplay();
        }
        if (customModelControllers.rot) customModelControllers.rot.updateDisplay();
    };

    window.rebuildModelDropdown = function() {
        if (!modelDropdownController) return;
        
        const options = {};
        if (loadedCustomModels.length === 0) {
            options['No models'] = 0;
            selectedModelIndex = -1;
        } else {
            loadedCustomModels.forEach((m, idx) => {
                options[`Model ${idx + 1}`] = idx;
            });
        }
        
        modelDropdownController.options(options);
        if (selectedModelIndex >= 0) {
            modelDropdownController.setValue(selectedModelIndex);
        }
        modelDropdownController.updateDisplay();
    };

    window.cloneSelectedModel = function() {
        const source = loadedCustomModels[selectedModelIndex];
        if (!source) return;
        
        const clone = source.clone();
        
        // Deep copy the custom materials to allow independent coloring/scaling if needed
        clone.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(m => m.clone());
                } else {
                    child.material = child.material.clone();
                }
            }
        });
        
        clone.userData = {
            baseScale: source.userData.baseScale,
            scaleMult: source.userData.scaleMult,
            offsetX: source.userData.offsetX + 4.0,
            offsetY: source.userData.offsetY,
            offsetZ: source.userData.offsetZ + 4.0,
            rotationY: source.userData.rotationY
        };
        
        scene.add(clone);
        loadedCustomModels.push(clone);
        selectedModelIndex = loadedCustomModels.length - 1;
        
        window.updateCustomModelTransform(clone);
        window.rebuildModelDropdown();
        window.syncSlidersToSelectedModel();
    };

    window.deleteSelectedModel = function() {
        const model = loadedCustomModels[selectedModelIndex];
        if (!model) return;
        
        scene.remove(model);
        loadedCustomModels.splice(selectedModelIndex, 1);
        
        if (loadedCustomModels.length === 0) {
            selectedModelIndex = -1;
            if (customModelFolder) customModelFolder.close();
        } else {
            selectedModelIndex = Math.max(0, selectedModelIndex - 1);
            window.syncSlidersToSelectedModel();
        }
        
        window.rebuildModelDropdown();
    };

    window.loadCustomModelInGame = function(file) {
        const url = URL.createObjectURL(file);
        gltfLoader.load(url, (gltf) => {
            const model = gltf.scene;

            // Traverse and convert all materials to MeshToonMaterial with in-game gradientMap
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        const convertMaterial = (mat) => {
                            if (!mat) return null;
                            if (mat.isMeshToonMaterial) {
                                mat.gradientMap = gradientMap;
                                mat.needsUpdate = true;
                                return mat;
                            }
                            const toonMat = new THREE.MeshToonMaterial({
                                color: mat.color || new THREE.Color(0xffffff),
                                map: mat.map,
                                vertexColors: mat.vertexColors || false,
                                gradientMap: gradientMap,
                                normalMap: mat.normalMap,
                                normalScale: mat.normalScale,
                                aoMap: mat.aoMap,
                                aoMapIntensity: mat.aoMapIntensity,
                                lightMap: mat.lightMap,
                                lightMapIntensity: mat.lightMapIntensity,
                                emissive: mat.emissive || new THREE.Color(0x000000),
                                emissiveMap: mat.emissiveMap,
                                emissiveIntensity: mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 1.0,
                                displacementMap: mat.displacementMap,
                                displacementScale: mat.displacementScale,
                                displacementBias: mat.displacementBias,
                                alphaMap: mat.alphaMap,
                                transparent: mat.transparent,
                                opacity: mat.opacity !== undefined ? mat.opacity : 1.0,
                                side: mat.side || THREE.FrontSide,
                                depthWrite: mat.depthWrite !== undefined ? mat.depthWrite : true,
                                depthTest: mat.depthTest !== undefined ? mat.depthTest : true,
                                wireframe: mat.wireframe || false,
                                dithering: true
                            });
                            return toonMat;
                        };

                        if (Array.isArray(child.material)) {
                            child.material = child.material.map(m => convertMaterial(m));
                        } else {
                            child.material = convertMaterial(child.material);
                        }
                    }
                }
            });

            // Calculate spawn positions right in front of the player
            let spawnX = 0.0, spawnZ = 0.0;
            const spawnOffset = new THREE.Vector3(0, 0, -8);
            if (typeof playerGrp !== 'undefined') {
                spawnOffset.applyQuaternion(playerGrp.quaternion);
                spawnX = playerGrp.position.x + spawnOffset.x;
                spawnZ = playerGrp.position.z + spawnOffset.z;
            }

            // Auto-scale to fit a height of ~4.5 units
            model.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const baseScale = maxDim > 0 ? (4.5 / maxDim) : 1.0;

            // Create a parent wrapper group to center the pivot and align bottom to y=0
            const wrapper = new THREE.Group();
            model.position.set(-center.x, -box.min.y, -center.z);
            wrapper.add(model);

            // Configure initial userData
            wrapper.userData = {
                baseScale: baseScale,
                scaleMult: 1.0,
                offsetX: spawnX,
                offsetY: 0.0,
                offsetZ: spawnZ,
                rotationY: 0.0
            };

            loadedCustomModels.push(wrapper);
            selectedModelIndex = loadedCustomModels.length - 1;

            window.updateCustomModelTransform(wrapper);
            window.rebuildModelDropdown();
            window.syncSlidersToSelectedModel();

            if (customModelFolder) customModelFolder.open();
            scene.add(wrapper);

            URL.revokeObjectURL(url);
        }, undefined, (error) => {
            console.error("Custom GLTF load error:", error);
            alert("Failed to load the custom GLTF model. Check console for error details.");
            URL.revokeObjectURL(url);
        });
    };

    // Add drag and drop listeners
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
            e.preventDefault();
            window.loadCustomModelInGame(file);
        }
    });

    // ==========================================
    // GLB Tree Loader — Ghibli Atlas & Instancing
    // ==========================================

    function applyGLBPineTree(gltf, targetInstancedMeshes, targetHeight) {
        gltf.scene.updateMatrixWorld(true);
        const childMeshes = [];
        gltf.scene.traverse((child) => {
            if (child.isMesh) childMeshes.push(child);
        });
        if (childMeshes.length === 0) return;

        const bbox = new THREE.Box3().setFromObject(gltf.scene);
        const modelHeight = bbox.max.y - bbox.min.y;
        const sc = modelHeight > 0 ? (targetHeight / modelHeight) : 1.0;
        const offsetY = -bbox.min.y;

        // Check if there is an atlas map on the GLTF mesh
        let atlasMap = null;
        for (let i = 0; i < childMeshes.length; i++) {
            const m = childMeshes[i];
            if (m.material) {
                if (m.material.map) {
                    atlasMap = m.material.map;
                    break;
                } else if (Array.isArray(m.material) && m.material[0] && m.material[0].map) {
                    atlasMap = m.material[0].map;
                    break;
                }
            }
        }

        let customTreeMat = matTree;
        if (atlasMap) {
            atlasMap.colorSpace = THREE.SRGBColorSpace;
            customTreeMat = new MeshToonNodeMaterial({
                color: new THREE.Color(0xffffff),
                map: atlasMap,
                gradientMap: gradientMap,
                alphaTest: 0.35,
                side: THREE.DoubleSide,
                transparent: false,
                depthWrite: true,
                depthTest: true,
                dithering: true
            });
            if (typeof windSwayNode === 'function') {
                customTreeMat.positionNode = windSwayNode(terrainUniforms.uTime, treeUniforms.uTreeScale);
            }
        }

        targetInstancedMeshes.forEach((instMesh) => {
            const geos = [];

            childMeshes.forEach((m) => {
                const g = m.geometry.clone();
                g.applyMatrix4(m.matrixWorld);
                g.translate(0, offsetY, 0);
                g.scale(sc, sc, sc);

                // Strip embedded/dark vertex colors from GLB file if any
                if (g.attributes.color) g.deleteAttribute('color');

                const vertCount = g.attributes.position.count;
                const isBarkArr = new Float32Array(vertCount);

                if (Array.isArray(m.material) && g.groups && g.groups.length > 0) {
                    const indexAttr = g.index;
                    g.groups.forEach((group) => {
                        const mat = m.material[group.materialIndex];
                        const matName = (mat && mat.name) ? mat.name.toLowerCase() : '';
                        const isBark = matName.includes('bark') || matName.includes('trunk') || matName.includes('wood') || matName.includes('m_trunk');
                        const start = group.start;
                        const count = group.count;
                        for (let i = start; i < start + count; i++) {
                            const vertIdx = indexAttr ? indexAttr.getX(i) : i;
                            if (vertIdx < vertCount) {
                                isBarkArr[vertIdx] = isBark ? 1.0 : 0.0;
                            }
                        }
                    });
                } else {
                    const matName = (m.material && m.material.name) ? m.material.name.toLowerCase() : '';
                    const childName = (m.name || '').toLowerCase();
                    const isBark = matName.includes('bark') || matName.includes('trunk') || matName.includes('wood') || 
                                   childName.includes('bark') || childName.includes('trunk') || childName.includes('wood') || 
                                   matName.includes('m_trunk') || childName.includes('m_trunk');
                    isBarkArr.fill(isBark ? 1.0 : 0.0);
                }

                g.setAttribute('aIsBark', new THREE.BufferAttribute(isBarkArr, 1));

                if (!g.index) {
                    const indices = new Uint32Array(vertCount);
                    for (let i = 0; i < vertCount; i++) indices[i] = i;
                    g.setIndex(new THREE.BufferAttribute(indices, 1));
                }

                g.computeBoundingBox();
                g.computeBoundingSphere();
                geos.push(g);
            });

            const mergedGeom = BufferGeometryUtils.mergeGeometries(geos, false);
            if (!mergedGeom) return;
            mergedGeom.computeVertexNormals();
            mergedGeom.computeBoundingBox();
            mergedGeom.computeBoundingSphere();

            instMesh.geometry = mergedGeom;
            instMesh.material = customTreeMat;
            instMesh.instanceColor = null;
            instMesh.instanceMatrix.needsUpdate = true;
        });
    }

    // Asynchronously load ALL 10 GLTF Ghibli tree assets into their respective instanced meshes
    PINE_CONFIGS.forEach((cfg, idx) => {
        const instMesh = pineTreeMeshes[idx];
        const fullUrl = resolveAssetUrl(cfg.path);
        gltfLoader.load(fullUrl, (gltf) => {
            applyGLBPineTree(gltf, [instMesh], cfg.height);
            console.log('Successfully loaded and applied Ghibli tree model:', cfg.name, fullUrl);
        }, undefined, (err) => {
            console.error('Failed to load Ghibli tree model:', fullUrl, err);
        });
    });

    window.instJungleTreeParts = [];

    // Load Big_tree_03_ivy.glb for all 600 3D jungle tree instances
    gltfLoader.load(resolveAssetUrl('assets/nature_jungle_assets_extracted/super_compressed/TREE/Big_tree_03_ivy.glb'), (gltf) => {
        gltf.scene.updateMatrixWorld(true);
        const childMeshes = [];
        gltf.scene.traverse((child) => {
            if (child.isMesh) childMeshes.push(child);
        });
        if (childMeshes.length === 0) return;

        const bbox = new THREE.Box3().setFromObject(gltf.scene);
        const modelHeight = bbox.max.y - bbox.min.y;
        const targetHeight = 36.0;
        const sinkingDepth = 7.0;
        const sc = modelHeight > 0 ? (targetHeight / modelHeight) : 1.0;
        const offsetY = -bbox.min.y;

        childMeshes.forEach((m) => {
            // Clone the geometry and bake parent matrices, translations, and scaling into it
            const g = m.geometry.clone();
            g.applyMatrix4(m.matrixWorld);
            // Translate the geometry down by 7.0 units in world space (7.0 / sc) so the root base sits at terrain level
            g.translate(0, offsetY - sinkingDepth / sc, 0);
            g.scale(sc, sc, sc);

            // Compute indices if not present
            if (!g.index) {
                const vertCount = g.attributes.position.count;
                const indices = new Uint32Array(vertCount);
                for (let i = 0; i < vertCount; i++) indices[i] = i;
                g.setIndex(new THREE.BufferAttribute(indices, 1));
            }
            g.computeBoundingBox();
            g.computeBoundingSphere();

            // Set up HSL shift attributes for this geometry
            const count = 180;
            const leafHslArr = new Float32Array(count * 3);
            const barkHslArr = new Float32Array(count * 3);
            const aLeafHslShift = new THREE.InstancedBufferAttribute(leafHslArr, 3);
            const aBarkHslShift = new THREE.InstancedBufferAttribute(barkHslArr, 3);
            g.setAttribute('aLeafHslShift', aLeafHslShift);
            g.setAttribute('aBarkHslShift', aBarkHslShift);

            // Classify mesh as trunk vs leaf
            const matName = (m.material && m.material.name) ? m.material.name.toLowerCase() : '';
            const isBark = matName.includes('batang') || matName.includes('akar') || matName.includes('bark') || matName.includes('wood');
            const isLeaf = matName.includes('daun') || matName.includes('ivy');

            // Convert material to MeshToonMaterial with in-game gradientMap and preserve texture/alpha test
            const toonMat = new MeshToonNodeMaterial({
                color: new THREE.Color(0xffffff),
                map: m.material.map,
                vertexColors: m.material.vertexColors || false,
                gradientMap: gradientMap,
                // Remove normal/alpha maps to force a flat toon style
                // Make leaves fully opaque and non-see-through to increase opacity
                transparent: isLeaf ? false : (m.material.transparent || false),
                alphaTest: isLeaf ? 0.45 : (m.material.alphaTest || 0.0),
                opacity: 1.0,
                side: THREE.DoubleSide,
                depthWrite: true,
                depthTest: true,
                dithering: true
            });

            const instMesh = new THREE.InstancedMesh(g, toonMat, 180);
            instMesh.castShadow = true;
            instMesh.receiveShadow = true;
            instMesh.frustumCulled = false;
            
            // Initialize positions to hidden
            const dummyMatrix = new THREE.Matrix4();
            dummyMatrix.makeScale(0, 0, 0);
            dummyMatrix.setPosition(0, -1000, 0);
            for(let i=0; i<180; i++) {
                instMesh.setMatrixAt(i, dummyMatrix);
            }
            instMesh.instanceMatrix.needsUpdate = true;

            scene.add(instMesh);
            window.instJungleTreeParts.push(instMesh);
        });
    });

    window.instPalmTreeParts = [];

    // Load Palm1_VAR5.glb for 3D palm tree instances near water
    gltfLoader.load(resolveAssetUrl('assets/Palm1_VAR5/Palm1_VAR5.glb'), (gltf) => {
        gltf.scene.updateMatrixWorld(true);
        const childMeshes = [];
        gltf.scene.traverse((child) => {
            if (child.isMesh) childMeshes.push(child);
        });
        if (childMeshes.length === 0) return;

        const bbox = new THREE.Box3().setFromObject(gltf.scene);
        const modelHeight = bbox.max.y - bbox.min.y;
        const targetHeight = 20.0;
        const sinkingDepth = 6.0;
        const sc = modelHeight > 0 ? (targetHeight / modelHeight) : 1.0;
        const offsetY = -bbox.min.y;

        const maxPalmCount = 100;

        childMeshes.forEach((m) => {
            const g = m.geometry.clone();
            g.applyMatrix4(m.matrixWorld);
            // Translate the geometry down by 6.0 units in world space (6.0 / sc) to submerge roots under terrain
            g.translate(0, offsetY - sinkingDepth / sc, 0);
            g.scale(sc, sc, sc);

            if (!g.index) {
                const vertCount = g.attributes.position.count;
                const indices = new Uint32Array(vertCount);
                for (let i = 0; i < vertCount; i++) indices[i] = i;
                g.setIndex(new THREE.BufferAttribute(indices, 1));
            }
            g.computeBoundingBox();
            g.computeBoundingSphere();

            const leafHslArr = new Float32Array(maxPalmCount * 3);
            const barkHslArr = new Float32Array(maxPalmCount * 3);
            const aLeafHslShift = new THREE.InstancedBufferAttribute(leafHslArr, 3);
            const aBarkHslShift = new THREE.InstancedBufferAttribute(barkHslArr, 3);
            g.setAttribute('aLeafHslShift', aLeafHslShift);
            g.setAttribute('aBarkHslShift', aBarkHslShift);

            const matName = (m.material && m.material.name) ? m.material.name.toLowerCase() : '';
            const meshName = (m.name || '').toLowerCase();
            const isBark = matName.includes('bark') || matName.includes('trunk') || matName.includes('wood') || matName.includes('batang') || meshName.includes('bark') || meshName.includes('trunk') || meshName.includes('stem');
            const isLeaf = matName.includes('leaf') || matName.includes('leaves') || matName.includes('frond') || matName.includes('palm') || matName.includes('daun') || meshName.includes('leaf') || meshName.includes('palm');

            const toonMat = new MeshToonNodeMaterial({
                color: new THREE.Color(0xffffff),
                map: m.material ? m.material.map : null,
                vertexColors: (m.material && m.material.vertexColors) ? m.material.vertexColors : false,
                gradientMap: gradientMap,
                // Removed normal maps for flat toon shading
                transparent: isLeaf ? false : ((m.material && m.material.transparent) || false),
                alphaTest: isLeaf ? 0.35 : ((m.material && m.material.alphaTest) || 0.0),
                opacity: 1.0,
                side: THREE.DoubleSide,
                depthWrite: true,
                depthTest: true,
                dithering: true
            });

            const instMesh = new THREE.InstancedMesh(g, toonMat, maxPalmCount);
            instMesh.castShadow = true;
            instMesh.receiveShadow = true;
            instMesh.frustumCulled = false;

            const dummyMatrix = new THREE.Matrix4();
            dummyMatrix.makeScale(0, 0, 0);
            dummyMatrix.setPosition(0, -1000, 0);
            for (let i = 0; i < maxPalmCount; i++) {
                instMesh.setMatrixAt(i, dummyMatrix);
            }
            instMesh.instanceMatrix.needsUpdate = true;

            scene.add(instMesh);
            window.instPalmTreeParts.push(instMesh);
        });
    });

    // Initialize Tree & Billboard Editor
    const treeBillboardEditor = new TreeBillboardEditor(scene, camera, gltfLoader);
    window.treeBillboardEditor = treeBillboardEditor;

    treeBillboardEditor.onApply((preset, variants) => {
        const fullUrl = resolveAssetUrl(preset.glbPath);
        gltfLoader.load(fullUrl, (gltf) => {
            const targetMesh = pineTreeMeshes.find(m => m.config && m.config.path === preset.glbPath) || pineTreeMeshes[0];
            applyGLBPineTree(gltf, [targetMesh], preset.targetHeight);
        });

        // Also assign variant colors to 3D jungle tree parts
        if (variants && variants.length > 0 && window.instJungleTreeParts && window.instJungleTreeParts.length > 0) {
            window.instJungleTreeParts.forEach(part => {
                const countJ = part.count;
                const leafHslAttrJ = part.geometry.getAttribute('aLeafHslShift');
                const barkHslAttrJ = part.geometry.getAttribute('aBarkHslShift');
                if (leafHslAttrJ && barkHslAttrJ) {
                    for (let i = 0; i < countJ; i++) {
                        const v = variants[Math.floor(Math.random() * variants.length)];
                        leafHslAttrJ.setXYZ(i, v.leafHueShift / 360.0, v.leafSatShift / 100.0, v.leafLitShift / 100.0);
                        barkHslAttrJ.setXYZ(i, v.barkHueShift / 360.0, v.barkSatShift / 100.0, v.barkLitShift / 100.0);
                    }
                    leafHslAttrJ.needsUpdate = true;
                    barkHslAttrJ.needsUpdate = true;
                }
            });
        }

        // Distant billboard trees disabled everywhere
    });



    // Load Initial Flight Model
    flightModelManager.loadModelByIndex(0, true).then(() => {
        if (typeof proxyMesh !== 'undefined' && proxyMesh) {
            proxyMesh.visible = false;
        }
    }).catch(err => {
        console.warn("Failed to load initial flight model:", err);
    });

    



    
    // ==========================================
    // 8. INPUTS (Keyboard & Touch)
    // ==========================================
    const keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
    const touchState = { x: 0, y: 0, boost: false, brake: false };
    let uiVisible = true;

    let pcControlsShown = false;

    window.addEventListener('keydown', e => {
        const pcHint = document.getElementById('pc-controls-hint');
        if (pcHint && !pcControlsShown && e.key !== 'F12' && e.key !== 'F5') {
            pcHint.style.display = 'block';
            pcControlsShown = true;
            setTimeout(() => { 
                const h = document.getElementById('pc-controls-hint');
                if (h) h.style.opacity = '0'; 
            }, 10000);
        }

        if(e.key.toLowerCase() === 'w' || e.key === 'ArrowUp') keys.w = true;
        if(e.key.toLowerCase() === 's' || e.key === 'ArrowDown') keys.s = true;
        if(e.key.toLowerCase() === 'a' || e.key === 'ArrowLeft') keys.a = true;
        if(e.key.toLowerCase() === 'd' || e.key === 'ArrowRight') keys.d = true;
        if(e.key === 'Shift') keys.shift = true;
        if(e.key === ' ') keys.space = true;
        if(e.key.toLowerCase() === 'h') {
            toggleGUI();
        }
        if(e.key.toLowerCase() === 'v') {
            isModelVisible = !isModelVisible;
            updateModelVisibility();
        }
        if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            if(e.key.toLowerCase() === 'c') {
                if (typeof flightModelManager !== 'undefined' && flightModelManager) {
                    if (e.shiftKey) flightModelManager.prevModel();
                    else flightModelManager.nextModel();
                }
            }
            if(e.key.toLowerCase() === 'n') {
                if (typeof setEngineSoundEnabled === 'function') {
                    setEngineSoundEnabled(!isEngineSoundOn);
                }
            }
            if(e.key.toLowerCase() === 'm') {
                if (typeof setSoundMuted === 'function') {
                    setSoundMuted(!isSoundMuted);
                }
            }
        }
    });
    window.addEventListener('keyup', e => {
        if(e.key.toLowerCase() === 'w' || e.key === 'ArrowUp') keys.w = false;
        if(e.key.toLowerCase() === 's' || e.key === 'ArrowDown') keys.s = false;
        if(e.key.toLowerCase() === 'a' || e.key === 'ArrowLeft') keys.a = false;
        if(e.key.toLowerCase() === 'd' || e.key === 'ArrowRight') keys.d = false;
        if(e.key === 'Shift') keys.shift = false;
        if(e.key === ' ') keys.space = false;
    });



    const joyBase = document.getElementById('joystick-base');
    const joyKnob = document.getElementById('joystick-knob');
    let activeTouchId = null;
    let isMouseDraggingJoy = false;
    const maxRadius = 60;

    const isMobileMode = document.documentElement.classList.contains('force-mobile') || 
                         document.body.classList.contains('force-mobile') || 
                         window.innerWidth <= 1024;

    if (joyBase) {
        joyBase.style.display = 'none';
        joyBase.style.opacity = '0';
        joyBase.style.pointerEvents = 'none';
    }

    let initialPinchDist = null;
    let initialZoomDist = null;

    // Joystick mouse interaction for desktop preview / simulator
    if (joyBase) {
        joyBase.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
            isMouseDraggingJoy = true;
            joyBase.style.opacity = '1';
            joyBase.style.background = 'rgba(255,255,255,0.25)';
            updateJoystick(e);
        });

        window.addEventListener('mousemove', e => {
            if (isMouseDraggingJoy) {
                e.preventDefault();
                updateJoystick(e);
            }
        });

        window.addEventListener('mouseup', () => {
            if (isMouseDraggingJoy) {
                isMouseDraggingJoy = false;
                resetJoystick();
            }
        });
    }

    window.addEventListener('touchstart', e => {
        if (e.target.tagName !== 'CANVAS' && e.target !== joyBase && e.target !== joyKnob) return;
        e.preventDefault();

        if (e.touches.length === 1) {
            const touch = e.changedTouches[0];
            activeTouchId = touch.identifier;
            updateJoystick(touch);
        } else if (e.touches.length === 2) {
            resetJoystick();
            
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDist = Math.sqrt(dx*dx + dy*dy);
            initialZoomDist = cameraZoomDist;
        }
    }, {passive: false});

    window.addEventListener('touchmove', e => {
        if (e.target.tagName !== 'CANVAS') return;
        e.preventDefault();

        if (e.touches.length === 2 && initialPinchDist !== null) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const newDist = Math.sqrt(dx*dx + dy*dy);
            
            cameraZoomDist = initialZoomDist * (newDist / initialPinchDist);
            const mobileZoomMin = deviceTier === 'mobile' ? 12.0 : 5.0;
            cameraZoomDist = Math.max(mobileZoomMin, Math.min(300.0, cameraZoomDist));
            localStorage.setItem('wl_zoomDist', cameraZoomDist);

            const zoomToggleBtn = document.getElementById('zoom-toggle');
            if (zoomToggleBtn) {
                if (cameraZoomDist > 25.0) zoomToggleBtn.innerText = 'Zoom In';
                else zoomToggleBtn.innerText = 'Zoom Out';
            }
        } else {
            for(let touch of e.changedTouches) {
                if(touch.identifier === activeTouchId) updateJoystick(touch);
            }
        }
    }, {passive: false});

    const resetJoystick = () => {
        activeTouchId = null;
        touchState.x = 0; touchState.y = 0;
        if (joyKnob) joyKnob.style.transform = `translate(-50%, -50%)`;
        if (joyBase) {
            joyBase.style.opacity = '0';
            joyBase.style.display = 'none';
        }
    };

    window.addEventListener('touchend', e => {
        for(let touch of e.changedTouches) {
            if(touch.identifier === activeTouchId) resetJoystick();
        }
        if (e.touches.length < 2) {
            initialPinchDist = null;
        }
    });
    window.addEventListener('touchcancel', e => {
        resetJoystick();
        initialPinchDist = null;
    });

    function updateJoystick(touch) {
        if (!joyBase || !joyKnob) return;
        const rect = joyBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if(dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
        }
        joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        touchState.x = dx / maxRadius;
        touchState.y = dy / maxRadius;
    }

    const boostBtn = document.getElementById('boost-btn');
    if (boostBtn) {
        const startBoost = (e) => { e.preventDefault(); touchState.boost = true; boostBtn.style.transform = 'scale(0.9)'; };
        const resetBoost = (e) => { e.preventDefault(); touchState.boost = false; boostBtn.style.transform = 'scale(1)'; };
        boostBtn.addEventListener('touchstart', startBoost);
        boostBtn.addEventListener('mousedown', startBoost);
        boostBtn.addEventListener('touchend', resetBoost);
        boostBtn.addEventListener('touchcancel', resetBoost);
        boostBtn.addEventListener('mouseup', resetBoost);
        boostBtn.addEventListener('mouseleave', resetBoost);
    }




    // ==========================================
    // 9. FLIGHT PHYSICS & RENDER LOOP
    // ==========================================
    let velocity = 15.0; 
    let pitch = 0, yaw = 0, roll = 0;
    const BASE_FOV = 60;
    // (Removed) Low-poly particle star field: 8,000 THREE.Points that were built, added to
    // the scene, then force-hidden every single frame. Stars now come from the procedural
    // sky shader instead — see starLayer() in src/shaders/atmosphere/proceduralSky.js.

    // --- Camera Rig Hierarchy ---
    cameraBase = new THREE.Group(); 
    scene.add(cameraBase);

    const cameraPivot = new THREE.Group(); 
    cameraPivot.rotation.order = 'YXZ';
    cameraBase.add(cameraPivot);

    camera.position.set(0, 4, 12); 
    cameraPivot.add(camera);

    // Initialize window.editorState and Terrain Editor
    window.editorState = {
        isEditorMode: false,
        isDragging: false,
        cameraPivot: cameraPivot,
        playerGrp: playerGrp,
        pauseFlight: () => { if (typeof isFlightPaused !== 'undefined') isFlightPaused = true; },
        resumeFlight: () => { if (typeof isFlightPaused !== 'undefined') isFlightPaused = false; },
        isFlightPaused: () => (typeof isFlightPaused !== 'undefined' ? isFlightPaused : false),
    };

    if (typeof initTerrainEditor === 'function') {
        initTerrainEditor(scene, camera, renderer, terrain);
    }

    // --- Pan Event Listeners (Handles Mouse & Mobile Touch Screen) ---
    let isDragging = false;
    let previousPointerPos = { x: 0, y: 0 };

    const onPointerDown = (event) => {
        isDragging = true;
        previousPointerPos = { x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event) => {
        if (!isDragging || isGodMode) return;
        const deltaX = event.clientX - previousPointerPos.x;
        const deltaY = event.clientY - previousPointerPos.y;

        // Orbit the pivot
        cameraPivot.rotation.y -= deltaX * 0.004;
        cameraPivot.rotation.x -= deltaY * 0.004;
        
        // Clamp vertical look to prevent the camera from flipping upside down
        cameraPivot.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 6, cameraPivot.rotation.x));

        previousPointerPos = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = () => isDragging = false;

    // Target the render canvas wrapper to parse inputs properly
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    const tempVec1 = new THREE.Vector3();
    const tempVec2 = new THREE.Vector3();
    const tempVec3 = new THREE.Vector3();
    const tempVecHorizon = new THREE.Vector3();
    const tempVecSunFwd = new THREE.Vector3();
    const tempVecMoonOff = new THREE.Vector3();
    const tempVecToLight = new THREE.Vector3();
    const tempColorTarget = new THREE.Color();

    // Exposure defaults live on `params` (dayExposure / nightExposure) so the sliders drive
    // them live. Dusk deliberately has NO slider and is hard-pinned to 1.0 below.

    let currentSunY = envConfigs[timePhase] ? envConfigs[timePhase].sunY : 160;
    let currentMoonY = envConfigs[timePhase] ? envConfigs[timePhase].moonY : 200;
    let currentFps = 60;

    let lastFpsTime = performance.now();
    let framesThisSecond = 0;
    let lastAnimTime = performance.now();
    let smoothedDt = 0.0166;


    let playerPhysics;
    let cameraManager;
    


    async function animate() {
        if (proceduralSkyMesh && !isGodMode) {
            camera.getWorldPosition(proceduralSkyMesh.position);
        }
        if (params.showMap) _drawWorldMap();
        
        const nowAnimTime = performance.now();
        let rawDt = (nowAnimTime - lastAnimTime) / 1000.0;

        if (!playerPhysics && typeof playerGrp !== 'undefined') {
            playerPhysics = new PlayerPhysics(playerGrp);
            cameraManager = new CameraManager(camera, cameraBase, cameraZoomDist);
        }
        lastAnimTime = nowAnimTime;
        adaptiveRes.sample(rawDt * 1000);
        if (rawDt > 0.1 || rawDt <= 0) rawDt = 0.0166;
        smoothedDt = smoothedDt * 0.7 + rawDt * 0.3;
        let dt = smoothedDt;

        const time = clock.getElapsedTime();

        if (animeWaterSystem && animeWaterSystem.visible) {
            const activeCam = isGodMode ? godCamera : camera;
            const _wsd = (dirLight && playerGrp) ? new THREE.Vector3().copy(dirLight.position).sub(playerGrp.position).normalize() : null;
            animeWaterSystem.update(dt, time, activeCam, playerGrp ? playerGrp.position : null, _wsd);
        }
        // Advance the amortised terrain depth-field bake (no-op when idle)
        if (animeWaterSystem) animeWaterSystem.tickDepthField();
        if (typeof terrainUniforms !== 'undefined') {
            terrainUniforms.uTime.value = time;
            if (typeof dirLight !== 'undefined') {
                terrainUniforms.uSunDir.value.copy(dirLight.position).sub(playerGrp.position).normalize();
            }
        }
        if (skyUniforms) {
            skyUniforms.uTime.value = time;
            if (typeof dirLight !== 'undefined' && typeof playerGrp !== 'undefined') {
                skyUniforms.uSunPosition.value.copy(dirLight.position).sub(playerGrp.position).normalize();
            }
        }
        if (typeof treeUniforms !== 'undefined') {
            treeUniforms.uPlayerPos.value.copy(playerGrp.position);
        }
        if (window.rainSystem) {
            const activeCam = isGodMode ? godCamera : camera;
            window.rainSystem.update(time, activeCam, params);
        }
        if (window.groundFogEditor && typeof playerGrp !== 'undefined' && playerGrp.position) {
            window.groundFogEditor.updateFrame(dt, timePhase);
            if (typeof window.fogUniforms !== 'undefined' && window.fogGroup) {
                window.fogUniforms.uTime.value = time;
                const currentB = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
                const bName = currentB ? currentB.name : 'Archipelago';
                const cleanB = cleanBiomeName(bName);
                const biomeFogOffset = (window.biomeFogSettings && window.biomeFogSettings[cleanB] !== undefined) ? window.biomeFogSettings[cleanB] : 0;
                const currentGroundY = getWorldHeight(playerGrp.position.x, playerGrp.position.z);
                
                // Smoothly position fog group at terrain / water level plus biome offset
                window.fogGroup.position.x = playerGrp.position.x;
                window.fogGroup.position.z = playerGrp.position.z;
                const baseFloor = Math.max(currentGroundY, 2.4);
                const targetFogY = baseFloor + biomeFogOffset;
                window.fogGroup.position.y += (targetFogY - window.fogGroup.position.y) * dt * 3.0;
            }
        }

        currentFrame++;
        framesThisSecond++;
        const currentGroundY = getWorldHeight(playerGrp.position.x, playerGrp.position.z);
        const currentAlt = Math.max(0, Math.round(playerGrp.position.y - currentGroundY));

        const now = performance.now();
        if (now - lastFpsTime >= 500) {
            currentFps = Math.round((framesThisSecond * 1000) / (now - lastFpsTime));
            framesThisSecond = 0;
            lastFpsTime = now;
            const fpsEl = document.getElementById('fps-counter');
            if (fpsEl) {
                fpsEl.innerText = `FPS ${currentFps}`;
            }
            const currZn = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
            const biomeEl = document.getElementById('biome-label');
            if (biomeEl) biomeEl.innerText = currZn.name;
        }

        
        // 3-Stage Lighting Engine Lerp
        const target = envConfigs[timePhase];
        const decayEnv = 1.0 - Math.exp(-2.0 * dt);

        // Per-phase exposure. Index 1 (Dusk) is EXACTLY 1.0 — a multiply by one cannot change
        // a pixel, so the golden dusk look is provably untouched by this whole system.
        // Day and Night read live from the sliders; Dusk is hard-pinned to 1.0 and has no slider.
        const targetExposure = timePhase === 0 ? params.dayExposure
                             : timePhase === 2 ? params.nightExposure
                             : 1.0;
        const wantExposure = targetExposure * params.exposureTrim;
        uPhaseExposure.value += (wantExposure - uPhaseExposure.value) * decayEnv;
        // Snap once the lerp is within a rounding error. Without this, returning to dusk from
        // another phase leaves the exposure at 0.9999... forever — visually identical, but the
        // dusk guarantee is meant to be exact, not approximate.
        if (Math.abs(wantExposure - uPhaseExposure.value) < 0.0005) uPhaseExposure.value = wantExposure;
        if (scene.background && scene.background.isColor) {
            scene.background.lerp(tempColorTarget.setHex(target.bg), decayEnv);
        }
        scene.fog.color.lerp(tempColorTarget.setHex(target.fog), decayEnv);
        
        ambientLight.color.lerp(tempColorTarget.setHex(target.amb), decayEnv);
        ambientLight.intensity += (target.ambI - ambientLight.intensity) * decayEnv;
        dirLight.color.lerp(tempColorTarget.setHex(target.dir), decayEnv);
        dirLight.intensity += (target.dirI - dirLight.intensity) * decayEnv;
        // Old points-based star field removed — the procedural sky now genuinely draws stars.
        // (It previously did not: the comment here claimed it did, but proceduralSky.js had no
        // star code at all, which is why night had none.)

        // Player warm lantern lights modulation (magical lantern at Twilight, warm rim at Dusk, subtle at Day)
        const kikiGlow = (timePhase === 2) ? 2.5 : (timePhase === 1 ? 1.4 : 0.4);
        if (typeof kikiLeftLight !== 'undefined' && typeof kikiRightLight !== 'undefined') {
            kikiLeftLight.intensity += (kikiGlow - kikiLeftLight.intensity) * decayEnv;
            kikiRightLight.intensity += (kikiGlow - kikiRightLight.intensity) * decayEnv;
        }

        // Procedural Sky — per-biome lerp + time of day factors
        if (skyUniforms && typeof playerGrp !== 'undefined') {
            const currentB = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
            const skyBiomeName = currentB ? currentB.name : '🌲 Ghibli Land';
            const biomeTarget = BIOME_SKY_CONFIGS[skyBiomeName] || BIOME_SKY_CONFIGS['🌊 Open Ocean'];
            const decaySky = 1.0 - Math.exp(-1.5 * dt);

            skyUniforms.uTime.value = time;
            if (typeof staticSun !== 'undefined') {
                skyUniforms.uSunPosition.value.copy(staticSun.position).sub(playerGrp.position).normalize();
            }

            skyUniforms.uCloudCoverage.value += (biomeTarget.coverage - skyUniforms.uCloudCoverage.value) * decaySky;
            skyUniforms.uCloudEdge.value += (biomeTarget.edge - skyUniforms.uCloudEdge.value) * decaySky;
            skyUniforms.uCloudSpeed.value += (biomeTarget.speed - skyUniforms.uCloudSpeed.value) * decaySky;
            skyUniforms.uCloudTurbulence.value += (biomeTarget.turbulence - skyUniforms.uCloudTurbulence.value) * decaySky;
            skyUniforms.uStormDarken.value += (biomeTarget.stormDarken - skyUniforms.uStormDarken.value) * decaySky;

            // Target factors strictly tied to active timePhase
            const targetNightFactor = (timePhase === 2) ? 1.0 : 0.0;
            const targetDuskFactor = (timePhase === 1) ? 1.0 : 0.0;
            skyUniforms.uNightFactor.value += (targetNightFactor - skyUniforms.uNightFactor.value) * decayEnv;
            skyUniforms.uDuskFactor.value += (targetDuskFactor - skyUniforms.uDuskFactor.value) * decayEnv;



            // Compute distinct zenith, mid, and horizon colors based on time of day
            let targetZenithHex = (timePhase === 1) ? target.bg : ((timePhase === 2) ? target.bg : biomeTarget.skyZenith);
            let targetMidHex = target.mid || 0x7ab4e6;
            let targetHorizonHex = (timePhase === 1) ? target.fog : ((timePhase === 2) ? target.fog : biomeTarget.skyHorizon);
            let targetCloudHex = (timePhase === 1) ? target.cloudCol : ((timePhase === 2) ? target.cloudCol : biomeTarget.cloudCol);
            let targetCloudShadowHex = biomeTarget.cloudShadow;

            skyUniforms.uSkyColorZenith.value.lerp(tempColorTarget.setHex(targetZenithHex), decaySky);
            if (skyUniforms.uSkyColorMid) {
                skyUniforms.uSkyColorMid.value.lerp(tempColorTarget.setHex(targetMidHex), decaySky);
            }
            skyUniforms.uSkyColorHorizon.value.lerp(tempColorTarget.setHex(targetHorizonHex), decaySky);
            skyUniforms.uCloudColor.value.lerp(tempColorTarget.setHex(targetCloudHex), decaySky);
            skyUniforms.uCloudShadowColor.value.lerp(tempColorTarget.setHex(targetCloudShadowHex), decaySky);
            skyUniforms.uSunColor.value.lerp(tempColorTarget.setHex(target.dir), decaySky);
            
            // Sync Open Sea Time Of Day
            zenithColorUniform.value.copy(skyUniforms.uSkyColorZenith.value);
            horizonColorUniform.value.copy(skyUniforms.uSkyColorHorizon.value);
            sunColorUniform.value.copy(dirLight.color);
            sunDirUniform.value.copy(dirLight.position).sub(playerGrp.position).normalize();

            // Weather override (storm/overcast)
            if (currentWeather !== 'clear') {
                const wp = WEATHER_PRESETS[currentWeather];
                if (wp) {
                    if (wp.coverage !== null) skyUniforms.uCloudCoverage.value += (wp.coverage - skyUniforms.uCloudCoverage.value) * decaySky;
                    if (wp.edge !== null) skyUniforms.uCloudEdge.value += (wp.edge - skyUniforms.uCloudEdge.value) * decaySky;
                    if (wp.speed !== null) skyUniforms.uCloudSpeed.value += (wp.speed - skyUniforms.uCloudSpeed.value) * decaySky;
                    skyUniforms.uCloudTurbulence.value += (wp.turbulence - skyUniforms.uCloudTurbulence.value) * decaySky;
                    skyUniforms.uStormDarken.value += (wp.stormDarken - skyUniforms.uStormDarken.value) * decaySky;
                }
            }
        }

        // Instanced mesh clouds remain visible (scene-level 3D clouds)
        if (typeof instClouds !== 'undefined') instClouds.visible = params.showClouds && params.showCloudsRegular;
        if (typeof instHighClouds !== 'undefined') instHighClouds.visible = params.showClouds && params.showCloudsHigh;
        if (typeof instWispyClouds !== 'undefined') instWispyClouds.visible = params.showClouds && params.showCloudsWispy;
        if (typeof instMegaClouds !== 'undefined') instMegaClouds.visible = params.showClouds && params.showCloudsMega;
        if (typeof instHorizonClouds1 !== 'undefined') instHorizonClouds1.visible = params.showCloudsHorizon;
        if (typeof instHorizonClouds2 !== 'undefined') instHorizonClouds2.visible = params.showCloudsHorizon;
        if (typeof instHorizonClouds3 !== 'undefined') instHorizonClouds3.visible = params.showCloudsHorizon;





        // Floating Crystals — respawn in Crystal Land
        const crystalDist = 1200;
        let inCrystalLand = false;
        if (typeof playerGrp !== 'undefined' && playerGrp.position) {
            const b = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
            inCrystalLand = b && b.name ? b.name.includes('Crystal') : false;
        }
        
        if (typeof instCrystals !== 'undefined') {
            instCrystals.visible = inCrystalLand;
        }

        if (inCrystalLand) {
            if (typeof matCrystal !== 'undefined' && matCrystal.userData.shader) {
                matCrystal.userData.shader.uniforms.uTime.value = time;
            }

            for (let i = 0; i < CRYSTAL_COUNT; i++) {
                instCrystals.getMatrixAt(i, dummy.matrix);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                
                if (dummy.position.y < -500 || Math.abs(dummy.position.x - playerGrp.position.x) > crystalDist || Math.abs(dummy.position.z - playerGrp.position.z) > crystalDist) {
                    const s = (30 + Math.random() * 60) * 3;
                    let dx = (Math.random() - 0.5) * crystalDist * 2.0;
                    let dz = (Math.random() - 0.5) * crystalDist * 2.0;
                    const cX = playerGrp.position.x + dx;
                    let cZ = playerGrp.position.z + dz;
                    const cGroundY = getWorldHeight(cX, cZ);
                    
                    let spawnY = cGroundY + 100 + Math.random() * 150;
                    if (i % 5 === 0) {
                        spawnY = cGroundY + 15 + (s * 3.0); 
                    }
                    
                    dummy.position.set(cX, spawnY, cZ);
                    dummy.scale.set(s * 0.6, s, s * 0.6);
                }
                
                // Constantly ensure they NEVER clip the ground wherever they drift
                const localGroundY = getWorldHeight(dummy.position.x, dummy.position.z);
                const minHeight = localGroundY + 15 + (dummy.scale.y * 3.0); 
                if (dummy.position.y < minHeight) {
                    dummy.position.y = minHeight;
                }

                dummy.position.y += Math.sin(time * 0.3 + i * 2.0) * 0.15;
                dummy.rotateY(0.002);
                dummy.updateMatrix();
                instCrystals.setMatrixAt(i, dummy.matrix);
            }
            instCrystals.instanceMatrix.needsUpdate = true;
        }



        const npBiome = (typeof playerGrp !== 'undefined' && playerGrp.position) ? getBiomeAt(playerGrp.position.x, playerGrp.position.z) : null;
        const inNorthPole = npBiome && npBiome.name ? npBiome.name.includes('North Pole') : false;
        instIcebergs.visible = inNorthPole;
        if (inNorthPole) {
            const icebergDist = 900;
            for (let i = 0; i < ICEBERG_COUNT; i++) {
                instIcebergs.getMatrixAt(i, dummy.matrix);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                if (dummy.position.y < -500 || Math.abs(dummy.position.x - playerGrp.position.x) > icebergDist || Math.abs(dummy.position.z - playerGrp.position.z) > icebergDist) {
                    let placed = false;
                    for (let att = 0; att < 8 && !placed; att++) {
                        const nx = playerGrp.position.x + (Math.random() - 0.5) * icebergDist * 2.0;
                        const nz = playerGrp.position.z + (Math.random() - 0.5) * icebergDist * 2.0;
                        const h = getWorldHeight(nx, nz);
                        const bObj = getBiomeAt(nx, nz);
                        const bName = bObj ? bObj.name : '';
                        if (bName.includes('North Pole') && h < 4.0 && h > -4.0) {
                            const s = 0.6 + Math.random() * 1.8;
                            dummy.position.set(nx, 1.0 + Math.random() * 1.5, nz);
                            dummy.rotation.set(0, Math.random() * Math.PI * 2.0, (Math.random() - 0.5) * 0.15);
                            dummy.scale.set(s * (0.7 + Math.random() * 0.3), s, s * (0.7 + Math.random() * 0.3));
                            placed = true;
                        }
                    }
                    if (!placed) {
                        dummy.position.set(0, -1000, 0);
                        dummy.scale.set(1, 1, 1);
                    }
                    dummy.updateMatrix();
                    instIcebergs.setMatrixAt(i, dummy.matrix);
                }
            }
            instIcebergs.instanceMatrix.needsUpdate = true;
        }

        let oldY = playerGrp.position.y;

        const isBraking = keys.space || touchState.brake;
        const isBoosting = keys.shift || touchState.boost;
        
        const inputState = {
            forward: true,
            up: keys.w || touchState.y < -0.1,
            down: keys.s || touchState.y > 0.1,
            left: keys.a || touchState.x < -0.1,
            right: keys.d || touchState.x > 0.1
        };

        const curWaterY = (animeWaterSystem && animeWaterSystem.waterLevel !== undefined) ? animeWaterSystem.waterLevel : 2.4;

        if (isGodMode && godControls) {
            updateGodMode(dt, keys, godControls, godCamera, curWaterY);
        }

        if (playerPhysics) {
            playerPhysics.update(dt, inputState, isBraking, isBoosting, isFlightPaused, treeGrid);
            
            if (cameraManager) {
                cameraManager.update(dt, playerGrp, playerPhysics.currentYaw, isBoosting, curWaterY);
            }
        }
    

        // Update Sun & Celestial positioning from active environment config
        const targetSunY = target.sunY;
        const decaySunY = 1.0 - Math.exp(-3.0 * dt);
        currentSunY += (targetSunY - currentSunY) * decaySunY;
        currentMoonY += (target.moonY - currentMoonY) * decaySunY;

        const azimuthRad = THREE.MathUtils.degToRad(params.sunAzimuth !== undefined ? params.sunAzimuth : 0);
        const sunDist = params.sunDistance || 20000;
        tempVecSunFwd.set(
            Math.sin(azimuthRad) * sunDist,
            0,
            -Math.cos(azimuthRad) * sunDist
        );
        if (params.lockSunToPlayer) {
            tempVecSunFwd.applyQuaternion(playerGrp.quaternion);
        }

        // Sun positioning & visibility
        staticSun.position.copy(playerGrp.position).add(tempVecSunFwd);
        staticSun.position.y = playerGrp.position.y * 0.45 + currentSunY;
        if (params.sunDiscScale && staticSun.scale.x !== params.sunDiscScale) {
            staticSun.scale.setScalar(params.sunDiscScale);
        }
        staticSun.visible = (timePhase !== 2);

        // Moon positioning
        tempVecMoonOff.copy(tempVecSunFwd).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 0.35);
        staticMoon.position.copy(playerGrp.position).add(tempVecMoonOff);
        staticMoon.position.y = playerGrp.position.y * 0.45 + currentMoonY;
        staticMoon.visible = (timePhase === 2);

        // Active celestial light source
        const activeLightTarget = (timePhase === 2) ? staticMoon : staticSun;
        tempVecToLight.copy(activeLightTarget.position).sub(playerGrp.position).normalize();
        dirLight.position.copy(playerGrp.position).add(tempVecToLight.multiplyScalar(2000));
        dirLight.target.position.copy(playerGrp.position);
        dirLight.target.updateMatrixWorld();

        // Cloud colors lerping
        if (typeof matCloud !== 'undefined') matCloud.color.lerp(tempColorTarget.setHex(target.cloudCol), decayEnv);
        if (typeof highCloudMat !== 'undefined') highCloudMat.color.lerp(tempColorTarget.setHex(target.cloudCol), decayEnv);
        if (typeof megaCloudMat !== 'undefined') megaCloudMat.color.lerp(tempColorTarget.setHex(target.cloudCol), decayEnv);
        if (typeof matWispyCloud !== 'undefined') matWispyCloud.color.lerp(tempColorTarget.setHex(target.cloudCol), decayEnv);
        
        // Dynamically scale up the terrain as Kiki flies high
        terrainScale = 1.0 + Math.min(1.0, Math.max(0.0, (playerGrp.position.y - 300.0) / 11700.0)) * 9.0;

        // Scale render distance (fog far) to reveal landscape when high
        // Setting it to 850 guarantees that the edge of the world (1200) and tree spawn distance (900) are fully hidden in fog!
        const dynamicFar = (800 + Math.max(0, playerGrp.position.y - 300.0) * 2.2) / params.fogIntensity;
        const dynamicNear = (10 + Math.max(0, playerGrp.position.y - 300.0) * 0.4) / params.fogIntensity;
        
        if (params.sceneFog && params.showFog !== false) {
            scene.fog.far += (dynamicFar - scene.fog.far) * dt * 2.0;
            scene.fog.near += (dynamicNear - scene.fog.near) * dt * 2.0;
        } else {
            scene.fog.near = 100000;
            scene.fog.far = 200000;
        }

        const altitude = Math.max(0, playerGrp.position.y - currentGroundY);

        // Dynamically adjust shadow map resolution based on altitude (quantized to prevent constant shadow re-renders)
        let baseS = 120, maxS = 250;
        if (shadowDistMode === 'Close') { baseS = 60; maxS = 120; }
        else if (shadowDistMode === 'Far') { baseS = 240; maxS = 500; }
        const rawShadowSize = THREE.MathUtils.lerp(baseS, maxS, Math.min(1, altitude / 150.0));
        const shadowSize = Math.round(rawShadowSize / 20.0) * 20.0;
        if (typeof window._currentShadowSize === 'undefined' || window._currentShadowSize !== shadowSize) {
            window._currentShadowSize = shadowSize;
            dirLight.shadow.camera.left = -shadowSize;
            dirLight.shadow.camera.right = shadowSize;
            dirLight.shadow.camera.top = shadowSize;
            dirLight.shadow.camera.bottom = -shadowSize;
            dirLight.shadow.camera.updateProjectionMatrix();
        }

        updateTerrainGeometry(playerGrp.position.x, playerGrp.position.z);
        updateInstances(playerGrp.position.x, playerGrp.position.z, time, dt, playerPhysics ? playerPhysics.currentYaw : 0);
        updateBirds(playerGrp.position.x, playerGrp.position.y, playerGrp.position.z, time, dt);
        
        if (isWindTrailsOn && isWindOn) {
            instTrails.visible = true;
            const trailOpacity = isBoosting ? 0.22 : 0.08;
            trailMat.opacity = trailOpacity;
            for (let i = 0; i < 100; i++) {
                let z = trailsData[i*4+2];
                z += playerPhysics ? playerPhysics.velocity : 18.0 * 3.0 * dt; 
                if (z > 50) {
                     z -= 100;
                     trailsData[i*4] = (Math.random() - 0.5) * 80;
                     trailsData[i*4+1] = (Math.random() - 0.5) * 60;
                }
                trailsData[i*4+2] = z;
                
                dummy.position.set(trailsData[i*4], trailsData[i*4+1], z);
                dummy.position.x += Math.sin(time * 3.0 + trailsData[i*4+3] * 10) * 0.5;
                dummy.position.y += Math.cos(time * 3.0 + trailsData[i*4+3] * 10) * 0.5;
                dummy.scale.set(1.0, 1.0, isBoosting ? 2.5 : 1.0);
                dummy.rotation.set(0,0,0);
                dummy.updateMatrix();
                instTrails.setMatrixAt(i, dummy.matrix);
            }
            instTrails.position.copy(playerGrp.position);
            instTrails.rotation.copy(playerGrp.rotation);
            instTrails.instanceMatrix.needsUpdate = true;
        } else {
            instTrails.visible = false;
        }

        if (audioCtx && audioCtx.state === 'running' && windGain && windFilter) {
            if (!isWindOn || !isBoosting || isSoundMuted) {
                windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15);
            } else {
                const speedFactor = Math.max(0, Math.min(1, ((playerPhysics ? playerPhysics.velocity : 18.0) - 15) / 30)); 
                const targetVolume = 0.25 + speedFactor * 0.35;
                windGain.gain.setTargetAtTime(targetVolume, audioCtx.currentTime, 0.1);
                
                const targetFreq = 400 + Math.sin(time) * 100 + speedFactor * 800; 
                windFilter.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.1);
            }
        }

        if (typeof flightModelManager !== 'undefined' && flightModelManager) {
            flightModelManager.update(dt);
        }

        if (typeof biplaneAudio !== 'undefined' && biplaneAudio) {
            const currentSpeed = playerPhysics ? playerPhysics.velocity : 18.0;
            const isBoosting = typeof isBoosted !== 'undefined' ? isBoosted : false;
            const isBraking = typeof isBrakingActive !== 'undefined' ? isBrakingActive : false;
            const isFlightPaused = typeof isPaused !== 'undefined' ? isPaused : false;
            const camDist = cameraManager ? cameraManager.cameraZoomDist : 12.0;
            const turnRate = playerPhysics ? (playerPhysics.targetRoll || 0) : 0;
            const pitchRate = playerPhysics ? (playerPhysics.targetPitch || 0) : 0;
            biplaneAudio.update(dt, isBoosting, isBraking, isFlightPaused, currentSpeed, camDist, turnRate, pitchRate);
        }

        // Deep clouds track player (Removed)





        // Update God Rays sun screen position & horizon line
        if (godRaysPass.enabled && typeof staticSun !== 'undefined') {
            const activeCam = isGodMode ? godCamera : camera;
            activeCam.getWorldDirection(tempVec1);
            const camWorldPos = tempVec3;
            activeCam.getWorldPosition(camWorldPos);

            // Compute exact screen-space horizon Y position to mask god rays away from ocean/ground
            const camHorizX = tempVec1.x;
            const camHorizZ = tempVec1.z;
            const horizLen = Math.hypot(camHorizX, camHorizZ);
            if (horizLen > 0.001) {
                tempVecHorizon.set(
                    camWorldPos.x + (camHorizX / horizLen) * 50000,
                    0.0,
                    camWorldPos.z + (camHorizZ / horizLen) * 50000
                );
                tempVecHorizon.project(activeCam);
                const horizonScreenY = (tempVecHorizon.y + 1.0) * 0.5;
                if (godRaysPass.uniforms.uHorizonY) {
                    godRaysPass.uniforms.uHorizonY.value = THREE.MathUtils.clamp(horizonScreenY, -0.2, 1.2);
                }
            }

            tempVecSunFwd.copy(staticSun.position).sub(camWorldPos).normalize();
            const dotFwd = tempVec1.dot(tempVecSunFwd);

            // Sun must strictly be in front of the camera to avoid negative-W clip inversion (projecting behind camera onto bottom-left water)
            if (dotFwd > 0.05) {
                tempVec2.copy(staticSun.position).project(activeCam);
                if (tempVec2.z < 1.0) {
                    const sunScreenX = (tempVec2.x + 1.0) * 0.5;
                    const sunScreenY = (tempVec2.y + 1.0) * 0.5;
                    godRaysPass.uniforms.uSunScreenPos.value.set(sunScreenX, 1.0 - sunScreenY);

                    const offScreen = Math.max(Math.abs(sunScreenX - 0.5), Math.abs(sunScreenY - 0.5));
                    const screenFade = 1.0 - Math.min(1.0, Math.max(0.0, (offScreen - 0.5) * 1.6));
                    const twilightFade = timePhase === 2 ? 0.0 : 1.0;
                    const fwdFade = THREE.MathUtils.smoothstep(dotFwd, 0.05, 0.35);
                    const sunHeightFade = THREE.MathUtils.smoothstep(staticSun.position.y, -100, 300);

                    godRaysPass.uniforms.uSunVisible.value = fwdFade * screenFade * twilightFade * sunHeightFade;
                } else {
                    godRaysPass.uniforms.uSunVisible.value = 0.0;
                }
            } else {
                godRaysPass.uniforms.uSunVisible.value = 0.0;
            }

            // uSunVisible already goes to 0 at night, off-screen and behind the camera, but
            // multiplying by it does not stop the 24-sample loop from running. Drop the node
            // out of the graph instead. Asymmetric thresholds give hysteresis so a sun sitting
            // exactly on the horizon cannot thrash the shader recompile every frame.
            const _rayVis = godRaysPass.uniforms.uSunVisible.value;
            if (_rayVis > 0.01) setGodRaySunVisible(true);
            else if (_rayVis < 0.001) setGodRaySunVisible(false);
        }

        if (typeof scenePass !== 'undefined' && scenePass) {
            scenePass.camera = isGodMode ? godCamera : camera;
        }

        await composer.renderAsync();
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        // Re-derive the pixel budget: dragging onto a 4K monitor must not quadruple the
        // framebuffer. setSize() alone never re-evaluated pixel ratio.
        if (params.autoResolution) applyRenderBudget(adaptiveRes.scale);
        if (composer && typeof composer.setSize === 'function') {
            composer.setSize(window.innerWidth, window.innerHeight);
        }
    });
    const timeToggleBtn = document.getElementById('time-toggle');
    const timeIcons = [
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>',
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="4.22" y1="6.22" x2="6.34" y2="8.34"/><line x1="19.78" y1="6.22" x2="17.66" y2="8.34"/><line x1="2" y1="18" x2="22" y2="18"/><line x1="5" y1="22" x2="19" y2="22"/></svg>',
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
    ];
    const timeNames = ['Day', 'Dusk', 'Twilight'];
    
    function setTimePhase(phase) {
        timePhase = (phase % 3 + 3) % 3;
        if (envConfigs[timePhase]) {
            params.sunAltitude = envConfigs[timePhase].sunY;
        }
        if (timeToggleBtn) {
            timeToggleBtn.innerHTML = timeIcons[timePhase];
            timeToggleBtn.title = `Current: ${timeNames[timePhase]} (Click to cycle)`;
        }
        localStorage.setItem('wl_timePhase', timePhase);
        if (typeof gui !== 'undefined') {
            gui.controllersRecursive().forEach(c => {
                if (c.property === 'sunAltitude') c.updateDisplay();
            });
        }
    }
    window.setTimePhase = setTimePhase;

    if (timeToggleBtn) {
        timeToggleBtn.innerHTML = timeIcons[timePhase] || timeIcons[0];
        timeToggleBtn.title = `Current: ${timeNames[timePhase] || 'Day'} (Click to cycle)`;

        timeToggleBtn.addEventListener('click', () => {
            setTimePhase(timePhase + 1);
        });
    }


    // ==========================================
    // 9. AUDIO (WIND SOUNDSCAPE)
    // ==========================================
    let audioCtx;
    let windGain, windFilter;

    function initAudio() {
        if (audioCtx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        audioCtx = new AudioContext();
        
        const bufferSize = audioCtx.sampleRate * 2; 
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1; 
        }
        
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;
        
        windFilter = audioCtx.createBiquadFilter();
        windFilter.type = 'lowpass';
        windFilter.frequency.value = 400; 
        
        windGain = audioCtx.createGain();
        windGain.gain.value = 0;
        
        noiseSource.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(audioCtx.destination);
        
        noiseSource.start();

        if (typeof biplaneAudio !== 'undefined' && biplaneAudio) {
            biplaneAudio.setAudioContext(audioCtx);
            const curCfg = (typeof flightModelManager !== 'undefined' && flightModelManager) ? flightModelManager.getCurrentConfig() : null;
            if (curCfg && curCfg.isPlane && isEngineSoundOn && !isSoundMuted) {
                biplaneAudio.setActive(true);
            }
        }
    }



    // ==========================================
    // 10. PROCEDURAL AMBIENT MUSIC
    // ==========================================
    let musicGain;
    let isMusicPlaying = false;
    let isAutoAdvance = true;
    let loopsPerTrack = 3;
    let currentTrack = 0;
    let nextNoteTime = 0;
    let musicTimerID;
    
    let chordIndex = 0;
    let sequenceTime = 0;
    let arpIndex = 0;

    let isSyncingTrack = false;
    function selectMusicTrack(idx) {
        if (isSyncingTrack) return;
        isSyncingTrack = true;
        try {
            currentTrack = ((idx % tracks.length) + tracks.length) % tracks.length;
            sequenceTime = 0;
            chordIndex = 0;
            arpIndex = 0;
            if (audioCtx) {
                nextNoteTime = audioCtx.currentTime + 0.1;
            }
            const trackBtn = document.getElementById('track-toggle');
            if (trackBtn) {
                trackBtn.innerText = "Track: " + tracks[currentTrack].name;
            }
            if (typeof trackDropdownController !== 'undefined' && trackDropdownController) {
                if (trackDropdownController.getValue() !== tracks[currentTrack].name) {
                    trackDropdownController.setValue(tracks[currentTrack].name);
                }
            }
        } finally {
            isSyncingTrack = false;
        }
    }
    window.selectMusicTrack = selectMusicTrack;

    const arpPatterns = [
        [0, 1, 2, 3, 4, 3, 2, 1],
        [0, 2, 1, 3, 2, 4, 3, 1],
        [0, 1, 3, 2, 4, 2, 3, 1],
        [0, 2, 4, 3, 2, 1, 0, 2]
    ];

    let spaceReverb;

    function createSpaceReverb() {
        if (!audioCtx) return null;
        const input = audioCtx.createGain();
        const output = audioCtx.createGain();

        const delayL = audioCtx.createDelay(1.0);
        const delayR = audioCtx.createDelay(1.0);
        delayL.delayTime.value = 0.42;
        delayR.delayTime.value = 0.63;

        const filterL = audioCtx.createBiquadFilter();
        const filterR = audioCtx.createBiquadFilter();
        filterL.type = 'lowpass';
        filterR.type = 'lowpass';
        filterL.frequency.value = 750;
        filterR.frequency.value = 650;

        const feedbackL = audioCtx.createGain();
        const feedbackR = audioCtx.createGain();
        feedbackL.gain.value = 0.45;
        feedbackR.gain.value = 0.40;

        input.connect(delayL);
        input.connect(delayR);

        delayL.connect(filterL);
        filterL.connect(feedbackL);
        feedbackL.connect(delayR);
        filterL.connect(output);

        delayR.connect(filterR);
        filterR.connect(feedbackR);
        feedbackR.connect(delayL);
        filterR.connect(output);

        return { input, output };
    }

    function playNote(freq, time, duration, oscType, isPad = false) {
        const osc = audioCtx.createOscillator();
        const env = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        
        osc.type = oscType;
        osc.frequency.value = freq;
        
        filter.type = 'lowpass';
        
        if (isPad) {
            filter.frequency.setValueAtTime(360, time);
            filter.Q.setValueAtTime(0.7, time);
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.045, time + Math.min(2.0, duration * 0.4));
            env.gain.linearRampToValueAtTime(0.0001, time + duration);
        } else {
            // Warm, mellow acoustic music-box tone without piercing high frequencies
            filter.frequency.setValueAtTime(550, time);
            filter.frequency.exponentialRampToValueAtTime(240, time + duration);
            filter.Q.setValueAtTime(0.8, time);
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.07, time + 0.06);
            env.gain.exponentialRampToValueAtTime(0.0005, time + duration);
        }
        
        osc.connect(filter);
        filter.connect(env);
        env.connect(musicGain);

        osc.onended = () => {
            try {
                osc.disconnect();
                filter.disconnect();
                env.disconnect();
            } catch (e) {}
        };
        
        osc.start(time);
        osc.stop(time + duration);
    }

    function scheduleNotes() {
        if (!isMusicPlaying || !audioCtx) return;
        const track = tracks[currentTrack];
        
        // Prevent massive scheduling clump if tab was inactive
        if (nextNoteTime < audioCtx.currentTime - 0.5) {
            nextNoteTime = audioCtx.currentTime + 0.1;
        }
        
        while (nextNoteTime < audioCtx.currentTime + 0.2) {
            
            // On chord change
            if (sequenceTime % track.speed === 0) {
                const chord = track.chords[chordIndex % track.chords.length];
                
                // Play warm pad for the chord
                chord.forEach((freq, idx) => {
                    const octaveDiv = (idx === 0) ? 2 : 1;
                    playNote(freq / octaveDiv, nextNoteTime, track.speed / 1000 * 1.35, track.padOsc, true);
                });
            }
            
            const chord = track.chords[chordIndex % track.chords.length];
            const pattern = arpPatterns[chordIndex % arpPatterns.length];
            
            // Gentle mellow acoustic/music-box arpeggio step (natural register, no high octaves)
            if (sequenceTime % track.stepSpeed === 0) {
                const noteFreq = chord[pattern[arpIndex % pattern.length] % chord.length];
                playNote(noteFreq, nextNoteTime, track.stepSpeed / 1000 * 2.2, track.leadOsc, false);
                arpIndex++;
                
                // Occasional slow calming melody note in the warm mid-range
                if (Math.random() > 0.72) {
                    const melFreq = chord[Math.floor(Math.random() * chord.length)];
                    playNote(melFreq, nextNoteTime, track.stepSpeed / 1000 * 3.5, track.leadOsc, false);
                }
            }
            
            // Timing
            nextNoteTime += track.stepSpeed / 1000;
            sequenceTime += track.stepSpeed;
            
            if (sequenceTime >= track.speed) {
                sequenceTime = 0;
                chordIndex++;
                arpIndex = 0;

                // Auto-advance to next track when progression completes loopsPerTrack loops
                if (isAutoAdvance && chordIndex >= track.chords.length * loopsPerTrack) {
                    selectMusicTrack(currentTrack + 1);
                }
            }
        }
        musicTimerID = setTimeout(scheduleNotes, 80);
    }

    document.getElementById('music-toggle').addEventListener('click', () => {
        initAudio(); 
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        if (!musicGain) {
            musicGain = audioCtx.createGain();
            musicGain.gain.value = 0.45;
            spaceReverb = createSpaceReverb();
            musicGain.connect(audioCtx.destination);
            if (spaceReverb) {
                const wetGain = audioCtx.createGain();
                wetGain.gain.value = 0.55;
                musicGain.connect(spaceReverb.input);
                spaceReverb.output.connect(wetGain);
                wetGain.connect(audioCtx.destination);
            }
        }

        isMusicPlaying = !isMusicPlaying;
        const trackBtn = document.getElementById('track-toggle');
        const topMusicBtn = document.getElementById('top-music-btn');
        if (isMusicPlaying) {
            sequenceTime = 0;
            chordIndex = 0;
            arpIndex = 0;
            nextNoteTime = audioCtx.currentTime + 0.1;
            scheduleNotes();
            document.getElementById('music-toggle').innerText = "Pause Music";
            trackBtn.style.display = "block";
            if (topMusicBtn) {
                topMusicBtn.style.opacity = '1';
                topMusicBtn.style.color = '#60a5fa';
                topMusicBtn.title = 'Music: PLAYING (Click to Pause)';
            }
        } else {
            clearTimeout(musicTimerID);
            document.getElementById('music-toggle').innerText = "Play Music";
            trackBtn.style.display = "none";
            if (topMusicBtn) {
                topMusicBtn.style.opacity = '0.65';
                topMusicBtn.style.color = 'rgba(255, 255, 255, 0.95)';
                topMusicBtn.title = 'Music: PAUSED (Click to Play)';
            }
        }
    });

    document.getElementById('track-toggle')?.addEventListener('click', () => {
        selectMusicTrack(currentTrack + 1);
    });

    window.addEventListener('keydown', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });
    document.addEventListener('click', initAudio, { once: true });

    // Pre-warm the world so it is fully populated instantly on load
    updateTerrainGeometry(playerGrp.position.x, playerGrp.position.z);
    isPrewarming = true;
    for (let pre = 0; pre < 10; pre++) {
        currentFrame = pre;
        logicTimer = 1.0; // Force shouldUpdateTerrain = true
        updateInstances(playerGrp.position.x, playerGrp.position.z, 0, 1.0 / 60.0, 0);
    }
    isPrewarming = false;
    currentFrame = 0;
    logicTimer = 0;

    // Atmosphere & Environment Master Editor (Appended to lil-gui)
    if (typeof gui !== 'undefined') {
        const atmoParams = {
            skyColor: '#' + envConfigs[0].bg.toString(16).padStart(6, '0'),
            fogColor: '#' + envConfigs[0].fog.toString(16).padStart(6, '0'),
            ambColor: '#' + envConfigs[0].amb.toString(16).padStart(6, '0'),
            dirColor: '#' + envConfigs[0].dir.toString(16).padStart(6, '0'),
            ambI: envConfigs[0].ambI,
            dirI: envConfigs[0].dirI,
            glintCol: '#' + envConfigs[0].glintCol.toString(16).padStart(6, '0')
        };
        
        function updateAtmoParamsFromPhase() {
            const cur = envConfigs[timePhase];
            atmoParams.skyColor = '#' + cur.bg.toString(16).padStart(6, '0');
            atmoParams.fogColor = '#' + cur.fog.toString(16).padStart(6, '0');
            atmoParams.ambColor = '#' + cur.amb.toString(16).padStart(6, '0');
            atmoParams.dirColor = '#' + cur.dir.toString(16).padStart(6, '0');
            atmoParams.ambI = cur.ambI;
            atmoParams.dirI = cur.dirI;
            atmoParams.glintCol = '#' + cur.glintCol.toString(16).padStart(6, '0');
            if (atmoFolder) {
                atmoFolder.controllers.forEach(c => c.updateDisplay());
            }
        }
        
        // Listen to phase changes
        const oldTimeToggle = document.getElementById('time-toggle').onclick;
        document.getElementById('time-toggle').addEventListener('click', () => {
            setTimeout(updateAtmoParamsFromPhase, 50);
        });

        // Master Environment Folder
        const envFolder = gui.addFolder('Environment');

        // 1. Atmosphere & Lighting Subfolder
        const atmoFolder = envFolder.addFolder('Atmosphere & Lighting');
        atmoFolder.add(params, 'exposure', 0.5, 4.0, 0.1).name('Global Brightness').onChange(v => {
            renderer.toneMappingExposure = v;
        });
        atmoFolder.add(params, 'summerFilter').name('Summer Filter').onChange(v => {
            const btn = document.getElementById('summer-toggle');
            if (btn) btn.click();
        });
        atmoFolder.add(params, 'shadeMode', ['original', 'cel', 'flat'])
            .name('Shade Mode')
            .onChange(v => {
                toonShaderManager.apply(scene, v);
                gui.controllersRecursive().forEach(c => { if (c.property === 'shadeMode') c.updateDisplay(); });
            });
        atmoFolder.addColor(atmoParams, 'skyColor').name('Sky Color').onChange(v => envConfigs[timePhase].bg = parseInt(v.replace('#',''), 16));
        atmoFolder.addColor(atmoParams, 'fogColor').name('Fog Color').onChange(v => envConfigs[timePhase].fog = parseInt(v.replace('#',''), 16));
        atmoFolder.addColor(atmoParams, 'ambColor').name('Ambient Light').onChange(v => envConfigs[timePhase].amb = parseInt(v.replace('#',''), 16));
        atmoFolder.addColor(atmoParams, 'dirColor').name('Sun Light').onChange(v => envConfigs[timePhase].dir = parseInt(v.replace('#',''), 16));
        atmoFolder.add(atmoParams, 'ambI', 0, 3).name('Amb Intensity').onChange(v => envConfigs[timePhase].ambI = v);
        atmoFolder.add(atmoParams, 'dirI', 0, 5).name('Sun Intensity').onChange(v => envConfigs[timePhase].dirI = v);
        atmoFolder.addColor(atmoParams, 'glintCol').name('Water Glint').onChange(v => envConfigs[timePhase].glintCol = parseInt(v.replace('#',''), 16));

        // 2. Sky & Gradients Subfolder
        const gradientSkyFolder = envFolder.addFolder('Sky & Gradients');
        const gradParams = {
            enabled: true,
            zenith: '#' + (skyUniforms.uSkyColorZenith ? skyUniforms.uSkyColorZenith.value.getHexString() : '2a5090'),
            mid: '#' + (skyUniforms.uSkyColorMid ? skyUniforms.uSkyColorMid.value.getHexString() : 'c85078'),
            horizon: '#' + (skyUniforms.uSkyColorHorizon ? skyUniforms.uSkyColorHorizon.value.getHexString() : 'ffa07a'),
            power: 1.2,
            midOffset: 0.22,
            sunCorona: 0.7,
            horizonGlow: 0.45,
            applySunsetGradient: () => {
                gradParams.zenith = '#2a5090';
                gradParams.mid = '#c85078';
                gradParams.horizon = '#ffa07a';
                gradParams.power = 1.2;
                gradParams.midOffset = 0.22;
                if (skyUniforms.uSkyColorZenith) skyUniforms.uSkyColorZenith.value.setHex(0x2a5090);
                if (skyUniforms.uSkyColorMid) skyUniforms.uSkyColorMid.value.setHex(0xc85078);
                if (skyUniforms.uSkyColorHorizon) skyUniforms.uSkyColorHorizon.value.setHex(0xffa07a);
                if (skyUniforms.uGradientPower) skyUniforms.uGradientPower.value = 1.2;
                if (skyUniforms.uGradientMidOffset) skyUniforms.uGradientMidOffset.value = 0.22;
                envConfigs[1].bg = 0x2a5090;
                envConfigs[1].mid = 0xc85078;
                envConfigs[1].fog = 0xffa07a;
                gradientSkyFolder.controllersRecursive().forEach(c => c.updateDisplay());
            },
            applyDayGradient: () => {
                gradParams.zenith = '#4a90d9';
                gradParams.mid = '#7ab4e6';
                gradParams.horizon = '#c8dce8';
                gradParams.power = 1.0;
                gradParams.midOffset = 0.25;
                if (skyUniforms.uSkyColorZenith) skyUniforms.uSkyColorZenith.value.setHex(0x4a90d9);
                if (skyUniforms.uSkyColorMid) skyUniforms.uSkyColorMid.value.setHex(0x7ab4e6);
                if (skyUniforms.uSkyColorHorizon) skyUniforms.uSkyColorHorizon.value.setHex(0xc8dce8);
                if (skyUniforms.uGradientPower) skyUniforms.uGradientPower.value = 1.0;
                if (skyUniforms.uGradientMidOffset) skyUniforms.uGradientMidOffset.value = 0.25;
                envConfigs[0].bg = 0x4a90d9;
                envConfigs[0].mid = 0x7ab4e6;
                envConfigs[0].fog = 0xc8dce8;
                gradientSkyFolder.controllersRecursive().forEach(c => c.updateDisplay());
            }
        };

        gradientSkyFolder.add(params, 'skyRenderMode', ['Gradient + Clouds', 'Gradient Regular', 'Flat Solid'])
            .name('Sky Mode')
            .onChange(v => {
                if (typeof window.setSkyRenderMode === 'function') window.setSkyRenderMode(v);
            });
        gradientSkyFolder.add(params, 'showProceduralSky').name('Procedural Sky Dome').onChange(v => {
            if (typeof window.setSkyRenderMode === 'function') {
                if (!v) window.setSkyRenderMode('Flat Solid');
                else window.setSkyRenderMode(params.enableProceduralClouds ? 'Gradient + Clouds' : 'Gradient Regular');
            }
        });
        gradientSkyFolder.add(params, 'enableProceduralClouds').name('Enable Procedural Clouds').onChange(v => {
            if (typeof window.setSkyRenderMode === 'function') {
                window.setSkyRenderMode(v ? 'Gradient + Clouds' : 'Gradient Regular');
            }
        });
        gradientSkyFolder.add(gradParams, 'enabled').name('Enable Gradient Curve').onChange(v => {
            if (skyUniforms.uGradientSkyEnabled) skyUniforms.uGradientSkyEnabled.value = v ? 1.0 : 0.0;
        });
        gradientSkyFolder.addColor(gradParams, 'zenith').name('Zenith Color').onChange(v => {
            const hex = parseInt(v.replace('#', ''), 16);
            if (skyUniforms.uSkyColorZenith) skyUniforms.uSkyColorZenith.value.setHex(hex);
            envConfigs[timePhase].bg = hex;
        });
        gradientSkyFolder.addColor(gradParams, 'mid').name('Mid-Sky Color').onChange(v => {
            const hex = parseInt(v.replace('#', ''), 16);
            if (skyUniforms.uSkyColorMid) skyUniforms.uSkyColorMid.value.setHex(hex);
            envConfigs[timePhase].mid = hex;
        });
        gradientSkyFolder.addColor(gradParams, 'horizon').name('Horizon Color').onChange(v => {
            const hex = parseInt(v.replace('#', ''), 16);
            if (skyUniforms.uSkyColorHorizon) skyUniforms.uSkyColorHorizon.value.setHex(hex);
            envConfigs[timePhase].fog = hex;
        });
        gradientSkyFolder.add(gradParams, 'power', 0.2, 3.0, 0.05).name('Gradient Curve (Power)').onChange(v => {
            if (skyUniforms.uGradientPower) skyUniforms.uGradientPower.value = v;
        });
        gradientSkyFolder.add(gradParams, 'midOffset', 0.05, 0.8, 0.01).name('Mid-Height Offset').onChange(v => {
            if (skyUniforms.uGradientMidOffset) skyUniforms.uGradientMidOffset.value = v;
        });
        gradientSkyFolder.add(gradParams, 'sunCorona', 0.0, 2.0, 0.05).name('Sun Flare Glow').onChange(v => {
            if (skyUniforms.uSunCoronaIntensity) skyUniforms.uSunCoronaIntensity.value = v;
        });
        gradientSkyFolder.add(gradParams, 'horizonGlow', 0.0, 1.5, 0.05).name('Horizon Band Glow').onChange(v => {
            if (skyUniforms.uHorizonGlow) skyUniforms.uHorizonGlow.value = v;
        });
        gradientSkyFolder.add(gradParams, 'applySunsetGradient').name('Preset: Sunset Look');
        gradientSkyFolder.add(gradParams, 'applyDayGradient').name('Preset: Day Sky Look');

        // Subfolder: Procedural Sky (Per Biome)
        const skyEditorParams = {
            coverage: 0.45, edge: 0.07, speed: 0.02,
            skyZenith: '#4a90d9', skyHorizon: '#b8d4e8',
            cloudCol: '#fff8f0', cloudShadow: '#8898a8',
            turbulence: 0.0, stormDarken: 0.0,
            weather: 'clear'
        };
        const skyFolder = gradientSkyFolder.addFolder('Procedural Sky (Per Biome)');

        function writeSkyToConfig(key, val) {
            if (typeof playerGrp !== 'undefined' && playerGrp.position) {
                const b = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
                const bName = b ? b.name : null;
                if (bName && BIOME_SKY_CONFIGS[bName]) BIOME_SKY_CONFIGS[bName][key] = val;
            }
        }
        const skyCtrlCoverage = skyFolder.add(skyEditorParams, 'coverage', 0, 1, 0.01).name('Cloud Coverage').onChange(v => writeSkyToConfig('coverage', v));
        const skyCtrlEdge = skyFolder.add(skyEditorParams, 'edge', 0.02, 0.25, 0.005).name('Cloud Edge').onChange(v => writeSkyToConfig('edge', v));
        const skyCtrlSpeed = skyFolder.add(skyEditorParams, 'speed', 0, 0.2, 0.002).name('Cloud Speed').onChange(v => writeSkyToConfig('speed', v));
        const skyCtrlZenith = skyFolder.addColor(skyEditorParams, 'skyZenith').name('Sky Zenith').onChange(v => writeSkyToConfig('skyZenith', parseInt(v.replace('#',''), 16)));
        const skyCtrlHorizon = skyFolder.addColor(skyEditorParams, 'skyHorizon').name('Sky Horizon').onChange(v => writeSkyToConfig('skyHorizon', parseInt(v.replace('#',''), 16)));
        const skyCtrlCloudCol = skyFolder.addColor(skyEditorParams, 'cloudCol').name('Cloud Color').onChange(v => writeSkyToConfig('cloudCol', parseInt(v.replace('#',''), 16)));
        const skyCtrlCloudShadow = skyFolder.addColor(skyEditorParams, 'cloudShadow').name('Cloud Shadow').onChange(v => writeSkyToConfig('cloudShadow', parseInt(v.replace('#',''), 16)));
        const skyCtrlTurb = skyFolder.add(skyEditorParams, 'turbulence', 0, 1, 0.01).name('Storm Turbulence').onChange(v => writeSkyToConfig('turbulence', v));
        const skyCtrlDarken = skyFolder.add(skyEditorParams, 'stormDarken', 0, 1, 0.01).name('Storm Darken').onChange(v => writeSkyToConfig('stormDarken', v));
        skyFolder.add({ opacity: 1.0 }, 'opacity', 0, 1, 0.01).name('Cloud Opacity').onChange(v => { skyUniforms.uCloudOpacity.value = v; });
        skyFolder.add(skyEditorParams, 'weather', ['clear', 'storm', 'overcast']).name('Weather').onChange(v => { currentWeather = v; });

        setInterval(() => {
            if (typeof playerGrp !== 'undefined' && playerGrp.position) {
                const b = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
                const bName = b ? b.name : null;
                if (bName) {
                    const cfg = BIOME_SKY_CONFIGS[bName];
                    if (cfg) {
                        skyEditorParams.coverage = cfg.coverage;
                        skyEditorParams.edge = cfg.edge;
                        skyEditorParams.speed = cfg.speed;
                        skyEditorParams.skyZenith = '#' + cfg.skyZenith.toString(16).padStart(6, '0');
                        skyEditorParams.skyHorizon = '#' + cfg.skyHorizon.toString(16).padStart(6, '0');
                        skyEditorParams.cloudCol = '#' + cfg.cloudCol.toString(16).padStart(6, '0');
                        skyEditorParams.cloudShadow = '#' + cfg.cloudShadow.toString(16).padStart(6, '0');
                        skyEditorParams.turbulence = cfg.turbulence;
                        skyEditorParams.stormDarken = cfg.stormDarken;
                        [skyCtrlCoverage, skyCtrlEdge, skyCtrlSpeed, skyCtrlZenith, skyCtrlHorizon, skyCtrlCloudCol, skyCtrlCloudShadow, skyCtrlTurb, skyCtrlDarken].forEach(c => c.updateDisplay());
                        skyFolder.title('Procedural Sky (' + bName + ')');
                    }
                }
            }
        }, 500);

        // 3. Sun & God Rays Controls Subfolder
        const sunGodRaysFolder = envFolder.addFolder('Sun & God Rays Controls');
        sunGodRaysFolder.add(params, 'sunAltitude', -8000, 15000, 50).name('Sun Height (Altitude)').onChange(v => {
            currentSunY = v;
        });
        sunGodRaysFolder.add(params, 'sunAzimuth', -180, 180, 1).name('Sun Azimuth (Angle °)');
        sunGodRaysFolder.add(params, 'lockSunToPlayer').name('Lock Sun to Player');
        sunGodRaysFolder.add(params, 'sunDiscScale', 0.5, 5.0, 0.1).name('Sun Disc Size');
        sunGodRaysFolder.add(params, 'godRays').name('God Rays Enable').onChange(v => {
            godRaysPass.enabled = v;
        });
        sunGodRaysFolder.add(params, 'godRayIntensity', 0, 2.5, 0.05).name('Ray Intensity').onChange(v => {
            godRaysPass.uniforms.uIntensity.value = v;
        });
        sunGodRaysFolder.add(params, 'godRayDensity', 0.1, 1.5, 0.05).name('Ray Density').onChange(v => {
            godRaysPass.uniforms.uDensity.value = v;
        });
        sunGodRaysFolder.add(params, 'godRayDecay', 0.80, 0.995, 0.005).name('Ray Decay').onChange(v => {
            godRaysPass.uniforms.uDecay.value = v;
        });
        sunGodRaysFolder.add(params, 'lumMin', 0.0, 1.0, 0.01).name('Lum Gate Min').onChange(v => {
            godRaysPass.uniforms.uLumMin.value = v;
        });
        sunGodRaysFolder.add(params, 'lumMax', 0.0, 1.0, 0.01).name('Lum Gate Max').onChange(v => {
            godRaysPass.uniforms.uLumMax.value = v;
        });
        sunGodRaysFolder.add(params, 'highlightKnee', 0.2, 1.0, 0.01).name('Highlight Rolloff').onChange(v => {
            uRolloffKnee.value = v;
        });
        sunGodRaysFolder.add(params, 'horizonGlow', 0.0, 1.5, 0.05).name('Horizon Glow').onChange(v => {
            if (skyUniforms && skyUniforms.uHorizonGlow) skyUniforms.uHorizonGlow.value = v;
        });

        const rayColors = {
            inner: '#' + godRaysPass.uniforms.uRayColorInner.value.getHexString(),
            outer: '#' + godRaysPass.uniforms.uRayColorOuter.value.getHexString(),
            applyPreset: () => {
                timePhase = 1;
                localStorage.setItem('wl_timePhase', 1);
                params.sunAltitude = 160;
                params.sunAzimuth = 0;
                params.lockSunToPlayer = true;
                params.sunDiscScale = 1.8;
                params.godRays = true;
                godRaysPass.enabled = true;
                params.godRayIntensity = 0.65;
                godRaysPass.uniforms.uIntensity.value = 0.65;
                params.godRayDensity = 0.50;
                godRaysPass.uniforms.uDensity.value = 0.50;
                params.godRayDecay = 0.927;
                godRaysPass.uniforms.uDecay.value = 0.927;
                params.lumMin = 0.85;
                godRaysPass.uniforms.uLumMin.value = 0.85;
                params.lumMax = 0.97;
                godRaysPass.uniforms.uLumMax.value = 0.97;
                params.highlightKnee = 0.75;
                params.horizonGlow = 0.45;
                
                envConfigs[1].bg = 0x2a5090;
                envConfigs[1].mid = 0xc85078;
                envConfigs[1].fog = 0xffa07a;
                envConfigs[1].amb = 0xffdab9;
                envConfigs[1].dir = 0xffaa00;
                envConfigs[1].ambI = 1.1;
                envConfigs[1].dirI = 3.2;
                envConfigs[1].glintCol = 0xffaa00;
                envConfigs[1].sunY = 160;
                envConfigs[1].moonY = 200;
                envConfigs[1].cloudCol = 0xfffaec;

                if (skyUniforms) {
                    skyUniforms.uHorizonGlow.value = 0.45;
                    skyUniforms.uSkyColorZenith.value.setHex(0x2a5090);
                    if (skyUniforms.uSkyColorMid) skyUniforms.uSkyColorMid.value.setHex(0xc85078);
                    skyUniforms.uSkyColorHorizon.value.setHex(0xffa07a);
                }
                if (typeof zenithColorUniform !== 'undefined') zenithColorUniform.value.setHex(0x2a5090);
                if (typeof horizonColorUniform !== 'undefined') horizonColorUniform.value.setHex(0xffa07a);
                if (typeof deepColorUniform !== 'undefined') deepColorUniform.value.setHex(0x121a24);
                if (typeof shallowColorUniform !== 'undefined') shallowColorUniform.value.setHex(0xd05432);
                
                updateAtmoParamsFromPhase();
                sunGodRaysFolder.controllers.forEach(c => c.updateDisplay());
                if (atmoFolder) atmoFolder.controllers.forEach(c => c.updateDisplay());
            }
        };
        sunGodRaysFolder.addColor(rayColors, 'inner').name('Ray Color (Inner)').onChange(v => {
            godRaysPass.uniforms.uRayColorInner.value.set(v);
        });
        sunGodRaysFolder.addColor(rayColors, 'outer').name('Ray Color (Outer)').onChange(v => {
            godRaysPass.uniforms.uRayColorOuter.value.set(v);
        });
        sunGodRaysFolder.add(rayColors, 'applyPreset').name('Apply Sunset Photo Look');
        sunGodRaysFolder.add({
            exportDusk: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(1, false) : null
        }, 'exportDusk').name('Export Dusk / Sun Rays (Copy JSON)');
        sunGodRaysFolder.add({
            downloadDusk: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(1, true) : null
        }, 'downloadDusk').name('Download Dusk Settings (.json)');

        // 4. Moonlight & Night Subfolder
        const moonParams = {
            moonlightColor: '#' + envConfigs[2].dir.toString(16).padStart(6, '0'),
            moonlightIntensity: envConfigs[2].dirI,
            nightAmbColor: '#' + envConfigs[2].amb.toString(16).padStart(6, '0'),
            nightAmbIntensity: envConfigs[2].ambI,
            nightSkyColor: '#' + envConfigs[2].bg.toString(16).padStart(6, '0'),
            nightFogColor: '#' + envConfigs[2].fog.toString(16).padStart(6, '0'),
            moonAltitude: envConfigs[2].moonY
        };

        const moonFolder = envFolder.addFolder('Moonlight & Night');
        // NOTE: this used to write renderer.toneMappingExposure, which is completely inert
        // while PostProcessing sets outputColorTransform = false. It now drives the real
        // exposure multiplier, so the slider actually does something.
        moonFolder.add(params, 'exposureTrim', 0.4, 2.0, 0.02).name('Global Brightness');
        moonFolder.add(params, 'nightExposure', 0.6, 3.0, 0.05).name('Night Exposure');
        moonFolder.addColor(moonParams, 'moonlightColor').name('Moonlight Color').onChange(v => envConfigs[2].dir = parseInt(v.replace('#',''), 16));
        moonFolder.add(moonParams, 'moonlightIntensity', 0, 10, 0.1).name('Moonlight Power').onChange(v => envConfigs[2].dirI = v);
        moonFolder.addColor(moonParams, 'nightAmbColor').name('Night Fill Color').onChange(v => envConfigs[2].amb = parseInt(v.replace('#',''), 16));
        moonFolder.add(moonParams, 'nightAmbIntensity', 0, 5, 0.1).name('Night Fill Power').onChange(v => envConfigs[2].ambI = v);
        moonFolder.addColor(moonParams, 'nightSkyColor').name('Night Sky Color').onChange(v => envConfigs[2].bg = parseInt(v.replace('#',''), 16));
        moonFolder.addColor(moonParams, 'nightFogColor').name('Night Fog Color').onChange(v => envConfigs[2].fog = parseInt(v.replace('#',''), 16));
        moonFolder.add(moonParams, 'moonAltitude', 200, 4000, 50).name('Moon Altitude').onChange(v => envConfigs[2].moonY = v);
        moonFolder.add({
            exportNight: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(2, false) : null
        }, 'exportNight').name('Export Night Settings (Copy JSON)');
        moonFolder.add({
            downloadNight: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(2, true) : null
        }, 'downloadNight').name('Download Night Settings (.json)');

        // Star controls. Every one of these is multiplied by uNightFactor in the shader, which
        // is exactly 0.0 at dusk — so no setting here can affect the golden dusk look.
        if (skyUniforms && skyUniforms.uStarDensity) {
            const starParams = {
                starDensity: skyUniforms.uStarDensity.value,
                starBrightness: skyUniforms.uStarBrightness.value,
                starTwinkle: skyUniforms.uStarTwinkle.value,
                milkyWay: skyUniforms.uMilkyWay.value,
                nightSkyLift: skyUniforms.uNightSkyLift.value
            };
            moonFolder.add(starParams, 'starDensity', 0.0, 0.25, 0.005).name('Star Density').onChange(v => skyUniforms.uStarDensity.value = v);
            moonFolder.add(starParams, 'starBrightness', 0.0, 3.0, 0.05).name('Star Brightness').onChange(v => skyUniforms.uStarBrightness.value = v);
            moonFolder.add(starParams, 'starTwinkle', 0.0, 1.0, 0.05).name('Star Twinkle').onChange(v => skyUniforms.uStarTwinkle.value = v);
            moonFolder.add(starParams, 'nightSkyLift', 0.0, 3.0, 0.05).name('Night Sky Lift').onChange(v => skyUniforms.uNightSkyLift.value = v);

            const mwFolder = moonFolder.addFolder('Milky Way');
            const mwParams = {
                strength: skyUniforms.uMilkyWay.value,
                dust: skyUniforms.uMilkyDust.value,
                armColor: '#' + new THREE.Color().copy(skyUniforms.uMilkyArmColor.value).getHexString(),
                coreColor: '#' + new THREE.Color().copy(skyUniforms.uMilkyCoreColor.value).getHexString()
            };
            mwFolder.add(mwParams, 'strength', 0.0, 3.0, 0.05).name('Strength').onChange(v => skyUniforms.uMilkyWay.value = v);
            mwFolder.add(mwParams, 'dust', 0.0, 1.0, 0.05).name('Dust Lanes').onChange(v => skyUniforms.uMilkyDust.value = v);
            mwFolder.addColor(mwParams, 'armColor').name('Arm Color').onChange(v => skyUniforms.uMilkyArmColor.value.set(v));
            mwFolder.addColor(mwParams, 'coreColor').name('Core Color').onChange(v => skyUniforms.uMilkyCoreColor.value.set(v));
        }



        // 4b. Daylight Subfolder — day was blown out because near-white light at high
        // intensity pushed every channel over the soft-clip knee at once.
        const dayParams = {
            dayLightColor: '#' + envConfigs[0].dir.toString(16).padStart(6, '0'),
            dayLightIntensity: envConfigs[0].dirI,
            dayAmbColor: '#' + envConfigs[0].amb.toString(16).padStart(6, '0'),
            dayAmbIntensity: envConfigs[0].ambI,
            daySkyColor: '#' + envConfigs[0].bg.toString(16).padStart(6, '0'),
            dayFogColor: '#' + envConfigs[0].fog.toString(16).padStart(6, '0')
        };
        const dayFolder = envFolder.addFolder('Daylight');
        dayFolder.add(params, 'dayExposure', 0.25, 1.5, 0.01).name('Day Exposure');
        dayFolder.addColor(dayParams, 'dayLightColor').name('Sunlight Color').onChange(v => envConfigs[0].dir = parseInt(v.replace('#',''), 16));
        dayFolder.add(dayParams, 'dayLightIntensity', 0, 5, 0.05).name('Sunlight Power').onChange(v => envConfigs[0].dirI = v);
        dayFolder.addColor(dayParams, 'dayAmbColor').name('Day Fill Color').onChange(v => envConfigs[0].amb = parseInt(v.replace('#',''), 16));
        dayFolder.add(dayParams, 'dayAmbIntensity', 0, 3, 0.05).name('Day Fill Power').onChange(v => envConfigs[0].ambI = v);
        dayFolder.addColor(dayParams, 'daySkyColor').name('Day Sky Color').onChange(v => envConfigs[0].bg = parseInt(v.replace('#',''), 16));
        dayFolder.addColor(dayParams, 'dayFogColor').name('Day Fog Color').onChange(v => envConfigs[0].fog = parseInt(v.replace('#',''), 16));
        dayFolder.add({
            exportDay: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(0, false) : null
        }, 'exportDay').name('Export Day Settings (Copy JSON)');
        dayFolder.add({
            downloadDay: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(0, true) : null
        }, 'downloadDay').name('Download Day Settings (.json)');

        // 5. Weather & Fog Subfolder
        const weatherFolder = envFolder.addFolder('Weather & Fog');
        weatherFolder.add(params, 'sceneFog').name('Global Fog').listen().onChange(v => {
            if (typeof setAllFogEnabled === 'function') {
                setAllFogEnabled(v);
            }
        });
        weatherFolder.add(params, 'fogIntensity', 0.1, 5.0, 0.1).name('Fog Intensity');
        weatherFolder.add(params, 'wind').name('Wind').onChange(v => { if (isWindOn !== v) document.getElementById('wind-toggle').click(); });
        weatherFolder.add(params, 'trails').name('Wind Trails').onChange(v => isWindTrailsOn = v);

        const rainFolder = weatherFolder.addFolder('Rain Settings');
        rainFolder.add(params, 'rain').name('Enable Rain').onChange(v => { isRainOn = v; });
        rainFolder.add(params, 'rainSize', 0.5, 10.0).name('Drop Size');
        rainFolder.add(params, 'rainIntensity', 0.1, 5.0).name('Intensity');
        rainFolder.add(params, 'rainWindX', -5.0, 5.0).name('Wind X');
        rainFolder.add(params, 'rainWindY', -5.0, 5.0).name('Wind Z');

        window.biomeFogSettings = window.biomeFogSettings || {};
        const fogFolder = weatherFolder.addFolder('Ground Fog (Per Biome)');
        fogFolder.add(params, 'fogPlane').name('Enable Fog').onChange(v => { if (typeof window.fogGroup !== 'undefined') window.fogGroup.visible = v; });
        const fogOffsetCtrl = fogFolder.add(params, 'biomeFogOffset', -50, 50).name('Biome Fog Offset').onChange(v => {
            if (typeof playerGrp !== 'undefined' && playerGrp.position) {
                const b = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
                const bName = b ? b.name : 'Unknown';
                window.biomeFogSettings = window.biomeFogSettings || {};
                window.biomeFogSettings[bName] = v;
            }
        });
        setInterval(() => {
            if (typeof playerGrp !== 'undefined' && playerGrp.position && !fogOffsetCtrl.__onChangeBlocked) {
                const b = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
                const bName = b ? b.name : 'Unknown';
                window.biomeFogSettings = window.biomeFogSettings || {};
                const currentOffset = window.biomeFogSettings[bName] || 0;
                if (params.biomeFogOffset !== currentOffset) {
                    params.biomeFogOffset = currentOffset;
                    fogOffsetCtrl.__onChangeBlocked = true;
                    fogOffsetCtrl.updateDisplay();
                    fogOffsetCtrl.__onChangeBlocked = false;
                }
                fogFolder.title('Ground Fog (' + bName + ')');
            }
        }, 500);
        weatherFolder.add({ openGroundFogEditor: () => {
            if (window.groundFogEditor) window.groundFogEditor.toggle();
        }}, 'openGroundFogEditor').name('Ground Fog Editor');

        // 6. Terrain Colors & Sand Shimmer Subfolder
        const colorEditorFolder = envFolder.addFolder('Terrain Colors & Sand Shimmer');
        const triggerTerrainColorUpdate = () => {
            lastTerrainGridX = -9999;
            lastTerrainGridZ = -9999;
        };
        const colorParams = {
            npSnow: '#' + northPoleColors.snowDune.getHexString(),
            npShadow: '#' + northPoleColors.snowShadow.getHexString(),
            npPeak: '#' + northPoleColors.icePeak.getHexString(),
            desertSlope: '#' + desertColors.duneSlope.getHexString(),
            desertShadow: '#' + desertColors.valleyShadow.getHexString(),
            shimmer: 1.0
        };
        colorEditorFolder.addColor(colorParams, 'npSnow').name('Snow Color').onChange(hex => {
            northPoleColors.snowDune.set(hex);
            triggerTerrainColorUpdate();
        });
        colorEditorFolder.addColor(colorParams, 'npShadow').name('Snow Shadow').onChange(hex => {
            northPoleColors.snowShadow.set(hex);
            triggerTerrainColorUpdate();
        });
        colorEditorFolder.addColor(colorParams, 'npPeak').name('Peak Color').onChange(hex => {
            northPoleColors.icePeak.set(hex);
            triggerTerrainColorUpdate();
        });
        colorEditorFolder.addColor(colorParams, 'desertSlope').name('Sand Color').onChange(hex => {
            desertColors.duneSlope.set(hex);
            triggerTerrainColorUpdate();
        });
        colorEditorFolder.addColor(colorParams, 'desertShadow').name('Sand Shadow').onChange(hex => {
            desertColors.valleyShadow.set(hex);
            triggerTerrainColorUpdate();
        });
        colorEditorFolder.add(colorParams, 'shimmer', 0, 3, 0.1).name('Shimmer Sparkle').onChange(val => {
            terrainUniforms.uShimmerMult.value = val;
        });

        // Cloud Parameters & Palette Function
        const cloudParams = {
            c0: '#' + (typeof pastelColors !== 'undefined' && pastelColors[0] ? pastelColors[0].toString(16).padStart(6, '0') : 'ffffff'),
            c1: '#' + (typeof pastelColors !== 'undefined' && pastelColors[1] ? pastelColors[1].toString(16).padStart(6, '0') : 'ffffff'),
            c2: '#' + (typeof pastelColors !== 'undefined' && pastelColors[2] ? pastelColors[2].toString(16).padStart(6, '0') : 'ffffff'),
            c3: '#' + (typeof pastelColors !== 'undefined' && pastelColors[3] ? pastelColors[3].toString(16).padStart(6, '0') : 'ffffff'),
            c4: '#' + (typeof pastelColors !== 'undefined' && pastelColors[4] ? pastelColors[4].toString(16).padStart(6, '0') : 'ffffff'),
            opBase: 1.0,
            opHigh: 1.0,
            opWispy: 1.0,
            opMega: 1.0,
            opHorizon: 1.0,
            enableClouds: true,
            density: 1.0,
            cloudScale: 1.0
        };

        let oldCloudColors = typeof pastelColors !== 'undefined' ? [...pastelColors] : [];
        function updateCloudColorForIndex(idx, newHex) {
            if (typeof pastelColors === 'undefined') return;
            const oldHex = oldCloudColors[idx];
            const newHexVal = parseInt(newHex.replace('#',''), 16);
            if (oldHex === newHexVal) return;
            pastelColors[idx] = newHexVal;
            const oldColor = new THREE.Color(oldHex);
            const newColor = new THREE.Color(newHexVal);
            const temp = new THREE.Color();
            
            if (typeof instClouds !== 'undefined' && typeof instHighClouds !== 'undefined') {
                [instClouds, instHighClouds].forEach(mesh => {
                    if (!mesh) return;
                    for (let i = 0; i < mesh.count; i++) {
                        mesh.getColorAt(i, temp);
                        if (Math.abs(temp.r - oldColor.r) < 0.01 && Math.abs(temp.g - oldColor.g) < 0.01 && Math.abs(temp.b - oldColor.b) < 0.01) {
                            mesh.setColorAt(i, newColor);
                        }
                    }
                    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
                });
            }
            oldCloudColors[idx] = newHexVal;
        }

        // 7. 3D Clouds & Pastel Editor Subfolder
        const cloudFolder = envFolder.addFolder('3D Clouds & Pastel Editor');
        cloudFolder.add(params, 'showClouds').name('Show All Clouds').onChange(v => {
            params.showCloudsRegular = v;
            params.showCloudsHigh = v;
            params.showCloudsWispy = v;
            params.showCloudsMega = v;
            params.showCloudsHorizon = v;
            params.showVolumetricClouds = v;
            if (typeof instClouds !== 'undefined') instClouds.visible = v;
            if (typeof instHighClouds !== 'undefined') instHighClouds.visible = v;
            if (typeof instWispyClouds !== 'undefined') instWispyClouds.visible = v;
            if (typeof instMegaClouds !== 'undefined') instMegaClouds.visible = v;
            if (typeof instHorizonClouds1 !== 'undefined') {
                instHorizonClouds1.visible = v;
                instHorizonClouds2.visible = v;
                instHorizonClouds3.visible = v;
            }
            if (typeof toonCloudMat !== 'undefined' && toonCloudMat.uniforms && toonCloudMat.uniforms.uEnableClouds) {
                toonCloudMat.uniforms.uEnableClouds.value = v ? 1.0 : 0.0;
            }
            cloudFolder.controllersRecursive().forEach(c => {
                if (c.property && c.property.startsWith('showClouds') || c.property === 'showVolumetricClouds') c.updateDisplay();
            });
        });
        cloudFolder.add(cloudParams, 'density', 0.1, 2.5, 0.05).name('Overall Density').onChange(v => {
            if (typeof instClouds !== 'undefined') {
                instClouds.count = Math.max(1, Math.min(MAX_CLOUD_COUNT, Math.floor(params.cloudCountRegular * v)));
                if (instClouds.instanceMatrix) instClouds.instanceMatrix.needsUpdate = true;
            }
            if (typeof instHighClouds !== 'undefined') {
                instHighClouds.count = Math.max(1, Math.min(MAX_HIGH_CLOUD_COUNT, Math.floor(params.cloudCountHigh * v)));
                if (instHighClouds.instanceMatrix) instHighClouds.instanceMatrix.needsUpdate = true;
            }
            if (typeof instWispyClouds !== 'undefined') {
                instWispyClouds.count = Math.max(1, Math.min(MAX_WISPY_CLOUD_COUNT, Math.floor(params.cloudCountWispy * v)));
                if (instWispyClouds.instanceMatrix) instWispyClouds.instanceMatrix.needsUpdate = true;
            }
            if (typeof instMegaClouds !== 'undefined') {
                instMegaClouds.count = Math.max(1, Math.min(MAX_MEGA_CLOUD_COUNT, Math.floor(params.cloudCountMega * v)));
                if (instMegaClouds.instanceMatrix) instMegaClouds.instanceMatrix.needsUpdate = true;
            }
            if (typeof instHorizonClouds1 !== 'undefined') {
                const count = Math.max(1, Math.min(MAX_HORIZON_CLOUD_COUNT, Math.floor(params.cloudCountHorizon * v)));
                instHorizonClouds1.count = count;
                instHorizonClouds2.count = count;
                instHorizonClouds3.count = count;
                if (instHorizonClouds1.instanceMatrix) instHorizonClouds1.instanceMatrix.needsUpdate = true;
                if (instHorizonClouds2.instanceMatrix) instHorizonClouds2.instanceMatrix.needsUpdate = true;
                if (instHorizonClouds3.instanceMatrix) instHorizonClouds3.instanceMatrix.needsUpdate = true;
            }
        });
        cloudFolder.add(cloudParams, 'cloudScale', 0.5, 3.0, 0.1).name('Overall Size').onChange(v => {
            [instClouds, instHighClouds, instWispyClouds, instMegaClouds].forEach(mesh => {
                if (mesh) mesh.scale.set(v, v, v);
            });
        });

        const toggleFolder = cloudFolder.addFolder('Visibility Toggles');
        toggleFolder.add(params, 'showVolumetricClouds').name('Volumetric Sky Clouds').onChange(v => {
            if (typeof toonCloudMat !== 'undefined' && toonCloudMat.uniforms && toonCloudMat.uniforms.uEnableClouds) {
                toonCloudMat.uniforms.uEnableClouds.value = v ? 1.0 : 0.0;
            }
        });
        toggleFolder.add(params, 'showCloudsRegular').name('Regular (Cumulus)').onChange(v => { if (typeof instClouds !== 'undefined') instClouds.visible = v; });
        toggleFolder.add(params, 'showCloudsHigh').name('Cumulonimbus').onChange(v => { if (typeof instHighClouds !== 'undefined') instHighClouds.visible = v; });
        toggleFolder.add(params, 'showCloudsWispy').name('Wispy Clouds').onChange(v => { if (typeof instWispyClouds !== 'undefined') instWispyClouds.visible = v; });
        toggleFolder.add(params, 'showCloudsMega').name('Mega Clouds').onChange(v => { if (typeof instMegaClouds !== 'undefined') instMegaClouds.visible = v; });
        toggleFolder.add(params, 'showCloudsHorizon').name('Horizon Clouds (Massive)').onChange(v => { 
            if (typeof instHorizonClouds1 !== 'undefined') {
                instHorizonClouds1.visible = v;
                instHorizonClouds2.visible = v;
                instHorizonClouds3.visible = v;
            }
        });

        const paletteFolder = cloudFolder.addFolder('Pastel Colors');
        paletteFolder.addColor(cloudParams, 'c0').name('Color 1').onChange(v => updateCloudColorForIndex(0, v));
        paletteFolder.addColor(cloudParams, 'c1').name('Color 2').onChange(v => updateCloudColorForIndex(1, v));
        paletteFolder.addColor(cloudParams, 'c2').name('Color 3').onChange(v => updateCloudColorForIndex(2, v));
        paletteFolder.addColor(cloudParams, 'c3').name('Color 4').onChange(v => updateCloudColorForIndex(3, v));
        paletteFolder.addColor(cloudParams, 'c4').name('Color 5').onChange(v => updateCloudColorForIndex(4, v));
        paletteFolder.close();

        const regFolder = cloudFolder.addFolder('Regular (Cumulus)');
        regFolder.add(params, 'showCloudsRegular').name('Show').onChange(v => { if (typeof instClouds !== 'undefined') instClouds.visible = v; });
        regFolder.add(params, 'cloudCountRegular', 0, 300, 1).name('Count').onChange(v => {
            CLOUD_COUNT = v;
            if (instClouds) {
                instClouds.count = Math.floor(v * cloudParams.density);
                if (instClouds.instanceMatrix) instClouds.instanceMatrix.needsUpdate = true;
            }
        });
        let prevRegScale = 1.0;
        regFolder.add(params, 'cloudScaleRegular', 0.1, 5.0, 0.05).name('Scale').onChange(v => {
            updateCloudScale(instClouds, v, prevRegScale);
            prevRegScale = v;
        });
        regFolder.add(cloudParams, 'opBase', 0, 1, 0.01).name('Opacity').onChange(v => matCloud.opacity = v);
        regFolder.close();

        const highFolder = cloudFolder.addFolder('Cumulonimbus');
        highFolder.add(params, 'showCloudsHigh').name('Show').onChange(v => { if (typeof instHighClouds !== 'undefined') instHighClouds.visible = v; });
        highFolder.add(params, 'cloudCountHigh', 0, 100, 1).name('Count').onChange(v => {
            HIGH_CLOUD_COUNT = v;
            if (instHighClouds) {
                instHighClouds.count = Math.floor(v * cloudParams.density);
                if (instHighClouds.instanceMatrix) instHighClouds.instanceMatrix.needsUpdate = true;
            }
        });
        let prevHighScale = 1.0;
        highFolder.add(params, 'cloudScaleHigh', 0.1, 5.0, 0.05).name('Scale').onChange(v => {
            updateCloudScale(instHighClouds, v, prevHighScale);
            prevHighScale = v;
        });
        highFolder.add(cloudParams, 'opHigh', 0, 1, 0.01).name('Opacity').onChange(v => highCloudMat.opacity = v);
        highFolder.close();

        const wispyFolder = cloudFolder.addFolder('Wispy Clouds');
        wispyFolder.add(params, 'showCloudsWispy').name('Show').onChange(v => { if (typeof instWispyClouds !== 'undefined') instWispyClouds.visible = v; });
        wispyFolder.add(params, 'cloudCountWispy', 0, 100, 1).name('Count').onChange(v => {
            WISPY_CLOUD_COUNT = v;
            if (instWispyClouds) {
                instWispyClouds.count = Math.floor(v * cloudParams.density);
                if (instWispyClouds.instanceMatrix) instWispyClouds.instanceMatrix.needsUpdate = true;
            }
        });
        let prevWispyScale = 1.0;
        wispyFolder.add(params, 'cloudScaleWispy', 0.1, 5.0, 0.05).name('Scale').onChange(v => {
            updateCloudScale(instWispyClouds, v, prevWispyScale);
            prevWispyScale = v;
        });
        wispyFolder.add(cloudParams, 'opWispy', 0, 1, 0.01).name('Opacity').onChange(v => matWispyCloud.opacity = v);
        wispyFolder.close();

        const megaFolder = cloudFolder.addFolder('Mega Clouds');
        megaFolder.add(params, 'showCloudsMega').name('Show').onChange(v => { if (typeof instMegaClouds !== 'undefined') instMegaClouds.visible = v; });
        megaFolder.add(params, 'cloudCountMega', 0, 100, 1).name('Count').onChange(v => {
            MEGA_CLOUD_COUNT = v;
            if (instMegaClouds) {
                instMegaClouds.count = Math.floor(v * cloudParams.density);
                if (instMegaClouds.instanceMatrix) instMegaClouds.instanceMatrix.needsUpdate = true;
            }
        });
        let prevMegaScale = 1.0;
        megaFolder.add(params, 'cloudScaleMega', 0.1, 5.0, 0.05).name('Scale').onChange(v => {
            updateCloudScale(instMegaClouds, v, prevMegaScale);
            prevMegaScale = v;
        });
        megaFolder.add(cloudParams, 'opMega', 0, 1, 0.01).name('Opacity').onChange(v => megaCloudMat.opacity = v);
        megaFolder.close();

        const horizonFolder = cloudFolder.addFolder('Horizon Clouds');
        horizonFolder.add(params, 'showCloudsHorizon').name('Show').onChange(v => { 
            if (typeof instHorizonClouds1 !== 'undefined') {
                instHorizonClouds1.visible = v;
                instHorizonClouds2.visible = v;
                instHorizonClouds3.visible = v;
            }
        });
        horizonFolder.add(params, 'cloudCountHorizon', 0, 100, 1).name('Count').onChange(v => {
            if (typeof instHorizonClouds1 !== 'undefined') {
                instHorizonClouds1.count = Math.floor(v * cloudParams.density);
                instHorizonClouds2.count = Math.floor(v * cloudParams.density);
                instHorizonClouds3.count = Math.floor(v * cloudParams.density);
                if (instHorizonClouds1.instanceMatrix) instHorizonClouds1.instanceMatrix.needsUpdate = true;
                if (instHorizonClouds2.instanceMatrix) instHorizonClouds2.instanceMatrix.needsUpdate = true;
                if (instHorizonClouds3.instanceMatrix) instHorizonClouds3.instanceMatrix.needsUpdate = true;
            }
        });
        horizonFolder.close();

        // 8. Character Glow & Trees Subfolder
        const charFloraFolder = envFolder.addFolder('Character Glow & Trees');
        const glowFolder = charFloraFolder.addFolder('Kiki Warm Side Glow');
        const kikiGlowParams = {
            intensity: 2.5,
            distance: 300,
            spread: 35,
            color: '#ffaa44'
        };
        glowFolder.add(kikiGlowParams, 'intensity', 0, 8, 0.1).name('Glow Power').onChange(v => {
            kikiLeftLight.intensity = v;
            kikiRightLight.intensity = v;
        });
        glowFolder.add(kikiGlowParams, 'distance', 50, 800, 10).name('Glow Range').onChange(v => {
            kikiLeftLight.distance = v;
            kikiRightLight.distance = v;
        });
        glowFolder.add(kikiGlowParams, 'spread', 5, 100, 1).name('Side Spread').onChange(v => {
            kikiLeftLight.position.x = -v;
            kikiRightLight.position.x = v;
        });
        glowFolder.addColor(kikiGlowParams, 'color').name('Glow Color').onChange(v => {
            const col = new THREE.Color(v);
            kikiLeftLight.color.copy(col);
            kikiRightLight.color.copy(col);
        });

        const treeFolder = charFloraFolder.addFolder('Global Tree Settings');
        treeFolder.add(params, 'treeScale', 0.5, 4.0).name('Tree Scale').onChange(v => treeUniforms.uTreeScale.value = v);

        // 9. Ocean & Water Subfolder
        const oceanFolder = envFolder.addFolder('Ocean & Water');
        oceanFolder.add({ openOceanFolder: () => {
            toggleGUI(true);
            if (animeWaterGUI && animeWaterGUI.gui) {
                animeWaterGUI.gui.open();
                animeWaterGUI.gui.domElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }}, 'openOceanFolder').name('Ocean Editor (O)');

        // Initialize Time of Day JSON Exporter & Manager
        timeOfDayExporter = new TimeOfDayExporter(() => ({
            envConfigs,
            timePhase,
            params,
            skyUniforms,
            godRaysPass,
            skyEditorParams,
            cloudParams,
            milkyWayParams: typeof milkyWayParams !== 'undefined' ? milkyWayParams : null,
            auroraParams: typeof auroraParams !== 'undefined' ? auroraParams : null,
            currentWeather: typeof currentWeather !== 'undefined' ? currentWeather : 'clear',
            showToast: showVisualToast,
            setTimePhase: typeof setTimePhase === 'function' ? setTimePhase : (typeof window.setTimePhase === 'function' ? window.setTimePhase : null),
            refreshGUI: () => {
                if (typeof updateAtmoParamsFromPhase === 'function') updateAtmoParamsFromPhase();
                if (gui) gui.controllersRecursive().forEach(c => c.updateDisplay());
            }
        }));
        window.timeOfDayExporter = timeOfDayExporter;

        // Presets & Profiles Folder (Streamlined for Option 2)
        presetsFolder = gui.addFolder('Presets & Backup');
        presetsFolder.add({
            openStudio: () => worldStudio.open()
        }, 'openStudio').name('Open World & Biome Studio (F2)');

        presetsFolder.add(settingsManager, 'presetName').name('Preset Name');
        presetsFolder.add({
            saveCurrent: () => settingsManager.saveSetting()
        }, 'saveCurrent').name('Save Current as Preset');
        
        const mainPresetDropdown = presetsFolder.add(settingsManager, 'loadPreset', Object.keys(DEFAULT_PRESETS))
            .name('Select Preset')
            .onChange(val => {
                settingsManager.loadSetting(val);
            });
        presetDropdownControllers.push(mainPresetDropdown);

        presetsFolder.add({
            exportBackup: () => settingsManager.exportFullBackup()
        }, 'exportBackup').name('Export All Settings (Backup JSON)');

        presetsFolder.add({
            importBackup: () => settingsManager.importFullBackup()
        }, 'importBackup').name('Import Settings (Restore JSON)');

        presetsFolder.add({
            resetToDusk: () => settingsManager.reset()
        }, 'resetToDusk').name('Reset to Default Golden Dusk');

        presetsFolder.add({
            deleteSelected: () => settingsManager.deleteSetting()
        }, 'deleteSelected').name('Delete Selected Preset');

        updateAllPresetDropdowns('Golden Hour Dusk (Default)');

        // Reorder folders: Presets first
        const folderOrder = [
            presetsFolder, flightFolder, editorFolder, audioFolder, debugFolder, navFolder, perfFolder, envFolder
        ].filter(Boolean);
        const guiContainer = gui.$children || gui.domElement.querySelector('.children') || gui.domElement;
        folderOrder.forEach(f => {
            const dom = f.domElement || f;
            if (dom && dom.parentElement) guiContainer.appendChild(dom);
        });

        // Close all folders by default
        if (gui.folders) {
            gui.folders.forEach(f => {
                f.close();
            });
        } else {
            for (let i in gui.__folders) {
                gui.__folders[i].close();
            }
        }
        // ---------------------------

        isInitializingGui = false;

        // Auto-save all gui settings whenever anything changes (debounced 800ms)
        let _autoSaveTimer = null;
        gui.onChange(() => {
            if (isInitializingGui) return;
            clearTimeout(_autoSaveTimer);
            _autoSaveTimer = setTimeout(() => {
                localStorage.setItem('flightSettings', JSON.stringify(gui.save()));
            }, 800);
        });
    }
    async function start() {
        initPostProcessing();
        // animate() is async, so a throw inside it becomes an unhandled rejection that the
        // console swallows silently and the frame just stops updating with no visible error.
        // Surface it once instead of losing it.
        let _animErrorLogged = false;
        const _reportAnimError = (e) => {
            if (_animErrorLogged) return;
            _animErrorLogged = true;
            console.error('[Wanderlust] render loop error:', e);
        };
        renderer.setAnimationLoop((t, f) => {
            try {
                const rv = animate(t, f);
                if (rv && rv.catch) rv.catch(_reportAnimError);
            } catch (e) { _reportAnimError(e); }
        });
    }
    start();