import * as THREE from 'three';

const colorDeepWater = new THREE.Color(0x1a4a8c);
const colorSand = new THREE.Color(0xf2e1b8);
const colorJungleGrass = new THREE.Color(0x389c45); // Tropical emerald
const colorJungleHigh = new THREE.Color(0x286330);  // Deep canopy green
const colorIslandRock = new THREE.Color(0x8a725a);
const colorDirt = new THREE.Color(0xdcb58a);

export default {
    name: "🌴 Lush Jungle",
    shoreName: "░ Jungle Shore",
    getHeight(x, z, snoise) {
        const n1 = snoise(x * 0.002, z * 0.002);
        const n2 = snoise(x * 0.008, z * 0.008);
        const n3 = snoise(x * 0.02, z * 0.02);
        let ridge = 1.0 - Math.abs(n1);
        ridge = ridge * ridge;
        const h = ridge * 65.0 - 2.0 + n2 * 14.0 + n3 * 4.0;
        const finalH = h + 8.0;
        return finalH < 7.5 ? 7.5 + (finalH - 7.5) * 0.15 : finalH;
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        if (h < 1.0) {
            tempColor.copy(colorDeepWater);
        } else if (h < 2.35) {
            tempColor.lerpColors(colorDeepWater, colorSand, smoothstep(1.0, 2.35, h));
        } else if (h < 4.2) {
            tempColor.copy(colorSand);
        } else if (h < 6.2) {
            tempColor.lerpColors(colorSand, colorJungleGrass, smoothstep(4.2, 6.2, h));
        } else if (h < 25) {
            tempColor.lerpColors(colorJungleGrass, colorJungleHigh, smoothstep(6.2, 25, h));
        } else if (h < 38) {
            tempColor.lerpColors(colorJungleHigh, colorIslandRock, smoothstep(25, 38, h));
        } else {
            tempColor.lerpColors(colorIslandRock, colorDirt, smoothstep(38, 55, h));
        }
    }
};
