// AssetLoader.js - Robust WebGPU asset loading utility with multi-path resolution,
// asynchronous ImageBitmap decoding, KTX2 compressed texture support, and texture caching.

import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

// Cache for loaded textures to prevent duplicate downloads and memory waste
const _textureCache = new Map();
let _ktx2LoaderInstance = null;

export function getAssetCandidates(path) {
    if (!path || typeof path !== 'string') return [path];
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
        return [path];
    }
    
    const clean = path.replace(/^\.?\//, '');
    const basename = clean.split('/').pop();
    
    const candidates = new Set();
    
    // 1. Direct path first (standard for Vite & web servers)
    candidates.add(clean);
    
    // 2. Basename and subfolder candidates
    if (basename && basename !== clean) {
        candidates.add(basename);
        candidates.add('assets/Flight/' + basename);
        candidates.add('assets/Trees/' + basename);
        candidates.add('assets/textures/' + basename);
    } else if (basename) {
        candidates.add('assets/Flight/' + basename);
        candidates.add('assets/Trees/' + basename);
        candidates.add('assets/textures/' + basename);
    }

    // 3. Fallback with public/ prefix (for static root file servers)
    candidates.add('public/' + clean);
    if (basename) {
        candidates.add('public/' + basename);
        candidates.add('public/assets/Flight/' + basename);
        candidates.add('public/assets/Trees/' + basename);
        candidates.add('public/assets/textures/' + basename);
    }
    
    return Array.from(candidates);
}

/**
 * Loads a GLTF model trying multiple candidate paths with error recovery.
 */
export function loadGLTFWithFallback(gltfLoader, path, onLoad, onProgress, onError) {
    const candidates = getAssetCandidates(path);
    let attemptIdx = 0;

    function tryNext() {
        if (attemptIdx >= candidates.length) {
            console.error(`[AssetLoader] ALL candidates FAILED for '${path}':`, candidates);
            if (onError) {
                onError(new Error(`Failed to load GLTF model from any candidate path: ${candidates.join(', ')}`));
            } else {
                console.warn(`Failed to load GLTF model from: ${candidates.join(', ')}`);
            }
            return;
        }

        const currentPath = candidates[attemptIdx++];
        gltfLoader.load(
            currentPath,
            (gltf) => {
                if (onLoad) onLoad(gltf, currentPath);
            },
            onProgress,
            (err) => {
                console.warn(`[AssetLoader] FAILED '${currentPath}':`, err?.message || err);
                tryNext();
            }
        );
    }

    tryNext();
}

/**
 * Asynchronously loads and decodes an image via createImageBitmap off the main thread.
 * Returns a high-performance THREE.Texture or CanvasTexture.
 */
export function loadAsyncImageBitmapTexture(path, {
    colorSpace = THREE.SRGBColorSpace,
    flipY = false,
    generateMipmaps = true,
    minFilter = THREE.LinearMipmapLinearFilter,
    magFilter = THREE.LinearFilter,
    wrapS = THREE.RepeatWrapping,
    wrapT = THREE.RepeatWrapping
} = {}) {
    const cached = _textureCache.get(path);
    if (cached) return Promise.resolve(cached);

    const candidates = getAssetCandidates(path);
    
    async function tryFetchAndDecode(idx) {
        if (idx >= candidates.length) {
            throw new Error(`[AssetLoader] Failed to load ImageBitmap from candidates: ${candidates.join(', ')}`);
        }
        const candidatePath = candidates[idx];
        try {
            const response = await fetch(candidatePath);
            if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
            const blob = await response.blob();
            
            // Decode asynchronously in background thread via browser's native engine
            const imageBitmap = await createImageBitmap(blob, {
                imageOrientation: flipY ? 'flipY' : 'none',
                premultiplyAlpha: 'none',
                colorSpaceConversion: 'default'
            });

            const texture = new THREE.Texture(imageBitmap);
            texture.colorSpace = colorSpace;
            texture.generateMipmaps = generateMipmaps;
            texture.minFilter = minFilter;
            texture.magFilter = magFilter;
            texture.wrapS = wrapS;
            texture.wrapT = wrapT;
            texture.needsUpdate = true;

            _textureCache.set(path, texture);
            return texture;
        } catch (err) {
            console.warn(`[AssetLoader] ImageBitmap fetch failed for '${candidatePath}':`, err.message);
            return tryFetchAndDecode(idx + 1);
        }
    }

    return tryFetchAndDecode(0);
}

