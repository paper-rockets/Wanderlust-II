import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { DRACOExporter } from 'three/addons/exporters/DRACOExporter.js';
// @ts-ignore
import GUI from 'lil-gui';

export class GhibliGenerator {
    private container: HTMLElement;
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private controls!: OrbitControls;
    private gui!: GUI;
    private dirLight!: THREE.DirectionalLight;
    private warmLight!: THREE.PointLight;
    
    private castleGroup: THREE.Group = new THREE.Group();
    private sparkleGroup: THREE.Group = new THREE.Group();
    private auraGroup: THREE.Group = new THREE.Group();
    private materials: any = {};
    private streetLampPositions: THREE.Vector3[] = [];
    private placedBounds: { center: THREE.Vector3, halfExtents: THREE.Vector3 }[] = [];
    private shaderTime = { value: 0 };
    
    private params = {
        seed: 12345,
        palette: 'princess_blossom',
        floatingOnClouds: true,
        layout: 'princess_royal',
        towerShape: 'mixed',
        roofShape: 'fairytale_spire',
        complexity: 7,
        keepHeight: 50,
        towerHeight: 50,
        flaredBases: true,
        hasCorbels: true,
        lowPoly: true,
        floatingIslands: true,
        magicCrystals: true,
        
        // NEW PARAMETERS & MAGICAL FEATURES
        overallScale: 1.0, // Overall castle scale multiplier
        buildingStyle: 'fairytale', // 'fairytale' | 'japanese' | 'european_coastal'
        streetLamps: true,
        magicSparkles: true,
        magicAuraRings: false,

        // CUSTOM COLOR EDITOR
        useCustomColors: false,
        customWallColor: '#fff0f3',
        customAccentColor: '#ffccd5',
        customRoofColor: '#ff4d6d',
        customRoof2Color: '#c9184a',
        customGoldColor: '#ffb703',
        customWoodColor: '#590d22',
        customWindowColor: '#fff3b0',
        customCrystalColor: '#e879f9',
        customFlagColor: '#ff0054',
        customBgColor: '#fce7f3',

        // DETAILED LAYOUT & WINGS
        baseWidthScale: 1.0,   // multiplier for keep width (0.5‑2.0)
        baseLengthScale: 1.0,  // multiplier for keep depth (0.5‑2.0)
        extraSections: false, // add extra wing sections
        sectionsCount: 1,      // number of extra sections (1‑3)
        sectionLength: 12,     // length of each extra wing

        // GROUND & EXTRA BUILDINGS
        groundScale: 1.0,       // overall ground surface scale multiplier (0.5-3.0)
        extraBuildings: false, // add standalone extra buildings
        buildingType: 'gatehouse', // 'gatehouse' | 'outpost' | 'watchtower'
        buildingCount: 1,      // 1-4 extra buildings
        buildingOffset: 35,    // distance from castle center (10-100)

        // 🛡️ OUTER BASE WALL & COURTYARD ENCLOSURE (Independent of Castle Scale)
        hasOuterBaseWall: false,        // Toggle outer perimeter curtain wall
        baseWallShape: 'hexagonal',     // Options: 'hexagonal' | 'square' | 'octagonal' | 'circular'
        baseWallWidth: 70,              // Manual Perimeter Width X (30 – 160)
        baseWallDepth: 70,              // Manual Perimeter Depth Z (30 – 160)
        baseWallHeight: 14,             // Manual Curtain Wall Height Y (5 – 40)
        baseWallTowers: 6,              // Number of perimeter corner towers (4 – 10)
        baseWallTowerRadius: 4.5,       // Radius of perimeter towers (2 – 8)
        baseHasMoat: false,             // Toggle surrounding water moat plane
        baseBridgeLength: 25,           // Front drawbridge/ramp length (10 – 60)

        // PHASE 1: COLLISION & HIERARCHY
        safeSpacing: 3.0, // minimum spacing (meters) between structures (2-5)

        // CENTRAL TOWER
        centralTowerHeight: 35, // height of the upper central spire (10-80)
        centralTowerShape: 'round', // 'round' | 'square' | 'octagonal'

        // PHASE 2: FAIRYTALE ARCHITECTURE
        fairytalePinch: 0.55, // XZ pinch factor for slender towers (0.4-1.0)
        echauguettes: true, // corner turrets on keep walls
        lancetWindows: true, // tall narrow lancet arch windows
        archedBridges: true, // sweeping arched bridges vs flat
        bellCurveRoofs: false, // bell curve roof profile option
        scallopedCorbels: true, // smooth inverted scallop corbels

        // PHASE 3: GLSL ALIVE WALLS
        glslFauxAO: true, // vertex-based ambient occlusion darkening
        glslMagicMoss: true, // procedural creeping magic near base
        glslEnergyVeins: true, // pulsing emissive veins on stone
        magicMossColor: '#00ff88', // moss/frost glow tint
        energyVeinColor: '#8b5cf6', // energy vein emissive color
        veinSpeed: 0.5, // vein pulse speed (0.1-2.0)
        veinIntensity: 0.3, // vein glow intensity (0.0-1.0)

        // 3D EXPORT OPTIONS
        exportFormat: 'glb', // 'glb' (Binary Self-Contained) | 'gltf' (JSON)
        dracoCompression: 'med', // 'off' | 'low' | 'med' | 'high'

        generate: () => this.generate(),
        randomizeAll: () => this.randomizeCastle(),
        exportGLTF: () => this.exportToGLTF(),
        exportHTML: () => this.exportToHTML()
    };
    
    private palettes: Record<string, any> = {
        princess_blossom: { stone: '#fff0f3', accent: '#ffccd5', roof: '#ff4d6d', roof2: '#c9184a', wood: '#590d22', window: '#fff3b0', gold: '#ffb703', crystal: '#ff758f', flag: '#ff0054', bg: '#fce7f3' },
        starlight_dream: { stone: '#f3e8ff', accent: '#e9d5ff', roof: '#8b5cf6', roof2: '#6d28d9', wood: '#4c1d95', window: '#fef08a', gold: '#f59e0b', crystal: '#c084fc', flag: '#ec4899', bg: '#fae8ff' },
        royal_enchanted: { stone: '#f8fafc', accent: '#e2e8f0', roof: '#0284c7', roof2: '#0369a1', wood: '#075985', window: '#fef08a', gold: '#fbbf24', crystal: '#38bdf8', flag: '#e11d48', bg: '#e0f2fe' },
        moonlight_magic: { stone: '#1e1b4b', accent: '#312e81', roof: '#6366f1', roof2: '#4338ca', wood: '#1e293b', window: '#a855f7', gold: '#cbd5e1', crystal: '#06b6d4', flag: '#38bdf8', bg: '#0f172a' },
        candy_pink: { stone: '#ffb3c6', accent: '#ff8fab', roof: '#fb6f92', roof2: '#c9184a', wood: '#590d22', window: '#a2d2ff' },
        diorama_white: { stone: '#f8f9fa', accent: '#e9ecef', roof: '#495057', roof2: '#343a40', wood: '#8b4513', window: '#fef08a' },
        cinderella: { stone: '#f1f5f9', accent: '#e2e8f0', roof: '#3b82f6', roof2: '#2563eb', wood: '#78350f', window: '#fef08a', gold: '#fbbf24' },
        classic_blue: { stone: '#e2e8f0', accent: '#cbd5e1', roof: '#2563eb', roof2: '#1d4ed8', wood: '#78350f', window: '#fef08a' },
        royal_red: { stone: '#f8fafc', accent: '#e2e8f0', roof: '#dc2626', roof2: '#b91c1c', wood: '#451a03', window: '#fef08a' },
        sunset_pink: { stone: '#ffedd5', accent: '#fed7aa', roof: '#db2777', roof2: '#be185d', wood: '#7c2d12', window: '#fef08a' },
        dark_fantasy: { stone: '#475569', accent: '#334155', roof: '#6b21a8', roof2: '#581c87', wood: '#1e293b', window: '#d946ef' },
        emerald_keep: { stone: '#f1f5f9', accent: '#cbd5e1', roof: '#059669', roof2: '#047857', wood: '#3f2c23', window: '#fef08a' },
        sunflower: { stone: '#fffbeb', accent: '#fef3c7', roof: '#eab308', roof2: '#ca8a04', wood: '#422006', window: '#fef08a' },
        mystic_teal: { stone: '#f0fdfa', accent: '#ccfbf1', roof: '#0d9488', roof2: '#0f766e', wood: '#134e4a', window: '#a7f3d0' },
        gothic: { stone: '#1c1917', accent: '#292524', roof: '#7f1d1d', roof2: '#450a0a', wood: '#000000', window: '#dc2626' }
    };

    constructor(container?: HTMLElement | null) {
        this.container = container || document.createElement('div');
        this.scene = new THREE.Scene();
        this.initMaterials();
        this.scene.add(this.castleGroup);
        this.generate();
    }

