import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
    Fn, vec2, vec3, float, sin, cos, dot, mix, clamp, pow,
    positionWorld, normalWorld, smoothstep as tslSmoothstep,
    floor, fract, uniform, cameraPosition, normalize, reflect, step, texture
} from 'three/tsl';

// 1. ISOTROPIC PROCEDURAL NOISE (TSL Implementation from 001)
const hash2D = Fn(([p]) => {
    const pMod = fract(p.div(256.0)).mul(256.0);
    const d = vec2(
        dot(pMod, vec2(127.1, 311.7)),
        dot(pMod, vec2(269.5, 183.3))
    );
    return fract(sin(d).mul(float(43758.5453123)));
});

const vnoise2D = Fn(([p]) => {
    const i = floor(p);
    const f = fract(p);
    // Quintic smooth Hermite interpolation for C2 continuity
    const u = f.mul(f).mul(f).mul(f.mul(f.mul(6.0).sub(15.0)).add(10.0));

    const a = hash2D(i);
    const b = hash2D(i.add(vec2(1.0, 0.0)));
    const c = hash2D(i.add(vec2(0.0, 1.0)));
    const d = hash2D(i.add(vec2(1.0, 1.0)));

    return mix(mix(a.x, b.x, u.x), mix(c.x, d.x, u.x), u.y);
});

const fbm2D = Fn(([p]) => {
    const n1 = vnoise2D(p);
    const n2 = vnoise2D(p.mul(2.13).add(vec2(17.2, 34.5)));
    const n3 = vnoise2D(p.mul(4.67).add(vec2(43.8, 81.1)));
    return n1.mul(0.55).add(n2.mul(0.30)).add(n3.mul(0.15));
});

