import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createTreeUniforms, TreeUniforms } from "./treeUniforms";
import {
  createPineLeafMaterial,
  createPineLeafDepthMaterial,
  createBarkMaterial,
} from "./materials/treeMaterials";
import { TREE_PRESETS, TreePreset } from "./treePresets";

export interface StylizedTreeOptions {
  modelUrl?: string;
  trunkMaterialName?: string;
  leafMaterialName?: string;
  preset?: "spring" | "autumn";
  barkTextures?: {
    color?: string;
    ao?: string;
    height?: string;
  };
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export class StylizedTreeObject extends THREE.Group {
  public uniforms: TreeUniforms;
  public treeMeshGroup: THREE.Group | null = null;
  public currentPreset: "spring" | "autumn" = "spring";

  constructor(options: StylizedTreeOptions = {}) {
    super();
    this.uniforms = createTreeUniforms();

    if (options.position) {
      this.position.set(...options.position);
    }
    if (options.rotation) {
      this.rotation.set(...options.rotation);
    }
    if (typeof options.scale === "number") {
      this.scale.setScalar(options.scale);
    } else if (Array.isArray(options.scale)) {
      this.scale.set(...options.scale);
    }

    this.setPreset(options.preset || "spring");
    this.loadBarkTextures(options.barkTextures);

    const modelUrl = options.modelUrl || "./assets/models/trees/pine_tree_01.glb";
    this.loadModel(
      modelUrl,
      options.trunkMaterialName || "Material.011",
      options.leafMaterialName || "2237f4d60830642a24d65276e7abe1e6",
      options.castShadow !== false,
      options.receiveShadow !== false,
    );
  }

  public setPreset(presetName: "spring" | "autumn") {
    this.currentPreset = presetName;
    const p: TreePreset = TREE_PRESETS[presetName] || TREE_PRESETS.spring;
    const v = p.values;

    this.uniforms.uLeafBottom.value.set(v.leafBottom);
    this.uniforms.uLeafTop.value.set(v.leafTop);
    this.uniforms.uLeafVarColor.value.set(v.leafVarColor);
    this.uniforms.uLeafBrightness.value = v.leafBrightness;
    this.uniforms.uLeafGradPower.value = v.leafGradPower;
    this.uniforms.uLeafVarStrength.value = v.leafVarStrength;
    this.uniforms.uLeafVarScale.value = v.leafVarScale;
    this.uniforms.uLeafWindStrength.value = v.windStrength;
    this.uniforms.uWindSpeed.value = v.windSpeed;
    this.uniforms.uWindFreq.value = v.windFreq;
    this.uniforms.uLeafFlutterAmp.value = v.flutterAmp;
    this.uniforms.uLeafFlutterSpeed.value = v.flutterSpeed;
    this.uniforms.uLeafDip.value = v.pendulumDip;
    this.uniforms.uBarkScale.value = v.barkScale;
    this.uniforms.uBarkTint.value.set(v.barkTint);
    this.uniforms.uBarkTintStrength.value = v.barkTintStrength;
    this.uniforms.uBarkSaturation.value = v.barkSaturation;
    this.uniforms.uBarkBrightness.value = v.barkBrightness;
    this.uniforms.uBarkAOStrength.value = v.barkAOStrength;
    this.uniforms.uBarkRelief.value = v.barkRelief;
  }

  public update(delta: number) {
    this.uniforms.uTime.value += delta;
  }

  private loadBarkTextures(textures?: { color?: string; ao?: string; height?: string }) {
    const loader = new THREE.TextureLoader();
    const colorUrl = textures?.color || "./assets/textures/bark/bark_color.png";
    const aoUrl = textures?.ao || "./assets/textures/bark/bark_AO.png";
    const heightUrl = textures?.height || "./assets/textures/bark/bark_height.png";

    loader.load(colorUrl, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      this.uniforms.uBarkColorMap.value = t;
    });

    loader.load(aoUrl, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      this.uniforms.uBarkAOMap.value = t;
    });

    loader.load(heightUrl, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      this.uniforms.uBarkHeightMap.value = t;
    });
  }

  public loadModel(
    url: string,
    trunkMatName: string,
    leafMatName: string,
    castShadow: boolean,
    receiveShadow: boolean,
    onLoaded?: () => void,
  ) {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (this.treeMeshGroup) {
          this.remove(this.treeMeshGroup);
        }

        this.treeMeshGroup = gltf.scene;

        this.treeMeshGroup.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = castShadow;
            mesh.receiveShadow = receiveShadow;

            const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            const matName = srcMat?.name || "";
            const meshName = mesh.name || "";

            if (
              meshName.includes("Trunk") ||
              matName === trunkMatName ||
              matName.toLowerCase().includes("trunk") ||
              matName.toLowerCase().includes("bark")
            ) {
              mesh.material = createBarkMaterial(mesh, this.uniforms);
            } else if (
              meshName.includes("Foliage") ||
              matName === leafMatName ||
              matName.toLowerCase().includes("leaf") ||
              matName.toLowerCase().includes("needle") ||
              matName.toLowerCase().includes("pine")
            ) {
              mesh.material = createPineLeafMaterial(srcMat, mesh, this.uniforms);
              mesh.customDepthMaterial = createPineLeafDepthMaterial(srcMat);
            }
          }
        });

        this.add(this.treeMeshGroup);
        if (onLoaded) onLoaded();
      },
      undefined,
      (error) => {
        console.error("Failed to load tree model:", url, error);
      },
    );
  }
}
