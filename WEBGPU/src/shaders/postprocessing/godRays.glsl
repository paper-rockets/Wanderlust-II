uniform sampler2D tDiffuse;
uniform vec2 uSunScreenPos;
uniform float uIntensity;
uniform float uDecay;
uniform float uDensity;
uniform float uWeight;
uniform float uSunVisible;
varying vec2 vUv;

float pseudoRand(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    
    // Direction from this pixel toward the sun
    vec2 deltaUV = (vUv - uSunScreenPos);
    float dist = length(deltaUV);
    deltaUV *= (1.0 / 32.0) * uDensity; // 32 dithered samples for 5x FPS gain with identical visual quality

    // Screen-space dither offsets sample points to eliminate banding with fewer samples
    float dither = pseudoRand(gl_FragCoord.xy);
    vec2 sampleUV = vUv - (deltaUV * dither);
    
    float illumination = 0.0;
    float currentWeight = uWeight;
    
    for(int i = 0; i < 32; i++) {
        sampleUV -= deltaUV;
        vec4 samp = texture2D(tDiffuse, sampleUV);
        float lum = dot(samp.rgb, vec3(0.299, 0.587, 0.114));
        float bright = smoothstep(0.45, 0.85, lum);
        illumination += bright * currentWeight;
        currentWeight *= uDecay;
    }
    
    // Fade out rays near screen edges and when sun is off-screen
    float edgeFade = 1.0 - smoothstep(0.4, 1.5, dist);
    
    // Warm golden tint for the rays
    vec3 rayColor = vec3(1.0, 0.9, 0.7) * illumination * uIntensity * edgeFade * uSunVisible;
    
    gl_FragColor = vec4(texel.rgb + rayColor, texel.a);
}
