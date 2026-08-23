import * as THREE from 'three';

const VERT = /* glsl */ `
  varying vec2 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos     = worldPos.xz;
    gl_Position   = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uCellSpeed;
  uniform float uFlowX;
  uniform float uFlowZ;
  uniform float uEdgeThreshold;
  uniform float uEdgeSoftness;
  uniform vec3  uDeepColor;
  uniform vec3  uHighlight;
  uniform float uFadeDistance;
  uniform float uFadeStrength;
  uniform vec2  uCamXZ;

  varying vec2 vWorldPos;

  vec2 hash2(vec2 p) {
    vec2 q = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(q) * 43758.5453);
  }

  vec2 cellPt(vec2 seed, float time) {
    return 0.5 + 0.5 * sin(time + 6.2831 * seed);
  }

  float voronoiEdge(vec2 p, float time) {
    vec2 i = floor(p), f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 n  = vec2(float(x), float(y));
        vec2 pt = cellPt(hash2(i + n), time);
        float d = length(n + pt - f);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
    return d2 - d1;
  }

  void main() {
    vec2  pos  = vWorldPos * 0.04 + vec2(uTime * 0.02 * uFlowX, uTime * 0.02 * uFlowZ);
    float e    = voronoiEdge(pos, uTime * uCellSpeed);
    float web  = pow(clamp(1.0 - e * 2.0, 0.0, 1.0), 2.5);
    float mask = smoothstep(0.2, 0.7, web);
    vec3 color = mix(uDeepColor, uHighlight, mask);

    float dist  = length(vWorldPos - uCamXZ);
    float fade  = 1.0 - pow(clamp(dist / uFadeDistance, 0.0, 1.0), uFadeStrength);

    gl_FragColor = vec4(color, fade);
  }
`;

export class SeabedFloor {
    constructor(scene) {
        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.FrontSide,
            vertexShader: VERT,
            fragmentShader: FRAG,
            uniforms: {
                uTime: { value: 0 },
                uScale: { value: 0.2 },
                uCellSpeed: { value: 0.18 },
                uFlowX: { value: 0.035 },
                uFlowZ: { value: -0.11 },
                uEdgeThreshold: { value: 0.06 },
                uEdgeSoftness: { value: 0.04 },
                uDeepColor: { value: new THREE.Color("#27a3d8") },
                uHighlight: { value: new THREE.Color("#0a1f3c") },
                uFadeDistance: { value: 250.0 },
                uFadeStrength: { value: 2.1 },
                uCamXZ: { value: new THREE.Vector2() },
            }
        });

        const geometry = new THREE.PlaneGeometry(50000, 50000);
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.y = -3.5;
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 0; // Render before water floor
        this.mesh.receiveShadow = true;

        scene.add(this.mesh);
    }

    update(dt, elapsedTime, camera, controls) {
        const u = this.material.uniforms;
        u.uTime.value = elapsedTime;
        u.uCamXZ.value.set(camera.position.x, camera.position.z);

        if (controls) {
            u.uScale.value = controls.seabedScale;
            u.uCellSpeed.value = controls.cellSpeed;
            u.uFlowX.value = controls.flowX;
            u.uFlowZ.value = controls.flowZ;
            u.uEdgeThreshold.value = controls.edgeThreshold;
            u.uEdgeSoftness.value = controls.edgeSoftness;
            u.uDeepColor.value.set(controls.deepColor);
            u.uHighlight.value.set(controls.highlightColor);
            u.uFadeDistance.value = controls.fadeDistance;
            u.uFadeStrength.value = controls.fadeStrength;
            this.mesh.position.y = controls.seabedDepth;
        }

        // Follow camera in XZ
        if (camera) {
            if (!this._tempCamPos) this._tempCamPos = new THREE.Vector3();
            camera.getWorldPosition(this._tempCamPos);
            this.mesh.position.x = this._tempCamPos.x;
            this.mesh.position.z = this._tempCamPos.z;
        }
    }

    dispose(scene) {
        scene.remove(this.mesh);
        this.material.dispose();
        this.mesh.geometry.dispose();
    }
}
