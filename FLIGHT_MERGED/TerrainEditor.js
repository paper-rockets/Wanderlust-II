import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
        position: 'absolute', top: '80px', left: '20px',
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
        padding: '15px', borderRadius: '10px', color: 'white',
        fontFamily: 'sans-serif', zIndex: '1000', display: 'none',
        flexDirection: 'column', gap: '8px', width: '260px',
        maxHeight: '80vh', overflowY: 'auto'
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

    // --- Model Library ---
    const libSection = document.createElement('div');
    libSection.style.cssText = 'border-bottom:1px solid #444;padding-bottom:8px;';
    libSection.innerHTML = '<div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px;">Model Library</div>';
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
            libList.innerHTML = '<span style="font-size:11px;color:#aa3333;">Editor server not running (port 9100)</span>';
        }
    }

    async function selectLibraryModel(filename) {
        if (modelTemplates[filename]) {
            activeModelScene = modelTemplates[filename];
            activeModelFilename = filename;
            showToast(`Selected: ${filename}`);
            return;
        }
        try {
            const model = await loadModelFromServer(filename);
            modelTemplates[filename] = model;
            activeModelScene = model;
            activeModelFilename = filename;
            showToast(`Loaded: ${filename}`);
        } catch (e) {
            showToast(`Failed to load ${filename}`);
        }
    }

    function loadModelFromServer(filename) {
        return new Promise((resolve, reject) => {
            gltfLoader.load(EDITOR_SERVER + '/models/' + filename, (gltf) => {
                resolve(gltf.scene);
            }, undefined, reject);
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
    shortcutsEl.innerHTML = '<b>Keys:</b> G Move · R Rotate · S Scale · D Clone · Del Delete · Ctrl+S Save';
    uiContainer.appendChild(shortcutsEl);

    const existingBtn = document.getElementById('editor-toggle');
    if (existingBtn) {
        existingBtn.addEventListener('click', () => {
            isEditorVisible = !isEditorVisible;
            uiContainer.style.display = isEditorVisible ? 'flex' : 'none';
            if (isEditorVisible) {
                enterEditorMode();
                refreshModelLibrary();
            } else {
                exitEditorMode();
            }
        });
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
        const speed = 2.0;
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
                } else {
                    showToast('Select a model first (library or upload)');
                }
                updateContextUI();
                return;
            }
        }

        transformControl.detach();
        updateContextUI();
    });

    // Auto-load saved scene on startup
    loadScene().then(() => refreshModelLibrary());
}
