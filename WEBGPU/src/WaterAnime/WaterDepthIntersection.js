import * as THREE from 'three';

const VERT = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uDepthTex;
  uniform vec2  uResolution;
  uniform float uNear;
  uniform float uFar;
  uniform float uLineWidth;   // world units — controls the sharp line thickness
  uniform float uGlowWidth;   // world units — controls the soft halo radius
  uniform vec3  uLineColor;
  uniform float uLineOpacity;
  uniform vec3  uGlowColor;
  uniform float uGlowOpacity;

  // Convert window-space depth [0,1] to view-space distance (world units).
  float linearDepth(float raw) {
    float z = raw * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }

  void main() {
    vec2 screenUV = gl_FragCoord.xy / uResolution;

    float rawScene = texture2D(uDepthTex, screenUV).r;

    // 1.0 depth means nothing was rendered there — skip this fragment.
    if (rawScene > 0.9999) discard;

    float sceneD = linearDepth(rawScene);
    float waterD = linearDepth(gl_FragCoord.z);
    float diff   = abs(sceneD - waterD);

    // Sharp line at the intersection boundary
    float line = 1.0 - smoothstep(0.0, uLineWidth, diff);

    // Soft exponential halo around the intersection
    float glow = exp(-diff / max(uGlowWidth, 0.001));

    float lineContrib = line * uLineOpacity;
    float glowContrib = glow * uGlowOpacity;
    float totalAlpha  = max(lineContrib, glowContrib);

    if (totalAlpha < 0.005) discard;

    // Blend line colour over glow colour based on how close to the exact line
    vec3 col = mix(uGlowColor, uLineColor, line);
    gl_FragColor = vec4(col, totalAlpha);
  }
`;

export class WaterDepthIntersection {
    constructor(scene, renderer) {
        this.renderer = renderer;
        const size = renderer.getSize(new THREE.Vector2());
        const dpr = renderer.getPixelRatio();
        const w = Math.round(size.width * dpr);
        const h = Math.round(size.height * dpr);

        this.depthRT = new THREE.WebGLRenderTarget(w, h);
        this.depthRT.depthTexture = new THREE.DepthTexture(w, h);
        this.depthRT.depthTexture.type = THREE.UnsignedShortType;

        this.depthScene = new THREE.Scene();
        this.depthMat = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
        
        // We will keep references to the meshes to intersect
        this.intersectMeshes = [];

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: VERT,
            fragmentShader: FRAG,
            uniforms: {
                uDepthTex: { value: this.depthRT.depthTexture },
                uResolution: { value: new THREE.Vector2(w, h) },
                uNear: { value: 0.1 },
                uFar: { value: 1000 },
                uLineWidth: { value: 0.25 },
                uGlowWidth: { value: 1.2 },
                uLineColor: { value: new THREE.Color("#ffffff") },
                uLineOpacity: { value: 1.0 },
                uGlowColor: { value: new THREE.Color("#88ccff") },
                uGlowOpacity: { value: 0.25 },
            }
        });

        const geometry = new THREE.PlaneGeometry(50000, 50000);
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.y = 2.4;
        this.mesh.renderOrder = 5;
        this.mesh.frustumCulled = false;

        scene.add(this.mesh);

        // Window resize handler
        this.onResize = () => {
            const sz = this.renderer.getSize(new THREE.Vector2());
            const pr = this.renderer.getPixelRatio();
            const nw = Math.round(sz.width * pr);
            const nh = Math.round(sz.height * pr);
            this.depthRT.setSize(nw, nh);
            this.material.uniforms.uResolution.value.set(nw, nh);
        };
        window.addEventListener('resize', this.onResize);
    }

    addMeshToIntersect(mesh) {
        if (!this.intersectMeshes.includes(mesh)) {
            this.intersectMeshes.push(mesh);
        }
    }

    updateAndRender(camera, controls) {
        if (!controls || !controls.enabled) {
            this.mesh.visible = false;
            return;
        }
        this.mesh.visible = true;

        // Clear and rebuild depth scene from target meshes
        this.depthScene.clear();
        for (const mesh of this.intersectMeshes) {
            if (!mesh.visible) continue;
            // Create a clone but with the depth material
            // (In practice, we could just traverse and set override material, but WANDERLUST might have instanced meshes etc)
            // For simple meshes:
            const clone = new THREE.Mesh(mesh.geometry, this.depthMat);
            mesh.getWorldPosition(clone.position);
            mesh.getWorldQuaternion(clone.quaternion);
            mesh.getWorldScale(clone.scale);
            this.depthScene.add(clone);
        }

        const prevRT = this.renderer.getRenderTarget();
        const prevAutoClear = this.renderer.autoClear;
        this.renderer.autoClear = true;
        this.renderer.setRenderTarget(this.depthRT);
        this.renderer.clear();
        this.renderer.render(this.depthScene, camera);
        this.renderer.setRenderTarget(prevRT);
        this.renderer.autoClear = prevAutoClear;

        const u = this.material.uniforms;
        u.uNear.value = camera.near;
        u.uFar.value = camera.far;
        u.uLineWidth.value = controls.lineWidth;
        u.uGlowWidth.value = controls.glowWidth;
        u.uLineColor.value.set(controls.lineColor);
        u.uLineOpacity.value = controls.lineOpacity;
        u.uGlowColor.value.set(controls.glowColor);
        u.uGlowOpacity.value = controls.glowOpacity;

        this.mesh.position.x = camera.position.x;
        this.mesh.position.z = camera.position.z;
    }

    dispose(scene) {
        window.removeEventListener('resize', this.onResize);
        scene.remove(this.mesh);
        this.material.dispose();
        this.mesh.geometry.dispose();
        this.depthRT.dispose();
        this.depthMat.dispose();
    }
}
