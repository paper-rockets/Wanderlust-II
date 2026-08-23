// renderWorker.js - Dedicated WebGPU OffscreenCanvas Render Worker
// Renders the WebGPU game loop completely decoupled from the main DOM thread.

import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';

let renderer = null;
let scene = null;
let camera = null;
let isRunning = false;

self.onmessage = function (e) {
    const data = e.data;
    if (!data) return;

    switch (data.type) {
        case 'init': {
            const { canvas, width, height, pixelRatio } = data;
            
            renderer = new WebGPURenderer({
                canvas,
                antialias: true,
                powerPreference: 'high-performance'
            });
            renderer.setSize(width, height, false);
            renderer.setPixelRatio(pixelRatio || 1);

            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x8cbce6);

            camera = new THREE.PerspectiveCamera(60, width / height, 2.0, 30000);
            camera.position.set(0, 9, 26);

            isRunning = true;
            renderLoop();
            break;
        }

        case 'resize': {
            const { width, height, pixelRatio } = data;
            if (renderer && camera) {
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height, false);
                if (pixelRatio) renderer.setPixelRatio(pixelRatio);
            }
            break;
        }

        case 'input': {
            // Forward input state to camera or flight controls inside the worker
            break;
        }

        case 'stop': {
            isRunning = false;
            break;
        }
    }
};

function renderLoop() {
    if (!isRunning) return;
    requestAnimationFrame(renderLoop);

    if (renderer && scene && camera) {
        renderer.renderAsync(scene, camera);
    }
}
