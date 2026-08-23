import * as THREE from 'three';

// Rich Sunlit Desert Palette
export const desertColors = {
    deepWater:    new THREE.Color(0x0a4b6e), // Deep turquoise oasis pool
    oasisWater:   new THREE.Color(0x14b8a6), // Vibrant crystal teal shore
    oasisGrass:   new THREE.Color(0x22c55e), // Lush emerald date palm foliage
    oasisEdge:    new THREE.Color(0x84cc16), // Bright lime vegetation boundary
    oasisSand:    new THREE.Color(0xd97706), // Warm golden shore sand
    valleyShadow: new THREE.Color(0x702613), // Deep burnt terracotta slip-face shadow
    sandBase:     new THREE.Color(0xcc6823), // Warm glowing amber base sand
    duneSlope:    new THREE.Color(0xf29f3d), // Vibrant golden sand slope
    duneCrest:    new THREE.Color(0xfde298), // Radiant sunlit gold crest
    peakHighlight:new THREE.Color(0xfff5dd)  // Razor ivory-gold knife-edge rim highlight
};

// Continuous asymmetric dune transfer function:
// phi: continuous wave phase in radians
// skew: shifts wave peak to create gentle windward stoss slope and steep leeward slip face
// sharpness: powers the peak into a razor knife-edge crest line
function asymmetricDune(phi, skew = 0.65, sharpness = 3.2) {
    const s = Math.sin(phi - Math.cos(phi) * skew);
    const norm = Math.max(0.0, Math.min(1.0, (s + 1.0) * 0.5));
    return Math.pow(norm, sharpness);
}

// Pre-computed wind angle direction cosines
const COS_WIND1 = 0.8988, SIN_WIND1 = 0.4384;   // Primary wind direction (~26 deg)
const COS_WIND2 = 0.8192, SIN_WIND2 = -0.5736;  // Secondary cross-wind direction (~ -35 deg)
const TWO_PI = Math.PI * 2.0;

