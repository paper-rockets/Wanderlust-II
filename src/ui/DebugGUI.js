import * as THREE from 'three';
import { ZONES } from '../world/BiomeManager.js';
import { BIOME_SKY_CONFIGS } from '../environment/BiomeSkyConfigs.js';
import { describeTier } from '../core/DeviceTier.js';
import { applyRenderBudget } from '../core/Engine.js';
import { tracks, selectMusicTrack, getCurrentTrackIndex, setAutoAdvance, setMusicMuted as setAudioMuted } from '../audio/MusicSynthesizer.js';
import { DEFAULT_PRESETS } from '../config/PresetsConfig.js';
import { globalTerrainParams, biomeHeights, biomeScales, biomeWaterHeights, getWorldWaterHeight, getBiomeAt, getIslandData } from '../world/TerrainGenerator.js';
import { showVisualToast, toggleFullscreen } from './MinimapHUD.js';
import { FLIGHT_MODELS } from '../config/FlightModelsConfig.js';
import { bloomPass, godRaysPass, uRolloffKnee } from '../core/PostProcessing.js';
import { desertColors } from '../world/biomes/terrain-desert.js';
import { northPoleColors } from '../world/biomes/terrain-northpole.js';
import { updateAllPresetDropdowns } from '../config/PresetManager.js';

