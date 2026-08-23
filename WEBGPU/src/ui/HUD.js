// HUD Management (FPS Counter, Biome Labels, Time Display, Debug Overlay)

export class HUDManager {
    constructor() {
        this.fpsElem = document.getElementById('fps-counter');
        this.biomeElem = document.getElementById('biome-label');
        this.timeElem = document.getElementById('time-label');
        this.debugOverlay = document.getElementById('debug-overlay');
    }

    updateFPS(fps) {
        if (this.fpsElem) {
            this.fpsElem.textContent = `FPS ${Math.round(fps)}`;
        }
    }

    updateBiome(biomeName) {
        if (this.biomeElem) {
            this.biomeElem.textContent = biomeName;
        }
    }

    updateTime(timeString) {
        if (this.timeElem) {
            this.timeElem.textContent = timeString;
        }
    }

    showError(msg) {
        if (this.debugOverlay) {
            this.debugOverlay.style.display = 'block';
            this.debugOverlay.innerHTML += msg + '<br><br>';
        }
    }
}
