// Volumetric Cloud & Ground Fog System

import * as THREE from 'three';
import cloudShaderFrag from '../shaders/atmosphere/cloudVolumetric.glsl?raw';
import groundFogFrag from '../shaders/atmosphere/groundFog.glsl?raw';

export class CloudSystem {
    constructor(scene, isLowGfx = false) {
        this.scene = scene;
        this.isLowGfx = isLowGfx;

        // Volumetric Sky Cloud Dome
        this.toonCloudGeo = new THREE.SphereGeometry(14000, 32, 16);
        this.toonCloudMat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false,
            uniforms: {
                uTime: { value: 0 },
                uSunDir: { value: new THREE.Vector3(-0.077, 0.5, 0.577).normalize() },
                uCloudDensity: { value: 1.0 },
                uCloudHeight: { value: 800.0 },
                uSkyColor: { value: new THREE.Color(0x8cbce6) },
                uCloudColor: { value: new THREE.Color(0xfffaec) },
                uEnableClouds: { value: 1.0 }
            },
            vertexShader: `
                varying vec3 vWorldPos;
                varying vec3 vViewDir;
                void main() {
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPos = worldPos.xyz;
                    vViewDir = normalize(worldPos.xyz - cameraPosition);
                    gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `,
            fragmentShader: cloudShaderFrag
        });
        this.toonCloudDome = new THREE.Mesh(this.toonCloudGeo, this.toonCloudMat);
        this.scene.add(this.toonCloudDome);

        // Ground Fog Group
        this.fogGroup = new THREE.Group();
        this.fogUniforms = {
            uTime: { value: 0 },
            uIntensity: { value: 1.0 },
            uOpacity: { value: 0.35 }
        };
        this.fogGeo = new THREE.PlaneGeometry(4000, 4000);
        this.fogGeo.rotateX(-Math.PI / 2);
        this.fogMat = new THREE.MeshToonMaterial({
            color: 0xe0f2fe,
            transparent: true,
            opacity: 0.35,
            depthWrite: false
        });
        this.fogMat.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = this.fogUniforms.uTime;
            shader.uniforms.uIntensity = this.fogUniforms.uIntensity;
            shader.uniforms.uOpacity = this.fogUniforms.uOpacity;
            shader.vertexShader = `varying vec3 vWorldPos;\n` + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
                `#include <worldpos_vertex>`,
                `#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
            );
            shader.fragmentShader = groundFogFrag + shader.fragmentShader;
        };

        for (let i = 0; i < 3; i++) {
            const p = new THREE.Mesh(this.fogGeo, this.fogMat);
            p.position.y = 12 + i * 15;
            p.receiveShadow = true;
            this.fogGroup.add(p);
        }
        this.scene.add(this.fogGroup);
    }

    update(time, sunDir) {
        this.toonCloudMat.uniforms.uTime.value = time;
        if (sunDir) {
            this.toonCloudMat.uniforms.uSunDir.value.copy(sunDir);
        }
        this.fogUniforms.uTime.value = time;
    }
}
