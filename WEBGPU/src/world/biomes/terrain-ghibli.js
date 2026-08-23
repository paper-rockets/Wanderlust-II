import * as THREE from 'three';

const colorDeepWater   = new THREE.Color(0x0f3b68);
const colorSand        = new THREE.Color(0xe6c896);
const colorSpringGrass = new THREE.Color(0x52c439);
const colorEmeraldGrass= new THREE.Color(0x2ea84b);
const colorGoldenPasture=new THREE.Color(0x9eb834);
const colorHighGrass   = new THREE.Color(0x409c3a);
const colorMossyRock   = new THREE.Color(0x5b7a54);
const colorSlateCliff  = new THREE.Color(0x6b7280);
const colorOchreRidge  = new THREE.Color(0xb48a5c);
const colorSummitMist  = new THREE.Color(0xd1d5db);

export default {
    name: "🌳 Ghibli Land",
    shoreName: "░ Continental Shore",
    getHeight(x, z, snoise) {
        const warpX = snoise(x * 0.0003, z * 0.0003) * 120.0;
        const warpZ = snoise(x * 0.0003 + 150.0, z * 0.0003 + 150.0) * 120.0;
        const wx = x + warpX;
        const wz = z + warpZ;

        const valleyBase = snoise(wx * 0.0008, wz * 0.0008) * 35.0 + 20.0;

        let ridge1 = 1.0 - Math.abs(snoise(wx * 0.0010 + 200.0, wz * 0.0010 - 200.0));
        ridge1 = ridge1 * ridge1 * (3.0 - 2.0 * ridge1);

        let ridge2 = 1.0 - Math.abs(snoise(wx * 0.0022 - 300.0, wz * 0.0022 + 300.0));
        ridge2 = ridge2 * ridge2 * (3.0 - 2.0 * ridge2);

        const mountainHeight = Math.pow(ridge1 * 0.7 + ridge2 * 0.3, 1.6) * 95.0;

        let y = valleyBase + mountainHeight;

        const riverNoise = Math.abs(snoise(wx * 0.0012 + 500.0, wz * 0.0012 + 500.0));
        if (riverNoise < 0.05) {
            const riverFactor = 1.0 - riverNoise / 0.05;
            const smoothRiver = riverFactor * riverFactor * (3.0 - 2.0 * riverFactor);
            y -= smoothRiver * 18.0;
        }

        y = Math.max(6.0, y);

        const pondNoise = snoise(x * 0.003 + 880.0, z * 0.003 - 550.0);
        if (pondNoise > 0.88) {
            const t = Math.min((pondNoise - 0.88) / 0.10, 1.0);
            const smoothPond = t * t * (3.0 - 2.0 * t);
            y -= smoothPond * 8.0;
        }

        return y;
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        const meadowPatch = snoise(x * 0.004, z * 0.004);
        const pasturePatch = snoise(x * 0.008 + 120.0, z * 0.008 + 120.0);
        const rockStrata   = snoise(x * 0.015 - 300.0, z * 0.015 + 300.0);

        if (h < 1.0) {
            tempColor.copy(colorDeepWater);
        } else if (h < 2.35) {
            tempColor.lerpColors(colorDeepWater, colorSand, smoothstep(1.0, 2.35, h));
        } else if (h < 4.2) {
            tempColor.copy(colorSand);
        } else if (h < 6.2) {
            tempColor.lerpColors(colorSand, colorSpringGrass, smoothstep(4.2, 6.2, h));
        } else if (h < 28.0) {
            const patch = colorSpringGrass.clone();
            if (meadowPatch > 0.1) patch.lerp(colorEmeraldGrass, Math.min(1.0, (meadowPatch - 0.1) * 2.2));
            if (pasturePatch > 0.15) patch.lerp(colorGoldenPasture, Math.min(1.0, (pasturePatch - 0.15) * 2.0));
            tempColor.lerpColors(patch, colorHighGrass, smoothstep(6.2, 28.0, h));
        } else if (h < 48.0) {
            const rockBlend = colorMossyRock.clone();
            if (rockStrata > 0.2) rockBlend.lerp(colorOchreRidge, (rockStrata - 0.2) * 1.8);
            tempColor.lerpColors(colorHighGrass, rockBlend, smoothstep(28.0, 48.0, h));
        } else if (h < 75.0) {
            const cliffBlend = colorSlateCliff.clone();
            if (rockStrata > 0.1) cliffBlend.lerp(colorOchreRidge, Math.min(1.0, (rockStrata - 0.1) * 2.0));
            tempColor.lerpColors(colorMossyRock, cliffBlend, smoothstep(48.0, 75.0, h));
        } else {
            tempColor.lerpColors(colorSlateCliff, colorSummitMist, smoothstep(75.0, 110.0, h));
        }
    }
};
