import * as THREE from 'three';

const colorDeepWater = new THREE.Color(0x1a4a8c);
const colorSand = new THREE.Color(0xf2e1b8);
const colorValleyGrass = new THREE.Color(0x34a42b);   // Lush Ghibli meadow green
const colorSunlitGrass = new THREE.Color(0x75c02c);   // Sun-dappled green
const colorWildGrass = new THREE.Color(0xd6a72e);     // Golden wild grass
const colorDarkDirt = new THREE.Color(0x442e1b);      // Rich dark dirt patch
const colorWeatheredRock = new THREE.Color(0x736357); // Weathered clay rock outcropping
const colorCrestGold = new THREE.Color(0xedb647);     // Sunlit hill crest

const _tempColor1 = new THREE.Color();
const _tempColor2 = new THREE.Color();

export default {
    name: "🌾 Vast Plains",
    shoreName: "░ Plain Shore",
    getHeight(x, z, snoise) {
        // Noise domain warping for geological ridges and sudden valley focal points
        const warpX = x + snoise(x * 0.0012 + 120.0, z * 0.0012) * 350.0;
        const warpZ = z + snoise(x * 0.0012, z * 0.0012 + 120.0) * 350.0;

        const baseH = snoise(warpX * 0.0004, warpZ * 0.0004) * 8.0 + 10.0;
        
        // Sudden geological ridges and small valleys
        const ridgeNoise = Math.abs(snoise(warpX * 0.0018, warpZ * 0.0018));
        const ridgeH = (1.0 - ridgeNoise) * 6.5;

        const valleyNoise = snoise(warpX * 0.003, warpZ * 0.003);
        const valleyDip = (valleyNoise < -0.35) ? (valleyNoise + 0.35) * 4.0 : 0.0;

        const finalH = baseH + ridgeH + valleyDip;
        return Math.max(6.0, finalH);
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        if (h < 1.0) {
            tempColor.copy(colorDeepWater);
        } else if (h < 2.35) {
            tempColor.lerpColors(colorDeepWater, colorSand, smoothstep(1.0, 2.35, h));
        } else if (h < 4.2) {
            tempColor.copy(colorSand);
        } else if (h < 6.2) {
            tempColor.lerpColors(colorSand, colorValleyGrass, smoothstep(4.2, 6.2, h));
        } else if (h < 22.0) {
            // Multi-material fragment noise blending: dirt patches, weathered rock, varied grass
            const warpX = x + snoise(x * 0.002, z * 0.002) * 150.0;
            const warpZ = z + snoise(x * 0.002 + 50.0, z * 0.002) * 150.0;

            const matNoise = snoise(warpX * 0.005, warpZ * 0.005) * 0.6 + snoise(warpX * 0.022, warpZ * 0.022) * 0.4;
            const rockNoise = snoise(warpX * 0.015 + 200.0, warpZ * 0.015);

            if (rockNoise > 0.42) {
                // Weathered rock outcroppings
                tempColor.lerpColors(colorWeatheredRock, colorDarkDirt, (rockNoise - 0.42) * 2.0);
            } else if (matNoise < -0.30) {
                // Dark dirt trails and patches
                tempColor.lerpColors(colorDarkDirt, colorValleyGrass, (matNoise + 0.6) / 0.3);
            } else if (matNoise < 0.15) {
                // Lush grass to sunlit grass
                tempColor.lerpColors(colorValleyGrass, colorSunlitGrass, (matNoise + 0.30) / 0.45);
            } else if (matNoise < 0.45) {
                // Sunlit grass to golden wild grass
                tempColor.lerpColors(colorSunlitGrass, colorWildGrass, (matNoise - 0.15) / 0.30);
            } else {
                // Golden wild grass to crest gold
                tempColor.lerpColors(colorWildGrass, colorCrestGold, (matNoise - 0.45) / 0.55);
            }

            // Elevation blend towards hill crests
            const elevFactor = smoothstep(6.2, 22.0, h);
            _tempColor2.lerpColors(tempColor, colorCrestGold, elevFactor * 0.55);
            tempColor.copy(_tempColor2);
        } else if (h < 32.0) {
            tempColor.lerpColors(colorCrestGold, colorWeatheredRock, smoothstep(22.0, 32.0, h));
        } else {
            tempColor.lerpColors(colorWeatheredRock, colorDarkDirt, smoothstep(32.0, 45.0, h));
        }
    }
};
