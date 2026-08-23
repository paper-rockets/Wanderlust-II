import * as THREE from 'three';
function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}


const colorDeepWater  = new THREE.Color(0x0d2d5a);
const colorCrystalSea = new THREE.Color(0x2ab0c5);
const colorSand       = new THREE.Color(0xc8e8f2);
const colorValleyFloor= new THREE.Color(0x4ecdc4);
const colorCrystalLow = new THREE.Color(0x7fffd4);
const colorCrystalMid = new THREE.Color(0xa78bfa);
const colorCrystalHigh= new THREE.Color(0xe0b0ff);
const colorSpire      = new THREE.Color(0xffffff);

export default {
    name: '💎 Crystal Land',
    getHeight(x, z, snoise) {
        // Broad gentle valley floor
        const valley = snoise(x * 0.0008, z * 0.0008) * 18.0 + snoise(x * 0.002, z * 0.002) * 8.0 + 14.0;

        // Crystal spire clusters — sharp narrow peaks scattered across the valley
        const spikeN1 = snoise(x * 0.011 + 300, z * 0.011 - 200);
        const spikeN2 = snoise(x * 0.013 - 500, z * 0.013 + 400);
        const spikeN3 = snoise(x * 0.009 + 700, z * 0.009 + 100);

        const s1 = Math.max(0, spikeN1 - 0.60) / 0.40;  // threshold 0.60
        const s2 = Math.max(0, spikeN2 - 0.62) / 0.38;
        const s3 = Math.max(0, spikeN3 - 0.64) / 0.36;

        const spires = (s1 * s1 * 90.0) + (s2 * s2 * 70.0) + (s3 * s3 * 55.0);

        // Shallow crystal lakes scattered in low spots
        const lakeN = snoise(x * 0.006 + 900, z * 0.006 - 700);
        const lake = lakeN > 0.70 ? -(lakeN - 0.70) * 25.0 : 0.0;

        return Math.max(-2.0, valley + spires + lake);
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        const shimmer = snoise(x * 0.025 + 1000, z * 0.025 + 1000) * 0.5 + 0.5;

        if (h < -1.0) {
            tempColor.copy(colorDeepWater);
        } else if (h < 1.0) {
            tempColor.lerpColors(colorDeepWater, colorCrystalSea, smoothstep(-1.0, 1.0, h));
        } else if (h < 3.5) {
            tempColor.copy(colorSand);
        } else if (h < 14.0) {
            tempColor.lerpColors(colorSand, colorValleyFloor, smoothstep(3.5, 14.0, h));
        } else if (h < 25.0) {
            tempColor.lerpColors(colorValleyFloor, colorCrystalLow, smoothstep(14.0, 25.0, h));
        } else if (h < 55.0) {
            const t = smoothstep(25.0, 55.0, h);
            tempColor.lerpColors(colorCrystalLow, colorCrystalMid, t);
            // shimmer shift toward purple on certain faces
            if (shimmer > 0.65) tempColor.lerp(colorCrystalHigh, (shimmer - 0.65) * 1.5);
        } else {
            tempColor.lerpColors(colorCrystalMid, colorSpire, smoothstep(55.0, 95.0, h));
        }
    }
};
