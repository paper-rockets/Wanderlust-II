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
    name: "🌳 Ghibli Land",
    shoreName: "░ Continental Shore",
    getHeight(x, z, snoise) {
        let y = snoise(x * 0.0015, z * 0.0015) * 90.0 + snoise(x * 0.005, z * 0.005) * 35.0 + snoise(x * 0.02, z * 0.02) * 8.0;
        if (y < 12.0) y = (y - 12.0) * 0.15 + 12.0;
        
        const rn = snoise(x * 0.0015 + 100.0, z * 0.0015 + 100.0);
        const rw = snoise(x * 0.01, z * 0.01) * 0.02;
        const rd = Math.abs(rn + rw);
        if (rd < 0.04) { 
            let c = 1.0 - rd / 0.04; 
            c = c * c * (3.0 - 2.0 * c); 
            y -= c * 15.0; 
        }
        
        const ln = snoise(x * 0.002 - 500.0, z * 0.002 + 500.0);
        if (ln > 0.72) {
            const d = Math.min((ln - 0.72) * 3.5, 1.0); 
            let c = d * d * (3.0 - 2.0 * d); 
            y -= c * 15.0; 
        }

        // Clamp base terrain above water (original behavior)
        y = Math.max(6.0, y);

        // Sparse small ponds (applied AFTER the base clamp)
        const pondN = snoise(x * 0.012 + 880.0, z * 0.012 - 550.0);
        if (pondN > 0.78) {
            let t = Math.min((pondN - 0.78) / 0.15, 1.0);
            let c = t * t * (3.0 - 2.0 * t);
            y -= c * 8.0;
        }

        return y;
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        const meadowNoise = snoise(x * 0.0035, z * 0.0035);
        const oliveNoise = snoise(x * 0.008 + 200, z * 0.008 + 200);

        if (h < 1.0) {
            tempColor.copy(colorDeepWater);
        } else if (h < 2.35) {
            tempColor.lerpColors(colorDeepWater, colorSand, smoothstep(1.0, 2.35, h));
        } else if (h < 4.2) {
            tempColor.copy(colorSand);
        } else if (h < 6.2) {
            tempColor.lerpColors(colorSand, colorIslandGrass, smoothstep(4.2, 6.2, h));
        } else if (h < 25) {
            const patchColor = colorIslandGrass.clone();
            if (meadowNoise > 0.15) patchColor.lerp(colorEmeraldGrass, Math.min(1, (meadowNoise - 0.15) * 2.5));
            if (oliveNoise > 0.2) patchColor.lerp(colorOliveGrass, Math.min(1, (oliveNoise - 0.2) * 2.5));
            tempColor.lerpColors(patchColor, colorHigh, smoothstep(6.2, 25, h));
        } else if (h < 38) {
            tempColor.lerpColors(colorHigh, colorIslandRock, smoothstep(25, 38, h));
        } else {
            tempColor.lerpColors(colorIslandRock, colorDirt, smoothstep(38, 55, h));
        }
    }
};
