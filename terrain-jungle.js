import * as THREE from 'three';

// Vibrant Tropical Jungle Color Palette (Color Overhaul)
const colorDeepWater    = new THREE.Color(0x0a5c5a); // Rich Tropical Lagoon Teal
const colorShallowWater = new THREE.Color(0x1bb3a0); // Vibrant Turquoise Shore
const colorSand         = new THREE.Color(0xdfbf7a); // Warm Tropical Golden Sand
const colorJungleGrass  = new THREE.Color(0x38b000); // Vibrant Emerald Lowland Grass
const colorJungleMid    = new THREE.Color(0x1b8a4b); // Rich Lush Canopy Green
const colorJungleHigh   = new THREE.Color(0x106038); // Deep Jade Rainforest Canopy
const colorJungleMoss   = new THREE.Color(0x70e000); // Vivid High-light Canopy Moss
const colorTealAccent   = new THREE.Color(0x00a896); // Tropical Flora/Mist Tint
const colorRock         = new THREE.Color(0x594f42); // Warm Mossy Karst Rock
const colorSoil         = new THREE.Color(0x7a5033); // Rich Tropical Clay Soil

function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

export default {
    name: "🌴 Lush Jungle",
    shoreName: "🌿 Mangrove Shore",
    
    // Terrain Overhaul: Rolling canopy hills, winding mangrove river valleys, dramatic karst pinnacles
    getHeight(x, z, snoise) {
        // Multi-octave smooth terrain noise
        const nBase = snoise(x * 0.0008, z * 0.0008) * 35.0; // Broad rolling landforms
        const nHills = snoise(x * 0.0025 + 120, z * 0.0025 + 450) * 18.0; // Canopy knolls
        const nDetail = snoise(x * 0.008 + 500, z * 0.008 + 800) * 5.0; // Micro understory relief
        
        // Winding Jungle River Basins & Lagoons
        const riverN = Math.abs(snoise(x * 0.0012 + 300, z * 0.0012 - 300));
        let riverCarve = 0;
        if (riverN < 0.12) {
            let t = 1.0 - (riverN / 0.12);
            riverCarve = smoothstep(0, 1, t) * 16.0;
        }

        // Tropical Karst Plateau & Cliff Features (dramatic tepuis/karsts without crushing sharp spiky ridges)
        const karstN = snoise(x * 0.0015 - 800, z * 0.0015 + 800);
        let karstElevation = 0;
        if (karstN > 0.45) {
            let k = smoothstep(0.45, 0.75, karstN);
            karstElevation = k * 35.0;
        }

        let h = nBase + nHills + nDetail - riverCarve + karstElevation + 22.0;
        
        // Ensure baseline terrain remains above ocean/mangrove water
        return Math.max(5.5, h);
    },

    // Color Overhaul: Dynamic spatial noise blending, rich tropical gradients, mossy cliff accents
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
            // Lowland Jungle Grass & Mangrove vegetation
            const baseLowland = colorJungleGrass.clone();
            if (patchNoise > 0.1) baseLowland.lerp(colorTealAccent, Math.min(1.0, (patchNoise - 0.1) * 1.8));
            if (mossNoise > 0.2)  baseLowland.lerp(colorJungleMoss, Math.min(1.0, (mossNoise - 0.2) * 1.5));
            tempColor.lerpColors(colorSand, baseLowland, smoothstep(9.0, 22.0, h));
        } else if (h < 48.0) {
            // Mid Canopy & Forested Slopes
            const baseMid = colorJungleMid.clone();
            if (patchNoise > 0.0) baseMid.lerp(colorJungleGrass, Math.min(1.0, patchNoise * 1.5));
            if (mossNoise > 0.15) baseMid.lerp(colorSoil, Math.min(1.0, (mossNoise - 0.15) * 1.2));
            tempColor.lerpColors(colorJungleGrass, baseMid, smoothstep(22.0, 48.0, h));
        } else if (h < 70.0) {
            // High Rainforest Canopy & Karst lower cliffs
            const baseHigh = colorJungleHigh.clone();
            if (mossNoise > 0.2) baseHigh.lerp(colorJungleMoss, Math.min(1.0, (mossNoise - 0.2) * 2.0));
            tempColor.lerpColors(colorJungleMid, baseHigh, smoothstep(48.0, 70.0, h));
        } else {
            // Ancient Mossy Karst Rock / Cliff Top
            const cliffBase = colorRock.clone();
            if (patchNoise > 0.0) cliffBase.lerp(colorJungleHigh, 0.4);
            tempColor.lerpColors(colorJungleHigh, cliffBase, smoothstep(70.0, 95.0, h));
        }
    }
};
