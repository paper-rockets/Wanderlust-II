const fs = require('fs');
const path = 'C:\\Users\\macie\\OneDrive\\Desktop\\ZZZZZZZZZZZZZZZ\\CAPYBARA\\14_Kiki-Islands\\index.html';

let html = fs.readFileSync(path, 'utf8');

// 1. Insert GLTFLoader & KTX2Loader init right before // Meshes
const earlyLoaderSetup = `    // Initialize GLTF Loader
    const gltfLoader = new GLTFLoader();
    const ktx2Loader = new KTX2Loader()
        .setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/libs/basis/')
        .detectSupport(renderer);
    gltfLoader.setKTX2Loader(ktx2Loader);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // Meshes`;

html = html.replace('    // Meshes', earlyLoaderSetup);

// 2. Remove duplicate const gltfLoader and const ktx2Loader from line 1665
const oldLateLoader = `    // Load Kiki GLTF Model
    const gltfLoader = new GLTFLoader();
    
    // Initialize KTX2Loader for compressed textures (like the Whale model)
    const ktx2Loader = new KTX2Loader()
        .setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/libs/basis/')
        .detectSupport(renderer);
    gltfLoader.setKTX2Loader(ktx2Loader);
    
    // Initialize MeshoptDecoder for compressed geometries (like the Whale model)
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);`;

const newLateLoader = `    // Load Kiki GLTF Model (gltfLoader & ktx2Loader initialized above)`;

html = html.replace(oldLateLoader, newLateLoader);

// 3. Add GLB pine tree replacement logic after treeMeshes color loop
const targetLoop = `    treeMeshes.forEach(mesh => {
        mesh.maxCount = mesh.count;
        for (let i = 0; i < mesh.count; i++) {
            tempTreeColor.setHex(treeGreenVariations[Math.floor(Math.random() * treeGreenVariations.length)]);
            mesh.setColorAt(i, tempTreeColor);
        }
    });`;

const glbReplacementCode = `    treeMeshes.forEach(mesh => {
        mesh.maxCount = mesh.count;
        for (let i = 0; i < mesh.count; i++) {
            tempTreeColor.setHex(treeGreenVariations[Math.floor(Math.random() * treeGreenVariations.length)]);
            mesh.setColorAt(i, tempTreeColor);
        }
    });

    // Replace procedural pine trees with high-performance GLB models: Pine_ultra_fast.glb & Pine_1_ultra_fast.glb
    function applyGLBPineTree(gltf, targetInstancedMeshes, targetHeight) {
        let targetMesh = null;
        gltf.scene.traverse((child) => {
            if (child.isMesh && !targetMesh) targetMesh = child;
        });
        if (!targetMesh) return;

        const geom = targetMesh.geometry.clone();
        geom.computeBoundingBox();
        const minY = geom.boundingBox.min.y;
        geom.translate(0, -minY, 0);

        geom.computeBoundingBox();
        const height = geom.boundingBox.max.y - geom.boundingBox.min.y;
        const scale = height > 0 ? (targetHeight / height) : 1.0;
        geom.scale(scale, scale, scale);

        function prepMat(m) {
            const mat = m.clone();
            mat.dithering = true;
            mat.shadowSide = THREE.DoubleSide;
            const isLeaf = (mat.name && mat.name.toLowerCase().includes('leaf')) || mat.transparent || mat.map;
            if (isLeaf) {
                mat.alphaTest = 0.35;
                mat.transparent = false;
                mat.side = THREE.DoubleSide;
            }
            return mat;
        }

        let mat = targetMesh.material;
        if (Array.isArray(mat)) {
            mat = mat.map(m => prepMat(m));
        } else {
            mat = prepMat(mat);
        }

        const white = new THREE.Color(0xffffff);

        targetInstancedMeshes.forEach(instMesh => {
            instMesh.geometry = geom;
            instMesh.material = mat;
            if (instMesh.instanceColor) {
                for (let i = 0; i < instMesh.count; i++) {
                    instMesh.setColorAt(i, white);
                }
                instMesh.instanceColor.needsUpdate = true;
            }
            instMesh.instanceMatrix.needsUpdate = true;
        });
    }

    gltfLoader.load('assets/Pine_ultra_fast.glb', (gltf) => {
        applyGLBPineTree(gltf, [instTree1, instTree3], 22.0);
    });

    gltfLoader.load('assets/Pine_1_ultra_fast.glb', (gltf) => {
        applyGLBPineTree(gltf, [instTree2, instTree4], 20.0);
    });`;

html = html.replace(targetLoop, glbReplacementCode);

fs.writeFileSync(path, html, 'utf8');
console.log('Successfully updated index.html cleanly!');
