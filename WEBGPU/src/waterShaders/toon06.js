import * as THREE from 'three';

// FBM Step Toon Water Shader by @morgan3d
export const toon06Shader = {
    name: 'Toon FBM Step 06',
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

                float hash_t6(vec2 p) {
                    return (sin(uTime * 3.0) * 0.02) + fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x))));
                }

                float noise_t6(vec2 x) {
                    vec2 i = floor(x);
                    vec2 f = fract(x);
                    float a = hash_t6(i);
                    float b = hash_t6(i + vec2(1.0, 0.0));
                    float c = hash_t6(i + vec2(0.0, 1.0));
                    float d = hash_t6(i + vec2(1.0, 1.0));
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
                }

                float fbm_t6(vec2 x) {
                    float v = 0.0;
                    float a = 0.5;
                    vec2 shift = vec2(100.0);
                    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
                    for (int i = 0; i < 2; i++) {
                        v += a * noise_t6(x);
                        x = rot * x * 2.0 + shift;
                        a *= 0.5;
                    }
                    return v;
                }
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                `#include <color_fragment>`,
                `#include <color_fragment>
                 float t = uTime * uSpeedMult;
                 vec2 coord = vWorldPos.xz * 0.02 * uPatternScale - vec2(t * 0.15, 0.0);
                 float speed = 0.3;
                 float limit = 0.1;
                 float border = 0.025;
                 float c = fbm_t6(coord - speed * t) * fbm_t6(coord + speed * t);
                 vec3 colStep = vec3(step(limit - border, c), step(limit, c), 1.0);
                 vec3 finalCol;
                 if (colStep.x == 1.0 && colStep.y != 1.0) {
                     finalCol = vec3(1.0, 1.0, 1.0);
                 } else {
                     finalCol = vec3(0.06, 0.4, 0.85);
                 }

                 diffuseColor.rgb = mix(diffuseColor.rgb, finalCol, uBlendStrength);

                 float distCam = length(vWorldPos.xz - cameraPosition.xz);
                 float depthFade = smoothstep(uFadeStart, uFadeEnd, distCam);
                 diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uFadeDarken, depthFade);
                `
            );
        }
    }
};