    private initScene_OLD() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Light sky blue
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.002);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 3000);
        
        // Push camera further back on narrow screens (mobile)
        if (window.innerWidth < 768) {
            this.camera.position.set(250, 200, 350);
        } else {
            this.camera.position.set(150, 130, 200);
        }

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        // this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        // this.renderer.setSize(window.innerWidth, window.innerHeight);
        // this.renderer.shadowMap.enabled = true;
        // this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        // this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        // this.renderer.toneMappingExposure = 1.0;
        // this.container.appendChild(this.renderer.domElement);

        // this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        // // this.controls.enableDamping = true;
        // // this.controls.dampingFactor = 0.05;
        // // this.controls.target.set(0, 30, 0);
        // this.controls.maxPolarAngle = Math.PI / 2 + 0.1;

        // Beautiful soft lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambient);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
        hemiLight.position.set(0, 200, 0);
        this.scene.add(hemiLight);

        this.dirLight = new THREE.DirectionalLight(0xfff5b6, 1.2);
        this.dirLight.position.set(100, 150, 50);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 4096;
        this.dirLight.shadow.mapSize.height = 4096;
        this.dirLight.shadow.camera.near = 10;
        this.dirLight.shadow.camera.far = 400;
        const d = 120;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.dirLight.shadow.bias = -0.0005;
        this.scene.add(this.dirLight);

        this.warmLight = new THREE.PointLight(0xffedd5, 1.5, 100);
        this.warmLight.position.set(0, 40, 0);
        this.scene.add(this.warmLight);

        const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.5);
        fillLight.position.set(-100, 50, -50);
        this.scene.add(fillLight);
    }
    
        private currentSeed: number = 12345;

    private seedPRNG(seed: number) {
        this.currentSeed = (seed ^ 0xdeadbeef) >>> 0;
    }

    private random(): number {
        let t = (this.currentSeed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    private checkAABBOverlap(
        center: THREE.Vector3,
        halfExtents: THREE.Vector3
    ): boolean {
        const spacing = this.params.safeSpacing || 3.0;
        for (const existing of this.placedBounds) {
            const dx = Math.abs(center.x - existing.center.x);
            const dz = Math.abs(center.z - existing.center.z);
            const overlapX = (halfExtents.x + existing.halfExtents.x + spacing);
            const overlapZ = (halfExtents.z + existing.halfExtents.z + spacing);
            if (dx < overlapX && dz < overlapZ) {
                return true;
            }
        }
        return false;
    }

    private registerBounds(center: THREE.Vector3, halfExtents: THREE.Vector3) {
        this.placedBounds.push({ center: center.clone(), halfExtents: halfExtents.clone() });
    }

    private tryPlaceStructure(
        x: number, z: number, halfW: number, halfD: number, maxAttempts: number = 30
    ): { x: number, z: number } | null {
        const spacing = this.params.safeSpacing || 3.0;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const ox = attempt === 0 ? x : x + (this.random() - 0.5) * spacing * attempt * 0.5;
            const oz = attempt === 0 ? z : z + (this.random() - 0.5) * spacing * attempt * 0.5;
            const center = new THREE.Vector3(ox, 0, oz);
            const half = new THREE.Vector3(halfW, 50, halfD);
            if (!this.checkAABBOverlap(center, half)) {
                this.registerBounds(center, half);
                return { x: ox, z: oz };
            }
        }
        return null;
    }

    private patchAliveWallShader(material: THREE.MeshStandardMaterial) {
        material.userData.shaderTime = this.shaderTime;
        material.onBeforeCompile = (shader) => {
            if (shader.fragmentShader.indexOf('#include <output_fragment>') === -1) return;

            shader.uniforms.uTime = this.shaderTime;
            shader.uniforms.uFauxAO = { value: this.params.glslFauxAO ? 1.0 : 0.0 };
            shader.uniforms.uMagicMoss = { value: this.params.glslMagicMoss ? 1.0 : 0.0 };
            shader.uniforms.uEnergyVeins = { value: this.params.glslEnergyVeins ? 1.0 : 0.0 };
            shader.uniforms.uMossColor = { value: new THREE.Color(this.params.magicMossColor || '#00ff88') };
            shader.uniforms.uVeinColor = { value: new THREE.Color(this.params.energyVeinColor || '#8b5cf6') };
            shader.uniforms.uVeinSpeed = { value: this.params.veinSpeed || 0.5 };
            shader.uniforms.uVeinIntensity = { value: this.params.veinIntensity || 0.3 };

            shader.vertexShader = `
                varying vec3 vWorldPos;
                varying vec3 vWorldNormal;
                ${shader.vertexShader}
            `;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `
                #include <worldpos_vertex>
                vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                `
            );

            shader.fragmentShader = `
                uniform float uTime;
                uniform float uFauxAO;
                uniform float uMagicMoss;
                uniform float uEnergyVeins;
                uniform vec3 uMossColor;
                uniform vec3 uVeinColor;
                uniform float uVeinSpeed;
                uniform float uVeinIntensity;
                varying vec3 vWorldPos;
                varying vec3 vWorldNormal;

                float hash31(vec3 p) {
                    p = fract(p * vec3(443.897, 441.423, 437.195));
                    p += dot(p, p.yzx + 19.19);
                    return fract((p.x + p.y) * p.z);
                }
                float noise3d(vec3 p) {
                    vec3 i = floor(p);
                    vec3 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(
                        mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
                            mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
                        mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                            mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
                        f.z
                    );
                }
                ${shader.fragmentShader}
            `;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `
                #include <dithering_fragment>

                if (uFauxAO > 0.5) {
                    float aoFactor = smoothstep(0.0, 8.0, vWorldPos.y);
                    float crevice = 1.0 - abs(vWorldNormal.y);
                    float ao = mix(0.55, 1.0, aoFactor) * mix(0.7, 1.0, 1.0 - crevice * 0.4);
                    gl_FragColor.rgb *= ao;
                }

                if (uMagicMoss > 0.5) {
                    float mossHeight = smoothstep(12.0, 0.0, vWorldPos.y);
                    float mossNoise = noise3d(vWorldPos * 0.3 + vec3(0.0, uTime * 0.02, 0.0));
                    float mossMask = mossHeight * smoothstep(0.35, 0.65, mossNoise);
                    gl_FragColor.rgb = mix(gl_FragColor.rgb, uMossColor * 0.6, mossMask * 0.45);
                    gl_FragColor.rgb += uMossColor * mossMask * 0.12;
                }

                if (uEnergyVeins > 0.5) {
                    float veinScale = 2.5;
                    float n1 = noise3d(vWorldPos * veinScale + vec3(uTime * uVeinSpeed * 0.3));
                    float n2 = noise3d(vWorldPos * veinScale * 1.7 - vec3(0.0, uTime * uVeinSpeed * 0.2, 0.0));
                    float vein = smoothstep(0.48, 0.52, n1) * smoothstep(0.45, 0.55, n2);
                    float pulse = 0.5 + 0.5 * sin(uTime * uVeinSpeed * 2.0 + vWorldPos.y * 0.5);
                    gl_FragColor.rgb += uVeinColor * vein * pulse * uVeinIntensity;
                }
                `
            );
        };
    }

    private initMaterials() {
        // High quality PBR materials for the stylized look
        this.materials = {
            stone: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0 }),
            stoneAccent: new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.9, metalness: 0.0 }),
            roof: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7, metalness: 0.1, flatShading: true }),
            roofAccent: new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.7, metalness: 0.1, flatShading: true }),
            wood: new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 }),
            windowLit: new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.8 }),
            windowDark: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8 }),
            grass: new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 1.0, flatShading: true }),
            dirt: new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 1.0 }),
            rock: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9, flatShading: true }),
            water: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.8 }),
            flag: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6, side: THREE.DoubleSide }),
            treeLeaf: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.9, flatShading: true }),
            treeTrunk: new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.9 }),
            woodDark: new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 }),
            gold: new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3, metalness: 0.8, flatShading: true }),
            crystal: new THREE.MeshStandardMaterial({ color: 0x818cf8, emissive: 0x4f46e5, emissiveIntensity: 0.5, transparent: true, opacity: 0.8, flatShading: true, roughness: 0.1, metalness: 0.5 }),
            cloud: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, flatShading: true })
        };

        // Apply GLSL alive wall shaders to stone materials
        this.patchAliveWallShader(this.materials.stone);
        this.patchAliveWallShader(this.materials.stoneAccent);
    }

    private rebuildShaders() {
        // Re-patch stone materials with updated params — force material recompile
        this.patchAliveWallShader(this.materials.stone);
        this.patchAliveWallShader(this.materials.stoneAccent);
        this.materials.stone.needsUpdate = true;
        this.materials.stoneAccent.needsUpdate = true;
    }

    private bindEvents_OLD() {}

    private randomizeCastle() {
        this.params.seed = Math.floor(Math.random() * 1000000);
        const pKeys = Object.keys(this.palettes);
        this.params.palette = pKeys[Math.floor(Math.random() * pKeys.length)];
        
        const lKeys = ['concentric', 'linear', 'cluster', 'fairy_tale'];
        this.params.layout = lKeys[Math.floor(Math.random() * lKeys.length)];
        
        const sKeys = ['mixed', 'round', 'square', 'octagonal'];
        this.params.towerShape = sKeys[Math.floor(Math.random() * sKeys.length)];
        
        const rKeys = ['pointed', 'flat', 'domed', 'mixed'];
        this.params.roofShape = rKeys[Math.floor(Math.random() * rKeys.length)];
        
        this.params.floatingOnClouds = Math.random() > 0.3;
        
        this.params.complexity = 5 + Math.floor(Math.random() * 6);
        this.params.keepHeight = 40 + Math.floor(Math.random() * 40);
        this.params.towerHeight = 30 + Math.floor(Math.random() * 50);
        this.params.flaredBases = Math.random() > 0.4;
        this.params.hasCorbels = Math.random() > 0.4;
        this.params.floatingIslands = Math.random() > 0.5;
        this.params.magicCrystals = Math.random() > 0.6;
        this.params.lowPoly = Math.random() > 0.5;

        const styles = ['japanese', 'fairytale', 'european_coastal'];
        this.params.buildingStyle = styles[Math.floor(Math.random() * styles.length)];

        this.params.streetLamps = Math.random() > 0.3;
        
        // this.gui.controllersRecursive().forEach(c => c.updateDisplay());
        this.generate();
    }

    private applyPalette() {
        let stoneColor: string;
        let accentColor: string;
        let roofColor: string;
        let roof2Color: string;
        let woodColor: string;
        let windowColor: string;
        let goldColor: string;
        let crystalColor: string;
        let flagColor: string;
        let bgColor: string;

        if (this.params.useCustomColors) {
            stoneColor = this.params.customWallColor;
            accentColor = this.params.customAccentColor;
            roofColor = this.params.customRoofColor;
            roof2Color = this.params.customRoof2Color;
            woodColor = this.params.customWoodColor;
            windowColor = this.params.customWindowColor;
            goldColor = this.params.customGoldColor;
            crystalColor = this.params.customCrystalColor;
            flagColor = this.params.customFlagColor;
            bgColor = this.params.customBgColor;
        } else {
            const p = this.palettes[this.params.palette] || this.palettes['princess_blossom'];
            stoneColor = p.stone;
            accentColor = p.accent;
            roofColor = p.roof;
            roof2Color = p.roof2;
            woodColor = p.wood;
            windowColor = p.window;
            goldColor = p.gold || '#ffb703';
            crystalColor = p.crystal || '#a855f7';
            flagColor = p.flag || '#ef4444';
            bgColor = p.bg || (this.params.palette === 'dark_fantasy' || this.params.palette === 'gothic' ? '#1e1b4b' : '#fce7f3');

            if (this.params.buildingStyle === 'japanese') {
                stoneColor = '#fdfdfd';
                accentColor = '#2b2b2b';
                roofColor = '#1e293b';
                roof2Color = '#334155';
                woodColor = '#4a3728';
            } else if (this.params.buildingStyle === 'european_coastal') {
                stoneColor = '#fffbeb';
                accentColor = '#f3f4f6';
                roofColor = '#ea580c';
                roof2Color = '#0d9488';
                woodColor = '#854d0e';
            }
        }

        this.materials.stone.color.set(stoneColor);
        this.materials.stoneAccent.color.set(accentColor);
        this.materials.roof.color.set(roofColor);
        this.materials.roofAccent.color.set(roof2Color);
        this.materials.wood.color.set(woodColor);
        this.materials.windowLit.color.set(windowColor);
        this.materials.windowLit.emissive.set(windowColor);
        this.materials.gold.color.set(goldColor);
        
        if (this.materials.crystal) {
            this.materials.crystal.color.set(crystalColor);
            this.materials.crystal.emissive.set(crystalColor);
        }
        if (this.materials.flag) {
            this.materials.flag.color.set(flagColor);
        }
        
        // Apply flat shading based on Low Poly mode
        for (const key in this.materials) {
            if (this.materials[key] instanceof THREE.MeshStandardMaterial) {
                this.materials[key].flatShading = this.params.lowPoly;
                this.materials[key].needsUpdate = true;
            }
        }
        
        this.scene.background = new THREE.Color(bgColor);
        this.scene.fog = new THREE.FogExp2(bgColor, 0.002);
    }

    public generate() {
        this.seedPRNG(this.params.seed || 12345);
        this.scene.remove(this.castleGroup);
        this.castleGroup = new THREE.Group();
        this.scene.add(this.castleGroup);

        this.scene.remove(this.sparkleGroup);
        this.sparkleGroup = new THREE.Group();
        this.scene.add(this.sparkleGroup);

        this.scene.remove(this.auraGroup);
        this.auraGroup = new THREE.Group();
        this.scene.add(this.auraGroup);

        this.applyPalette();

        // Clear tracking lists
        this.streetLampPositions = [];
        this.placedBounds = [];

        // Generate Layout
        const layoutBounds = 45 * (this.params.groundScale || 1.0); // Max radius for castle footprint
        
        if (this.params.floatingOnClouds) {
            this.buildCloudBase(layoutBounds);
        }

        if (this.params.floatingIslands) {
            this.buildFloatingIslands(layoutBounds);
        }

        if (this.params.layout === 'princess_royal') {
            this.buildPrincessRoyalCastle(layoutBounds);
        } else if (this.params.layout === 'enchanted_spires') {
            this.buildEnchantedSpiresCastle(layoutBounds);
        } else if (this.params.layout === 'concentric') {
            this.buildConcentricCastle(layoutBounds);
        } else if (this.params.layout === 'linear') {
            this.buildLinearCastle(layoutBounds);
        } else if (this.params.layout === 'fairy_tale') {
            this.buildFairyTaleCastle(layoutBounds);
        } else {
            this.buildClusterCastle(layoutBounds);
        }

        if (this.params.extraBuildings) {
            this.buildExtraBuildings(layoutBounds);
        }

        if (this.params.hasOuterBaseWall) {
            this.buildOuterBaseWall();
        }

        if (this.params.streetLamps) {
            this.generateStreetLamps();
        }

        if (this.params.magicSparkles) {
            this.buildMagicSparkles(layoutBounds);
        }

        if (this.params.magicAuraRings) {
            this.buildMagicAuraRings(layoutBounds);
        }

        // Apply overall scale at the end
        const s = this.params.overallScale || 1.0;
        this.castleGroup.scale.set(s, s, s);
        this.sparkleGroup.scale.set(s, s, s);
        this.auraGroup.scale.set(s, s, s);
    }

    // --- Core Building Blocks ---

    private createCrenellations(radius: number, thickness: number, height: number, segments: number, isSquare: boolean) {
        const group = new THREE.Group();
        const numMerlons = isSquare ? Math.max(4, Math.floor(radius * 2.5)) : Math.max(8, Math.floor(radius * 3));
        
        if (isSquare) {
            const step = (radius * 2) / (numMerlons / 4);
            const w = step * 0.5;
            for(let i=0; i<4; i++) {
                for(let j=0; j<numMerlons/4; j++) {
                    const m = new THREE.Mesh(new THREE.BoxGeometry(w, height, thickness), this.materials.stone);
                    const offset = -radius + step * j + step/2;
                    if (i===0) m.position.set(offset, height/2, radius);
                    if (i===1) m.position.set(offset, height/2, -radius);
                    if (i===2) { m.position.set(radius, height/2, offset); m.rotation.y = Math.PI/2; }
                    if (i===3) { m.position.set(-radius, height/2, offset); m.rotation.y = Math.PI/2; }
                    m.castShadow = true;
                    group.add(m);
                }
            }
        } else {
            const angleStep = (Math.PI * 2) / numMerlons;
            for (let i = 0; i < numMerlons; i++) {
                const angle = i * angleStep;
                const m = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.4, height, thickness), this.materials.stone);
                m.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
                m.rotation.y = -angle;
                m.castShadow = true;
                group.add(m);
            }
        }
        return group;
    }

    private createLinearCrenellations(length: number, thickness: number, height: number) {
        const group = new THREE.Group();
        const numMerlons = Math.max(2, Math.floor(length / 3.5));
        const step = length / numMerlons;
        const merlonW = step * 0.5;

        for (let i = 0; i < numMerlons; i++) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(merlonW, height, thickness), this.materials.stone);
            const x = -length / 2 + step * i + step / 2;
            m.position.set(x, height / 2, 0);
            m.castShadow = true;
            group.add(m);
        }
        return group;
    }

    private createCorbels(radius: number, count: number, isSquare: boolean) {
        const group = new THREE.Group();
        if (!this.params.hasCorbels) return group;

        if (isSquare) {
            const cPerSide = Math.max(2, Math.floor(count / 4));
            const step = (radius * 2) / cPerSide;
            const geom = new THREE.BoxGeometry(0.4, 0.8, 0.6);
            for(let i=0; i<4; i++) {
                for(let j=0; j<=cPerSide; j++) {
                    const m = new THREE.Mesh(geom, this.materials.stoneAccent);
                    const offset = -radius + step * j;
                    if (i===0) m.position.set(offset, -0.4, radius - 0.2);
                    if (i===1) m.position.set(offset, -0.4, -radius + 0.2);
                    if (i===2) { m.position.set(radius - 0.2, -0.4, offset); m.rotation.y = Math.PI/2; }
                    if (i===3) { m.position.set(-radius + 0.2, -0.4, offset); m.rotation.y = Math.PI/2; }
                    m.castShadow = true;
                    group.add(m);
                }
            }
        } else {
            const angleStep = (Math.PI * 2) / count;
            const geom = new THREE.BoxGeometry(0.4, 0.8, 0.6);
            for (let i = 0; i < count; i++) {
                const angle = i * angleStep;
                const m = new THREE.Mesh(geom, this.materials.stoneAccent);
                m.position.set(Math.cos(angle) * (radius - 0.3), -0.4, Math.sin(angle) * (radius - 0.3));
                m.rotation.y = -angle;
                m.castShadow = true;
                group.add(m);
            }
        }
        return group;
    }

    private createDetailedWindow(isLit: boolean) {
        const group = new THREE.Group();
        
        // Window Hole/Glass
        const shape = new THREE.Shape();
        shape.moveTo(-0.5, 0);
        shape.lineTo(0.5, 0);
        shape.lineTo(0.5, 1.0);
        shape.absarc(0, 1.0, 0.5, 0, Math.PI, false);
        shape.lineTo(-0.5, 0);
        
        const extrudeSettings = { depth: 0.1, bevelEnabled: false, curveSegments: this.params.lowPoly ? 2 : 12 };
        const glassGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        glassGeom.center();
        const glassMat = isLit ? this.materials.windowLit : this.materials.windowDark;
        const glass = new THREE.Mesh(glassGeom, glassMat);
        group.add(glass);

        // Frame
        const frameShape = new THREE.Shape();
        frameShape.moveTo(-0.6, -0.1);
        frameShape.lineTo(0.6, -0.1);
        frameShape.lineTo(0.6, 1.0);
        frameShape.absarc(0, 1.0, 0.6, 0, Math.PI, false);
        frameShape.lineTo(-0.6, -0.1);
        
        const frameHole = new THREE.Path();
        frameHole.moveTo(-0.5, 0);
        frameHole.lineTo(0.5, 0);
        frameHole.lineTo(0.5, 1.0);
        frameHole.absarc(0, 1.0, 0.5, 0, Math.PI, false);
        frameHole.lineTo(-0.5, 0);
        frameShape.holes.push(frameHole);

        const frameGeom = new THREE.ExtrudeGeometry(frameShape, { depth: 0.2, bevelEnabled: false, curveSegments: this.params.lowPoly ? 2 : 12 });
        frameGeom.center();
        const frame = new THREE.Mesh(frameGeom, this.materials.stoneAccent);
        frame.position.z = 0.05;
        group.add(frame);

        // Mullions (Crossbars)
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.15), this.materials.woodDark);
        crossH.position.set(0, 0, 0.1);
        group.add(crossH);
        
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.15), this.materials.woodDark);
        crossV.position.set(0, 0, 0.1);
        group.add(crossV);

        return group;
    }

    private createBalcony() {
        const group = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 1.5), this.materials.stoneAccent);
        base.position.set(0, 0, 0.75);
        base.receiveShadow = true;
        group.add(base);

        const corbel1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 1.0), this.materials.stoneAccent);
        corbel1.position.set(-1.0, -0.5, 0.5);
        group.add(corbel1);
        const corbel2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 1.0), this.materials.stoneAccent);
        corbel2.position.set(1.0, -0.5, 0.5);
        group.add(corbel2);

        // Railing
        const rail = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 0.2), this.materials.woodDark);
        rail.position.set(0, 1.0, 1.4);
        group.add(rail);
        const railL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.5), this.materials.woodDark);
        railL.position.set(-1.4, 1.0, 0.75);
        group.add(railL);
        const railR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.5), this.materials.woodDark);
        railR.position.set(1.4, 1.0, 0.75);
        group.add(railR);

        for (let i = 0; i < 5; i++) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), this.materials.woodDark);
            post.position.set(-1.4 + i * 0.7, 0.5, 1.4);
            group.add(post);
        }

        return group;
    }

    private createDormerWindow() {
        const group = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 2.0), this.materials.stone);
        base.position.set(0, 0.75, 1.0);
        group.add(base);

        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.5, 4), this.materials.roofAccent);
        roof.position.set(0, 2.25, 1.0);
        roof.rotation.y = Math.PI / 4;
        group.add(roof);

        const win = this.createDetailedWindow(this.random() > 0.3);
        win.scale.set(0.6, 0.6, 0.6);
        win.position.set(0, 0.75, 2.0);
        group.add(win);

        return group;
    }

    private createShojiWindow(isLit: boolean) {
        const group = new THREE.Group();
        
        // Shoji frame (dark wood)
        const frameW = 2.4;
        const frameH = 2.4;
        const outerFrame = new THREE.Mesh(new THREE.BoxGeometry(frameW, frameH, 0.15), this.materials.woodDark);
        outerFrame.castShadow = true;
        group.add(outerFrame);

        // Shoji paper panes (warm translucent cream / glowing yellow if lit)
        const paperMat = isLit ? this.materials.windowLit : this.materials.windowUnlit;
        const paperMesh = new THREE.Mesh(new THREE.BoxGeometry(frameW - 0.25, frameH - 0.25, 0.05), paperMat);
        paperMesh.position.z = 0.02;
        group.add(paperMesh);

        // Wooden lattice grids Kumiko (horizontal and vertical thin bars)
        const latticeMat = this.materials.woodDark;
        const barThickness = 0.06;
        
        // Vertical center bars
        const numV = 3;
        for (let i = 0; i < numV; i++) {
            const xOffset = (frameW - 0.4) * (i / (numV - 1) - 0.5);
            const vBar = new THREE.Mesh(new THREE.BoxGeometry(barThickness, frameH - 0.25, 0.08), latticeMat);
            vBar.position.set(xOffset, 0, 0.035);
            vBar.castShadow = true;
            group.add(vBar);
        }

        // Horizontal bars
        const numH = 4;
        for (let i = 0; i < numH; i++) {
            const yOffset = (frameH - 0.4) * (i / (numH - 1) - 0.5);
            const hBar = new THREE.Mesh(new THREE.BoxGeometry(frameW - 0.25, barThickness, 0.08), latticeMat);
            hBar.position.set(0, yOffset, 0.035);
            hBar.castShadow = true;
            group.add(hBar);
        }

        return group;
    }

    private createJapaneseBalcony(w: number, d: number) {
        const group = new THREE.Group();

        // Floor slab
        const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), this.materials.woodDark);
        floor.castShadow = true;
        floor.receiveShadow = true;
        group.add(floor);

        // Corner posts for railing
        const postH = 1.3;
        const postW = 0.15;
        const railingColor = this.materials.woodDark;

        const corners = [
            [-w/2 + postW/2, -d/2 + postW/2],
            [w/2 - postW/2, -d/2 + postW/2],
            [-w/2 + postW/2, d/2 - postW/2],
            [w/2 - postW/2, d/2 - postW/2]
        ];

        corners.forEach(([cx, cz]) => {
            const post = new THREE.Mesh(new THREE.BoxGeometry(postW, postH, postW), railingColor);
            post.position.set(cx, postH / 2, cz);
            post.castShadow = true;
            group.add(post);
        });

        // Top rails (girders) connecting corner posts
        const topRailH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.1), railingColor);
        topRailH.position.set(0, postH - 0.05, d/2 - postW/2);
        topRailH.castShadow = true;
        group.add(topRailH);

        const topRailBack = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.1), railingColor);
        topRailBack.position.set(0, postH - 0.05, -d/2 + postW/2);
        topRailBack.castShadow = true;
        group.add(topRailBack);

        const topRailL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, d), railingColor);
        topRailL.position.set(-w/2 + postW/2, postH - 0.05, 0);
        topRailL.castShadow = true;
        group.add(topRailL);

        const topRailR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, d), railingColor);
        topRailR.position.set(w/2 - postW/2, postH - 0.05, 0);
        topRailR.castShadow = true;
        group.add(topRailR);

        // Vertical balusters lattice
        const balusterW = 0.05;
        const balusterCount = 6;
        for (let i = 1; i < balusterCount; i++) {
            const bx = w * (i / balusterCount - 0.5);
            const bFront = new THREE.Mesh(new THREE.BoxGeometry(balusterW, postH - 0.2, balusterW), railingColor);
            bFront.position.set(bx, postH/2, d/2 - postW/2);
            bFront.castShadow = true;
            group.add(bFront);

            const bBack = new THREE.Mesh(new THREE.BoxGeometry(balusterW, postH - 0.2, balusterW), railingColor);
            bBack.position.set(bx, postH/2, -d/2 + postW/2);
            bBack.castShadow = true;
            group.add(bBack);
        }

        return group;
    }

    private buildJapanesePagoda(x: number, y: number, z: number, radius: number, baseHeight: number) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        const height = baseHeight * (this.params.towerHeight / 45);
        const tiers = this.params.complexity > 6 ? 5 : 3;
        const tierHeight = height / tiers;

        const plasterColor = 0xfdfdfd;
        const plasterMat = new THREE.MeshStandardMaterial({
            color: plasterColor,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: this.params.lowPoly
        });

        let currentW = radius * 2.5;
        for (let t = 0; t < tiers; t++) {
            const ty = t * tierHeight;
            const tW = currentW * Math.pow(0.85, t);
            const tD = tW;

            // Body
            const tBody = new THREE.Mesh(new THREE.BoxGeometry(tW, tierHeight, tD), plasterMat);
            tBody.position.y = ty + tierHeight/2;
            tBody.castShadow = true;
            tBody.receiveShadow = true;
            group.add(tBody);

            // Dark wood corner trims
            const trimSize = 0.35;
            const dLocal = tD; // Avoid reference to external d
            const cornersLoc = [
                [-tW/2, -dLocal/2], [tW/2, -dLocal/2], [-tW/2, dLocal/2], [tW/2, dLocal/2]
            ];
            cornersLoc.forEach(([tx, tz]) => {
                const trim = new THREE.Mesh(new THREE.BoxGeometry(trimSize, tierHeight, trimSize), this.materials.woodDark);
                trim.position.set(tx, ty + tierHeight/2, tz);
                group.add(trim);
            });

            // Small sliding shoji window on each face
            for (let f = 0; f < 4; f++) {
                const win = this.createShojiWindow(this.random() > 0.3);
                win.scale.set(0.6, 0.6, 0.6);
                if (f === 0) win.position.set(0, ty + tierHeight/2, tD/2 + 0.05);
                else if (f === 1) { win.position.set(tW/2 + 0.05, ty + tierHeight/2, 0); win.rotation.y = Math.PI/2; }
                else if (f === 2) { win.position.set(0, ty + tierHeight/2, -tD/2 - 0.05); win.rotation.y = Math.PI; }
                else if (f === 3) { win.position.set(-tW/2 - 0.05, ty + tierHeight/2, 0); win.rotation.y = -Math.PI/2; }
                group.add(win);
            }

            // Balcony railing
            const bal = this.createJapaneseBalcony(tW + 0.8, tD + 0.8);
            bal.position.y = ty + 0.2;
            group.add(bal);

            // Curved roof for this tier
            const rH = tW * 0.45;
            const rShape = new THREE.Shape();
            const rw = tW/2 + 1.5;
            rShape.moveTo(-rw, 0);
            rShape.quadraticCurveTo(-rw * 0.7, rH * 0.15, 0, rH);
            rShape.quadraticCurveTo(rw * 0.7, rH * 0.15, rw, 0);
            rShape.lineTo(rw, -0.4);
            rShape.lineTo(-rw, -0.4);
            rShape.lineTo(-rw, 0);

            const rGeom = new THREE.ExtrudeGeometry(rShape, { depth: tD + 3.0, bevelEnabled: false });
            rGeom.center();
            const tRoof = new THREE.Mesh(rGeom, this.materials.roof);
            tRoof.position.set(0, ty + tierHeight, 0);
            tRoof.rotation.y = Math.PI/2;
            tRoof.castShadow = true;
            group.add(tRoof);
        }

        // Spire (Sorin)
        const topY = tiers * tierHeight;
        const spirePole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 6, 8), this.materials.gold);
        spirePole.position.y = topY + 3;
        spirePole.castShadow = true;
        group.add(spirePole);

        for (let r = 0; r < 9; r++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6 - r*0.04, 0.12, 8, 12), this.materials.gold);
            ring.rotation.x = Math.PI/2;
            ring.position.y = topY + 1.5 + r * 0.35;
            ring.castShadow = true;
            group.add(ring);
        }

        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), this.materials.gold);
        flame.scale.y = 2.0;
        flame.position.y = topY + 5.5;
        group.add(flame);

        return group;
    }

    private buildTower(x: number, y: number, z: number, radius: number, baseHeight: number, shapeOverride?: string, roofMatOverride?: THREE.Material) {
        if (this.params.buildingStyle === 'japanese' && shapeOverride !== 'round') {
            return this.buildJapanesePagoda(x, y, z, radius, baseHeight);
        }

        const group = new THREE.Group();
        group.position.set(x, y, z);

        // Apply fairytale pinch: slender XZ, stretched Y
        const pinch = this.params.fairytalePinch || 1.0;
        const effectiveRadius = radius * pinch;
        radius = effectiveRadius;

        const height = baseHeight * (this.params.towerHeight / 45) * (1.0 + (1.0 - pinch) * 1.2);

        let shapeStr = shapeOverride || this.params.towerShape;
        if (shapeStr === 'mixed') {
            const roll = this.random();
            shapeStr = roll < 0.4 ? 'round' : roll < 0.8 ? 'square' : 'octagonal';
        }

        const segments = shapeStr === 'square' ? 4 : shapeStr === 'octagonal' ? 8 : (this.params.lowPoly ? 6 : 16);
        const isSquare = shapeStr === 'square';

        // Body
        const baseRadius = this.params.flaredBases ? radius * 1.3 : radius;
        const bodyGeom = new THREE.CylinderGeometry(radius, baseRadius, height, segments);
        const body = new THREE.Mesh(bodyGeom, this.materials.stone);
        body.position.y = height / 2;
        if (isSquare) body.rotation.y = Math.PI / 4;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // Top Rim (Machicolations lip)
        const rimRadius = radius * 1.15;
        const rimGeom = new THREE.CylinderGeometry(rimRadius, radius, 1.0, segments);
        const rim = new THREE.Mesh(rimGeom, this.materials.stoneAccent);
        rim.position.y = height + 0.5;
        if (isSquare) rim.rotation.y = Math.PI / 4;
        rim.castShadow = true;
        group.add(rim);

        // Corbels (scalloped or boxy)
        const corbelCount = segments === 4 ? 16 : 16;
        const corbels = this.params.scallopedCorbels
            ? this.createScallopedCorbels(rimRadius, corbelCount, isSquare)
            : this.createCorbels(rimRadius, corbelCount, isSquare);
        corbels.position.y = height + 0.5;
        group.add(corbels);

        let topY = height + 1.0;

        // Roof or Crenellations
        let roofStyle = this.params.roofShape;
        if (roofStyle === 'mixed') {
            roofStyle = this.random() < 0.3 ? 'flat' : 'pointed';
        }

        if (roofStyle === 'flat' || (radius > 3 && this.random() < 0.1)) {
            // Flat with crenellations
            const cren = this.createCrenellations(rimRadius * (isSquare ? 0.7 : 0.95), 0.6, 1.5, segments, isSquare);
            cren.position.y = topY;
            group.add(cren);
        } else {
            const isDome = roofStyle === 'domed' || (this.random() > 0.8 && shapeStr === 'round');
            const roofH = radius * (1.8 + this.random() * 1.5);
            const roofMat = roofMatOverride || (this.random() > 0.5 ? this.materials.roof : this.materials.roofAccent);
            const rSegments = shapeStr === 'round' ? (this.params.lowPoly ? 6 : 16) : segments;

            if (this.params.bellCurveRoofs && shapeStr === 'round') {
                const bellRoof = this.createBellCurveRoof(rimRadius * 2.1);
                bellRoof.position.y = topY;
                group.add(bellRoof);
                topY += rimRadius * 3.0;
            } else if (roofStyle === 'onion_dome') {
                const domeR = rimRadius * 1.05;
                const domeGeom = new THREE.SphereGeometry(domeR, rSegments, rSegments, 0, Math.PI * 2, 0, Math.PI * 0.65);
                const dome = new THREE.Mesh(domeGeom, roofMat);
                dome.position.y = topY + domeR * 0.5;
                dome.castShadow = true;
                group.add(dome);

                const tipH = domeR * 1.8;
                const tipGeom = new THREE.ConeGeometry(domeR * 0.45, tipH, rSegments);
                const tip = new THREE.Mesh(tipGeom, roofMat);
                tip.position.y = topY + domeR * 0.8 + tipH / 2;
                tip.castShadow = true;
                group.add(tip);

                const finial = this.createTiaraFinial(Math.max(0.6, rimRadius * 0.35));
                finial.position.set(0, topY + domeR * 0.8 + tipH + 0.5, 0);
                group.add(finial);
            } else if (roofStyle === 'fairytale_spire') {
                const spireH = roofH * 2.8;
                const spireGeom = new THREE.ConeGeometry(rimRadius * 1.05, spireH, rSegments);
                const spire = new THREE.Mesh(spireGeom, roofMat);
                spire.position.y = topY + spireH / 2;
                spire.castShadow = true;
                group.add(spire);

                const finial = this.createTiaraFinial(Math.max(0.6, rimRadius * 0.35));
                finial.position.set(0, topY + spireH + 0.5, 0);
                group.add(finial);
            } else if (isDome) {
                const roofGeom = new THREE.SphereGeometry(rimRadius * 1.05, rSegments, this.params.lowPoly ? 6 : 12, 0, Math.PI * 2, 0, Math.PI / 2);
                const roof = new THREE.Mesh(roofGeom, roofMat);
                roof.position.y = topY;
                roof.castShadow = true;
                group.add(roof);

                const finial = this.createTiaraFinial(Math.max(0.5, rimRadius * 0.3));
                finial.position.set(0, topY + rimRadius * 1.05 + 0.5, 0);
                group.add(finial);
            } else {
                const roofGeom = new THREE.ConeGeometry(rimRadius * 1.05, roofH, rSegments);
                const roof = new THREE.Mesh(roofGeom, roofMat);
                roof.position.y = topY + roofH / 2;
                if (shapeStr === 'square' || shapeStr === 'octagonal') roof.rotation.y = Math.PI / segments;
                roof.castShadow = true;
                group.add(roof);

                const finial = this.createTiaraFinial(Math.max(0.5, rimRadius * 0.3));
                finial.position.set(0, topY + roofH + 0.5, 0);
                group.add(finial);
            }

            topY += isDome ? rimRadius * 1.05 : roofH;

            // Flag
            if (this.random() > 0.4) {
                const flagGeom = new THREE.PlaneGeometry(2.0, 1.0);
                flagGeom.translate(1.0, 0, 0);
                const flag = new THREE.Mesh(flagGeom, this.materials.flag);
                flag.position.set(0, topY + 1.5, 0);
                flag.rotation.y = this.random() * Math.PI;
                group.add(flag);
                
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, this.params.lowPoly ? 3 : 8), this.materials.wood);
                pole.position.set(0, topY + 1.5, 0);
                group.add(pole);
            }
        }

        // Small scatter windows (lancet or standard)
        const numSmallWindows = Math.floor(height / 6);
        for (let i = 0; i < numSmallWindows; i++) {
            const wy = 5 + this.random() * (height - 10);
            const angle = this.random() * Math.PI * 2;
            let currentRadius = radius;
            if (this.params.flaredBases) {
                currentRadius = baseRadius - (baseRadius - radius) * (wy / height);
            }
            const d = currentRadius * 0.95;

            const win = this.params.lancetWindows
                ? this.createLancetWindow(this.random() > 0.3)
                : this.createDetailedWindow(this.random() > 0.3);
            win.scale.set(0.3, 0.3, 0.3);
            win.position.set(Math.cos(angle) * d, wy, Math.sin(angle) * d);
            win.rotation.y = -angle + Math.PI / 2;
            group.add(win);
        }

        // Windows and Balconies
        const numWindows = Math.floor(height / 12);
        for (let i = 0; i < numWindows; i++) {
            if (this.random() > 0.6) continue;
            const wy = 8 + i * 12;
            const isLit = this.random() > 0.3;
            const win = this.params.lancetWindows
                ? this.createLancetWindow(isLit)
                : this.createDetailedWindow(isLit);

            // Snap to face normal for clean alignment
            const faceIdx = Math.floor(this.random() * segments);
            const angle = (faceIdx * (Math.PI * 2)) / segments;
            let currentRadius = radius;
            if (this.params.flaredBases) {
                currentRadius = baseRadius - (baseRadius - radius) * (wy / height);
            }
            const d = currentRadius * 0.98;

            win.position.set(Math.cos(angle) * d, wy, Math.sin(angle) * d);
            win.rotation.y = -angle + Math.PI / 2;
            group.add(win);

            // Occasional Balcony
            if (radius > 3 && this.random() > 0.8 && wy > 10) {
                const balcony = this.createBalcony();
                balcony.position.set(Math.cos(angle) * d, wy - 0.6, Math.sin(angle) * d);
                balcony.rotation.y = -angle + Math.PI / 2;
                group.add(balcony);
            }
        }

        return group;
    }

    private buildHouse(x: number, y: number, z: number, angle: number, scale: number = 1) {
        if (this.params.buildingStyle === 'japanese') {
            return this.buildJapaneseHouse(x, y, z, angle, scale);
        } else if (this.params.buildingStyle === 'european_coastal') {
            return this.buildEuropeanCoastalHouse(x, y, z, angle, scale);
        } else {
            return this.buildFairytaleHouse(x, y, z, angle, scale);
        }
    }

    private getWarmPastelColor(): THREE.Color {
        if (this.params.useCustomColors) {
            return new THREE.Color(this.params.customWallColor);
        }
        return this.materials.stone.color;
    }

    private getContrastingRoofColor(): THREE.Color {
        if (this.params.useCustomColors) {
            return new THREE.Color(this.params.customRoofColor);
        }
        return this.materials.roof.color;
    }

    private buildJapaneseHouse(x: number, y: number, z: number, angle: number, scale: number = 1) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = angle;
        group.scale.setScalar(scale);

        const w = 7 + this.random() * 3;
        const d = 6 + this.random() * 2;
        const h = 5 + this.random() * 2;

        const plasterColor = 0xfcfbf7;
        const plasterMat = new THREE.MeshStandardMaterial({
            color: plasterColor,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: this.params.lowPoly
        });

        // Base plaster wall
        const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), plasterMat);
        base.position.y = h / 2;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        // Corner dark wooden beams/columns
        const frameW = 0.35;
        const corners = [
            [-w/2 + frameW/2, -d/2 + frameW/2],
            [w/2 - frameW/2, -d/2 + frameW/2],
            [-w/2 + frameW/2, d/2 - frameW/2],
            [w/2 - frameW/2, d/2 - frameW/2]
        ];
        corners.forEach(([cx, cz]) => {
            const column = new THREE.Mesh(new THREE.BoxGeometry(frameW, h, frameW), this.materials.woodDark);
            column.position.set(cx, h / 2, cz);
            column.castShadow = true;
            group.add(column);
        });

        // Horizontal wooden beam trims along top and bottom
        const hBeamTop = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, frameW, d + 0.1), this.materials.woodDark);
        hBeamTop.position.y = h - frameW / 2;
        group.add(hBeamTop);

        const hBeamBottom = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, frameW, d + 0.1), this.materials.woodDark);
        hBeamBottom.position.y = frameW / 2;
        group.add(hBeamBottom);

        // Sliding Shoji doors/windows on the front facade
        const shoji = this.createShojiWindow(this.random() > 0.3);
        shoji.scale.set(0.9, 0.9, 0.9);
        shoji.position.set(0, 1.0, d/2 + 0.05);
        group.add(shoji);

        // A second smaller sliding shoji window on the side
        if (this.random() > 0.4) {
            const sideShoji = this.createShojiWindow(this.random() > 0.3);
            sideShoji.scale.set(0.65, 0.65, 0.65);
            sideShoji.position.set(w/2 + 0.05, h/2, 0);
            sideShoji.rotation.y = Math.PI / 2;
            group.add(sideShoji);
        }

        // Curved Japanese tiled roof (Kawara) with upturned flared eaves
        const rH = 3.2 + this.random() * 1.2;
        const shape = new THREE.Shape();
        const rw = w/2 + 1.2; // deep eaves overhang!
        shape.moveTo(-rw, 0);
        shape.quadraticCurveTo(-rw * 0.75, rH * 0.15, 0, rH);
        shape.quadraticCurveTo(rw * 0.75, rH * 0.15, rw, 0);
        shape.lineTo(rw, -0.4);
        shape.lineTo(-rw, -0.4);
        shape.lineTo(-rw, 0);

        const rd = d + 1.8; // deep eaves overhang!
        const extrudeSettings = { depth: rd, bevelEnabled: false };
        const roofGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        roofGeom.center();

        const roof = new THREE.Mesh(roofGeom, this.materials.roof);
        roof.position.y = h + rH/2;
        roof.castShadow = true;
        group.add(roof);

        // Exposed wood rafters (crossbeams) under the roof
        for (let i = -3; i <= 3; i++) {
            const rafter = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.12, 0.2), this.materials.woodDark);
            rafter.position.set(0, h - 0.1, (rd / 6) * i);
            group.add(rafter);
        }

        // Hanging Japanese red paper lantern (Chochin)
        const lantern = new THREE.Group();
        const string = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 4), this.materials.woodDark);
        string.position.y = 1.2;
        lantern.add(string);
        
        const lBody = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.9, 6), new THREE.MeshStandardMaterial({
            color: 0xef4444, // vibrant red paper
            emissive: 0xf97316, // warm glow
            emissiveIntensity: 0.6,
            roughness: 0.9
        }));
        lBody.position.y = 0.5;
        lantern.add(lBody);
        
        const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 6), this.materials.gold);
        capTop.position.y = 0.95;
        lantern.add(capTop);
        const capBot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 6), this.materials.gold);
        capBot.position.y = 0.05;
        lantern.add(capBot);
        
        lantern.scale.setScalar(0.7);
        lantern.position.set(w/2 - 1.2, h - 0.6, d/2 + 0.6);
        group.add(lantern);

        return group;
    }

    private buildEuropeanCoastalHouse(x: number, y: number, z: number, angle: number, scale: number = 1) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = angle;
        group.scale.setScalar(scale);

        // Multi-story rectangular buildings (10 to 18 meters tall)
        const w = 8 + this.random() * 3;
        const d = 8 + this.random() * 3;
        const h = 10 + this.random() * 6; // height between 10 to 16

        // Wall material: Vibrant, warm pastel hex codes
        const stuccoColor = this.getWarmPastelColor();
        const stuccoMat = new THREE.MeshStandardMaterial({
            color: stuccoColor,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: this.params.lowPoly
        });

        // Main building block
        const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stuccoMat);
        base.position.y = h/2;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        // Horizontal plaster trims separating stories
        const stories = Math.floor(h / 4);
        for (let i = 1; i < stories; i++) {
            const trimY = (h / stories) * i;
            const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.25, d + 0.2), this.materials.stoneAccent);
            trim.position.y = trimY;
            trim.castShadow = true;
            group.add(trim);
        }

        // Roof: Steeply pitched roofs (triangular prisms)
        const rH = 5 + this.random() * 3;
        const shape = new THREE.Shape();
        const rw = w/2 + 0.6; // slight overhang
        shape.moveTo(-rw, 0);
        shape.lineTo(rw, 0);
        shape.lineTo(0, rH);
        shape.lineTo(-rw, 0);

        const rd = d + 0.8; // slight overhang
        const extrudeSettings = { depth: rd, bevelEnabled: false };
        const roofGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        roofGeom.center();

        const roofColor = this.getContrastingRoofColor();
        const roofMat = new THREE.MeshStandardMaterial({
            color: roofColor,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: this.params.lowPoly
        });

        const roof = new THREE.Mesh(roofGeom, roofMat);
        roof.position.y = h + rH/2;
        roof.castShadow = true;
        group.add(roof);

        // Procedurally scatter small dormer windows protruding from the pitched roofs
        const numDormers = this.random() > 0.4 ? 1 + Math.floor(this.random() * 2) : 0;
        for (let i = 0; i < numDormers; i++) {
            const dormer = this.createDormerWindow();
            dormer.scale.setScalar(0.75);
            dormer.children.forEach(c => {
                if (c instanceof THREE.Mesh && c.geometry instanceof THREE.ConeGeometry) {
                    c.material = roofMat;
                }
            });
            const dormerZ = (rd / (numDormers + 1)) * (i + 1) - rd/2;
            dormer.position.set(rw * 0.4, h - 0.2, dormerZ);
            dormer.rotation.y = -Math.PI/2;
            group.add(dormer);
        }

        // Add 1 to 3 tall chimneys per roof
        const numChimneys = 1 + Math.floor(this.random() * 2);
        for (let i = 0; i < numChimneys; i++) {
            const chimW = 0.8 + this.random() * 0.4;
            const chimH = 2.5 + this.random() * 2.0;
            const chim = new THREE.Mesh(new THREE.BoxGeometry(chimW, chimH, chimW), stuccoMat);
            
            const offsetZ = (rd * 0.3) * (i - (numChimneys-1)/2);
            chim.position.set(-rw * 0.4, h + rH * 0.6, offsetZ);
            chim.castShadow = true;
            group.add(chim);

            const cap = new THREE.Mesh(new THREE.BoxGeometry(chimW + 0.15, 0.25, chimW + 0.15), this.materials.stoneAccent);
            cap.position.set(chim.position.x, chim.position.y + chimH/2 + 0.1, chim.position.z);
            cap.castShadow = true;
            group.add(cap);
        }

        // Windows procedurally on each story
        for (let s = 0; s < stories; s++) {
            const storyY = (h / stories) * s + (h / stories) / 2;
            
            if (s > 0) {
                const w1 = this.createDetailedWindow(this.random() > 0.3);
                w1.scale.set(0.65, 0.65, 0.65);
                w1.position.set(-w * 0.22, storyY, d/2 + 0.05);
                group.add(w1);

                const w2 = this.createDetailedWindow(this.random() > 0.3);
                w2.scale.set(0.65, 0.65, 0.65);
                w2.position.set(w * 0.22, storyY, d/2 + 0.05);
                group.add(w2);
            } else {
                const door = this.createDetailedWindow(false);
                door.scale.set(0.8, 1.2, 1);
                door.position.set(0, 1.2, d/2 + 0.05);
                group.add(door);
            }

            if (this.random() > 0.5) {
                const sideWin = this.createDetailedWindow(this.random() > 0.3);
                sideWin.scale.set(0.55, 0.55, 0.55);
                sideWin.position.set(w/2 + 0.05, storyY, 0);
                sideWin.rotation.y = Math.PI / 2;
                group.add(sideWin);
            }
        }

        return group;
    }

    private buildFairytaleHouse(x: number, y: number, z: number, angle: number, scale: number = 1) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = angle;
        group.scale.setScalar(scale);

        const w = 6 + this.random() * 4;
        const d = 5 + this.random() * 3;
        const h = 5 + this.random() * 4;

        // Base
        const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.materials.stone);
        base.position.y = h/2;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        let topY = h;

        // Second story
        const hasSecondStory = this.random() > 0.3;
        if (hasSecondStory) {
            const h2 = 4 + this.random() * 3;
            const story2 = new THREE.Mesh(new THREE.BoxGeometry(w + 1.0, h2, d + 1.0), this.materials.stoneAccent);
            story2.position.y = h + h2/2;
            story2.castShadow = true;
            group.add(story2);

            // Wood supports
            const sup = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.3, d + 1.2), this.materials.woodDark);
            sup.position.y = h;
            group.add(sup);
            
            topY += h2;
            
            // Second story window
            const win = this.createDetailedWindow(this.random() > 0.2);
            win.scale.set(0.7, 0.7, 0.7);
            win.position.set(0, h + h2/2, d/2 + 0.51);
            group.add(win);
        } else {
            const win = this.createDetailedWindow(this.random() > 0.2);
            win.scale.set(0.7, 0.7, 0.7);
            win.position.set(0, h/2, d/2 + 0.01);
            group.add(win);
        }

        // Gable roof
        const rH = 4 + this.random() * 3;
        const shape = new THREE.Shape();
        const rw = w/2 + (hasSecondStory ? 0.8 : 0.3);
        shape.moveTo(-rw, 0);
        shape.lineTo(rw, 0);
        shape.lineTo(0, rH);
        shape.lineTo(-rw, 0);
        
        const rd = d + (hasSecondStory ? 1.4 : 0.6);
        const extrudeSettings = { depth: rd, bevelEnabled: false };
        const roofGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        roofGeom.center();
        
        const roofMat = this.random() > 0.5 ? this.materials.roof : this.materials.roofAccent;
        const roof = new THREE.Mesh(roofGeom, roofMat);
        roof.position.y = topY + rH/2;
        roof.castShadow = true;
        group.add(roof);
        
        if (this.params.layout === 'fairy_tale') {
            const finial1 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.5, this.params.lowPoly ? 4 : 8), this.materials.gold);
            finial1.position.set(0, topY + rH + 0.8, rd/2 - 0.2);
            group.add(finial1);
            
            const finial2 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.5, this.params.lowPoly ? 4 : 8), this.materials.gold);
            finial2.position.set(0, topY + rH + 0.8, -rd/2 + 0.2);
            group.add(finial2);
        }
        
        // Chimney
        if (this.random() > 0.5) {
            const chim = new THREE.Mesh(new THREE.BoxGeometry(1.2, rH + 2, 1.2), this.materials.stoneAccent);
            chim.position.set(w/3 - 0.5, topY + rH/2, 0);
            chim.castShadow = true;
            group.add(chim);
        }
        
        // Door
        const door = this.createDetailedWindow(false);
        door.scale.set(0.8, 1.2, 1);
        door.position.set(0, 1.2, d/2 + 0.01);
        group.add(door);

        return group;
    }

    private buildWall(p1: THREE.Vector3, p2: THREE.Vector3, height: number, thickness: number) {
        const group = new THREE.Group();
        const dist = p1.distanceTo(p2);
        const center = p1.clone().lerp(p2, 0.5);
        const angle = Math.atan2(p2.z - p1.z, p2.x - p1.x);

        const baseThickness = this.params.flaredBases ? thickness * 1.5 : thickness;

        // Main wall body
        const bodyGeom = new THREE.BoxGeometry(dist, height, thickness);
        const body = new THREE.Mesh(bodyGeom, this.materials.stone);
        body.position.set(center.x, center.y + height/2, center.z);
        body.rotation.y = -angle;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        
        // Buttresses
        if (this.random() > 0.3) {
            const numButtresses = Math.floor(dist / 8);
            const step = dist / numButtresses;
            const bGeom = new THREE.BoxGeometry(1.5, height * 0.8, thickness + 1.5);
            for(let i=1; i<numButtresses; i++) {
                const bx = -dist/2 + i*step;
                const b = new THREE.Mesh(bGeom, this.materials.stoneAccent);
                const localPos = new THREE.Vector3(bx, height*0.4, 0);
                localPos.applyAxisAngle(new THREE.Vector3(0,1,0), -angle).add(center);
                b.position.copy(localPos);
                b.rotation.y = -angle;
                b.castShadow = true;
                group.add(b);
            }
        }

        // Flared base
        if (this.params.flaredBases) {
            const baseBox = new THREE.Mesh(new THREE.BoxGeometry(dist, 4, baseThickness), this.materials.stoneAccent);
            baseBox.position.set(center.x, center.y + 2, center.z);
            baseBox.rotation.y = -angle;
            baseBox.receiveShadow = true;
            group.add(baseBox);
        }

        // Walkway
        const walkway = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.5, thickness * 1.3), this.materials.stoneAccent);
        walkway.position.set(center.x, center.y + height, center.z);
        walkway.rotation.y = -angle;
        walkway.receiveShadow = true;
        group.add(walkway);

        // Corbels under walkway
        if (this.params.hasCorbels) {
            const numCorbels = Math.floor(dist / 3);
            const step = dist / numCorbels;
            const corbelGeom = new THREE.BoxGeometry(0.5, 1.0, thickness * 1.3 - 0.2);
            for(let i=0; i<=numCorbels; i++) {
                const cx = -dist/2 + i*step;
                const c = new THREE.Mesh(corbelGeom, this.materials.stoneAccent);
                
                const cWorld = new THREE.Vector3(cx, height - 0.5, 0);
                cWorld.applyAxisAngle(new THREE.Vector3(0,1,0), -angle);
                cWorld.add(center);
                c.position.copy(cWorld);
                c.rotation.y = -angle;
                group.add(c);
            }
        }

        // Hoardings (Wooden covered walkway) or standard Crenellations
        if (this.random() > 0.7 && dist > 15) {
            // Hoardings
            const hGeom = new THREE.BoxGeometry(dist, 3.5, thickness * 1.4);
            const hoarding = new THREE.Mesh(hGeom, this.materials.woodDark);
            hoarding.position.set(center.x, center.y + height + 1.75, center.z);
            hoarding.rotation.y = -angle;
            hoarding.castShadow = true;
            group.add(hoarding);
            
            // Hoarding Roof
            const rGeom = new THREE.CylinderGeometry(thickness * 0.8, thickness * 0.8, dist, 3);
            const hRoof = new THREE.Mesh(rGeom, this.materials.roof);
            hRoof.position.set(center.x, center.y + height + 3.5 + thickness*0.4, center.z);
            hRoof.rotation.x = -Math.PI/2;
            hRoof.rotation.z = -angle - Math.PI/2;
            hRoof.castShadow = true;
            group.add(hRoof);
            
            // Arrow slits
            const numSlits = Math.floor(dist / 4);
            const sStep = dist / numSlits;
            const slitGeom = new THREE.BoxGeometry(0.4, 1.2, thickness * 1.4 + 0.1);
            for(let i=0; i<numSlits; i++) {
                const sx = -dist/2 + i*sStep + sStep/2;
                const slit = new THREE.Mesh(slitGeom, this.materials.windowDark);
                const localPos = new THREE.Vector3(sx, height + 1.75, 0);
                localPos.applyAxisAngle(new THREE.Vector3(0,1,0), -angle).add(center);
                slit.position.copy(localPos);
                slit.rotation.y = -angle;
                group.add(slit);
            }
        } else {
            // Crenellations
            const numMerlons = Math.floor(dist / 2.5);
            const mStep = dist / numMerlons;
            const mGeom = new THREE.BoxGeometry(1.2, 1.5, 0.6);
            for(let i=0; i<numMerlons; i++) {
                const mx = -dist/2 + i*mStep + mStep/2;
                
                // Outer merlon
                const m1 = new THREE.Mesh(mGeom, this.materials.stone);
                const localPos1 = new THREE.Vector3(mx, height + 1.0, thickness/2);
                localPos1.applyAxisAngle(new THREE.Vector3(0,1,0), -angle).add(center);
                m1.position.copy(localPos1);
                m1.rotation.y = -angle;
                m1.castShadow = true;
                group.add(m1);
            }
        }

        return group;
    }

    private buildGatehouse(x: number, y: number, z: number, angle: number) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = angle;

        const w = 18, h = 22, d = 12;

        // Main block
        const main = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.materials.stone);
        main.position.y = h/2;
        main.castShadow = true;
        main.receiveShadow = true;
        group.add(main);

        // Archway Cutout (Simulated with curved top)
        const archW = 6;
        const straightH = 5;
        
        // Rectangular bottom part
        const interiorBox = new THREE.Mesh(new THREE.BoxGeometry(archW, straightH, d + 0.2), new THREE.MeshBasicMaterial({color: 0x000000}));
        interiorBox.position.y = straightH/2;
        group.add(interiorBox);

        // Curved top part
        const interiorArchGeom = new THREE.CylinderGeometry(archW/2, archW/2, d + 0.2, 16, 1, false, 0, Math.PI);
        const interiorArch = new THREE.Mesh(interiorArchGeom, new THREE.MeshBasicMaterial({color: 0x000000}));
        interiorArch.position.set(0, straightH, 0);
        interiorArch.rotation.x = Math.PI / 2;
        group.add(interiorArch);

        // Thin Stone Arch Trim on Front and Back
        const trimZOffsets = [d/2 + 0.02, -d/2 - 0.02];
        trimZOffsets.forEach((zOff) => {
            const trimGeom = new THREE.CylinderGeometry(archW/2 + 0.3, archW/2 + 0.3, 0.4, 16, 1, false, 0, Math.PI);
            const trim = new THREE.Mesh(trimGeom, this.materials.stoneAccent);
            trim.position.set(0, straightH, zOff);
            trim.rotation.x = Math.PI / 2;
            group.add(trim);

            const sideTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.4, straightH, 0.4), this.materials.stoneAccent);
            sideTrimL.position.set(-archW/2 - 0.1, straightH/2, zOff);
            const sideTrimR = new THREE.Mesh(new THREE.BoxGeometry(0.4, straightH, 0.4), this.materials.stoneAccent);
            sideTrimR.position.set(archW/2 + 0.1, straightH/2, zOff);
            group.add(sideTrimL, sideTrimR);
        });

        // Portcullis / Door
        const door = this.buildDetailedGateDoor(archW, straightH + archW/2);
        door.position.set(0, 0.01, d/2 - 0.4);
        group.add(door);

        // Flanking turrets
        const t1 = this.buildTower(w/2 + 1, 0, d/2, 4, h + 8, 'round', this.materials.roofAccent);
        const t2 = this.buildTower(-w/2 - 1, 0, d/2, 4, h + 8, 'round', this.materials.roofAccent);
        group.add(t1, t2);

        // Roof / Battlements
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w+1, 1, d+1), this.materials.stoneAccent);
        roof.position.y = h + 0.5;
        group.add(roof);

        const cren = this.createCrenellations(w/2, 0.6, 1.5, 4, true);
        cren.scale.set(1, 1, d/w);
        cren.position.y = h + 1;
        group.add(cren);

        // Drawbridge
        const bridgeW = archW - 0.5, bridgeL = 15;
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(bridgeW, 0.5, bridgeL), this.materials.wood);
        bridge.position.set(0, 0.25, d/2 + bridgeL/2);
        bridge.receiveShadow = true;
        bridge.castShadow = true;
        group.add(bridge);

        return group;
    }

    private buildDetailedGateDoor(width: number, height: number): THREE.Group {
        const group = new THREE.Group();

        // Two wooden door leaves (left and right)
        const leafW = width / 2;
        const leafH = height;
        const leafD = 0.4;

        // Material for iron hinges and bands
        const ironMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.8,
            metalness: 0.8
        });

        const radius = width / 2;
        const straightH = height - radius;

        // Left Leaf Shape
        const leftShape = new THREE.Shape();
        leftShape.moveTo(-leafW, 0);
        leftShape.lineTo(0, 0);
        leftShape.lineTo(0, height); // Top center
        // Sweep the left half of the arch: center is at (0, straightH), radius is radius
        // Sweep from Math.PI / 2 (top) to Math.PI (left)
        leftShape.absarc(0, straightH, radius, Math.PI / 2, Math.PI, false);
        leftShape.lineTo(-leafW, 0);

        // Right Leaf Shape
        const rightShape = new THREE.Shape();
        rightShape.moveTo(0, 0);
        rightShape.lineTo(leafW, 0);
        rightShape.lineTo(leafW, straightH);
        // Sweep the right half of the arch: center is at (0, straightH), radius is radius
        // Sweep from 0 (right) to Math.PI / 2 (top)
        rightShape.absarc(0, straightH, radius, 0, Math.PI / 2, false);
        rightShape.lineTo(0, 0);

        const extrudeSettings = {
            depth: leafD,
            bevelEnabled: true,
            bevelThickness: 0.05,
            bevelSize: 0.02,
            bevelSegments: 2,
            curveSegments: this.params.lowPoly ? 3 : 12
        };

        // Left door leaf mesh
        const leftGeom = new THREE.ExtrudeGeometry(leftShape, extrudeSettings);
        leftGeom.translate(0, 0, -leafD / 2);
        const leftDoorMesh = new THREE.Mesh(leftGeom, this.materials.wood);
        leftDoorMesh.castShadow = true;
        leftDoorMesh.receiveShadow = true;
        group.add(leftDoorMesh);
        
        // Right door leaf mesh
        const rightGeom = new THREE.ExtrudeGeometry(rightShape, extrudeSettings);
        rightGeom.translate(0, 0, -leafD / 2);
        const rightDoorMesh = new THREE.Mesh(rightGeom, this.materials.wood);
        rightDoorMesh.castShadow = true;
        rightDoorMesh.receiveShadow = true;
        group.add(rightDoorMesh);

        // Vertical plank grooves to simulate planks
        const numPlanks = 3;
        for (let i = 0; i < numPlanks; i++) {
            if (i > 0) {
                const lineXLeft = -leafW + i * (leafW / numPlanks);
                const lineXRight = i * (leafW / numPlanks);

                const leftLine = new THREE.Mesh(
                    new THREE.BoxGeometry(0.04, height - 0.2, 0.05),
                    this.materials.woodDark
                );
                leftLine.position.set(lineXLeft, height / 2, leafD / 2 + 0.01);
                group.add(leftLine);

                const rightLine = new THREE.Mesh(
                    new THREE.BoxGeometry(0.04, height - 0.2, 0.05),
                    this.materials.woodDark
                );
                rightLine.position.set(lineXRight, height / 2, leafD / 2 + 0.01);
                group.add(rightLine);
            }
        }

        // Horizontal iron bands (hinges)
        const bandH = 0.25;
        const bandD = 0.04;
        const bandYPositions = [straightH * 0.25, straightH * 0.75];

        bandYPositions.forEach((yPos) => {
            // Left band
            const leftBand = new THREE.Mesh(
                new THREE.BoxGeometry(leafW - 0.2, bandH, bandD),
                ironMat
            );
            leftBand.position.set(-leafW / 2 - 0.1, yPos, leafD / 2 + 0.02);
            group.add(leftBand);

            // Right band
            const rightBand = new THREE.Mesh(
                new THREE.BoxGeometry(leafW - 0.2, bandH, bandD),
                ironMat
            );
            rightBand.position.set(leafW / 2 + 0.1, yPos, leafD / 2 + 0.02);
            group.add(rightBand);

            // Little metal studs along the bands
            const numBolts = 4;
            for (let b = 0; b < numBolts; b++) {
                const boltRatio = (b + 0.5) / numBolts;
                const boltRadius = 0.04;
                const boltGeom = new THREE.SphereGeometry(boltRadius, 4, 4);

                const leftBolt = new THREE.Mesh(boltGeom, ironMat);
                leftBolt.position.set(-leafW + boltRatio * (leafW - 0.2), yPos, leafD / 2 + 0.02 + boltRadius);
                group.add(leftBolt);

                const rightBolt = new THREE.Mesh(boltGeom, ironMat);
                rightBolt.position.set(boltRatio * (leafW - 0.2) + 0.2, yPos, leafD / 2 + 0.02 + boltRadius);
                group.add(rightBolt);
            }
        });

        // Golden door ring handles
        const handleY = straightH * 0.5;
        const handleXOffset = 0.4;
        const ringGeom = new THREE.TorusGeometry(0.18, 0.03, 6, 12);

        const handleGroupLeft = new THREE.Group();
        handleGroupLeft.position.set(-handleXOffset, handleY, leafD / 2 + 0.04);
        const baseLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 8), ironMat);
        baseLeft.rotation.x = Math.PI / 2;
        handleGroupLeft.add(baseLeft);
        const ringLeft = new THREE.Mesh(ringGeom, this.materials.gold);
        ringLeft.position.set(0, -0.08, 0.03);
        handleGroupLeft.add(ringLeft);
        group.add(handleGroupLeft);

        const handleGroupRight = new THREE.Group();
        handleGroupRight.position.set(handleXOffset, handleY, leafD / 2 + 0.04);
        const baseRight = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 8), ironMat);
        baseRight.rotation.x = Math.PI / 2;
        handleGroupRight.add(baseRight);
        const ringRight = new THREE.Mesh(ringGeom, this.materials.gold);
        ringRight.position.set(0, -0.08, 0.03);
        handleGroupRight.add(ringRight);
        group.add(handleGroupRight);

        // Gold studs along the door edges for decoration
        const studMat = this.materials.gold;
        const numStudsSide = 5;
        for (let i = 0; i < numStudsSide; i++) {
            const y = (i / (numStudsSide - 1)) * (straightH - 0.4) + 0.2;
            const studGeom = new THREE.SphereGeometry(0.04, 4, 4);

            const studL = new THREE.Mesh(studGeom, studMat);
            studL.position.set(-leafW + 0.3, y, leafD / 2 + 0.01);
            group.add(studL);

            const studR = new THREE.Mesh(studGeom, studMat);
            studR.position.set(leafW - 0.3, y, leafD / 2 + 0.01);
            group.add(studR);
        }

        return group;
    }

    private buildJapaneseCentralKeep(x: number, y: number, z: number) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        const tiers = 4;
        const baseH = 8;
        const totalHeight = this.params.keepHeight;
        const tierH = (totalHeight - baseH) / tiers;

        const baseW = (24 + this.params.complexity * 1.5) * this.params.baseWidthScale;
        const baseD = (24 + this.params.complexity * 1.5) * this.params.baseLengthScale;

        // Slanted stone base (Tenshudai)
        const baseGeom = new THREE.CylinderGeometry(baseW * 0.85, baseW, baseH, 4);
        const baseMesh = new THREE.Mesh(baseGeom, this.materials.stoneAccent);
        baseMesh.position.y = baseH / 2;
        baseMesh.rotation.y = Math.PI / 4; // square orientation
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        group.add(baseMesh);

        const plasterColor = 0xfdfdfd;
        const plasterMat = new THREE.MeshStandardMaterial({
            color: plasterColor,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: this.params.lowPoly
        });

        let currentW = baseW * 0.75;
        let currentD = baseD * 0.75;

        for (let t = 0; t < tiers; t++) {
            const ty = baseH + t * tierH;
            const tW = currentW * Math.pow(0.85, t);
            const tD = currentD * Math.pow(0.85, t);

            // Story block
            const tBody = new THREE.Mesh(new THREE.BoxGeometry(tW, tierH, tD), plasterMat);
            tBody.position.y = ty + tierH / 2;
            tBody.castShadow = true;
            tBody.receiveShadow = true;
            group.add(tBody);

            // Dark wood vertical corner frames
            const trimSize = 0.4;
            const trims = [
                [-tW/2, -tD/2], [tW/2, -tD/2], [-tW/2, tD/2], [tW/2, tD/2]
            ];
            trims.forEach(([tx, tz]) => {
                const trim = new THREE.Mesh(new THREE.BoxGeometry(trimSize, tierH, trimSize), this.materials.woodDark);
                trim.position.set(tx, ty + tierH/2, tz);
                group.add(trim);
            });

            // Shoji windows on each face
            const numWin = 2;
            for (let f = 0; f < 4; f++) {
                for (let wIdx = 0; wIdx < numWin; wIdx++) {
                    const win = this.createShojiWindow(this.random() > 0.3);
                    win.scale.set(0.8, 0.8, 0.8);
                    const offsetVal = (wIdx - (numWin - 1) / 2) * (tW * 0.4);

                    if (f === 0) win.position.set(offsetVal, ty + tierH/2, tD/2 + 0.1);
                    else if (f === 1) { win.position.set(tW/2 + 0.1, ty + tierH/2, offsetVal); win.rotation.y = Math.PI/2; }
                    else if (f === 2) { win.position.set(offsetVal, ty + tierH/2, -tD/2 - 0.1); win.rotation.y = Math.PI; }
                    else if (f === 3) { win.position.set(-tW/2 - 0.1, ty + tierH/2, offsetVal); win.rotation.y = -Math.PI/2; }

                    group.add(win);
                }
            }

            // Curved roofs on each story
            const rH = tW * 0.42;
            const rShape = new THREE.Shape();
            const rw = tW/2 + 2.0; // Deep overhang!
            rShape.moveTo(-rw, 0);
            rShape.quadraticCurveTo(-rw * 0.75, rH * 0.15, 0, rH);
            rShape.quadraticCurveTo(rw * 0.75, rH * 0.15, rw, 0);
            rShape.lineTo(rw, -0.4);
            rShape.lineTo(-rw, -0.4);
            rShape.lineTo(-rw, 0);

            const rGeom = new THREE.ExtrudeGeometry(rShape, { depth: tD + 4.0, bevelEnabled: false });
            rGeom.center();
            
            const roof1 = new THREE.Mesh(rGeom, this.materials.roof);
            roof1.position.set(0, ty + tierH, 0);
            roof1.rotation.y = Math.PI/2;
            roof1.castShadow = true;
            group.add(roof1);

            if (t % 2 === 1) {
                const roof2 = new THREE.Mesh(rGeom, this.materials.roof);
                roof2.position.set(0, ty + tierH, 0);
                roof2.castShadow = true;
                group.add(roof2);
            }

            // Shachihoko fish finials on the top tier
            if (t === tiers - 1) {
                const shachiL = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3.0, 4), this.materials.gold);
                shachiL.position.set(0, ty + tierH + rH * 0.9, tD/2 + 0.3);
                shachiL.rotation.x = Math.PI/6;
                group.add(shachiL);

                const shachiR = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3.0, 4), this.materials.gold);
                shachiR.position.set(0, ty + tierH + rH * 0.9, -tD/2 - 0.3);
                shachiR.rotation.x = -Math.PI/6;
                group.add(shachiR);
            }
        }

        return group;
    }

    private buildEuropeanCoastalKeep(x: number, y: number, z: number) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        const h = this.params.keepHeight;
        const w = (22 + this.params.complexity * 1.5) * this.params.baseWidthScale;
        const d = (22 + this.params.complexity * 1.5) * this.params.baseLengthScale;

        const stuccoColor = this.getWarmPastelColor();
        const stuccoMat = new THREE.MeshStandardMaterial({
            color: stuccoColor,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: this.params.lowPoly
        });

        // Grand palace hall base
        const baseH = h * 0.5;
        const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(w, baseH, d), stuccoMat);
        baseBlock.position.y = baseH / 2;
        baseBlock.castShadow = true;
        baseBlock.receiveShadow = true;
        group.add(baseBlock);

        // Decorative horizontal base trim
        const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4), this.materials.stoneAccent);
        trim.position.y = baseH;
        trim.castShadow = true;
        group.add(trim);

        // Row of arched glass windows along the front and back of the palace base
        const winNum = 4;
        for (let i = 0; i < winNum; i++) {
            const wx = (w / (winNum + 1)) * (i + 1) - w/2;
            const win = this.createDetailedWindow(this.random() > 0.1);
            win.scale.set(0.9, 0.9, 0.9);
            win.position.set(wx, baseH * 0.5, d/2 + 0.1);
            group.add(win);
        }

        // Stepped pitched roof on the main hall
        const rH = baseH * 0.4;
        const rShape = new THREE.Shape();
        const rw = w/2 + 0.8;
        rShape.moveTo(-rw, 0);
        rShape.lineTo(rw, 0);
        rShape.lineTo(0, rH);
        rShape.lineTo(-rw, 0);

        const rGeom = new THREE.ExtrudeGeometry(rShape, { depth: d + 1.2, bevelEnabled: false });
        rGeom.center();
        const roofMat = new THREE.MeshStandardMaterial({
            color: this.getContrastingRoofColor(),
            roughness: 0.8,
            metalness: 0.1,
            flatShading: this.params.lowPoly
        });
        const roof = new THREE.Mesh(rGeom, roofMat);
        roof.position.y = baseH + rH / 2;
        roof.castShadow = true;
        group.add(roof);

        // A spectacular central clock tower rising from the roof!
        const clockTower = this.buildClockTower(0, baseH - 2, 0, 0);
        group.add(clockTower);

        // Little balconies on the sides of the palace base
        const balL = this.createBalcony();
        balL.position.set(-w/2 - 0.1, baseH * 0.5, 0);
        balL.rotation.y = -Math.PI/2;
        group.add(balL);

        const balR = this.createBalcony();
        balR.position.set(w/2 + 0.1, baseH * 0.5, 0);
        balR.rotation.y = Math.PI/2;
        group.add(balR);

        return group;
    }

    private buildClockTower(x: number, y: number, z: number, angle: number) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = angle;

        const h = 25 + this.random() * 5;
        const w = 7 + this.random() * 2;
        const d = 7 + this.random() * 2;

        // Base/Main Shaft (colored stucco)
        const stuccoColor = this.getWarmPastelColor();
        const stuccoMat = new THREE.MeshStandardMaterial({
            color: stuccoColor,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: this.params.lowPoly
        });
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.75, d), stuccoMat);
        shaft.position.y = (h * 0.75) / 2;
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        group.add(shaft);

        const belfryY = h * 0.75;
        const belfryH = h * 0.15;

        // Belfry (open structure with arches)
        const belfryGroup = new THREE.Group();
        belfryGroup.position.y = belfryY;
        
        const bFloor = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.6, d + 1), this.materials.stoneAccent);
        bFloor.position.y = 0.3;
        bFloor.castShadow = true;
        belfryGroup.add(bFloor);

        const pSize = 0.8;
        const pHeight = belfryH - 0.6;
        const offsets = [
            [-w/2 + pSize/2, -d/2 + pSize/2],
            [w/2 - pSize/2, -d/2 + pSize/2],
            [-w/2 + pSize/2, d/2 - pSize/2],
            [w/2 - pSize/2, d/2 - pSize/2]
        ];
        offsets.forEach(([ox, oz]) => {
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(pSize, pHeight, pSize), this.materials.stone);
            pillar.position.set(ox, 0.6 + pHeight/2, oz);
            pillar.castShadow = true;
            belfryGroup.add(pillar);
        });

        const bRoof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.6, d + 0.8), this.materials.stoneAccent);
        bRoof.position.y = belfryH - 0.3;
        bRoof.castShadow = true;
        belfryGroup.add(bRoof);

        const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 1.5, 8), this.materials.gold);
        bell.position.set(0, belfryH / 2, 0);
        bell.castShadow = true;
        belfryGroup.add(bell);

        group.add(belfryGroup);

        // Clock Face (placed on the shaft just below belfry)
        const clockY = belfryY - 3;
        const clockRadius = Math.min(w, d) * 0.35;
        const faceOffsets = [
            [0, d/2 + 0.11, 0],
            [w/2 + 0.11, 0, Math.PI/2],
            [0, -d/2 - 0.11, Math.PI],
            [-w/2 - 0.11, 0, -Math.PI/2]
        ];
        faceOffsets.forEach(([ox, oz, rotY]) => {
            const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(clockRadius, clockRadius, 0.2, 12), this.materials.windowLit);
            clockFace.rotation.x = Math.PI/2;
            clockFace.rotation.z = rotY;
            
            if (rotY === 0 || rotY === Math.PI) {
                clockFace.position.set(ox, clockY, oz);
            } else {
                clockFace.position.set(ox, clockY, oz);
                clockFace.rotation.y = rotY;
            }
            clockFace.castShadow = true;
            group.add(clockFace);

            const hands = new THREE.Group();
            hands.position.set(clockFace.position.x, clockFace.position.y, clockFace.position.z);
            hands.rotation.y = rotY;
            
            const hh = new THREE.Mesh(new THREE.BoxGeometry(0.1, clockRadius * 0.6, 0.05), this.materials.woodDark);
            hh.position.y = clockRadius * 0.3;
            hh.rotation.z = Math.PI / 6;
            hands.add(hh);
            
            const mh = new THREE.Mesh(new THREE.BoxGeometry(0.06, clockRadius * 0.9, 0.05), this.materials.woodDark);
            mh.position.y = clockRadius * 0.45;
            mh.rotation.z = -Math.PI / 3;
            hands.add(mh);
            
            group.add(hands);
        });

        // Roof: Domed or Spired Roof in contrasting color
        const roofMat = new THREE.MeshStandardMaterial({
            color: this.getContrastingRoofColor(),
            roughness: 0.7,
            metalness: 0.1,
            flatShading: this.params.lowPoly
        });
        const roofH = w * 1.5;
        const isDome = this.random() > 0.5;
        let roofGeom;
        if (isDome) {
            roofGeom = new THREE.SphereGeometry(w * 0.65, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        } else {
            roofGeom = new THREE.ConeGeometry(w * 0.65, roofH, 4);
        }
        const roof = new THREE.Mesh(roofGeom, roofMat);
        roof.position.y = belfryY + belfryH + (isDome ? 0 : roofH/2);
        if (!isDome) roof.rotation.y = Math.PI/4;
        roof.castShadow = true;
        group.add(roof);

        // Weather vane on top
        const vanePole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 6), this.materials.gold);
        vanePole.position.y = belfryY + belfryH + (isDome ? w * 0.65 : roofH) + 2;
        vanePole.castShadow = true;
        group.add(vanePole);

        const vaneIndicator = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.05), this.materials.gold);
        vaneIndicator.position.y = belfryY + belfryH + (isDome ? w * 0.65 : roofH) + 3.5;
        vaneIndicator.rotation.y = this.random() * Math.PI * 2;
        vaneIndicator.castShadow = true;
        group.add(vaneIndicator);

        // Windows along tower shaft
        const stories = 3;
        for (let s = 1; s <= stories; s++) {
            const wy = (belfryY / (stories + 1)) * s;
            const w1 = this.createDetailedWindow(this.random() > 0.3);
            w1.scale.set(0.6, 0.6, 0.6);
            w1.position.set(0, wy, d/2 + 0.1);
            group.add(w1);

            const w2 = this.createDetailedWindow(this.random() > 0.3);
            w2.scale.set(0.6, 0.6, 0.6);
            w2.position.set(0, wy, -d/2 - 0.1);
            w2.rotation.y = Math.PI;
            group.add(w2);
        }

        return group;
    }

    private createDynamicKeepRoof(width: number, roofStyle: string, depth?: number) {
        const group = new THREE.Group();
        const d = depth || width;
        const maxDim = Math.max(width, d);

        // Bell curve override
        if (this.params.bellCurveRoofs) {
            const bellRoof = this.createBellCurveRoof(maxDim);
            group.add(bellRoof);
            return group;
        }

        let styleToUse = roofStyle;
        if (styleToUse === 'mixed') {
            const styles = ['fairytale_spire', 'onion_dome', 'domed', 'pointed', 'flat'];
            styleToUse = styles[Math.floor(this.random() * styles.length)];
        }

        const mat = this.materials.roof;
        const isLowPoly = this.params.lowPoly;

        if (styleToUse === 'onion_dome') {
            const domeR = maxDim * 0.55;
            const segs = isLowPoly ? 8 : 16;

            // Square-to-circle transitional drum
            const drumH = domeR * 0.3;
            const drum = new THREE.Mesh(
                new THREE.CylinderGeometry(domeR * 0.95, maxDim * 0.5, drumH, segs),
                this.materials.stoneAccent
            );
            drum.position.y = drumH / 2;
            group.add(drum);

            const domeGeom = new THREE.SphereGeometry(domeR, segs, segs, 0, Math.PI * 2, 0, Math.PI * 0.65);
            const dome = new THREE.Mesh(domeGeom, mat);
            dome.position.y = drumH + domeR * 0.5;
            dome.castShadow = true;
            group.add(dome);

            const tipH = domeR * 1.8;
            const tipGeom = new THREE.ConeGeometry(domeR * 0.45, tipH, segs);
            const tip = new THREE.Mesh(tipGeom, mat);
            tip.position.y = drumH + domeR * 0.8 + tipH / 2;
            tip.castShadow = true;
            group.add(tip);

            const crown = this.createTiaraFinial(Math.max(1.0, maxDim * 0.12));
            crown.position.set(0, drumH + domeR * 0.8 + tipH + 0.8, 0);
            group.add(crown);

        } else if (styleToUse === 'fairytale_spire') {
            // Pyramidal spire matching rectangular footprint
            const spireH = maxDim * 1.8;
            const halfW = width * 0.55;
            const halfD = d * 0.55;

            const shape = new THREE.Shape();
            shape.moveTo(-halfW, -halfD);
            shape.lineTo(halfW, -halfD);
            shape.lineTo(halfW, halfD);
            shape.lineTo(-halfW, halfD);
            shape.closePath();

            const pts = [
                new THREE.Vector2(Math.max(halfW, halfD), 0),
                new THREE.Vector2(0, spireH)
            ];
            // Use 4-sided cone (pyramid) rotated 45° to match box footprint
            const spire = new THREE.Mesh(new THREE.ConeGeometry(Math.max(halfW, halfD), spireH, 4), mat);
            spire.rotation.y = Math.PI / 4;
            spire.position.y = spireH / 2;
            spire.castShadow = true;
            group.add(spire);

            const crown = this.createTiaraFinial(Math.max(1.0, maxDim * 0.12));
            crown.position.set(0, spireH + 0.8, 0);
            group.add(crown);

        } else if (styleToUse === 'domed') {
            const r = maxDim * 0.55;
            const segs = isLowPoly ? 8 : 18;

            // Transitional drum from square to round
            const drumH = r * 0.25;
            const drum = new THREE.Mesh(
                new THREE.CylinderGeometry(r * 0.95, maxDim * 0.48, drumH, segs),
                this.materials.stoneAccent
            );
            drum.position.y = drumH / 2;
            group.add(drum);

            const dome = new THREE.Mesh(new THREE.SphereGeometry(r, segs, segs, 0, Math.PI * 2, 0, Math.PI / 2), mat);
            dome.position.y = drumH;
            dome.castShadow = true;
            group.add(dome);

            const cupolaH = r * 0.6;
            const cupola = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.35, cupolaH, segs), this.materials.stoneAccent);
            cupola.position.y = drumH + r + cupolaH / 2;
            group.add(cupola);

            const cupolaRoof = new THREE.Mesh(new THREE.ConeGeometry(r * 0.45, r * 0.7, segs), this.materials.roofAccent);
            cupolaRoof.position.y = drumH + r + cupolaH + r * 0.35;
            group.add(cupolaRoof);

            const crown = this.createTiaraFinial(Math.max(0.8, maxDim * 0.1));
            crown.position.set(0, drumH + r + cupolaH + r * 0.7 + 0.5, 0);
            group.add(crown);

        } else if (styleToUse === 'flat') {
            const cren = this.createCrenellations(width * 0.48, 0.8, 2.2, 4, true);
            cren.position.y = 0;
            group.add(cren);

            const tw = maxDim * 0.22;
            const th = maxDim * 0.6;
            const offsets = [[width * 0.42, d * 0.42], [-width * 0.42, d * 0.42], [width * 0.42, -d * 0.42], [-width * 0.42, -d * 0.42]];
            offsets.forEach(([ox, oz]) => {
                const turret = new THREE.Mesh(new THREE.CylinderGeometry(tw, tw, th, 8), this.materials.stoneAccent);
                turret.position.set(ox, th / 2, oz);
                group.add(turret);

                const tRoof = new THREE.Mesh(new THREE.ConeGeometry(tw * 1.2, th * 0.8, 8), mat);
                tRoof.position.set(ox, th + th * 0.4, oz);
                group.add(tRoof);
            });

        } else {
            // Pointed pyramid matching rectangular base (4-sided)
            const r = maxDim * 0.6;
            const spireH = maxDim * 1.2;

            const spire = new THREE.Mesh(new THREE.ConeGeometry(r, spireH, 4), mat);
            spire.rotation.y = Math.PI / 4;
            spire.position.y = spireH / 2;
            spire.castShadow = true;
            group.add(spire);

            const crown = this.createTiaraFinial(Math.max(0.8, maxDim * 0.1));
            crown.position.set(0, spireH + 0.6, 0);
            group.add(crown);
        }

        return group;
    }

    private buildCentralKeep(x: number, y: number, z: number) {
        if (this.params.buildingStyle === 'japanese') {
            return this.buildJapaneseCentralKeep(x, y, z);
        } else if (this.params.buildingStyle === 'european_coastal') {
            return this.buildEuropeanCoastalKeep(x, y, z);
        }

        const group = new THREE.Group();
        group.position.set(x, y, z);

        let h = this.params.keepHeight;
        let w = (20 + this.params.complexity * 1.5) * this.params.baseWidthScale;
        let d = (20 + this.params.complexity * 1.5) * this.params.baseLengthScale;

        if (this.params.layout === 'fairy_tale' || this.params.layout === 'enchanted_spires' || this.params.layout === 'princess_royal') {
            h *= 1.4;
            w *= 0.65;
            d *= 0.65;
        }

        // Tier 1: Lower keep body (tallest, widest)
        const t1h = h * 0.55;
        const core = new THREE.Mesh(new THREE.BoxGeometry(w, t1h, d), this.materials.stone);
        core.position.y = t1h / 2;
        core.castShadow = true;
        core.receiveShadow = true;
        group.add(core);

        // String course / accent band between tiers
        const band1 = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.8, d + 1), this.materials.stoneAccent);
        band1.position.y = t1h;
        group.add(band1);

        // Tier 2: Middle keep body (narrower, inset)
        const t2w = w * 0.82;
        const t2d = d * 0.82;
        const t2h = h * 0.3;
        const tier2 = new THREE.Mesh(new THREE.BoxGeometry(t2w, t2h, t2d), this.materials.stone);
        tier2.position.y = t1h + t2h / 2;
        tier2.castShadow = true;
        tier2.receiveShadow = true;
        group.add(tier2);

        // String course between tier 2 and tier 3
        const band2 = new THREE.Mesh(new THREE.BoxGeometry(t2w + 0.8, 0.6, t2d + 0.8), this.materials.stoneAccent);
        band2.position.y = t1h + t2h;
        group.add(band2);

        // Tier 3: Upper keep body (narrowest)
        const t3w = t2w * 0.75;
        const t3d = t2d * 0.75;
        const t3h = h * 0.15;
        const tier3 = new THREE.Mesh(new THREE.BoxGeometry(t3w, t3h, t3d), this.materials.stone);
        tier3.position.y = t1h + t2h + t3h / 2;
        tier3.castShadow = true;
        tier3.receiveShadow = true;
        group.add(tier3);

        // Corner pilasters on tier 1 for vertical articulation
        const pilW = 1.5;
        const pilCorners = [
            [w / 2 - pilW / 2, d / 2 - pilW / 2],
            [-w / 2 + pilW / 2, d / 2 - pilW / 2],
            [w / 2 - pilW / 2, -d / 2 + pilW / 2],
            [-w / 2 + pilW / 2, -d / 2 + pilW / 2]
        ];
        pilCorners.forEach(([px, pz]) => {
            const pilaster = new THREE.Mesh(
                new THREE.BoxGeometry(pilW, t1h + 1, pilW),
                this.materials.stoneAccent
            );
            pilaster.position.set(px, t1h / 2, pz);
            pilaster.castShadow = true;
            group.add(pilaster);
        });

        // Base Flaring for Keep
        if (this.params.flaredBases) {
            const baseBox = new THREE.Mesh(new THREE.BoxGeometry(w + 3, 5, d + 3), this.materials.stoneAccent);
            baseBox.position.y = 2.5;
            baseBox.receiveShadow = true;
            group.add(baseBox);
        }

        // Top tier + roof
        const totalTierH = t1h + t2h + t3h;
        const isFairytale = this.params.layout === 'fairy_tale' || this.params.layout === 'enchanted_spires' || this.params.layout === 'princess_royal';
        if (this.params.complexity > 5) {
            const upperH = isFairytale ? (25 + this.params.complexity * 3) : (15 + this.params.complexity * 2);
            const upperW = t3w * (isFairytale ? 0.65 : 0.85);
            const segs = this.params.lowPoly ? 8 : 16;
            if (isFairytale) {
                const upperGeom = new THREE.CylinderGeometry(upperW / 2 * 0.85, upperW / 2, upperH, segs);
                const upper = new THREE.Mesh(upperGeom, this.materials.stone);
                upper.position.y = totalTierH + upperH / 2;
                upper.castShadow = true;
                upper.receiveShadow = true;
                group.add(upper);

                const rimGeom = new THREE.CylinderGeometry(upperW / 2 * 0.95, upperW / 2 * 0.85, 1.0, segs);
                const rim = new THREE.Mesh(rimGeom, this.materials.stoneAccent);
                rim.position.y = totalTierH + upperH + 0.5;
                group.add(rim);
            } else {
                const upper = new THREE.Mesh(new THREE.BoxGeometry(upperW, upperH, upperW), this.materials.stone);
                upper.position.y = totalTierH + upperH / 2;
                upper.castShadow = true;
                upper.receiveShadow = true;
                group.add(upper);
            }

            const keepRoof = this.createDynamicKeepRoof(upperW, this.params.roofShape, isFairytale ? upperW : upperW);
            keepRoof.position.y = totalTierH + upperH;
            group.add(keepRoof);

            if (this.random() > 0.4) {
                const d1 = this.createDormerWindow();
                d1.position.set(0, totalTierH + upperH + 2, upperW * 0.5);
                group.add(d1);

                const d2 = this.createDormerWindow();
                d2.position.set(0, totalTierH + upperH + 2, -upperW * 0.5);
                d2.rotation.y = Math.PI;
                group.add(d2);
            }
        } else {
            const keepRoof = this.createDynamicKeepRoof(t3w, this.params.roofShape, t3d);
            keepRoof.position.y = totalTierH;
            group.add(keepRoof);
        }

        // Keep Corner Towers (skipping for fairytale layout to avoid rigid clipping with manual towers)
        if (this.params.layout !== 'fairy_tale') {
            const tw = w / 2;
            const td = d / 2;
            const towerR = Math.min(4.5, Math.min(w, d) * 0.15);
            const offsets = [[tw, td], [tw, -td], [-tw, td], [-tw, -td]];
            offsets.forEach((off, i) => {
                const th = totalTierH + (i % 2 === 0 ? 5 : 12);
                const tower = this.buildTower(off[0], 0, off[1], towerR, th, 'round', this.materials.roofAccent);
                group.add(tower);
            });
        }

        // Add Great Hall Extension
        if (this.params.complexity > 7) {
            const extW = 16, extH = totalTierH * 0.5, extD = 24;
            const ext = new THREE.Mesh(new THREE.BoxGeometry(extW, extH, extD), this.materials.stone);
            ext.position.set(-w/2 - extW/2 + 2, extH/2, 0);
            ext.castShadow = true;
            ext.receiveShadow = true;
            group.add(ext);

            const eRoofH = 8;
            const roofShape = new THREE.Shape();
            roofShape.moveTo(-extW * 0.55, -eRoofH/2);
            roofShape.lineTo(extW * 0.55, -eRoofH/2);
            roofShape.lineTo(0, eRoofH/2);
            roofShape.lineTo(-extW * 0.55, -eRoofH/2);
            const extrudeSettings = { depth: extD * 1.1, bevelEnabled: false };
            const eRoofGeom = new THREE.ExtrudeGeometry(roofShape, extrudeSettings);
            eRoofGeom.center();
            const eRoof = new THREE.Mesh(eRoofGeom, this.materials.roofAccent);
            eRoof.position.set(-w/2 - extW/2 + 2, extH + eRoofH/2, 0);
            eRoof.castShadow = true;
            group.add(eRoof);
            
            // Grand Rose Window
            const roseGrp = new THREE.Group();
            const roseSegs = this.params.lowPoly ? 8 : 32;
            const roseBase = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.4, roseSegs), this.materials.stoneAccent);
            roseBase.rotation.x = Math.PI/2;
            roseGrp.add(roseBase);
            const roseGlass = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.5, roseSegs), this.materials.windowLit);
            roseGlass.rotation.x = Math.PI/2;
            roseGrp.add(roseGlass);
            // Rose Window Tracery
            for (let i = 0; i < 8; i++) {
                const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.2, 6.0, 0.6), this.materials.stoneAccent);
                spoke.rotation.z = (Math.PI / 8) * i;
                roseGrp.add(spoke);
            }
            const innerRingSegs = this.params.lowPoly ? 6 : 16;
            const innerRing = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.6, innerRingSegs), this.materials.stoneAccent);
            innerRing.rotation.x = Math.PI/2;
            roseGrp.add(innerRing);
            
            roseGrp.position.set(-w/2 - extW + 2.1, extH - 5, 0);
            roseGrp.rotation.y = -Math.PI/2;
            group.add(roseGrp);
        }

        // Scatter small windows
        const numSmallWindows = Math.floor(w * totalTierH / 40);
        for (let i = 0; i < numSmallWindows; i++) {
            const wx = -w/2 + 2 + this.random() * (w - 4);
            const wy = 5 + this.random() * (totalTierH - 10);
            const isFront = this.random() > 0.5;
            
            const win = this.createDetailedWindow(this.random() > 0.3);
            win.scale.set(0.4, 0.4, 0.4);
            
            if (isFront) {
                win.position.set(wx, wy, d/2 + 0.1);
            } else {
                win.position.set(wx, wy, -d/2 - 0.1);
                win.rotation.y = Math.PI;
            }
            group.add(win);
            
            // Also side windows
            if (this.random() > 0.5) {
                const wz = -d/2 + 2 + this.random() * (d - 4);
                const sideWin = this.createDetailedWindow(this.random() > 0.3);
                sideWin.scale.set(0.4, 0.4, 0.4);
                if (this.random() > 0.5) {
                    sideWin.position.set(w/2 + 0.1, wy, wz);
                    sideWin.rotation.y = Math.PI/2;
                } else {
                    sideWin.position.set(-w/2 - 0.1, wy, wz);
                    sideWin.rotation.y = -Math.PI/2;
                }
                group.add(sideWin);
            }
        }

        // Random Keep Windows
        for(let wy = 15; wy < totalTierH - 5; wy += 12) {
            for(let wx = -w/2 + 4; wx < w/2 - 3; wx += 6) {
                if (this.random() > 0.4) {
                    const win = this.createDetailedWindow(this.random() > 0.2);
                    win.position.set(wx, wy, d/2 + 0.1);
                    group.add(win);
                    
                    if (this.random() > 0.7 && wy > 20) {
                        const balcony = this.createBalcony();
                        balcony.position.set(wx, wy - 0.6, d/2 + 0.1);
                        group.add(balcony);
                    }
                }
                if (this.random() > 0.4) {
                    const win2 = this.createDetailedWindow(this.random() > 0.2);
                    win2.position.set(wx, wy, -d/2 - 0.1);
                    win2.rotation.y = Math.PI;
                    group.add(win2);
                }
            }
        }

        // Extra Wing Sections
        if (this.params.extraSections) {
            const numSec = this.params.sectionsCount || 1;
            const secLen = this.params.sectionLength || 12;
            const secW = w * 0.45;
            const secH = totalTierH * 0.55;

            for (let i = 0; i < numSec; i++) {
                const angle = (i / numSec) * Math.PI * 2 + Math.PI / 6;
                const secGroup = new THREE.Group();
                const wing = new THREE.Mesh(new THREE.BoxGeometry(secW, secH, secLen), this.materials.stone);
                wing.position.set(0, secH / 2, secLen / 2 + d / 4);
                wing.castShadow = true;
                wing.receiveShadow = true;
                secGroup.add(wing);

                // Wing pitched roof
                const roofH = 6;
                const roofShape = new THREE.Shape();
                roofShape.moveTo(-secW * 0.55, -roofH / 2);
                roofShape.lineTo(secW * 0.55, -roofH / 2);
                roofShape.lineTo(0, roofH / 2);
                roofShape.lineTo(-secW * 0.55, -roofH / 2);
                const extrudeSettings = { depth: secLen * 1.05, bevelEnabled: false };
                const wingRoofGeom = new THREE.ExtrudeGeometry(roofShape, extrudeSettings);
                wingRoofGeom.center();
                const wingRoof = new THREE.Mesh(wingRoofGeom, this.materials.roof);
                wingRoof.position.set(0, secH + roofH / 2, secLen / 2 + d / 4);
                wingRoof.castShadow = true;
                secGroup.add(wingRoof);

                // Wing end window
                const win = this.createDetailedWindow(true);
                win.position.set(0, secH * 0.6, secLen + d / 4 + 0.1);
                secGroup.add(win);

                secGroup.rotation.y = angle;
                group.add(secGroup);
            }
        }

        return group;
    }

    private buildExtraBuildings(bounds: number) {
        const count = this.params.buildingCount || 1;
        const offset = this.params.buildingOffset || 35;
        const type = this.params.buildingType || 'gatehouse';

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.PI / 4;
            const x = Math.cos(angle) * offset;
            const z = Math.sin(angle) * offset;

            if (type === 'gatehouse') {
                const gate = this.buildGatehouse(x, 0, z, -angle + Math.PI / 2);
                this.castleGroup.add(gate);
            } else {
                let bGroup: THREE.Group;
                if (type === 'outpost') {
                    bGroup = this.buildOutpost();
                } else {
                    bGroup = this.buildWatchtower();
                }
                bGroup.position.set(x, 0, z);
                bGroup.rotation.y = -angle + Math.PI / 2;
                this.castleGroup.add(bGroup);
            }
        }
    }

    private buildOutpost(): THREE.Group {
        const group = new THREE.Group();
        const w = 12, h = 8, d = 12;

        const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.materials.stone);
        base.position.y = h / 2;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        // Bastion crenellations
        const cren = this.createCrenellations(w / 2, 0.6, 1.5, 4, true);
        cren.position.y = h;
        group.add(cren);

        // Central small lookout post
        const lookout = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 5, 8), this.materials.stoneAccent);
        lookout.position.y = h + 2.5;
        lookout.castShadow = true;
        group.add(lookout);

        const lRoof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 4, 8), this.materials.roof);
        lRoof.position.y = h + 5 + 2;
        lRoof.castShadow = true;
        group.add(lRoof);

        // Flag banner
        const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6), this.materials.woodDark);
        flagPole.position.set(0, h + 7 + 3, 0);
        group.add(flagPole);

        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), this.materials.flag);
        flag.position.set(0.9, h + 7 + 5, 0);
        group.add(flag);

        return group;
    }

    private buildWatchtower(): THREE.Group {
        const group = new THREE.Group();
        const radius = 3.5, height = 30;

        const tower = this.buildTower(0, 0, 0, radius, height, 'octagonal', this.materials.roof);
        group.add(tower);

        // Magical Crystal Tip on Top of Spire
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), this.materials.crystal);
        crystal.position.set(0, height + 8, 0);
        crystal.castShadow = true;
        group.add(crystal);

        // Flared Base
        const flaredBase = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.4, 6, 8), this.materials.stoneAccent);
        flaredBase.position.y = 3;
        flaredBase.receiveShadow = true;
        group.add(flaredBase);

        return group;
    }

    private buildOuterBaseWall() {
        const wallGroup = new THREE.Group();
        wallGroup.name = 'outer_base_wall';

        const rx = (this.params.baseWallWidth || 70) / 2;
        const rz = (this.params.baseWallDepth || 70) / 2;
        const wallH = this.params.baseWallHeight || 14;
        const numTowers = this.params.baseWallTowers || 6;
        const towerRadius = this.params.baseWallTowerRadius || 4.5;
        const shape = this.params.baseWallShape || 'hexagonal';
        const bridgeLen = this.params.baseBridgeLength || 25;

        // 1. Calculate perimeter points (vertices) based on shape
        const points: THREE.Vector2[] = [];
        if (shape === 'square') {
            points.push(new THREE.Vector2(-rx, -rz));
            points.push(new THREE.Vector2(rx, -rz));
            points.push(new THREE.Vector2(rx, rz));
            points.push(new THREE.Vector2(-rx, rz));
        } else {
            const count = numTowers; // slider controls vertex/tower count for all non-square shapes
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
                points.push(new THREE.Vector2(Math.cos(angle) * rx, Math.sin(angle) * rz));
            }
        }

        const wallThick = 2.4;

        // Solid Courtyard Foundation Slab
        const floorShape = new THREE.Shape();
        points.forEach((p, idx) => {
            if (idx === 0) floorShape.moveTo(p.x, p.y);
            else floorShape.lineTo(p.x, p.y);
        });
        floorShape.closePath();

        const extrudeSettings = { depth: 1.0, bevelEnabled: false };
        const floorGeom = new THREE.ExtrudeGeometry(floorShape, extrudeSettings);
        floorGeom.rotateX(-Math.PI / 2);
        const courtyardFloor = new THREE.Mesh(floorGeom, this.materials.stoneAccent);
        courtyardFloor.position.y = 0.5;
        courtyardFloor.receiveShadow = true;
        wallGroup.add(courtyardFloor);

        // 2. Build wall segments connecting adjacent vertices
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];

            const dx = p2.x - p1.x;
            const dz = p2.y - p1.y;
            const segLength = Math.hypot(dx, dz);
            const angle = Math.atan2(dz, dx);
            const midX = (p1.x + p2.x) / 2;
            const midZ = (p1.y + p2.y) / 2;

            // Check if front segment (for gatehouse arch insertion)
            const isFront = (i === 0);

            if (isFront && segLength > 15) {
                const gateW = 14;
                const halfRemain = (segLength - gateW) / 2;
                if (halfRemain > 1) {
                    const wall1 = new THREE.Mesh(new THREE.BoxGeometry(halfRemain, wallH, wallThick), this.materials.stone);
                    const offX1 = midX - (dx / segLength) * (gateW / 2 + halfRemain / 2);
                    const offZ1 = midZ - (dz / segLength) * (gateW / 2 + halfRemain / 2);
                    wall1.position.set(offX1, wallH / 2, offZ1);
                    wall1.rotation.y = -angle;
                    wall1.castShadow = true;
                    wall1.receiveShadow = true;
                    wallGroup.add(wall1);

                    const cren1 = this.createLinearCrenellations(halfRemain, wallThick, 1.2);
                    cren1.position.set(offX1, wallH, offZ1);
                    cren1.rotation.y = -angle;
                    wallGroup.add(cren1);

                    const wall2 = new THREE.Mesh(new THREE.BoxGeometry(halfRemain, wallH, wallThick), this.materials.stone);
                    const offX2 = midX + (dx / segLength) * (gateW / 2 + halfRemain / 2);
                    const offZ2 = midZ + (dz / segLength) * (gateW / 2 + halfRemain / 2);
                    wall2.position.set(offX2, wallH / 2, offZ2);
                    wall2.rotation.y = -angle;
                    wall2.castShadow = true;
                    wall2.receiveShadow = true;
                    wallGroup.add(wall2);

                    const cren2 = this.createLinearCrenellations(halfRemain, wallThick, 1.2);
                    cren2.position.set(offX2, wallH, offZ2);
                    cren2.rotation.y = -angle;
                    wallGroup.add(cren2);
                }

                // Front Gatehouse Arch
                const gatehouse = this.buildGatehouse(midX, 0, midZ, -angle + Math.PI / 2);
                wallGroup.add(gatehouse);

                // Front Drawbridge / Ramp
                const rampW = 8;
                const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampW, 1.2, bridgeLen), this.materials.stoneAccent);
                const normX = -dz / segLength;
                const normZ = dx / segLength;
                ramp.position.set(midX + normX * (bridgeLen / 2 + 4), 0.6, midZ + normZ * (bridgeLen / 2 + 4));
                ramp.rotation.y = -angle;
                ramp.castShadow = true;
                ramp.receiveShadow = true;
                wallGroup.add(ramp);

                // Ramp side stone parapets
                const paraL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, bridgeLen), this.materials.stone);
                paraL.position.set(midX + normX * (bridgeLen / 2 + 4) - (dx / segLength) * (rampW / 2), 1.2, midZ + normZ * (bridgeLen / 2 + 4) - (dz / segLength) * (rampW / 2));
                paraL.rotation.y = -angle;
                wallGroup.add(paraL);

                const paraR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, bridgeLen), this.materials.stone);
                paraR.position.set(midX + normX * (bridgeLen / 2 + 4) + (dx / segLength) * (rampW / 2), 1.2, midZ + normZ * (bridgeLen / 2 + 4) + (dz / segLength) * (rampW / 2));
                paraR.rotation.y = -angle;
                wallGroup.add(paraR);

            } else {
                // Solid curtain wall segment
                const wall = new THREE.Mesh(new THREE.BoxGeometry(segLength, wallH, wallThick), this.materials.stone);
                wall.position.set(midX, wallH / 2, midZ);
                wall.rotation.y = -angle;
                wall.castShadow = true;
                wall.receiveShadow = true;
                wallGroup.add(wall);

                // Wall linear crenellations along top
                const cren = this.createLinearCrenellations(segLength, wallThick, 1.2);
                cren.position.set(midX, wallH, midZ);
                cren.rotation.y = -angle;
                wallGroup.add(cren);
            }
        }

        // 3. Place Corner Towers at vertices
        points.forEach((p) => {
            const towerH = wallH + 10;
            const tower = this.buildTower(p.x, 0, p.y, towerRadius, towerH, 'round', this.materials.roof);
            wallGroup.add(tower);
        });

        // 4. Surrounding Moat
        if (this.params.baseHasMoat) {
            const moatW = rx * 2.8;
            const moatD = rz * 2.8;
            const moatGeom = new THREE.PlaneGeometry(moatW, moatD);
            const moatMesh = new THREE.Mesh(moatGeom, this.materials.water);
            moatMesh.rotation.x = -Math.PI / 2;
            moatMesh.position.y = -0.2;
            moatMesh.receiveShadow = true;
            wallGroup.add(moatMesh);
        }

        this.castleGroup.add(wallGroup);
    }

    private buildFloatingIslands(bounds: number) {
        const islandGroup = new THREE.Group();
        islandGroup.name = 'floating_islands';

        const numIslands = 3;
        for (let i = 0; i < numIslands; i++) {
            const angle = (i / numIslands) * Math.PI * 2 + Math.PI / 4;
            const dist = bounds * (1.1 + this.random() * 0.3);
            const floatY = 20 + this.random() * 20;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;

            const island = new THREE.Group();
            
            // Fluffy cloud base for island
            const radius = 6 + this.random() * 3;
            const cloudGeom = new THREE.IcosahedronGeometry(radius, this.params.lowPoly ? 0 : 1);
            const cloudMesh = new THREE.Mesh(cloudGeom, this.materials.cloud);
            cloudMesh.position.set(0, 0, 0);
            cloudMesh.scale.set(1.6, 0.7, 1.6);
            cloudMesh.castShadow = true;
            cloudMesh.receiveShadow = true;
            island.add(cloudMesh);

            // Floating mini spire on top of island
            const spireTower = this.buildTower(0, radius * 0.3, 0, 2.5, 14, 'round', this.materials.roof);
            island.add(spireTower);

            // Floating crystal tip
            if (this.params.magicCrystals) {
                const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), this.materials.crystal);
                crystal.position.set(0, radius * 0.3 + 18, 0);
                crystal.castShadow = true;
                island.add(crystal);
            }

            island.position.set(x, floatY, z);
            islandGroup.add(island);
        }

        this.castleGroup.add(islandGroup);
    }

    private createTree() {
        const group = new THREE.Group();
        group.name = 'sway_tree';
        
        // Trunk
        const trunkHeight = 1.5 + this.random() * 2;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, trunkHeight, 5), this.materials.treeTrunk);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        group.add(trunk);

        // Leaves (Low poly style)
        const isPine = this.random() > 0.5;
        if (isPine) {
            const tiers = 2 + Math.floor(this.random() * 2);
            for (let i = 0; i < tiers; i++) {
                const r = 1.5 - i * 0.3;
                const h = 2.5 - i * 0.2;
                const leaf = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), this.materials.treeLeaf);
                leaf.position.y = trunkHeight + i * 1.2;
                leaf.castShadow = true;
                group.add(leaf);
            }
        } else {
            const r = 1.5 + this.random();
            const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), this.materials.treeLeaf);
            leaf.position.y = trunkHeight + r * 0.5;
            leaf.scale.set(1, 0.8 + this.random() * 0.4, 1);
            leaf.rotation.set(this.random(), this.random(), this.random());
            leaf.castShadow = true;
            group.add(leaf);
        }

        const scale = 0.8 + this.random() * 0.8;
        group.scale.set(scale, scale, scale);
        return group;
    }

    private createRock() {
        const r = 0.5 + this.random() * 1.5;
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), this.materials.rock);
        rock.name = 'rock';
        rock.scale.set(1, 0.5 + this.random() * 0.5, 1);
        rock.rotation.set(this.random(), this.random(), this.random());
        rock.castShadow = true;
        return rock;
    }

    private createCloud() {
        const group = new THREE.Group();
        const numPuffs = 3 + Math.floor(this.random() * 4);
        const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, flatShading: true });
        
        for (let i = 0; i < numPuffs; i++) {
            const r = 2 + this.random() * 3;
            const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), cloudMat);
            puff.position.set(
                (this.random() - 0.5) * 8,
                (this.random() - 0.5) * 3,
                (this.random() - 0.5) * 6
            );
            puff.rotation.set(this.random(), this.random(), this.random());
            puff.castShadow = true;
            group.add(puff);
        }
        
        return group;
    }

    // --- Layout Strategies ---

    private buildCloudBase(bounds: number) {
        const cloudGroup = new THREE.Group();
        
        // Z-center offset adjustment based on layout
        const zCenter = (this.params.layout === 'fairy_tale' ? -5 : 0);
        
        // 1. Core central cloud puffs - Dense cluster of large clouds to guarantee NO holes directly under central structures
        const corePositions = [
            [0, zCenter],
            [-12, zCenter - 6],
            [12, zCenter + 6],
            [-12, zCenter + 6],
            [12, zCenter - 6],
            [0, zCenter - 14],
            [0, zCenter + 14]
        ];
        
        corePositions.forEach(([cx, cz]) => {
            const radius = 14 + this.random() * 5;
            const geom = new THREE.IcosahedronGeometry(radius, this.params.lowPoly ? 0 : 1);
            const puff = new THREE.Mesh(geom, this.materials.cloud);
            
            // Placed so the top of the cloud puff merges elegantly with the buildings at y = 0
            puff.position.set(cx, -radius * 0.45 - 1.0, cz);
            puff.scale.set(1.9 + this.random() * 0.3, 0.7 + this.random() * 0.15, 1.9 + this.random() * 0.3);
            puff.rotation.set(this.random() * 0.1, this.random() * Math.PI, this.random() * 0.1);
            puff.castShadow = true;
            puff.receiveShadow = true;
            cloudGroup.add(puff);
        });

        // 2. Middle Ring (radius = 24) - Overlapping puffs to cover the middle section of the castle
        const numMidPuffs = 10;
        for (let i = 0; i < numMidPuffs; i++) {
            const angle = (i / numMidPuffs) * Math.PI * 2;
            const dist = 24 + this.random() * 3;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist + zCenter;
            
            const radius = 11 + this.random() * 4;
            const geom = new THREE.IcosahedronGeometry(radius, this.params.lowPoly ? 0 : 1);
            const puff = new THREE.Mesh(geom, this.materials.cloud);
            
            puff.position.set(x, -radius * 0.45 - 1.5, z);
            puff.scale.set(1.8 + this.random() * 0.3, 0.65 + this.random() * 0.15, 1.8 + this.random() * 0.3);
            puff.rotation.set(this.random() * 0.1, this.random() * Math.PI, this.random() * 0.1);
            puff.castShadow = true;
            puff.receiveShadow = true;
            cloudGroup.add(puff);
        }

        // 3. Outer Ring (radius = 38) - Overlapping outer layer to flare the clouds beautifully and prevent peripheral see-through gaps
        const numOuterPuffs = 12;
        for (let i = 0; i < numOuterPuffs; i++) {
            const angle = (i / numOuterPuffs) * Math.PI * 2 + 0.25;
            const dist = 38 + this.random() * 4;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist + zCenter;
            
            const radius = 9 + this.random() * 4;
            const geom = new THREE.IcosahedronGeometry(radius, this.params.lowPoly ? 0 : 1);
            const puff = new THREE.Mesh(geom, this.materials.cloud);
            
            puff.position.set(x, -radius * 0.5 - 2.0, z);
            puff.scale.set(1.7 + this.random() * 0.3, 0.6 + this.random() * 0.15, 1.7 + this.random() * 0.3);
            puff.rotation.set(this.random() * 0.1, this.random() * Math.PI, this.random() * 0.1);
            puff.castShadow = true;
            puff.receiveShadow = true;
            cloudGroup.add(puff);
        }

        // 4. Random fluffy satellite puffs at the far edges for soft transitions
        const numSatellitePuffs = 15;
        for (let i = 0; i < numSatellitePuffs; i++) {
            const angle = this.random() * Math.PI * 2;
            const dist = bounds * 1.05 + this.random() * bounds * 0.4;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist + zCenter;
            
            const radius = 5 + this.random() * 5;
            const geom = new THREE.IcosahedronGeometry(radius, this.params.lowPoly ? 0 : 1);
            const puff = new THREE.Mesh(geom, this.materials.cloud);
            
            puff.position.set(x, -radius * 0.5 - (this.random() * 4), z);
            puff.scale.set(1.5 + this.random() * 0.3, 0.7 + this.random() * 0.15, 1.5 + this.random() * 0.3);
            puff.rotation.set(this.random() * 0.1, this.random() * Math.PI, this.random() * 0.1);
            puff.castShadow = true;
            puff.receiveShadow = true;
            cloudGroup.add(puff);
        }
        
        this.castleGroup.add(cloudGroup);
    }

    private buildCoastalHarborScenery(bounds: number) {
        const waterGeom = new THREE.PlaneGeometry(500, 500);
        const waterMesh = new THREE.Mesh(waterGeom, this.materials.water);
        waterMesh.rotation.x = -Math.PI / 2;
        waterMesh.position.y = -10;
        waterMesh.receiveShadow = true;
        this.castleGroup.add(waterMesh);

        const cliffGroup = new THREE.Group();
        cliffGroup.name = 'terrain'; // Excluded from export parsing

        const steps = 18;
        for (let i = 0; i <= steps; i++) {
            const angle = -Math.PI/3 + (i / steps) * (1.6 * Math.PI);
            const rad = bounds * (1.0 + this.random() * 0.3);
            const x = Math.cos(angle) * rad;
            const z = Math.sin(angle) * rad;

            const numTiers = 2 + Math.floor(this.random() * 2);
            for (let t = 0; t < numTiers; t++) {
                const cy = -10 + t * 8;
                const cH = 10 + this.random() * 8;
                const cW = 15 + this.random() * 15;
                const cD = 15 + this.random() * 15;

                const rockBlock = new THREE.Mesh(
                    new THREE.BoxGeometry(cW, cH, cD),
                    this.materials.rock
                );
                rockBlock.position.set(x * (1 - t * 0.15), cy + cH/2, z * (1 - t * 0.15));
                rockBlock.rotation.set(this.random() * 0.2, this.random() * Math.PI, this.random() * 0.2);
                rockBlock.castShadow = true;
                rockBlock.receiveShadow = true;
                cliffGroup.add(rockBlock);
            }
        }

        const pierGroup = new THREE.Group();
        pierGroup.name = 'pier';
        const pierBase = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 30), this.materials.woodDark);
        pierBase.position.set(0, -9.4, -bounds * 0.6);
        pierBase.castShadow = true;
        pierBase.receiveShadow = true;
        pierGroup.add(pierBase);

        for (let i = -12; i <= 12; i += 6) {
            const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.5, 6), this.materials.woodDark);
            postL.position.set(-4.5, -9.4 + 1.25, i);
            postL.castShadow = true;
            pierGroup.add(postL);

            const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.5, 6), this.materials.woodDark);
            postR.position.set(4.5, -9.4 + 1.25, i);
            postR.castShadow = true;
            pierGroup.add(postR);
        }

        for (let b = 0; b < 2; b++) {
            const boat = new THREE.Group();
            const bW = 3, bH = 1.2, bD = 6;
            const bBody = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bD), this.materials.wood);
            bBody.castShadow = true;
            boat.add(bBody);

            const oarL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 4), this.materials.woodDark);
            oarL.position.set(-1.8, 0.4, 0);
            oarL.rotation.z = Math.PI/4;
            oarL.rotation.y = -Math.PI/6;
            boat.add(oarL);

            const oarR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 4), this.materials.woodDark);
            oarR.position.set(1.8, 0.4, 0);
            oarR.rotation.z = -Math.PI/4;
            oarR.rotation.y = Math.PI/6;
            boat.add(oarR);

            boat.position.set(-12 + b * 24, -9.8, -bounds * 0.6 - 8 + b * 16);
            boat.rotation.y = this.random() * 0.5 - 0.25;
            pierGroup.add(boat);
        }

        this.castleGroup.add(cliffGroup);
        this.castleGroup.add(pierGroup);
    }

    private buildRuralScenery(bounds: number) {
        const ruralGroup = new THREE.Group();
        ruralGroup.name = 'terrain';

        const grassBase = new THREE.Mesh(
            new THREE.IcosahedronGeometry(bounds * 1.5, this.params.lowPoly ? 1 : 2),
            this.materials.grass
        );
        grassBase.scale.set(1.4, 0.25, 1.4);
        grassBase.position.set(0, -bounds * 0.25, 0);
        grassBase.receiveShadow = true;
        ruralGroup.add(grassBase);

        const numHills = 8;
        for (let i = 0; i < numHills; i++) {
            const angle = (i / numHills) * Math.PI * 2;
            const dist = bounds * (0.4 + this.random() * 0.4);
            const rad = 15 + this.random() * 15;
            const hill = new THREE.Mesh(
                new THREE.IcosahedronGeometry(rad, this.params.lowPoly ? 0 : 1),
                this.materials.grass
            );
            hill.scale.set(1.3, 0.4, 1.3);
            hill.position.set(Math.cos(angle) * dist, -4, Math.sin(angle) * dist);
            hill.castShadow = true;
            hill.receiveShadow = true;
            ruralGroup.add(hill);
        }

        const colors = [0xf43f5e, 0xfbbf24, 0x3b82f6, 0xa855f7];
        const numFlowerPatches = 5;
        for (let p = 0; p < numFlowerPatches; p++) {
            const px = (this.random() - 0.5) * bounds * 1.5;
            const pz = (this.random() - 0.5) * bounds * 1.5;
            const flowerColor = colors[p % colors.length];
            const flowerMat = new THREE.MeshStandardMaterial({ color: flowerColor, roughness: 1.0, flatShading: true });

            const numFlowers = 12 + Math.floor(this.random() * 10);
            for (let f = 0; f < numFlowers; f++) {
                const fx = px + (this.random() - 0.5) * 8;
                const fz = pz + (this.random() - 0.5) * 8;
                const fl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), flowerMat);
                fl.position.set(fx, 0.15, fz);
                fl.rotation.set(this.random(), this.random(), this.random());
                ruralGroup.add(fl);
            }
        }

        const numCrops = 2;
        for (let c = 0; c < numCrops; c++) {
            const cx = (c === 0 ? -bounds * 0.5 : bounds * 0.5) + (this.random() - 0.5) * 5;
            const cz = (this.random() - 0.5) * bounds * 0.3;

            const patch = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 8), this.materials.dirt);
            patch.position.set(cx, 0.05, cz);
            patch.castShadow = true;
            patch.receiveShadow = true;
            ruralGroup.add(patch);

            for (let row = -3; row <= 3; row += 2) {
                for (let col = -5; col <= 5; col += 1.8) {
                    const plant = new THREE.Mesh(new THREE.SphereGeometry(0.3, 4, 4), this.materials.treeLeaf);
                    plant.position.set(cx + col, 0.4, cz + row);
                    plant.scale.set(1.2 + this.random() * 0.3, 0.7 + this.random() * 0.3, 1.2 + this.random() * 0.3);
                    plant.castShadow = true;
                    ruralGroup.add(plant);
                }
            }
        }

        this.castleGroup.add(ruralGroup);
    }

    private buildRuralVillageLayout(bounds: number) {
        const paths = [
            new THREE.Vector3(-bounds * 0.6, 0.1, 0),
            new THREE.Vector3(0, 0.1, -bounds * 0.2),
            new THREE.Vector3(bounds * 0.6, 0.1, 0)
        ];

        paths.forEach((p, idx) => {
            if (idx < paths.length - 1) {
                const p1 = paths[idx];
                const p2 = paths[idx + 1];
                const len = p1.distanceTo(p2);
                const pathGeo = new THREE.BoxGeometry(6, 0.15, len);
                const pathMesh = new THREE.Mesh(pathGeo, this.materials.dirt);
                pathMesh.position.copy(p1).add(p2).multiplyScalar(0.5);
                pathMesh.position.y = 0.05;
                pathMesh.lookAt(p2);
                pathMesh.rotation.x = 0;
                pathMesh.receiveShadow = true;
                this.castleGroup.add(pathMesh);
            }
        });

        if (this.params.buildingStyle === 'japanese') {
            const torii = this.buildToriiGate(0, 0, -bounds * 0.2);
            this.castleGroup.add(torii);
        } else if (this.params.buildingStyle === 'european_coastal') {
            const windmill = this.buildScenicWindmill(0, 0, -bounds * 0.2);
            this.castleGroup.add(windmill);
        } else {
            const ancientTree = this.buildWizardTree(0, 0, -bounds * 0.2);
            this.castleGroup.add(ancientTree);
        }

        const housePlacements = [
            { x: -bounds * 0.45, z: bounds * 0.3, angle: Math.PI / 6 },
            { x: -bounds * 0.3, z: -bounds * 0.4, angle: -Math.PI / 4 },
            { x: -bounds * 0.15, z: bounds * 0.4, angle: Math.PI },
            { x: bounds * 0.2, z: bounds * 0.4, angle: Math.PI * 1.1 },
            { x: bounds * 0.35, z: -bounds * 0.35, angle: -Math.PI / 3 },
            { x: bounds * 0.5, z: bounds * 0.25, angle: Math.PI / 4 },
            { x: -bounds * 0.55, z: -bounds * 0.1, angle: Math.PI / 2 }
        ];

        housePlacements.forEach(pos => {
            const house = this.buildHouse(pos.x, 0, pos.z, pos.angle);
            this.castleGroup.add(house);

            if (this.random() > 0.3) {
                const offsetDist = 3.5;
                const lampAngle = pos.angle + (this.random() > 0.5 ? Math.PI/3 : -Math.PI/3);
                const lx = pos.x + Math.cos(lampAngle) * offsetDist;
                const lz = pos.z + Math.sin(lampAngle) * offsetDist;
                this.streetLampPositions.push(new THREE.Vector3(lx, 0, lz));
            }
        });

        this.scatterNature(bounds);
    }

    private buildToriiGate(x: number, y: number, z: number) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        const toriiRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.8 });

        const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 9, 8), toriiRed);
        p1.position.set(-3.5, 4.5, 0);
        p1.castShadow = true;
        p1.receiveShadow = true;
        group.add(p1);

        const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 9, 8), toriiRed);
        p2.position.set(3.5, 4.5, 0);
        p2.castShadow = true;
        p2.receiveShadow = true;
        group.add(p2);

        const nuki = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.4, 0.4), toriiRed);
        nuki.position.set(0, 7.2, 0);
        nuki.castShadow = true;
        group.add(nuki);

        const lintelGeo = new THREE.BoxGeometry(11.0, 0.6, 0.7);
        const lintel = new THREE.Mesh(lintelGeo, toriiRed);
        lintel.position.set(0, 8.8, 0);
        lintel.castShadow = true;
        group.add(lintel);

        const endL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.7), toriiRed);
        endL.position.set(-5.6, 9.0, 0);
        endL.rotation.z = Math.PI / 12;
        group.add(endL);

        const endR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.7), toriiRed);
        endR.position.set(5.6, 9.0, 0);
        endR.rotation.z = -Math.PI / 12;
        group.add(endR);

        const tablet = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.5), this.materials.woodDark);
        tablet.position.set(0, 8.0, 0);
        tablet.castShadow = true;
        group.add(tablet);

        for (let l = 0; l < 2; l++) {
            const side = l === 0 ? -6 : 6;
            const lantern = this.buildStoneLantern(side, 0, 2);
            group.add(lantern);
        }

        return group;
    }

    private buildStoneLantern(x: number, y: number, z: number) {
        const lanternGroup = new THREE.Group();
        lanternGroup.position.set(x, y, z);

        const stone = this.materials.stoneAccent;

        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.5, 6), stone);
        p.position.y = 1.25;
        p.castShadow = true;
        lanternGroup.add(p);

        const fb = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), stone);
        fb.position.y = 2.8;
        fb.castShadow = true;
        lanternGroup.add(fb);

        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), this.materials.windowLit);
        bulb.position.set(0, 2.8, 0);
        lanternGroup.add(bulb);

        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.2, 0.6, 6), stone);
        cap.position.y = 3.5;
        cap.castShadow = true;
        lanternGroup.add(cap);

        return lanternGroup;
    }

    private buildScenicWindmill(x: number, y: number, z: number) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        const baseH = 14;
        const towerGeo = new THREE.CylinderGeometry(2.2, 3.5, baseH, 8);
        const stuccoMat = new THREE.MeshStandardMaterial({
            color: 0xfef3c7,
            roughness: 0.9,
            flatShading: this.params.lowPoly
        });
        const tower = new THREE.Mesh(towerGeo, stuccoMat);
        tower.position.y = baseH / 2;
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);

        const bal = this.createJapaneseBalcony(5.0, 5.0);
        bal.position.y = baseH - 3;
        group.add(bal);

        const dome = new THREE.Mesh(new THREE.SphereGeometry(2.3, 8, 8, 0, Math.PI*2, 0, Math.PI/2), this.materials.roof);
        dome.position.y = baseH;
        dome.castShadow = true;
        group.add(dome);

        const sailsGroup = new THREE.Group();
        sailsGroup.position.set(0, baseH + 0.5, 2.6);
        sailsGroup.rotation.z = Math.PI / 4;

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.0, 6), this.materials.woodDark);
        hub.rotation.x = Math.PI/2;
        sailsGroup.add(hub);

        for (let s = 0; s < 4; s++) {
            const rotZ = (Math.PI / 2) * s;
            const armGroup = new THREE.Group();
            armGroup.rotation.z = rotZ;

            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 8.0, 0.2), this.materials.woodDark);
            arm.position.y = 4.0;
            arm.castShadow = true;
            armGroup.add(arm);

            const lattice = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5.0, 0.05), new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.9,
                transparent: true,
                opacity: 0.85
            }));
            lattice.position.set(0.7, 4.5, 0.1);
            lattice.rotation.y = 0.15;
            lattice.castShadow = true;
            armGroup.add(lattice);

            sailsGroup.add(armGroup);
        }

        group.add(sailsGroup);

        return group;
    }

    private buildWizardTree(x: number, y: number, z: number) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        const trunkGeo = new THREE.CylinderGeometry(1.2, 2.8, 12, 8);
        const trunk = new THREE.Mesh(trunkGeo, this.materials.treeTrunk);
        trunk.position.y = 6;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        const folGeo = new THREE.IcosahedronGeometry(6.0, 1);
        const foliage = new THREE.Mesh(folGeo, this.materials.treeLeaf);
        foliage.position.set(0, 13, 0);
        foliage.scale.set(1.4, 1.0, 1.4);
        foliage.castShadow = true;
        group.add(foliage);

        const folS1 = new THREE.Mesh(new THREE.IcosahedronGeometry(4.0, 0), this.materials.treeLeaf);
        folS1.position.set(-3.5, 10, -2);
        folS1.castShadow = true;
        group.add(folS1);

        const folS2 = new THREE.Mesh(new THREE.IcosahedronGeometry(4.0, 0), this.materials.treeLeaf);
        folS2.position.set(3.5, 10, 2);
        folS2.castShadow = true;
        group.add(folS2);

        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const lx = Math.cos(angle) * 4.5;
            const lz = Math.sin(angle) * 4.5;

            const lamp = new THREE.Group();
            const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 4), this.materials.woodDark);
            wire.position.y = 1.0;
            lamp.add(wire);

            const glow = new THREE.Mesh(new THREE.SphereGeometry(0.6, 6, 6), this.materials.crystal);
            glow.position.y = 0;
            lamp.add(glow);

            lamp.position.set(lx, 8, lz);
            group.add(lamp);
        }

        const numCrys = 4;
        for (let i = 0; i < numCrys; i++) {
            const angle = (i / numCrys) * Math.PI * 2 + 0.3;
            const cx = Math.cos(angle) * 3.5;
            const cz = Math.sin(angle) * 3.5;

            const crys = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.2, 4), this.materials.crystal);
            crys.position.set(cx, 1.1, cz);
            crys.rotation.set(0.3, angle, 0.3);
            crys.castShadow = true;
            group.add(crys);
        }

        return group;
    }

    private buildCoastalHarborLayout(bounds: number) {
        const keep = this.buildCentralKeep(0, 10, -bounds * 0.4);
        this.castleGroup.add(keep);

        const placements = [
            { x: -bounds * 0.4, y: 6, z: -bounds * 0.1, angle: Math.PI / 4 },
            { x: bounds * 0.4, y: 6, z: -bounds * 0.1, angle: -Math.PI / 4 },
            { x: -bounds * 0.25, y: 8, z: -bounds * 0.3, angle: Math.PI / 6 },
            { x: bounds * 0.25, y: 8, z: -bounds * 0.3, angle: -Math.PI / 6 },

            { x: -bounds * 0.5, y: 0, z: bounds * 0.1, angle: Math.PI / 3 },
            { x: bounds * 0.5, y: 0, z: bounds * 0.1, angle: -Math.PI / 3 },
            { x: -bounds * 0.2, y: 0, z: bounds * 0.05, angle: Math.PI / 12 },
            { x: bounds * 0.2, y: 0, z: bounds * 0.05, angle: -Math.PI / 12 },

            { x: -bounds * 0.35, y: -6, z: bounds * 0.35, angle: Math.PI / 3.5 },
            { x: bounds * 0.35, y: -6, z: bounds * 0.35, angle: -Math.PI / 3.5 },
            { x: -bounds * 0.12, y: -6, z: bounds * 0.35, angle: 0 },
            { x: bounds * 0.12, y: -6, z: bounds * 0.35, angle: 0 }
        ];

        placements.forEach((pos, idx) => {
            const house = this.buildHouse(pos.x, pos.y, pos.z, pos.angle);
            this.castleGroup.add(house);

            if (idx % 3 === 1) {
                const lx = pos.x + Math.cos(pos.angle - Math.PI/3) * 4;
                const lz = pos.z + Math.sin(pos.angle - Math.PI/3) * 4;
                this.streetLampPositions.push(new THREE.Vector3(lx, pos.y, lz));
            }
        });

        const hasClockTower = this.random() > 0.3;
        if (hasClockTower) {
            const ct = this.buildClockTower(-bounds * 0.6, 6, -bounds * 0.3, Math.PI / 4);
            this.castleGroup.add(ct);
        }

        const stairSteps = 24;
        for (let s = 0; s < stairSteps; s++) {
            const t = s / stairSteps;
            const sx = Math.sin(t * Math.PI) * 5;
            const sz = -bounds * 0.5 + t * (bounds * 0.4);
            const sy = -10 + t * 20;

            const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 1.2), this.materials.stoneAccent);
            stepMesh.position.set(sx, sy, sz);
            stepMesh.castShadow = true;
            stepMesh.receiveShadow = true;
            this.castleGroup.add(stepMesh);
        }

        this.scatterNature(bounds * 0.8);
    }

    private scatterNature(bounds: number) {
        const density = this.params.complexity;
        const numTrees = 12 + density * 3;
        const numRocks = 8 + density * 2;

        const isJapanese = this.params.buildingStyle === 'japanese';

        for (let i = 0; i < numTrees; i++) {
            const tree = this.createTree();

            const angle = this.random() * Math.PI * 2;
            const dist = bounds * (0.3 + this.random() * 0.65);
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;

            let y = 0;

            tree.position.set(x, y, z);

            const scale = 0.5 + this.random() * 1.5;
            tree.scale.set(scale, scale * (0.85 + this.random() * 0.3), scale);
            tree.rotation.y = this.random() * Math.PI * 2;

            if (isJapanese && this.random() > 0.4) {
                const cherryMat = new THREE.MeshStandardMaterial({
                    color: this.random() > 0.5 ? 0xfbcfe8 : 0xf472b6,
                    roughness: 0.9,
                    flatShading: this.params.lowPoly
                });
                tree.children.forEach(child => {
                    if (child instanceof THREE.Mesh && child.position.y > 1.0) {
                        child.material = cherryMat;
                    }
                });
            }

            this.castleGroup.add(tree);
        }

        for (let i = 0; i < numRocks; i++) {
            const rock = this.createRock();
            const angle = this.random() * Math.PI * 2;
            const dist = bounds * (0.2 + this.random() * 0.7);
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;

            let y = -0.5;

            rock.position.set(x, y, z);

            const scale = 0.6 + this.random() * 1.8;
            rock.scale.set(scale * (0.8 + this.random() * 0.4), scale, scale * (0.8 + this.random() * 0.4));
            rock.rotation.set(this.random(), this.random(), this.random());

            this.castleGroup.add(rock);
        }
    }

    private generateStreetLamps() {
        if (this.streetLampPositions.length === 0) {
            const bounds = 25;
            const numLamps = 4;
            for (let i = 0; i < numLamps; i++) {
                const angle = (i / numLamps) * Math.PI * 2 + 0.2;
                const x = Math.cos(angle) * bounds;
                const z = Math.sin(angle) * bounds;
                let y = 0;
                this.streetLampPositions.push(new THREE.Vector3(x, y, z));
            }
        }

        const lampGroup = new THREE.Group();
        lampGroup.name = 'street_lamps';

        this.streetLampPositions.forEach((pos) => {
            const lamp = new THREE.Group();
            lamp.position.copy(pos);

            const postGeo = new THREE.CylinderGeometry(0.08, 0.12, 3.5, 6);
            const post = new THREE.Mesh(postGeo, this.materials.woodDark);
            post.position.y = 1.75;
            post.castShadow = true;
            post.receiveShadow = true;
            lamp.add(post);

            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.1), this.materials.woodDark);
            arm.position.set(0.3, 3.4, 0);
            arm.castShadow = true;
            lamp.add(arm);

            const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.5, 6), this.materials.stoneAccent);
            lantern.position.set(0.6, 3.1, 0);
            lantern.castShadow = true;
            lamp.add(lantern);

            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), this.materials.windowLit);
            bulb.position.set(0.6, 3.1, 0);
            lamp.add(bulb);

            const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.3, 0.1, 6), this.materials.woodDark);
            cap.position.set(0.6, 3.35, 0);
            cap.castShadow = true;
            lamp.add(cap);

            const pLight = new THREE.PointLight(0xffb74d, 1.8, 12);
            pLight.position.set(0.6, 3.0, 0);
            pLight.castShadow = true;
            lamp.add(pLight);

            lampGroup.add(lamp);
        });

        this.castleGroup.add(lampGroup);
    }

    private buildFairyTaleCastle(bounds: number) {
        const layoutScale = Math.max(this.params.baseWidthScale, this.params.baseLengthScale);

        // Register keep bounds for collision avoidance
        const keepW = (20 + this.params.complexity * 1.5) * 0.6 * this.params.baseWidthScale;
        const keepD = (20 + this.params.complexity * 1.5) * 0.6 * this.params.baseLengthScale;
        const keepH = this.params.keepHeight * 1.5;
        this.registerBounds(new THREE.Vector3(0, 0, -5), new THREE.Vector3(keepW / 2, keepH, keepD / 2));

        const keep = this.buildCentralKeep(0, 0, -5);
        this.castleGroup.add(keep);

        // Echauguettes on keep
        if (this.params.echauguettes) {
            const ecOffsets = [
                [keepW / 2, keepD / 2], [keepW / 2, -keepD / 2],
                [-keepW / 2, keepD / 2], [-keepW / 2, -keepD / 2]
            ];
            ecOffsets.forEach(([ex, ez]) => {
                const ec = this.createEchauguette(1.2, keepH * 0.25);
                ec.position.set(ex, keepH * 0.75, ez);
                keep.add(ec);
            });
        }

        // Dramatic fairytale tower cluster — pyramidal silhouette with height hierarchy
        const numTowers = this.params.complexity + 4;
        const towersData: {x: number, y: number, z: number, h: number}[] = [];
        const placedTowers: {x: number, z: number, r: number}[] = [];

        // Sort towers into tiers: 2 grand spires, several medium, rest are small
        const towerTiers: {radiusRange: [number, number], heightMult: [number, number], distRange: [number, number]}[] = [];
        for (let i = 0; i < numTowers; i++) {
            if (i < 2) {
                // Grand spires — very tall, thin, close to keep
                towerTiers.push({ radiusRange: [1.8, 2.8], heightMult: [1.4, 2.0], distRange: [0, 4] });
            } else if (i < 5) {
                // Medium towers — moderate height, clustered nearby
                towerTiers.push({ radiusRange: [1.5, 2.5], heightMult: [0.7, 1.2], distRange: [2, 10] });
            } else {
                // Small flanking towers — short, further out, creating cascading silhouette
                towerTiers.push({ radiusRange: [1.0, 2.0], heightMult: [0.3, 0.7], distRange: [6, 18] });
            }
        }

        for (let i = 0; i < numTowers; i++) {
            const tier = towerTiers[i];
            let tx = 0, tz = 0, r = 0, th = 0;
            let found = false;

            for (let attempt = 0; attempt < 60; attempt++) {
                const angleJitter = (attempt > 30) ? (this.random() * Math.PI * 2) : (this.random() * 0.8 - 0.4);
                const angle = (Math.PI * 2 / numTowers) * i + angleJitter;
                const keepRadius = keepW / 2;
                const distMin = keepRadius + tier.distRange[0];
                const distMax = keepRadius + tier.distRange[1];
                const dist = distMin + this.random() * (distMax - distMin);
                tx = Math.cos(angle) * dist;
                tz = Math.sin(angle) * dist - 5;

                r = tier.radiusRange[0] + this.random() * (tier.radiusRange[1] - tier.radiusRange[0]);
                th = this.params.keepHeight * (tier.heightMult[0] + this.random() * (tier.heightMult[1] - tier.heightMult[0]));

                let overlap = false;
                for (const other of placedTowers) {
                    const ddx = tx - other.x;
                    const ddz = tz - other.z;
                    const distSq = ddx*ddx + ddz*ddz;
                    const minDist = (r + other.r) * 1.1 + 1.0;
                    if (distSq < minDist * minDist) { overlap = true; break; }
                }
                if (!overlap) { found = true; break; }
            }

            if (found) {
                placedTowers.push({ x: tx, z: tz, r: r });
                const tower = this.buildTower(tx, 0, tz, r, th, 'round');
                this.castleGroup.add(tower);
                towersData.push({x: tx, y: th * 0.7, z: tz, h: th});

                // Attach mini-turrets to grand and medium towers
                if (i < 5 && this.random() > 0.3 && r > 1.5) {
                    const toKeepX = tx;
                    const toKeepZ = tz + 5;
                    const len = Math.sqrt(toKeepX*toKeepX + toKeepZ*toKeepZ) || 1;
                    const dx = toKeepX / len;
                    const dz = toKeepZ / len;

                    const tr = r * 0.45;
                    const th2 = th * (0.35 + this.random() * 0.2);
                    const turretX = tx + dx * (r + tr * 0.5);
                    const turretZ = tz + dz * (r + tr * 0.5);
                    const turret = this.buildTower(turretX, th * 0.4, turretZ, tr, th2, 'round');
                    this.castleGroup.add(turret);
                }

                // Add buttress walls connecting nearby small towers to the keep base
                if (i >= 5 && this.random() > 0.5) {
                    const wallLen = Math.sqrt(tx*tx + (tz+5)*(tz+5));
                    if (wallLen > 5 && wallLen < 25) {
                        const wallH = th * 0.3;
                        const wallGeom = new THREE.BoxGeometry(1.2, wallH, wallLen);
                        const wall = new THREE.Mesh(wallGeom, this.materials.stone);
                        wall.position.set(tx / 2, wallH / 2, (tz - 5) / 2 - 5);
                        wall.rotation.y = -Math.atan2(tz + 5, tx);
                        wall.castShadow = true;
                        this.castleGroup.add(wall);
                    }
                }
            }
        }
        
        // Add connecting building masses between nearby towers — creates the organic clustered look
        for (let i = 0; i < placedTowers.length; i++) {
            for (let j = i + 1; j < placedTowers.length; j++) {
                const a = placedTowers[i];
                const b = placedTowers[j];
                const ddx = b.x - a.x;
                const ddz = b.z - a.z;
                const dist = Math.sqrt(ddx*ddx + ddz*ddz);
                if (dist < 12 && this.random() > 0.35) {
                    const midX = (a.x + b.x) / 2;
                    const midZ = (a.z + b.z) / 2;
                    const angle = Math.atan2(ddz, ddx);
                    const aData = towersData.find(t => Math.abs(t.x - a.x) < 0.5 && Math.abs(t.z - a.z) < 0.5);
                    const bData = towersData.find(t => Math.abs(t.x - b.x) < 0.5 && Math.abs(t.z - b.z) < 0.5);
                    const minH = Math.min(aData?.h || 20, bData?.h || 20);
                    const blockH = minH * (0.25 + this.random() * 0.2);
                    const blockW = Math.max(a.r, b.r) * 1.8;
                    const blockGeom = new THREE.BoxGeometry(blockW, blockH, dist * 0.85);
                    const block = new THREE.Mesh(blockGeom, this.materials.stone);
                    block.position.set(midX, blockH / 2, midZ);
                    block.rotation.y = -angle;
                    block.castShadow = true;
                    block.receiveShadow = true;
                    this.castleGroup.add(block);

                    // Pitched roof on connecting block
                    const roofH = blockW * 0.6;
                    const roofShape = new THREE.Shape();
                    roofShape.moveTo(-blockW * 0.55, 0);
                    roofShape.lineTo(blockW * 0.55, 0);
                    roofShape.lineTo(0, roofH);
                    roofShape.lineTo(-blockW * 0.55, 0);
                    const roofGeom = new THREE.ExtrudeGeometry(roofShape, { depth: dist * 0.85, bevelEnabled: false });
                    roofGeom.center();
                    const roof = new THREE.Mesh(roofGeom, this.materials.roof);
                    roof.position.set(midX, blockH + roofH / 2, midZ);
                    roof.rotation.y = -angle;
                    roof.castShadow = true;
                    this.castleGroup.add(roof);

                    // Parapet / crenellation on top of connecting wall
                    const crenW = 0.6;
                    const crenH = 1.2;
                    for (let c = 0; c < 4; c++) {
                        const frac = (c + 0.5) / 4;
                        const cx = a.x + ddx * frac;
                        const cz = a.z + ddz * frac;
                        const merlon = new THREE.Mesh(new THREE.BoxGeometry(crenW, crenH, crenW), this.materials.stoneAccent);
                        merlon.position.set(cx, blockH + crenH / 2, cz);
                        this.castleGroup.add(merlon);
                    }
                }
            }
        }

        // Add connecting bridges between random towers
        for (let i = 0; i < 3; i++) {
            if (towersData.length < 2) break;
            const t1 = towersData[Math.floor(this.random() * towersData.length)];
            let t2 = towersData[Math.floor(this.random() * towersData.length)];
            if (t1 !== t2) {
                const bHeight = Math.min(t1.y, t2.y) * 0.8;
                if (this.params.archedBridges) {
                    const bridge = this.createArchedSkybridge(t1.x, bHeight, t1.z, t2.x, bHeight, t2.z);
                    this.castleGroup.add(bridge);
                } else {
                    const dip = Math.min(5, bHeight * 0.2);
                    const bridgeCurve = new THREE.QuadraticBezierCurve3(
                        new THREE.Vector3(t1.x, bHeight, t1.z),
                        new THREE.Vector3((t1.x + t2.x)/2, bHeight - dip, (t1.z + t2.z)/2),
                        new THREE.Vector3(t2.x, bHeight, t2.z)
                    );
                    const bridgeGeom = new THREE.TubeGeometry(bridgeCurve, 16, 1.2, 6, false);
                    const bridge = new THREE.Mesh(bridgeGeom, this.materials.stoneAccent);
                    bridge.castShadow = true;
                    this.castleGroup.add(bridge);
                }
            }
        }

        // Add a floating tower!
        if (this.params.floatingIslands && this.random() > 0.2) {
            const floatY = this.params.keepHeight * (1.2 + this.random() * 0.4);
            const floatDist = bounds * (0.8 + this.random() * 0.4);
            const floatAngle = this.random() * Math.PI * 2;
            const floatX = Math.cos(floatAngle) * floatDist;
            const floatZ = Math.sin(floatAngle) * floatDist - 5;
            
            // Floating Cloud Base instead of dirt island
            const cloudBaseGroup = new THREE.Group();
            
            const mainCloudRadius = 7 + this.random() * 3;
            const mainCloudGeom = new THREE.IcosahedronGeometry(mainCloudRadius, this.params.lowPoly ? 0 : 1);
            const mainCloud = new THREE.Mesh(mainCloudGeom, this.materials.cloud);
            mainCloud.position.set(floatX, floatY, floatZ);
            mainCloud.scale.set(1.7, 0.75, 1.7);
            mainCloud.castShadow = true;
            mainCloud.receiveShadow = true;
            cloudBaseGroup.add(mainCloud);
            
            // Surrounding cloud puffs for extra fluffy cloud-like look
            const numPuffs = 6;
            for (let j = 0; j < numPuffs; j++) {
                const pAngle = (j / numPuffs) * Math.PI * 2;
                const pDist = mainCloudRadius * (0.55 + this.random() * 0.25);
                const px = floatX + Math.cos(pAngle) * pDist;
                const pz = floatZ + Math.sin(pAngle) * pDist;
                const pRadius = mainCloudRadius * (0.45 + this.random() * 0.35);
                
                const puffGeom = new THREE.IcosahedronGeometry(pRadius, this.params.lowPoly ? 0 : 1);
                const puff = new THREE.Mesh(puffGeom, this.materials.cloud);
                puff.position.set(px, floatY - pRadius * 0.25, pz);
                puff.scale.set(1.5, 0.7, 1.5);
                puff.castShadow = true;
                puff.receiveShadow = true;
                cloudBaseGroup.add(puff);
            }
            this.castleGroup.add(cloudBaseGroup);
            
            // Floating Tower (rests perfectly on top of the cloud base)
            const floatTower = this.buildTower(floatX, floatY + 2.0, floatZ, 4 + this.random() * 2, this.params.keepHeight * 0.6, 'round');
            this.castleGroup.add(floatTower);
        }
        
        // Add glowing floating crystals around the base
        if (this.params.magicCrystals) {
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI / 4) * i;
                const dist = bounds * (0.4 + this.random() * 0.3);
                const cx = Math.cos(angle) * dist;
                const cz = Math.sin(angle) * dist - 5;
                const cy = 2 + this.random() * 8;
                
                const crystalGroup = new THREE.Group();
                crystalGroup.position.set(cx, cy, cz);
                
                const mainCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(1 + this.random(), 0), this.materials.crystal);
                mainCrystal.scale.y = 2 + this.random();
                mainCrystal.castShadow = true;
                crystalGroup.add(mainCrystal);
                
                // Add a point light to the crystal
                const light = new THREE.PointLight(0x818cf8, 1, 30);
                crystalGroup.add(light);
                
                // Randomly rotate the crystal slowly in the animate loop? We don't have per-object animation easily setup, so just static rotation.
                crystalGroup.rotation.set(this.random(), this.random(), this.random());
                
                this.castleGroup.add(crystalGroup);
            }
        }
        
        // Add a beautiful gatehouse
        const gateGroup = new THREE.Group();
        const gw = 12;
        const gd = 8;
        const gh = 20;
        
        const gateMain = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, gd), this.materials.stone);
        gateMain.position.y = gh / 2;
        gateGroup.add(gateMain);
        
        // Gate Archway Cutout (Simulated with curved top)
        const archW = 6;
        const straightH = 5;
        
        // Rectangular bottom part
        const interiorBox = new THREE.Mesh(new THREE.BoxGeometry(archW, straightH, gd + 0.2), new THREE.MeshBasicMaterial({color: 0x000000}));
        interiorBox.position.y = straightH/2;
        gateGroup.add(interiorBox);

        // Curved top part
        const interiorArchGeom = new THREE.CylinderGeometry(archW/2, archW/2, gd + 0.2, 16, 1, false, 0, Math.PI);
        const interiorArch = new THREE.Mesh(interiorArchGeom, new THREE.MeshBasicMaterial({color: 0x000000}));
        interiorArch.position.set(0, straightH, 0);
        interiorArch.rotation.x = Math.PI / 2;
        gateGroup.add(interiorArch);

        // Thin Stone Arch Trim on Front and Back
        const trimZOffsets = [gd/2 + 0.02, -gd/2 - 0.02];
        trimZOffsets.forEach((zOff) => {
            const trimGeom = new THREE.CylinderGeometry(archW/2 + 0.3, archW/2 + 0.3, 0.4, 16, 1, false, 0, Math.PI);
            const trim = new THREE.Mesh(trimGeom, this.materials.stoneAccent);
            trim.position.set(0, straightH, zOff);
            trim.rotation.x = Math.PI / 2;
            gateGroup.add(trim);

            const sideTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.4, straightH, 0.4), this.materials.stoneAccent);
            sideTrimL.position.set(-archW/2 - 0.1, straightH/2, zOff);
            const sideTrimR = new THREE.Mesh(new THREE.BoxGeometry(0.4, straightH, 0.4), this.materials.stoneAccent);
            sideTrimR.position.set(archW/2 + 0.1, straightH/2, zOff);
            gateGroup.add(sideTrimL, sideTrimR);
        });

        const gateDoor = this.buildDetailedGateDoor(archW, straightH + archW/2);
        gateDoor.position.set(0, 0.01, gd / 2 - 0.4);
        gateGroup.add(gateDoor);
        
        const leftTower = this.buildTower(-gw/2 - 1, 0, 0, 3, gh + 10, 'round');
        const rightTower = this.buildTower(gw/2 + 1, 0, 0, 3, gh + 10, 'round');
        gateGroup.add(leftTower, rightTower);
        
        gateGroup.position.set(0, 0, bounds * 0.8);
        this.castleGroup.add(gateGroup);
        
        // Decorative connecting walls
        const wallDist = bounds * 0.6;
        for (let i = 0; i < 5; i++) {
            const angle = (Math.PI / 5) * i + Math.PI; // back arc
            const p1x = Math.cos(angle) * wallDist;
            const p1z = Math.sin(angle) * wallDist - 5;
            const p2x = Math.cos(angle + Math.PI/5) * wallDist;
            const p2z = Math.sin(angle + Math.PI/5) * wallDist - 5;
            
            this.castleGroup.add(this.buildWall(new THREE.Vector3(p1x, 0, p1z), new THREE.Vector3(p2x, 0, p2z), 15, 3));
            
            // Add a tower at the start of the wall segment
            this.castleGroup.add(this.buildTower(p1x, 0, p1z, 3.5, 20, 'round'));
            
            // Add a tower at the very end of the last wall segment
            if (i === 4) {
                this.castleGroup.add(this.buildTower(p2x, 0, p2z, 3.5, 20, 'round'));
            }
        }
        
        // Connect the ends of the decorative walls to the gatehouse
        const leftEnd = new THREE.Vector3(Math.cos(Math.PI) * wallDist, 0, Math.sin(Math.PI) * wallDist - 5);
        const rightEnd = new THREE.Vector3(Math.cos(2 * Math.PI) * wallDist, 0, Math.sin(2 * Math.PI) * wallDist - 5);
        
        // Gatehouse is at (0, 0, bounds * 0.8)
        // Its width is gw = 12, so the sides are at x = -6 and x = 6
        const gateLeft = new THREE.Vector3(-6, 0, bounds * 0.8);
        const gateRight = new THREE.Vector3(6, 0, bounds * 0.8);
        
        this.castleGroup.add(this.buildWall(leftEnd, gateLeft, 15, 3));
        this.castleGroup.add(this.buildWall(rightEnd, gateRight, 15, 3));
    }

    private buildConcentricCastle(bounds: number) {
        const layoutScale = Math.max(this.params.baseWidthScale, this.params.baseLengthScale);
        const radius = bounds * 0.85 * layoutScale;
        const keepH = this.params.keepHeight;

        const sides = 8;
        const angleStep = (Math.PI * 2) / sides;
        const points: THREE.Vector3[] = [];

        // Base platform
        const platform = new THREE.Mesh(new THREE.CylinderGeometry(radius + 4, radius + 6, 4, sides), this.materials.stoneAccent);
        platform.position.y = 2;
        platform.castShadow = true;
        platform.receiveShadow = true;
        this.castleGroup.add(platform);

        for (let i = 0; i < sides; i++) {
            points.push(new THREE.Vector3(Math.cos(i * angleStep) * radius, 0, Math.sin(i * angleStep) * radius));
        }

        // Track obstacles to prevent clipping
        const placedObstacles: {x: number, z: number, r: number}[] = [];
        
        // Keep
        const keepW = (20 + this.params.complexity * 1.5) * this.params.baseWidthScale;
        const keepD = (20 + this.params.complexity * 1.5) * this.params.baseLengthScale;
        const keepR = Math.max(keepW, keepD) / 2 + 2.0;
        placedObstacles.push({ x: 0, z: -5, r: keepR });
        
        // Outer towers
        for (let i = 0; i < sides; i++) {
            const p = points[i];
            placedObstacles.push({ x: p.x, z: p.z, r: 7.0 }); // radius 5.5 + padding
        }
        
        // Inner concentric towers
        if (this.params.complexity > 7) {
            const innerRadius = radius * 0.6;
            for (let i = 0; i < sides; i++) {
                const ix = Math.cos(i * angleStep) * innerRadius;
                const iz = Math.sin(i * angleStep) * innerRadius;
                placedObstacles.push({ x: ix, z: iz, r: 6.0 }); // radius 4.5 + padding
            }
        }

        // Inner structures (Houses/Barracks) with collision check
        const numHouses = this.params.complexity * 2;
        for (let i = 0; i < numHouses; i++) {
            let hx = 0, hz = 0, hScale = 1.0, hAngle = 0;
            let found = false;
            
            for (let attempt = 0; attempt < 50; attempt++) {
                hAngle = this.random() * Math.PI * 2;
                // House distance should be between keep and outer walls (or between inner and outer walls)
                let minDist = keepR + 4.0;
                let maxDist = radius - 12.0;
                if (this.params.complexity > 7) {
                    // Place some between keep and inner wall, some between inner and outer wall
                    if (this.random() > 0.5) {
                        minDist = (radius * 0.6) + 4.0;
                        maxDist = radius - 12.0;
                    } else {
                        minDist = keepR + 4.0;
                        maxDist = (radius * 0.6) - 6.0;
                    }
                }
                
                if (maxDist <= minDist) {
                    maxDist = minDist + 10;
                }
                
                const hDist = minDist + this.random() * (maxDist - minDist);
                hx = Math.cos(hAngle) * hDist;
                hz = Math.sin(hAngle) * hDist;
                hScale = 0.7 + this.random() * 0.4;
                const houseRadius = hScale * 5.5; // footprint radius
                
                // Check overlap with any obstacle
                let overlap = false;
                for (const obs of placedObstacles) {
                    const dx = hx - obs.x;
                    const dz = hz - obs.z;
                    const distSq = dx*dx + dz*dz;
                    const minAllowed = houseRadius + obs.r;
                    if (distSq < minAllowed * minAllowed) {
                        overlap = true;
                        break;
                    }
                }
                
                if (!overlap) {
                    found = true;
                    // Add to obstacles so other houses don't overlap with this one!
                    placedObstacles.push({ x: hx, z: hz, r: houseRadius + 1.5 });
                    break;
                }
            }
            
            if (found) {
                this.castleGroup.add(this.buildHouse(hx, 0, hz, hAngle + Math.PI/2, hScale));
            }
        }

        for (let i = 0; i < sides; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % sides];
            
            const isGate = i === 0;

            if (isGate) {
                const center = p1.clone().lerp(p2, 0.5);
                const angle = Math.atan2(p2.x - p1.x, p2.z - p1.z); // Outward normal
                this.castleGroup.add(this.buildGatehouse(center.x, 0, center.z, angle));
                
                const ghWidth = 20;
                const dir = p2.clone().sub(p1).normalize();
                const dist = p1.distanceTo(p2);
                const wallLen = (dist - ghWidth) / 2;
                
                const p1g = p1.clone().add(dir.clone().multiplyScalar(wallLen));
                const p2g = p2.clone().sub(dir.clone().multiplyScalar(wallLen));
                
                this.castleGroup.add(this.buildWall(p1, p1g, 15, 4));
                this.castleGroup.add(this.buildWall(p2g, p2, 15, 4));
            } else {
                this.castleGroup.add(this.buildWall(p1, p2, 15, 4));
            }

            // Tower at vertex
            if (i !== 0 || sides > 4) {
                const tHeight = 25 + this.random() * 15;
                this.castleGroup.add(this.buildTower(p2.x, 0, p2.z, 5.5, tHeight));
            }
        }

        // Inner concentric wall for high complexity
        if (this.params.complexity > 7) {
            const innerRadius = radius * 0.6;
            const innerPoints = [];
            for (let i = 0; i < sides; i++) {
                innerPoints.push(new THREE.Vector3(Math.cos(i * angleStep) * innerRadius, 0, Math.sin(i * angleStep) * innerRadius));
            }
            for (let i = 0; i < sides; i++) {
                const p1 = innerPoints[i];
                const p2 = innerPoints[(i + 1) % sides];
                if (i !== 0) { // Leave inner gate open or just a wall
                    this.castleGroup.add(this.buildWall(p1, p2, 22, 3));
                }
                const tHeight = 35 + this.random() * 10;
                this.castleGroup.add(this.buildTower(p2.x, 0, p2.z, 4.5, tHeight));
            }
        }
    }

    private buildLinearCastle(bounds: number) {
        const layoutScale = Math.max(this.params.baseWidthScale, this.params.baseLengthScale);
        const length = bounds * 2 * layoutScale;
        this.castleGroup.add(this.buildCentralKeep(-length/3, 0, 0));
        
        this.castleGroup.add(this.buildGatehouse(length/3, 0, 0, -Math.PI/2));
        
        // Front wall pieces connecting gatehouse to front towers
        this.castleGroup.add(this.buildWall(new THREE.Vector3(length/3, 0, 15 * layoutScale), new THREE.Vector3(length/3, 0, 9 * layoutScale), 15, 4));
        this.castleGroup.add(this.buildWall(new THREE.Vector3(length/3, 0, -15 * layoutScale), new THREE.Vector3(length/3, 0, -9 * layoutScale), 15, 4));

        this.castleGroup.add(this.buildWall(new THREE.Vector3(-length/3, 0, 15 * layoutScale), new THREE.Vector3(length/3, 0, 15 * layoutScale), 15, 4));
        this.castleGroup.add(this.buildWall(new THREE.Vector3(-length/3, 0, -15 * layoutScale), new THREE.Vector3(length/3, 0, -15 * layoutScale), 15, 4));
        
        // Back wall
        this.castleGroup.add(this.buildWall(new THREE.Vector3(-length/3, 0, -15 * layoutScale), new THREE.Vector3(-length/3, 0, 15 * layoutScale), 15, 4));
        
        this.castleGroup.add(this.buildTower(length/3, 0, 15 * layoutScale, 5, 25));
        this.castleGroup.add(this.buildTower(length/3, 0, -15 * layoutScale, 5, 25));
        this.castleGroup.add(this.buildTower(-length/3, 0, 15 * layoutScale, 5, 30));
        this.castleGroup.add(this.buildTower(-length/3, 0, -15 * layoutScale, 5, 30));

        // Track obstacles to prevent clipping
        const placedObstacles: {x: number, z: number, r: number}[] = [];
        
        // Keep
        const keepW = (20 + this.params.complexity * 1.5) * this.params.baseWidthScale;
        const keepD = (20 + this.params.complexity * 1.5) * this.params.baseLengthScale;
        placedObstacles.push({ x: -length/3, z: 0, r: Math.max(keepW, keepD)/2 + 2.0 });
        
        // Gatehouse
        placedObstacles.push({ x: length/3, z: 0, r: 10.0 });
        
        // Corner towers
        placedObstacles.push({ x: length/3, z: 15, r: 6.0 });
        placedObstacles.push({ x: length/3, z: -15, r: 6.0 });
        placedObstacles.push({ x: -length/3, z: 15, r: 6.0 });
        placedObstacles.push({ x: -length/3, z: -15, r: 6.0 });

        // Add houses along the walls with collision check
        const numHouses = this.params.complexity;
        for(let i=0; i<numHouses; i++) {
            let hx = 0, hz = 0, hScale = 1.0, hAngle = 0;
            let found = false;
            
            for (let attempt = 0; attempt < 50; attempt++) {
                hx = -length/4 + this.random() * (length/2);
                hz = (this.random() > 0.5 ? 1 : -1) * (4 + this.random() * 5); // 4 to 9
                hScale = 0.75 + this.random() * 0.3;
                hAngle = (this.random() > 0.5 ? 0 : Math.PI/2);
                
                const houseRadius = hScale * 5.0;
                
                let overlap = false;
                for (const obs of placedObstacles) {
                    const dx = hx - obs.x;
                    const dz = hz - obs.z;
                    const distSq = dx*dx + dz*dz;
                    const minAllowed = houseRadius + obs.r;
                    if (distSq < minAllowed * minAllowed) {
                        overlap = true;
                        break;
                    }
                }
                
                if (!overlap) {
                    found = true;
                    placedObstacles.push({ x: hx, z: hz, r: houseRadius + 1.5 }); // spacing between houses
                    break;
                }
            }
            
            if (found) {
                this.castleGroup.add(this.buildHouse(hx, 0, hz, hAngle, hScale));
            }
        }
    }

    private buildClusterCastle(bounds: number) {
        const layoutScale = Math.max(this.params.baseWidthScale, this.params.baseLengthScale);
        
        this.castleGroup.add(this.buildCentralKeep(0, 0, 0));
        
        // Track obstacles to prevent clipping
        const placedObstacles: {x: number, z: number, r: number}[] = [];
        
        // Keep
        const keepW = (20 + this.params.complexity * 1.5) * this.params.baseWidthScale;
        const keepD = (20 + this.params.complexity * 1.5) * this.params.baseLengthScale;
        placedObstacles.push({ x: 0, z: 0, r: Math.max(keepW, keepD)/2 + 2.0 });

        const numTowers = this.params.complexity + 3;
        const towers = [];
        for(let i=0; i<numTowers; i++) {
            let x = 0, z = 0, r = 0, h = 0;
            let found = false;
            
            for (let attempt = 0; attempt < 50; attempt++) {
                const angleOffset = (attempt > 20) ? (this.random() * Math.PI * 2) : (this.random() * 0.4 - 0.2);
                const angle = (Math.PI * 2 / numTowers) * i + angleOffset;
                
                const distOffset = (attempt > 20) ? (bounds * 0.6) : (bounds * 0.3);
                const dist = (bounds * 0.7 + this.random() * distOffset) * layoutScale;
                x = Math.cos(angle) * dist;
                z = Math.sin(angle) * dist;
                
                const maxRadius = (attempt > 20) ? 2.0 : 3.0;
                r = 2.0 + this.random() * maxRadius; // 2.0 to 5.0
                h = 25 + this.random() * 45;
                
                let overlap = false;
                for (const obs of placedObstacles) {
                    const dx = x - obs.x;
                    const dz = z - obs.z;
                    const distSq = dx*dx + dz*dz;
                    const minAllowed = (r + obs.r) * 1.2 + 1.5;
                    if (distSq < minAllowed * minAllowed) {
                        overlap = true;
                        break;
                    }
                }
                
                if (!overlap) {
                    found = true;
                    break;
                }
            }
            
            if (found) {
                towers.push(new THREE.Vector3(x, 0, z));
                placedObstacles.push({ x: x, z: z, r: r });
                this.castleGroup.add(this.buildTower(x, 0, z, r, h, 'round', this.materials.roof));
            }
        }
        
        // Add minimal connecting walls for cluster
        if (towers.length >= 2) {
            for (let i = 0; i < towers.length; i++) {
                const p1 = towers[i];
                const p2 = towers[(i + 1) % towers.length];
                
                // Skip a wall occasionally to make it a cluster with gaps, or if it's the first one, make it a gate
                if (i === 0) {
                    const gateP = p1.clone().lerp(p2, 0.5);
                    const angle = Math.atan2(p2.x - p1.x, p2.z - p1.z); // outward normal
                    this.castleGroup.add(this.buildGatehouse(gateP.x, 0, gateP.z, angle));
                    
                    const ghWidth = 20;
                    const dir = p2.clone().sub(p1).normalize();
                    const dist = p1.distanceTo(p2);
                    if (dist > ghWidth) {
                        const wallLen = (dist - ghWidth) / 2;
                        const p1g = p1.clone().add(dir.clone().multiplyScalar(wallLen));
                        const p2g = p2.clone().sub(dir.clone().multiplyScalar(wallLen));
                        this.castleGroup.add(this.buildWall(p1, p1g, 12, 3));
                        this.castleGroup.add(this.buildWall(p2g, p2, 12, 3));
                    }
                } else if (this.random() > 0.15) { // 85% chance to have a wall
                    this.castleGroup.add(this.buildWall(p1, p2, 12 + this.random()*8, 3.5));
                }
            }
        }
        
        // Inside houses with collision check
        for(let i=0; i<this.params.complexity; i++) {
            let hx = 0, hz = 0, hScale = 1.0, hAngle = 0;
            let found = false;
            
            for (let attempt = 0; attempt < 50; attempt++) {
                const hAngleRand = this.random() * Math.PI * 2;
                const hDist = 15 + this.random() * (bounds * 0.35);
                hx = Math.cos(hAngleRand) * hDist;
                hz = Math.sin(hAngleRand) * hDist;
                hScale = 0.6 + this.random() * 0.4;
                const houseRadius = hScale * 5.0;
                
                let overlap = false;
                for (const obs of placedObstacles) {
                    const dx = hx - obs.x;
                    const dz = hz - obs.z;
                    const distSq = dx*dx + dz*dz;
                    const minAllowed = houseRadius + obs.r;
                    if (distSq < minAllowed * minAllowed) {
                        overlap = true;
                        break;
                    }
                }
                
                if (!overlap) {
                    found = true;
                    placedObstacles.push({ x: hx, z: hz, r: houseRadius + 1.5 });
                    break;
                }
            }
            
            if (found) {
                this.castleGroup.add(this.buildHouse(hx, 0, hz, this.random() * Math.PI, hScale));
            }
        }
    }

    public exportToGLTF() {
        const exporter = new GLTFExporter();
        const isBinary = this.params.exportFormat === 'glb';
        const compressionSetting = this.params.dracoCompression;

        const options: any = {
            binary: isBinary,
            embedImages: true
        };

        if (compressionSetting !== 'off') {
            const compLevel = compressionSetting === 'high' ? 10 : (compressionSetting === 'med' ? 6 : 3);
            options.dracoOptions = {
                compressionLevel: compLevel
            };
            options.dracoExporter = new DRACOExporter();
        }

        exporter.parse(
            this.castleGroup,
            (result) => {
                const ext = isBinary ? 'glb' : 'gltf';
                const filename = `fairytale_castle_${compressionSetting}_compressed.${ext}`;
                if (result instanceof ArrayBuffer) {
                    this.downloadBuffer(result, filename, 'application/octet-stream');
                } else {
                    const output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                    this.downloadFile(output, filename, 'application/json');
                }
            },
            (error) => {
                console.error('An error occurred during 3D export:', error);
            },
            options
        );
    }

    public exportToHTML = () => {
        const exporter = new GLTFExporter();
        
        // Exclude terrain, trees, and rocks by cloning non-landscape children
        const exportGroup = new THREE.Group();
        this.castleGroup.children.forEach(child => {
            if (child.name !== 'terrain' && child.name !== 'sway_tree' && child.name !== 'rock') {
                exportGroup.add(child.clone());
            }
        });

        exporter.parse(
            exportGroup,
            (gltf) => {
                const gltfOutput = typeof gltf === 'string' ? gltf : JSON.stringify(gltf);
                const gltfSafe = gltfOutput.replace(/<\/script>/g, '<\\/script>');
                
                // Fetch current scene colors and parameters
                const skyColorHex = '#' + (this.scene.background as THREE.Color).getHexString();
                const dirLightColorHex = '#' + this.dirLight.color.getHexString();
                const dirLightIntensity = this.dirLight.intensity;
                const warmLightColorHex = '#' + this.warmLight.color.getHexString();
                const warmLightIntensity = this.warmLight.intensity;
                
                let fogDensity = 0.002;
                if (this.scene.fog instanceof THREE.FogExp2) {
                    fogDensity = this.scene.fog.density;
                }

                const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Procedural Castle - Standalone Interactive View</title>
    <style>
        body {
            margin: 0;
            overflow: hidden;
            background-color: ${skyColorHex};
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            user-select: none;
            -webkit-user-select: none;
        }
        #canvas {
            width: 100vw;
            height: 100vh;
            display: block;
        }
        #ui-overlay {
            position: absolute;
            top: 24px;
            left: 24px;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            padding: 16px 24px;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.5);
            pointer-events: auto;
            max-width: 320px;
            transition: opacity 0.3s ease;
        }
        h1 {
            margin: 0 0 4px 0;
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
            letter-spacing: -0.5px;
        }
        p {
            margin: 0 0 12px 0;
            font-size: 12px;
            color: #7f8c8d;
            line-height: 1.4;
        }
        .control-hint {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            color: #57606f;
            margin-bottom: 6px;
        }
        .control-hint:last-child {
            margin-bottom: 0;
        }
        .lil-gui select {
            background-color: #1e1e2d !important;
            color: #ffffff !important;
            border: 1px solid #4f4f70 !important;
            border-radius: 4px !important;
        }
        .lil-gui select option {
            background-color: #1e1e2d !important;
            color: #ffffff !important;
        }
        .control-icon {
            font-size: 14px;
            width: 20px;
            text-align: center;
        }
        #toggle-ui {
            position: absolute;
            top: 24px;
            right: 24px;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            font-size: 16px;
            transition: all 0.2s ease;
        }
        #toggle-ui:hover {
            transform: scale(1.05);
            background: #ffffff;
        }
    </style>
