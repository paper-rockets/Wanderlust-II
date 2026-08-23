uniform float uTime;
uniform vec3 uSunDir;
uniform float uShimmerMult;
uniform sampler2D uSandNoiseMap;
varying vec3 vWorldPos;
varying vec3 vViewPos;

void applyTerrainShaders(inout vec4 fragColor, vec3 normal) {
    vec3 viewDir = normalize(vViewPos);
    vec3 norm = normalize(normal);
    vec3 lightDir = normalize(uSunDir);
    vec3 halfDir = normalize(lightDir + viewDir);
    vec3 ref = reflect(-viewDir, norm);
    
    // 1. Detect Sand / Warm Dune Surface
    float isSand = step(0.45, fragColor.r) * step(fragColor.b, fragColor.r * 0.95);
    
    if (isSand > 0.1) {
        // Dune Rim Lighting (Fresnel glow along grazing angles and dune ridges)
        float rim = 1.0 - clamp(dot(norm, viewDir), 0.0, 1.0);
        float rimStrength = pow(rim, 4.5) * 0.5;
        vec3 rimGlow = vec3(1.0, 0.72, 0.38) * rimStrength;
        
        // Journey Sand Specular Glitter (Blinn-Phong Specular)
        float mainSpec = clamp(dot(norm, halfDir), 0.0, 1.0);
        mainSpec = pow(mainSpec, 12.0) * 4.5;
        
        float textureGlitter = texture2D(uSandNoiseMap, vWorldPos.xz * 0.07).r * 1.2;
        textureGlitter = pow(clamp(textureGlitter, 0.0, 1.0), 1.8);
        mainSpec *= textureGlitter;
        
        float rimSpec = pow(rim, 2.8) * textureGlitter * 2.5;
        vec3 specColor = (mainSpec + rimSpec) * vec3(1.0, 0.82, 0.55) * uShimmerMult;
        
        // Apply Sand Shader Effects without stripe artifacts
        fragColor.rgb += (rimGlow + specColor) * isSand;
    }

    // 2. Detect Snow / North Pole Glacial Surface
    float isSnow = step(0.60, fragColor.b) * step(0.50, fragColor.g) * (1.0 - isSand);
    
    if (isSnow > 0.1) {
        // Glacial Rim Lighting (Crisp sky-blue rim highlight)
        float snowRim = 1.0 - clamp(dot(norm, viewDir), 0.0, 1.0);
        float snowRimStrength = pow(snowRim, 4.0) * 0.35;
        vec3 snowRimGlow = vec3(0.65, 0.85, 1.0) * snowRimStrength;
        
        // Diamond Snow & Ice Specular Glitter (Blinn-Phong Specular)
        float mainSnowSpec = clamp(dot(norm, halfDir), 0.0, 1.0);
        mainSnowSpec = pow(mainSnowSpec, 10.0) * 4.0;
        
        float snowGlitter = texture2D(uSandNoiseMap, vWorldPos.xz * 0.12).r * 1.25;
        snowGlitter = pow(clamp(snowGlitter, 0.0, 1.0), 2.0);
        mainSnowSpec *= snowGlitter;
        
        float snowRimSpec = pow(snowRim, 2.8) * snowGlitter * 2.5;
        vec3 snowSpecColor = (mainSnowSpec + snowRimSpec) * vec3(0.85, 0.95, 1.0) * 1.2 * uShimmerMult;
        
        // Apply Diamond Snow Shimmer Effects
        fragColor.rgb += (snowRimGlow + snowSpecColor) * isSnow;
    }
}