export function initDebugGUI(ctx) {
    const {
        gui,
        params,
        cloudParams,
        adaptiveRes,
        uDitherAmount,
        terrain,
        dirLight,
        bloomPass,
        settingsManager,
        playerPhysics,
        cameraManager,
        timeOfDayExporter,
        stylizedTrees,
        LOW_GFX,
        presetDropdownControllers,
        envConfigs,
        setTimePhase,
        updateAtmoParamsFromPhase,
        applyPresetData,
        handlePresetFile,
        saveCustomPreset,
        loadCustomPreset,
        deleteCustomPreset,
        crystalSystem,
        rainSystem,
        animeWaterSystem,
        animeWaterGUI,
        archipelagoEditorUI,
        groundFogEditor,
        flightModelManager,
        toggleModelVisibility,
        globalWaterParam,
        skyUniforms
    } = ctx;

    let {
        isShadowsOn,
        isTreeShadowsOn,
        shadowDistMode,
        isBloomOn,
        terrainRes,
        lastTerrainGridX,
        lastDepthFieldGridX,
        lastDepthFieldGridZ
    } = ctx;
    let terrainGeo = ctx.terrainGeo;
    let isInitializingGui = true;
    let waterHeightController = null;
    let customModelFolder = null;
    let modelDropdownController = null;
    const customModelControllers = {};
    let flightFolder = null;
    let audioFolder = null;
    let flightModelDropdownController = null;
    let soundMuteController = null;
    let engineSoundController = null;
    let trackDropdownController = null;
    let isWindOn = false;
    let isRainOn = false;

    const perfFolder = gui.addFolder('Performance');
    perfFolder.add(params, 'quality', ['Regular', 'Low']).name('Quality').onChange(v => {
        const nextGfx = (v === 'Low') ? 'low' : 'regular';
        const currentGfx = localStorage.getItem('gfxQuality') || (LOW_GFX ? 'low' : 'regular');
        localStorage.setItem('gfxQuality', nextGfx);
        if (!isInitializingGui && nextGfx !== currentGfx) {
            location.reload();
        }
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
        const newGeo = new THREE.PlaneGeometry(8000, 8000, terrainRes, terrainRes);
        newGeo.rotateX(-Math.PI / 2);
        terrain.geometry.dispose();
        terrain.geometry = newGeo;
        terrainGeo = newGeo;
        lastTerrainGridX = -9999;
        lastDepthFieldGridX = -999999;
        lastDepthFieldGridZ = -999999;
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

    // Add Terrain Heights & Scales Editor Folder (001 Style)
    const terrainTuningFolder = gui.addFolder('Terrain Heights & Scales');

    terrainTuningFolder.add(globalTerrainParams, 'globalHeightMultiplier', 0.1, 5.0, 0.05).name('Global Height Scale').onChange(() => {
        lastTerrainGridX = -999999;
        lastTerrainGridZ = -999999;
        lastDepthFieldGridX = -999999;
        lastDepthFieldGridZ = -999999;
    });
    terrainTuningFolder.add(globalTerrainParams, 'globalNoiseScale', 0.1, 5.0, 0.05).name('Global Noise Scale').onChange(() => {
        lastTerrainGridX = -999999;
        lastTerrainGridZ = -999999;
        lastDepthFieldGridX = -999999;
        lastDepthFieldGridZ = -999999;
    });
    waterHeightController = terrainTuningFolder.add(globalWaterParam, 'waterHeight', -20.0, 50.0, 0.1).name('Water Height').onChange(v => {
        const playerX = (typeof playerGrp !== 'undefined' && playerGrp && playerGrp.position) ? playerGrp.position.x : 0;
        const playerZ = (typeof playerGrp !== 'undefined' && playerGrp && playerGrp.position) ? playerGrp.position.z : 0;
        const currentTarget = getWorldWaterHeight(playerX, playerZ);
        globalWaterHeightOffset = v - currentTarget;

        if (animeWaterSystem) {
            animeWaterSystem.setHeight(v);
        }
        lastTerrainGridX = -999999;
        lastTerrainGridZ = -999999;
        lastDepthFieldGridX = -999999;
        lastDepthFieldGridZ = -999999;
    });

    const heightSubFolder = terrainTuningFolder.addFolder('Height Multipliers');
    const scaleSubFolder = terrainTuningFolder.addFolder('Noise Scale Factors');
    const waterSubFolder = terrainTuningFolder.addFolder('Water Heights');

    const biomesList = ['Archipelago', 'Ghibli Land', 'Misty Mountains', 'Lush Jungle', 'Crystal Land', 'Magical Sanctuary', 'Desert Dunes', 'North Pole'];
    biomesList.forEach(bName => {
        if (biomeHeights[bName] !== undefined) {
            heightSubFolder.add(biomeHeights, bName, 0.1, 3.0, 0.05).name(bName).onChange(() => {
                lastTerrainGridX = -999999;
                lastTerrainGridZ = -999999;
                lastDepthFieldGridX = -999999;
                lastDepthFieldGridZ = -999999;
            });
        }
        if (biomeScales[bName] !== undefined) {
            scaleSubFolder.add(biomeScales, bName, 0.2, 3.0, 0.05).name(bName).onChange(() => {
                lastTerrainGridX = -999999;
                lastTerrainGridZ = -999999;
                lastDepthFieldGridX = -999999;
                lastDepthFieldGridZ = -999999;
            });
        }
        if (biomeWaterHeights[bName] !== undefined) {
            waterSubFolder.add(biomeWaterHeights, bName, -20.0, 50.0, 0.1).name(bName).onChange(() => {
                lastTerrainGridX = -999999;
                lastTerrainGridZ = -999999;
                lastDepthFieldGridX = -999999;
                lastDepthFieldGridZ = -999999;
            });
        }
    });

    // Add Editor folder (Edit Crystals, Tree Editor, Custom Models)
    const editorFolder = gui.addFolder('Editor');
    editorFolder.add({ togglePlacementEditor: () => {
        if (typeof window.toggleTerrainEditor === 'function') {
            window.toggleTerrainEditor();
        }
    }}, 'togglePlacementEditor').name('Model & Tree Placement Editor');

    editorFolder.add({ teleportToForest: () => {
        if (typeof teleportToBiome === 'function') {
            teleportToBiome('Ghibli Land');
        } else if (playerGrp) {
            playerGrp.position.set(0, 45, 18000);
        }
        if (window.stylizedTrees) window.stylizedTrees.respawn();
    }}, 'teleportToForest').name('Teleport to Forest');

    editorFolder.add({ openCrystalEditor: () => {
        const crystalEditor = document.getElementById('crystal-editor');
        if (crystalEditor) crystalEditor.style.display = crystalEditor.style.display === 'none' ? 'block' : 'none';
    }}, 'openCrystalEditor').name('Edit Crystals');
    editorFolder.add({ openArchipelagoEditor: () => {
        if (window.archipelagoEditor) window.archipelagoEditor.toggle();
    }}, 'openArchipelagoEditor').name('Archipelago Studio Editor');


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
                selectMusicTrack(getCurrentTrackIndex() + 1);
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
        setAutoAdvance(v);
    });
    trackDropdownController = audioFolder.add(audioParams, 'currentTrack', tracks.map(t => t.name))
        .name('Current Track')
        .onChange(name => {
            const idx = tracks.findIndex(t => t.name === name);
            if (idx !== -1 && idx !== getCurrentTrackIndex() && typeof selectMusicTrack === 'function') {
                selectMusicTrack(idx);
            }
        });
    audioFolder.add(audioParams, 'nextTrack').name('Next Track');
    audioFolder.add(params, 'wind').name('Wind Sound').onChange(v => {
        isWindOn = v;
    });
    audioFolder.add(audioParams, 'toggleMasterSound').name('Toggle Master Sound');
    audioFolder.add(audioParams, 'toggleEngineSound').name('Toggle Engine Sound');

    // =========================================================================
    // Dedicated Stylized Pine Trees Settings Folder
    // =========================================================================
    const stylizedTreeFolder = gui.addFolder('Stylized Trees');
    const _pines = () => window.stylizedTrees;
    const _respawnPines = () => { if (_pines()) _pines().respawn(); };

    const pineParams = {
        visible: true,
        scale: 1.0,
        density: 1.5,
        minSpacing: 18.0,
        minElevation: 1.0,
        maxElevation: 140.0,
        windSway: 1.0,
        preset: 'auto',
        leafBottom: 0x1c3b23,
        leafTop: 0x5c8338,
        leafVarColor: 0x1e4430,
        barkBase: 0x2e1b10,
        barkTop: 0x5c3a21,
        barkBrightness: 1.35,
        counts: '—'
    };

    stylizedTreeFolder.add(pineParams, 'visible').name('Tree Visible').onChange(v => {
        if (_pines()) _pines().setVisible(v);
    });
    stylizedTreeFolder.add(pineParams, 'scale', 0.2, 3.5, 0.05).name('Tree Scale').onChange(v => {
        if (_pines()) { _pines().scaleMul = v; _respawnPines(); }
    });
    stylizedTreeFolder.add(pineParams, 'density', 0.1, 5.0, 0.05).name('Tree Density').onChange(v => {
        if (_pines()) { _pines().density = v; _respawnPines(); }
    });
    stylizedTreeFolder.add(pineParams, 'minSpacing', 6.0, 60.0, 1.0).name('Min Spacing').onChange(v => {
        if (_pines()) _pines().setCellSize(v);
    });
    stylizedTreeFolder.add(pineParams, 'minElevation', 0.0, 50.0, 0.5).name('Min Elevation').onChange(v => {
        if (_pines()) { _pines().minElevation = v; _respawnPines(); }
    });
    stylizedTreeFolder.add(pineParams, 'maxElevation', 20.0, 200.0, 1.0).name('Elevation Max').onChange(v => {
        if (_pines()) { _pines().maxElevation = v; _respawnPines(); }
    });
    stylizedTreeFolder.add(pineParams, 'windSway', 0.0, 3.0, 0.05).name('Wind Sway').onChange(v => {
        if (_pines()) _pines().uWindStrength.value = v;
    });
    stylizedTreeFolder.add(pineParams, 'preset', ['auto', 'spring', 'autumn', 'winter']).name('Season Preset').onChange(v => {
        if (_pines()) _pines().setPreset(v);
    });
    stylizedTreeFolder.add({ respawn: _respawnPines }, 'respawn').name('Respawn Trees');

    const treeColorsFolder = stylizedTreeFolder.addFolder('Colors');
    treeColorsFolder.addColor(pineParams, 'leafBottom').name('Leaf Bottom (Shadow)').onChange(c => {
        if (_pines()) _pines().uLeafBottom.value.set(c);
    });
    treeColorsFolder.addColor(pineParams, 'leafTop').name('Leaf Top (Lit)').onChange(c => {
        if (_pines()) _pines().uLeafTop.value.set(c);
    });
    treeColorsFolder.addColor(pineParams, 'leafVarColor').name('Variation Tone').onChange(c => {
        if (_pines()) _pines().uLeafVarColor.value.set(c);
    });
    treeColorsFolder.addColor(pineParams, 'barkBase').name('Trunk Base').onChange(c => {
        if (_pines()) _pines().uBarkBase.value.set(c);
    });
    treeColorsFolder.addColor(pineParams, 'barkTop').name('Trunk Top').onChange(c => {
        if (_pines()) _pines().uBarkTop.value.set(c);
    });
    treeColorsFolder.add(pineParams, 'barkBrightness', 0.2, 3.0, 0.05).name('Trunk Brightness').onChange(v => {
        if (_pines()) _pines().uBarkBrightness.value = v;
    });

    const treeCountCtrl = stylizedTreeFolder.add(pineParams, 'counts').name('Instances (N/M/F)').disable();
    setInterval(() => {
        const t = _pines();
        if (!t || !treeCountCtrl) return;
        const c = t.lastCounts;
        pineParams.counts = `${c.near} / ${c.mid} / ${c.far}`;
        treeCountCtrl.updateDisplay();
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
                const biomeFog = (window.groundFogEditor && window.groundFogEditor.runtimeState) ? window.groundFogEditor.runtimeState : null;
                const baseNear = (biomeFog && biomeFog.distNear !== undefined) ? biomeFog.distNear : (params.fogNear !== undefined ? params.fogNear : 80);
                const baseFar = (biomeFog && biomeFog.distFar !== undefined) ? biomeFog.distFar : (params.fogFar !== undefined ? params.fogFar : 1800);
                const density = (biomeFog && biomeFog.distDensity !== undefined) ? biomeFog.distDensity : (params.fogDensity !== undefined ? params.fogDensity : 1.0);
                scene.fog.near = baseNear / Math.max(0.1, density);
                scene.fog.far = baseFar / Math.max(0.1, density);
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
    debugFolder.add(params, 'showBirds').name('Birds').onChange(v => {
        if (typeof instBirds !== 'undefined') instBirds.visible = v;
        if (typeof flockGrp !== 'undefined') flockGrp.visible = v;
        if (typeof window.birdFlock !== 'undefined' && window.birdFlock) window.birdFlock.visible = v;
        if (typeof window.flamingoFlock !== 'undefined' && window.flamingoFlock) window.flamingoFlock.visible = v;
    });
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
    params.flamingoScale = 0.007;
    params.animatedBirdScale = 0.08;
    params.birdColor = '#d6e5f5';
    params.birdFlockRadius = 22;
    params.birdFlockSpread = 9;
    params.birdMaxSpeed = 35;

    birdFolder.add(params, 'birdCount', 0, 120, 1).name('Bird Count').onChange(v => {
        instBirds.count = Math.min(v, MAX_BIRD_COUNT);
        instBirds.instanceMatrix.needsUpdate = true;
    });
    birdFolder.add(params, 'birdScale', 0.1, 2.0, 0.05).name('Bird Size');
    birdFolder.add(params, 'flamingoScale', 0.001, 0.03, 0.001).name('Flamingo Size').onChange(v => {
        if (typeof window.flamingoFlock !== 'undefined' && window.flamingoFlock) {
            window.flamingoFlock.setScale(v);
        }
    });
    birdFolder.add(params, 'animatedBirdScale', 0.01, 0.25, 0.01).name('Flock Bird Size').onChange(v => {
        if (typeof window.birdFlock !== 'undefined' && window.birdFlock) {
            window.birdFlock.setScale(v);
        }
    });
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
        lastDepthFieldGridX = -999999;
        lastDepthFieldGridZ = -999999;
        
        if (typeof navParams !== 'undefined' && typeof navFolder !== 'undefined') {
            navParams.biome = biomeName;
            navFolder.controllersRecursive().forEach(c => c.updateDisplay());
        }
    }

    function toggleGUI(show) {
        const guiEl = (gui && gui.domElement) || document.getElementById('main-settings-gui');
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

    // Using toggleFullscreen from MinimapHUD.js

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
    
    // Add mobile touch handling for two-finger zoom (pinch gesture)
    let gameInitialTouchDistance = null;
    let gameInitialZoom = null;
    window.addEventListener('touchstart', (e) => {
        if ((window.editorState && window.editorState.isEditorMode) || isGodMode) return;
        if (e.touches.length === 2) {
            gameInitialTouchDistance = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
            gameInitialZoom = cameraZoomDist;
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if ((window.editorState && window.editorState.isEditorMode) || isGodMode) return;
        if (e.touches.length === 2 && gameInitialTouchDistance !== null && gameInitialZoom !== null) {
            const currentTouchDistance = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
            if (gameInitialTouchDistance > 0 && currentTouchDistance > 0) {
                const factor = gameInitialTouchDistance / currentTouchDistance;
                cameraZoomDist = gameInitialZoom * factor;
                cameraZoomDist = Math.max(5.0, Math.min(300.0, cameraZoomDist));
                if (cameraManager) cameraManager.setZoom(cameraZoomDist);
                localStorage.setItem('wl_zoomDist', cameraZoomDist);
            }
        }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            gameInitialTouchDistance = null;
            gameInitialZoom = null;
        }
    }, { passive: true });
    


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
        skyFolder.add({
            clearDesertDay: () => {
                if (typeof instMegaClouds !== 'undefined') {
                    instMegaClouds.count = Math.max(1, Math.floor(params.cloudCountMega * cloudParams.density));
                    if (instMegaClouds.instanceMatrix) instMegaClouds.instanceMatrix.needsUpdate = true;
                }
                gui.controllersRecursive().forEach(c => c.updateDisplay());
            }
        }, 'clearDesertDay').name('Clear Desert Day');

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

        // Photographic Milky Way cubemap (extracted from galactic-home). Night-only:
        // its opacity is uNightFactor * opacity, and uNightFactor is exactly 0 at dusk,
        // so none of these controls can touch the locked Golden Hour Dusk look.
        if (typeof milkyWayParams !== 'undefined') {
            const mwPhoto = moonFolder.addFolder('Milky Way Photo');
            mwPhoto.add(milkyWayParams, 'brightness',  0.0, 6.0, 0.05).name('Brightness');
            mwPhoto.add(milkyWayParams, 'opacity',     0.0, 1.0, 0.05).name('Opacity');
            mwPhoto.add(milkyWayParams, 'contrast',    0.0, 4.0, 0.05).name('Contrast');
            mwPhoto.add(milkyWayParams, 'saturation',  0.0, 3.0, 0.05).name('Saturation');
            mwPhoto.add(milkyWayParams, 'hue',       -180,  180,   1 ).name('Hue Shift (deg)');
            mwPhoto.add(milkyWayParams, 'tiltX', -180, 180, 1).name('Elevation (tip up/down)').onChange(applyMilkyWayTilt);
            mwPhoto.add(milkyWayParams, 'tiltY', -180, 180, 1).name('Azimuth (spin L/R)').onChange(applyMilkyWayTilt);
            mwPhoto.add(milkyWayParams, 'tiltZ', -180, 180, 1).name('Roll').onChange(applyMilkyWayTilt);
        }
        if (typeof auroraParams !== 'undefined') {
            const auroraFolder = moonFolder.addFolder('Aurora Borealis');
            auroraFolder.add(auroraParams, 'opacity', 0.0, 1.0, 0.05).name('Opacity');
            auroraFolder.add(auroraParams, 'intensity', 0.0, 3.0, 0.1).name('Intensity');
            auroraFolder.add(auroraParams, 'speed', 0.1, 4.0, 0.1).name('Speed');
            auroraFolder.add(auroraParams, 'altitude', -2000, 8000, 100).name('Altitude');
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
        
        // Dedicated Distance Fog (Horizon & Range) Subfolder
        const distFogFolder = weatherFolder.addFolder('Distance Fog (Horizon & Range)');
        distFogFolder.add(params, 'sceneFog').name('Global Fog').listen().onChange(v => {
            if (typeof setAllFogEnabled === 'function') {
                setAllFogEnabled(v);
            }
        });
        distFogFolder.add(params, 'fogNear', 0, 1000, 10).name('Start Dist (Clear Area)').listen().onChange(v => {
            if (window.groundFogEditor && window.groundFogEditor.runtimeState) {
                window.groundFogEditor.runtimeState.distNear = v;
                const curCfg = window.groundFogEditor.getCurrentConfig();
                if (curCfg) { curCfg.distNear = v; window.groundFogEditor.saveConfigsToStorage(); }
            }
        });
        distFogFolder.add(params, 'fogFar', 300, 8000, 50).name('End Dist (Max Density)').listen().onChange(v => {
            if (window.groundFogEditor && window.groundFogEditor.runtimeState) {
                window.groundFogEditor.runtimeState.distFar = v;
                const curCfg = window.groundFogEditor.getCurrentConfig();
                if (curCfg) { curCfg.distFar = v; window.groundFogEditor.saveConfigsToStorage(); }
            }
        });
        distFogFolder.add(params, 'fogDensity', 0.10, 4.00, 0.05).name('Density Multiplier').listen().onChange(v => {
            if (window.groundFogEditor && window.groundFogEditor.runtimeState) {
                window.groundFogEditor.runtimeState.distDensity = v;
                const curCfg = window.groundFogEditor.getCurrentConfig();
                if (curCfg) { curCfg.distDensity = v; window.groundFogEditor.saveConfigsToStorage(); }
            }
        });
        distFogFolder.add(params, 'fogAltitudeScale', 0.0, 4.0, 0.1).name('Altitude Scale').listen().onChange(v => {
            if (window.groundFogEditor && window.groundFogEditor.runtimeState) {
                window.groundFogEditor.runtimeState.distAltScale = v;
                const curCfg = window.groundFogEditor.getCurrentConfig();
                if (curCfg) { curCfg.distAltScale = v; window.groundFogEditor.saveConfigsToStorage(); }
            }
        });
        distFogFolder.add(params, 'fogAutoAltitude').name('Altitude Auto-Expand').listen();

        const applyDistanceFogPreset = (near, far, density, altScale) => {
            params.fogNear = near;
            params.fogFar = far;
            params.fogDensity = density;
            params.fogAltitudeScale = altScale;
            if (window.groundFogEditor) {
                const curCfg = window.groundFogEditor.getCurrentConfig();
                if (curCfg) {
                    curCfg.distNear = near;
                    curCfg.distFar = far;
                    curCfg.distDensity = density;
                    curCfg.distAltScale = altScale;
                    window.groundFogEditor.saveConfigsToStorage();
                    window.groundFogEditor.syncUI();
                    window.groundFogEditor.applyToScene(true);
                }
            }
            distFogFolder.controllersRecursive().forEach(c => c.updateDisplay());
        };

        const fogPresetsFolder = distFogFolder.addFolder('Distance Fog Presets');
        fogPresetsFolder.add({ p: () => applyDistanceFogPreset(80, 1800, 1.0, 1.2) }, 'p').name('Balanced (Default)');
        fogPresetsFolder.add({ p: () => applyDistanceFogPreset(200, 3500, 0.6, 2.5) }, 'p').name('Vast Horizon');
        fogPresetsFolder.add({ p: () => applyDistanceFogPreset(35, 1100, 1.7, 0.8) }, 'p').name('Dense Mountain Mist');
        fogPresetsFolder.add({ p: () => applyDistanceFogPreset(50, 1300, 1.4, 0.9) }, 'p').name('Deep Atmosphere');
        fogPresetsFolder.add({ p: () => applyDistanceFogPreset(20, 800, 2.0, 0.5) }, 'p').name('Close Dramatic Fog');
        fogPresetsFolder.close();

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
            lastDepthFieldGridX = -999999;
            lastDepthFieldGridZ = -999999;
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

        // 10. Environment Presets Subfolder
        const presetFolder = envFolder.addFolder('Environment Presets');
        presetFolder.add({
            clearDesertDay: () => {
                teleportToBiome('Desert Dunes');
                params.fogPlane = false;
                if (typeof window.fogGroup !== 'undefined') window.fogGroup.visible = false;
                params.timeOfDay = 'day';
                if (typeof window.setTimePhase === 'function') window.setTimePhase(0);
                else timePhase = 0;
                if (typeof cloudParams !== 'undefined') {
                    cloudParams.density = 0.1;
                    params.showVolumetricClouds = false;
                    if (typeof toonCloudMat !== 'undefined' && toonCloudMat.uniforms && toonCloudMat.uniforms.uEnableClouds) {
                        toonCloudMat.uniforms.uEnableClouds.value = 0.0;
                    }
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
            }
        }, 'clearDesertDay').name('Clear Desert Day');

        // Lazy Loaded Time of Day JSON Exporter & Manager
        let _todExporterInstance = null;
        async function getTODExporter() {
            if (!_todExporterInstance) {
                const { TimeOfDayExporter } = await import('../tools/TimeOfDayExporter.js');
                _todExporterInstance = new TimeOfDayExporter(() => ({
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
                    showToast: typeof showVisualToast !== 'undefined' ? showVisualToast : console.log,
                    setTimePhase: typeof setTimePhase === 'function' ? setTimePhase : (typeof window.setTimePhase === 'function' ? window.setTimePhase : null),
                    refreshGUI: () => {
                        if (typeof updateAtmoParamsFromPhase === 'function') updateAtmoParamsFromPhase();
                        if (gui) gui.controllersRecursive().forEach(c => c.updateDisplay());
                    }
                }));
                window.timeOfDayExporter = _todExporterInstance;
            }
            return _todExporterInstance;
        }

        // 11. Time of Day JSON Export Subfolder (Environment Subfolder)
        const todExportFolder = envFolder.addFolder('Time of Day JSON Export');
        todExportFolder.add({
            exportActive: async () => (await getTODExporter()).exportActivePhase(false)
        }, 'exportActive').name('Export Active Time of Day (Copy JSON)');
        todExportFolder.add({
            exportDay: async () => (await getTODExporter()).exportPhase(0, false)
        }, 'exportDay').name('Export Day Settings (Copy JSON)');
        todExportFolder.add({
            exportDusk: async () => (await getTODExporter()).exportPhase(1, false)
        }, 'exportDusk').name('Export Dusk Settings (Copy JSON)');
        todExportFolder.add({
            exportNight: async () => (await getTODExporter()).exportPhase(2, false)
        }, 'exportNight').name('Export Night Settings (Copy JSON)');
        todExportFolder.add({
            exportAll: async () => (await getTODExporter()).exportAllPhases(false)
        }, 'exportAll').name('Export All 3 Times of Day (Copy JSON)');
        todExportFolder.add({
            downloadActive: async () => (await getTODExporter()).exportActivePhase(true)
        }, 'downloadActive').name('Download Active Time of Day (.json)');
        todExportFolder.add({
            downloadDay: async () => (await getTODExporter()).exportPhase(0, true)
        }, 'downloadDay').name('Download Day Settings (.json)');
        todExportFolder.add({
            downloadDusk: async () => (await getTODExporter()).exportPhase(1, true)
        }, 'downloadDusk').name('Download Dusk Settings (.json)');
        todExportFolder.add({
            downloadNight: async () => (await getTODExporter()).exportPhase(2, true)
        }, 'downloadNight').name('Download Night Settings (.json)');
        todExportFolder.add({
            downloadAll: async () => (await getTODExporter()).exportAllPhases(true)
        }, 'downloadAll').name('Download All environment_settings.json');
        todExportFolder.add({
            importJSON: async () => {
                const input = prompt('Paste Time of Day JSON (Day / Dusk / Night / All):');
                if (input) (await getTODExporter()).importSettings(input);
            }
        }, 'importJSON').name('Import Time of Day (Paste JSON)');

        // 12. Presets & Profiles Folder (Root Level & Environment Subfolder)
        let presetsFolder = gui.addFolder('Presets & Profiles');
        presetsFolder.add(settingsManager, 'presetName').name('New Preset Name');
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
            loadSelected: () => settingsManager.loadSetting()
        }, 'loadSelected').name('Load Selected Preset');

        presetsFolder.add({
            loadSaveFile: () => settingsManager.loadFromFile()
        }, 'loadSaveFile').name('Load Save File from Disk (.json)');
        
        presetsFolder.add({
            deleteSelected: () => settingsManager.deleteSetting()
        }, 'deleteSelected').name('Delete Selected Preset');
        
        presetsFolder.add({
            resetToDusk: () => settingsManager.reset()
        }, 'resetToDusk').name('Reset to Default Golden Dusk');

        presetsFolder.add({
            exportJSON: () => settingsManager.exportPresets()
        }, 'exportJSON').name('Export Presets (Copy JSON)');

        presetsFolder.add({
            importJSON: () => settingsManager.importPresets()
        }, 'importJSON').name('Import Presets (Paste JSON)');

        presetsFolder.add({
            exportActiveTOD: async () => (await getTODExporter()).exportActivePhase(false)
        }, 'exportActiveTOD').name('Export Active Time of Day (Copy JSON)');

        presetsFolder.add({
            exportDayTOD: async () => (await getTODExporter()).exportPhase(0, false)
        }, 'exportDayTOD').name('Export Day Settings (Copy JSON)');

        presetsFolder.add({
            exportDuskTOD: async () => (await getTODExporter()).exportPhase(1, false)
        }, 'exportDuskTOD').name('Export Dusk Settings (Copy JSON)');

        presetsFolder.add({
            exportNightTOD: async () => (await getTODExporter()).exportPhase(2, false)
        }, 'exportNightTOD').name('Export Night Settings (Copy JSON)');

        presetsFolder.add({
            exportAllTOD: async () => (await getTODExporter()).exportAllPhases(false)
        }, 'exportAllTOD').name('Export All Times of Day (Copy JSON)');

        presetsFolder.add({
            importTOD: async () => {
                const input = prompt('Paste Time of Day JSON:');
                if (input) (await getTODExporter()).importSettings(input);
            }
        }, 'importTOD').name('Import Time of Day (Paste JSON)');

        updateAllPresetDropdowns('Golden Hour Dusk (Default)');

        // 13. Per-Biome Saves Folder
        const biomeSavesFolder = gui.addFolder('Per-Biome Saves');
        const getActiveBiomeName = () => {
            if (typeof playerGrp !== 'undefined' && playerGrp.position) {
                const b = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
                return b ? b.name : 'Unknown Biome';
            }
            return 'Unknown Biome';
        };

        biomeSavesFolder.add({
            saveActive: () => {
                const bName = getActiveBiomeName();
                if (bName && bName !== 'Unknown Biome') {
                    window.saveBiomeSettings(bName);
                } else {
                    showVisualToast('Cannot save: unknown biome');
                }
            }
        }, 'saveActive').name('Save Current Biome');

        biomeSavesFolder.add({
            resetActive: () => {
                const bName = getActiveBiomeName();
                if (bName && bName !== 'Unknown Biome') {
                    window.resetBiomeSettings(bName);
                } else {
                    showVisualToast('Cannot reset: unknown biome');
                }
            }
        }, 'resetActive').name('Reset Current Biome');

        biomeSavesFolder.add({
            saveAll: () => {
                localStorage.setItem('wanderlust_biome_fog_settings', JSON.stringify(window.biomeFogSettings || {}));
                localStorage.setItem('wanderlust_biome_sky_configs', JSON.stringify(BIOME_SKY_CONFIGS));
                showVisualToast('Saved all biome settings');
            }
        }, 'saveAll').name('Save All Biomes');

        biomeSavesFolder.add({
            resetAll: () => {
                if (confirm('Are you sure you want to reset all biome settings to default?')) {
                    localStorage.removeItem('wanderlust_biome_fog_settings');
                    localStorage.removeItem('wanderlust_biome_sky_configs');
                    window.biomeFogSettings = {};
                    for (let key in window.ORIGINAL_BIOME_SKY_CONFIGS) {
                        if (BIOME_SKY_CONFIGS[key]) {
                            Object.assign(BIOME_SKY_CONFIGS[key], window.ORIGINAL_BIOME_SKY_CONFIGS[key]);
                        }
                        const cleanK = key.replace(/[^\w\s]/gi, '').trim();
                        if (BIOME_SKY_CONFIGS[cleanK]) {
                            Object.assign(BIOME_SKY_CONFIGS[cleanK], window.ORIGINAL_BIOME_SKY_CONFIGS[key]);
                        }
                    }
                    showVisualToast('Reset all biomes to defaults');
                }
            }
        }, 'resetAll').name('Reset All Biomes');

        // Reorder folders: most-used first
        const folderOrder = [
            flightFolder, editorFolder, audioFolder, debugFolder, navFolder, perfFolder, envFolder, presetsFolder, biomeSavesFolder
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

        if (typeof loadAllSettings === 'function') {
            loadAllSettings();
        }
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

}
