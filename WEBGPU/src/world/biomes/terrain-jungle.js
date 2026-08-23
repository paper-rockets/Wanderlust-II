import * as THREE from 'three';

const colorDeepWater    = new THREE.Color(0x126860); // Clear Tropical Emerald Water
const colorShallowWater = new THREE.Color(0x24b89e); // Soft Cyan-Green Shore Water
const colorSand         = new THREE.Color(0xe2c488); // Soft Golden Sand
const colorJungleGrass  = new THREE.Color(0x32a428); // Vibrant Ghibli Lowland Grass
const colorJungleMid    = new THREE.Color(0x228a42); // Rich Canopy Green
const colorJungleHigh   = new THREE.Color(0x186835); // Deep Mountain Jungle
const colorJungleMoss   = new THREE.Color(0x48b824); // Warm Sunlit Moss
const colorTealAccent   = new THREE.Color(0x28985e); // Soft Lush Jade Accent
const colorRock         = new THREE.Color(0x594f42); // Rainforest Karst Rock
const colorSoil         = new THREE.Color(0x6e4a2e); // Rich Rainforest Soil

export default {
    name: "🌴 Lush Jungle",
    shoreName: "🌿 Mangrove Shore",
    
    getHeight(x, z, snoise) {
        const nBase = snoise(x * 0.0008, z * 0.0008) * 35.0;
        const nHills = snoise(x * 0.0025 + 120, z * 0.0025 + 450) * 18.0;
        const nDetail = snoise(x * 0.008 + 500, z * 0.008 + 800) * 5.0;
        
        const riverN = Math.abs(snoise(x * 0.0012 + 300, z * 0.0012 - 300));
        let riverCarve = 0;
        if (riverN < 0.12) {
            let t = 1.0 - (riverN / 0.12);
            riverCarve = (t * t * (3 - 2 * t)) * 16.0;
        }

        const karstN = snoise(x * 0.0015 - 800, z * 0.0015 + 800);
        let karstElevation = 0;
        if (karstN > 0.50) {
            let k = (karstN - 0.50) / 0.40;
            k = Math.max(0, Math.min(1, k));
            k = k * k * (3 - 2 * k);
            karstElevation = k * 20.0;
        }

        let h = nBase + nHills + nDetail - riverCarve + karstElevation + 22.0;
        return Math.max(5.5, h);
    },

    getColor(h, x, z, snoise, tempColor, smoothstep) {
        const patchNoise = snoise(x * 0.004 + 111, z * 0.004 + 222);
        const mossNoise  = snoise(x * 0.01 + 333, z * 0.01 + 444);

        if (h <= 5.8) {
            tempColor.lerpColors(colorDeepWater, colorShallowWater, smoothstep(2.0, 5.8, h));
            return;
        }

        if (h < 9.0) {
            tempColor.lerpColors(colorShallowWater, colorSand, smoothstep(5.8, 9.0, h));
        } else if (h < 22.0) {
            const baseLowland = colorJungleGrass.clone();
            if (patchNoise > 0.1) baseLowland.lerp(colorTealAccent, Math.min(1.0, (patchNoise - 0.1) * 1.8));
            if (mossNoise > 0.2)  baseLowland.lerp(colorJungleMoss, Math.min(1.0, (mossNoise - 0.2) * 1.5));
            tempColor.lerpColors(colorSand, baseLowland, smoothstep(9.0, 22.0, h));
        } else if (h < 48.0) {
            const baseMid = colorJungleMid.clone();
            if (patchNoise > 0.0) baseMid.lerp(colorJungleGrass, Math.min(1.0, patchNoise * 1.5));
            if (mossNoise > 0.15) baseMid.lerp(colorSoil, Math.min(1.0, (mossNoise - 0.15) * 1.2));
            tempColor.lerpColors(colorJungleGrass, baseMid, smoothstep(22.0, 48.0, h));
        } else if (h < 70.0) {
            const baseHigh = colorJungleHigh.clone();
            if (mossNoise > 0.2) baseHigh.lerp(colorJungleMoss, Math.min(1.0, (mossNoise - 0.2) * 2.0));
            tempColor.lerpColors(colorJungleMid, baseHigh, smoothstep(48.0, 70.0, h));
        } else {
            const cliffBase = colorRock.clone();
            if (patchNoise > 0.0) cliffBase.lerp(colorJungleHigh, 0.4);
            tempColor.lerpColors(colorJungleHigh, cliffBase, smoothstep(70.0, 95.0, h));
        }
    }
};
