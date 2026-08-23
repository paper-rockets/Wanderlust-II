import * as THREE from 'three';

const WAVE_RES = 512;
const TEXEL    = 1.0 / WAVE_RES;
const FIXED_STEP = 1 / 60;

const INJ_VERT = /* glsl */ `
  varying float vWorldY;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldY  = wp.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const INJ_FRAG = /* glsl */ `
  uniform float uWaterY;
  uniform float uBandWidth;
  varying float vWorldY;
  void main() {
    float d = abs(vWorldY - uWaterY);
    if (d > uBandWidth) discard;
    float s = 1.0 - smoothstep(0.0, uBandWidth, d);
    gl_FragColor = vec4(s, 0.0, 0.0, 1.0);
  }
`;

const WAVE_VERT = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const WAVE_FRAG = /* glsl */ `
  uniform sampler2D uWaveTex;
  uniform sampler2D uInjection;
  uniform float     uTexelSize;
  uniform float     uResolution;
  uniform float     uSpeed;
  uniform float     uDamping;
  uniform float     uInjectStr;
  uniform float     uInjectAmp;
  uniform float     uBorderWidth;

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;

    float cur  = texture2D(uWaveTex, uv).r;
    float prev = texture2D(uWaveTex, uv).g;

    // Discrete Laplacian
    float left  = texture2D(uWaveTex, uv + vec2(-uTexelSize, 0.0)).r;
    float right = texture2D(uWaveTex, uv + vec2( uTexelSize, 0.0)).r;
    float up    = texture2D(uWaveTex, uv + vec2(0.0,  uTexelSize)).r;
    float down  = texture2D(uWaveTex, uv + vec2(0.0, -uTexelSize)).r;

    float laplacian = left + right + up + down - 4.0 * cur;

    // 2nd-order wave equation
    float next = 2.0 * cur - prev + uSpeed * laplacian;
    next *= uDamping;

    // Absorbing boundary — prevents edge reflections
    float edge   = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float border = smoothstep(0.0, uBorderWidth, edge);
    next *= border;

    // Inject energy at the waterline intersection
    float inject = texture2D(uInjection, uv).r;
    next = mix(next, uInjectAmp, inject * uInjectStr);

    next = clamp(next, -1.0, 1.0);

    gl_FragColor = vec4(next, cur, 0.0, 1.0);
  }
`;

const DISP_VERT = /* glsl */ `
  varying vec2 vWorldXZ;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldXZ    = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const DISP_FRAG = /* glsl */ `
  uniform sampler2D uWaveTex;
  uniform vec2  uCenter;
  uniform float uWaveSize;
  uniform float uTexelSize;
  uniform float uGradScale;
  uniform float uRingThreshold;
  uniform float uEdgeSharpness;
  uniform vec3  uColor;
  uniform float uOpacity;

  varying vec2 vWorldXZ;

  void main() {
    float u =  (vWorldXZ.x - uCenter.x) / (uWaveSize * 2.0) + 0.5;
    float v = -(vWorldXZ.y - uCenter.y) / (uWaveSize * 2.0) + 0.5;
    vec2 uv = vec2(u, v);

    if (any(lessThan(uv, vec2(0.01))) || any(greaterThan(uv, vec2(0.99)))) discard;

    // Gradient magnitude
    float dx = texture2D(uWaveTex, uv + vec2( uTexelSize, 0.0)).r
             - texture2D(uWaveTex, uv - vec2( uTexelSize, 0.0)).r;
    float dy = texture2D(uWaveTex, uv + vec2(0.0,  uTexelSize)).r
             - texture2D(uWaveTex, uv - vec2(0.0,  uTexelSize)).r;
    float grad = length(vec2(dx, dy)) * uGradScale;

    // uRingThreshold shifts what gradient counts as a ring
    // uEdgeSharpness narrows the smoothstep window (1 = near hard step, anime style)
    float halfEdge = mix(0.35, 0.01, uEdgeSharpness);
    float ring     = smoothstep(uRingThreshold - halfEdge, uRingThreshold + halfEdge, grad);

    if (ring < 0.01) discard;
    gl_FragColor = vec4(uColor, ring * uOpacity);
  }
`;

