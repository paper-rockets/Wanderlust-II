// AssetLoader.js - Robust asset loading utility with multi-path resolution for WAMP & Vite

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
    } else if (basename) {
        candidates.add('assets/Flight/' + basename);
    }

    // 3. Fallback with public/ prefix (for static root file servers)
    candidates.add('public/' + clean);
    if (basename) {
        candidates.add('public/' + basename);
        candidates.add('public/assets/Flight/' + basename);
    }
    
    return Array.from(candidates);
}

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
        console.log(`[AssetLoader] Trying GLTF candidate ${attemptIdx}/${candidates.length}: '${currentPath}' (original: '${path}')`);
        gltfLoader.load(
            currentPath,
            (gltf) => {
                console.log(`[AssetLoader] SUCCESS loading '${currentPath}' (original: '${path}')`);
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

export function loadTextureWithFallback(texLoader, path, onLoad, onProgress, onError) {
    const candidates = getAssetCandidates(path);
    let attemptIdx = 0;

    const tex = texLoader.load(
        candidates[0],
        (loadedTex) => {
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
