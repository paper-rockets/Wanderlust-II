import * as THREE from 'three';

// Layered Simplex Feathered Ripple Toon Shader (TOON WATER 07)
export const toon07Shader = {
    name: 'Toon Layered Ripple 07',
    onCompile: (shader, waterUniforms) => {
        shader.uniforms.uTime = waterUniforms.uTime;

        if (!shader.vertexShader.includes('varying vec3 vWorldPos;')) {
            shader.vertexShader = `
                varying vec3 vWorldPos;
            ` + shader.vertexShader;
        }

        if (!shader.vertexShader.includes('vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;')) {
            shader.vertexShader = shader.vertexShader.replace(
                `#include <worldpos_vertex>`,
                `#include <worldpos_vertex>
                 vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
            );
        }

        if (!shader.fragmentShader.includes('uniform float uTime;')) {
            shader.fragmentShader = `
                uniform float uTime;
                uniform float uPatternScale;
                uniform float uSpeedMult;
                uniform float uBlendStrength;
                uniform float uFadeStart;
                uniform float uFadeEnd;
                uniform float uFadeDarken;
                varying vec3 vWorldPos;

                vec2 hash_t7(vec2 p) {
                    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                    return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
                }

                float noise_t7(vec2 p) {
                    const float K1 = 0.366025404;
                    const float K2 = 0.211324865;
                    vec2 i = floor(p + (p.x + p.y) * K1);
                    vec2 a = p - i + (i.x + i.y) * K2;
                    vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                    vec2 b = a - o + K2;
                    vec2 c = a - 1.0 + 2.0 * K2;
                    vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
                    vec3 n = h * h * h * h * vec3(dot(a, hash_t7(i + 0.0)), dot(b, hash_t7(i + o)), dot(c, hash_t7(i + 1.0)));
                    return dot(n, vec3(70.0));
                }

                float fbm_t7(vec2 p) {
                    float a = 0.5;
                    float n = 0.0;
                    for (float i = 0.0; i < 3.0; i++) {
                        n += a * noise_t7(p);
                        p *= 2.0;
                        a *= 0.5;
                    }
                    return n;
                }
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                `#include <color_fragment>`,
                `#include <color_fragment>
                 float t = uTime * uSpeedMult;
                 vec2 uv = vWorldPos.xz * 0.015 * uPatternScale;
                 vec3 baseCol = mix(vec3(0.11, 0.76, 0.98), vec3(0.04, 0.30, 0.86), clamp(uv.y * 0.5 + 0.5, 0.0, 1.0));

                 // Top layer ripple
                 float n1 = abs(fbm_t7(uv * 2.0 + vec2(0.0, t * 0.3)) - noise_t7(uv + vec2(0.0, t * 0.8)) * 0.8);
                 float s1 = smoothstep(0.09, 0.04, n1);
                 baseCol = mix(baseCol, vec3(1.0), s1 * 0.5);

                 // Bottom layer ripple
                 float n2 = abs(fbm_t7(uv * 1.5 + vec2(0.1, t * 0.15)) - noise_t7(uv + vec2(0.0, t * 0.5)) * 0.5);
                 float s2 = smoothstep(0.08, 0.03, n2);
                 baseCol = mix(baseCol, vec3(1.0), s2 * 0.3);

                 diffuseColor.rgb = mix(diffuseColor.rgb, baseCol, uBlendStrength);

                 float distCam = length(vWorldPos.xz - cameraPosition.xz);
                 float depthFade = smoothstep(uFadeStart, uFadeEnd, distCam);
                 diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uFadeDarken, depthFade);
                `
            );
        }
    }
};