export class WaterWaveSimulation {
    constructor(scene, renderer) {
        this.renderer = renderer;
        
        // 1. Injection
        this.injRT = new THREE.WebGLRenderTarget(WAVE_RES, WAVE_RES, {
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
        });

        this.injCamera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
        this.injCamera.up.set(0, 0, -1);
        
        this.injMat = new THREE.ShaderMaterial({
            vertexShader: INJ_VERT,
            fragmentShader: INJ_FRAG,
            side: THREE.DoubleSide,
            uniforms: {
                uWaterY: { value: 2.4 },
                uBandWidth: { value: 1.0 },
            }
        });
        
        this.injScene = new THREE.Scene();
        this.injScene.background = new THREE.Color(0x000000);

        // 2. Wave Ping-Pong
        this.waveRTs = [
            new THREE.WebGLRenderTarget(WAVE_RES, WAVE_RES, {
                format: THREE.RGBAFormat,
                type: THREE.HalfFloatType,
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
            }),
            new THREE.WebGLRenderTarget(WAVE_RES, WAVE_RES, {
                format: THREE.RGBAFormat,
                type: THREE.HalfFloatType,
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
            })
        ];
        
        this.waveUpdateMat = new THREE.ShaderMaterial({
            depthTest: false,
            depthWrite: false,
            vertexShader: WAVE_VERT,
            fragmentShader: WAVE_FRAG,
            uniforms: {
                uWaveTex: { value: null },
                uInjection: { value: null },
                uTexelSize: { value: TEXEL },
                uResolution: { value: WAVE_RES },
                uSpeed: { value: 0.04 },
                uDamping: { value: 0.993 },
                uInjectStr: { value: 0.25 },
                uInjectAmp: { value: 0.7 },
                uBorderWidth: { value: 0.06 },
            }
        });

        this.waveScene = new THREE.Scene();
        this.waveScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.waveUpdateMat));
        this.waveCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // 3. Display
        this.displayMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: DISP_VERT,
            fragmentShader: DISP_FRAG,
            uniforms: {
                uWaveTex: { value: null },
                uCenter: { value: new THREE.Vector2() },
                uWaveSize: { value: 20 },
                uTexelSize: { value: TEXEL },
                uGradScale: { value: 1.0 },
                uRingThreshold: { value: 0.4 },
                uEdgeSharpness: { value: 1.0 },
                uColor: { value: new THREE.Color("#ffffff") },
                uOpacity: { value: 0.8 },
            }
        });

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(50000, 50000), this.displayMat);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.y = -0.092;
        this.mesh.renderOrder = 6;
        this.mesh.frustumCulled = false;
        
        scene.add(this.mesh);

        this.intersectMeshes = [];
        this.pingIdx = 0;
        this.needsInit = true;
        this.lastInjectTime = -Infinity;
        this.timeAccum = 0;
    }

    addMeshToIntersect(mesh) {
        if (!this.intersectMeshes.includes(mesh)) {
            this.intersectMeshes.push(mesh);
        }
    }

    updateAndRender(dt, elapsedTime, camera, controls) {
        if (!controls || !controls.enabled) {
            this.mesh.visible = false;
            return;
        }
        this.mesh.visible = true;

        let cx = 0, cz = 0, maxScale = 5;
        let activeCount = 0;

        this.injScene.clear();
        for (const mesh of this.intersectMeshes) {
            if (!mesh.visible) continue;
            activeCount++;
            const clone = new THREE.Mesh(mesh.geometry, this.injMat);
            mesh.getWorldPosition(clone.position);
            mesh.getWorldQuaternion(clone.quaternion);
            mesh.getWorldScale(clone.scale);
            this.injScene.add(clone);

            cx += clone.position.x;
            cz += clone.position.z;
            maxScale = Math.max(maxScale, clone.scale.x);
        }

        if (activeCount > 0) {
            cx /= activeCount;
            cz /= activeCount;
        } else {
            cx = camera.position.x;
            cz = camera.position.z;
            maxScale = 200; // Big default area for WANDERLUST scale
        }
        const waveSize = maxScale * controls.waveSizeMul;

        const prevRT = this.renderer.getRenderTarget();
        const prevAC = this.renderer.autoClear;
        this.renderer.autoClear = true;

        if (this.needsInit) {
            const prevCC = this.renderer.getClearColor(new THREE.Color());
            const prevCA = this.renderer.getClearAlpha();
            this.renderer.setClearColor(0x000000, 0);
            this.waveRTs.forEach(rt => {
                this.renderer.setRenderTarget(rt);
                this.renderer.clear(true, false, false);
            });
            this.renderer.setClearColor(prevCC, prevCA);
            this.needsInit = false;
        }

        this.timeAccum += dt;
        const shouldStep = this.timeAccum >= FIXED_STEP;
        if (shouldStep) this.timeAccum -= FIXED_STEP;

        // 1. INJECTION
        const shouldInject = shouldStep && (elapsedTime - this.lastInjectTime) >= controls.injectInterval;
        if (shouldInject) {
            this.injMat.uniforms.uBandWidth.value = controls.bandWidth;

            this.injCamera.left = -waveSize;
            this.injCamera.right = waveSize;
            this.injCamera.top = waveSize;
            this.injCamera.bottom = -waveSize;
            this.injCamera.updateProjectionMatrix();
            this.injCamera.position.set(cx, 100, cz);
            this.injCamera.lookAt(cx, 0, cz);

            this.renderer.setRenderTarget(this.injRT);
            this.renderer.clear();
            this.renderer.render(this.injScene, this.injCamera);
            this.lastInjectTime = elapsedTime;
        }

        // 2. WAVE UPDATE
        if (shouldStep) {
            const readRT = this.waveRTs[this.pingIdx];
            const writeRT = this.waveRTs[1 - this.pingIdx];

            this.waveUpdateMat.uniforms.uWaveTex.value = readRT.texture;
            this.waveUpdateMat.uniforms.uInjection.value = this.injRT.texture;
            this.waveUpdateMat.uniforms.uSpeed.value = controls.speed;
            this.waveUpdateMat.uniforms.uDamping.value = controls.damping;
            this.waveUpdateMat.uniforms.uBorderWidth.value = controls.borderWidth;
            this.waveUpdateMat.uniforms.uInjectAmp.value = controls.injectAmp;
            this.waveUpdateMat.uniforms.uInjectStr.value = shouldInject ? controls.injectStr : 0.0;

            this.renderer.setRenderTarget(writeRT);
            this.renderer.render(this.waveScene, this.waveCamera);

            this.pingIdx = 1 - this.pingIdx;
        }

        this.renderer.setRenderTarget(prevRT);
        this.renderer.autoClear = prevAC;

        // 3. Display
        const u = this.displayMat.uniforms;
        u.uWaveTex.value = this.waveRTs[this.pingIdx].texture;
        u.uCenter.value.set(cx, cz);
        u.uWaveSize.value = waveSize;
        u.uGradScale.value = controls.gradScale;
        u.uRingThreshold.value = controls.ringThreshold;
        u.uEdgeSharpness.value = controls.edgeSharpness;
        u.uColor.value.set(controls.color);
        u.uOpacity.value = controls.opacity;

        this.mesh.position.x = camera.position.x;
        this.mesh.position.z = camera.position.z;
    }

    dispose(scene) {
        scene.remove(this.mesh);
        this.displayMat.dispose();
        this.mesh.geometry.dispose();
        this.injRT.dispose();
        this.waveRTs.forEach(rt => rt.dispose());
        this.injMat.dispose();
        this.waveUpdateMat.dispose();
    }
}
