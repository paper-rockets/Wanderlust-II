import * as THREE from 'three';

// Wind Waker Deep Ocean Shader by @BitterZephyr
export const windWakerDeepShader = {
    name: 'Wind Waker Deep',
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

                vec2 hash2_wwd(vec2 p) {
                    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                    return fract(sin(p) * 43758.5453);
                }

                float voronoi_wwd(vec2 x, float w, float offset) {
                    vec2 n = floor(x);
                    vec2 f = fract(x);
                    float m = 8.0;
                    for (int j = -1; j <= 1; j++) {
                        for (int i = -1; i <= 1; i++) {
                            vec2 g = vec2(float(i), float(j));
                            vec2 o = hash2_wwd(n + g);
                            o = offset + 0.3 * sin(uTime + 6.2831 * o + x);
                            float d = length(g - f + o);
                            float h = smoothstep(-1.0, 1.0, (m - d) / w);
                            m = mix(m, d, h) - h * (1.0 - h) * w / (1.0 + 3.0 * w);
                        }
                    }
                    return m;
                }
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                `#include <color_fragment>`,
                `#include <color_fragment>
                 float t = uTime * uSpeedMult;
                 vec2 uv = vWorldPos.xz * 0.02 * uPatternScale;
                 uv.x += t * 0.15;
                 uv.y += t * 0.08;

                 vec3 colA = vec3(0.114, 0.635, 0.847);
                 vec3 colB = vec3(1.0, 1.0, 1.0);
                 vec3 colC = colA * 0.6;

                 float vNoise = voronoi_wwd(uv, 0.001, 0.5);
                 float sNoise = voronoi_wwd(uv, 0.4, 0.5);
                 float fVoronoi = smoothstep(0.0, 0.01, vNoise - sNoise);

                 float vNoise2 = voronoi_wwd(uv, 0.001, 0.3);
                 float sNoise2 = voronoi_wwd(uv, 0.4, 0.3);
                 float offsetVoronoi = smoothstep(0.0, 0.01, vNoise2 - sNoise2);

                 float wave = (sin(3.14159 * (uv.x + uv.y)) + 1.0) * 0.5;
                 vec3 bgColor2 = mix(colA, colC, offsetVoronoi + wave);
                 vec3 finalVoronoi = mix(bgColor2, colB, fVoronoi);

                 diffuseColor.rgb = mix(diffuseColor.rgb, finalVoronoi, uBlendStrength);

                 float distCam = length(vWorldPos.xz - cameraPosition.xz);
                 float depthFade = smoothstep(uFadeStart, uFadeEnd, distCam);
                 diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uFadeDarken, depthFade);
                `
            );
        }
    }
};
