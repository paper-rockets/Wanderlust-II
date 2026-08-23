// Lil-GUI Debug & Settings Configuration Interface

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

export class SettingsGUIWrapper {
    constructor(params, callbacks = {}) {
        this.params = params;
        this.callbacks = callbacks;
        this.gui = new GUI({ title: '⚙️ Settings' });
        this.init();
    }

    init() {
        if (!this.gui) return;

        // Graphics Quality Folder
        const gfxFolder = this.gui.addFolder('⚡ Quality');
        gfxFolder.add(this.params, 'gfxPreset', ['regular', 'low'])
            .name('Mode')
            .onChange((val) => {
                if (this.callbacks.onGfxChange) this.callbacks.onGfxChange(val);
            });
            
        gfxFolder.add(this.params, 'toonShading')
            .name('Toon Shading')
            .onChange((val) => {
                if (this.callbacks.onToggleToon) this.callbacks.onToggleToon(val);
            });

        // Atmosphere & Environment Folder
        const envFolder = this.gui.addFolder('🌤️ Atmosphere');
        envFolder.add(this.params, 'timeOfDay', 0, 24, 0.1).name('Time of Day').onChange((v) => {
            if (this.callbacks.onTimeChange) this.callbacks.onTimeChange(v);
        });

        // Debug Overlay & Minimap Controls
        const debugFolder = this.gui.addFolder('🛠️ Debug');
        debugFolder.add(this.params, 'showMap').name('Show MiniMap').onChange((v) => {
            if (this.callbacks.onToggleMap) this.callbacks.onToggleMap(v);
        });
    }

    destroy() {
        if (this.gui) {
            this.gui.destroy();
        }
    }
}
