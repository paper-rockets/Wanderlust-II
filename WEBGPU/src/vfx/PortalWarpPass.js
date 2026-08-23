import { Fn, vec2, vec3, vec4, uniform, uv, sin, cos, mix, float, length, atan, pow, clamp, smoothstep } from 'three/tsl';

export const uWarpIntensity = uniform(0.0);
export const uWarpTime = uniform(0.0);

export const buildPortalWarpNode = Fn(([baseTex]) => {
    const vUv = uv();
    const centered = vUv.sub(vec2(0.5, 0.5)).mul(2.0);
    const r = length(centered);
    const angle = atan(centered.y, centered.x);

    // Tunnel depth coordinate
    const z = float(1.0).div(r.add(0.02));
    const speed = uWarpTime.mul(12.0);

    // Dynamic spiral streaks & hyper-drive warp rings
    const s1 = sin(angle.mul(6.0).add(z.mul(4.0)).sub(speed.mul(2.0)));
    const s2 = cos(angle.mul(10.0).sub(z.mul(6.0)).sub(speed.mul(3.5)));
    const rings = sin(z.mul(15.0).sub(speed.mul(5.0)));

    // High frequency streak energy
    const streak = pow(clamp(s1.mul(0.5).add(s2.mul(0.5)).add(rings.mul(0.3)).add(0.2), 0.0, 1.0), 3.0);

    // Color gradient across the warp tunnel
    const cosmicDeep = vec3(0.08, 0.02, 0.22);
    const neonCyan   = vec3(0.1, 0.8, 1.0);
    const neonPurple = vec3(0.9, 0.2, 0.95);
    const brightCore = vec3(1.0, 0.95, 0.9);

    const tunnelCol = mix(cosmicDeep, neonPurple, clamp(s1.mul(0.5).add(0.5), 0.0, 1.0));
    const finalTunnel = mix(tunnelCol, neonCyan, streak);

    // Add bright flash at the center
    const centerGlow = smoothstep(1.5, 0.0, r).mul(brightCore).mul(1.5);
    const warpOutput = finalTunnel.add(centerGlow);

    // Blend with scene based on uWarpIntensity
    const blended = mix(baseTex.rgb, warpOutput, uWarpIntensity);
    return vec4(blended, baseTex.a);
});
