import * as THREE from 'three';

const colorDeepWater = new THREE.Color(0x1a4a8c);
const colorSand = new THREE.Color(0xf2e1b8);
const colorMountainGrass = new THREE.Color(0x4b7043);
const colorMountainRock = new THREE.Color(0x5a5e6b);
const colorSnow = new THREE.Color(0xf5f6fa);

const cosR = 0.8660254;
const sinR = 0.5;

export default {
    name: "🏔️ Misty Mountains",
    shoreName: "░ Mountain Shore",
    getHeight(x, z, snoise) {
        const rx = x * cosR - z * sinR;
        const rz = x * sinR + z * cosR;

        const n1 = snoise(rx * 0.0008, rz * 0.0008);
        const n2 = snoise(x * 0.0035 + 17.0, z * 0.0035 + 17.0);
        const n3 = snoise(rx * 0.008, rz * 0.008);

        let ridge = 1.0 - Math.abs(n1);
        ridge = ridge * ridge * (3.0 - 2.0 * ridge);

        const h = ridge * 165.0 + n2 * 22.0 + n3 * 6.0 + 8.0;
        return Math.max(6.0, h);
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        const nNoise = snoise(x * 0.01, z * 0.01) * 6.0;
        const snowStart = 55.0 + nNoise;
        const snowFull = 105.0 + nNoise;

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
            // Snow cap shimmer — crystalline glint on peaks (same technique as North Pole glacierGlint)
            const snowGlint = snoise(x * 0.012 + 800.0, z * 0.012 - 600.0) * 0.5 + 0.5;
            const snowCoverage = smoothstep(snowStart, snowFull, h);
            if (snowGlint > 0.62 && snowCoverage > 0.3) {
                tempColor.lerp(colorSnow, (snowGlint - 0.62) * snowCoverage * 0.6);
            }
            // Peak highlight glint — extra bright sparkle on highest snow
            const peakGlint = snoise(x * 0.025 + 200.0, z * 0.025 - 400.0) * 0.5 + 0.5;
            if (peakGlint > 0.70 && h > snowFull * 0.75) {
                tempColor.lerp(new THREE.Color(0xf0f8ff), (peakGlint - 0.70) * 0.5);
            }
        }
    }
};
