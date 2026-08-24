let _mapEl = null;
let _mapCanvas = null;
let _mapCtx = null;
let _isMapExpanded = false;
let _mapZoomLevel = 1.0;
let _lastZoomState = 1.0;
let _lastExpandedState = false;
let _lastMapX = -999999;
let _lastMapZ = -999999;
let _mapBgCanvas = null;
let _mapBgCtx = null;

const _mapColors = {
    'Archipelago':       '#2a6aad',
    'Ghibli Land':       '#4a9640',
    'Golden Plains':     '#c8a832',
    'Misty Mountains':   '#6b7280',
    'Lush Jungle':       '#2eb85c',
    'Crystal Land':      '#5b8fa8',
    'Open Ocean':        '#1d4ed8',
    'Desert Dunes':      '#d97706',
    'Badlands Canyon':   '#9a3412',
    'North Pole':        '#93e5fa',
};

export function showVisualToast(msg, flightModelManager = null) {
    if (flightModelManager && typeof flightModelManager.showToast === 'function') {
        flightModelManager.showToast(msg);
        return;
    }
    let toast = document.getElementById('wl-visual-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'wl-visual-toast';
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'rgba(15, 23, 42, 0.9)';
        toast.style.color = '#fff';
        toast.style.padding = '8px 18px';
        toast.style.borderRadius = '20px';
        toast.style.fontFamily = 'system-ui, sans-serif';
        toast.style.fontSize = '13px';
        toast.style.zIndex = '99999';
        toast.style.pointerEvents = 'none';
        toast.style.transition = 'opacity 0.3s ease';
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        if (toast) toast.style.opacity = '0';
    }, 2200);
}

export function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

export function toggleMapExpand() {
    _isMapExpanded = !_isMapExpanded;
    _mapEl = document.getElementById('world-map');
    const mapTitle = document.getElementById('map-title-text');
    const expandBtn = document.getElementById('expand-map-btn');

    if (_mapEl) {
        if (_isMapExpanded) {
            _mapEl.style.width = '520px';
            _mapEl.style.left = '50%';
            _mapEl.style.top = '50%';
            _mapEl.style.bottom = 'auto';
            _mapEl.style.transform = 'translate(-50%, -50%)';
            if (mapTitle) mapTitle.innerText = 'EXPANDED WORLD MAP (PRESS M TO CLOSE)';
            if (expandBtn) expandBtn.innerText = '[X]';
        } else {
            _mapEl.style.width = '230px';
            _mapEl.style.left = '20px';
            _mapEl.style.bottom = '20px';
            _mapEl.style.top = 'auto';
            _mapEl.style.transform = 'none';
            if (mapTitle) mapTitle.innerText = 'RADAR MAP';
            if (expandBtn) expandBtn.innerText = '[+]';
        }
    }
    _lastMapX = -999999;
}

export function initMapUI(options = {}) {
    const { playerGrp, getWorldHeight, WORLD_LENGTH = 160000, onTeleport } = options;
    _mapEl = document.getElementById('world-map');
    _mapCanvas = document.getElementById('map-canvas');

    if (_mapCanvas) {
        _mapCtx = _mapCanvas.getContext('2d');
        _mapCanvas.style.cursor = 'crosshair';
        _mapCanvas.addEventListener('click', (e) => {
            const rect = _mapCanvas.getBoundingClientRect();
            const normX = (e.clientX - rect.left) / rect.width - 0.5;
            const normY = (e.clientY - rect.top) / rect.height - 0.5;

            const baseSize = _isMapExpanded ? WORLD_LENGTH : 80000;
            const radarSize = baseSize / _mapZoomLevel;

            if (playerGrp) {
                const targetX = playerGrp.position.x + normX * radarSize;
                const targetZ = playerGrp.position.z + normY * radarSize;
                const targetY = getWorldHeight ? Math.max(15, getWorldHeight(targetX, targetZ) + 15) : 30;
                playerGrp.position.set(targetX, targetY, targetZ);
                _lastMapX = -999999;
                if (typeof onTeleport === 'function') onTeleport(targetX, targetY, targetZ);
            }
        });
    }

    const expandMapBtn = document.getElementById('expand-map-btn');
    if (expandMapBtn) {
        expandMapBtn.addEventListener('click', () => toggleMapExpand());
    }

    const zoomInBtn = document.getElementById('zoom-in-btn');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            _mapZoomLevel = Math.min(16.0, _mapZoomLevel * 1.6);
            _lastMapX = -999999;
        });
    }

    const zoomOutBtn = document.getElementById('zoom-out-btn');
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            _mapZoomLevel = Math.max(0.05, _mapZoomLevel / 1.6);
            _lastMapX = -999999;
        });
    }

    if (_mapCanvas) {
        _mapCanvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY > 0) {
                _mapZoomLevel = Math.max(0.05, _mapZoomLevel / 1.25);
            } else {
                _mapZoomLevel = Math.min(16.0, _mapZoomLevel * 1.25);
            }
            _lastMapX = -999999;
        }, { passive: false });
    }

    const closeMapBtn = document.getElementById('close-map-btn');
    if (closeMapBtn) {
        closeMapBtn.addEventListener('click', () => {
            if (_mapEl) _mapEl.style.display = 'none';
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'm' || e.key === 'M') {
            if (!e.target || (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA')) {
                if (_mapEl && _mapEl.style.display === 'none') {
                    _mapEl.style.display = 'block';
                } else {
                    toggleMapExpand();
                }
            }
        }
    });
}

