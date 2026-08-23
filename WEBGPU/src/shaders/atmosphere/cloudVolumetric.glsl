// Volumetric Cloud Raymarching GLSL (SpiralNoiseC)

uniform float uTime;
uniform vec3 uSunDir;
uniform float uCloudDensity;
uniform float uCloudHeight;
uniform vec3 uSkyColor;
uniform vec3 uCloudColor;
uniform float uEnableClouds;

varying vec3 vWorldPos;
varying vec3 vViewDir;

const float nudge = 0.739513;
float normalizer = 1.0 / sqrt(1.0 + nudge*nudge);

float SpiralNoiseC(vec3 p) {
    float n = 0.0;
    float iter = 1.0;
    for (int i = 0; i < 5; i++) {
        vec3 spin = sin(p * iter);
        n += -abs(spin.x + spin.y + spin.z) / iter;
        p.xy += vec2(p.y, -p.x) * nudge;
        p.xy *= normalizer;
        p.xz += vec2(p.z, -p.x) * nudge;
        p.xz *= normalizer;
        iter *= 1.733733;
    }
    return n;
}

float getCloud(vec3 pos) {
    vec3 p = pos * 0.0012 + vec3(uTime * 0.015, 0.0, uTime * 0.008);
    float noise = SpiralNoiseC(p);
    float heightFalloff = smoothstep(100.0, 1200.0, pos.y) * smoothstep(5000.0, 2000.0, pos.y);
    float coverage = (uCloudDensity * 0.5 - 0.2);
    float cloudVal = noise * 0.35 + coverage + heightFalloff * 0.4;
    return clamp(cloudVal, 0.0, 1.0);
}

void main() {
    if (uEnableClouds < 0.5 || vViewDir.y < -0.05) {
        discard;
    }

    vec3 dir = normalize(vViewDir);
    float rayT = (uCloudHeight - cameraPosition.y) / max(dir.y, 0.01);
    
    if (rayT <= 0.0 || rayT > 16000.0) {
        discard;
    }

    vec3 pos = cameraPosition + dir * rayT;
    float cloudDensity = getCloud(pos);

    if (cloudDensity < 0.05) {
        discard;
    }

    float alpha = smoothstep(0.05, 0.45, cloudDensity);
    float diff = clamp(dot(vec3(0.0, 1.0, 0.0), uSunDir), 0.5, 1.0);
    
    vec3 col = mix(uSkyColor, uCloudColor, alpha);
    col = mix(col, uCloudColor * 1.15, diff * 0.3);

    gl_FragColor = vec4(col, alpha * 0.95);
}
