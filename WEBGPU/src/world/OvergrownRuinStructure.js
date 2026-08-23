import * as THREE from 'three';

/**
 * Overgrown Ruin ("Cage Jungle") Colossal Tiered Ancient Structure Generator
 * Rising massively above the forest line, this structure fuses ancient stone architecture
 * with a dense cage-like mesh of tropical vines, ferns, and overgrown jungle flora.
 */
export function createOvergrownRuinMesh() {
    const ruinGroup = new THREE.Group();
    ruinGroup.name = "OvergrownRuinComplex";

    // --- 1. Ancient Stone Terrace Materials ---
    const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x5a5246,
        roughness: 0.85,
        metalness: 0.15,
        bumpScale: 0.1
    });

    const mossyStoneMat = new THREE.MeshStandardMaterial({
        color: 0x3d4a2d,
        roughness: 0.75,
        metalness: 0.1
    });

    // --- 2. Cage Vine & Overgrown Jungle Mesh Material ---
    const vineCageMat = new THREE.MeshStandardMaterial({
        color: 0x2e6b22,
        roughness: 0.6,
        metalness: 0.05,
        side: THREE.DoubleSide
    });

    const fernMat = new THREE.MeshStandardMaterial({
        color: 0x48a832,
        roughness: 0.5,
        side: THREE.DoubleSide
    });

    const gateMat = new THREE.MeshStandardMaterial({
        color: 0x362c22,
        roughness: 0.9,
        metalness: 0.3
    });

    // --- 3. Build Tiered Ancient Ruin Terraces ---
    const tiers = [
        { width: 140, length: 110, height: 28, y: 14 },
        { width: 110, length: 85,  height: 26, y: 40 },
        { width: 80,  length: 65,  height: 24, y: 65 },
        { width: 55,  length: 45,  height: 22, y: 88 },
        { width: 35,  length: 30,  height: 20, y: 109 }
    ];

    tiers.forEach((tier, idx) => {
        const geo = new THREE.BoxGeometry(tier.width, tier.height, tier.length);
        const mat = (idx % 2 === 0) ? stoneMat : mossyStoneMat;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, tier.y, 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        ruinGroup.add(mesh);

        // Terrace Buttresses / Pillars
        const pillCount = 6;
        for (let i = 0; i < pillCount; i++) {
            const pGeo = new THREE.BoxGeometry(6, tier.height + 4, 6);
            const pMesh = new THREE.Mesh(pGeo, stoneMat);
            const posX = (i / (pillCount - 1) - 0.5) * (tier.width - 8);
            const posZ = tier.length * 0.5 + 2;
            pMesh.position.set(posX, tier.y, posZ);
            ruinGroup.add(pMesh);
        }

        // --- 4. Overgrown "Cage-like" Vine & Fern Lattice on Each Terrace ---
        const cageGeo = new THREE.CylinderGeometry(tier.width * 0.52, tier.width * 0.56, tier.height * 0.9, 12, 4, true);
        const cageMesh = new THREE.Mesh(cageGeo, vineCageMat);
        cageMesh.position.set(0, tier.y, 0);
        ruinGroup.add(cageMesh);

        // Fern foliage clumps along terrace ledges
        const fernCount = 16;
        for (let f = 0; f < fernCount; f++) {
            const fGeo = new THREE.ConeGeometry(3.5 + Math.random() * 2.5, 6 + Math.random() * 4, 5);
            const fMesh = new THREE.Mesh(fGeo, fernMat);
            const ang = (f / fernCount) * Math.PI * 2;
            const radX = (tier.width * 0.48);
            const radZ = (tier.length * 0.48);
            fMesh.position.set(Math.cos(ang) * radX, tier.y + tier.height * 0.5, Math.sin(ang) * radZ);
            fMesh.rotation.set(Math.random() * 0.4, Math.random() * Math.PI * 2, Math.random() * 0.4);
            ruinGroup.add(fMesh);
        }
    });

    // --- 5. Prominent Weathered Cage Gateway (Lower Center) ---
    const gateArchGeo = new THREE.TorusGeometry(14, 3.5, 8, 24, Math.PI);
    const gateArch = new THREE.Mesh(gateArchGeo, gateMat);
    gateArch.position.set(0, 16, 56);
    gateArch.rotation.x = 0;
    ruinGroup.add(gateArch);

    // Weathered Cage Iron Bars inside Gateway
    for (let b = -4; b <= 4; b++) {
        const barGeo = new THREE.CylinderGeometry(0.7, 0.7, 16, 6);
        const barMesh = new THREE.Mesh(barGeo, gateMat);
        barMesh.position.set(b * 2.6, 8, 56);
        ruinGroup.add(barMesh);
    }

    return ruinGroup;
}