export function createTerrainColorNode(waterLevelUniform, uTime, uSunDir, uSandNoiseMap, uShimmerMult) {
    return Fn(() => {
        const p = positionWorld;
        const norm = normalize(normalWorld);
        const slope = float(1.0).sub(clamp(norm.y, 0.0, 1.0));
        const h = p.y;

        // Isotropic procedural noise in meters
        const combN = fbm2D(p.xz.mul(0.032)).sub(0.5).mul(2.0); // Range -1.0 to 1.0
        const patchNoise = vnoise2D(p.xz.mul(0.018).add(vec2(100.0, 100.0)));
        const snowAltNoise = fbm2D(p.xz.mul(0.022)).mul(8.0);

        const hAdj = h.add(combN.mul(2.2));
        const wl = waterLevelUniform || uniform(2.4);

        // Master Archipelago Grass & Shore Palette (100% Preserved from 001)
        const cSandWet = vec3(0.70, 0.56, 0.36);
        const cSand = vec3(0.88, 0.77, 0.52);
        const cGrassLow = vec3(0.24, 0.72, 0.08);
        const cGrassMid = vec3(0.12, 0.56, 0.30);
        const cGrassHigh = vec3(0.06, 0.40, 0.22);
        const cMossYellow = vec3(0.48, 0.90, 0.05);

        // Alpine Mountain Snow & Cliff Rock Palette
        const cSnowBase = vec3(0.96, 0.98, 1.0);
        const cSnowShadow = vec3(0.78, 0.85, 0.96);
        const cRockCliff = vec3(0.30, 0.33, 0.37);
        const cRockLichen = vec3(0.42, 0.45, 0.36);

        // 1. Shore sand
        const tSand = tslSmoothstep(wl.sub(1.8), wl.add(0.4), hAdj);
        const colSand = mix(cSandWet, cSand, tSand);

        // 2. Sand to coastal grass
        const tLow = tslSmoothstep(wl.add(0.4), wl.add(3.2), hAdj);
        const colLow = mix(colSand, cGrassLow, tLow);

        // 3. Low to mid lush canopy with organic moss patches
        const tMid = tslSmoothstep(wl.add(3.2), wl.add(22.0), hAdj);
        const lushBase = mix(cGrassLow, cGrassMid, tMid);
        const mossW = clamp(combN.sub(0.05).mul(1.5), 0.0, 1.0);
        const lushMoss = mix(lushBase, cMossYellow, mossW);
        const patchW = clamp(patchNoise.sub(0.55).mul(2.0), 0.0, 1.0);
        const lushPatched = mix(lushMoss, cGrassLow, patchW);
        const colMid = mix(colLow, lushPatched, tMid);

        // 4. Mid to high ridge grass
        const tHigh = tslSmoothstep(wl.add(22.0), wl.add(44.0), hAdj);
        const colHigh = mix(colMid, cGrassHigh, tHigh);

        // 5. Alpine Cliff Rock (Exposed on steep slopes or transition)
        const cliffRock = mix(cRockCliff, cRockLichen, clamp(combN.mul(0.5).add(0.5), 0.0, 1.0));
        const tRock = tslSmoothstep(wl.add(34.0), wl.add(60.0), hAdj);
        const colMountain = mix(colHigh, cliffRock, tRock);

        // 6. Slope-Aware Snow Accumulation on Mountain Peaks
        const snowAltitude = tslSmoothstep(wl.add(32.0).add(snowAltNoise), wl.add(58.0).add(snowAltNoise), hAdj);
        const snowSlopeRetention = tslSmoothstep(float(0.55), float(0.28), slope.add(combN.mul(0.12)));
        const snowAmount = snowAltitude.mul(snowSlopeRetention);

        const litSnow = mix(cSnowShadow, cSnowBase, clamp(norm.y.mul(0.75).add(0.25), 0.0, 1.0));
        const withSnow = mix(colMountain, litSnow, snowAmount);

        // 7. Sheer cliff rock exposure on very steep angles
        const cliffMask = tslSmoothstep(float(0.48), float(0.68), slope.add(combN.mul(0.12)));
        const baseColor = mix(withSnow, cRockCliff, cliffMask.mul(tslSmoothstep(wl.add(5.0), wl.add(25.0), hAdj)));

        // 8. Sand & Snow Shimmer and Specular Highlights Shader
        const viewDir = normalize(cameraPosition.sub(p));
        const sunDirection = uSunDir ? normalize(uSunDir) : normalize(vec3(0.3, 0.8, 0.5));
        const halfDir = normalize(sunDirection.add(viewDir));
        const shimmerMult = uShimmerMult || float(1.0);

        // Biome Masking
        // Desert Dunes: [155,000 - 180,000] (Sand shimmer)
        // North Pole: [180,000 - 205,000] & Misty Mountains: [40,000 - 70,000] (Snow & ice shimmer)
        const wz = fract(p.z.div(float(215000.0))).mul(215000.0);
        const desertMask = tslSmoothstep(float(152500.0), float(155000.0), wz).mul(tslSmoothstep(float(182500.0), float(180000.0), wz));
        const northPoleMask = tslSmoothstep(float(177500.0), float(180000.0), wz).mul(tslSmoothstep(float(207500.0), float(205000.0), wz));
        const mtnMask = tslSmoothstep(float(37500.0), float(40000.0), wz).mul(tslSmoothstep(float(72500.0), float(70000.0), wz));
        const snowBiomeMask = clamp(northPoleMask.add(mtnMask), 0.0, 1.0);

        // Resolve noise texture
        const rawTex = (uSandNoiseMap && uSandNoiseMap.isTexture)
            ? uSandNoiseMap
            : (uSandNoiseMap && uSandNoiseMap.value && uSandNoiseMap.value.isTexture)
                ? uSandNoiseMap.value
                : (uSandNoiseMap && uSandNoiseMap._value && uSandNoiseMap._value.isTexture)
                    ? uSandNoiseMap._value
                    : null;

        // 1. Detect Sand / Warm Dune Surface (Restricted to Desert Dunes)
        const isSand = step(float(0.45), baseColor.r).mul(step(baseColor.b, baseColor.r.mul(0.95))).mul(desertMask);

        // Dune Rim Lighting (Fresnel glow along grazing angles and dune ridges)
        const NdotV = clamp(dot(norm, viewDir), 0.0, 1.0);
        const rim = float(1.0).sub(NdotV);
        const rimStrength = pow(rim, float(4.5)).mul(0.5);
        const rimGlow = vec3(1.0, 0.72, 0.38).mul(rimStrength);

        // Journey Sand Specular Glitter (Blinn-Phong Specular)
        const NdotH = clamp(dot(norm, halfDir), 0.0, 1.0);
        const mainSpec = pow(NdotH, float(12.0)).mul(4.5);

        const sandNoiseVal = rawTex ? texture(rawTex, p.xz.mul(0.07)).r.mul(1.2) : vnoise2D(p.xz.mul(2.5)).mul(1.2);
        const textureGlitter = pow(clamp(sandNoiseVal, 0.0, 1.0), float(1.8));
        const sandSpec = mainSpec.mul(textureGlitter);

        const rimSpec = pow(rim, float(2.8)).mul(textureGlitter).mul(2.5);
        const sandSpecColor = sandSpec.add(rimSpec).mul(vec3(1.0, 0.82, 0.55)).mul(shimmerMult);
        const sandEffects = rimGlow.add(sandSpecColor).mul(isSand);

        // 2. Detect Snow / Mountain Glacial Surface (Restricted to North Pole and Misty Mountains)
        const isSnow = step(float(0.60), baseColor.b).mul(step(float(0.50), baseColor.g)).mul(float(1.0).sub(isSand)).mul(snowBiomeMask);

        // Glacial Rim Lighting (Crisp sky-blue rim highlight)
        const snowRimStrength = pow(rim, float(4.0)).mul(0.35);
        const snowRimGlow = vec3(0.65, 0.85, 1.0).mul(snowRimStrength);

        // Diamond Snow & Ice Specular Glitter (Blinn-Phong Specular)
        const mainSnowSpec = pow(NdotH, float(10.0)).mul(4.0);
        const snowNoiseVal = rawTex ? texture(rawTex, p.xz.mul(0.12)).r.mul(1.25) : vnoise2D(p.xz.mul(4.0)).mul(1.25);
        const snowGlitter = pow(clamp(snowNoiseVal, 0.0, 1.0), float(2.0));
        const snowSpec = mainSnowSpec.mul(snowGlitter);

        const snowRimSpec = pow(rim, float(2.8)).mul(snowGlitter).mul(2.5);
        const snowSpecColor = snowSpec.add(snowRimSpec).mul(vec3(0.85, 0.95, 1.0)).mul(1.2).mul(shimmerMult);
        const snowEffects = snowRimGlow.add(snowSpecColor).mul(isSnow);

        return baseColor.add(sandEffects).add(snowEffects);
    });
}

export const createTerrainMaterial = (uTime, uSunDir, uSandNoiseMap, uShimmerMult) => {
    const terrainMat = new MeshStandardNodeMaterial({
        roughness: 0.82,
        metalness: 0.05
    });

    const waterLevelUniform = uniform(2.4);
    terrainMat.colorNode = createTerrainColorNode(waterLevelUniform, uTime, uSunDir, uSandNoiseMap, uShimmerMult)();

    return terrainMat;
};
