// 2D Mini-map Canvas Renderer

export class WorldMapCanvas {
    constructor(getIslandDataFn, worldLength = 210000) {
        this.getIslandData = getIslandDataFn;
        this.worldLength = worldLength;
        this.mapCanvas = null;
        this.mapCtx = null;
        this.mapBgCanvas = null;
        this.mapBgCtx = null;
        this.lastMapX = -999999;
        this.lastMapZ = -999999;
        this.lastExpandedState = false;
        this.lastZoomState = 1.0;
    }

    render(playerPos, isExpanded = false, zoomLevel = 1.0) {
        if (!playerPos) return;
        if (!this.mapCanvas) this.mapCanvas = document.getElementById('map-canvas');
        if (this.mapCanvas && !this.mapCtx) this.mapCtx = this.mapCanvas.getContext('2d');
        if (!this.mapCanvas || !this.mapCtx) return;
        
        const W = isExpanded ? 480 : 200;
        const H = isExpanded ? 480 : 200;

        if (this.mapCanvas.width !== W || this.mapCanvas.height !== H) {
            this.mapCanvas.width = W;
            this.mapCanvas.height = H;
        }

        if (!this.mapBgCanvas) {
            this.mapBgCanvas = document.createElement('canvas');
            this.mapBgCtx = this.mapBgCanvas.getContext('2d');
        }

        if (this.mapBgCanvas.width !== W || this.mapBgCanvas.height !== H) {
            this.mapBgCanvas.width = W;
            this.mapBgCanvas.height = H;
            this.lastMapX = -999999;
        }

        const px = playerPos.x;
        const pz = playerPos.z;

        const stateChanged = (this.lastExpandedState !== isExpanded) || (this.lastZoomState !== zoomLevel);
        if (stateChanged) {
            this.lastExpandedState = isExpanded;
            this.lastZoomState = zoomLevel;
            this.lastMapX = -999999;
        }

        if (Math.hypot(px - this.lastMapX, pz - this.lastMapZ) > 80 || stateChanged) {
            this.lastMapX = px;
            this.lastMapZ = pz;

            const baseSize = isExpanded ? this.worldLength : 80000;
            const radarSize = baseSize / zoomLevel;
            const pxStart = px - radarSize / 2;
            const pzStart = pz - radarSize / 2;
            
            const res = isExpanded ? 60 : 40;
            const step = radarSize / res;
            const pxStep = W / res;
            
            this.mapBgCtx.clearRect(0, 0, W, H);
            for (let i = 0; i < res; i++) {
                for (let j = 0; j < res; j++) {
                    const sampleX = pxStart + i * step;
                    const sampleZ = pzStart + j * step;
                    
                    const data = this.getIslandData(sampleX, sampleZ);
                    const bName = data.name || '';
                    
                    // Overgrown Ruin "Cage Jungle" Footprint
                    const isRuinFootprint = (sampleZ >= 33000 && sampleZ <= 42000 && Math.abs(sampleX) < 14000 && data.height > 12.0);

                    if (data.mask === 0) {
                        this.mapBgCtx.fillStyle = '#1a4a8c';
                    } else if (isRuinFootprint) {
                        // Green-brown ancient stone ruin & overgrown vine footprint
                        this.mapBgCtx.fillStyle = (data.height > 40) ? '#5c5446' : '#3d4d29';
                    } else if (data.height < 5) {
                        this.mapBgCtx.fillStyle = '#e6c875';
                    } else if (bName.includes('Plains') || bName.includes('Vast')) {
                        // Sunflower Field Clusters in Vast Plains
                        const sfCluster = Math.sin(sampleX * 0.0004) * Math.cos(sampleZ * 0.0004);
                        if (sfCluster > 0.15) {
                            this.mapBgCtx.fillStyle = '#e6b800'; // Golden sunflower cluster
                        } else {
                            this.mapBgCtx.fillStyle = '#489c2d'; // Meadow grass
                        }
                    } else if (bName.includes('Jungle')) {
                        this.mapBgCtx.fillStyle = '#1e5e2e'; // Jungle canopy
                    } else if (data.height < 60) {
                        this.mapBgCtx.fillStyle = '#4a8505';
                    } else if (data.height < 150) {
                        this.mapBgCtx.fillStyle = '#2d5402';
                    } else {
                        this.mapBgCtx.fillStyle = '#6e6e6e';
                    }
                    this.mapBgCtx.fillRect(i * pxStep, j * pxStep, pxStep + 0.5, pxStep + 0.5);
                }
            }
        }

        this.mapCtx.clearRect(0, 0, W, H);
        this.mapCtx.drawImage(this.mapBgCanvas, 0, 0);

        // Player marker
        this.mapCtx.fillStyle = '#ff3333';
        this.mapCtx.beginPath();
        this.mapCtx.arc(W / 2, H / 2, 4, 0, Math.PI * 2);
        this.mapCtx.fill();
        this.mapCtx.strokeStyle = '#ffffff';
        this.mapCtx.lineWidth = 1.5;
        this.mapCtx.stroke();
    }
}
