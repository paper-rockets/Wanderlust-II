// OffscreenBridge.js - Main-thread bridge for OffscreenCanvas and Web Worker event forwarding.

export class OffscreenBridge {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.worker = null;
        this.isSupported = Boolean(
            typeof HTMLCanvasElement !== 'undefined' &&
            typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function' &&
            typeof Worker !== 'undefined'
        );
    }

    /**
     * Initializes the OffscreenCanvas worker and attaches DOM input listeners.
     */
    init() {
        if (!this.isSupported) {
            console.warn('[OffscreenBridge] OffscreenCanvas is not supported in this browser environment.');
            return false;
        }

        try {
            const offscreen = this.canvas.transferControlToOffscreen();
            this.worker = new Worker(new URL('./workers/renderWorker.js', import.meta.url), { type: 'module' });

            this.worker.postMessage(
                {
                    type: 'init',
                    canvas: offscreen,
                    width: window.innerWidth,
                    height: window.innerHeight,
                    pixelRatio: Math.min(window.devicePixelRatio, 2)
                },
                [offscreen]
            );

            this._bindEvents();
            return true;
        } catch (err) {
            console.error('[OffscreenBridge] Initialization failed:', err);
            return false;
        }
    }

    _bindEvents() {
        window.addEventListener('resize', () => {
            if (!this.worker) return;
            this.worker.postMessage({
                type: 'resize',
                width: window.innerWidth,
                height: window.innerHeight,
                pixelRatio: Math.min(window.devicePixelRatio, 2)
            });
        });

        // Event proxying for pointer/keyboard events
        const forwardInput = (type, payload) => {
            if (!this.worker) return;
            this.worker.postMessage({
                type: 'input',
                inputType: type,
                payload
            });
        };

        window.addEventListener('keydown', (e) => {
            forwardInput('keydown', { key: e.key, code: e.code });
        });

        window.addEventListener('keyup', (e) => {
            forwardInput('keyup', { key: e.key, code: e.code });
        });
    }

    dispose() {
        if (this.worker) {
            this.worker.postMessage({ type: 'stop' });
            this.worker.terminate();
            this.worker = null;
        }
    }
}
