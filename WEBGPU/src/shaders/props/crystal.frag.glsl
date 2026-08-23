// Instanced Crystal Color Gradient, Fresnel Rim & Vibrance Shader
uniform float crystalGlow;
uniform float baseGlow;
uniform float nightGlowMult;
uniform float flyHue;
uniform float flyContrast;
uniform float uTime;
uniform vec3 uCustomColors[6];

varying vec3 vPositionC;
varying vec3 vWorldNormalC;
varying vec3 vWorldPosC;

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 calculateCrystalColor(vec3 baseDiffuse) {
    float tC = clamp((vPositionC.y + 3.0) / 6.0, 0.0, 1.0);

    // Smooth cubic interpolation through 6 color stops
    float segment = tC * 5.0;
    int idx = int(floor(segment));
    float frac = fract(segment);
    float t = frac * frac * (3.0 - 2.0 * frac); // smoothstep

    vec3 gradientColor;
    if (idx == 0) gradientColor = mix(uCustomColors[0], uCustomColors[1], t);
    else if (idx == 1) gradientColor = mix(uCustomColors[1], uCustomColors[2], t);
    else if (idx == 2) gradientColor = mix(uCustomColors[2], uCustomColors[3], t);
    else if (idx == 3) gradientColor = mix(uCustomColors[3], uCustomColors[4], t);
    else gradientColor = mix(uCustomColors[4], uCustomColors[5], t);

    // Hue Shift
    if (flyHue > 0.0) {
        vec3 hsv = rgb2hsv(gradientColor);
        hsv.x = fract(hsv.x + flyHue);
        gradientColor = hsv2rgb(hsv);
    }

    // Contrast
    if (flyContrast != 1.0) {
        gradientColor = pow(gradientColor, vec3(1.0 / flyContrast));
    }

    // Fresnel rim glow
    vec3 viewDir = normalize(cameraPosition - vWorldPosC);
    float fresnel = 1.0 - abs(dot(viewDir, vWorldNormalC));
    fresnel = pow(fresnel, 3.0);
    vec3 rimColor = mix(gradientColor, vec3(1.0), 0.6);
    gradientColor = mix(gradientColor, rimColor, fresnel * 0.7);

    // Vibrance boost
    vec3 hsvFinal = rgb2hsv(gradientColor);
    hsvFinal.y = min(hsvFinal.y * 1.4, 1.0);
    hsvFinal.z = min(hsvFinal.z * 1.15, 1.0);
    return hsv2rgb(hsvFinal);
}
