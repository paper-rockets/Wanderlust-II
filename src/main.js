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
import { zenithColorUniform, horizonColorUniform, sunColorUniform, sunDirUniform } from './WaterAnime/OpenSeaOcean.js';
import { TreeBillboardEditor } from './ui/TreeBillboardEditor.js';


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
import { scene, camera, renderer, clock } from './core/Engine.js';
import { postProcessing as composer, scenePass, initPostProcessing, bloomPass, godRaysPass, initPostProcessingUI } from './core/PostProcessing.js';
import { AnimatedFlockSystem } from './entities/AnimatedFlockSystem.js';

    import { initTerrainEditor } from '../TerrainEditor.js';
    import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
    import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
    import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
    import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
    import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
    import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
    import { ToonShaderManager } from './vfx/ToonShaderManager.js';
    import { createTerrainMaterial } from './shaders/materials/TerrainNodeMaterial.js';
    import { createTreeMaterial } from './shaders/materials/TreeNodeMaterial.js';
    import { windSwayNode } from './shaders/materials/WindSwayNode.js';

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
    let isHD = true;
    let cameraZoomDist = parseFloat(localStorage.getItem('wl_zoomDist')) || 12.0;
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
    let isInitializingGui = true;

    // Clouds config
    let CLOUD_COUNT = LOW_GFX ? 40 : 150;
    let HIGH_CLOUD_COUNT = LOW_GFX ? 0 : 24;
    let WISPY_CLOUD_COUNT = LOW_GFX ? 0 : 30;
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

    const gui = new GUI();
    const params = {
        worldMode: 'Islands',
        sceneFog: true,
        fogIntensity: 0.1,
        terrainSmoothing: 0.0,
        trails: isWindTrailsOn, lockSunToPlayer: true,
        shadows: isShadowsOn,
        treeShadows: isTreeShadowsOn,
        shadowDist: shadowDistMode,
        bloom: isBloomOn,
        terrainRes: String(terrainRes),
        renderHD: isHD,
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
        godRays: !LOW_GFX,
        godRayIntensity: 0.65,
        treeScale: 1.5,
        quality: LOW_GFX ? 'Low' : 'Regular',
        showTerrain: true,
        showWater: true,
        showTrees: true,
        enableSkydome: false,
        daySkydomeTexture: Math.random() > 0.5 ? '1' : '2',
        nightSkydomeTexture: '2', // Default to 2 because it has the transparency mask
        showClouds: false,
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
        exposure: 1.8,
        shadeMode: 'original',
    };

    const toonShaderManager = new ToonShaderManager();

    // SAVE / LOAD PRESETS
    const settingsManager = {
        presetName: 'My Preset 1',
        saveSetting: () => {
            const currentData = gui.save();
            const saved = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
            saved[settingsManager.presetName] = currentData;
            localStorage.setItem('wl_custom_presets', JSON.stringify(saved));
            updatePresetDropdown();
            alert('Saved preset: ' + settingsManager.presetName);
        },
        loadPreset: 'Default',
        loadSetting: () => {
            if (settingsManager.loadPreset === 'Default') {
                gui.reset();
                return;
            }
            const saved = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
            if (saved[settingsManager.loadPreset]) {
                gui.load(saved[settingsManager.loadPreset]);
            }
        },
        deleteSetting: () => {
            if (settingsManager.loadPreset === 'Default') return alert("Cannot delete Default");
            const saved = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
            delete saved[settingsManager.loadPreset];
            localStorage.setItem('wl_custom_presets', JSON.stringify(saved));
            settingsManager.loadPreset = 'Default';
            updatePresetDropdown();
            alert('Deleted preset.');
        },
        reset: () => {
            gui.reset();
        }
    };

    const customPresetsFolder = gui.addFolder('💾 Save & Load Presets');
    customPresetsFolder.add(settingsManager, 'presetName').name('New Preset Name');
    customPresetsFolder.add(settingsManager, 'saveSetting').name('Save Setting');
    let loadDropdown = customPresetsFolder.add(settingsManager, 'loadPreset', ['Default']).name('Select Preset');
    customPresetsFolder.add(settingsManager, 'loadSetting').name('Load Selected');
    customPresetsFolder.add(settingsManager, 'deleteSetting').name('Delete Selected');
    customPresetsFolder.add(settingsManager, 'reset').name('Reset to Default');

    function updatePresetDropdown() {
        const saved = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
        const options = ['Default', ...Object.keys(saved)];
        if (loadDropdown.options) {
            loadDropdown = loadDropdown.options(options);
        } else {
            loadDropdown.destroy();
            loadDropdown = customPresetsFolder.add(settingsManager, 'loadPreset', options).name('Select Preset');
        }
    }
    updatePresetDropdown();

    const perfFolder = gui.addFolder('Performance');
    perfFolder.add(params, 'quality', ['Regular', 'Low']).name('Quality').onChange(v => {
        localStorage.setItem('gfxQuality', v === 'Low' ? 'low' : 'regular');
        if (!isInitializingGui) location.reload();
    });
    perfFolder.add(params, 'renderHD').name('Render HD').onChange(v => {
        isHD = v;
        renderer.setPixelRatio(isHD ? Math.min(window.devicePixelRatio, 2) : 0.5);
    });
    perfFolder.add(params, 'exposure', 0.5, 4.0, 0.1).name('☀️ Global Brightness').onChange(v => {
        renderer.toneMappingExposure = v;
    });
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
    perfFolder.add(params, 'godRays').name('God Rays').onChange(v => { godRaysPass.enabled = v; });
    perfFolder.add(params, 'godRayIntensity', 0, 2, 0.05).name('Ray Intensity').onChange(v => { godRaysPass.uniforms.uIntensity.value = v; });


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
    const navParams = { maxAltitude: 3500 };
    ZONES.forEach(zn => {
        navParams[zn.name] = () => {
            teleportToBiome(zn.name);
        };
        navFolder.add(navParams, zn.name).name(`${zn.name}`);
    });
    navFolder.add(navParams, 'maxAltitude', 500, 15000, 100).name('Max Altitude').onChange(v => {
        if (playerPhysics) playerPhysics.maxAltitude = v;
    });

    // Add Presets folder
    const presetFolder = gui.addFolder('🌟 Environment Presets');
    presetFolder.add({ clearDesertDay: () => {
        // Teleport to Sand Dunes
        teleportToBiome('Desert Dunes');
        
        // No fog at all
        params.fogPlane = false;
        if (typeof window.fogGroup !== 'undefined') window.fogGroup.visible = false;
        
        // Clear blue sky (day)
        params.timeOfDay = 'day';
        
        // Very little cloud
        if (typeof cloudParams !== 'undefined') {
            cloudParams.density = 0.1;
            
            // Turn off volumetric raymarched sky clouds for clear sky
            params.showVolumetricClouds = false;
            if (typeof toonCloudMat !== 'undefined' && toonCloudMat.uniforms && toonCloudMat.uniforms.uEnableClouds) {
                toonCloudMat.uniforms.uEnableClouds.value = 0.0;
            }
            
            // Apply density to clouds
            if (typeof instClouds !== 'undefined') {
                instClouds.count = Math.max(1, Math.floor(params.cloudCountRegular * cloudParams.density));
                if (instClouds.instanceMatrix) instClouds.instanceMatrix.needsUpdate = true;
            }
            if (typeof instHighClouds !== 'undefined') {
                instHighClouds.count = Math.max(1, Math.floor(params.cloudCountHigh * cloudParams.density));
                if (instHighClouds.instanceMatrix) instHighClouds.instanceMatrix.needsUpdate = true;
            }
            if (typeof instWispyClouds !== 'undefined') {
                instWispyClouds.count = Math.max(1, Math.floor(params.cloudCountWispy * cloudParams.density));
                if (instWispyClouds.instanceMatrix) instWispyClouds.instanceMatrix.needsUpdate = true;
            }
            if (typeof instMegaClouds !== 'undefined') {
                instMegaClouds.count = Math.max(1, Math.floor(params.cloudCountMega * cloudParams.density));
                if (instMegaClouds.instanceMatrix) instMegaClouds.instanceMatrix.needsUpdate = true;
            }
        }
        
        gui.controllersRecursive().forEach(c => c.updateDisplay());
    }}, 'clearDesertDay').name('🏜️ Clear Desert Day');

    // Add Editor folder (Edit Crystals & Billboard Editor)
    const editorFolder = gui.addFolder('Editor');
    editorFolder.add({ openCrystalEditor: () => {
        const crystalEditor = document.getElementById('crystal-editor');
        if (crystalEditor) crystalEditor.style.display = crystalEditor.style.display === 'none' ? 'block' : 'none';
    }}, 'openCrystalEditor').name('Edit Crystals');
    editorFolder.add({ openTreeBillboardEditor: () => {
        if (window.treeBillboardEditor) {
            window.treeBillboardEditor.togglePanel(true);
        }
    }}, 'openTreeBillboardEditor').name('🌲 Tree & Billboard Editor');
    editorFolder.add(params, 'lockSunToPlayer').name('Lock Sun To Player'); 

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
    }}, 'loadCustomModel').name('📦 Load Custom Toon Model');

    customModelFolder = editorFolder.addFolder('📦 Custom Model');
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
    }}, 'cloneModel').name('👥 Clone Selected');

    customModelFolder.add({ deleteModel: () => {
        if (window.deleteSelectedModel) window.deleteSelectedModel();
    }}, 'deleteModel').name('🗑️ Delete Selected');

    // 🌊 Open Sea Ocean Modal Editor
    editorFolder.add({ openOceanModal: () => { if (window.waterModalUI) window.waterModalUI.toggle(); } }, 'openOceanModal').name('🌊 Open Sea Ocean Modal (O)');

    // 🎨 Live Biome Terrain Color & Shimmer Editor - Moved below Water Editor
    const colorEditorFolder = editorFolder.addFolder('🎨 Terrain Color & Shimmer');
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
    colorEditorFolder.addColor(colorParams, 'npSnow').name('❄️ Snow Color').onChange(hex => {
        northPoleColors.snowDune.set(hex);
        triggerTerrainColorUpdate();
    });
    colorEditorFolder.addColor(colorParams, 'npShadow').name('❄️ Snow Shadow').onChange(hex => {
        northPoleColors.snowShadow.set(hex);
        triggerTerrainColorUpdate();
    });
    colorEditorFolder.addColor(colorParams, 'npPeak').name('❄️ Peak Color').onChange(hex => {
        northPoleColors.icePeak.set(hex);
        triggerTerrainColorUpdate();
    });
    colorEditorFolder.addColor(colorParams, 'desertSlope').name('🏜️ Sand Color').onChange(hex => {
        desertColors.duneSlope.set(hex);
        triggerTerrainColorUpdate();
    });
    colorEditorFolder.addColor(colorParams, 'desertShadow').name('🏜️ Sand Shadow').onChange(hex => {
        desertColors.valleyShadow.set(hex);
        triggerTerrainColorUpdate();
    });
    colorEditorFolder.add(colorParams, 'shimmer', 0, 3, 0.1).name('✨ Shimmer Sparkle').onChange(val => {
        terrainUniforms.uShimmerMult.value = val;
    });

    // Add Game folder
    const gameFolder = gui.addFolder('Game');
    gameFolder.add(guiActions, 'switchModel').name('Switch Character');
    gameFolder.add(guiActions, 'toggleMusic').name('Toggle Music');
    gameFolder.add(guiActions, 'nextTrack').name('Next Track');
    gameFolder.add(params, 'summerFilter').name('Summer Filter').onChange(v => { document.getElementById('summer-toggle').click(); });
    gameFolder.add(params, 'modelVisible').name('Model Visible').onChange(v => { document.getElementById('invis-toggle').click(); });
    // Fullscreen removed from Game folder - now on the top bar!

    const envFolder = gui.addFolder('Environment');
    envFolder.add(params, 'sceneFog').name('Global Fog').onChange(v => {
        if (!v && typeof scene !== 'undefined' && scene.fog) {
            scene.fog.near = 100000;
            scene.fog.far = 200000;
        }
    });
    envFolder.add(params, 'fogIntensity', 0.1, 5.0, 0.1).name('Fog Intensity');
    envFolder.add(params, 'wind').name('Wind').onChange(v => { if(isWindOn !== v) document.getElementById('wind-toggle').click(); });
    const rainFolder = envFolder.addFolder('Rain Settings');
    params.rainSize = 2.0;
    params.rainIntensity = 1.0;
    params.rainWindX = 1.0;
    params.rainWindY = 0.5;
    rainFolder.add(params, 'rain').name('Enable Rain').onChange(v => { isRainOn = v; });
    rainFolder.add(params, 'rainSize', 0.5, 10.0).name('Drop Size');
    rainFolder.add(params, 'rainIntensity', 0.1, 5.0).name('Intensity');
    rainFolder.add(params, 'rainWindX', -5.0, 5.0).name('Wind X');
    rainFolder.add(params, 'rainWindY', -5.0, 5.0).name('Wind Z');
    window.biomeFogSettings = window.biomeFogSettings || {};
    const fogFolder = envFolder.addFolder('Ground Fog');
    fogFolder.add(params, 'fogPlane').name('Enable Fog').onChange(v => { if(typeof window.fogGroup !== 'undefined') window.fogGroup.visible = v; });
    params.biomeFogOffset = 0;
    const fogOffsetCtrl = fogFolder.add(params, 'biomeFogOffset', -50, 50).name('Biome Fog Offset').onChange(v => {
        if (typeof playerGrp !== 'undefined') {
            const bName = getBiomeAt(playerGrp.position.x, playerGrp.position.z).name;
            window.biomeFogSettings[bName] = v;
        }
    });
    // Add an interval to update the slider when biome changes
    setInterval(() => {
        if (typeof playerGrp !== 'undefined' && !fogOffsetCtrl.__onChangeBlocked) {
            const bName = getBiomeAt(playerGrp.position.x, playerGrp.position.z).name;
            const currentOffset = window.biomeFogSettings[bName] || 0;
            if (params.biomeFogOffset !== currentOffset) {
                params.biomeFogOffset = currentOffset;
                fogOffsetCtrl.__onChangeBlocked = true; // Prevent triggering onChange and writing back
                fogOffsetCtrl.updateDisplay();
                fogOffsetCtrl.__onChangeBlocked = false;
            }
            fogFolder.title('Ground Fog (' + bName + ')');
        }
    }, 500);

    envFolder.add(params, 'trails').name('Wind Trails').onChange(v => isWindTrailsOn = v);

    envFolder.add(params, 'shadeMode', ['original', 'cel', 'flat'])
        .name('🎨 Shade Mode')
        .onChange(v => {
            toonShaderManager.apply(scene, v);
            gui.controllersRecursive().forEach(c => { if (c.property === 'shadeMode') c.updateDisplay(); });
        });

    const debugFolder = gui.addFolder('🔧 Debug Render');
    debugFolder.add(params, 'showTerrain').name('Terrain').onChange(v => { terrain.visible = v; });

    debugFolder.add(params, 'showWater').name('🌊 Ocean Visible').onChange(v => {
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
    debugFolder.add(params, 'showBirds').name('Birds').onChange(v => {
        if (typeof instBirds !== 'undefined') instBirds.visible = v;
        if (typeof flockGrp !== 'undefined') flockGrp.visible = v;
        if (typeof window.birdFlock !== 'undefined' && window.birdFlock) window.birdFlock.visible = v;
        if (typeof window.flamingoFlock !== 'undefined' && window.flamingoFlock) window.flamingoFlock.visible = v;
    });
    debugFolder.add(params, 'showFogPlanes').name('Fog Planes').onChange(v => { if(typeof window.fogGroup !== 'undefined') window.fogGroup.visible = v; });
    debugFolder.add(params, 'showCrystals').name('Crystals').onChange(v => { instCrystals.visible = v; });

    const shadingFolder = debugFolder.addFolder('🎨 Shade Mode');
    shadingFolder.add(params, 'shadeMode', ['original', 'cel', 'flat'])
        .name('Mode (1/2/3)')
        .onChange(v => toonShaderManager.apply(scene, v));

    debugFolder.add(params, 'showMap').name('World Map').onChange(v => { const el = document.getElementById('world-map'); if(el) el.style.display = v ? 'block' : 'none'; });
    
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
        const isCurrentlyHidden = guiEl.style.display === 'none' || (typeof window !== 'undefined' && window.getComputedStyle(guiEl).display === 'none');
        const isVisible = typeof show === 'boolean' ? show : isCurrentlyHidden;
        guiEl.style.display = isVisible ? 'block' : 'none';
        params.showGUI = isVisible;
        
        const cogBtn = document.getElementById('gui-toggle-btn');
        if (cogBtn) {
            cogBtn.style.opacity = isVisible ? '1' : '0.85';
            cogBtn.style.transform = isVisible ? 'rotate(45deg)' : 'none';
        }
    }
    debugFolder.add(params, 'showGUI').name('lil-gui Panel').onChange(v => toggleGUI(v));
    debugFolder.add(params, 'godRays').name('☀️ God Rays').onChange(v => { godRaysPass.enabled = v; });
    debugFolder.add(params, 'godRayIntensity', 0, 2, 0.05).name('☀️ Ray Intensity').onChange(v => { godRaysPass.uniforms.uIntensity.value = v; });

    const guiToggleBtn = document.getElementById('gui-toggle-btn');
    if (guiToggleBtn) {
        guiToggleBtn.addEventListener('click', () => toggleGUI());
    }

    const oceanToggleBtn = document.getElementById('ocean-toggle-btn');
    if (oceanToggleBtn) {
        oceanToggleBtn.addEventListener('click', () => {
            if (window.waterModalUI) window.waterModalUI.toggle();
        });
    }

    window.addEventListener('keydown', (e) => {
        if ((e.key === 'o' || e.key === 'O') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            if (window.waterModalUI) window.waterModalUI.toggle();
        }
        if ((e.key === 'g' || e.key === 'G') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            const godBtn = document.getElementById('god-mode-btn');
            if (godBtn) godBtn.click();
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

    if (drawerGodBtn && normalGodBtn) {
        setTimeout(() => {
            const isGod = isGodMode;
            drawerGodBtn.innerText = isGod ? '👁️ God Mode: ON' : '👁️ God Mode: OFF';
            drawerGodBtn.style.color = isGod ? '#ff4444' : '#ffaa00';
        }, 1000);

        drawerGodBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            normalGodBtn.click();
            setTimeout(() => {
                const isGod = isGodMode;
                drawerGodBtn.innerText = isGod ? '👁️ God Mode: ON' : '👁️ God Mode: OFF';
                drawerGodBtn.style.color = isGod ? '#ff4444' : '#ffaa00';
            }, 50);
        });
    }
    

    
    document.getElementById('pause-toggle').addEventListener('click', () => {
        isFlightPaused = !isFlightPaused;
        document.getElementById('pause-toggle').innerText = isFlightPaused ? '▶' : '⏸';
    });

    document.getElementById('god-mode-btn').addEventListener('click', () => {
        isGodMode = !isGodMode;
        const btn = document.getElementById('god-mode-btn');
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
            document.getElementById('pause-toggle').innerText = '▶';
            btn.style.color = '#ff4444';
            btn.style.textShadow = '0 0 10px rgba(255, 68, 68, 0.9), 0 1px 3px rgba(0, 0, 0, 0.5)';
            btn.style.transform = 'scale(1.15)';
            btn.title = 'God Mode: ON (Free Camera Active) [G]';

            if (!godCamera) {
                const gm = setupGodMode(scene, cameraBase, renderer, playerGrp);
                godCamera = gm.godCamera;
                godControls = gm.godControls;
            }
            toggleGodMode(isGodMode, godCamera, camera, godControls, playerGrp, (cam) => {
                if (typeof scenePass !== 'undefined' && scenePass) scenePass.camera = cam;
            });
    
        } else {
            if (typeof params !== 'undefined') {
                params.showClouds = true;
            }
            if (typeof instClouds !== 'undefined') instClouds.visible = true;
            if (typeof instHighClouds !== 'undefined') instHighClouds.visible = true;
            if (typeof instWispyClouds !== 'undefined') instWispyClouds.visible = true;
            if (typeof instMegaClouds !== 'undefined') instMegaClouds.visible = true;
            if (typeof toonCloudMat !== 'undefined' && toonCloudMat.uniforms && toonCloudMat.uniforms.uEnableClouds) toonCloudMat.uniforms.uEnableClouds.value = 1.0;

            btn.style.color = 'rgba(255, 255, 255, 0.95)';
            btn.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.35), 0 0 8px rgba(0, 0, 0, 0.2)';
            btn.style.transform = 'scale(1.0)';
            btn.title = 'Toggle God Mode (Free Camera) [G]';

            toggleGodMode(isGodMode, godCamera, camera, godControls, playerGrp, (cam) => {
                if (typeof scenePass !== 'undefined' && scenePass) scenePass.camera = cam;
            });
    
        }
    });



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
    const matCloud = new THREE.MeshToonMaterial({ color: 0xfffaec, transparent: true, opacity: 1.0, gradientMap, dithering: true });
    const matWispyCloud = new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, gradientMap, dithering: true });
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

    function updateTerrainGeometry(playerX, playerZ) {
        const stepThreshold = 150;
        if (Math.hypot(playerX - lastTerrainGridX, playerZ - lastTerrainGridZ) < stepThreshold) return;
        
        const gridX = Math.round(playerX / stepThreshold) * stepThreshold;
        const gridZ = Math.round(playerZ / stepThreshold) * stepThreshold;
        
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
            if (i === 0 && Math.random() < 0.05) console.log('Terrain H:', h, 'WorldX:', worldX, 'Colors:', tempColor);
            pos.setY(i, h);

            getWorldColor(h, worldX, worldZ, tempColor);
            colors.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);

            // Fast analytical heightmap normals (avoids expensive computeVertexNormals triangle pass)
            const hL = getWorldHeight(worldX - 12, worldZ);
            const hR = getWorldHeight(worldX + 12, worldZ);
            const hD = getWorldHeight(worldX, worldZ - 12);
            const hU = getWorldHeight(worldX, worldZ + 12);
            tempVec1.set(hL - hR, 24.0, hD - hU).normalize();
            norm.setXYZ(i, tempVec1.x, tempVec1.y, tempVec1.z);

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
                    tempColor.lerp(new THREE.Color(0xd0edff), pathMask * 0.35);
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
    const PINE_CONFIGS = [
        { key: 'pine_var1', name: 'Stylized Pine 1 (Tall Majestic)', path: 'assets/stylized_pine_var1.glb', count: 120, height: 22.0, fallbackGeo: geoTree1, clusterGroup: 0 },
        { key: 'pine_var2', name: 'Stylized Pine 2 (Full Tiered)', path: 'assets/stylized_pine_var2.glb', count: 120, height: 22.0, fallbackGeo: geoTree2, clusterGroup: 0 },
        { key: 'pine_var3', name: 'Stylized Pine 3 (Mountain)', path: 'assets/Pine/stylized_pine_var3.glb', count: 110, height: 21.0, fallbackGeo: geoTree3, clusterGroup: 0 },
        { key: 'pine_var4', name: 'Stylized Pine 4 (Dense Alpine)', path: 'assets/Pine/stylized_pine_var4.glb', count: 110, height: 20.0, fallbackGeo: geoTree4, clusterGroup: 1 },
        { key: 'pine_fast', name: 'Pine (Ultra Fast Classic)', path: 'assets/Pine_ultra_fast.glb', count: 90, height: 22.0, fallbackGeo: geoTree1, clusterGroup: 1 },
        { key: 'pine_fast1', name: 'Pine Alt (Ultra Fast Spire)', path: 'assets/Pine_1_ultra_fast.glb', count: 80, height: 22.0, fallbackGeo: geoTree3, clusterGroup: 1 },
        { key: 'pine_small1', name: 'Small Stylized Pine 1', path: 'assets/small_stylized_pine_var1.glb', count: 90, height: 15.0, fallbackGeo: geoTree2, clusterGroup: 2 },
        { key: 'pine_small2', name: 'Small Stylized Pine 2 (Highland)', path: 'assets/Pine/small_stylized_pine_var2.glb', count: 90, height: 14.0, fallbackGeo: geoTree3, clusterGroup: 2 },
        { key: 'pine_small3', name: 'Small Stylized Pine 3 (Dwarf)', path: 'assets/small_stylized_pine_var3.glb', count: 80, height: 12.0, fallbackGeo: geoTree1, clusterGroup: 2 },
        { key: 'pine_sapling', name: 'Sapling Pine', path: 'assets/Pine/sapling_stylized_pine.glb', count: 80, height: 8.0, fallbackGeo: geoTree4, clusterGroup: 2 }
    ];

    const pineTreeMeshes = PINE_CONFIGS.map(cfg => {
        const mesh = new THREE.InstancedMesh(cfg.fallbackGeo, matTree, cfg.count);
        mesh.name = cfg.key;
        mesh.maxCount = cfg.count;
        mesh.config = cfg;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
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
    // VOLUMETRIC GROUND FOG (GOD RAYS)
    // ==========================================
    const fogGroup = new THREE.Group();
    const fogGeo = new THREE.PlaneGeometry(3500, 3500);
    fogGeo.rotateX(-Math.PI / 2);
    const fogUniforms = { uTime: uniform(0) };

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

    const getFogAlphaFn = Fn(([wPos, camPos, uTime]) => {
        const uv = wPos.xz.mul(0.0025);
        const yOffset = wPos.y.mul(0.2);
        const n1 = noise(uv.add(vec2(uTime.mul(0.03).add(yOffset), uTime.mul(0.02))));
        const n2 = noise(uv.mul(2.0).sub(vec2(uTime.mul(0.02).sub(yOffset), uTime.mul(-0.03))));
        const noiseAlpha = tslSmoothstep(-0.2, 0.8, n1.add(n2.mul(0.5)));
        
        const dist = wPos.xz.sub(camPos.xz).length();
        const edgeFade = float(1.0).sub(tslSmoothstep(1200.0, 1700.0, dist));
        const nearFade = tslSmoothstep(10.0, 50.0, dist);
        
        return noiseAlpha.mul(edgeFade).mul(nearFade);
    });

    const fogMat = new MeshBasicNodeMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        fog: false
    });
    
    fogMat.opacityNode = getFogAlphaFn(positionWorld, cameraPosition, fogUniforms.uTime).mul(0.25);

    // Stack 3 planes for cheap 3D parallax volumetric effect
    for(let i = 0; i < 3; i++) {
        const p = new THREE.Mesh(fogGeo, fogMat);
        p.position.y = 12 + i * 15; // 12, 27, 42
        p.receiveShadow = false;
        fogGroup.add(p);
    }
    fogGroup.visible = false;
    scene.add(fogGroup);
    window.fogGroup = fogGroup;
    window.fogUniforms = fogUniforms;

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
    const highCloudMat = new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });
    
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
    const megaCloudMat = new THREE.MeshToonMaterial({ color: 0xfff6e3, transparent: true, opacity: 1.0 });
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
    scene.background = null;
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

    const instBirds = new THREE.InstancedMesh(geoBird, matBird, BIRD_COUNT);
    instBirds.castShadow = true;
    instBirds.frustumCulled = false;
    scene.add(instBirds);

    const birdData = new Float32Array(BIRD_COUNT * 6); 
    for (let i = 0; i < BIRD_COUNT; i++) {
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
            let formRadius = 22 + (i % 6) * 9;
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

            let maxSpd = (centerPull > 3.0 && typeof velocity !== 'undefined') ? Math.max(40, velocity * 1.2) : 35;
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
            dummy.scale.setScalar(0.42);
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
    }

    function updateBirds(playerX, playerY, playerZ, time, dt) {
        const playerPos = { x: playerX, y: playerY, z: playerZ };
        const vel = (typeof velocity !== 'undefined') ? velocity : 35;
        if (typeof window.birdFlock !== 'undefined' && window.birdFlock) window.birdFlock.update(playerPos, time, dt, vel);
        if (typeof window.flamingoFlock !== 'undefined' && window.flamingoFlock) window.flamingoFlock.update(playerPos, time, dt, vel);
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
            
            // STRICT 800-METER TREE RADIUS WITH SEAMLESS PROGRESSIVE LOD HANDOFF
            const activeTreeDist = 800;
            const dense3dRadius = 420; // 3D GLB trees spawn from 0m to 420m
            const billboardMinDist = 380; // Billboards spawn from 380m out to 800m (40m overlap ring)
            const billboardMaxDist = 800;

            if (params.showTrees) {
                const playerInJungle = getBiomeAt(focusX, focusZ).name.toLowerCase().includes('jungle');
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
                        const treeInJungle = dummy.position.y > 0 && getBiomeAt(dummy.position.x, dummy.position.z).name.toLowerCase().includes('jungle');
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

                                    h = getWorldHeight(nx, nz);
                                    pathVal = getPathStrength(nx, nz);
                                    bName = getBiomeAt(nx, nz).name;

                                    let isForest = true;
                                    let biomeMatch = !bName.toLowerCase().includes('jungle') && !bName.includes('Crystal Land') && !bName.includes('Desert') && !bName.includes('Canyon') && !bName.includes('North Pole') && !bName.includes('Misty');
                                    let islandMaskOk = (getIslandData(nx, nz).mask >= 0.35);
                                    let elevationValid = (h >= 6.8 && h <= 55.0) && islandMaskOk;

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
                                                    if ((neighbor.x - nx)**2 + (neighbor.z - nz)**2 < 20) tooClose = true;
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
                                let baseS = 0.90 + Math.random() * 0.40;
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
                                    bName = getBiomeAt(nx, nz).name;

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
                                    bName = getBiomeAt(nx, nz).name;

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

    // Character Models State
    let currentCharacter = 'kiki';
    let kikiModel = null;
    let whaleModel = null;
    let whaleMixer = null;
    let isModelVisible = true;

    const CHAR_CYCLE = [
        { id: 'kiki', nextLabel: 'Switch to Whale' },
        { id: 'whale', nextLabel: 'Switch to Kiki' }
    ];

    function updateModelVisibility() {
        if (kikiModel) kikiModel.visible = isModelVisible && (currentCharacter === 'kiki');
        if (whaleModel) whaleModel.visible = isModelVisible && (currentCharacter === 'whale');

        const btn = document.getElementById('invis-toggle');
        if (btn) btn.innerText = isModelVisible ? '👁 Model: VISIBLE' : '👁 Model: INVISIBLE';
    }

    document.getElementById('invis-toggle')?.addEventListener('click', () => {
        isModelVisible = !isModelVisible;
        updateModelVisibility();
        if (typeof params !== 'undefined') params.modelVisible = isModelVisible;
    });

    document.getElementById('char-toggle').addEventListener('click', () => {
        const idx = CHAR_CYCLE.findIndex(c => c.id === currentCharacter);
        const nextIdx = (idx + 1) % CHAR_CYCLE.length;
        currentCharacter = CHAR_CYCLE[nextIdx].id;
        document.getElementById('char-toggle').innerText = CHAR_CYCLE[nextIdx].nextLabel;
        updateModelVisibility();
    });


    // Load Kiki GLTF Model
    const gltfLoader = new GLTFLoader();
    
    // Initialize DRACOLoader for compressed GLB meshes
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    gltfLoader.setDRACOLoader(dracoLoader);
    
    // Initialize KTX2Loader for compressed textures (like the Whale model)
    const ktx2Loader = new KTX2Loader()
        .setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/libs/basis/')
        .detectSupport(renderer);
    gltfLoader.setKTX2Loader(ktx2Loader);
    
    // Initialize MeshoptDecoder for compressed geometries (like the Whale model)
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // Animated Birds Flock (low_poly_bird_animated_optimized.glb)
    const birdFlock = new AnimatedFlockSystem({
        scene,
        gltfLoader,
        resolveAssetUrl,
        count: LOW_GFX ? 12 : 25,
        modelPath: 'flight_models/low_poly_bird_animated_optimized.glb',
        scale: 0.08,
        rotYOffset: 0,
        altitudeOffset: 65,
        flockRadius: 80
    });
    window.birdFlock = birdFlock;

    // Flamingo Flock (flamingo.glb) - Warm zones only!
    const flamingoFlock = new AnimatedFlockSystem({
        scene,
        gltfLoader,
        resolveAssetUrl,
        count: LOW_GFX ? 8 : 16,
        modelPath: 'flight_models/flamingo.glb',
        scale: 0.05,
        rotYOffset: 0,
        isWarmOnly: true,
        getBiomeAt,
        altitudeOffset: 50,
        flockRadius: 90
    });
    window.flamingoFlock = flamingoFlock;

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
    // GLB Pine Tree Loader — Merged Single Draw Call
    // ==========================================
    // Merges Bark + Leaves primitives into ONE geometry with vertex colors.
    // 1 InstancedMesh = 1 draw call per tree slot (not 2).

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
            instMesh.material = matTree;
            instMesh.instanceColor = null;
            instMesh.instanceMatrix.needsUpdate = true;
        });
    }

    // Asynchronously load ALL 10 GLTF Pine tree assets into their respective instanced meshes
    PINE_CONFIGS.forEach((cfg, idx) => {
        const instMesh = pineTreeMeshes[idx];
        const fullUrl = resolveAssetUrl(cfg.path);
        gltfLoader.load(fullUrl, (gltf) => {
            applyGLBPineTree(gltf, [instMesh], cfg.height);
            console.log('✓ Successfully loaded and applied pine model:', cfg.name, fullUrl);
        }, undefined, (err) => {
            console.error('Failed to load pine model:', fullUrl, err);
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



    gltfLoader.load(
        resolveAssetUrl('kiki-lowpoly.glb'),
        (gltf) => {
            kikiModel = gltf.scene;
            const box = new THREE.Box3().setFromObject(kikiModel);
            const size = new THREE.Vector3();
            box.getSize(size);
            const center = new THREE.Vector3();
            box.getCenter(center);
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetScale = maxDim > 0 ? (2.0 / maxDim) : 1.0;
            kikiModel.scale.set(targetScale, targetScale, targetScale);
            
            kikiModel.position.x = -center.x * targetScale;
            kikiModel.position.y = -center.y * targetScale;
            kikiModel.position.z = -center.z * targetScale;
            
            kikiModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            kikiModel.rotation.y = Math.PI;
            proxyMesh.visible = false;
            kikiModel.visible = (currentCharacter === 'kiki');
            playerVisuals.add(kikiModel);
        }
    );

    // Load Princess on a Whale GLTF Model
    gltfLoader.load(
        resolveAssetUrl('Princess.glb'),
        (gltf) => {
            whaleModel = gltf.scene;
            const box = new THREE.Box3().setFromObject(whaleModel);
            const size = new THREE.Vector3();
            box.getSize(size);
            const center = new THREE.Vector3();
            box.getCenter(center);
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetScale = maxDim > 0 ? (6.0 / maxDim) : 1.0;
            whaleModel.scale.set(targetScale, targetScale, targetScale);
            
            whaleModel.position.x = -center.x * targetScale;
            whaleModel.position.y = -center.y * targetScale;
            whaleModel.position.z = -center.z * targetScale;
            
            whaleModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            whaleModel.rotation.y = Math.PI;
            whaleModel.visible = (currentCharacter === 'whale');
            playerVisuals.add(whaleModel);
            
            if (gltf.animations && gltf.animations.length > 0) {
                whaleMixer = new THREE.AnimationMixer(whaleModel);
                whaleMixer.clipAction(gltf.animations[0]).play();
            }
        },
        undefined,
        (err) => console.warn("Could not load Princess.glb:", err)
    );

    



    
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
            uiVisible = !uiVisible;
            if (typeof gui !== 'undefined') gui.domElement.style.display = uiVisible ? 'block' : 'none';
            

        }
        if(e.key.toLowerCase() === 'v') {
            isModelVisible = !isModelVisible;
            updateModelVisibility();
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
    const maxRadius = 60;

    if (joyBase) {
        joyBase.style.opacity = '0'; // Hide by default
        joyBase.style.pointerEvents = 'none';
    }

    let initialPinchDist = null;
    let initialZoomDist = null;

    window.addEventListener('touchstart', e => {
        if (e.target.tagName !== 'CANVAS') return; // Ignore touches on UI buttons
        e.preventDefault();

        if (e.touches.length === 1) {
            const touch = e.changedTouches[0];
            activeTouchId = touch.identifier;
            
            // Move joyBase to touch point
            if (joyBase) {
                joyBase.style.left = (touch.clientX - 50) + 'px';
                joyBase.style.top = (touch.clientY - 50) + 'px';
                joyBase.style.bottom = 'auto';
                joyBase.style.opacity = '1';
                joyBase.style.background = 'rgba(255,255,255,0.18)';
                joyBase.style.borderColor = 'rgba(255,255,255,0.4)';
            }
            
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
            
            cameraZoomDist = initialZoomDist * (initialPinchDist / newDist);
            cameraZoomDist = Math.max(5.0, Math.min(300.0, cameraZoomDist));
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
            joyBase.style.background = '';
            joyBase.style.borderColor = '';
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
    // --- Low-Poly Particle Starfield ---
    const starCount = LOW_GFX ? 2000 : 8000;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starPulse = new Float32Array(starCount);

    for (let i = 0; i < starCount * 3; i += 3) {
        // Distribute randomly in a sphere well within camera.far (3000)
        const radius = 2500;
        const u = Math.random();
        // Restrict v to [0.5, 1.0] to only generate stars in the upper hemisphere
        const v = Math.random() * 0.5 + 0.5;
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        
        const y = radius * Math.cos(phi);
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const z = radius * Math.sin(phi) * Math.sin(theta);

        starPositions[i] = x;
        starPositions[i + 1] = y;
        starPositions[i + 2] = z;
        
        // Make 10% of stars pulse
        starPulse[i / 3] = Math.random() < 0.1 ? 1.0 : 0.0;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('pulse', new THREE.BufferAttribute(starPulse, 1));
    const starMaterial = new PointsNodeMaterial({
        color: 0xffffff,
        size: 1.0,
        transparent: true,
        opacity: 0.0
    });
    
    const starField = new THREE.Points(starGeometry, starMaterial);
    starField.renderOrder = -3;
    starField.visible = false;
    scene.add(starField);

    // --- Camera Rig Hierarchy ---
    const cameraBase = new THREE.Group(); 
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
    const quatIdentity = new THREE.Quaternion();

    let envConfigs = [
        {bg: 0x8cbce6, fog: 0x8cbce6, amb: 0xdcf2ff, dir: 0xfffaeb, ambI: 1.053, dirI: 2.14, starOp: 0, sunY: 1500, moonY: -1500, glintCol: 0xfff0d0, cloudCol: 0xfffaec}, // Day / Morning
        {bg: 0xffa07a, fog: 0xffa07a, amb: 0xffdab9, dir: 0xffaa00, ambI: 1.1, dirI: 3.2, starOp: 0, sunY: 160, moonY: 200, glintCol: 0xffaa00, cloudCol: 0xffc090}, // Dusk (lower sun)
        {bg: 0x162d5a, fog: 0x224888, amb: 0x7788bb, dir: 0xffbb55, ambI: 1.5, dirI: 3.5, starOp: 1.0, sunY: -8000, moonY: 1600, glintCol: 0xffaa44, cloudCol: 0x2e4a80}, // Twilight / Night (Bright Moonlight & Warm Kiki Glow)
    ];
    let currentSunY = 1500;
    let currentMoonY = -1500;
    let currentFps = 60;

    let lastFpsTime = performance.now();
    let framesThisSecond = 0;
    let lastAnimTime = performance.now();
    let smoothedDt = 0.0166;


    let playerPhysics;
    let cameraManager;
    


    async function animate() {
        if (proceduralSkyMesh) {
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
        if (rawDt > 0.1 || rawDt <= 0) rawDt = 0.0166;
        smoothedDt = smoothedDt * 0.7 + rawDt * 0.3;
        let dt = smoothedDt;

        const time = clock.getElapsedTime();

        if (starMaterial.userData.shader) {
            starMaterial.userData.shader.uniforms.time.value = time;
        }

        if (animeWaterSystem && animeWaterSystem.visible) {
            const activeCam = isGodMode ? godCamera : camera;
            animeWaterSystem.update(dt, time, activeCam, playerGrp ? playerGrp.position : null, dirLight ? dirLight.position : null);
        }
        if (typeof terrainUniforms !== 'undefined') {
            terrainUniforms.uTime.value = time;
            if (typeof dirLight !== 'undefined') {
                terrainUniforms.uSunDir.value.copy(dirLight.position).normalize();
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
        if (typeof window.fogUniforms !== 'undefined' && window.fogGroup) {
            window.fogUniforms.uTime.value = time;
            const bName = getBiomeAt(playerGrp.position.x, playerGrp.position.z).name;
            const biomeFogOffset = (window.biomeFogSettings && window.biomeFogSettings[bName]) ? window.biomeFogSettings[bName] : 0;
            const currentGroundY = getWorldHeight(playerGrp.position.x, playerGrp.position.z);
            // Smoothly interpolate fog group Y to prevent snapping, but snap X and Z to player
            window.fogGroup.position.x = playerGrp.position.x;
            window.fogGroup.position.z = playerGrp.position.z;
            const targetFogY = (currentGroundY <= -4.0 || bName.includes('Ocean')) ? -200.0 : (currentGroundY - 15 + biomeFogOffset);
            window.fogGroup.position.y += (targetFogY - window.fogGroup.position.y) * dt * 2.0;
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
                fpsEl.innerText = `FPS${currentFps}`;
            }
            const currZn = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
            const biomeEl = document.getElementById('biome-label');
            if (biomeEl) biomeEl.innerText = currZn.name;
        }

        
        // 3-Stage Lighting Engine Lerp
        const target = envConfigs[timePhase];
        const decayEnv = 1.0 - Math.exp(-2.0 * dt);
        if (scene.background && scene.background.isColor) {
            scene.background.lerp(tempColorTarget.setHex(target.bg), decayEnv);
        }
        scene.fog.color.lerp(tempColorTarget.setHex(target.fog), decayEnv);
        
        ambientLight.color.lerp(tempColorTarget.setHex(target.amb), decayEnv);
        ambientLight.intensity += (target.ambI - ambientLight.intensity) * decayEnv;
        dirLight.color.lerp(tempColorTarget.setHex(target.dir), decayEnv);
        // Hide old star field — procedural sky handles stars now
        starMaterial.opacity = 0;
        starField.visible = false;

        // Procedural Sky — per-biome lerp + night factor
        if (skyUniforms && typeof playerGrp !== 'undefined') {
            const skyBiomeName = getBiomeAt(playerGrp.position.x, playerGrp.position.z).name;
            const biomeTarget = BIOME_SKY_CONFIGS[skyBiomeName] || BIOME_SKY_CONFIGS['🌊 Open Ocean'];
            const decaySky = 1.0 - Math.exp(-0.8 * dt);

            skyUniforms.uCloudCoverage.value += (biomeTarget.coverage - skyUniforms.uCloudCoverage.value) * decaySky;
            skyUniforms.uCloudEdge.value += (biomeTarget.edge - skyUniforms.uCloudEdge.value) * decaySky;
            skyUniforms.uCloudSpeed.value += (biomeTarget.speed - skyUniforms.uCloudSpeed.value) * decaySky;
            skyUniforms.uCloudTurbulence.value += (biomeTarget.turbulence - skyUniforms.uCloudTurbulence.value) * decaySky;
            skyUniforms.uStormDarken.value += (biomeTarget.stormDarken - skyUniforms.uStormDarken.value) * decaySky;
            skyUniforms.uSkyColorZenith.value.lerp(tempColorTarget.setHex(biomeTarget.skyZenith), decaySky);
            skyUniforms.uSkyColorHorizon.value.lerp(tempColorTarget.setHex(biomeTarget.skyHorizon), decaySky);
            skyUniforms.uCloudColor.value.lerp(tempColorTarget.setHex(biomeTarget.cloudCol), decaySky);
            skyUniforms.uCloudShadowColor.value.lerp(tempColorTarget.setHex(biomeTarget.cloudShadow), decaySky);
            skyUniforms.uSunColor.value.lerp(tempColorTarget.setHex(target.dir), decaySky);
            
            // Sync Open Sea Time Of Day
            zenithColorUniform.value.copy(skyUniforms.uSkyColorZenith.value);
            horizonColorUniform.value.copy(skyUniforms.uSkyColorHorizon.value);
            sunColorUniform.value.copy(dirLight.color);
            sunDirUniform.value.copy(dirLight.position).normalize();

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

            // Night factor from sun Y position
            const nightFactor = THREE.MathUtils.smoothstep(-currentSunY, -200, 800);
            skyUniforms.uNightFactor.value = nightFactor;

            // Dusk factor: peaks when sun is low (sunY ~100-400), 0 at morning (1500) and night (-8000)
            const duskHigh = 1.0 - THREE.MathUtils.smoothstep(currentSunY, 300, 800);
            const duskLow = THREE.MathUtils.smoothstep(currentSunY, -500, 0);
            const duskFactor = duskHigh * duskLow;
            skyUniforms.uDuskFactor.value = duskFactor;
            skyUniforms.uStarDensity.value = Math.max(nightFactor, duskFactor * 0.7);
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
        if (typeof playerGrp !== 'undefined') {
            inCrystalLand = getBiomeAt(playerGrp.position.x, playerGrp.position.z).name.includes('Crystal');
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



        const inNorthPole = typeof playerGrp !== 'undefined' && getBiomeAt(playerGrp.position.x, playerGrp.position.z).name.includes('North Pole');
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
                        const bName = getBiomeAt(nx, nz).name;
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

        if (isGodMode && godControls) {
            updateGodMode(dt, keys, godControls, godCamera);
        }

        if (playerPhysics) {
            playerPhysics.update(dt, inputState, isBraking, isBoosting, isFlightPaused, treeGrid);
            
            if (cameraManager) {
                cameraManager.update(dt, playerGrp, playerPhysics.currentYaw, isBoosting);
            }
        }
    

        // Keep the physical sun and flare exactly 20,000 units away directly in front of the player's flight path
        const decaySunY = 1.0 - Math.exp(-2.0 * dt);
        currentSunY += (target.sunY - currentSunY) * decaySunY;
        currentMoonY += (target.moonY - currentMoonY) * decaySunY;

        tempVecSunFwd.set(0, 0, -20000);
        if (params.lockSunToPlayer) { tempVecSunFwd.applyQuaternion(playerGrp.quaternion); }

        // Sun positioning & visibility
        staticSun.position.copy(playerGrp.position).add(tempVecSunFwd);
        staticSun.position.y = playerGrp.position.y * 0.45 + currentSunY;
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
        
        if (params.sceneFog) {
            scene.fog.far += (dynamicFar - scene.fog.far) * dt * 2.0;
            scene.fog.near += (dynamicNear - scene.fog.near) * dt * 2.0;
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
            if (!isWindOn || !isBoosting) {
                windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15);
            } else {
                const speedFactor = Math.max(0, Math.min(1, (playerPhysics ? playerPhysics.velocity : 18.0 - 15) / 30)); 
                const targetVolume = 0.25 + speedFactor * 0.35;
                windGain.gain.setTargetAtTime(targetVolume, audioCtx.currentTime, 0.1);
                
                const targetFreq = 400 + Math.sin(time) * 100 + speedFactor * 800; 
                windFilter.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.1);
            }
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
                    godRaysPass.uniforms.uSunScreenPos.value.set(sunScreenX, sunScreenY);

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
        if (composer && typeof composer.setSize === 'function') {
            composer.setSize(window.innerWidth, window.innerHeight);
        }
    });

    let timePhase = parseInt(localStorage.getItem('wl_timePhase')) || 0; // 0: Day, 1: Dusk, 2: Deep Twilight
    
    // ... lighting targets for lerping
    const envTargets = {
        bg: new THREE.Color(),
        fog: new THREE.Color(),
        amb: new THREE.Color(),
        dir: new THREE.Color(),
    };
    
    const timeToggleBtn = document.getElementById('time-toggle');
    if (timeToggleBtn) {
        // Restore saved time phase icon on load
        if (timePhase === 1) timeToggleBtn.innerText = '🌇';
        else if (timePhase === 2) timeToggleBtn.innerText = '🌙';
        else timeToggleBtn.innerText = '☀️';

        timeToggleBtn.addEventListener('click', () => {
            timePhase = (timePhase + 1) % 3;
            if (timePhase === 0) timeToggleBtn.innerText = '☼';
            else if (timePhase === 1) timeToggleBtn.innerText = '🌇';
            else timeToggleBtn.innerText = '🌙';
            localStorage.setItem('wl_timePhase', timePhase);
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
    }



    // ==========================================
    // 10. PROCEDURAL AMBIENT MUSIC
    // ==========================================
    let musicGain, reverbNode;
    let isMusicPlaying = false;
    let currentTrack = 0;
    let nextNoteTime = 0;
    let musicTimerID;
    
    let chordIndex = 0;
    let sequenceTime = 0;
    let arpIndex = 0;

    const tracks = [
        { 
            name: "Spirited Winds", 
            chords: [
                [174.61, 220.00, 261.63, 329.63], // Fmaj7
                [196.00, 246.94, 293.66, 349.23], // G7
                [164.81, 196.00, 246.94, 293.66], // Em7
                [220.00, 261.63, 329.63, 392.00]  // Am7
            ],
            speed: 2400, 
            stepSpeed: 300,
            padOsc: 'triangle',
            leadOsc: 'sine'
        },
        { 
            name: "Summer Clouds", 
            chords: [
                [261.63, 329.63, 392.00, 493.88], // Cmaj7
                [196.00, 246.94, 293.66, 392.00], // G
                [220.00, 261.63, 329.63, 392.00], // Am7
                [174.61, 220.00, 261.63, 329.63]  // Fmaj7
            ],
            speed: 3200, 
            stepSpeed: 400,
            padOsc: 'sawtooth',
            leadOsc: 'triangle'
        },
        { 
            name: "Evening Whispers", 
            chords: [
                [220.00, 261.63, 329.63, 493.88], // Am9
                [174.61, 220.00, 261.63, 392.00], // Fmaj9
                [261.63, 329.63, 392.00, 493.88], // Cmaj7
                [164.81, 207.65, 246.94, 293.66]  // E7
            ],
            speed: 2800, 
            stepSpeed: 350,
            padOsc: 'sine',
            leadOsc: 'sine'
        },
        { 
            name: "Wandering Spirits", 
            chords: [
                [261.63, 329.63, 392.00, 523.25], // C
                [174.61, 220.00, 261.63, 349.23], // F
                [196.00, 246.94, 293.66, 392.00], // G
                [220.00, 261.63, 329.63, 440.00]  // Am
            ],
            speed: 2000, 
            stepSpeed: 250,
            padOsc: 'triangle',
            leadOsc: 'triangle'
        },
        { 
            name: "Star Ocean", 
            chords: [
                [293.66, 369.99, 440.00, 554.37], // Dmaj7
                [220.00, 277.18, 329.63, 415.30], // Amaj7
                [246.94, 293.66, 369.99, 440.00], // Bm7
                [196.00, 246.94, 293.66, 369.99]  // Gmaj7
            ],
            speed: 4000, 
            stepSpeed: 500,
            padOsc: 'sine',
            leadOsc: 'triangle'
        },
        { 
            name: "Floating Islands", 
            chords: [
                [207.65, 261.63, 311.13, 392.00], // Abmaj7
                [233.08, 293.66, 349.23, 440.00], // Bbmaj7
                [261.63, 329.63, 392.00, 493.88], // Cmaj7
                [261.63, 329.63, 392.00, 493.88]  // Cmaj7 (held)
            ],
            speed: 4500, 
            stepSpeed: 500,
            padOsc: 'triangle',
            leadOsc: 'sine'
        },
        { 
            name: "Mystic Journey", 
            chords: [
                [196.00, 233.08, 293.66, 349.23], // Gm7
                [174.61, 220.00, 261.63, 329.63], // Fmaj7
                [155.56, 196.00, 233.08, 293.66], // Ebmaj7
                [146.83, 185.00, 220.00, 293.66]  // D7
            ],
            speed: 3600, 
            stepSpeed: 450,
            padOsc: 'sine',
            leadOsc: 'triangle'
        },
        { 
            name: "Gentle Breeze", 
            chords: [
                [329.63, 415.30, 493.88, 622.25], // Emaj7
                [277.18, 349.23, 415.30, 554.37], // Dbmaj7
                [246.94, 311.13, 369.99, 493.88], // Bmaj7
                [220.00, 277.18, 329.63, 440.00]  // Amaj7
            ],
            speed: 3000, 
            stepSpeed: 300,
            padOsc: 'sine',
            leadOsc: 'sine'
        }
    ];

    const arpPatterns = [
        [0, 1, 2, 3, 2, 1],
        [0, 2, 1, 3, 2, 3],
        [0, 1, 2, 1],
        [1, 2, 3, 2]
    ];

    function createReverb() {
        const length = audioCtx.sampleRate * (LOW_GFX ? 0.5 : 4); 
        const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
        for (let i = 0; i < 2; i++) {
            const channel = impulse.getChannelData(i);
            for (let j = 0; j < length; j++) {
                channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 3);
            }
        }
        const convolver = audioCtx.createConvolver();
        convolver.buffer = impulse;
        return convolver;
    }

    function playNote(freq, time, duration, oscType, isPad = false) {
        const osc = audioCtx.createOscillator();
        const env = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        
        osc.type = oscType;
        osc.frequency.value = freq;
        
        filter.type = 'lowpass';
        
        if (isPad) {
            filter.frequency.value = 600;
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.04, time + duration * 0.4);
            env.gain.linearRampToValueAtTime(0.001, time + duration);
        } else {
            filter.frequency.setValueAtTime(1200, time);
            filter.frequency.exponentialRampToValueAtTime(400, time + duration);
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.1, time + 0.05); // Quick attack
            env.gain.exponentialRampToValueAtTime(0.001, time + duration);
        }
        
        osc.connect(filter);
        filter.connect(env);
        env.connect(musicGain);
        
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
                
                // Play pad for the chord
                chord.forEach(freq => {
                    playNote(freq / 2, nextNoteTime, track.speed / 1000 * 1.5, track.padOsc, true);
                });
            }
            
            const chord = track.chords[chordIndex % track.chords.length];
            const pattern = arpPatterns[chordIndex % arpPatterns.length];
            
            // Music box arpeggio step
            if (sequenceTime % track.stepSpeed === 0) {
                const arpFreq = chord[pattern[arpIndex % pattern.length]] * 2; // Up one octave
                playNote(arpFreq, nextNoteTime, track.stepSpeed / 1000 * 2.0, track.leadOsc, false);
                arpIndex++;
                
                // Occasional slow melody note
                if (Math.random() > 0.7) {
                    const melFreq = chord[Math.floor(Math.random() * chord.length)] * 4; // Up two octaves
                    playNote(melFreq, nextNoteTime, track.speed / 1000 * 0.8, track.leadOsc, false);
                }
            }
            
            // Timing
            nextNoteTime += track.stepSpeed / 1000;
            sequenceTime += track.stepSpeed;
            
            if (sequenceTime >= track.speed) {
                sequenceTime = 0;
                chordIndex++;
                arpIndex = 0;
            }
        }
        musicTimerID = setTimeout(scheduleNotes, 50);
    }

    document.getElementById('music-toggle').addEventListener('click', () => {
        initAudio(); 
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        if (!musicGain) {
            musicGain = audioCtx.createGain();
            musicGain.gain.value = 0.5;
            reverbNode = createReverb();
            musicGain.connect(reverbNode);
            reverbNode.connect(audioCtx.destination);
            musicGain.connect(audioCtx.destination);
        }

        isMusicPlaying = !isMusicPlaying;
        const trackBtn = document.getElementById('track-toggle');
        if (isMusicPlaying) {
            sequenceTime = 0;
            chordIndex = 0;
            arpIndex = 0;
            nextNoteTime = audioCtx.currentTime + 0.1;
            scheduleNotes();
            document.getElementById('music-toggle').innerText = "⏸ Music";
            trackBtn.style.display = "block";
        } else {
            clearTimeout(musicTimerID);
            document.getElementById('music-toggle').innerText = "▶ Music";
            trackBtn.style.display = "none";
        }
    });

    document.getElementById('track-toggle').addEventListener('click', () => {
        currentTrack = (currentTrack + 1) % tracks.length;
        document.getElementById('track-toggle').innerText = "Track: " + tracks[currentTrack].name;
        
        sequenceTime = 0;
        chordIndex = 0;
        arpIndex = 0;
        nextNoteTime = audioCtx.currentTime + 0.1;
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

    // Atmosphere Editor (Appended to lil-gui)
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
            // Refresh GUI display without triggering onChange
            if (atmoFolder) {
                atmoFolder.controllers.forEach(c => c.updateDisplay());
            }
        }
        
        // Listen to phase changes
        const oldTimeToggle = document.getElementById('time-toggle').onclick;
        document.getElementById('time-toggle').addEventListener('click', () => {
            setTimeout(updateAtmoParamsFromPhase, 50);
        });

        const atmoFolder = gui.addFolder('Atmosphere');

        // Per-biome procedural sky editor
        const skyEditorParams = {
            coverage: 0.45, edge: 0.07, speed: 0.02,
            skyZenith: '#4a90d9', skyHorizon: '#b8d4e8',
            cloudCol: '#fff8f0', cloudShadow: '#8898a8',
            turbulence: 0.0, stormDarken: 0.0,
            weather: 'clear'
        };
        const skyFolder = atmoFolder.addFolder('☁️ Procedural Sky (Per Biome)');

        function writeSkyToConfig(key, val) {
            if (typeof playerGrp !== 'undefined') {
                const bName = getBiomeAt(playerGrp.position.x, playerGrp.position.z).name;
                if (BIOME_SKY_CONFIGS[bName]) BIOME_SKY_CONFIGS[bName][key] = val;
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

        // Update sliders when biome changes (same pattern as Ground Fog)
        setInterval(() => {
            if (typeof playerGrp !== 'undefined') {
                const bName = getBiomeAt(playerGrp.position.x, playerGrp.position.z).name;
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
                    skyFolder.title('☁️ Procedural Sky (' + bName + ')');
                }
            }
        }, 500);

        atmoFolder.addColor(atmoParams, 'skyColor').name('Sky Color').onChange(v => envConfigs[timePhase].bg = parseInt(v.replace('#',''), 16));
        atmoFolder.addColor(atmoParams, 'fogColor').name('Fog Color').onChange(v => envConfigs[timePhase].fog = parseInt(v.replace('#',''), 16));
        atmoFolder.addColor(atmoParams, 'ambColor').name('Ambient Light').onChange(v => envConfigs[timePhase].amb = parseInt(v.replace('#',''), 16));
        atmoFolder.addColor(atmoParams, 'dirColor').name('Sun Light').onChange(v => envConfigs[timePhase].dir = parseInt(v.replace('#',''), 16));
        atmoFolder.add(atmoParams, 'ambI', 0, 3).name('Amb Intensity').onChange(v => envConfigs[timePhase].ambI = v);
        atmoFolder.add(atmoParams, 'dirI', 0, 5).name('Sun Intensity').onChange(v => envConfigs[timePhase].dirI = v);
        atmoFolder.addColor(atmoParams, 'glintCol').name('Water Glint').onChange(v => envConfigs[timePhase].glintCol = parseInt(v.replace('#',''), 16));
        
        // 🌙 Dedicated Moonlight & Night Editor
        const moonParams = {
            moonlightColor: '#' + envConfigs[2].dir.toString(16).padStart(6, '0'),
            moonlightIntensity: envConfigs[2].dirI,
            nightAmbColor: '#' + envConfigs[2].amb.toString(16).padStart(6, '0'),
            nightAmbIntensity: envConfigs[2].ambI,
            nightSkyColor: '#' + envConfigs[2].bg.toString(16).padStart(6, '0'),
            nightFogColor: '#' + envConfigs[2].fog.toString(16).padStart(6, '0'),
            moonAltitude: envConfigs[2].moonY
        };

        const moonFolder = atmoFolder.addFolder('🌙 Moonlight & Night');
        moonFolder.add(params, 'exposure', 0.5, 4.0, 0.1).name('☀️ Global Brightness').onChange(v => {
            renderer.toneMappingExposure = v;
        });
        moonFolder.addColor(moonParams, 'moonlightColor').name('Moonlight Color').onChange(v => envConfigs[2].dir = parseInt(v.replace('#',''), 16));
        moonFolder.add(moonParams, 'moonlightIntensity', 0, 10, 0.1).name('Moonlight Power').onChange(v => envConfigs[2].dirI = v);
        moonFolder.addColor(moonParams, 'nightAmbColor').name('Night Fill Color').onChange(v => envConfigs[2].amb = parseInt(v.replace('#',''), 16));
        moonFolder.add(moonParams, 'nightAmbIntensity', 0, 5, 0.1).name('Night Fill Power').onChange(v => envConfigs[2].ambI = v);
        moonFolder.addColor(moonParams, 'nightSkyColor').name('Night Sky Color').onChange(v => envConfigs[2].bg = parseInt(v.replace('#',''), 16));
        moonFolder.addColor(moonParams, 'nightFogColor').name('Night Fog Color').onChange(v => envConfigs[2].fog = parseInt(v.replace('#',''), 16));
        moonFolder.add(moonParams, 'moonAltitude', 200, 4000, 50).name('Moon Altitude').onChange(v => envConfigs[2].moonY = v);

        // ✨ Kiki Warm Side Glow Editor
        const kikiGlowParams = {
            intensity: 2.5,
            distance: 300,
            spread: 35,
            color: '#ffaa44'
        };
        const glowFolder = envFolder.addFolder('💡 Kiki Warm Side Glow');
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
        
        // Cloud Editor
        const cloudParams = {
            c0: '#' + pastelColors[0].toString(16).padStart(6, '0'),
            c1: '#' + pastelColors[1].toString(16).padStart(6, '0'),
            c2: '#' + pastelColors[2].toString(16).padStart(6, '0'),
            c3: '#' + pastelColors[3].toString(16).padStart(6, '0'),
            c4: '#' + pastelColors[4].toString(16).padStart(6, '0'),
            opBase: 1.0,
            opHigh: 1.0,
            opWispy: 1.0,
            opMega: 1.0,
            opHorizon: 1.0,
            enableClouds: true,
            density: 1.0,
            cloudScale: 1.0
        };
        
        let oldCloudColors = [...pastelColors];
        function updateCloudColorForIndex(idx, newHex) {
            const oldHex = oldCloudColors[idx];
            const newHexVal = parseInt(newHex.replace('#',''), 16);
            if (oldHex === newHexVal) return;
            pastelColors[idx] = newHexVal;
            const oldColor = new THREE.Color(oldHex);
            const newColor = new THREE.Color(newHexVal);
            const temp = new THREE.Color();
            
            [instClouds, instHighClouds].forEach(mesh => {
                for (let i = 0; i < mesh.count; i++) {
                    mesh.getColorAt(i, temp);
                    if (Math.abs(temp.r - oldColor.r) < 0.01 && Math.abs(temp.g - oldColor.g) < 0.01 && Math.abs(temp.b - oldColor.b) < 0.01) {
                        mesh.setColorAt(i, newColor);
                    }
                }
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            });
            oldCloudColors[idx] = newHexVal;
        }

        const cloudFolder = gui.addFolder('☁️ Cloud Editor');
        
        // Show All Clouds Toggle
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

        const toggleFolder = cloudFolder.addFolder('👁️ Visibility Toggles');
        toggleFolder.add(params, 'showVolumetricClouds').name('☁️ Volumetric Sky Clouds').onChange(v => {
            if (typeof toonCloudMat !== 'undefined' && toonCloudMat.uniforms && toonCloudMat.uniforms.uEnableClouds) {
                toonCloudMat.uniforms.uEnableClouds.value = v ? 1.0 : 0.0;
            }
        });
        toggleFolder.add(params, 'showCloudsRegular').name('🌥️ Regular (Cumulus)').onChange(v => { if (typeof instClouds !== 'undefined') instClouds.visible = v; });
        toggleFolder.add(params, 'showCloudsHigh').name('🌩️ Cumulonimbus').onChange(v => { if (typeof instHighClouds !== 'undefined') instHighClouds.visible = v; });
        toggleFolder.add(params, 'showCloudsWispy').name('🌫️ Wispy Clouds').onChange(v => { if (typeof instWispyClouds !== 'undefined') instWispyClouds.visible = v; });
        toggleFolder.add(params, 'showCloudsMega').name('🌌 Mega Clouds').onChange(v => { if (typeof instMegaClouds !== 'undefined') instMegaClouds.visible = v; });
        toggleFolder.add(params, 'showCloudsHorizon').name('🌅 Horizon Clouds (Massive)').onChange(v => { 
            if (typeof instHorizonClouds1 !== 'undefined') {
                instHorizonClouds1.visible = v;
                instHorizonClouds2.visible = v;
                instHorizonClouds3.visible = v;
            }
        });

        // Global density multiplier
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

        // Global scale multiplier
        cloudFolder.add(cloudParams, 'cloudScale', 0.5, 3.0, 0.1).name('Overall Size').onChange(v => {
            [instClouds, instHighClouds, instWispyClouds, instMegaClouds].forEach(mesh => {
                if (mesh) mesh.scale.set(v, v, v);
            });
        });

        // Pastel color palette subfolder
        const paletteFolder = cloudFolder.addFolder('🎨 Pastel Colors');
        paletteFolder.addColor(cloudParams, 'c0').name('Color 1').onChange(v => updateCloudColorForIndex(0, v));
        paletteFolder.addColor(cloudParams, 'c1').name('Color 2').onChange(v => updateCloudColorForIndex(1, v));
        paletteFolder.addColor(cloudParams, 'c2').name('Color 3').onChange(v => updateCloudColorForIndex(2, v));
        paletteFolder.addColor(cloudParams, 'c3').name('Color 4').onChange(v => updateCloudColorForIndex(3, v));
        paletteFolder.addColor(cloudParams, 'c4').name('Color 5').onChange(v => updateCloudColorForIndex(4, v));
        paletteFolder.close();

        // 1. Regular Clouds Subfolder
        const regFolder = cloudFolder.addFolder('🌥️ Regular (Cumulus)');
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

        // 2. Cumulonimbus Clouds Subfolder
        const highFolder = cloudFolder.addFolder('🌩️ Cumulonimbus');
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

        // 3. Wispy Clouds Subfolder
        const wispyFolder = cloudFolder.addFolder('🌫️ Wispy Clouds');
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

        // 4. Mega Clouds Subfolder
        const megaFolder = cloudFolder.addFolder('🌌 Mega Clouds');
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

        // 5. Horizon Clouds Subfolder
        const horizonFolder = cloudFolder.addFolder('🌅 Horizon Clouds');
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

        // Tree Editor
        const treeGreenVariations = [0x52c439, 0x38b000, 0x2d8028, 0x76e054, 0x6e4a32];
        let oldTreeColors = [...treeGreenVariations];
        function updateTreeColorForIndex(idx, newHex) {
            const oldHex = oldTreeColors[idx];
            const newHexVal = parseInt(newHex.replace('#',''), 16);
            if (oldHex === newHexVal) return;
            treeGreenVariations[idx] = newHexVal;
            const oldColor = new THREE.Color(oldHex);
            const newColor = new THREE.Color(newHexVal);
            const temp = new THREE.Color();
            
            treeMeshes.forEach(mesh => {
                const count = mesh.maxCount || mesh.count;
                for (let i = 0; i < count; i++) {
                    mesh.getColorAt(i, temp);
                    if (Math.abs(temp.r - oldColor.r) < 0.01 && Math.abs(temp.g - oldColor.g) < 0.01 && Math.abs(temp.b - oldColor.b) < 0.01) {
                        mesh.setColorAt(i, newColor);
                    }
                }
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            });
            oldTreeColors[idx] = newHexVal;
        }

        const treeFolder = envFolder.addFolder('Global Tree Settings');
        treeFolder.add(params, 'treeScale', 0.5, 4.0).name('Tree Scale').onChange(v => treeUniforms.uTreeScale.value = v);

        // ==========================================
        // SYSTEM SETTINGS (SAVE/LOAD)
        // ==========================================
        perfFolder.add({
            saveSettings: () => {
                const data = gui.save();
                localStorage.setItem('flightSettings', JSON.stringify(data));
                const prevTitle = perfFolder.title || 'Performance';
                perfFolder.title('Saved!');
                setTimeout(() => perfFolder.title(prevTitle), 1500);
            }
        }, 'saveSettings').name('Save All Settings');
        
        perfFolder.add({
            resetSettings: () => {
                localStorage.removeItem('flightSettings');
                localStorage.removeItem('gfxQuality');
                location.reload();
            }
        }, 'resetSettings').name('Reset to Default');

        // Load settings if they exist
        try {
            const savedData = localStorage.getItem('flightSettings');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                
                // FORCE Quality dropdown to match actual rendering quality
                parsed.quality = LOW_GFX ? 'Low' : 'Regular';
                
                // If we are in Low Quality, force shadows off and HD on (user request)
                if (LOW_GFX) {
                    parsed.shadows = false;
                    parsed.treeShadows = false;
                    parsed.renderHD = true;
                }
                
                // Ensure fog intensity is default 0.1
                if (parsed.fogIntensity !== undefined && parsed.fogIntensity > 0.1) {
                    parsed.fogIntensity = 0.1;
                }
                
                gui.load(parsed);
                
                // Immediately save back to flightSettings so that next reload reads correct values
                localStorage.setItem('flightSettings', JSON.stringify(gui.save()));
            }
        } catch(e) {
            console.error('Failed to load settings', e);
        }

        // --- Dock GUI Panel Flush to Top-Right Edge (Hidden by default, toggled via cog wheel) ---
        const guiEl = document.querySelector('.lil-gui.root') || (gui && gui.domElement);
        if (guiEl) {
            guiEl.style.position = 'fixed';
            guiEl.style.right = '14px';
            guiEl.style.top = '54px';
            guiEl.style.left = 'auto';
            guiEl.style.margin = '0';
            guiEl.style.zIndex = '1000';
            guiEl.style.maxHeight = 'calc(100vh - 72px)';
            guiEl.style.overflowY = 'auto';
            guiEl.style.display = 'none';
        }
            
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
        renderer.setAnimationLoop(animate);
    }
    start();