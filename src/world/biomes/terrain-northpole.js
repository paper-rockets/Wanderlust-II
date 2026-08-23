import * as THREE from 'three';

export const northPoleColors = {
    ocean:         new THREE.Color(0x0c2548),
    iceWater:      new THREE.Color(0x1a5276),
    glacierShore:  new THREE.Color(0xaed6f1),
    iceShelf:      new THREE.Color(0xbae6fd),
    snowDune:      new THREE.Color(0xeaf2f8),
    snowShadow:    new THREE.Color(0xa9cce3),
    glacierIce:    new THREE.Color(0x7fb3d5),
    icePeak:       new THREE.Color(0xfdfefe),
    peakHighlight: new THREE.Color(0xf8fafc)
};

export default {
    name: "North Pole",
    shoreName: "Ice Shelf",
    getHeight(x, z, snoise) {
        const macro = snoise(x * 0.0006, z * 0.0006) * 40.0 + 25.0;

        const warpX = snoise(x * 0.0010, z * 0.0010) * 90.0;
        const warpZ = snoise(x * 0.0010 + 150.0, z * 0.0010 + 150.0) * 90.0;
        const wx = x + warpX;
        const wz = z + warpZ;

        // Rolling glacial slopes and soft mountain ridges
        const r1 = Math.abs(snoise(wx * 0.0015, wz * 0.0015));
        const r2 = snoise(wx * 0.0035 + 80.0, wz * 0.0035 + 80.0) * 0.2;
        const ridge = Math.pow(Math.max(0.0, 1.0 - r1 + r2), 1.5) * 85.0;

        let y = macro + ridge;

        // Continuous shoreline smoothing
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
        const shadowNoise = snoise(x * 0.004 + 100.0, z * 0.004 + 100.0);

        if (h < 0.5) {
            tempColor.copy(northPoleColors.ocean);
        } else if (h < 2.2) {
            tempColor.lerpColors(northPoleColors.ocean, northPoleColors.iceWater, smoothstep(0.5, 2.2, h));
        } else if (h < 4.0) {
            tempColor.copy(northPoleColors.iceShelf);
        } else if (h < 18.0) {
            tempColor.lerpColors(northPoleColors.iceShelf, northPoleColors.snowDune, smoothstep(4.0, 18.0, h));
            if (shadowNoise > 0.15) {
                tempColor.lerp(northPoleColors.snowShadow, (shadowNoise - 0.15) * 0.5);
            }
        } else if (h < 45.0) {
            tempColor.lerpColors(northPoleColors.snowDune, northPoleColors.glacierIce, smoothstep(18.0, 45.0, h));
        } else {
            tempColor.lerpColors(northPoleColors.glacierIce, northPoleColors.icePeak, smoothstep(45.0, 95.0, h));
        }
    }
};
