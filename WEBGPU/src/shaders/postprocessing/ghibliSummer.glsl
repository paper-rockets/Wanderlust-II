uniform sampler2D tDiffuse;
varying vec2 vUv;

void main() {
    vec4 texel = texture2D( tDiffuse, vUv );
    vec3 col = texel.rgb;

    float lum = dot(col, vec3(0.299, 0.587, 0.114));

    // Studio Ghibli Summer Split-Toning (Golden sunlit highlights, soft atmospheric cerulean shadows)
    vec3 warmGold = col * vec3(1.07, 1.02, 0.92);
    vec3 azureShadow = col * vec3(0.93, 0.98, 1.07);
    col = mix(azureShadow, warmGold, smoothstep(0.2, 0.75, lum));

    // Lush Saturation Boost (Chlorophyll greens & vibrant ocean)
    col = mix(vec3(lum), col, 1.18);

    // Sun-drenched warm optical shimmer on highlights
    col += max(vec3(0.0), col - 0.55) * vec3(0.12, 0.09, 0.02);

    // Subtle Hand-Painted Celluloid Vignette
    vec2 uv = (vUv - 0.5) * 2.0;
    float vign = clamp(1.0 - dot(uv, uv) * 0.14, 0.0, 1.0);
    col *= vign;

    gl_FragColor = vec4(col, texel.a);
}
