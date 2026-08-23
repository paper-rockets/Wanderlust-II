import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute float aLifetime;
  attribute float aMaxLifetime;
  attribute float aSize;

  varying float vAlpha;

  void main() {
    float t = clamp(aLifetime / aMaxLifetime, 0.0, 1.0);
    // Smooth fade-in / fade-out using a sine curve over [0, PI]
    vAlpha = sin(t * 3.14159265);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Clamp minimum depth so no particle blows up to huge size on first frame
    gl_PointSize = aSize * (300.0 / max(-mvPosition.z, 4.0));
    gl_Position  = projectionMatrix * mvPosition;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3  uColor;
  uniform float uIntensity;
  uniform float uArmSharpness;   // how tight the arms are (higher = thinner)
  uniform float uArmFalloff;     // radial falloff along each arm
  uniform float uGlowRadius;     // central glow radius (higher = tighter)

  varying float vAlpha;

  void main() {
    // gl_PointCoord: [0,1]² → remap to [-1,1]²
    vec2 uv = gl_PointCoord * 2.0 - 1.0;

    // Horizontal arm: sharp in Y, gradual in X
    float hArm = exp(-abs(uv.y) * uArmSharpness) * exp(-abs(uv.x) * uArmFalloff);
    // Vertical arm: sharp in X, gradual in Y
    float vArm = exp(-abs(uv.x) * uArmSharpness) * exp(-abs(uv.y) * uArmFalloff);
    // Central radial glow
    float glow = exp(-length(uv) * uGlowRadius);

    float star = max(max(hArm, vArm), glow);

    if (star < 0.005) discard;

    gl_FragColor = vec4(uColor * uIntensity, star * vAlpha);
  }
`;

export class WaterSparkles {
    constructor(scene, maxCount = 500) {
        this.maxCount = maxCount;
        this.posArr = new Float32Array(this.maxCount * 3);
        this.lifeArr = new Float32Array(this.maxCount);
        this.maxLifeArr = new Float32Array(this.maxCount);
        this.sizeArr = new Float32Array(this.maxCount);

        for (let i = 0; i < this.maxCount; i++) {
            this.posArr[i * 3] = (Math.random() - 0.5) * 60;
            this.posArr[i * 3 + 1] = -0.1 + 0.97;
            this.posArr[i * 3 + 2] = (Math.random() - 0.5) * 60;
            this.maxLifeArr[i] = 0.8 + Math.random() * 2.7;
            this.lifeArr[i] = Math.random() * this.maxLifeArr[i];
            this.sizeArr[i] = 12 + Math.random() * 43;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(this.posArr, 3));
        geometry.setAttribute("aLifetime", new THREE.BufferAttribute(this.lifeArr, 1));
        geometry.setAttribute("aMaxLifetime", new THREE.BufferAttribute(this.maxLifeArr, 1));
        geometry.setAttribute("aSize", new THREE.BufferAttribute(this.sizeArr, 1));
        geometry.setDrawRange(0, this.maxCount);
        
        this.geometry = geometry;

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: VERT,
            fragmentShader: FRAG,
            uniforms: {
                uColor: { value: new THREE.Color("#c8f0ff") },
                uIntensity: { value: 3.0 },
                uArmSharpness: { value: 14.0 },
                uArmFalloff: { value: 1.2 },
                uGlowRadius: { value: 3.5 },
            },
        });

        this.mesh = new THREE.Points(geometry, this.material);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 3;

        scene.add(this.mesh);
    }

    update(dt, elapsedTime, camera, controls) {
        if (controls) {
            this.material.uniforms.uColor.value.set(controls.color);
            this.material.uniforms.uIntensity.value = controls.intensity;
            this.material.uniforms.uArmSharpness.value = controls.armSharpness;
            this.material.uniforms.uArmFalloff.value = controls.armFalloff;
            this.material.uniforms.uGlowRadius.value = controls.glowRadius;
            
            this.geometry.setDrawRange(0, controls.count);

            const posAttr = this.geometry.getAttribute("position");
            const lifeAttr = this.geometry.getAttribute("aLifetime");
            const maxLifeAttr = this.geometry.getAttribute("aMaxLifetime");
            const sizeAttr = this.geometry.getAttribute("aSize");

            const waterY = -0.1 + controls.heightOffset;

            for (let i = 0; i < controls.count; i++) {
                this.lifeArr[i] += dt;
                this.posArr[i * 3 + 1] = waterY;

                if (this.lifeArr[i] >= this.maxLifeArr[i]) {
                    this.posArr[i * 3] = camera.position.x + (Math.random() - 0.5) * controls.spread * 2;
                    this.posArr[i * 3 + 1] = waterY;
                    this.posArr[i * 3 + 2] = camera.position.z + (Math.random() - 0.5) * controls.spread * 2;
                    this.lifeArr[i] = 0;
                    this.maxLifeArr[i] = controls.minLife + Math.random() * (controls.maxLife - controls.minLife);
                    this.sizeArr[i] = controls.minSize + Math.random() * (controls.maxSize - controls.minSize);
                }
            }

            posAttr.needsUpdate = true;
            lifeAttr.needsUpdate = true;
            maxLifeAttr.needsUpdate = true;
            sizeAttr.needsUpdate = true;
        }
    }

    dispose(scene) {
        scene.remove(this.mesh);
        this.material.dispose();
        this.geometry.dispose();
    }
}
