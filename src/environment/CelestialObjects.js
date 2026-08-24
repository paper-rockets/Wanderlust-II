import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, positionLocal, float, vec3, sin, mix, smoothstep as tslSmoothstep } from 'three/tsl';

// ==========================================
// MOON & HALO
// ==========================================
export let staticMoon = null;
export let moonMesh = null;
export let moonHalo = null;

export function initMoon({ scene }) {
    staticMoon = new THREE.Group();
    scene.add(staticMoon);

    const moonGeo = new THREE.SphereGeometry(450, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeffff, fog: false });
    moonMesh = new THREE.Mesh(moonGeo, moonMat);
    staticMoon.add(moonMesh);

    const haloGeo = new THREE.SphereGeometry(650, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({
        color: 0x88c8ff,
        transparent: true,
        opacity: 0.3,
        fog: false,
        side: THREE.BackSide
    });
    moonHalo = new THREE.Mesh(haloGeo, haloMat);
    staticMoon.add(moonHalo);

    return { staticMoon, moonMesh, moonHalo };
}

// ==========================================
// AURORA BOREALIS
// ==========================================
export const uAuroraOpacity = uniform(0.0);
export const uAuroraIntensity = uniform(1.0);
export const uAuroraTime = uniform(0.0);

export let auroraMesh = null;
export const auroraParams = {
    opacity: 0.0,
    intensity: 1.0,
    speed: 1.0,
    altitude: 2500
};

export function initAurora({ scene }) {
    try {
        const auroraMat = new MeshBasicNodeMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            transparent: true,
            fog: false,
            blending: THREE.AdditiveBlending
        });

        // Cylinder half-height = 2500, radius = 12000
        const px = positionLocal.x.div(float(12000));
        const pz = positionLocal.z.div(float(12000));
        const pyNorm = positionLocal.y.add(float(2500)).div(float(5000));

        // Soft fade at top and bottom edges of the curtain
        const vFade = tslSmoothstep(float(0.0), float(0.2), pyNorm)
            .mul(tslSmoothstep(float(1.0), float(0.8), pyNorm));

        const t = uAuroraTime.mul(float(0.4));
        const w1 = sin(px.mul(float(9.0)).add(t)).mul(float(0.5)).add(float(0.5));
        const w2 = sin(pz.mul(float(7.0)).sub(t.mul(float(1.3)))).mul(float(0.5)).add(float(0.5));
        const w3 = sin(px.mul(float(11.0)).add(pz.mul(float(8.0))).sub(t.mul(float(0.8)))).mul(float(0.5)).add(float(0.5));

        const ribbon = w1.mul(w2.mul(float(0.7)).add(float(0.3))).mul(w3).pow(float(2.0));

        const cGreen = vec3(0.0, 1.0, 0.3);
        const cBlue = vec3(0.0, 0.4, 1.0);
        const auroraColor = mix(cGreen, cBlue, w2).mul(ribbon).mul(vFade);

        auroraMat.colorNode = auroraColor.mul(uAuroraIntensity);
        auroraMat.opacityNode = uAuroraOpacity;

        const auroraGeo = new THREE.CylinderGeometry(12000, 12000, 5000, 64, 1, true);
        auroraMesh = new THREE.Mesh(auroraGeo, auroraMat);
        auroraMesh.renderOrder = -998;
        auroraMesh.frustumCulled = false;
        scene.add(auroraMesh);
    } catch (e) {
        console.warn('[Aurora] failed to init', e);
    }

    if (typeof window !== 'undefined') {
        window._aurora = () => auroraMesh;
    }

    return { auroraMesh, auroraParams, updateAurora };
}

export function updateAurora(cameraPos, dt, nightFactor) {
    if (!auroraMesh) return;
    uAuroraTime.value += dt * auroraParams.speed;
    uAuroraOpacity.value = nightFactor * auroraParams.opacity;
    uAuroraIntensity.value = auroraParams.intensity;
    auroraMesh.position.set(
        cameraPos.x,
        cameraPos.y + auroraParams.altitude,
        cameraPos.z
    );
    auroraMesh.visible = uAuroraOpacity.value > 0.01;
}
