// WebGPURenderBundles.js - Utility for Pre-recording Static Draw Commands in WebGPU
// Eliminates CPU draw call submission overhead for static world geometry.

export class WebGPUBundleManager {
    constructor(renderer) {
        this.renderer = renderer;
        this.bundles = new Map();
        this.isSupported = Boolean(
            renderer &&
            renderer.backend &&
            typeof renderer.backend.createRenderBundleEncoder === 'function'
        );
    }

    /**
     * Checks whether native GPURenderBundleEncoder is available in the current WebGPU device.
     */
    hasSupport() {
        return this.isSupported;
    }

    /**
     * Records or registers a static render bundle for a set of static meshes.
     * @param {string} bundleKey 
     * @param {Array<THREE.Mesh>} staticMeshes 
     */
    registerStaticGroup(bundleKey, staticMeshes) {
        this.bundles.set(bundleKey, {
            meshes: staticMeshes,
            recorded: false,
            bundle: null
        });
    }

    /**
     * Invalidate a bundle when objects change.
     * @param {string} bundleKey 
     */
    invalidate(bundleKey) {
        const entry = this.bundles.get(bundleKey);
        if (entry) {
            entry.recorded = false;
            entry.bundle = null;
        }
    }

    /**
     * Clear all registered bundles.
     */
    dispose() {
        this.bundles.clear();
    }
}