</head>
<body>
    <canvas id="canvas"></canvas>
    
    <div id="ui-overlay">
        <h1>🏡 Procedural Castle</h1>
        <p>Interactive standalone 3D visualization. Take a peaceful walk through the procedural architecture.</p>
        <div style="border-top: 1px solid rgba(0,0,0,0.06); padding-top: 10px; margin-top: 10px;">
            <div class="control-hint"><span class="control-icon">🖱️</span> Left Click + Drag to Rotate</div>
            <div class="control-hint"><span class="control-icon">✋</span> Right Click + Drag to Pan</div>
            <div class="control-hint"><span class="control-icon">📜</span> Scroll to Zoom</div>
        </div>
    </div>

    <div id="toggle-ui" title="Toggle UI Overlay">👁️</div>

    <script type="importmap">
      {
        "imports": {
          "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
          "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
        }
      }
    </script>

    <script id="gltf-data" type="application/json">${gltfSafe}</script>

    <script type="module">
        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

        // --- Scene Setup ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('${skyColorHex}');
        scene.fog = new THREE.FogExp2('${skyColorHex}', ${fogDensity});

        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
        camera.position.set(0, 60, 120);

        const canvas = document.getElementById('canvas');
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
        controls.target.set(0, 15, 0);

        // --- Lighting ---
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x446644, 0.75);
        hemiLight.position.set(0, 200, 0);
        scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight('${dirLightColorHex}', ${dirLightIntensity});
        dirLight.position.set(80, 120, 60);
        dirLight.castShadow = true;
        dirLight.shadow.camera.top = 250;
        dirLight.shadow.camera.bottom = -250;
        dirLight.shadow.camera.left = -250;
        dirLight.shadow.camera.right = 250;
        dirLight.shadow.mapSize.width = 4096;
        dirLight.shadow.mapSize.height = 4096;
        dirLight.shadow.bias = -0.0005;
        scene.add(dirLight);

        const warmLight = new THREE.PointLight('${warmLightColorHex}', ${warmLightIntensity}, 80);
        warmLight.position.set(0, 8, 0);
        scene.add(warmLight);

        // --- Load Embedded Model ---
        const gltfDataText = document.getElementById('gltf-data').textContent;
        const gltfData = JSON.parse(gltfDataText);

        const swayObjects = [];

        const loader = new GLTFLoader();
        loader.parse(JSON.stringify(gltfData), '', (gltf) => {
            const model = gltf.scene;
            
            // Enable casting and receiving shadows and configure Toon/Sway properties
            model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
                
                // Detect named sway groups
                if (node.name === 'sway_tree' || node.name === 'sway_bush') {
                    swayObjects.push({
                        object: node,
                        speed: node.name === 'sway_tree' ? (1.0 + this.random() * 0.5) : (2.0 + this.random() * 1.0),
                        amp: node.name === 'sway_tree' ? (0.015 + this.random() * 0.01) : (0.03 + this.random() * 0.02),
                        offset: this.random() * Math.PI * 2
                    });
                }
            });
            
            scene.add(model);
        }, (error) => {
            console.error('Error parsing GLTF data:', error);
        });

        // --- Animation Loop ---
        function animate_OLD() {
            requestAnimationFrame(animate);
            
            const t = performance.now() * 0.001;
            
            // Animate wind swaying elements
            swayObjects.forEach((obj) => {
                const angleX = Math.sin(t * obj.speed + obj.offset) * obj.amp;
                const angleZ = Math.cos(t * obj.speed + obj.offset) * obj.amp;
                obj.object.rotation.x = angleX;
                obj.object.rotation.z = angleZ;
            });

            controls.update();
            renderer.render(scene, camera);
        }
        animate_OLD();

        // --- Resize Event ---
        // window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // --- Interactivity Controls ---
        const stopAutoRotate = () => {
            controls.autoRotate = false;
            window.removeEventListener('pointerdown', stopAutoRotate);
            window.removeEventListener('wheel', stopAutoRotate);
        };
        window.addEventListener('pointerdown', stopAutoRotate);
        window.addEventListener('wheel', stopAutoRotate);

        // --- Toggle UI Overlay ---
        const toggleBtn = document.getElementById('toggle-ui');
        const uiOverlay = document.getElementById('ui-overlay');
        toggleBtn.addEventListener('click', () => {
            if (uiOverlay.style.opacity === '0') {
                uiOverlay.style.opacity = '1';
                uiOverlay.style.pointerEvents = 'auto';
            } else {
                uiOverlay.style.opacity = '0';
                uiOverlay.style.pointerEvents = 'none';
            }
        });
    </script>
