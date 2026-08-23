import * as THREE from "three";

export type PineLeafUniforms = {
  uTime: THREE.IUniform<number>;
  uWindSpeed: THREE.IUniform<number>;
  uWindFreq: THREE.IUniform<number>;
  uWindDir: THREE.IUniform<THREE.Vector2>;
  uLeafWindStrength: THREE.IUniform<number>;
  uLeafFlutterAmp: THREE.IUniform<number>;
  uLeafFlutterSpeed: THREE.IUniform<number>;
  uLeafDip: THREE.IUniform<number>;
  uLeafBottom: THREE.IUniform<THREE.Color>;
  uLeafTop: THREE.IUniform<THREE.Color>;
  uLeafBrightness: THREE.IUniform<number>;
  uLeafGradPower: THREE.IUniform<number>;
  uLeafVarColor: THREE.IUniform<THREE.Color>;
  uLeafVarStrength: THREE.IUniform<number>;
  uLeafVarScale: THREE.IUniform<number>;
  uLeafYMin?: THREE.IUniform<number>;
  uLeafYMax?: THREE.IUniform<number>;
};

export type BarkUniforms = {
  uBarkColorMap: THREE.IUniform<THREE.Texture>;
  uBarkAOMap: THREE.IUniform<THREE.Texture>;
  uBarkHeightMap: THREE.IUniform<THREE.Texture>;
  uBarkScale: THREE.IUniform<number>;
  uBarkTint: THREE.IUniform<THREE.Color>;
  uBarkTintStrength: THREE.IUniform<number>;
  uBarkSaturation: THREE.IUniform<number>;
  uBarkBrightness: THREE.IUniform<number>;
  uBarkAOStrength: THREE.IUniform<number>;
  uBarkRelief: THREE.IUniform<number>;
};

export type TreeUniforms = PineLeafUniforms & BarkUniforms;

function create1x1Texture(r: number, g: number, b: number): THREE.DataTexture {
  const data = new Uint8Array([r, g, b, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createTreeUniforms(): TreeUniforms {
  return {
    uTime: { value: 0 },
    uWindSpeed: { value: 1.2 },
    uWindFreq: { value: 0.5 },
    uWindDir: { value: new THREE.Vector2(Math.cos((243 * Math.PI) / 180), Math.sin((243 * Math.PI) / 180)) },
    uLeafWindStrength: { value: 0.15 },
    uLeafFlutterAmp: { value: 0.03 },
    uLeafFlutterSpeed: { value: 2.5 },
    uLeafDip: { value: 0.05 },
    uLeafBottom: { value: new THREE.Color("#1c3b23") },
    uLeafTop: { value: new THREE.Color("#5c8338") },
    uLeafBrightness: { value: 1.05 },
    uLeafGradPower: { value: 1.1 },
    uLeafVarColor: { value: new THREE.Color("#1e4430") },
    uLeafVarStrength: { value: 0.6 },
    uLeafVarScale: { value: 2.5 },

    uBarkColorMap: { value: create1x1Texture(110, 80, 50) },
    uBarkAOMap: { value: create1x1Texture(255, 255, 255) },
    uBarkHeightMap: { value: create1x1Texture(128, 128, 128) },
    uBarkScale: { value: 5.6 },
    uBarkTint: { value: new THREE.Color("#8a6a4a") },
    uBarkTintStrength: { value: 0.0 },
    uBarkSaturation: { value: 0.7 },
    uBarkBrightness: { value: 1.55 },
    uBarkAOStrength: { value: 0.45 },
    uBarkRelief: { value: 1.5 },
  };
}
