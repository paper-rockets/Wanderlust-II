import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, float, vec2, vec3, mix, fract, sin, dot, smoothstep as tslSmoothstep, Fn, positionWorld, cameraPosition } from 'three/tsl';

export class GroundFogSystem {
    constructor({ scene }) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.geo = new THREE.PlaneGeometry(4500, 4500);
        this.geo.rotateX(-Math.PI / 2);

        this.uniforms = {
            uTime: uniform(0),
            uFogIntensity: uniform(0.8),
            uFogOpacity: uniform(0.8),
            uFogDrift: uniform(1.0),
            uFogTurbulence: uniform(1.0),
            uFogNear: uniform(10.0),
            uFogFar: uniform(1750.0)
        };

        const hash = Fn(([p]) => {
            return fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453123));
        });

        const noise = Fn(([p]) => {
            const i = p.floor();
            const f = p.fract();
            const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
            return mix(
                mix(hash(i.add(vec2(0.0, 0.0))), hash(i.add(vec2(1.0, 0.0))), u.x),
                mix(hash(i.add(vec2(0.0, 1.0))), hash(i.add(vec2(1.0, 1.0))), u.x),
                u.y
            );
        });

        const getFogAlphaFn = Fn(([wPos, camPos, uTime, uDrift, uTurb, uNear, uFar, uIntensity, uOpacity]) => {
            const scaledTime = uTime.mul(uDrift.mul(0.03));
            const uv = wPos.xz.mul(0.0025).mul(uTurb);
            const yOffset = wPos.y.mul(0.2);
            const n1 = noise(uv.add(vec2(scaledTime.add(yOffset), scaledTime.mul(0.66))));
            const n2 = noise(uv.mul(2.0).sub(vec2(scaledTime.mul(0.7).sub(yOffset), scaledTime.mul(-1.0))));
            const noiseAlpha = tslSmoothstep(-0.2, 0.8, n1.add(n2.mul(0.5)));
            
            const dist = wPos.xz.sub(camPos.xz).length();
            const edgeFade = float(1.0).sub(tslSmoothstep(uFar.mul(0.75), uFar, dist));
            const nearFade = tslSmoothstep(uNear, uNear.mul(4.0), dist);
            
            return noiseAlpha.mul(edgeFade).mul(nearFade).mul(uOpacity).mul(uIntensity).mul(0.3);
        });

        this.mat = new MeshBasicNodeMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
            fog: false
        });

        this.mat.opacityNode = getFogAlphaFn(
            positionWorld,
            cameraPosition,
            this.uniforms.uTime,
            this.uniforms.uFogDrift,
            this.uniforms.uFogTurbulence,
            this.uniforms.uFogNear,
            this.uniforms.uFogFar,
            this.uniforms.uFogIntensity,
            this.uniforms.uFogOpacity
        );

        for (let i = 0; i < 3; i++) {
            const p = new THREE.Mesh(this.geo, this.mat);
            p.position.y = 12 + i * 16;
            p.receiveShadow = false;
            this.group.add(p);
        }
        this.group.visible = false;

        if (typeof window !== 'undefined') {
            window.fogGroup = this.group;
            window.fogUniforms = this.uniforms;
            window.fogMat = this.mat;
        }
    }

    update(time, playerPos) {
        this.uniforms.uTime.value = time;
        if (playerPos && this.group.visible) {
            this.group.position.x = playerPos.x;
            this.group.position.z = playerPos.z;
        }
    }
}
