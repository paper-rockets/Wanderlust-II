import * as THREE from 'three';

const colorDeepWater = new THREE.Color(0x1a4a8c);
const colorSand = new THREE.Color(0xf2e1b8);
const colorValleyGrass = new THREE.Color(0x55b847); // Vibrant spring green
const colorCrestGold = new THREE.Color(0xe0a96d);   // Dry wheat/amber gold
const colorPlainsRock = new THREE.Color(0x8d6e63);  // Warm clay rock
const colorDirt = new THREE.Color(0xdcb58a);

export default {
    name: "🌾 Golden Plains",
    shoreName: "░ Plain Shore",
    getHeight(x, z, snoise) {
        // Flat, gentle rolling hills with low frequency
        const n = snoise(x * 0.0005, z * 0.0005);
        const h = n * 7.0 + 10.0;
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
            tempColor.lerpColors(colorSand, colorValleyGrass, smoothstep(4.2, 6.2, h));
        } else if (h < 15.0) {
            // Lerp from valley green to crest dry wheat gold
            tempColor.lerpColors(colorValleyGrass, colorCrestGold, smoothstep(6.2, 15.0, h));
        } else if (h < 28.0) {
            tempColor.lerpColors(colorCrestGold, colorPlainsRock, smoothstep(15.0, 28.0, h));
        } else {
            tempColor.lerpColors(colorPlainsRock, colorDirt, smoothstep(28.0, 45.0, h));
        }
    }
};
