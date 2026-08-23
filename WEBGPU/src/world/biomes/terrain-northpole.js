import * as THREE from 'three';

export const northPoleColors = {
    ocean:         new THREE.Color(0x1e3a8a),
    iceWater:      new THREE.Color(0x0ea5e9),
    glacierShore:  new THREE.Color(0x38bdf8),
    iceShelf:      new THREE.Color(0xbae6fd),
    snowDune:      new THREE.Color(0xe0f2fe),
    glacierIce:    new THREE.Color(0x7dd3fc),
    snowShadow:    new THREE.Color(0x93c5fd),
    icePeak:       new THREE.Color(0xf0f9ff),
    peakHighlight: new THREE.Color(0xf8fafc)
};

const cosR = 0.8660254;
const sinR = 0.5;

export default {
    name: "❄️ North Pole",
    shoreName: "🧊 Ice Shelf",
    getHeight(x, z, snoise) {
        const rx = x * cosR - z * sinR;
        const rz = x * sinR + z * cosR;

        const warpX = snoise(rx * 0.0004, rz * 0.0004) * 140.0;
        const warpZ = snoise(rx * 0.0004 + 100.0, rz * 0.0004 + 100.0) * 140.0;
        const wx = rx + warpX;
        const wz = rz + warpZ;

        const duneNoise1 = snoise(wx * 0.0007, wz * 0.0007);
        const duneNoise2 = snoise(wx * 0.002 + 150.0, wz * 0.002 + 150.0);
        let dunes = Math.abs(duneNoise1) * 45.0 + Math.abs(duneNoise2) * 20.0;

        let ridge1 = 1.0 - Math.abs(snoise(wx * 0.0008 + 300.0, wz * 0.0008 - 200.0));
        ridge1 = ridge1 * ridge1 * (3.0 - 2.0 * ridge1);

        let ridge2 = 1.0 - Math.abs(snoise(wx * 0.0018 - 400.0, wz * 0.0018 + 500.0));
        ridge2 = ridge2 * ridge2 * (3.0 - 2.0 * ridge2);

        let ridge3 = snoise(wx * 0.0035 + 50.0, wz * 0.0035 + 50.0) * 0.5 + 0.5;

        const clusterNoise = snoise(rx * 0.0003 - 100.0, rz * 0.0003 + 100.0) * 0.5 + 0.5;
        const clusterIntensity = Math.max(0, Math.min(1, (clusterNoise - 0.25) / 0.50));

        const combinedRidge = ridge1 * 0.65 + ridge2 * 0.35 + ridge3 * 0.15;
        const peakHeight = Math.pow(combinedRidge, 2.2) * 130.0 * (clusterIntensity * clusterIntensity * (3 - 2 * clusterIntensity));

        const distFromBoundary = Math.min(Math.abs(z - 210000), Math.abs(z - 180000));
        const bVal = Math.max(0, Math.min(1, (distFromBoundary - 500.0) / 4500.0));
        const boundaryFade = bVal * bVal * (3 - 2 * bVal);

        const pool1 = snoise(rx * 0.0006 + 700.0, rz * 0.0006 - 300.0) * 0.5 + 0.5;
        const pool2 = snoise(rx * 0.0015 + 900.0, rz * 0.0015 + 800.0) * 0.5 + 0.5;
        const poolMask = pool1 * pool2;
        const poolDip = poolMask > 0.42 ? 0.0 : Math.pow(1.0 - poolMask / 0.42, 2.0) * 18.0;

        const capNoise = snoise(rx * 0.0005 - 500.0, rz * 0.0005 + 400.0) * 0.5 + 0.5;
        const capFlat = capNoise > 0.65 ? Math.min(1.0, (capNoise - 0.65) / 0.15) : 0.0;

        let rawH = (dunes + peakHeight) * boundaryFade + 2.0;
        rawH -= poolDip * boundaryFade;
        if (capFlat > 0.0 && rawH > 25.0 && rawH < 80.0) {
            const plateau = 30.0 + capNoise * 15.0;
            rawH = rawH + (plateau - rawH) * capFlat * 0.6;
        }
        return Math.max(-5.0, rawH);
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        const rx = x * cosR - z * sinR;
        const rz = x * sinR + z * cosR;

        const shadowNoise = snoise(rx * 0.005 + 20.0, rz * 0.005 + 20.0) * 0.5 + 0.5;
        const glacierGlint = snoise(rx * 0.01 + 500.0, rz * 0.01 - 300.0) * 0.5 + 0.5;

        if (h <= 2.0) {
            tempColor.lerpColors(northPoleColors.ocean, northPoleColors.iceWater, smoothstep(-5.0, 2.0, h));
            return;
        }

        if (h <= 6.1) {
            tempColor.lerpColors(northPoleColors.iceWater, northPoleColors.glacierShore, smoothstep(2.0, 6.1, h));
            return;
        }

        if (h < 14.0) {
            tempColor.lerpColors(northPoleColors.glacierShore, northPoleColors.iceShelf, smoothstep(6.1, 14.0, h));
        } else if (h < 35.0) {
            const t = smoothstep(14.0, 35.0, h);
            tempColor.lerpColors(northPoleColors.iceShelf, northPoleColors.snowDune, t);
            if (shadowNoise > 0.6) {
                tempColor.lerp(northPoleColors.snowShadow, (shadowNoise - 0.6) * 0.4);
            }
        } else if (h < 75.0) {
            const t = smoothstep(35.0, 75.0, h);
            tempColor.lerpColors(northPoleColors.snowDune, northPoleColors.glacierIce, t);
            if (glacierGlint > 0.65) {
                tempColor.lerp(northPoleColors.peakHighlight, (glacierGlint - 0.65) * 0.5);
            }
        } else {
            const t = smoothstep(75.0, 120.0, h);
            tempColor.lerpColors(northPoleColors.glacierIce, northPoleColors.icePeak, t);
            if (glacierGlint > 0.5) {
                tempColor.lerp(northPoleColors.peakHighlight, (glacierGlint - 0.5) * 0.3);
            }
        }
    }
};
