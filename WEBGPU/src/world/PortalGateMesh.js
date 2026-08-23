import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    Fn, vec2, vec3, vec4, uniform, uv, length, atan, sin, cos,
    mix, pow, smoothstep, clamp, float
} from 'three/tsl';

export class PortalGateMesh extends THREE.Mesh {
    constructor() {
        const geometry = new THREE.PlaneGeometry(16, 24);
        
        const uTime = uniform(0.0);
        const material = new MeshBasicNodeMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        material.colorNode = Fn(() => {
            const vUv = uv();
            // Elliptical coordinates for a tall gate
            const centered = vec2(vUv.x.sub(0.5).mul(2.0), vUv.y.sub(0.5).mul(1.4));
            const r = length(centered);
            const angle = atan(centered.y, centered.x);

            // Swirling energy vortex
            const swirl = sin(angle.mul(3.0).sub(r.mul(8.0)).add(uTime.mul(3.5)));
            const ripple = cos(r.mul(20.0).sub(uTime.mul(5.0)));
            const energy = clamp(swirl.mul(0.5).add(ripple.mul(0.3)).add(0.5), 0.0, 1.0);

            // Portal colors: deep void, neon cyan, cosmic violet, bright energy rim
            const voidCol = vec3(0.05, 0.0, 0.15);
            const violetCol = vec3(0.65, 0.1, 0.9);
            const cyanCol = vec3(0.1, 0.85, 1.0);
            const rimCol = vec3(1.0, 0.95, 0.8);

            let col = mix(voidCol, violetCol, pow(energy, 2.0));
            col = mix(col, cyanCol, pow(clamp(float(1.0).sub(r), 0.0, 1.0), 3.0));

            // Brilliant outer rim glow
            const rim = smoothstep(0.95, 0.8, r).mul(smoothstep(0.6, 0.85, r));
            col = col.add(rimCol.mul(rim).mul(2.5));

            // Soft circular gate edge
            const alpha = smoothstep(1.0, 0.75, r);

            return vec4(col, alpha);
        })();

        super(geometry, material);
        this.uTime = uTime;
    }

    update(time, camera) {
        this.uTime.value = time;
        if (camera) {
            this.lookAt(camera.position.x, this.position.y, camera.position.z);
        }
    }
}