/**
 * Standard fallback texture loader with multi-path resolution and caching.
 */
export function loadTextureWithFallback(texLoader, path, onLoad, onProgress, onError) {
    if (_textureCache.has(path)) {
        const cached = _textureCache.get(path);
        if (onLoad) setTimeout(() => onLoad(cached, path), 0);
        return cached;
    }

    const candidates = getAssetCandidates(path);
    let attemptIdx = 0;

    const tex = texLoader.load(
        candidates[0],
        (loadedTex) => {
            _textureCache.set(path, loadedTex);
            if (onLoad) onLoad(loadedTex, candidates[0]);
        },
        onProgress,
        (err) => {
            attemptIdx = 1;
            function tryNext() {
                if (attemptIdx >= candidates.length) {
                    if (onError) {
                        onError(new Error(`Failed to load texture from any candidate path: ${candidates.join(', ')}`));
                    } else {
                        console.warn(`Failed to load texture from: ${candidates.join(', ')}`);
                    }
                    return;
                }
                const nextPath = candidates[attemptIdx++];
                texLoader.load(
                    nextPath,
                    (newTex) => {
                        tex.image = newTex.image;
                        tex.needsUpdate = true;
                        _textureCache.set(path, tex);
                        if (onLoad) onLoad(tex, nextPath);
                    },
                    onProgress,
                    tryNext
                );
            }
            tryNext();
        }
    );

    return tex;
}

/**
 * Initializes and returns a shared KTX2Loader instance configured for WebGPU / WebGL transcoding.
 */
export function getKTX2Loader(renderer, transcoderPath = 'https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/libs/basis/') {
    if (!_ktx2LoaderInstance) {
        _ktx2LoaderInstance = new KTX2Loader();
        _ktx2LoaderInstance.setTranscoderPath(transcoderPath);
        if (renderer) {
            _ktx2LoaderInstance.detectSupport(renderer);
        }
    }
    return _ktx2LoaderInstance;
}

/**
 * Loads a KTX2 compressed texture with fallback candidate resolution.
 */
export function loadKTX2TextureWithFallback(ktx2Loader, path, onLoad, onProgress, onError) {
    if (_textureCache.has(path)) {
        const cached = _textureCache.get(path);
        if (onLoad) setTimeout(() => onLoad(cached, path), 0);
        return cached;
    }

    const candidates = getAssetCandidates(path);
    let attemptIdx = 0;

    function tryNext() {
        if (attemptIdx >= candidates.length) {
            if (onError) onError(new Error(`Failed to load KTX2 from candidates: ${candidates.join(', ')}`));
            return;
        }
        const currentPath = candidates[attemptIdx++];
        ktx2Loader.load(
            currentPath,
            (tex) => {
                _textureCache.set(path, tex);
                if (onLoad) onLoad(tex, currentPath);
            },
            onProgress,
            (err) => {
                console.warn(`[AssetLoader] KTX2 load failed for '${currentPath}':`, err?.message || err);
                tryNext();
            }
        );
    }

    tryNext();
}

/**
 * Clear cached textures to free memory when switching scenes.
 */
export function clearTextureCache() {
    _textureCache.forEach(tex => {
        if (tex && typeof tex.dispose === 'function') {
            tex.dispose();
        }
    });
    _textureCache.clear();
}
