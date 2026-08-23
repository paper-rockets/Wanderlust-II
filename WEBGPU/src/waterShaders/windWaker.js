import * as THREE from 'three';

// Wind Waker Ocean Shader by @Polyflare
export const windWakerShader = {
    name: 'Wind Waker Ocean',
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

                #define WATER_COL vec3(0.0, 0.4453, 0.7305)
                #define WATER2_COL vec3(0.0, 0.3680, 0.6358)
                #define FOAM_COL vec3(0.8125, 0.9609, 0.9648)
                #define M_2PI 6.283185307
                #define M_6PI 18.84955592

                float circ(vec2 pos, vec2 c, float s) {
                    float r = (sin((uTime - (c.x * 10.0)) * 2.0) * 0.0015);
                    c = abs(pos - c);
                    c = min(c, 1.0 - c);
                    return dot(c, c) < s - r ? -1.0 : 0.0;
                }

                float waterlayer(vec2 uv) {
                    uv = mod(uv, 1.0);
                    float ret = 1.0;
                    ret += circ(uv, vec2(0.37378, 0.277169), 0.0268181);
                    ret += circ(uv, vec2(0.0317477, 0.540372), 0.0193742);
                    ret += circ(uv, vec2(0.430044, 0.882218), 0.0232337);
                    ret += circ(uv, vec2(0.641033, 0.695106), 0.0117864);
                    ret += circ(uv, vec2(0.0146398, 0.0791346), 0.0299458);
                    ret += circ(uv, vec2(0.43871, 0.394445), 0.0289087);
                    ret += circ(uv, vec2(0.909446, 0.878141), 0.028466);
                    ret += circ(uv, vec2(0.310149, 0.686637), 0.0128496);
                    ret += circ(uv, vec2(0.928617, 0.195986), 0.0152041);
                    ret += circ(uv, vec2(0.0438506, 0.868153), 0.0268601);
                    ret += circ(uv, vec2(0.563517, 0.244991), 0.0292322);
                    ret += circ(uv, vec2(0.71403, 0.576945), 0.0215641);
                    ret += circ(uv, vec2(0.502214, 0.47269), 0.0234534);
                    ret += circ(uv, vec2(0.693271, 0.431469), 0.0246533);
                    return max(ret, 0.0);
                }
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                `#include <color_fragment>`,
                `#include <color_fragment>
                 float t = uTime * uSpeedMult;
                 vec2 uv = vWorldPos.xz * 0.03 * uPatternScale;
                 float d1 = mod(uv.x + uv.y, M_2PI) + t * 0.1;
                 float d2 = mod((uv.x + uv.y + 0.25) * 1.3, M_6PI) + t * 0.6;
                 vec2 dist = vec2(sin(d1) * 0.05 + sin(d2) * 0.05, cos(d1) * 0.05 + cos(d2) * 0.05);

                 vec3 wwCol = mix(WATER_COL, WATER2_COL, waterlayer(uv + dist));
                 wwCol = mix(wwCol, FOAM_COL, waterlayer(vec2(0.1 * t, 1.0) - uv - dist.yx) * 0.7);

                 diffuseColor.rgb = mix(diffuseColor.rgb, wwCol, uBlendStrength);

                 float distCam = length(vWorldPos.xz - cameraPosition.xz);
                 float depthFade = smoothstep(uFadeStart, uFadeEnd, distCam);
                 diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uFadeDarken, depthFade);
                `
            );
        }
    }
};