export default {
    name: "Desert Dunes",
    shoreName: "Desert Shore",
    getHeight(x, z, snoise) {
        // 1. Multi-frequency domain warping (wind turbulence and curved barchan horns)
        const warpX1 = snoise(x * 0.00035, z * 0.00035) * 160.0;
        const warpZ1 = snoise(x * 0.00035 + 80.0, z * 0.00035 + 80.0) * 160.0;
        
        const warpX2 = snoise(x * 0.0012 + 20.0, z * 0.0012 + 20.0) * 45.0;
        const warpZ2 = snoise(x * 0.0012 + 150.0, z * 0.0012 + 150.0) * 45.0;

        const wx = x + warpX1 + warpX2;
        const wz = z + warpZ1 + warpZ2;

        // 2. Macro Sand Sea / Rolling Draas (Wavelength ~650m, Amplitude ~35m)
        const macroCoord = (wx * COS_WIND1 + wz * SIN_WIND1) * 0.0015;
        const macroWave = asymmetricDune(macroCoord * TWO_PI, 0.48, 2.0);
        const macroBase = snoise(x * 0.0002, z * 0.0002) * 20.0 + 30.0;
        const macroHeight = macroBase + macroWave * 35.0;

        // 3. Primary Transverse & Barchanoid Dune Ridges (Wavelength ~130m, Amplitude ~48m)
        // Lateral coordinate creates parabolic crescent barchan horns
        const lat1 = (-wx * SIN_WIND1 + wz * COS_WIND1);
        const barchanCurv = snoise(lat1 * 0.0018, (wx * COS_WIND1 + wz * SIN_WIND1) * 0.0008) * 35.0;
        const mainCoord = ((wx * COS_WIND1 + wz * SIN_WIND1) + barchanCurv) * 0.0076;
        const mainDune = asymmetricDune(mainCoord * TWO_PI, 0.68, 3.2) * 48.0;

        // 4. Secondary Intersecting Cross-Dunes & Spurs (Wavelength ~52m, Amplitude ~16m)
        // Forms the intricate network of star spurs and slip-face alcoves
        const crossCoord = (wx * COS_WIND2 + wz * SIN_WIND2) * 0.019;
        const crossDune = asymmetricDune(crossCoord * TWO_PI, 0.55, 2.6) * 16.0;
        const crossMod = snoise(x * 0.0008 + 120.0, z * 0.0008 - 80.0) * 0.5 + 0.5;

        // 5. Aeolian Micro-Ripples (Wavelength ~3.2m, Amplitude ~0.45m)
        const rippleCoord = (x * COS_WIND1 + z * SIN_WIND1) * 0.31 + snoise(x * 0.03, z * 0.03) * 0.4;
        const microRipple = asymmetricDune(rippleCoord * TWO_PI, 0.45, 1.8) * 0.45;

        // Combine elevations
        let y = macroHeight + mainDune + (crossDune * crossMod) + microRipple;

        // 6. Sheltered Interdune Oasis Basins
        const oasis = snoise(x * 0.00035 + 250.0, z * 0.00035 - 250.0);
        if (oasis > 0.62) {
            const t = Math.min((oasis - 0.62) / 0.38, 1.0);
            const bowl = t * t * (3.0 - 2.0 * t);
            y -= bowl * 65.0;
        }

        // 7. Continuous shoreline smoothing
        if (y < 6.0) {
            if (y > 0.0) {
                const t = y / 6.0;
                const st = t * t * (3.0 - 2.0 * t);
                y = -3.0 + 9.0 * st;
            } else {
                y = -3.0 + y * 0.15;
            }
        }

        return y;
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        const grainNoise = snoise(x * 0.015, z * 0.015);
        const oasis = snoise(x * 0.00035 + 250.0, z * 0.00035 - 250.0);

        // Water and oasis transitions
        if (h < 0.5) {
            tempColor.copy(desertColors.deepWater);
            return;
        }
        if (h < 2.2) {
            tempColor.lerpColors(desertColors.deepWater, desertColors.sandBase, smoothstep(0.5, 2.2, h));
            return;
        }
        if (h < 4.0) {
            tempColor.copy(desertColors.sandBase);
            return;
        }
        if (oasis > 0.60 && h < 16.0) {
            if (h < 8.0) {
                tempColor.lerpColors(desertColors.oasisWater, desertColors.oasisGrass, smoothstep(4.0, 8.0, h));
            } else if (h < 12.0) {
                tempColor.lerpColors(desertColors.oasisGrass, desertColors.oasisEdge, smoothstep(8.0, 12.0, h));
            } else {
                tempColor.lerpColors(desertColors.oasisEdge, desertColors.oasisSand, smoothstep(12.0, 16.0, h));
            }
            return;
        }

        // Dune elevation color gradient:
        // Valley Shadow -> Sand Base -> Golden Slope -> Radiant Crest -> Knife-Edge Peak
        if (h < 26.0) {
            tempColor.lerpColors(desertColors.valleyShadow, desertColors.sandBase, smoothstep(4.0, 26.0, h));
        } else if (h < 55.0) {
            tempColor.lerpColors(desertColors.sandBase, desertColors.duneSlope, smoothstep(26.0, 55.0, h));
            if (grainNoise > 0.15) {
                tempColor.r = Math.min(1.0, tempColor.r + 0.02);
            }
        } else if (h < 85.0) {
            tempColor.lerpColors(desertColors.duneSlope, desertColors.duneCrest, smoothstep(55.0, 85.0, h));
            if (grainNoise > 0.25) {
                tempColor.r = Math.min(1.0, tempColor.r + 0.015);
                tempColor.g = Math.min(1.0, tempColor.g + 0.01);
            }
        } else {
            tempColor.lerpColors(desertColors.duneCrest, desertColors.peakHighlight, smoothstep(85.0, 130.0, h));
        }
    }
};

