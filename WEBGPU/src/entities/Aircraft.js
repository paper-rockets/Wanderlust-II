// Aircraft & Character Model Loader (GLTF Loader, Animation Mixers)

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class AircraftManager {
    constructor(scene) {
        this.scene = scene;
        this.playerGrp = new THREE.Group();
        this.scene.add(this.playerGrp);

        this.loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
        this.loader.setDRACOLoader(dracoLoader);

        this.mixer = null;
        this.currentModel = null;
    }

    loadModel(glbPath, onComplete) {
        this.loader.load(glbPath, (gltf) => {
            if (this.currentModel) {
                this.playerGrp.remove(this.currentModel);
            }
            this.currentModel = gltf.scene;
            this.currentModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            this.playerGrp.add(this.currentModel);

            if (gltf.animations && gltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.currentModel);
                gltf.animations.forEach((clip) => {
                    this.mixer.clipAction(clip).play();
                });
            }

            if (onComplete) onComplete(this.currentModel);
        });
    }

    update(dt) {
        if (this.mixer) {
            this.mixer.update(dt);
        }
    }
}
