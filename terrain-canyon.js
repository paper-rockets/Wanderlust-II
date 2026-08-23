import * as THREE from 'three';

// Rich American Southwest & Badlands Sedimentary Strata Palette
const palette = {
    washFloor:      new THREE.Color(0xdf946e), // Warm sun-baked sandstone wash & dry river silt
    washGravel:     new THREE.Color(0xcb754e), // Weathered canyon wash gravel / terracotta sand
    shaleBase:      new THREE.Color(0xad4c32), // Lower iron-clay shale band
    redSandstone1:  new THREE.Color(0xba4528), // Deep cinnabar / vermilion red rock cliff face
    redSandstone2:  new THREE.Color(0xc75234), // Vibrant sunlit red sandstone
    ochreBand:      new THREE.Color(0xdc8637), // Warm golden copper & ochre sandstone
    creamLimestone: new THREE.Color(0xf0caa2), // Cream / pale peach Coconino limestone shelf
    roseClay:       new THREE.Color(0xc26252), // Dusty rose / mauve sedimentary layer
    shadowUmber:    new THREE.Color(0x6d2012), // Deep iron seam & canyon shadow umber
    mesaCap:        new THREE.Color(0xde8f59), // Sun-bleached mesa plateau capstone
    highHighlight:  new THREE.Color(0xf5dbbe), // Sunlit mesa rim highlight
    riverWater:     new THREE.Color(0x197486)  // Canyon river oasis (only below water line)
};

