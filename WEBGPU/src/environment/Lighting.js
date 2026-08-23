// Directional Sun/Moon Light, Ambient Light & Lensflare Setup

import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';

export class LightingManager {
    constructor(scene, isLowGfx = false) {
        this.scene = scene;
        this.isLowGfx = isLowGfx;

        this.ambientLight = new THREE.AmbientLight(0xdcf2ff, 0.9);
        this.scene.add(this.ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xfffaeb, 2.5);
        this.dirLight.position.set(-100, 1500, 750);
        
        if (!this.isLowGfx) {
            this.dirLight.castShadow = true;
            this.dirLight.shadow.mapSize.width = 2048;
            this.dirLight.shadow.mapSize.height = 2048;
            this.dirLight.shadow.camera.near = 10;
            this.dirLight.shadow.camera.far = 2500;
            const d = 1200;
            this.dirLight.shadow.camera.left = -d;
            this.dirLight.shadow.camera.right = d;
            this.dirLight.shadow.camera.top = d;
            this.dirLight.shadow.camera.bottom = -d;
            this.dirLight.shadow.bias = -0.0005;
        }
        this.scene.add(this.dirLight);

        // Lensflare
        if (!this.isLowGfx) {
            this.lensflare = new Lensflare();
            const textureLoader = new THREE.TextureLoader();
            const flare0 = textureLoader.load('assets/lensflare0.png');
            const flare3 = textureLoader.load('assets/lensflare3.png');
            this.lensflare.addElement(new LensflareElement(flare0, 400, 0, new THREE.Color(0xfffaeb)));
            this.lensflare.addElement(new LensflareElement(flare3, 60, 0.6));
            this.lensflare.addElement(new LensflareElement(flare3, 70, 0.7));
            this.lensflare.addElement(new LensflareElement(flare3, 120, 0.9));
            this.dirLight.add(this.lensflare);
        }
    }

    update(sunPos) {
        if (sunPos) {
            this.dirLight.position.copy(sunPos);
        }
    }
}
