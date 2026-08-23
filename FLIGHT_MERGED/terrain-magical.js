import * as THREE from 'three';

const colorDeepWater = new THREE.Color(0x0a1c3a); // Dark navy water
const colorSand = new THREE.Color(0xb2ebf2);       // Glowing pale cyan shore sand
const colorMagicalViolet = new THREE.Color(0xab47bc); // Purple/violet mystical grass
const colorMagicalPink = new THREE.Color(0xf8bbd0);   // Soft glowing pink highlight grass
const colorMagicalRock = new THREE.Color(0x311b92);   // Deep indigo basalt rock
const colorDirt = new THREE.Color(0x1a0933);          // Dark void ground

export default {
    name: "✨ Magical Sanctuary",
    shoreName: "░ Magical Shore",
    getHeight(x, z, snoise) {
        // Surreal rolling plateaus with pillars
        const n1 = snoise(x * 0.0015, z * 0.0015);
        const n2 = snoise(x * 0.008, z * 0.008);
        const pillars = Math.max(0, Math.sin(x * 0.004) * Math.cos(z * 0.004));
        const h = n1 * 45.0 + n2 * 10.0 + (pillars * pillars) * 80.0 + 10.0;
        return Math.max(6.0, h);
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        if (h < 1.0) {
            tempColor.copy(colorDeepWater);
        } else if (h < 2.35) {
            tempColor.lerpColors(colorDeepWater, colorSand, smoothstep(1.0, 2.35, h));
        } else if (h < 4.2) {
            tempColor.copy(colorSand);
        } else if (h < 6.2) {
            tempColor.lerpColors(colorSand, colorMagicalViolet, smoothstep(4.2, 6.2, h));
        } else if (h < 25) {
            tempColor.lerpColors(colorMagicalViolet, colorMagicalPink, smoothstep(6.2, 25, h));
        } else if (h < 38) {
            tempColor.lerpColors(colorMagicalPink, colorMagicalRock, smoothstep(25, 38, h));
        } else {
            tempColor.lerpColors(colorMagicalRock, colorDirt, smoothstep(38, 55, h));
        }
    }
};