export default {
    name: "⛰️ Badlands Canyon",
    shoreName: "🏜️ Dry Shore",

    // Overhaul: Multi-tiered step terraces, deep slot canyon gorges, isolated mesa buttes & hoodoos
    getHeight(x, z, snoise) {
        // 1. Domain warping for natural snake-like winding canyon bends and weathered cliff amphitheaters
        const warp1X = snoise(x * 0.00030, z * 0.00030) * 380.0;
        const warp1Z = snoise(x * 0.00030 + 140.0, z * 0.00030 - 140.0) * 380.0;
        const warp2X = snoise(x * 0.0010 + 70.0, z * 0.0010 + 70.0) * 110.0;
        const warp2Z = snoise(x * 0.0010 - 70.0, z * 0.0010 - 70.0) * 110.0;
        const wx = x + warp1X + warp2X;
        const wz = z + warp1Z + warp2Z;

        // 2. High Elevated Mesa Plateau Tableland
        const macroNoise = snoise(wx * 0.00022, wz * 0.00022) * 0.5 + 0.5;
        const baseHeight = 78.0 + macroNoise * 42.0; // 78m to 120m high plateau

        // 3. Primary Grand Canyon Gorge (Deep winding slot river canyon)
        const gorgeNoise = Math.abs(snoise(wx * 0.00072 + 220.0, wz * 0.00072 - 220.0));
        let gorgeCarve = 0;
        if (gorgeNoise < 0.22) {
            const t = 1.0 - (gorgeNoise / 0.22);
            // Sinuous canyon wall profile with steep drops and flat valley floor
            const wallShape = Math.pow(t, 1.4) * (3.0 - 2.0 * t);
            gorgeCarve = wallShape * 82.0;
        }

        // 4. Secondary Tributary Gulches & Branching Side Canyons
        const gulchNoise = Math.abs(snoise(wx * 0.0017 - 350.0, wz * 0.0017 + 350.0));
        let gulchCarve = 0;
        if (gulchNoise < 0.14) {
            const t2 = 1.0 - (gulchNoise / 0.14);
            const gulchShape = t2 * t2 * (3.0 - 2.0 * t2);
            gulchCarve = gulchShape * 30.0;
        }

        // 5. Tertiary Micro-Gullies & Fluted Amphitheater Runnels
        const gullyNoise = Math.abs(snoise(wx * 0.0042 + 90.0, wz * 0.0042 - 90.0));
        let gullyCarve = 0;
        if (gullyNoise < 0.10) {
            const t3 = 1.0 - (gullyNoise / 0.10);
            gullyCarve = t3 * t3 * 9.0;
        }

        const carvedHeight = baseHeight - gorgeCarve - gulchCarve - gullyCarve;

        // 6. Geological Step Terraces (Sandstone/Limestone Cliff Ledges & Shale Scree Benches)
        const stepSize = 14.0;
        const stepNorm = carvedHeight / stepSize;
        const stepBase = Math.floor(stepNorm);
        const stepFrac = stepNorm - stepBase;
        // Smoothstep cliff transition with flat bench ledge
        const cliffT = Math.max(0, Math.min(1, (stepFrac - 0.18) / 0.64));
        const cliffShape = Math.pow(cliffT * cliffT * (3.0 - 2.0 * cliffT), 1.7);
        const terracedHeight = (stepBase + cliffShape) * stepSize;

        // Blend smooth carved height with stepped geological terraces
        let h = carvedHeight * 0.32 + terracedHeight * 0.68;

        // 7. Freestanding Mesa Butte Monoliths (Monument Valley style)
        const butteNoise = snoise(wx * 0.0014 + 750.0, wz * 0.0014 - 750.0);
        if (butteNoise > 0.58 && gorgeCarve > 30.0) {
            const bFactor = (butteNoise - 0.58) / 0.42;
            const bShape = bFactor * bFactor * (3.0 - 2.0 * bFactor);
            const butteHeight = Math.min(1.0, bShape * 1.8) * 44.0;
            h += butteHeight;
        }

        // 8. Slender Hoodoo Spires & Pinnacles (Bryce Canyon style)
        const hoodooNoise = snoise(wx * 0.0052 - 500.0, wz * 0.0052 + 500.0);
        if (hoodooNoise > 0.70 && gorgeCarve > 20.0) {
            const hFactor = (hoodooNoise - 0.70) / 0.30;
            const spire = Math.pow(hFactor, 2.2) * 26.0;
            h += spire;
        }

        // 9. Weathered Wind Detail
        const microDetail = snoise(wx * 0.012, wz * 0.012) * 1.4;
        h += microDetail;

        return Math.max(8.0, h);
    },

    // Overhaul: Continuous multi-band sedimentary strata with smooth geological transitions
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        // Water & Oasis Shore
        if (h <= 6.2) {
            tempColor.lerpColors(palette.riverWater, palette.washFloor, smoothstep(5.0, 6.2, h));
            return;
        }

        // Canyon Floor Wash (Warm sandstone sand & dry riverbed silt)
        if (h < 15.0) {
            tempColor.lerpColors(palette.washFloor, palette.washGravel, smoothstep(6.2, 15.0, h));
            return;
        }

        // Broad Geological Strata Column with Domain-Warped Strata Tilt
        const strataWarp = snoise(x * 0.0012, z * 0.0012) * 5.0 + snoise(x * 0.004, z * 0.004) * 1.8;
        const strataY = h + strataWarp;

        // Continuous Geological Strata Layers
        if (strataY < 30.0) {
            tempColor.lerpColors(palette.washGravel, palette.shaleBase, smoothstep(15.0, 30.0, strataY));
        } else if (strataY < 50.0) {
            tempColor.lerpColors(palette.shaleBase, palette.redSandstone1, smoothstep(30.0, 50.0, strataY));
        } else if (strataY < 70.0) {
            tempColor.lerpColors(palette.redSandstone1, palette.ochreBand, smoothstep(50.0, 70.0, strataY));
        } else if (strataY < 88.0) {
            tempColor.lerpColors(palette.ochreBand, palette.creamLimestone, smoothstep(70.0, 88.0, strataY));
        } else if (strataY < 106.0) {
            tempColor.lerpColors(palette.creamLimestone, palette.roseClay, smoothstep(88.0, 106.0, strataY));
        } else if (strataY < 124.0) {
            tempColor.lerpColors(palette.roseClay, palette.redSandstone2, smoothstep(106.0, 124.0, strataY));
        } else {
            tempColor.lerpColors(palette.redSandstone2, palette.mesaCap, smoothstep(124.0, 145.0, strataY));
        }

        // Fine Sandstone Bedding Micro-Strata (Smooth harmonic modulation)
        const microBedding = Math.sin(strataY * 0.40);
        if (microBedding > 0.3) {
            const mbFactor = (microBedding - 0.3) * 0.35;
            tempColor.lerp(palette.creamLimestone, mbFactor * 0.35);
        } else if (microBedding < -0.3) {
            const mbFactor2 = (-microBedding - 0.3) * 0.35;
            tempColor.lerp(palette.redSandstone1, mbFactor2 * 0.35);
        }

        // Desert Varnish / Weathering Iron Patina Streaks
        const varnishNoise = snoise(x * 0.008 + 120.0, z * 0.008 - 120.0);
        if (varnishNoise > 0.60 && h > 24.0) {
            const v = (varnishNoise - 0.60) / 0.40;
            tempColor.lerp(palette.shadowUmber, v * 0.45);
        }

        // High Sunlit Mesa Capstone Highlight
        if (h > 115.0) {
            const rimFactor = smoothstep(115.0, 140.0, h);
            tempColor.lerp(palette.highHighlight, rimFactor * 0.3);
        }
    }
};
