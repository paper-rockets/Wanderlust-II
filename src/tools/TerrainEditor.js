import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getWorldHeight } from '../world/TerrainGenerator.js';

const EDITOR_SERVER = 'http://localhost:9100';

export function initTerrainEditor(scene, camera, renderer, terrainMesh) {
    const gltfLoader = new GLTFLoader();
    const placedModels = [];
    const modelTemplates = {};
    let activeModelScene = null;
    let activeModelUrl = null;
    let activeModelFilename = null;
    let currentSnapping = false;
    let isEditorVisible = false;
    let orbitControls = null;
    let savedCameraState = null;
    let wasFlightPaused = false;

    function enterEditorMode() {
        const es = window.editorState;
        if (!es) return;

        wasFlightPaused = es.isFlightPaused();

        // Save camera state before switching
        savedCameraState = {
            localPosition: camera.position.clone(),
            localRotation: camera.rotation.clone(),
            pivotRotation: es.cameraPivot.rotation.clone(),
            fov: camera.fov
        };

        // Pause flight
        es.pauseFlight();
        es.isEditorMode = true;

        // Get world position/rotation before detaching
        const worldPos = new THREE.Vector3();
        camera.getWorldPosition(worldPos);
        const worldQuat = new THREE.Quaternion();
        camera.getWorldQuaternion(worldQuat);

        // Detach camera from player rig so OrbitControls can move it freely
        es.cameraPivot.remove(camera);
        scene.add(camera);
        camera.position.copy(worldPos);
        camera.quaternion.copy(worldQuat);

        // Create OrbitControls targeting the player position
        if (!orbitControls) {
            orbitControls = new OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            orbitControls.dampingFactor = 0.08;
            orbitControls.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: THREE.MOUSE.PAN
            };
            orbitControls.minDistance = 1;
            orbitControls.maxDistance = 500;
        }

        const playerPos = es.playerGrp.position.clone();
        orbitControls.target.copy(playerPos);
        orbitControls.enabled = true;
        es.editorControls = orbitControls;

        // Disable transform controls orbit conflict
        transformControl.addEventListener('dragging-changed', syncOrbitEnabled);
    }

    function exitEditorMode() {
        const es = window.editorState;
        if (!es) return;

        es.isEditorMode = false;

        if (orbitControls) {
            orbitControls.enabled = false;
            es.editorControls = null;
        }

        // Re-attach camera to cameraPivot (original rig)
        if (savedCameraState) {
            scene.remove(camera);
            es.cameraPivot.add(camera);
            camera.position.copy(savedCameraState.localPosition);
            camera.rotation.copy(savedCameraState.localRotation);
            es.cameraPivot.rotation.copy(savedCameraState.pivotRotation);
            camera.fov = savedCameraState.fov;
            camera.up.set(0, 1, 0);
            camera.updateProjectionMatrix();
            savedCameraState = null;
        }

        // Restore player visibility
        if (playerHidden) {
            es.playerGrp.visible = true;
            playerHidden = false;
            btnHidePlayer.innerText = 'Hide Player';
        }

        // Resume flight only if it wasn't paused before
        if (!wasFlightPaused) {
            es.resumeFlight();
        }

        transformControl.removeEventListener('dragging-changed', syncOrbitEnabled);
        transformControl.detach();
        updateContextUI();
    }

    function syncOrbitEnabled(event) {
        if (orbitControls) orbitControls.enabled = !event.value;
    }

    // --- Transform Controls ---
    const transformControl = new TransformControls(camera, renderer.domElement);
    transformControl.setSpace('local');
    scene.add(transformControl.getHelper());

    transformControl.addEventListener('dragging-changed', function (event) {
        if (window.editorState) {
            window.editorState.isDragging = event.value;
        }
    });

    // --- Status Toast ---
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:8px 20px;border-radius:8px;font-size:13px;z-index:9999;opacity:0;transition:opacity 0.3s;pointer-events:none;font-family:sans-serif;';
    document.body.appendChild(toast);
    let toastTimer;
    function showToast(msg) {
        toast.textContent = msg;
        toast.style.opacity = '1';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.style.opacity = '0', 2500);
    }

    // --- UI Setup ---
    const uiContainer = document.createElement('div');
    uiContainer.id = 'terrain-editor-ui';
    Object.assign(uiContainer.style, {
        position: 'fixed', top: '70px', left: '20px',
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
        padding: '15px', borderRadius: '10px', color: 'white',
        fontFamily: 'sans-serif', zIndex: '1000', display: 'none',
        flexDirection: 'column', gap: '8px', width: '260px',
        maxHeight: '80vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.2)'
    });
    // Stop all mouse and touch events from bubbling through to the 3D scene/canvas
    ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'click', 'dblclick', 'wheel', 'touchstart', 'touchend'].forEach(evt => {
        uiContainer.addEventListener(evt, (e) => e.stopPropagation());
    });
    document.body.appendChild(uiContainer);

    const btnStyle = 'padding:6px 10px;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;color:white;';
    const btnBg = 'background:rgba(255,255,255,0.15);';
    const btnGreen = 'background:#0a6640;';
    const btnRed = 'background:#aa3333;';

    function makeBtn(text, style = '') {
        const b = document.createElement('button');
        b.innerText = text;
        b.style.cssText = btnStyle + btnBg + style;
        return b;
    }

    // Title
    const titleEl = document.createElement('h3');
    titleEl.innerText = 'Model Placement Editor';
    titleEl.style.cssText = 'margin:0 0 5px 0;font-size:15px;color:#e94560;';
    uiContainer.appendChild(titleEl);

    let isTopDownView = false;
    let topDownAltitude = 140;
    let randomRotationOnPlace = true;
    let randomScaleOnPlace = false;

    // Active Model Status / Mode Toggle
    const activeModelStatus = document.createElement('div');
    activeModelStatus.style.cssText = 'font-size:11px;color:#94a3b8;margin-bottom:4px;background:rgba(255,255,255,0.06);padding:6px 8px;border-radius:4px;display:flex;justify-content:space-between;align-items:center;';
    activeModelStatus.innerHTML = '<span>Mode: <b style="color:#a3e635;">Select / Inspect</b></span>';
    
    const btnClearActive = document.createElement('button');
    btnClearActive.innerText = 'Deselect';
    btnClearActive.style.cssText = 'font-size:10px;padding:2px 6px;background:rgba(255,255,255,0.15);border:none;border-radius:4px;color:#fff;cursor:pointer;display:none;';
    btnClearActive.addEventListener('click', () => {
        activeModelScene = null;
        activeModelFilename = null;
        updateActiveModelStatus();
        showToast('Select Mode: Click existing models to transform');
    });
    activeModelStatus.appendChild(btnClearActive);
    uiContainer.appendChild(activeModelStatus);

    function updateActiveModelStatus() {
        if (activeModelFilename) {
            activeModelStatus.firstElementChild.innerHTML = `Placing: <b style="color:#38bdf8;">${activeModelFilename.replace(/\.(glb|gltf)$/i, '')}</b>`;
            btnClearActive.style.display = 'inline-block';
        } else {
            activeModelStatus.firstElementChild.innerHTML = `Mode: <b style="color:#a3e635;">Select / Inspect</b>`;
            btnClearActive.style.display = 'none';
        }
    }

    // --- Camera View Section (Top-Down vs Perspective) ---
    const viewSection = document.createElement('div');
    viewSection.style.cssText = 'border-bottom:1px solid #444;padding-bottom:8px;';
    viewSection.innerHTML = '<div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px;">Camera View Mode</div>';
    uiContainer.appendChild(viewSection);

    const viewBtnRow = document.createElement('div');
    viewBtnRow.style.cssText = 'display:flex;gap:4px;margin-bottom:6px;';
    viewSection.appendChild(viewBtnRow);

    const btnPerspectiveView = makeBtn('Orbit 3D (P)');
    btnPerspectiveView.style.flex = '1';
    btnPerspectiveView.style.background = 'rgba(14, 165, 233, 0.4)';
    btnPerspectiveView.style.border = '1px solid #38bdf8';

    const btnTopView = makeBtn('Sky Top (T)');
    btnTopView.style.flex = '1';

    viewBtnRow.appendChild(btnPerspectiveView);
    viewBtnRow.appendChild(btnTopView);

    // Altitude controls for Top View
    const altRow = document.createElement('div');
    altRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:11px;color:#94a3b8;';
    const altLabel = document.createElement('span');
    altLabel.innerText = 'Alt: 140m';
    altLabel.style.minWidth = '55px';
    const altSlider = document.createElement('input');
    altSlider.type = 'range';
    altSlider.min = '30';
    altSlider.max = '500';
    altSlider.step = '10';
    altSlider.value = '140';
    altSlider.style.cssText = 'flex:1;cursor:pointer;';
    altRow.appendChild(altLabel);
    altRow.appendChild(altSlider);
    viewSection.appendChild(altRow);

    // Preset Altitudes
    const altPresetRow = document.createElement('div');
    altPresetRow.style.cssText = 'display:flex;gap:4px;margin-top:4px;';
    const btnAltLow = makeBtn('60m', 'font-size:10px;padding:2px 6px;flex:1;');
    const btnAltMed = makeBtn('140m', 'font-size:10px;padding:2px 6px;flex:1;');
    const btnAltHigh = makeBtn('300m', 'font-size:10px;padding:2px 6px;flex:1;');
    altPresetRow.appendChild(btnAltLow);
    altPresetRow.appendChild(btnAltMed);
    altPresetRow.appendChild(btnAltHigh);
    viewSection.appendChild(altPresetRow);

    // Placement Natural Variation Toggles
    const variationRow = document.createElement('div');
    variationRow.style.cssText = 'display:flex;gap:4px;margin-top:6px;';
    const btnRandYaw = makeBtn('Random Yaw: ON', 'font-size:10px;padding:3px 6px;flex:1;background:rgba(16,185,129,0.25);border:1px solid #10b981;');
    const btnRandScale = makeBtn('Random Scale: OFF', 'font-size:10px;padding:3px 6px;flex:1;background:rgba(255,255,255,0.08);');
    variationRow.appendChild(btnRandYaw);
    variationRow.appendChild(btnRandScale);
    viewSection.appendChild(variationRow);

    function setTopDownView(enabled, customAlt) {
        isTopDownView = enabled;
        if (customAlt !== undefined) {
            topDownAltitude = customAlt;
            altSlider.value = customAlt;
            altLabel.innerText = 'Alt: ' + Math.round(customAlt) + 'm';
        }
        
        if (!orbitControls) return;

        if (isTopDownView) {
            const tx = orbitControls.target.x;
            const tz = orbitControls.target.z;
            const targetGroundY = getWorldHeight(tx, tz);
            const targetY = Math.max(targetGroundY, 2.4);

            orbitControls.target.set(tx, targetY, tz);
            camera.up.set(0, 0, -1);
            camera.position.set(tx, targetY + topDownAltitude, tz + 0.001);
            camera.lookAt(tx, targetY, tz);

            orbitControls.screenSpacePanning = true;
            orbitControls.minPolarAngle = 0.0001;
            orbitControls.maxPolarAngle = 0.001;
            orbitControls.update();

            btnTopView.style.background = 'rgba(14, 165, 233, 0.4)';
            btnTopView.style.border = '1px solid #38bdf8';
            btnPerspectiveView.style.background = 'rgba(255, 255, 255, 0.15)';
            btnPerspectiveView.style.border = 'none';
            showToast(`Sky Top View (${Math.round(topDownAltitude)}m): Click terrain to place`);
        } else {
            const tx = orbitControls.target.x;
            const tz = orbitControls.target.z;
            const targetGroundY = getWorldHeight(tx, tz);
            const targetY = Math.max(targetGroundY, 2.4);

            camera.up.set(0, 1, 0);
            camera.position.set(tx + 40, targetY + 30, tz + 40);
            camera.lookAt(tx, targetY, tz);

            orbitControls.minPolarAngle = 0.05;
            orbitControls.maxPolarAngle = Math.PI / 2.05;
            orbitControls.update();

            btnTopView.style.background = 'rgba(255, 255, 255, 0.15)';
            btnTopView.style.border = 'none';
            btnPerspectiveView.style.background = 'rgba(14, 165, 233, 0.4)';
            btnPerspectiveView.style.border = '1px solid #38bdf8';
            showToast('Perspective 3D Orbit View');
        }
    }

    btnPerspectiveView.addEventListener('click', () => setTopDownView(false));
    btnTopView.addEventListener('click', () => setTopDownView(true));

    altSlider.addEventListener('input', (e) => {
        topDownAltitude = parseFloat(e.target.value);
        altLabel.innerText = 'Alt: ' + Math.round(topDownAltitude) + 'm';
        if (isTopDownView && orbitControls) {
            camera.position.y = orbitControls.target.y + topDownAltitude;
        }
    });

    btnAltLow.addEventListener('click', () => {
        setTopDownView(true, 60);
    });

    btnAltMed.addEventListener('click', () => {
        setTopDownView(true, 140);
    });

    btnAltHigh.addEventListener('click', () => {
        setTopDownView(true, 300);
    });

    btnRandYaw.addEventListener('click', () => {
        randomRotationOnPlace = !randomRotationOnPlace;
        btnRandYaw.innerText = randomRotationOnPlace ? 'Random Yaw: ON' : 'Random Yaw: OFF';
        btnRandYaw.style.background = randomRotationOnPlace ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)';
        btnRandYaw.style.border = randomRotationOnPlace ? '1px solid #10b981' : 'none';
    });

    btnRandScale.addEventListener('click', () => {
        randomScaleOnPlace = !randomScaleOnPlace;
        btnRandScale.innerText = randomScaleOnPlace ? 'Random Scale: ON' : 'Random Scale: OFF';
        btnRandScale.style.background = randomScaleOnPlace ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)';
        btnRandScale.style.border = randomScaleOnPlace ? '1px solid #10b981' : 'none';
    });

    // --- Import Section ---
    const importSection = document.createElement('div');
    importSection.style.cssText = 'border-bottom:1px solid #444;padding-bottom:8px;';
    importSection.innerHTML = '<div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px;">Import Model</div>';
    uiContainer.appendChild(importSection);

    const uploadLabel = document.createElement('label');
    uploadLabel.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;';
    uploadLabel.innerText = 'Drop GLB or: ';
    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.accept = '.glb,.gltf';
    uploadInput.style.cssText = 'font-size:11px;width:130px;';
    uploadLabel.appendChild(uploadInput);
    importSection.appendChild(uploadLabel);

    // --- Stylized Trees Library ---
    const stylizedTreesSection = document.createElement('div');
    stylizedTreesSection.style.cssText = 'border-bottom:1px solid #444;padding-bottom:8px;';
    stylizedTreesSection.innerHTML = '<div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px;">Stylized Trees</div>';
    uiContainer.appendChild(stylizedTreesSection);

    const stylizedTreeList = document.createElement('div');
    stylizedTreeList.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;max-height:130px;overflow-y:auto;';
    stylizedTreesSection.appendChild(stylizedTreeList);

    const STYLIZED_TREE_MODELS = [
        { name: 'Pine 01 (Med 6m)', file: 'pine_tree_01.glb' },
        { name: 'Pine 02 (Full 6m)', file: 'pine_tree_02.glb' },
        { name: 'Pine 03 (Dense 6m)', file: 'pine_tree_03.glb' },
        { name: 'Pine 04 (Stylized 6m)', file: 'pine_tree_04.glb' },
        { name: 'Pine 05 (Tall 9m)', file: 'pine_tree_05.glb' },
        { name: 'Pine 06 (Ancient 11m)', file: 'pine_tree_06.glb' },
        { name: 'Pine 07 (Small 3m)', file: 'pine_tree_07.glb' },
        { name: 'Grove Cluster', file: 'pine_forest_cluster.glb' }
    ];

    STYLIZED_TREE_MODELS.forEach(t => {
        const btn = document.createElement('button');
        btn.innerText = t.name;
        btn.title = t.file;
        btn.style.cssText = btnStyle + btnBg + 'font-size:11px;padding:4px 8px;background:rgba(46,125,50,0.35);border:1px solid #2e7d32;';
        btn.addEventListener('click', () => selectLibraryModel(t.file));
        stylizedTreeList.appendChild(btn);
    });

    // --- Model Library ---
    const libSection = document.createElement('div');
    libSection.style.cssText = 'border-bottom:1px solid #444;padding-bottom:8px;';
    libSection.innerHTML = '<div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px;">Custom Model Library</div>';
    uiContainer.appendChild(libSection);

    const libList = document.createElement('div');
    libList.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;max-height:120px;overflow-y:auto;';
    libSection.appendChild(libList);

    async function refreshModelLibrary() {
        try {
            const resp = await fetch(EDITOR_SERVER + '/api/list-models', { method: 'POST', body: '{}' });
            const data = await resp.json();
            libList.innerHTML = '';
            data.models.forEach(filename => {
                const btn = document.createElement('button');
                btn.innerText = filename.replace(/\.(glb|gltf)$/i, '');
                btn.title = filename;
                btn.style.cssText = btnStyle + btnBg + 'font-size:11px;padding:4px 8px;';
                btn.addEventListener('click', () => selectLibraryModel(filename));
                libList.appendChild(btn);
            });
            if (data.models.length === 0) {
                libList.innerHTML = '<span style="font-size:11px;color:#666;">No saved models yet</span>';
            }
        } catch (e) {
            libList.innerHTML = '<span style="font-size:11px;color:#888;">Local server optional</span>';
        }
    }

    async function selectLibraryModel(filename) {
        if (modelTemplates[filename]) {
            activeModelScene = modelTemplates[filename];
            activeModelFilename = filename;
            updateActiveModelStatus();
            showToast(`Selected: ${filename} (Click terrain to place)`);
            return;
        }
        try {
            const model = await loadModelFromServer(filename);
            modelTemplates[filename] = model;
            activeModelScene = model;
            activeModelFilename = filename;
            updateActiveModelStatus();
            showToast(`Loaded: ${filename} (Click terrain to place)`);
        } catch (e) {
            showToast(`Failed to load ${filename}`);
        }
    }

    function loadModelFromServer(filename) {
        return new Promise((resolve, reject) => {
            const isTree = filename.startsWith('pine_');
            const primaryUrl = isTree ? ('assets/models/trees/' + filename) : (EDITOR_SERVER + '/models/' + filename);
            gltfLoader.load(primaryUrl, (gltf) => {
                resolve(gltf.scene);
            }, undefined, (err) => {
                gltfLoader.load('assets/models/trees/' + filename, (gltf2) => {
                    resolve(gltf2.scene);
                }, undefined, reject);
            });
        });
    }

    // --- Save/Load/Git Section ---
    const saveSection = document.createElement('div');
    saveSection.style.cssText = 'border-bottom:1px solid #444;padding-bottom:8px;display:flex;flex-wrap:wrap;gap:4px;';
    saveSection.innerHTML = '<div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px;width:100%;">Scene</div>';
    uiContainer.appendChild(saveSection);

    const btnSave = makeBtn('Save', btnGreen);
    const btnLoad = makeBtn('Load');
    const btnGitPush = makeBtn('Git Push', btnGreen);
    const btnExportJSON = makeBtn('Export JSON');
    saveSection.appendChild(btnSave);
    saveSection.appendChild(btnLoad);
    saveSection.appendChild(btnGitPush);
    saveSection.appendChild(btnExportJSON);

    // --- Toggles Section ---
    const toggleSection = document.createElement('div');
    toggleSection.style.cssText = 'border-bottom:1px solid #444;padding-bottom:8px;display:flex;gap:4px;';
    uiContainer.appendChild(toggleSection);

    const btnSpace = makeBtn('Local');
    const btnSnap = makeBtn('Snap: OFF');
    const btnHidePlayer = makeBtn('Hide Player');
    toggleSection.appendChild(btnSpace);
    toggleSection.appendChild(btnSnap);
    toggleSection.appendChild(btnHidePlayer);

    let playerHidden = false;
    btnHidePlayer.addEventListener('click', () => {
        const es = window.editorState;
        if (!es || !es.playerGrp) return;
        playerHidden = !playerHidden;
        es.playerGrp.visible = !playerHidden;
        btnHidePlayer.innerText = playerHidden ? 'Show Player' : 'Hide Player';
    });

    // --- Atmosphere Section ---
    const atmoSection = document.createElement('div');
    atmoSection.style.cssText = 'border-bottom:1px solid #444;padding-bottom:8px;';
    atmoSection.innerHTML = '<div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px;">Atmosphere Presets</div>';
    uiContainer.appendChild(atmoSection);

    const atmoBtnRow = document.createElement('div');
    atmoBtnRow.style.cssText = 'display:flex;gap:4px;';
    atmoSection.appendChild(atmoBtnRow);

    const btnPresetSunset = makeBtn('Sunset');
    const btnPresetDay = makeBtn('Day');
    const btnPresetNight = makeBtn('Night');
    atmoBtnRow.appendChild(btnPresetSunset);
    atmoBtnRow.appendChild(btnPresetDay);
    atmoBtnRow.appendChild(btnPresetNight);

    btnPresetSunset.addEventListener('click', () => {
        const timeBtn = document.getElementById('time-toggle');
        if (timeBtn) {
            timeBtn.click();
        }
        showToast('Atmosphere Preset: Sunset');
    });

    btnPresetDay.addEventListener('click', () => {
        const timeBtn = document.getElementById('time-toggle');
        if (timeBtn) {
            timeBtn.click();
            timeBtn.click();
        }
        showToast('Atmosphere Preset: Day');
    });

    btnPresetNight.addEventListener('click', () => {
        const timeBtn = document.getElementById('time-toggle');
        if (timeBtn) {
            timeBtn.click();
        }
        showToast('Atmosphere Preset: Night');
    });

    // --- Objects List ---
    const objSection = document.createElement('div');
    objSection.style.cssText = 'border-bottom:1px solid #444;padding-bottom:8px;';
    objSection.innerHTML = '<div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px;">Placed Objects</div>';
    uiContainer.appendChild(objSection);

    const objList = document.createElement('div');
    objList.style.cssText = 'max-height:150px;overflow-y:auto;';
    objSection.appendChild(objList);

    function refreshObjectList() {
        objList.innerHTML = '';
        if (placedModels.length === 0) {
            objList.innerHTML = '<span style="font-size:11px;color:#666;">None placed yet</span>';
            return;
        }
        placedModels.forEach((model, i) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:3px 4px;border-radius:4px;cursor:pointer;font-size:12px;' +
                (transformControl.object === model ? 'background:rgba(233,69,96,0.4);' : '');
            const name = document.createElement('span');
            name.innerText = (model.userData.filename || 'object').replace(/\.(glb|gltf)$/i, '');
            name.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';
            const del = document.createElement('span');
            del.innerText = '×';
            del.style.cssText = 'cursor:pointer;opacity:0.5;font-size:16px;margin-left:6px;';
            del.addEventListener('click', (e) => { e.stopPropagation(); deleteModel(model); });
            row.addEventListener('click', () => { transformControl.attach(model); updateContextUI(); refreshObjectList(); });
            row.appendChild(name);
            row.appendChild(del);
            objList.appendChild(row);
        });
    }

    // --- Transform Panel (contextual) ---
    const contextUI = document.createElement('div');
    contextUI.style.cssText = 'display:none;flex-direction:column;gap:5px;border-top:1px solid #555;padding-top:8px;';
    uiContainer.appendChild(contextUI);

    const contextTitle = document.createElement('div');
    contextTitle.style.cssText = 'font-weight:bold;font-size:12px;';
    contextTitle.innerText = 'Selected:';
    contextUI.appendChild(contextTitle);

    const contextBtnRow1 = document.createElement('div');
    contextBtnRow1.style.cssText = 'display:flex;gap:4px;';
    contextUI.appendChild(contextBtnRow1);

    const btnMove = makeBtn('Move');
    const btnRotate = makeBtn('Rotate');
    const btnScale = makeBtn('Scale');
    contextBtnRow1.appendChild(btnMove);
    contextBtnRow1.appendChild(btnRotate);
    contextBtnRow1.appendChild(btnScale);

    const contextBtnRow2 = document.createElement('div');
    contextBtnRow2.style.cssText = 'display:flex;gap:4px;';
    contextUI.appendChild(contextBtnRow2);

    const btnClone = makeBtn('Clone');
    const btnDelete = makeBtn('Delete', btnRed);
    contextBtnRow2.appendChild(btnClone);
    contextBtnRow2.appendChild(btnDelete);

    // --- Teleport Button ---
    const teleportRow = document.createElement('div');
    teleportRow.style.cssText = 'display:flex;gap:4px;margin-top:6px;';
    const btnTeleportCapy = makeBtn('Teleport to Capybara');
    btnTeleportCapy.style.flex = '1';
    btnTeleportCapy.addEventListener('click', () => {
        const es = window.editorState;
        if (!es || !es.playerGrp || !window.getMeshHeight) return;
        const startX = es.playerGrp.position.x;
        const startZ = es.playerGrp.position.z;
        for (let attempt = 0; attempt < 50; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 200 + Math.random() * 800;
            const tx = startX + Math.cos(angle) * dist;
            const tz = startZ + Math.sin(angle) * dist;
            const h = window.getMeshHeight(tx, tz);
            const slope = Math.abs(window.getMeshHeight(tx + 2, tz) - h) + Math.abs(window.getMeshHeight(tx, tz + 2) - h);
            if (h > 5 && h < 20 && slope < 3) {
                es.playerGrp.position.set(tx, h + 5, tz);
                if (es.editorControls) {
                    es.editorControls.target.set(tx, h + 5, tz);
                    camera.position.set(tx + 30, h + 25, tz + 30);
                    es.editorControls.update();
                }
                return;
            }
        }
        alert('No flat land found nearby — try again');
    });
    teleportRow.appendChild(btnTeleportCapy);
    uiContainer.appendChild(teleportRow);

    // --- Keyboard Shortcuts Info ---
    const shortcutsEl = document.createElement('div');
    shortcutsEl.style.cssText = 'font-size:10px;color:#666;line-height:1.6;margin-top:4px;';
    shortcutsEl.innerHTML = '<b>Keys:</b> G Move · R Rotate · S Scale · D Clone · T Top View · P Orbit · Del Delete · Ctrl+S Save';
    uiContainer.appendChild(shortcutsEl);

    function toggleTerrainEditor() {
        isEditorVisible = !isEditorVisible;
        uiContainer.style.display = isEditorVisible ? 'flex' : 'none';
        const btnToggleEditor = document.getElementById('editor-toggle');
        if (btnToggleEditor) {
            btnToggleEditor.innerText = isEditorVisible ? 'Hide Editor' : 'Terrain Editor';
        }
        if (isEditorVisible) {
            enterEditorMode();
            refreshModelLibrary();
        } else {
            exitEditorMode();
        }
    }
    window.toggleTerrainEditor = toggleTerrainEditor;

    const existingBtn = document.getElementById('editor-toggle');
    if (existingBtn) {
        existingBtn.addEventListener('click', toggleTerrainEditor);
    }

    function updateContextUI() {
        if (transformControl.object) {
            contextUI.style.display = 'flex';
            const fn = transformControl.object.userData.filename || 'unknown';
            contextTitle.innerText = 'Selected: ' + fn.replace(/\.(glb|gltf)$/i, '');
        } else {
            contextUI.style.display = 'none';
        }
        refreshObjectList();
    }

    // --- Upload Model (saves to server) ---
    uploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showToast('Uploading ' + file.name + '...');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const base64 = btoa(new Uint8Array(arrayBuffer).reduce((s, b) => s + String.fromCharCode(b), ''));

            await fetch(EDITOR_SERVER + '/api/save-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, data: base64 })
            });

            gltfLoader.parse(arrayBuffer, '', (gltf) => {
                activeModelScene = gltf.scene;
                activeModelFilename = file.name;
                modelTemplates[file.name] = gltf.scene;
                showToast('Ready to place: ' + file.name);
                refreshModelLibrary();
            });
        } catch (err) {
            showToast('Upload failed — is editor server running?');
            if (activeModelUrl) URL.revokeObjectURL(activeModelUrl);
            activeModelUrl = URL.createObjectURL(file);
            activeModelFilename = file.name;
            gltfLoader.load(activeModelUrl, (gltf) => {
                activeModelScene = gltf.scene;
            });
        }
    });

    // --- Drag & Drop onto viewport ---
    renderer.domElement.addEventListener('dragover', (e) => e.preventDefault());
    renderer.domElement.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (!isEditorVisible) return;
        const files = [...e.dataTransfer.files].filter(f =>
            f.name.toLowerCase().endsWith('.glb') || f.name.toLowerCase().endsWith('.gltf')
        );
        for (const file of files) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const base64 = btoa(new Uint8Array(arrayBuffer).reduce((s, b) => s + String.fromCharCode(b), ''));
                await fetch(EDITOR_SERVER + '/api/save-model', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: file.name, data: base64 })
                }).catch(() => {});

                gltfLoader.parse(arrayBuffer, '', (gltf) => {
                    activeModelScene = gltf.scene;
                    activeModelFilename = file.name;
                    modelTemplates[file.name] = gltf.scene;

                    const clone = createClone(activeModelScene);
                    clone.position.set(0, 20, 0);
                    clone.userData.filename = file.name;
                    transformControl.attach(clone);
                    updateContextUI();
                    showToast('Placed: ' + file.name);
                    refreshModelLibrary();
                });
            } catch (err) {
                showToast('Failed to load: ' + file.name);
            }
        }
    });

    // --- Core Model Operations ---
    function createClone(sourceObj, positionOffset = new THREE.Vector3(0, 0, 0)) {
        if (!sourceObj) return null;
        const clone = sourceObj.clone();
        clone.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        clone.position.copy(sourceObj.position).add(positionOffset);
        clone.rotation.copy(sourceObj.rotation);
        clone.scale.copy(sourceObj.scale);

        if (randomRotationOnPlace) {
            clone.rotation.y = Math.random() * Math.PI * 2;
        }
        if (randomScaleOnPlace) {
            const sMult = 0.85 + Math.random() * 0.3;
            clone.scale.multiplyScalar(sMult);
        }

        clone.userData.filename = sourceObj.userData ? sourceObj.userData.filename : activeModelFilename;
        scene.add(clone);
        placedModels.push(clone);
        refreshObjectList();
        return clone;
    }

    function deleteModel(obj) {
        transformControl.detach();
        scene.remove(obj);
        const idx = placedModels.indexOf(obj);
        if (idx > -1) placedModels.splice(idx, 1);
        obj.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            }
        });
        updateContextUI();
        showToast('Deleted');
    }

    // --- Save / Load (Server) ---
    function getSceneData() {
        return {
            objects: placedModels.map(model => ({
                filename: model.userData.filename,
                position: model.position.toArray(),
                rotation: model.rotation.toArray().slice(0, 3),
                scale: model.scale.toArray()
            }))
        };
    }

    async function saveScene() {
        const data = getSceneData();
        try {
            await fetch(EDITOR_SERVER + '/api/save-scene', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            showToast(`Saved (${data.objects.length} objects)`);
        } catch (e) {
            // Fallback: download JSON
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'scene.json'; a.click();
            URL.revokeObjectURL(url);
            showToast('Server offline — downloaded JSON');
        }
    }

    async function loadScene() {
        try {
            const resp = await fetch(EDITOR_SERVER + '/api/load-scene', { method: 'POST', body: '{}' });
            const data = await resp.json();
            if (!data.objects || data.objects.length === 0) {
                showToast('No saved scene found');
                return;
            }

            transformControl.detach();
            placedModels.forEach(obj => {
                scene.remove(obj);
                obj.traverse((child) => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                            else child.material.dispose();
                        }
                    }
                });
            });
            placedModels.length = 0;

            let loaded = 0;
            for (const obj of data.objects) {
                try {
                    let template = modelTemplates[obj.filename];
                    if (!template) {
                        template = await loadModelFromServer(obj.filename);
                        modelTemplates[obj.filename] = template;
                    }
                    const clone = createClone(template);
                    clone.position.fromArray(obj.position);
                    clone.rotation.set(obj.rotation[0], obj.rotation[1], obj.rotation[2]);
                    clone.scale.fromArray(obj.scale);
                    clone.userData.filename = obj.filename;
                    loaded++;
                } catch (e) {
                    console.warn('Failed to load model:', obj.filename, e);
                }
            }
            updateContextUI();
            showToast(`Loaded ${loaded} objects`);
        } catch (e) {
            showToast('Server offline — use Load JSON file instead');
        }
    }

    async function gitPush() {
        showToast('Saving & pushing to git...');
        await saveScene();
        try {
            const resp = await fetch(EDITOR_SERVER + '/api/git-push', { method: 'POST', body: '{}' });
            const data = await resp.json();
            showToast(data.ok ? 'Pushed to git!' : 'Git push issue — check terminal');
        } catch (e) {
            showToast('Git push failed — server offline?');
        }
    }

    // --- Button Handlers ---
    btnSpace.addEventListener('click', () => {
        const next = transformControl.space === 'local' ? 'world' : 'local';
        transformControl.setSpace(next);
        btnSpace.innerText = next.charAt(0).toUpperCase() + next.slice(1);
    });

    btnSnap.addEventListener('click', () => {
        currentSnapping = !currentSnapping;
        transformControl.setTranslationSnap(currentSnapping ? 1 : null);
        transformControl.setRotationSnap(currentSnapping ? Math.PI / 8 : null);
        btnSnap.innerText = currentSnapping ? 'Snap: ON' : 'Snap: OFF';
    });

    btnMove.addEventListener('click', () => transformControl.setMode('translate'));
    btnRotate.addEventListener('click', () => transformControl.setMode('rotate'));
    btnScale.addEventListener('click', () => transformControl.setMode('scale'));

    btnClone.addEventListener('click', () => {
        if (!transformControl.object) return;
        const clone = createClone(transformControl.object, new THREE.Vector3(5, 0, 5));
        transformControl.attach(clone);
        updateContextUI();
    });

    btnDelete.addEventListener('click', () => {
        if (transformControl.object) deleteModel(transformControl.object);
    });

    btnSave.addEventListener('click', saveScene);
    btnLoad.addEventListener('click', loadScene);
    btnGitPush.addEventListener('click', gitPush);

    btnExportJSON.addEventListener('click', () => {
        const data = getSceneData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'scene.json'; a.click();
        URL.revokeObjectURL(url);
        showToast('Exported JSON');
    });

    // --- Keyboard Shortcuts ---
    const editorKeys = { w: false, a: false, s: false, d: false, q: false, e: false };
    window.addEventListener('keydown', (e) => {
        if (!isEditorVisible) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const k = e.key.toLowerCase();
        if (k in editorKeys) editorKeys[k] = true;

        if (e.key === 't' || e.key === 'T') {
            setTopDownView(!isTopDownView);
        }
        if (e.key === 'p' || e.key === 'P') {
            setTopDownView(false);
        }
        if (e.key === 'g' || e.key === 'G') transformControl.setMode('translate');
        if (e.key === 'r' && !e.ctrlKey) transformControl.setMode('rotate');
        if (e.key === 's' && !e.ctrlKey && !transformControl.object) transformControl.setMode('scale');
        if (e.key === 'd' || e.key === 'D') {
            if (transformControl.object) {
                const clone = createClone(transformControl.object, new THREE.Vector3(5, 0, 5));
                transformControl.attach(clone);
                updateContextUI();
            }
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (transformControl.object) deleteModel(transformControl.object);
        }
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveScene();
        }
    });
    window.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        if (k in editorKeys) editorKeys[k] = false;
    });

    function updateEditorCameraMovement() {
        if (!isEditorVisible || !orbitControls) return;
        const speed = isTopDownView ? Math.max(2.0, topDownAltitude * 0.02) : 2.0;

        if (isTopDownView) {
            const move = new THREE.Vector3();
            if (editorKeys.w) move.z -= speed;
            if (editorKeys.s) move.z += speed;
            if (editorKeys.d) move.x += speed;
            if (editorKeys.a) move.x -= speed;
            if (editorKeys.e) {
                topDownAltitude = Math.min(800, topDownAltitude + speed * 1.5);
                camera.position.y = orbitControls.target.y + topDownAltitude;
                if (altSlider) altSlider.value = topDownAltitude;
                if (altLabel) altLabel.innerText = 'Alt: ' + Math.round(topDownAltitude) + 'm';
            }
            if (editorKeys.q) {
                topDownAltitude = Math.max(25, topDownAltitude - speed * 1.5);
                camera.position.y = orbitControls.target.y + topDownAltitude;
                if (altSlider) altSlider.value = topDownAltitude;
                if (altLabel) altLabel.innerText = 'Alt: ' + Math.round(topDownAltitude) + 'm';
            }

            if (move.lengthSq() > 0) {
                camera.position.add(move);
                orbitControls.target.add(move);
            }
            const waterY = 2.4;
            const targetGroundY = getWorldHeight(orbitControls.target.x, orbitControls.target.z);
            orbitControls.target.y = Math.max(targetGroundY, waterY);
            camera.position.y = orbitControls.target.y + topDownAltitude;
        } else {
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();
            const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

            const move = new THREE.Vector3();
            if (editorKeys.w) move.add(forward.clone().multiplyScalar(speed));
            if (editorKeys.s) move.add(forward.clone().multiplyScalar(-speed));
            if (editorKeys.d) move.add(right.clone().multiplyScalar(speed));
            if (editorKeys.a) move.add(right.clone().multiplyScalar(-speed));
            if (editorKeys.e) move.y += speed;
            if (editorKeys.q) move.y -= speed;

            if (move.lengthSq() > 0) {
                camera.position.add(move);
                orbitControls.target.add(move);
            }

            const waterY = 2.4;
            const targetGroundY = getWorldHeight(orbitControls.target.x, orbitControls.target.z);
            orbitControls.target.y = Math.max(orbitControls.target.y, Math.max(targetGroundY, waterY) + 1.0);

            const camGroundY = getWorldHeight(camera.position.x, camera.position.z);
            camera.position.y = Math.max(camera.position.y, Math.max(camGroundY, waterY) + 2.0);
        }
    }
    window._updateEditorCameraMovement = updateEditorCameraMovement;

    // --- Raycasting & Placement ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerDownPos = new THREE.Vector2();

    renderer.domElement.addEventListener('pointerdown', (e) => {
        pointerDownPos.set(e.clientX, e.clientY);
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
        if (!isEditorVisible) return;
        if (Math.abs(e.clientX - pointerDownPos.x) > 5 || Math.abs(e.clientY - pointerDownPos.y) > 5) return;
        if (window.editorState && window.editorState.isDragging) return;

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        let hitModel = false;
        for (let i = 0; i < placedModels.length; i++) {
            const intersects = raycaster.intersectObject(placedModels[i], true);
            if (intersects.length > 0) {
                transformControl.attach(placedModels[i]);
                hitModel = true;
                break;
            }
        }
        if (hitModel) { updateContextUI(); return; }

        if (terrainMesh) {
            const intersects = raycaster.intersectObject(terrainMesh, false);
            if (intersects.length > 0) {
                const point = intersects[0].point;
                if (activeModelScene) {
                    const clone = createClone(activeModelScene);
                    clone.position.copy(point);
                    clone.userData.filename = activeModelFilename;
                    transformControl.attach(clone);
                    showToast('Placed: ' + activeModelFilename);
                    updateContextUI();
                    return;
                } else {
                    // Clicked empty terrain while in Selection Mode -> deselect
                    transformControl.detach();
                    updateContextUI();
                    return;
                }
            }
        }

        transformControl.detach();
        updateContextUI();
    });

    // Auto-load saved scene on startup
    loadScene().then(() => refreshModelLibrary());
}
