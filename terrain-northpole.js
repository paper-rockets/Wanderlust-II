import * as THREE from 'three';

// --- Color Palette: Pristine Ghibli Arctic (Soft Powder Snow Blue) ---
export const northPoleColors = {
    ocean:         new THREE.Color(0x1e3a8a), // Deep Polar Navy
    iceWater:      new THREE.Color(0x0ea5e9), // Vibrant Arctic Blue Shallows
    glacierShore:  new THREE.Color(0x38bdf8), // Cyan Ice Shoreline
    iceShelf:      new THREE.Color(0xbae6fd), // Icy Powder Blue Base
    snowDune:      new THREE.Color(0xe0f2fe), // Soft Pristine Arctic Snow Blue
    glacierIce:    new THREE.Color(0x7dd3fc), // Translucent Glacier Blue Slopes
    snowShadow:    new THREE.Color(0x93c5fd), // Soft Blue Crevasse Shadow Tint
    icePeak:       new THREE.Color(0xf0f9ff), // Crisp Ice Mountain Peak
    peakHighlight: new THREE.Color(0xf8fafc)  // Soft Glacier Crest
};

// Domain rotation matrix to break grid alignment & eliminate saw-tooth cross patterns
const cosR = 0.8660254; // cos(30 deg)
const sinR = 0.5;       // sin(30 deg)

function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

export default {
    name: "❄️ North Pole",
    shoreName: "🧊 Ice Shelf",
    getHeight(x, z, snoise) {
        // 1. Domain rotation to break X/Z grid alignment and saw-tooth artifacts
        const rx = x * cosR - z * sinR;
        const rz = x * sinR + z * cosR;

        // 2. Soft domain warping for organic, sweeping glacier curves
        const warpX = snoise(rx * 0.0004, rz * 0.0004) * 140.0;
        const warpZ = snoise(rx * 0.0004 + 100.0, rz * 0.0004 + 100.0) * 140.0;
        const wx = rx + warpX;
        const wz = rz + warpZ;

        // 3. Gentle rolling snow dunes
        const duneNoise1 = snoise(wx * 0.0007, wz * 0.0007);
        const duneNoise2 = snoise(wx * 0.002 + 150.0, wz * 0.002 + 150.0);
        let dunes = Math.abs(duneNoise1) * 45.0 + Math.abs(duneNoise2) * 20.0;

        // 4. Majestic, smooth glacier mountain ridges and iceberg clusters
        // Smoothstep shaping on noise ridges eliminates sharp crease spikes
        let ridge1 = 1.0 - Math.abs(snoise(wx * 0.0008 + 300.0, wz * 0.0008 - 200.0));
        ridge1 = ridge1 * ridge1 * (3.0 - 2.0 * ridge1);

        let ridge2 = 1.0 - Math.abs(snoise(wx * 0.0018 - 400.0, wz * 0.0018 + 500.0));
        ridge2 = ridge2 * ridge2 * (3.0 - 2.0 * ridge2);

        let ridge3 = snoise(wx * 0.0035 + 50.0, wz * 0.0035 + 50.0) * 0.5 + 0.5;

        // Organic mountain cluster mask
        const clusterNoise = snoise(rx * 0.0003 - 100.0, rz * 0.0003 + 100.0) * 0.5 + 0.5;
        const clusterIntensity = smoothstep(0.25, 0.75, clusterNoise);

        // Combine smooth ridges cleanly
        const combinedRidge = ridge1 * 0.65 + ridge2 * 0.35 + ridge3 * 0.15;
        const peakHeight = Math.pow(combinedRidge, 2.2) * 130.0 * clusterIntensity;

        // Apply global terrain smoothing parameter if present
        const smoothingFactor = 1.0 - Math.min(1.0, Math.max(0.0, window.terrainSmoothing || 0.0));
        const mountainH = peakHeight * smoothingFactor;

        // Taper height near North Pole boundaries (180,000 to 210,000) to smoothly merge with ocean/adjacent biomes
        const distFromBoundary = Math.min(Math.abs(z - 210000), Math.abs(z - 180000));
        const boundaryFade = smoothstep(500.0, 5000.0, distFromBoundary);

        // Total smooth height
        const rawH = (dunes + mountainH) * boundaryFade + 2.0;

        return Math.max(-5.0, rawH);
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        // Domain rotation for color noise variations
        const rx = x * cosR - z * sinR;
        const rz = x * sinR + z * cosR;

        // Subtle micro-variation for snow shadows and glacier highlights
        const shadowNoise = snoise(rx * 0.005 + 20.0, rz * 0.005 + 20.0) * 0.5 + 0.5;
        const glacierGlint = snoise(rx * 0.01 + 500.0, rz * 0.01 - 300.0) * 0.5 + 0.5;

        if (h <= 2.0) {
            // Deep ocean to ice water transition
            tempColor.lerpColors(northPoleColors.ocean, northPoleColors.iceWater, smoothstep(-5.0, 2.0, h));
            return;
        }

        if (h <= 6.1) {
            // Ice water to frozen shore transition
            tempColor.lerpColors(northPoleColors.iceWater, northPoleColors.glacierShore, smoothstep(2.0, 6.1, h));
            return;
        }

        if (h < 14.0) {
            // Shore to snow dune base
            tempColor.lerpColors(northPoleColors.glacierShore, northPoleColors.iceShelf, smoothstep(6.1, 14.0, h));
        } else if (h < 35.0) {
            // Snow dunes with soft blue crevasse shadows
            const t = smoothstep(14.0, 35.0, h);
            tempColor.lerpColors(northPoleColors.iceShelf, northPoleColors.snowDune, t);
            if (shadowNoise > 0.6) {
                tempColor.lerp(northPoleColors.snowShadow, (shadowNoise - 0.6) * 0.4);
            }
        } else if (h < 75.0) {
            // Mid-elevation glacier ice slopes
            const t = smoothstep(35.0, 75.0, h);
            tempColor.lerpColors(northPoleColors.snowDune, northPoleColors.glacierIce, t);
            if (glacierGlint > 0.65) {
                tempColor.lerp(northPoleColors.peakHighlight, (glacierGlint - 0.65) * 0.5);
            }
        } else {
            // High icy mountain peaks (Pristine snow cap white & glacial highlights)
            const t = smoothstep(75.0, 120.0, h);
            tempColor.lerpColors(northPoleColors.glacierIce, northPoleColors.icePeak, t);
            if (glacierGlint > 0.5) {
                tempColor.lerp(northPoleColors.peakHighlight, (glacierGlint - 0.5) * 0.3);
            }
        }
    }
};

