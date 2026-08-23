import * as THREE from 'three';

// Quick Toon Cloud Ocean Water Shader (TOON WATER 08)
export const toon08Shader = {
    name: 'Toon Ocean (Quick Toon Cloud Ocean)',
    onCompile: (shader, waterUniforms) => {
        shader.uniforms.uTime = waterUniforms.uTime;
        shader.uniforms.uPatternScale = waterUniforms.uPatternScale;
        shader.uniforms.uSpeedMult = waterUniforms.uSpeedMult;
        shader.uniforms.uBlendStrength = waterUniforms.uBlendStrength;
        shader.uniforms.uFadeStart = waterUniforms.uFadeStart;
        shader.uniforms.uFadeEnd = waterUniforms.uFadeEnd;
        shader.uniforms.uFadeDarken = waterUniforms.uFadeDarken;

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

                #define DRAG_MULT 0.6

                vec2 wavedx_t8(vec2 position, vec2 direction, float frequency, float timeshift) {
                    float x = dot(direction, position) * frequency + timeshift;
                    float wave = exp(sin(x) - 1.0);
                    float dx = wave * cos(x);
                    return vec2(wave, -dx);
                }

                float getwaves_t8(vec2 position) {
                    float wavePhaseShift = length(position) * 0.005;
                    float iter = 0.0;
                    float frequency = 0.02;
                    float timeMultiplier = 1.5;
                    float weight = 1.0;
                    float sumOfValues = 0.0;
                    float sumOfWeights = 0.0;
                    for(int i = 0; i < 6; i++) {
                        vec2 p = vec2(sin(iter), cos(iter));
                        vec2 res = wavedx_t8(position, p, frequency, uTime * timeMultiplier + wavePhaseShift);
                        position += p * res.y * weight * DRAG_MULT;
                        sumOfValues += res.x * weight;
                        sumOfWeights += weight;
                        weight = mix(weight, 0.0, 0.2);
                        frequency *= 1.18;
                        timeMultiplier *= 1.07;
                        iter += 1232.399963;
                    }
                    return sumOfValues / sumOfWeights;
                }

                vec3 normal_t8(vec2 pos, float e) {
                    vec2 ex = vec2(e, 0.0);
                    float H = getwaves_t8(pos);
                    vec3 a = vec3(pos.x, H, pos.y);
                    return normalize(
                        cross(
                            a - vec3(pos.x - e, getwaves_t8(pos - ex.xy), pos.y),
                            a - vec3(pos.x, getwaves_t8(pos + ex.yx), pos.y + e)
                        )
                    );
                }
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                `#include <color_fragment>`,
                `#include <color_fragment>
                 vec2 pos = vWorldPos.xz;
                 float wHeight = getwaves_t8(pos);
                 vec3 n = normal_t8(pos, 0.5);

                 vec3 viewDir = normalize(cameraPosition - vWorldPos);
                 float NdotV = max(0.0, dot(n, viewDir));
                 
                 // Stepped toon fresnel
                 float fresnel = 0.04 + 0.96 * pow(1.0 - NdotV, 5.0);
                 fresnel = floor(fresnel * 5.0) / 5.0;

                 // Color gradient
                 vec3 deepColor = vec3(0.06, 0.15, 0.40);
                 vec3 shallowColor = vec3(0.20, 0.65, 0.92);
                 vec3 highlightColor = vec3(0.90, 0.98, 1.0);

                 vec3 baseCol = mix(deepColor, shallowColor, wHeight * 0.8 + 0.2);
                 baseCol = mix(baseCol, highlightColor, fresnel * 0.6);

                 // Subtle foam threshold
                 if (wHeight > 0.72) {
                     float foam = smoothstep(0.72, 0.85, wHeight);
                     baseCol = mix(baseCol, highlightColor, foam * 0.7);
                 }

                 diffuseColor.rgb = mix(diffuseColor.rgb, baseCol, uBlendStrength);

                 // Distance fog / depth fade
                 float distCam = length(vWorldPos.xz - cameraPosition.xz);
                 float depthFade = smoothstep(uFadeStart, uFadeEnd, distCam);
                 diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uFadeDarken, depthFade);
                 `
            );
        }
    }
};