export function drawWorldMap(options = {}) {
    const { playerGrp, getBiomeAt, getIslandData, WORLD_LENGTH = 160000 } = options;
    if (!playerGrp) return;
    if (!_mapCanvas) _mapCanvas = document.getElementById('map-canvas');
    if (_mapCanvas && !_mapCtx) _mapCtx = _mapCanvas.getContext('2d');
    if (!_mapCanvas || !_mapCtx) return;

    const W = _isMapExpanded ? 480 : 200;
    const H = _isMapExpanded ? 480 : 200;

    if (_mapCanvas.width !== W || _mapCanvas.height !== H) {
        _mapCanvas.width = W;
        _mapCanvas.height = H;
    }

    if (!_mapBgCanvas) {
        _mapBgCanvas = document.createElement('canvas');
        _mapBgCtx = _mapBgCanvas.getContext('2d');
    }

    if (_mapBgCanvas.width !== W || _mapBgCanvas.height !== H) {
        _mapBgCanvas.width = W;
        _mapBgCanvas.height = H;
        _lastMapX = -999999;
    }

    const px = playerGrp.position.x;
    const pz = playerGrp.position.z;

    const stateChanged = (_lastExpandedState !== _isMapExpanded) || (_lastZoomState !== _mapZoomLevel);
    if (stateChanged) {
        _lastExpandedState = _isMapExpanded;
        _lastZoomState = _mapZoomLevel;
        _lastMapX = -999999;
    }

    if (Math.hypot(px - _lastMapX, pz - _lastMapZ) > 80 || stateChanged) {
        _lastMapX = px;
        _lastMapZ = pz;

        const baseSize = _isMapExpanded ? WORLD_LENGTH : 80000;
        const radarSize = baseSize / _mapZoomLevel;
        const pxStart = px - radarSize / 2;
        const pzStart = pz - radarSize / 2;

        const res = _isMapExpanded ? 60 : 40;
        const step = radarSize / res;
        const pxStep = W / res;

        _mapBgCtx.clearRect(0, 0, W, H);
        if (getIslandData) {
            for (let i = 0; i < res; i++) {
                for (let j = 0; j < res; j++) {
                    const sampleX = pxStart + i * step;
                    const sampleZ = pzStart + j * step;
                    const data = getIslandData(sampleX, sampleZ);
                    if (data.mask === 0) {
                        _mapBgCtx.fillStyle = '#1a4a8c';
                    } else {
                        const cleanName = data.mainBiome?.name ? data.mainBiome.name.replace(/[^\w\s]/gi, '').trim() : '';
                        _mapBgCtx.fillStyle = _mapColors[cleanName] || _mapColors[data.mainBiome?.name] || '#88cc88';
                    }
                    _mapBgCtx.fillRect(i * pxStep, j * pxStep, pxStep + 0.5, pxStep + 0.5);
                }
            }
        }
    }

    _mapCtx.clearRect(0, 0, W, H);
    _mapCtx.drawImage(_mapBgCanvas, 0, 0);

    // Draw Red Player Dot in center
    _mapCtx.fillStyle = '#ff3333';
    _mapCtx.beginPath();
    _mapCtx.arc(W / 2, H / 2, _isMapExpanded ? 6 : 4, 0, Math.PI * 2);
    _mapCtx.fill();
    _mapCtx.strokeStyle = '#ffffff';
    _mapCtx.lineWidth = 1.5;
    _mapCtx.stroke();

    const infoText = document.getElementById('map-info-text');
    if (infoText) {
        const rx = Math.round(px);
        const rz = Math.round(pz);
        const currentBiome = getBiomeAt ? getBiomeAt(px, pz) : null;
        const bName = currentBiome ? currentBiome.name : 'Unknown';
        const zoomStr = _mapZoomLevel >= 1.0 ? `${_mapZoomLevel.toFixed(1)}x` : `${_mapZoomLevel.toFixed(2)}x`;
        infoText.innerText = `X: ${rx}m | Z: ${rz}m | BIOME: ${bName} | ZOOM: ${zoomStr}`;
    }
}
