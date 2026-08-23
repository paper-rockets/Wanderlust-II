import * as THREE from 'three';

const colorDeepWater = new THREE.Color(0x1a4a8c);
const colorSand = new THREE.Color(0xf2e1b8);
const colorIslandGrass = new THREE.Color(0x76d149);
const colorEmeraldGrass = new THREE.Color(0x56b847);
const colorOliveGrass = new THREE.Color(0x8cc440);
const colorHigh = new THREE.Color(0x89e05e);
const colorIslandRock = new THREE.Color(0x8a725a);
const colorDirt = new THREE.Color(0xdcb58a);

export default {
    name: "Ghibli Land",
    shoreName: "Continental Shore",
    getHeight(x, z, snoise) {
        let y = snoise(x * 0.0015, z * 0.0015) * 90.0 + snoise(x * 0.005, z * 0.005) * 35.0 + snoise(x * 0.009, z * 0.009) * 6.0;
        if (y < 12.0) y = (y - 12.0) * 0.25 + 12.0;
        
        // Smooth continuous river channels
        const rn = snoise(x * 0.0015 + 100.0, z * 0.0015 + 100.0);
        const rw = snoise(x * 0.004, z * 0.004) * 0.015;
        const rd = Math.abs(rn + rw);
        if (rd < 0.05) { 
            let c = 1.0 - rd / 0.05; 
            c = c * c * (3.0 - 2.0 * c); 
            y -= c * 14.0; 
        }
        
        // Smooth broad lakes
        const ln = snoise(x * 0.0015 - 500.0, z * 0.0015 + 500.0);
        if (ln > 0.72) {
            const d = Math.min((ln - 0.72) * 3.2, 1.0); 
            let c = d * d * (3.0 - 2.0 * d); 
            y -= c * 15.0; 
        }

        // Continuous shoreline smoothing: creates clean, smooth sandy beaches without isolated polygon punctures
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
        const meadowNoise = snoise(x * 0.0035, z * 0.0035);
        const oliveNoise = snoise(x * 0.008 + 200, z * 0.008 + 200);

        if (h < 0.5) {
            tempColor.copy(colorDeepWater);
        } else if (h < 2.2) {
            tempColor.lerpColors(colorDeepWater, colorSand, smoothstep(0.5, 2.2, h));
        } else if (h < 4.0) {
            tempColor.copy(colorSand);
        } else if (h < 9.0) {
            tempColor.lerpColors(colorSand, colorIslandGrass, smoothstep(4.0, 9.0, h));
        } else if (h < 25) {
            const patchColor = colorIslandGrass.clone();
            if (meadowNoise > 0.15) patchColor.lerp(colorEmeraldGrass, Math.min(1, (meadowNoise - 0.15) * 2.5));
            if (oliveNoise > 0.2) patchColor.lerp(colorOliveGrass, Math.min(1, (oliveNoise - 0.2) * 2.5));
            tempColor.lerpColors(patchColor, colorHigh, smoothstep(9.0, 25, h));
        } else if (h < 38) {
            tempColor.lerpColors(colorHigh, colorIslandRock, smoothstep(25, 38, h));
        } else {
            tempColor.lerpColors(colorIslandRock, colorDirt, smoothstep(38, 55, h));
        }
    }
};
