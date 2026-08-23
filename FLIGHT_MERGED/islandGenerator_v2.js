import * as THREE from 'three';

export function createProceduralIsland(seed, baseSize, theme = 'castle') {
    const group = new THREE.Group();

    let s = seed ^ 0x9A5B3;
    const r = () => { s = Math.sin(s) * 10000; return s - Math.floor(s); };
    const rInt = (min, max) => Math.floor(r() * (max - min + 1)) + min;
    const rPick = (arr) => arr[Math.floor(r() * arr.length)];

    const islandRad = Math.max(26, baseSize * 1.2 + 8);

    const gradientColors = new Uint8Array([160, 160, 160, 255, 255, 255, 255, 255]);
    const gradientMap = new THREE.DataTexture(gradientColors, 2, 1, THREE.RGBAFormat);
    gradientMap.needsUpdate = true;
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.generateMipmaps = false;

    const createMat = (colorHex) => new THREE.MeshToonMaterial({ color: colorHex, gradientMap, flatShading: true });

    const matGrass = createMat(theme === 'ghibli' ? 0x84cc16 : 0x65a30d); // Lush grass
    const matDirt = createMat(0xb46e30);
    const matStone = createMat(0x9ca3af); // Ancient gray stone
    const matWood = createMat(0x78350f);
    const matCrystal = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.85 });

    // ==========================================
    // 1. ORGANIC ISLAND BASE (Overgrown Rock)
    // ==========================================
    const baseGeo = new THREE.DodecahedronGeometry(islandRad, 1);
    const posAttribute = baseGeo.attributes.position;
    const curYLevel = islandRad * 0.75;
    for(let i=0; i<posAttribute.count; i++) {
        let y = posAttribute.getY(i);
        if (y > curYLevel) {
            posAttribute.setY(i, curYLevel + r() * 2.0); // Slightly uneven top
        }
    }
    baseGeo.computeVertexNormals();

    const grassMesh = new THREE.Mesh(baseGeo, matGrass);
    grassMesh.position.set(0, -0.5, 0);
    grassMesh.receiveShadow = true;
    grassMesh.castShadow = true;
    group.add(grassMesh);

    // Deep jagged rock underneath
    const depth = 20 + rInt(0, 15);
    const dirtConeGeo = new THREE.ConeGeometry(islandRad - 1, depth, theme === 'ghibli' ? 10 : 16);
    const dirtCone = new THREE.Mesh(dirtConeGeo, matDirt);
    dirtCone.position.set(0, -depth / 2 - 0.5, 0);
    dirtCone.rotation.set(Math.PI, Math.PI / 8, 0);
    dirtCone.receiveShadow = true;
    dirtCone.castShadow = true;
    group.add(dirtCone);

    // Procedural Stalactites & Vines
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const instRocks = new THREE.InstancedMesh(rockGeo, matDirt, 50);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 50; i++) {
        const rockDepth = rInt(2, depth + 10);
        const maxRad = Math.max(0, islandRad - rockDepth * (islandRad/depth));
        const angle = r() * Math.PI * 2;
        const radius = Math.sqrt(r()) * maxRad;
        const rockRad = rInt(3, 10) * (1 - rockDepth/(depth+10));
        dummy.position.set(Math.cos(angle) * radius, -rockDepth, Math.sin(angle) * radius);
        
        // Some rocks are long green vines hanging down!
        if (r() > 0.7) {
            dummy.scale.set(rockRad * 0.3, rockRad * (3.0 + r()*5.0), rockRad * 0.3);
            instRocks.setColorAt(i, new THREE.Color(rPick(["#4ade80", "#22c55e", "#16a34a"])));
        } else {
            dummy.scale.set(rockRad * 0.8, rockRad * (1.5 + r()*1.5), rockRad * 0.8);
            instRocks.setColorAt(i, new THREE.Color(rPick(["#cda484", "#b5835a", "#9c6644", "#a2704a", "#8b5a33"])));
        }
        dummy.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
        dummy.updateMatrix();
        instRocks.setMatrixAt(i, dummy.matrix);
    }
    instRocks.instanceColor.needsUpdate = true;
    instRocks.castShadow = true; instRocks.receiveShadow = true;
    group.add(instRocks);



    // ==========================================
    // 4. TREES & CLOUDS
    // ==========================================
    // Highly Optimized Instanced Trees
    const treeCount = theme === 'ghibli' ? 80 : 40;
    const instTrunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.35, 2, 6), matWood, treeCount);
    const instLeaf1 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 2.0, 6), createMat(0xffffff), treeCount);
    const instLeaf2 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.2, 1.6, 6), createMat(0xffffff), treeCount);
    
    for (let i = 0; i < treeCount; i++) {
        const angle = r() * Math.PI * 2;
        const radius = rInt(islandRad * 0.2, islandRad - 3);
        const scale = 0.5 + r() * 1.5;
        
        dummy.rotation.set(0, r() * Math.PI * 2, 0);
        dummy.scale.set(scale, scale, scale);
        
        dummy.position.set(Math.cos(angle) * radius, curYLevel + 0.8 * scale, Math.sin(angle) * radius);
        dummy.updateMatrix(); instTrunks.setMatrixAt(i, dummy.matrix);

        // Mix in some pink cherry blossoms randomly!
        const leafColor = new THREE.Color(rPick(
            r() > 0.8 ? ["#fbcfe8", "#f472b6", "#fb7185"] : ["#4ade80", "#22c55e", "#16a34a", "#86efac", "#14b8a6", "#fde047"]
        ));
        
        dummy.position.setY(curYLevel + 1.8 * scale); dummy.updateMatrix();
        instLeaf1.setMatrixAt(i, dummy.matrix); instLeaf1.setColorAt(i, leafColor);

        dummy.position.setY(curYLevel + 2.8 * scale); dummy.updateMatrix();
        instLeaf2.setMatrixAt(i, dummy.matrix); instLeaf2.setColorAt(i, leafColor);
    }
    
    [instTrunks, instLeaf1, instLeaf2].forEach(m => {
        if(m.instanceColor) m.instanceColor.needsUpdate = true;
        m.castShadow = true; m.receiveShadow = true;
        group.add(m);
    });

    // Procedural Clouds around the base of the island
    const cloudCount = rInt(3, 6);
    const matCloud = createMat(0xffffff);
    for (let c = 0; c < cloudCount; c++) {
        const cx = (r() - 0.5) * islandRad * 1.8;
        const cz = (r() - 0.5) * islandRad * 1.8;
        const cy = -5 - r() * 15;
        const cs = rInt(10, 25);
        
        const cloudGrp = new THREE.Group();
        const puffCount = rInt(3, 6);
        for(let p=0; p < puffCount; p++) {
            const px = (r() - 0.5) * cs * 0.8;
            const pz = (r() - 0.5) * cs * 0.8;
            const py = (r() - 0.5) * cs * 0.4;
            const ps = cs * (0.5 + r() * 0.5);
            const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(ps, 0), matCloud);
            puff.position.set(px, py, pz);
            puff.rotation.set(r()*Math.PI, r()*Math.PI, r()*Math.PI);
            cloudGrp.add(puff);
        }
        cloudGrp.position.set(cx, cy, cz);
        group.add(cloudGrp);
    }

    return group;
}
