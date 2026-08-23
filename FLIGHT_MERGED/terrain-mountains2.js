import * as THREE from 'three';

const colorDeepWater    = new THREE.Color(0x1a4a8c);
const colorSand         = new THREE.Color(0xf2e1b8);
const colorMountainGrass= new THREE.Color(0x4b7043);
const colorMountainRock = new THREE.Color(0x5a5e6b);
const colorSnow         = new THREE.Color(0xf5f6fa);

// Centered inside Misty Mountains II zone (104,000m to 134,000m)
const CHAIN_CENTER_Z = 119000;
const CHAIN_ANGLE = Math.PI / 5.5; // ~32.7° diagonal spine
const _cosA = Math.cos(CHAIN_ANGLE);
const _sinA = Math.sin(CHAIN_ANGLE);

// Domain rotation to break grid-aligned saw-tooth cross patterns
const cosR = 0.8660254; // cos(30 deg)
const sinR = 0.5;       // sin(30 deg)

export default {
    name: "🏔️ Misty Mountains II",
    shoreName: "░ Mountain Shore II",
    getHeight(x, z, snoise) {
        const perpDist   = x * _cosA - (z - CHAIN_CENTER_Z) * _sinA;
        const alongChain = x * _sinA + (z - CHAIN_CENTER_Z) * _cosA;

        const spineW = 1100;
        const spineT = Math.max(0.0, 1.0 - (perpDist / spineW) * (perpDist / spineW));
        const spineFactor = spineT * spineT;

        // Rotate alongChain and perpDist coordinates to eliminate grid cross patterns
        const rx = alongChain * cosR - perpDist * sinR;
        const rz = alongChain * sinR + perpDist * cosR;

        const n1 = snoise(rx * 0.00075 + 50.0, rz * 0.00075 + 50.0);
        let ridge = 1.0 - Math.abs(n1);
        ridge = ridge * ridge * (3.0 - 2.0 * ridge); // Smoothstep curve for natural organic peaks

        const n2 = snoise(x * 0.003 + 50, z * 0.003 + 50);
        const n3 = snoise(x * 0.009 + 50, z * 0.009 + 50);

        const foothills = Math.max(8.0, snoise(x * 0.0015 + 50, z * 0.0015 + 50) * 32.0 + 18.0);
        const peaks = ridge * 210.0 * spineFactor + n2 * 18.0 + n3 * 6.0;

        return Math.max(6.0, foothills + peaks);
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        const nNoise = snoise(x * 0.01 + 50, z * 0.01 + 50) * 6.0;
        const snowStart = 55.0 + nNoise;
        const snowFull = 110.0 + nNoise;

        if (h < 1.0) {
            tempColor.copy(colorDeepWater);
        } else if (h < 2.35) {
            tempColor.lerpColors(colorDeepWater, colorSand, smoothstep(1.0, 2.35, h));
        } else if (h < 4.2) {
            tempColor.copy(colorSand);
        } else if (h < 15.0) {
            tempColor.lerpColors(colorSand, colorMountainGrass, smoothstep(4.2, 15.0, h));
        } else if (h < snowStart) {
            tempColor.lerpColors(colorMountainGrass, colorMountainRock, smoothstep(15.0, snowStart, h));
        } else {
            tempColor.lerpColors(colorMountainRock, colorSnow, smoothstep(snowStart, snowFull, h));
        }
    }
};