</body>
</html>`;

                const blob = new Blob([htmlContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = 'ghibli-castle.html';
                link.click();
                
                URL.revokeObjectURL(url);
            },
            (error) => {
                console.error('An error occurred while generating standalone HTML:', error);
            },
            {
                binary: false
            }
        );
    };

    // --- Princess & Magical Castle Layouts ---

    private buildPrincessRoyalCastle(bounds: number) {
        const keepH = this.params.keepHeight * 1.4;
        const towerH = this.params.towerHeight;

        // 1. Central Soaring Royal Keep — register bounds
        const keepW = (20 + this.params.complexity * 1.5) * 0.65 * this.params.baseWidthScale;
        const keepD = (20 + this.params.complexity * 1.5) * 0.65 * this.params.baseLengthScale;
        this.registerBounds(new THREE.Vector3(0, 0, 0), new THREE.Vector3(keepW / 2, keepH, keepD / 2));

        const keep = this.buildCentralKeep(0, 0, 0);
        this.castleGroup.add(keep);

        // Finials/rosettes as children of keep (track with parent)
        const keepCrown = this.createTiaraFinial(2.5);
        keepCrown.position.set(0, keepH + 6, 0);
        keep.add(keepCrown);

        const rosette = this.createRosetteWindow(3.5);
        rosette.position.set(0, keepH * 0.6, keepD / 2 + 0.2);
        keep.add(rosette);

        // Echauguettes on keep corners
        if (this.params.echauguettes) {
            const ecOffsets = [
                [keepW / 2, keepD / 2], [keepW / 2, -keepD / 2],
                [-keepW / 2, keepD / 2], [-keepW / 2, -keepD / 2]
            ];
            ecOffsets.forEach(([ex, ez]) => {
                const ec = this.createEchauguette(1.2, keepH * 0.25);
                ec.position.set(ex, keepH * 0.75, ez);
                keep.add(ec);
            });
        }

        // 2. Symmetrical Regal Corner Towers with collision check
        const cornerDistX = 22 * this.params.baseWidthScale;
        const cornerDistZ = 22 * this.params.baseLengthScale;
        const cornerCoords = [
            { x:  cornerDistX, z:  cornerDistZ },
            { x: -cornerDistX, z:  cornerDistZ },
            { x:  cornerDistX, z: -cornerDistZ },
            { x: -cornerDistX, z: -cornerDistZ }
        ];

        cornerCoords.forEach((c, idx) => {
            const pos = this.tryPlaceStructure(c.x, c.z, 4.5, 4.5);
            const tx = pos ? pos.x : c.x;
            const tz = pos ? pos.z : c.z;

            // Vary corner tower heights for more interesting silhouette
            const heightVariation = [1.3, 0.85, 1.1, 0.7];
            const th = towerH * heightVariation[idx];
            const tr = 2.5 + (idx % 2) * 1.2;
            const tower = this.buildTower(tx, 0, tz, tr, th, 'round');
            this.castleGroup.add(tower);

            const finial = this.createTiaraFinial(1.5);
            finial.position.set(0, th + 4, 0);
            tower.add(finial);

            const bridge = this.createArchedSkybridge(0, keepH * 0.55, 0, tx, th * 0.6, tz);
            this.castleGroup.add(bridge);
        });

        // 3. Connecting Regal Curtain Walls with Crenellations
        this.buildCurtainWallBetween(cornerCoords[0], cornerCoords[1]);
        this.buildCurtainWallBetween(cornerCoords[1], cornerCoords[3]);
        this.buildCurtainWallBetween(cornerCoords[2], cornerCoords[0]);
        this.buildCurtainWallBetween(cornerCoords[3], cornerCoords[2]);

        // 4. Front Grand Gatehouse & Dual Entrance Spires
        const gateGroup = new THREE.Group();
        const gateLeft = this.buildTower(-5, 0, cornerDistZ, 2.2, towerH * 0.55, 'octagonal');
        const gateRight = this.buildTower(5, 0, cornerDistZ, 2.2, towerH * 0.55, 'octagonal');
        gateGroup.add(gateLeft);
        gateGroup.add(gateRight);

        const archGate = new THREE.Mesh(new THREE.BoxGeometry(6, 7, 3), this.materials.stoneAccent);
        archGate.position.set(0, 3.5, cornerDistZ);
        gateGroup.add(archGate);

        const door = new THREE.Mesh(new THREE.BoxGeometry(3.5, 5, 0.4), this.materials.woodDark);
        door.position.set(0, 2.5, cornerDistZ + 1.4);
        gateGroup.add(door);

        this.castleGroup.add(gateGroup);

        // 5. Floating Magic Crystals around central Keep
        if (this.params.magicCrystals) {
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 / 6) * i;
                const crx = Math.cos(angle) * 14;
                const crz = Math.sin(angle) * 14;
                const cry = 15 + (i % 3) * 10;

                const crystalMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.5 + this.random(), 0), this.materials.crystal);
                crystalMesh.position.set(crx, cry, crz);
                crystalMesh.rotation.set(this.random(), this.random(), this.random());
                this.castleGroup.add(crystalMesh);
            }
        }
    }

    private buildEnchantedSpiresCastle(bounds: number) {
        const keepH = this.params.keepHeight * 1.4;
        const layoutScale = Math.max(this.params.baseWidthScale, this.params.baseLengthScale);

        const keepW = (20 + this.params.complexity * 1.5) * 0.65 * this.params.baseWidthScale;
        const keepD = (20 + this.params.complexity * 1.5) * 0.65 * this.params.baseLengthScale;
        this.registerBounds(new THREE.Vector3(0, 0, 0), new THREE.Vector3(keepW / 2, keepH, keepD / 2));

        const keep = this.buildCentralKeep(0, 0, 0);
        this.castleGroup.add(keep);

        // Echauguettes on keep
        if (this.params.echauguettes) {
            const ecOffsets = [
                [keepW / 2, keepD / 2], [keepW / 2, -keepD / 2],
                [-keepW / 2, keepD / 2], [-keepW / 2, -keepD / 2]
            ];
            ecOffsets.forEach(([ex, ez]) => {
                const ec = this.createEchauguette(1.2, keepH * 0.25);
                ec.position.set(ex, keepH * 0.75, ez);
                keep.add(ec);
            });
        }

        // Cascading Tiered Spires with collision avoidance — height decreases with distance
        const numSpires = 8 + this.params.complexity;
        for (let i = 0; i < numSpires; i++) {
            const angle = (Math.PI * 2 / numSpires) * i + (this.random() * 0.3);
            const ring = Math.floor(i / 4);
            const dist = (6 + ring * 8 + this.random() * 4) * layoutScale;
            const sx = Math.cos(angle) * dist;
            const sz = Math.sin(angle) * dist;
            const distFactor = 1.0 - (dist / (30 * layoutScale)) * 0.6;
            const sh = keepH * (0.5 + distFactor * 0.8 + this.random() * 0.3);
            const sr = 1.2 + ring * 0.4 + this.random() * 0.8;

            const pos = this.tryPlaceStructure(sx, sz, sr + 1, sr + 1);
            if (!pos) continue;

            const spire = this.buildTower(pos.x, 0, pos.z, sr, sh, i % 2 === 0 ? 'round' : 'octagonal');
            this.castleGroup.add(spire);

            // Finial as child of tower
            const crown = this.createTiaraFinial(1.2);
            crown.position.set(0, sh + 3, 0);
            spire.add(crown);
        }

        // Floating Steps / Platforms
        for (let i = 0; i < 12; i++) {
            const angle = i * 0.5;
            const r = (16 + (i * 0.8)) * layoutScale;
            const px = Math.cos(angle) * r;
            const pz = Math.sin(angle) * r;
            const py = 5 + i * 2.5;

            const step = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 0.8, 6), this.materials.stoneAccent);
            step.position.set(px, py, pz);
            step.castShadow = true;
            this.castleGroup.add(step);
        }
    }

    private buildCurtainWallBetween(p1: {x: number, z: number}, p2: {x: number, z: number}) {
        const dx = p2.x - p1.x;
        const dz = p2.z - p1.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        const midX = (p1.x + p2.x) / 2;
        const midZ = (p1.z + p2.z) / 2;
        const angle = Math.atan2(dz, dx);

        const wallH = 12;
        const wallThickness = 1.6;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(dist, wallH, wallThickness), this.materials.stone);
        wall.position.set(midX, wallH / 2, midZ);
        wall.rotation.y = -angle;
        wall.castShadow = true;
        this.castleGroup.add(wall);

        // Add top crenellations along wall
        const crenCount = Math.floor(dist / 2.5);
        for (let i = 0; i < crenCount; i++) {
            const t = (i + 0.5) / crenCount - 0.5;
            const cx = midX + Math.cos(angle) * (t * dist);
            const cz = midZ + Math.sin(angle) * (t * dist);

            const merlon = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, wallThickness + 0.2), this.materials.stoneAccent);
            merlon.position.set(cx, wallH + 0.7, cz);
            merlon.rotation.y = -angle;
            merlon.castShadow = true;
            this.castleGroup.add(merlon);
        }
    }

    private createArchedSkybridge(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
        const group = new THREE.Group();
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dz = z2 - z1;
        const dist = Math.sqrt(dx*dx + dz*dz);
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const midZ = (z1 + z2) / 2;
        const angle = Math.atan2(dz, dx);

        const deck = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.8, 1.8), this.materials.stoneAccent);
        deck.position.set(midX, midY, midZ);
        deck.rotation.y = -angle;
        deck.castShadow = true;
        group.add(deck);

        const arch = new THREE.Mesh(new THREE.TorusGeometry(dist * 0.35, 0.4, 6, 12, Math.PI), this.materials.stone);
        arch.position.set(midX, midY - 1.2, midZ);
        arch.rotation.y = -angle;
        arch.rotation.z = Math.PI;
        group.add(arch);

        return group;
    }

    private createTiaraFinial(scale: number) {
        const group = new THREE.Group();
        
        // Base ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8 * scale, 0.15 * scale, 8, 16), this.materials.gold);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        // 5 Tiara Spikes
        for (let i = 0; i < 5; i++) {
            const a = (Math.PI * 2 / 5) * i;
            const x = Math.cos(a) * (0.8 * scale);
            const z = Math.sin(a) * (0.8 * scale);
            
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.25 * scale, 1.4 * scale, 5), this.materials.gold);
            spike.position.set(x, 0.7 * scale, z);
            group.add(spike);

            // Small jewel tip
            const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 8, 8), this.materials.crystal);
            jewel.position.set(x, 1.4 * scale, z);
            group.add(jewel);
        }

        // Center High Gem
        const centerGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.4 * scale, 0), this.materials.crystal);
        centerGem.position.set(0, 1.2 * scale, 0);
        group.add(centerGem);

        return group;
    }

    private createRosetteWindow(radius: number) {
        const group = new THREE.Group();
        
        // Outer Stone Ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.3, 8, 24), this.materials.stoneAccent);
        group.add(ring);

        // Center Stained Glass Core
        const glass = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.95, 24), this.materials.windowLit);
        group.add(glass);

        // Petal Spokes
        for (let i = 0; i < 8; i++) {
            const a = (Math.PI * 2 / 8) * i;
            const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.15, radius * 1.8, 0.2), this.materials.gold);
            spoke.rotation.z = a;
            group.add(spoke);
        }

        return group;
    }

    private createEchauguette(radius: number, height: number): THREE.Group {
        const group = new THREE.Group();
        const segs = this.params.lowPoly ? 6 : 10;

        // Conical support bracket (inverted cone)
        const bracket = new THREE.Mesh(
            new THREE.ConeGeometry(radius * 1.2, height * 0.3, segs),
            this.materials.stoneAccent
        );
        bracket.position.y = -height * 0.15;
        bracket.rotation.x = Math.PI;
        group.add(bracket);

        // Small cylindrical turret body
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius * 1.1, height * 0.5, segs),
            this.materials.stone
        );
        body.position.y = height * 0.25;
        body.castShadow = true;
        group.add(body);

        // Conical roof
        const roof = new THREE.Mesh(
            new THREE.ConeGeometry(radius * 1.3, height * 0.4, segs),
            this.materials.roof
        );
        roof.position.y = height * 0.5 + height * 0.2;
        roof.castShadow = true;
        group.add(roof);

        // Tiny window
        const win = this.createDetailedWindow(this.random() > 0.4);
        win.scale.set(0.2, 0.2, 0.2);
        win.position.set(0, height * 0.25, radius * 0.95);
        group.add(win);

        return group;
    }

    private createLancetWindow(isLit: boolean): THREE.Group {
        const group = new THREE.Group();

        // Tall narrow pointed arch
        const shape = new THREE.Shape();
        const w = 0.3, h = 1.8;
        shape.moveTo(-w, 0);
        shape.lineTo(w, 0);
        shape.lineTo(w, h * 0.6);
        shape.quadraticCurveTo(w, h, 0, h);
        shape.quadraticCurveTo(-w, h, -w, h * 0.6);
        shape.lineTo(-w, 0);

        const glassGeom = new THREE.ExtrudeGeometry(shape, {
            depth: 0.08, bevelEnabled: false, curveSegments: this.params.lowPoly ? 2 : 8
        });
        glassGeom.center();
        const glassMat = isLit ? this.materials.windowLit : this.materials.windowDark;
        group.add(new THREE.Mesh(glassGeom, glassMat));

        // Stone frame
        const frameShape = new THREE.Shape();
        const fw = w + 0.08, fh = h + 0.08;
        frameShape.moveTo(-fw, -0.04);
        frameShape.lineTo(fw, -0.04);
        frameShape.lineTo(fw, fh * 0.6);
        frameShape.quadraticCurveTo(fw, fh, 0, fh);
        frameShape.quadraticCurveTo(-fw, fh, -fw, fh * 0.6);
        frameShape.lineTo(-fw, -0.04);

        const frameHole = new THREE.Path();
        frameHole.moveTo(-w, 0);
        frameHole.lineTo(w, 0);
        frameHole.lineTo(w, h * 0.6);
        frameHole.quadraticCurveTo(w, h, 0, h);
        frameHole.quadraticCurveTo(-w, h, -w, h * 0.6);
        frameHole.lineTo(-w, 0);
        frameShape.holes.push(frameHole);

        const frameGeom = new THREE.ExtrudeGeometry(frameShape, {
            depth: 0.15, bevelEnabled: false, curveSegments: this.params.lowPoly ? 2 : 8
        });
        frameGeom.center();
        const frame = new THREE.Mesh(frameGeom, this.materials.stoneAccent);
        frame.position.z = 0.04;
        group.add(frame);

        return group;
    }

    private createScallopedCorbels(radius: number, count: number, isSquare: boolean): THREE.Group {
        const group = new THREE.Group();
        if (!this.params.hasCorbels) return group;

        const segs = this.params.lowPoly ? 4 : 8;

        if (isSquare) {
            const cPerSide = Math.max(2, Math.floor(count / 4));
            const step = (radius * 2) / cPerSide;
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j <= cPerSide; j++) {
                    // Inverted half-sphere scallop
                    const scallop = new THREE.Mesh(
                        new THREE.SphereGeometry(0.4, segs, segs, 0, Math.PI * 2, 0, Math.PI / 2),
                        this.materials.stoneAccent
                    );
                    scallop.rotation.x = Math.PI;
                    const offset = -radius + step * j;
                    if (i === 0) scallop.position.set(offset, -0.2, radius - 0.2);
                    if (i === 1) scallop.position.set(offset, -0.2, -radius + 0.2);
                    if (i === 2) { scallop.position.set(radius - 0.2, -0.2, offset); scallop.rotation.y = Math.PI / 2; }
                    if (i === 3) { scallop.position.set(-radius + 0.2, -0.2, offset); scallop.rotation.y = Math.PI / 2; }
                    scallop.castShadow = true;
                    group.add(scallop);
                }
            }
        } else {
            const angleStep = (Math.PI * 2) / count;
            for (let i = 0; i < count; i++) {
                const angle = i * angleStep;
                const scallop = new THREE.Mesh(
                    new THREE.SphereGeometry(0.4, segs, segs, 0, Math.PI * 2, 0, Math.PI / 2),
                    this.materials.stoneAccent
                );
                scallop.rotation.x = Math.PI;
                scallop.position.set(
                    Math.cos(angle) * (radius - 0.3),
                    -0.2,
                    Math.sin(angle) * (radius - 0.3)
                );
                scallop.rotation.y = -angle;
                scallop.castShadow = true;
                group.add(scallop);
            }
        }
        return group;
    }

    private createBellCurveRoof(width: number): THREE.Group {
        const group = new THREE.Group();
        const segs = this.params.lowPoly ? 8 : 16;
        const mat = this.materials.roof;

        // Bell curve via lathe profile
        const points: THREE.Vector2[] = [];
        const steps = segs;
        const roofH = width * 1.5;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const r = width * 0.55 * (1.0 - t) * (1.0 + 0.3 * Math.sin(t * Math.PI));
            const y = t * roofH;
            points.push(new THREE.Vector2(r, y));
        }
        points.push(new THREE.Vector2(0, roofH));

        const latheGeom = new THREE.LatheGeometry(points, segs);
        const roof = new THREE.Mesh(latheGeom, mat);
        roof.castShadow = true;
        group.add(roof);

        const crown = this.createTiaraFinial(Math.max(0.8, width * 0.1));
        crown.position.set(0, roofH + 0.5, 0);
        group.add(crown);

        return group;
    }

    private buildMagicSparkles(bounds: number) {
        const count = 60;
        const geom = new THREE.OctahedronGeometry(0.4, 0);
        
        for (let i = 0; i < count; i++) {
            const mat = this.random() > 0.4 ? this.materials.crystal : this.materials.gold;
            const sparkle = new THREE.Mesh(geom, mat);
            
            const r = 10 + this.random() * (bounds * 0.8);
            const a = this.random() * Math.PI * 2;
            const y = 5 + this.random() * 70;
            
            sparkle.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
            sparkle.rotation.set(this.random(), this.random(), this.random());
            this.sparkleGroup.add(sparkle);
        }
    }

    private buildMagicAuraRings(bounds: number) {
        const ringRadius = bounds * 0.85;
        const ringGeom = new THREE.TorusGeometry(ringRadius, 0.4, 8, 48);
        const ring = new THREE.Mesh(ringGeom, this.materials.crystal);
        ring.position.y = -5;
        ring.rotation.x = Math.PI / 2;
        this.auraGroup.add(ring);

        const innerRingGeom = new THREE.TorusGeometry(ringRadius * 0.65, 0.3, 8, 36);
        const innerRing = new THREE.Mesh(innerRingGeom, this.materials.gold);
        innerRing.position.y = -6;
        innerRing.rotation.x = Math.PI / 2;
        this.auraGroup.add(innerRing);

        // Runed Nodes along ring
        for (let i = 0; i < 12; i++) {
            const a = (Math.PI * 2 / 12) * i;
            const rx = Math.cos(a) * ringRadius;
            const rz = Math.sin(a) * ringRadius;
            const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), this.materials.crystal);
            node.position.set(rx, -5, rz);
            this.auraGroup.add(node);
        }
    }

    private downloadFile(content: string, fileName: string, contentType: string) {
        const a = document.createElement('a');
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    private downloadBuffer(buffer: ArrayBuffer, fileName: string, contentType: string) {
        const a = document.createElement('a');
        const file = new Blob([buffer], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    private animate = () => {
        requestAnimationFrame(this.animate);

        const t = performance.now() * 0.001;

        // Update GLSL shader time uniform
        this.shaderTime.value = t;

        if (this.sparkleGroup) {
            this.sparkleGroup.rotation.y = t * 0.12;
            this.sparkleGroup.children.forEach((child, idx) => {
                // Use absolute sine offset instead of cumulative delta to prevent drift
                if (!(child as any)._baseY) (child as any)._baseY = child.position.y;
                child.position.y = (child as any)._baseY + Math.sin(t * 2.0 + idx) * 1.5;
                child.rotation.x = t * 0.3 + idx;
                child.rotation.z = t * 0.2 + idx * 0.5;
            });
        }

        if (this.auraGroup) {
            this.auraGroup.rotation.y = -t * 0.08;
        }

        // this.controls.update();
        // this.renderer.render(this.scene, this.camera);
    }

    public destroy() {
        if (this.container && this.container.querySelectorAll) {
            const existingGUIs = this.container.querySelectorAll('.lil-gui');
            existingGUIs.forEach(el => el.remove());
        }
    }
}
