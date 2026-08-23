import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// --- Preset Tree Models Index ---
const TREE_PRESETS = [
  // Compressed Models
  { name: 'Pine Trees (Compressed Single-Mesh)', path: 'assets/Trees_Compressed/pine_trees.glb', category: 'Compressed' },
  { name: 'Atlas 001 (Compressed)', path: 'assets/Trees_Compressed/Background_Tree_Atlas_001_alt.glb', category: 'Compressed' },
  { name: 'Atlas 002 (Compressed)', path: 'assets/Trees_Compressed/Background_Tree_Atlas_002_alt.glb', category: 'Compressed' },
  { name: 'Atlas 003 (Compressed)', path: 'assets/Trees_Compressed/Background_Tree_Atlas_003_alt.glb', category: 'Compressed' },
  { name: 'Atlas 004 (Compressed)', path: 'assets/Trees_Compressed/Background_Tree_Atlas_004_alt.glb', category: 'Compressed' },
  { name: 'Atlas 005 (Compressed)', path: 'assets/Trees_Compressed/Background_Tree_Atlas_005_alt.glb', category: 'Compressed' },
  { name: 'Atlas 006 (Compressed)', path: 'assets/Trees_Compressed/Background_Tree_Atlas_006_alt.glb', category: 'Compressed' },
  { name: 'Atlas 007 (Compressed)', path: 'assets/Trees_Compressed/Background_Tree_Atlas_007_alt.glb', category: 'Compressed' },
  { name: 'Atlas 009 (Compressed)', path: 'assets/Trees_Compressed/Background_Tree_Atlas_009_alt.glb', category: 'Compressed' },
  { name: 'Atlas 010 (Compressed)', path: 'assets/Trees_Compressed/Background_Tree_Atlas_010_alt.glb', category: 'Compressed' },
  
  // Ultra-Lightweight Toon / Procedural
  { name: 'Atlas 001 Toon (3 KB)', path: 'assets/Trees_Compressed_Toon/Background_Tree_Atlas_001_alt.glb', category: 'Compressed Toon' },
  { name: 'Atlas 002 Toon (2.7 KB)', path: 'assets/Trees_Compressed_Toon/Background_Tree_Atlas_002_alt.glb', category: 'Compressed Toon' },
  { name: 'Atlas 003 Toon (3.2 KB)', path: 'assets/Trees_Compressed_Toon/Background_Tree_Atlas_003_alt.glb', category: 'Compressed Toon' },
  { name: 'Atlas 004 Toon (3.2 KB)', path: 'assets/Trees_Compressed_Toon/Background_Tree_Atlas_004_alt.glb', category: 'Compressed Toon' },
  { name: 'Atlas 005 Toon (3.2 KB)', path: 'assets/Trees_Compressed_Toon/Background_Tree_Atlas_005_alt.glb', category: 'Compressed Toon' },
  { name: 'Atlas 006 Toon (3.3 KB)', path: 'assets/Trees_Compressed_Toon/Background_Tree_Atlas_006_alt.glb', category: 'Compressed Toon' },
  { name: 'Atlas 007 Toon (3.2 KB)', path: 'assets/Trees_Compressed_Toon/Background_Tree_Atlas_007_alt.glb', category: 'Compressed Toon' },
  { name: 'Atlas 009 Toon (2.7 KB)', path: 'assets/Trees_Compressed_Toon/Background_Tree_Atlas_009_alt.glb', category: 'Compressed Toon' },
  { name: 'Atlas 010 Toon (3.3 KB)', path: 'assets/Trees_Compressed_Toon/Background_Tree_Atlas_010_alt.glb', category: 'Compressed Toon' },

  // Original Presets
  { name: 'Background Tree Atlas', path: 'assets/Trees/Background_Tree_Atlas.glb', category: 'Atlas' },
  { name: 'Tree Atlas 001', path: 'assets/Trees/Background_Tree_Atlas_001.glb', category: 'Atlas' },
  { name: 'Tree Atlas 002', path: 'assets/Trees/Background_Tree_Atlas_002.glb', category: 'Atlas' },
  { name: 'Pine Tree (PS1 Low Poly)', path: 'assets/Trees/pine_tree_-_ps1_low_poly.glb', category: 'Pines' },
  { name: 'Pine Tree Standard', path: 'assets/Trees/pine_tree.glb', category: 'Pines' },
  { name: 'Stylized Pine Tree', path: 'assets/Trees/stylized_pine_tree.glb', category: 'Pines' },
  { name: 'Stylized Pine Pack', path: 'assets/Trees/stylized_pine_tree_pack.glb', category: 'Pines' },
  { name: 'Small Stylized Pine V1', path: 'assets/Trees/small_stylized_pine_var1.glb', category: 'Pines' },
  { name: 'Realistic Baobab Tree', path: 'assets/Trees/realistic_baobab_tree.glb', category: 'Baobab' },
  { name: 'Low Poly Giant Baobab', path: 'assets/Trees/low-poly_giant_baobab_adansonia_grandidieri.glb', category: 'Baobab' },
  { name: 'African Baobab 120', path: 'assets/Trees/realistic_hd_african_continental_baobab_120.glb', category: 'Baobab' },
  { name: 'Tree Branches 01', path: 'assets/Trees/Tree_Branches_01.glb', category: 'Trunks & Branches' },
  { name: 'Tree Branches 02', path: 'assets/Trees/Tree_Branches_02.glb', category: 'Trunks & Branches' },
  { name: 'Tree Trunk 01', path: 'assets/Trees/Tree_Trunk_01.glb', category: 'Trunks & Branches' },
  { name: 'Tree Trunk 02', path: 'assets/Trees/Tree_Trunk_02.glb', category: 'Trunks & Branches' },
  { name: 'Low Poly Forest Pack', path: 'assets/Trees/low_poly_forest_tree_pack.glb', category: 'Packs' },
  { name: 'Free Pack Tree', path: 'assets/Trees/free_pack_-_tree.glb', category: 'Packs' },
  { name: 'Barbary Fig', path: 'assets/Trees/realistic_hd_barbary_fig_2954.glb', category: 'Exotic' },
  { name: 'Rocks Main', path: 'assets/Trees/Rocks.glb', category: 'Environment' },
  { name: 'Rocks 001', path: 'assets/Trees/Rocks_001.glb', category: 'Environment' },
];

class ModelViewerApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.models = [];
    this.selectedModelId = null;
    this.layoutMode = 'grid'; // 'grid' | 'stacked' | 'manual'
    this.dracoDecoderPath = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
    
    // UI Visibility States
    this.leftCollapsed = false;
    this.rightCollapsed = false;

    // Performance Tracking
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.fps = 0;

    this.initScene();
    this.initLoaders();
    this.initUI();
    this.initEventListeners();
    this.animate();

    // Auto-load initial default model
    this.loadModelFromPath(TREE_PRESETS[4].path, TREE_PRESETS[4].name);
  }

  // --- 1. Scene, Camera, Renderer, & Lighting Setup ---
  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#080c14');

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(6, 6, 12);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    // Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 1.5;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05;

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfffaed, 2.0);
    this.dirLight.position.set(15, 25, 15);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 100;
    const shadowD = 15;
    this.dirLight.shadow.camera.left = -shadowD;
    this.dirLight.shadow.camera.right = shadowD;
    this.dirLight.shadow.camera.top = shadowD;
    this.dirLight.shadow.camera.bottom = -shadowD;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    this.hemiLight = new THREE.HemisphereLight(0xb1e0ff, 0x3b5323, 0.5);
    this.scene.add(this.hemiLight);

    // Ground Grid
    this.gridHelper = new THREE.GridHelper(30, 30, 0x3b82f6, 0x1e293b);
    this.gridHelper.position.y = -0.01;
    this.scene.add(this.gridHelper);

    const shadowFloorGeo = new THREE.PlaneGeometry(60, 60);
    const shadowFloorMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    this.shadowFloor = new THREE.Mesh(shadowFloorGeo, shadowFloorMat);
    this.shadowFloor.rotation.x = -Math.PI / 2;
    this.shadowFloor.position.y = -0.02;
    this.shadowFloor.receiveShadow = true;
    this.scene.add(this.shadowFloor);
  }

  // --- 2. Draco Loader Setup ---
  initLoaders() {
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(this.dracoDecoderPath);

    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
  }

  // --- 3. Model Loading Logic ---
  async loadModelFromPath(path, name = null) {
    const filename = name || path.split('/').pop();
    this.showToast(`Loading ${filename}...`, 'info');

    try {
      this.gltfLoader.load(
        path,
        (gltf) => {
          this.processLoadedModel(gltf, filename);
          this.showToast(`Loaded ${filename}`, 'success');
        },
        undefined,
        (error) => {
          console.error(`Failed to load ${path}:`, error);
          this.showToast(`Error loading ${filename}`, 'danger');
        }
      );
    } catch (err) {
      console.error(err);
    }
  }

  loadModelFromFile(file) {
    const filename = file.name;
    const url = URL.createObjectURL(file);
    this.showToast(`Loading ${filename}...`, 'info');

    this.gltfLoader.load(
      url,
      (gltf) => {
        this.processLoadedModel(gltf, filename);
        URL.revokeObjectURL(url);
        this.showToast(`Loaded ${filename}`, 'success');
      },
      undefined,
      (error) => {
        console.error(`Error loading dropped file ${filename}:`, error);
        this.showToast(`Failed to parse ${filename}`, 'danger');
        URL.revokeObjectURL(url);
      }
    );
  }

  processLoadedModel(gltf, filename) {
    const modelScene = gltf.scene;

    let isDraco = false;
    if (gltf.parser && gltf.parser.json) {
      const extensions = gltf.parser.json.extensionsUsed || [];
      if (extensions.includes('KHR_draco_mesh_compression')) {
        isDraco = true;
      }
    }

    let totalVerts = 0;
    let totalFaces = 0;
    let hasBarkMask = false;

    // Clone materials to allow independent color tweaking per model
    modelScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.geometry && (child.geometry.attributes._aisbark || child.geometry.attributes.color)) {
          hasBarkMask = true;
        }

        const setupDualColor = (mat) => {
          const clonedMat = mat.clone();
          clonedMat.userData.customUniforms = {
            uCanopyColor: { value: new THREE.Color('#388e3c') },
            uTrunkColor: { value: new THREE.Color('#5d4037') },
            uDualColorActive: { value: 1.0 }
          };
          clonedMat.onBeforeCompile = (shader) => {
            shader.uniforms.uCanopyColor = clonedMat.userData.customUniforms.uCanopyColor;
            shader.uniforms.uTrunkColor = clonedMat.userData.customUniforms.uTrunkColor;
            shader.uniforms.uDualColorActive = clonedMat.userData.customUniforms.uDualColorActive;

            shader.vertexShader = `
              attribute float _aisbark;
              varying float vCustomBark;
              ${shader.vertexShader}
            `.replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>
               #ifdef USE_COLOR
                 vCustomBark = color.r;
               #else
                 vCustomBark = _aisbark;
               #endif
              `
            );

            shader.fragmentShader = `
              uniform vec3 uCanopyColor;
              uniform vec3 uTrunkColor;
              uniform float uDualColorActive;
              varying float vCustomBark;
              ${shader.fragmentShader}
            `.replace(
              '#include <color_fragment>',
              `#include <color_fragment>
               if (uDualColorActive > 0.5) {
                 vec3 maskCol = mix(uCanopyColor, uTrunkColor, clamp(vCustomBark, 0.0, 1.0));
                 diffuseColor.rgb *= maskCol;
               }
              `
            );
          };
          return clonedMat;
        };

        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map(setupDualColor);
          } else {
            child.material = setupDualColor(child.material);
          }
        }

        if (child.geometry) {
          totalVerts += child.geometry.attributes.position ? child.geometry.attributes.position.count : 0;
          if (child.geometry.index) {
            totalFaces += child.geometry.index.count / 3;
          } else if (child.geometry.attributes.position) {
            totalFaces += child.geometry.attributes.position.count / 3;
          }
        }
      }
    });

    const box = new THREE.Box3().setFromObject(modelScene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    modelScene.position.sub(center);
    modelScene.position.y += size.y / 2;

    const wrapper = new THREE.Group();
    wrapper.add(modelScene);
    this.scene.add(wrapper);

    const boxHelper = new THREE.BoxHelper(wrapper, 0x3b82f6);
    boxHelper.visible = false;
    this.scene.add(boxHelper);

    let mixer = null;
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(modelScene);
      const action = mixer.clipAction(gltf.animations[0]);
      action.play();
    }

    const modelEntry = {
      id: 'model_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: filename.replace(/\.[^/.]+$/, ''),
      filename: filename,
      group: wrapper,
      scene: modelScene,
      boxHelper: boxHelper,
      bounds: { size, center },
      polycount: Math.round(totalFaces),
      vertices: totalVerts,
      isDraco: isDraco,
      hasBarkMask: hasBarkMask,
      canopyColor: '#388e3c',
      trunkColor: '#5d4037',
      visible: true,
      wireframe: false,
      mixer: mixer,
    };

    const isFirstModel = this.models.length === 0;

    this.models.push(modelEntry);
    this.selectedModelId = modelEntry.id;
    
    // Update layout without overwriting custom edits
    this.updateLayout();
    this.renderModelList();
    this.updateSelectedModelDetails();

    // Only auto-frame camera on the very first model load so camera framing isn't jerked on single edits
    if (isFirstModel) {
      this.fitCameraToScene();
    }
  }

  // --- 4. Layout Engine ---
  updateLayout() {
    if (this.models.length === 0 || this.layoutMode === 'manual') return;

    if (this.layoutMode === 'grid') {
      const count = this.models.length;
      const cols = Math.ceil(Math.sqrt(count));
      const spacing = 4.5;

      this.models.forEach((entry, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;

        const offsetX = (col - (cols - 1) / 2) * spacing;
        const offsetZ = (row - (Math.ceil(count / cols) - 1) / 2) * spacing;

        // Preserve individual Y-axis position customized by user!
        const currentY = entry.group.position.y;
        entry.group.position.set(offsetX, currentY, offsetZ);
        entry.boxHelper.update();
      });
    } else if (this.layoutMode === 'stacked') {
      this.models.forEach((entry) => {
        const currentY = entry.group.position.y;
        entry.group.position.set(0, currentY, 0);
        entry.boxHelper.update();
      });
    }
  }

  removeModel(id) {
    const idx = this.models.findIndex((m) => m.id === id);
    if (idx !== -1) {
      const entry = this.models[idx];
      this.scene.remove(entry.group);
      this.scene.remove(entry.boxHelper);
      this.models.splice(idx, 1);

      if (this.selectedModelId === id) {
        this.selectedModelId = this.models.length > 0 ? this.models[this.models.length - 1].id : null;
      }

      this.updateLayout();
      this.renderModelList();
      this.updateSelectedModelDetails();
    }
  }

  loadAllPresets() {
    this.showToast('Loading preset trees into grid...', 'info');
    TREE_PRESETS.slice(0, 6).forEach((preset) => {
      this.loadModelFromPath(preset.path, preset.name);
    });
  }

  loadCategoryPresets(categoryName) {
    const catPresets = TREE_PRESETS.filter((p) => p.category === categoryName);
    this.showToast(`Loading category: ${categoryName}...`, 'info');
    catPresets.forEach((p) => this.loadModelFromPath(p.path, p.name));
  }

  clearAllModels() {
    this.models.forEach((entry) => {
      this.scene.remove(entry.group);
      this.scene.remove(entry.boxHelper);
    });
    this.models = [];
    this.selectedModelId = null;
    this.renderModelList();
    this.updateSelectedModelDetails();
    this.showToast('Cleared all models', 'info');
  }

  fitCameraToScene() {
    if (this.models.length === 0) return;

    const box = new THREE.Box3();
    this.models.forEach((m) => {
      if (m.visible) box.expandByObject(m.group);
    });

    if (box.isEmpty()) return;

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 2.2;
    cameraZ = Math.max(cameraZ, 4.5);

    this.controls.target.copy(center);
    this.camera.position.set(center.x + cameraZ * 0.7, center.y + cameraZ * 0.5, center.z + cameraZ);
    this.camera.lookAt(center);
    this.controls.update();
  }

  // --- 5. UI Controller & Collapsible Sidebars ---
  initUI() {
    this.renderPresetCatalog();
    this.renderModelList();
  }

  toggleLeftSidebar(forceState = null) {
    const sidebar = document.getElementById('left-sidebar');
    const handle = document.getElementById('left-toggle-handle');
    if (!sidebar) return;

    this.leftCollapsed = forceState !== null ? forceState : !this.leftCollapsed;
    if (this.leftCollapsed) {
      sidebar.classList.add('collapsed');
      if (handle) handle.style.display = 'block';
    } else {
      sidebar.classList.remove('collapsed');
      if (handle) handle.style.display = 'none';
    }
  }

  toggleRightSidebar(forceState = null) {
    const sidebar = document.getElementById('right-sidebar');
    const handle = document.getElementById('right-toggle-handle');
    if (!sidebar) return;

    this.rightCollapsed = forceState !== null ? forceState : !this.rightCollapsed;
    if (this.rightCollapsed) {
      sidebar.classList.add('collapsed');
      if (handle) handle.style.display = 'block';
    } else {
      sidebar.classList.remove('collapsed');
      if (handle) handle.style.display = 'none';
    }
  }

  toggleZenMode() {
    const isBothCollapsed = this.leftCollapsed && this.rightCollapsed;
    if (isBothCollapsed) {
      this.toggleLeftSidebar(false);
      this.toggleRightSidebar(false);
    } else {
      this.toggleLeftSidebar(true);
      this.toggleRightSidebar(true);
    }
  }

  renderPresetCatalog() {
    const catalogContainer = document.getElementById('preset-catalog');
    if (!catalogContainer) return;

    catalogContainer.innerHTML = '';
    const categories = {};

    TREE_PRESETS.forEach((preset) => {
      if (!categories[preset.category]) categories[preset.category] = [];
      categories[preset.category].push(preset);
    });

    Object.keys(categories).forEach((cat) => {
      const catHeader = document.createElement('div');
      catHeader.className = 'preset-category-header';
      catHeader.innerHTML = `
        <span class="preset-category-title">${cat}</span>
        <button class="btn-load-category" title="Load All ${cat}">+ Add All</button>
      `;
      catHeader.querySelector('button').onclick = () => this.loadCategoryPresets(cat);
      catalogContainer.appendChild(catHeader);

      const grid = document.createElement('div');
      grid.className = 'preset-grid';

      categories[cat].forEach((preset) => {
        const card = document.createElement('div');
        card.className = 'preset-card';
        card.innerHTML = `
          <div class="preset-name">${preset.name}</div>
        `;
        card.onclick = () => this.loadModelFromPath(preset.path, preset.name);
        grid.appendChild(card);
      });

      catalogContainer.appendChild(grid);
    });
  }

  renderModelList() {
    const listContainer = document.getElementById('active-models-list');
    const countBadge = document.getElementById('loaded-count-badge');
    if (!listContainer) return;

    if (countBadge) countBadge.textContent = this.models.length;
    listContainer.innerHTML = '';

    if (this.models.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 14px 0; font-size: 11px;">
          No models loaded.<br>Click a preset or drop GLB files!
        </div>
      `;
      return;
    }

    this.models.forEach((entry) => {
      const item = document.createElement('div');
      item.className = `model-item ${entry.id === this.selectedModelId ? 'active' : ''}`;
      item.innerHTML = `
        <div class="model-item-info">
          <div class="model-item-name">${entry.name}</div>
          <div class="model-item-meta">${entry.polycount.toLocaleString()} tris ${entry.isDraco ? '<span class="badge badge-draco">DRACO</span>' : ''}</div>
        </div>
        <div class="model-item-actions">
          <button class="icon-btn ${entry.visible ? 'active' : ''}" title="Toggle Visibility" id="vis_${entry.id}">
            ${entry.visible ? '👁️' : '🙈'}
          </button>
          <button class="icon-btn" title="Focus Camera" id="focus_${entry.id}">🎯</button>
          <button class="icon-btn" title="Remove Model" id="del_${entry.id}">🗑️</button>
        </div>
      `;

      item.onclick = (e) => {
        if (!e.target.closest('.icon-btn')) {
          this.selectedModelId = entry.id;
          this.renderModelList();
          this.updateSelectedModelDetails();
        }
      };

      listContainer.appendChild(item);

      document.getElementById(`vis_${entry.id}`).onclick = (e) => {
        e.stopPropagation();
        entry.visible = !entry.visible;
        entry.group.visible = entry.visible;
        this.renderModelList();
      };

      document.getElementById(`focus_${entry.id}`).onclick = (e) => {
        e.stopPropagation();
        this.selectedModelId = entry.id;
        const box = new THREE.Box3().setFromObject(entry.group);
        const center = new THREE.Vector3();
        box.getCenter(center);
        this.controls.target.copy(center);
        this.controls.update();
      };

      document.getElementById(`del_${entry.id}`).onclick = (e) => {
        e.stopPropagation();
        this.removeModel(entry.id);
      };
    });
  }

  updateSelectedModelDetails() {
    const detailsContainer = document.getElementById('selected-model-inspector');
    if (!detailsContainer) return;

    const model = this.models.find((m) => m.id === this.selectedModelId);
    if (!model) {
      detailsContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 14px 0;">Select a model to edit properties</div>`;
      return;
    }

    // Get current primary material color
    let initialColor = '#ffffff';
    model.scene.traverse((child) => {
      if (child.isMesh && child.material) {
        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
        if (mat && mat.color) {
          initialColor = '#' + mat.color.getHexString();
        }
      }
    });

    const dualColorSection = model.hasBarkMask ? `
      <div class="control-group" style="margin-top: 6px; padding: 6px; background: rgba(255,255,255,0.05); border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
        <label class="control-label" style="color: #4ade80; font-weight: 600;">Canopy (Foliage) Color</label>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
          <input type="color" id="input-canopy-color" value="${model.canopyColor || '#388e3c'}" style="width: 32px; height: 26px; border: none; border-radius: 4px; cursor: pointer; background: none;">
          <span style="font-size: 10px; color: var(--text-muted);">Editable Canopy</span>
        </div>

        <label class="control-label" style="color: #fb923c; font-weight: 600; margin-top: 6px;">Trunk (Bark) Color</label>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
          <input type="color" id="input-trunk-color" value="${model.trunkColor || '#5d4037'}" style="width: 32px; height: 26px; border: none; border-radius: 4px; cursor: pointer; background: none;">
          <span style="font-size: 10px; color: var(--text-muted);">Editable Trunk</span>
        </div>
      </div>
    ` : '';

    detailsContainer.innerHTML = `
      <div class="control-group">
        <label class="control-label">Scale <span class="control-value" id="val-scale">${model.group.scale.x.toFixed(1)}</span></label>
        <input type="range" class="slider-input" id="input-scale" min="0.1" max="5.0" step="0.1" value="${model.group.scale.x}">
      </div>
      <div class="control-group">
        <label class="control-label">Rotation Y <span class="control-value" id="val-roty">${Math.round(THREE.MathUtils.radToDeg(model.group.rotation.y))}°</span></label>
        <input type="range" class="slider-input" id="input-roty" min="0" max="360" step="5" value="${Math.round(THREE.MathUtils.radToDeg(model.group.rotation.y))}">
      </div>
      <div class="control-group">
        <label class="control-label">Position Y <span class="control-value" id="val-posy">${model.group.position.y.toFixed(1)}</span></label>
        <input type="range" class="slider-input" id="input-posy" min="-5" max="10" step="0.2" value="${model.group.position.y}">
      </div>
      ${dualColorSection}
      <div class="control-group" style="margin-top: 4px;">
        <label class="control-label">Base Light / Tint</label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="color" id="input-mat-color" value="${initialColor}" style="width: 32px; height: 28px; border: none; border-radius: 4px; cursor: pointer; background: none;">
          <button class="btn btn-icon" id="btn-reset-color" style="font-size: 10px;" title="Reset Color">Reset Tint</button>
        </div>
      </div>
      <div class="toggle-row" style="margin-top: 6px;">
        <span style="font-size: 11px; font-weight: 600;">Wireframe</span>
        <label class="switch">
          <input type="checkbox" id="input-wireframe" ${model.wireframe ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
      <div class="toggle-row">
        <span style="font-size: 11px; font-weight: 600;">Bounding Box</span>
        <label class="switch">
          <input type="checkbox" id="input-bbox" ${model.boxHelper.visible ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
    `;

    document.getElementById('input-scale').oninput = (e) => {
      const s = parseFloat(e.target.value);
      model.group.scale.set(s, s, s);
      model.boxHelper.update();
      document.getElementById('val-scale').textContent = s.toFixed(1);
    };

    document.getElementById('input-roty').oninput = (e) => {
      const deg = parseFloat(e.target.value);
      model.group.rotation.y = THREE.MathUtils.degToRad(deg);
      model.boxHelper.update();
      document.getElementById('val-roty').textContent = deg + '°';
    };

    document.getElementById('input-posy').oninput = (e) => {
      const py = parseFloat(e.target.value);
      model.group.position.y = py;
      model.boxHelper.update();
      document.getElementById('val-posy').textContent = py.toFixed(1);
    };

    if (model.hasBarkMask) {
      const canopyInput = document.getElementById('input-canopy-color');
      const trunkInput = document.getElementById('input-trunk-color');

      if (canopyInput) {
        canopyInput.oninput = (e) => {
          model.canopyColor = e.target.value;
          model.scene.traverse((child) => {
            if (child.isMesh && child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((m) => {
                if (m.userData && m.userData.customUniforms) {
                  m.userData.customUniforms.uCanopyColor.value.set(e.target.value);
                }
              });
            }
          });
        };
      }

      if (trunkInput) {
        trunkInput.oninput = (e) => {
          model.trunkColor = e.target.value;
          model.scene.traverse((child) => {
            if (child.isMesh && child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((m) => {
                if (m.userData && m.userData.customUniforms) {
                  m.userData.customUniforms.uTrunkColor.value.set(e.target.value);
                }
              });
            }
          });
        };
      }
    }

    // Single edit material color tint without affecting grid layout!
    document.getElementById('input-mat-color').oninput = (e) => {
      const hexColor = e.target.value;
      model.scene.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => { if (m.color) m.color.set(hexColor); });
          } else if (child.material.color) {
            child.material.color.set(hexColor);
          }
        }
      });
    };

    document.getElementById('btn-reset-color').onclick = () => {
      model.scene.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => { if (m.color) m.color.set(0xffffff); });
          } else if (child.material.color) {
            child.material.color.set(0xffffff);
          }
        }
      });
      document.getElementById('input-mat-color').value = '#ffffff';
    };

    document.getElementById('input-wireframe').onchange = (e) => {
      model.wireframe = e.target.checked;
      model.scene.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => (m.wireframe = model.wireframe));
          } else {
            child.material.wireframe = model.wireframe;
          }
        }
      });
    };

    document.getElementById('input-bbox').onchange = (e) => {
      model.boxHelper.visible = e.target.checked;
    };
  }

  // --- 6. Global Event Handlers ---
  initEventListeners() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'h') {
        this.toggleZenMode();
      }
    });

    const btnHideLeft = document.getElementById('btn-hide-left');
    const leftHandle = document.getElementById('left-toggle-handle');
    if (btnHideLeft) btnHideLeft.onclick = () => this.toggleLeftSidebar(true);
    if (leftHandle) leftHandle.onclick = () => this.toggleLeftSidebar(false);

    const btnHideRight = document.getElementById('btn-hide-right');
    const rightHandle = document.getElementById('right-toggle-handle');
    if (btnHideRight) btnHideRight.onclick = () => this.toggleRightSidebar(true);
    if (rightHandle) rightHandle.onclick = () => this.toggleRightSidebar(false);

    const btnToggleUI = document.getElementById('btn-toggle-ui');
    if (btnToggleUI) btnToggleUI.onclick = () => this.toggleZenMode();

    const btnAutoRotate = document.getElementById('btn-auto-rotate');
    if (btnAutoRotate) {
      btnAutoRotate.onclick = () => {
        this.controls.autoRotate = !this.controls.autoRotate;
        btnAutoRotate.textContent = `🔄 Auto Rotate: ${this.controls.autoRotate ? 'ON' : 'OFF'}`;
        btnAutoRotate.classList.toggle('btn-primary', this.controls.autoRotate);
      };
    }

    const camLeft = document.getElementById('cam-rot-left');
    const camRight = document.getElementById('cam-rot-right');
    const camUp = document.getElementById('cam-rot-up');
    const camDown = document.getElementById('cam-rot-down');

    if (camLeft) camLeft.onclick = () => this.rotateCameraOrbit(-0.2, 0);
    if (camRight) camRight.onclick = () => this.rotateCameraOrbit(0.2, 0);
    if (camUp) camUp.onclick = () => this.rotateCameraOrbit(0, -0.2);
    if (camDown) camDown.onclick = () => this.rotateCameraOrbit(0, 0.2);

    const layoutSelect = document.getElementById('layout-mode-select');
    if (layoutSelect) {
      layoutSelect.onchange = (e) => {
        this.layoutMode = e.target.value;
        this.updateLayout();
      };
    }

    const btnLoadAll = document.getElementById('btn-load-all-presets');
    if (btnLoadAll) btnLoadAll.onclick = () => this.loadAllPresets();

    const btnClearAll = document.getElementById('btn-clear-all');
    if (btnClearAll) btnClearAll.onclick = () => this.clearAllModels();

    const btnResetCam = document.getElementById('btn-reset-cam');
    if (btnResetCam) btnResetCam.onclick = () => this.fitCameraToScene();

    const btnScreenshot = document.getElementById('btn-screenshot');
    if (btnScreenshot) btnScreenshot.onclick = () => this.takeScreenshot();

    const fileInput = document.getElementById('file-upload-input');
    const btnUpload = document.getElementById('btn-upload-file');
    if (btnUpload && fileInput) {
      btnUpload.onclick = () => fileInput.click();
      fileInput.onchange = (e) => {
        const files = Array.from(e.target.files);
        files.forEach((file) => {
          if (file.name.match(/\.(glb|gltf)$/i)) {
            this.loadModelFromFile(file);
          }
        });
      };
    }

    const dropzone = document.getElementById('dropzone-overlay');
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (dropzone) dropzone.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        if (dropzone) dropzone.classList.remove('active');
      }
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dropzone) dropzone.classList.remove('active');
      const files = Array.from(e.dataTransfer.files);
      files.forEach((file) => {
        if (file.name.match(/\.(glb|gltf)$/i)) {
          this.loadModelFromFile(file);
        }
      });
    });

    const envSlider = document.getElementById('env-light-intensity');
    if (envSlider) {
      envSlider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        this.dirLight.intensity = val * 1.5;
        this.ambientLight.intensity = val * 0.7;
      };
    }
  }

  rotateCameraOrbit(angleX, angleY) {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += angleX;
    spherical.phi += angleY;
    spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.01, spherical.phi));
    offset.setFromSpherical(spherical);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  takeScreenshot() {
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `tree_viewer_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    this.showToast('Screenshot saved', 'success');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'danger') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // --- 7. Main Animation Loop ---
  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const delta = (now - (this.lastTime || now)) / 1000;
    this.lastTime = now;

    this.models.forEach((m) => {
      if (m.mixer && m.visible) {
        m.mixer.update(delta);
      }
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    this.frameCount++;
    if (now - this.lastFpsTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
      this.updateStatsDisplay();
    }
  }

  updateStatsDisplay() {
    const fpsElem = document.getElementById('stat-fps');
    const polyElem = document.getElementById('stat-polys');
    const vertElem = document.getElementById('stat-verts');

    if (fpsElem) fpsElem.textContent = `${this.fps} FPS`;

    let totalPolys = 0;
    let totalVerts = 0;
    this.models.forEach((m) => {
      if (m.visible) {
        totalPolys += m.polycount;
        totalVerts += m.vertices;
      }
    });

    if (polyElem) polyElem.textContent = `${totalPolys.toLocaleString()} tris`;
    if (vertElem) vertElem.textContent = `${totalVerts.toLocaleString()} verts`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new ModelViewerApp();
});
