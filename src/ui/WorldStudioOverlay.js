// WorldStudioOverlay.js - Visual Floating Studio for Wanderlust (Option 2)
// Clean plain-text implementation with zero icons/emojis.
// Provides dedicated tabs for Time of Day, Biomes & Fog, and Universal Presets/Backup.

export class WorldStudioOverlay {
    constructor(engineContext) {
        this.ctx = engineContext;
        this.isOpen = false;
        this.activeTab = 'tod'; // 'tod', 'biomes', 'backup'
        this.activeBiome = 'Misty Mountains';
        this.dom = null;
        this.init();
    }

    init() {
        this.createStyles();
        this.createDOM();
        this.bindEvents();
    }

    createStyles() {
        if (document.getElementById('world-studio-style')) return;
        const style = document.createElement('style');
        style.id = 'world-studio-style';
        style.textContent = `
            #world-studio-container {
                position: fixed;
                top: 60px;
                left: 20px;
                width: 440px;
                max-width: calc(100vw - 40px);
                max-height: calc(100vh - 85px);
                background: rgba(15, 23, 42, 0.94);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 12px;
                box-shadow: 0 20px 48px rgba(0, 0, 0, 0.7);
                color: #f8fafc;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                z-index: 1000;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
                user-select: none;
            }
            #world-studio-container.hidden {
                display: none !important;
                opacity: 0;
                transform: scale(0.95) translateY(-10px);
                pointer-events: none;
            }
            .ws-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                background: rgba(30, 41, 59, 0.6);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .ws-title {
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.8px;
                text-transform: uppercase;
                color: #e2e8f0;
            }
            .ws-close-btn {
                background: transparent;
                border: none;
                color: #94a3b8;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: all 0.15s;
            }
            .ws-close-btn:hover {
                color: #fff;
                background: rgba(255, 255, 255, 0.1);
            }
            .ws-nav {
                display: flex;
                background: rgba(15, 23, 42, 0.8);
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                padding: 6px 12px;
                gap: 6px;
            }
            .ws-tab-btn {
                flex: 1;
                background: transparent;
                border: 1px solid transparent;
                border-radius: 6px;
                padding: 6px 10px;
                color: #94a3b8;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s;
                text-align: center;
            }
            .ws-tab-btn:hover {
                color: #e2e8f0;
                background: rgba(255, 255, 255, 0.05);
            }
            .ws-tab-btn.active {
                color: #38bdf8;
                background: rgba(56, 189, 248, 0.12);
                border-color: rgba(56, 189, 248, 0.3);
            }
            .ws-body {
                padding: 14px 16px;
                overflow-y: auto;
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 14px;
            }
            .ws-card {
                background: rgba(30, 41, 59, 0.45);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 8px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .ws-card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
                font-weight: 700;
                color: #cbd5e1;
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                padding-bottom: 6px;
                margin-bottom: 4px;
            }
            .ws-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }
            .ws-label {
                font-size: 11px;
                color: #94a3b8;
                font-weight: 500;
                flex: 1;
            }
            .ws-val {
                font-size: 11px;
                font-family: monospace;
                color: #38bdf8;
                min-width: 38px;
                text-align: right;
            }
            .ws-slider {
                flex: 1.5;
                accent-color: #38bdf8;
                cursor: pointer;
                height: 4px;
            }
            .ws-color {
                width: 32px;
                height: 22px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 4px;
                cursor: pointer;
                background: transparent;
                padding: 0;
            }
            .ws-btn {
                background: rgba(51, 65, 85, 0.7);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 6px;
                padding: 7px 12px;
                color: #e2e8f0;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s;
                text-align: center;
            }
            .ws-btn:hover {
                background: rgba(71, 85, 105, 0.9);
                border-color: rgba(255, 255, 255, 0.3);
                color: #fff;
            }
            .ws-btn-primary {
                background: rgba(2, 132, 199, 0.8);
                border-color: rgba(56, 189, 248, 0.4);
                color: #fff;
            }
            .ws-btn-primary:hover {
                background: rgba(2, 132, 199, 1);
                border-color: rgba(56, 189, 248, 0.8);
            }
            .ws-btn-danger {
                background: rgba(185, 28, 28, 0.6);
                border-color: rgba(239, 68, 68, 0.4);
                color: #fecaca;
            }
            .ws-btn-danger:hover {
                background: rgba(220, 38, 38, 0.85);
                color: #fff;
            }
            .ws-select, .ws-input {
                background: rgba(15, 23, 42, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 6px;
                padding: 6px 10px;
                color: #e2e8f0;
                font-size: 11px;
                outline: none;
                flex: 1;
            }
            .ws-grid-2 {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 6px;
            }
            .ws-grid-3 {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 6px;
            }
            .ws-biome-list {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 4px;
                max-height: 140px;
                overflow-y: auto;
                background: rgba(15, 23, 42, 0.5);
                padding: 6px;
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.06);
            }
            .ws-biome-btn {
                background: transparent;
                border: 1px solid transparent;
                color: #cbd5e1;
                font-size: 11px;
                padding: 5px 8px;
                border-radius: 4px;
                cursor: pointer;
                text-align: left;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                transition: all 0.12s;
            }
            .ws-biome-btn:hover {
                background: rgba(255, 255, 255, 0.08);
                color: #fff;
            }
            .ws-biome-btn.active {
                background: rgba(56, 189, 248, 0.2);
                border-color: rgba(56, 189, 248, 0.4);
                color: #38bdf8;
                font-weight: 600;
            }
        `;
        document.head.appendChild(style);
    }

    createDOM() {
        if (document.getElementById('world-studio-container')) return;
        const container = document.createElement('div');
        container.id = 'world-studio-container';
        container.className = 'hidden';
        container.innerHTML = `
            <div class="ws-header">
                <span class="ws-title">World & Biome Studio</span>
                <button class="ws-close-btn" id="ws-close">Close [Esc]</button>
            </div>
            <div class="ws-nav">
                <button class="ws-tab-btn active" data-tab="tod">Time of Day</button>
                <button class="ws-tab-btn" data-tab="biomes">Biomes & Fog</button>
                <button class="ws-tab-btn" data-tab="backup">Backup & Presets</button>
            </div>
            <div class="ws-body" id="ws-content"></div>
        `;
        document.body.appendChild(container);
        this.dom = container;
        this.renderTab();
    }

    bindEvents() {
        const toggleBtn = document.getElementById('world-studio-toggle-btn');
        if (toggleBtn) {
            toggleBtn.onclick = () => this.toggle();
        }

        const closeBtn = document.getElementById('ws-close');
        if (closeBtn) {
            closeBtn.onclick = () => this.close();
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        const tabBtns = this.dom.querySelectorAll('.ws-tab-btn');
        tabBtns.forEach(btn => {
            btn.onclick = () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeTab = btn.getAttribute('data-tab');
                this.renderTab();
            };
        });
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    open() {
        this.isOpen = true;
        if (this.dom) this.dom.classList.remove('hidden');
        this.renderTab();
    }

    close() {
        this.isOpen = false;
        if (this.dom) this.dom.classList.add('hidden');
    }

    toHex(val, fallback = '#000000') {
        if (val === null || val === undefined) return fallback;
        if (typeof val === 'number') return '#' + Math.floor(val).toString(16).padStart(6, '0');
        if (typeof val === 'string') {
            if (val.startsWith('#')) return val;
            return '#' + val.replace(/^0x/i, '').padStart(6, '0');
        }
        if (val && typeof val.getHexString === 'function') return '#' + val.getHexString();
        return fallback;
    }

    parseHex(val) {
        if (typeof val === 'number') return Math.floor(val);
        if (typeof val === 'string') return parseInt(val.replace(/^[#0x]+/i, ''), 16) || 0;
        return 0;
    }

    renderTab() {
        const content = document.getElementById('ws-content');
        if (!content) return;

        if (this.activeTab === 'tod') {
            this.renderTimeOfDayTab(content);
        } else if (this.activeTab === 'biomes') {
            this.renderBiomesTab(content);
        } else if (this.activeTab === 'backup') {
            this.renderBackupTab(content);
        }
    }

    renderTimeOfDayTab(content) {
        const ctx = this.ctx;
        const currentPhase = ctx.timePhase !== undefined ? ctx.timePhase : 1;
        const envConfigs = ctx.envConfigs || [];
        const params = ctx.params || {};

        const phases = [
            { id: 0, name: 'Day' },
            { id: 1, name: 'Dusk' },
            { id: 2, name: 'Night' }
        ];

        let html = `
            <div class="ws-card">
                <div class="ws-card-header">
                    <span>Active Time Phase</span>
                    <span style="color:#38bdf8; font-size:11px;">Current: ${phases[currentPhase] ? phases[currentPhase].name : 'Custom'}</span>
                </div>
                <div class="ws-grid-3">
        `;

        phases.forEach(p => {
            const isActive = currentPhase === p.id;
            html += `
                <button class="ws-btn ${isActive ? 'ws-btn-primary' : ''}" id="ws-phase-${p.id}">
                    ${isActive ? 'Active: ' + p.name : 'Switch to ' + p.name}
                </button>
            `;
        });

        html += `
                </div>
            </div>
        `;

        const activeEnv = envConfigs[currentPhase] || {};
        const sunAltitude = typeof params.sunAltitude === 'number' ? params.sunAltitude : (activeEnv.sunY || 0);
        const sunAzimuth = typeof params.sunAzimuth === 'number' ? params.sunAzimuth : 0;
        const ambIntensity = typeof activeEnv.ambI === 'number' ? activeEnv.ambI : 1.0;
        const dirIntensity = typeof activeEnv.dirI === 'number' ? activeEnv.dirI : 1.5;
        const exposure = typeof params.exposure === 'number' ? params.exposure : 1.9;

        const zenithHex = this.toHex(activeEnv.bg, '#2a5090');
        const midHex = this.toHex(activeEnv.mid, '#c85078');
        const fogHex = this.toHex(activeEnv.fog, '#ffa07a');
        const ambHex = this.toHex(activeEnv.amb, '#ffdab9');
        const dirHex = this.toHex(activeEnv.dir, '#ffaa00');

        html += `
            <div class="ws-card">
                <div class="ws-card-header">
                    <span>${phases[currentPhase] ? phases[currentPhase].name : 'Phase'} Sky & Atmospheric Colors</span>
                </div>
                <div class="ws-row">
                    <span class="ws-label">Sky Zenith Color</span>
                    <input type="color" class="ws-color" id="ws-col-zenith" value="${zenithHex}">
                </div>
                <div class="ws-row">
                    <span class="ws-label">Sky Mid-Tone Color</span>
                    <input type="color" class="ws-color" id="ws-col-mid" value="${midHex}">
                </div>
                <div class="ws-row">
                    <span class="ws-label">Horizon & Fog Color</span>
                    <input type="color" class="ws-color" id="ws-col-fog" value="${fogHex}">
                </div>
                <div class="ws-row">
                    <span class="ws-label">Ambient Light Color</span>
                    <input type="color" class="ws-color" id="ws-col-amb" value="${ambHex}">
                </div>
                <div class="ws-row">
                    <span class="ws-label">Sunlight / Directional Color</span>
                    <input type="color" class="ws-color" id="ws-col-dir" value="${dirHex}">
                </div>
            </div>

            <div class="ws-card">
                <div class="ws-card-header">
                    <span>${phases[currentPhase] ? phases[currentPhase].name : 'Phase'} Sun & Lighting Intensity</span>
                </div>
                <div class="ws-row">
                    <span class="ws-label">Sun Altitude Height</span>
                    <input type="range" class="ws-slider" id="ws-sl-sunalt" min="-12000" max="15000" step="50" value="${sunAltitude}">
                    <span class="ws-val" id="ws-v-sunalt">${Math.round(sunAltitude)}</span>
                </div>
                <div class="ws-row">
                    <span class="ws-label">Sun Azimuth Angle</span>
                    <input type="range" class="ws-slider" id="ws-sl-sunaz" min="-3.14" max="3.14" step="0.02" value="${sunAzimuth}">
                    <span class="ws-val" id="ws-v-sunaz">${Number(sunAzimuth).toFixed(2)}</span>
                </div>
                <div class="ws-row">
                    <span class="ws-label">Sunlight Intensity</span>
                    <input type="range" class="ws-slider" id="ws-sl-diri" min="0" max="6.0" step="0.1" value="${dirIntensity}">
                    <span class="ws-val" id="ws-v-diri">${Number(dirIntensity).toFixed(1)}</span>
                </div>
                <div class="ws-row">
                    <span class="ws-label">Ambient Light Intensity</span>
                    <input type="range" class="ws-slider" id="ws-sl-ambi" min="0" max="3.0" step="0.05" value="${ambIntensity}">
                    <span class="ws-val" id="ws-v-ambi">${Number(ambIntensity).toFixed(2)}</span>
                </div>
                <div class="ws-row">
                    <span class="ws-label">Scene Global Exposure</span>
                    <input type="range" class="ws-slider" id="ws-sl-exp" min="0.2" max="4.0" step="0.05" value="${exposure}">
                    <span class="ws-val" id="ws-v-exp">${Number(exposure).toFixed(2)}</span>
                </div>
            </div>
        `;

        content.innerHTML = html;

        phases.forEach(p => {
            const btn = document.getElementById(`ws-phase-${p.id}`);
            if (btn) {
                btn.onclick = () => {
                    if (typeof ctx.setTimePhase === 'function') {
                        ctx.setTimePhase(p.id);
                    }
                    this.renderTab();
                };
            }
        });

        const bindColor = (id, targetKey, isEnv = true) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.oninput = (e) => {
                const hexNum = this.parseHex(e.target.value);
                if (isEnv && activeEnv) {
                    activeEnv[targetKey] = hexNum;
                }
                if (typeof ctx.refreshScene === 'function') ctx.refreshScene();
            };
        };
        bindColor('ws-col-zenith', 'bg');
        bindColor('ws-col-mid', 'mid');
        bindColor('ws-col-fog', 'fog');
        bindColor('ws-col-amb', 'amb');
        bindColor('ws-col-dir', 'dir');

        const bindSlider = (id, valId, callback) => {
            const el = document.getElementById(id);
            const valEl = document.getElementById(valId);
            if (!el) return;
            el.oninput = (e) => {
                const val = parseFloat(e.target.value);
                if (valEl) valEl.innerText = Number.isInteger(val) ? val : val.toFixed(2);
                callback(val);
                if (typeof ctx.refreshScene === 'function') ctx.refreshScene();
            };
        };

        bindSlider('ws-sl-sunalt', 'ws-v-sunalt', (v) => {
            params.sunAltitude = v;
            if (activeEnv) activeEnv.sunY = v;
        });
        bindSlider('ws-sl-sunaz', 'ws-v-sunaz', (v) => {
            params.sunAzimuth = v;
        });
        bindSlider('ws-sl-diri', 'ws-v-diri', (v) => {
            if (activeEnv) activeEnv.dirI = v;
        });
        bindSlider('ws-sl-ambi', 'ws-v-ambi', (v) => {
            if (activeEnv) activeEnv.ambI = v;
        });
        bindSlider('ws-sl-exp', 'ws-v-exp', (v) => {
            params.exposure = v;
        });
    }

    renderBiomesTab(content) {
        const ctx = this.ctx;
        const biomeList = [
            'Archipelago',
            'Ghibli Land',
            'Vast Plains',
            'Misty Mountains',
            'Lush Jungle',
            'Crystal Land',
            'Open Ocean',
            'Desert Dunes',
            'Badlands Canyon',
            'North Pole'
        ];

        let html = `
            <div class="ws-card">
                <div class="ws-card-header">
                    <span>Select Biome to Teleport & Fine-Tune</span>
                    <button class="ws-btn ws-btn-primary" id="ws-btn-teleport" style="padding: 3px 8px; font-size:10px;">Teleport to ${this.activeBiome}</button>
                </div>
                <div class="ws-biome-list">
        `;

        biomeList.forEach(b => {
            const isActive = b === this.activeBiome;
            html += `
                <button class="ws-biome-btn ${isActive ? 'active' : ''}" data-biome="${b}">
                    ${b}
                </button>
            `;
        });

        html += `
                </div>
            </div>
        `;

        const biomeFogSettings = window.biomeFogSettings || {};
        const currentFogOffset = (biomeFogSettings[this.activeBiome] !== undefined) ? biomeFogSettings[this.activeBiome] : 0;

        const biomeSkyConfigs = window.BIOME_SKY_CONFIGS || {};
        const currentSky = biomeSkyConfigs[this.activeBiome] || { coverage: 0.4, edge: 0.08, speed: 0.02, skyZenith: 0x4a90d9, skyHorizon: 0xb8d4e8 };

        const zenithHex = this.toHex(currentSky.skyZenith, '#4a90d9');
        const horizonHex = this.toHex(currentSky.skyHorizon, '#b8d4e8');

        html += `
            <div class="ws-card">
                <div class="ws-card-header">
                    <span>${this.activeBiome} Fog & Elevation Fine-Tuning</span>
                </div>
                <div class="ws-row">
                    <span class="ws-label">Ground Fog Elevation Offset</span>
                    <input type="range" class="ws-slider" id="ws-sl-fog-offset" min="-100" max="300" step="2" value="${currentFogOffset}">
                    <span class="ws-val" id="ws-v-fog-offset">${Math.round(currentFogOffset)}m</span>
                </div>
                <div class="ws-row">
                    <span class="ws-label">Fog Horizon Tint</span>
                    <input type="color" class="ws-color" id="ws-col-biome-fog" value="${horizonHex}">
                </div>
                <div class="ws-row">
                    <span class="ws-label">Sky Zenith Tint</span>
                    <input type="color" class="ws-color" id="ws-col-biome-zenith" value="${zenithHex}">
                </div>
            </div>

            <div class="ws-card">
                <div class="ws-card-header">
                    <span>${this.activeBiome} Cloud & Atmosphere Parameters</span>
                </div>
                <div class="ws-row">
                    <span class="ws-label">Cloud Coverage</span>
                    <input type="range" class="ws-slider" id="ws-sl-cloud-cov" min="0.0" max="1.0" step="0.02" value="${currentSky.coverage || 0.4}">
                    <span class="ws-val" id="ws-v-cloud-cov">${Number(currentSky.coverage || 0.4).toFixed(2)}</span>
                </div>
                <div class="ws-row">
                    <span class="ws-label">Cloud Edge Crispness</span>
                    <input type="range" class="ws-slider" id="ws-sl-cloud-edge" min="0.01" max="0.30" step="0.01" value="${currentSky.edge || 0.08}">
                    <span class="ws-val" id="ws-v-cloud-edge">${Number(currentSky.edge || 0.08).toFixed(2)}</span>
                </div>
                <div class="ws-row">
                    <span class="ws-label">Cloud Wind Speed</span>
                    <input type="range" class="ws-slider" id="ws-sl-cloud-spd" min="0.001" max="0.08" step="0.002" value="${currentSky.speed || 0.02}">
                    <span class="ws-val" id="ws-v-cloud-spd">${Number(currentSky.speed || 0.02).toFixed(3)}</span>
                </div>
            </div>
        `;

        content.innerHTML = html;

        const biomeBtns = content.querySelectorAll('.ws-biome-btn');
        biomeBtns.forEach(btn => {
            btn.onclick = () => {
                const bName = btn.getAttribute('data-biome');
                this.activeBiome = bName;
                if (typeof ctx.teleportToBiome === 'function') {
                    ctx.teleportToBiome(bName);
                }
                this.renderTab();
            };
        });

        const teleBtn = document.getElementById('ws-btn-teleport');
        if (teleBtn) {
            teleBtn.onclick = () => {
                if (typeof ctx.teleportToBiome === 'function') {
                    ctx.teleportToBiome(this.activeBiome);
                }
            };
        }

        const fogSl = document.getElementById('ws-sl-fog-offset');
        const fogV = document.getElementById('ws-v-fog-offset');
        if (fogSl) {
            fogSl.oninput = (e) => {
                const v = parseFloat(e.target.value);
                if (fogV) fogV.innerText = Math.round(v) + 'm';
                if (!window.biomeFogSettings) window.biomeFogSettings = {};
                window.biomeFogSettings[this.activeBiome] = v;
                if (typeof ctx.refreshScene === 'function') ctx.refreshScene();
            };
        }

        const bFogCol = document.getElementById('ws-col-biome-fog');
        if (bFogCol) {
            bFogCol.oninput = (e) => {
                const hexNum = this.parseHex(e.target.value);
                if (!window.BIOME_SKY_CONFIGS) window.BIOME_SKY_CONFIGS = {};
                if (!window.BIOME_SKY_CONFIGS[this.activeBiome]) window.BIOME_SKY_CONFIGS[this.activeBiome] = {};
                window.BIOME_SKY_CONFIGS[this.activeBiome].skyHorizon = hexNum;
                if (typeof ctx.refreshScene === 'function') ctx.refreshScene();
            };
        }

        const bZenCol = document.getElementById('ws-col-biome-zenith');
        if (bZenCol) {
            bZenCol.oninput = (e) => {
                const hexNum = this.parseHex(e.target.value);
                if (!window.BIOME_SKY_CONFIGS) window.BIOME_SKY_CONFIGS = {};
                if (!window.BIOME_SKY_CONFIGS[this.activeBiome]) window.BIOME_SKY_CONFIGS[this.activeBiome] = {};
                window.BIOME_SKY_CONFIGS[this.activeBiome].skyZenith = hexNum;
                if (typeof ctx.refreshScene === 'function') ctx.refreshScene();
            };
        }

        const bindBiomeSlider = (id, valId, key) => {
            const el = document.getElementById(id);
            const vEl = document.getElementById(valId);
            if (!el) return;
            el.oninput = (e) => {
                const v = parseFloat(e.target.value);
                if (vEl) vEl.innerText = Number.isInteger(v) ? v : v.toFixed(3);
                if (!window.BIOME_SKY_CONFIGS) window.BIOME_SKY_CONFIGS = {};
                if (!window.BIOME_SKY_CONFIGS[this.activeBiome]) window.BIOME_SKY_CONFIGS[this.activeBiome] = {};
                window.BIOME_SKY_CONFIGS[this.activeBiome][key] = v;
                if (typeof ctx.refreshScene === 'function') ctx.refreshScene();
            };
        };

        bindBiomeSlider('ws-sl-cloud-cov', 'ws-v-cloud-cov', 'coverage');
        bindBiomeSlider('ws-sl-cloud-edge', 'ws-v-cloud-edge', 'edge');
        bindBiomeSlider('ws-sl-cloud-spd', 'ws-v-cloud-spd', 'speed');
    }

    renderBackupTab(content) {
        const ctx = this.ctx;
        const savedPresets = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
        const presetKeys = Object.keys(savedPresets);

        let html = `
            <div class="ws-card">
                <div class="ws-card-header">
                    <span>1-Click Universal Full Backup</span>
                </div>
                <div style="font-size:11px; color:#94a3b8; line-height:1.4;">
                    Exports all Times of Day (Day, Dusk, Night), all Biome fog heights, lighting, clouds, and flight parameters into one single backup JSON file.
                </div>
                <div class="ws-grid-2">
                    <button class="ws-btn ws-btn-primary" id="ws-btn-export-download">Download Backup File (.json)</button>
                    <button class="ws-btn" id="ws-btn-export-copy">Copy Backup JSON to Clipboard</button>
                </div>
                <div class="ws-grid-2">
                    <button class="ws-btn" id="ws-btn-import-file">Restore Backup from File</button>
                    <button class="ws-btn" id="ws-btn-import-paste">Paste Restore JSON</button>
                </div>
            </div>

            <div class="ws-card">
                <div class="ws-card-header">
                    <span>Saved Presets & Profiles</span>
                </div>
                <div class="ws-row">
                    <input type="text" class="ws-input" id="ws-preset-name" placeholder="New Preset Name" value="Custom Look ${new Date().toLocaleTimeString()}">
                    <button class="ws-btn ws-btn-primary" id="ws-btn-save-preset">Save Current</button>
                </div>
                <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Existing Presets:</div>
                <div style="display:flex; flex-direction:column; gap:4px; max-height:120px; overflow-y:auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(15,23,42,0.4); padding:4px 8px; border-radius:4px;">
                        <span style="font-size:11px; color:#cbd5e1;">Golden Hour Dusk (Default)</span>
                        <button class="ws-btn" style="padding:2px 8px; font-size:10px;" id="ws-load-default">Load</button>
                    </div>
        `;

        presetKeys.forEach(name => {
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(15,23,42,0.4); padding:4px 8px; border-radius:4px;">
                    <span style="font-size:11px; color:#cbd5e1;">${name}</span>
                    <div style="display:flex; gap:4px;">
                        <button class="ws-btn ws-btn-load" style="padding:2px 8px; font-size:10px;" data-preset="${name}">Load</button>
                        <button class="ws-btn ws-btn-danger ws-btn-del" style="padding:2px 6px; font-size:10px;" data-preset="${name}">Delete</button>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        content.innerHTML = html;

        const expDl = document.getElementById('ws-btn-export-download');
        if (expDl) {
            expDl.onclick = () => {
                const data = this.buildFullBackupData();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `wanderlust_full_backup_${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showToast('Full Backup Downloaded');
            };
        }

        const expCp = document.getElementById('ws-btn-export-copy');
        if (expCp) {
            expCp.onclick = () => {
                const data = this.buildFullBackupData();
                const jsonStr = JSON.stringify(data, null, 2);
                navigator.clipboard.writeText(jsonStr).then(() => {
                    this.showToast('Full Backup copied to clipboard');
                }).catch(() => {
                    prompt('Copy Backup JSON:', jsonStr);
                });
            };
        }

        const impPaste = document.getElementById('ws-btn-import-paste');
        if (impPaste) {
            impPaste.onclick = () => {
                const input = prompt('Paste Wanderlust Backup JSON:');
                if (input) {
                    this.restoreFullBackupData(input);
                }
            };
        }

        const impFile = document.getElementById('ws-btn-import-file');
        if (impFile) {
            impFile.onclick = () => {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.json,application/json';
                fileInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            this.restoreFullBackupData(evt.target.result);
                        };
                        reader.readAsText(file);
                    }
                };
                fileInput.click();
            };
        }

        const saveBtn = document.getElementById('ws-btn-save-preset');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const nameInput = document.getElementById('ws-preset-name');
                const name = nameInput ? nameInput.value.trim() : `Look ${Date.now()}`;
                if (ctx.settingsManager && typeof ctx.settingsManager.saveSetting === 'function') {
                    ctx.settingsManager.saveSetting(name);
                    this.showToast(`Preset Saved: ${name}`);
                    this.renderTab();
                }
            };
        }

        const defLoad = document.getElementById('ws-load-default');
        if (defLoad) {
            defLoad.onclick = () => {
                if (ctx.settingsManager && typeof ctx.settingsManager.loadSetting === 'function') {
                    ctx.settingsManager.loadSetting('Golden Hour Dusk (Default)');
                    this.showToast('Loaded Default Golden Dusk');
                    this.renderTab();
                }
            };
        }

        content.querySelectorAll('.ws-btn-load').forEach(btn => {
            btn.onclick = () => {
                const name = btn.getAttribute('data-preset');
                if (ctx.settingsManager && typeof ctx.settingsManager.loadSetting === 'function') {
                    ctx.settingsManager.loadSetting(name);
                    this.showToast(`Loaded: ${name}`);
                    this.renderTab();
                }
            };
        });

        content.querySelectorAll('.ws-btn-del').forEach(btn => {
            btn.onclick = () => {
                const name = btn.getAttribute('data-preset');
                const cur = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
                if (cur[name]) {
                    delete cur[name];
                    localStorage.setItem('wl_custom_presets', JSON.stringify(cur));
                    this.showToast(`Deleted: ${name}`);
                    this.renderTab();
                }
            };
        });
    }

    buildFullBackupData() {
        const ctx = this.ctx;
        return {
            wanderlust_version: '2.0',
            timestamp: new Date().toISOString(),
            timePhase: ctx.timePhase !== undefined ? ctx.timePhase : 1,
            envConfigs: ctx.envConfigs || [],
            params: ctx.params || {},
            cloudParams: ctx.cloudParams || {},
            biomeFogSettings: window.biomeFogSettings || {},
            biomeSkyConfigs: window.BIOME_SKY_CONFIGS || {},
            customPresets: JSON.parse(localStorage.getItem('wl_custom_presets') || '{}')
        };
    }

    restoreFullBackupData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            const ctx = this.ctx;

            if (data.envConfigs && Array.isArray(data.envConfigs) && ctx.envConfigs) {
                for (let i = 0; i < data.envConfigs.length; i++) {
                    if (ctx.envConfigs[i]) Object.assign(ctx.envConfigs[i], data.envConfigs[i]);
                }
            }
            if (data.params && ctx.params) {
                Object.assign(ctx.params, data.params);
            }
            if (data.cloudParams && ctx.cloudParams) {
                Object.assign(ctx.cloudParams, data.cloudParams);
            }
            if (data.biomeFogSettings) {
                window.biomeFogSettings = Object.assign({}, window.biomeFogSettings || {}, data.biomeFogSettings);
            }
            if (data.biomeSkyConfigs) {
                window.BIOME_SKY_CONFIGS = Object.assign({}, window.BIOME_SKY_CONFIGS || {}, data.biomeSkyConfigs);
            }
            if (data.customPresets) {
                localStorage.setItem('wl_custom_presets', JSON.stringify(data.customPresets));
            }
            if (data.timePhase !== undefined && typeof ctx.setTimePhase === 'function') {
                ctx.setTimePhase(data.timePhase);
            }

            if (typeof ctx.refreshScene === 'function') ctx.refreshScene();
            this.showToast('Universal Backup Restored Successfully');
            this.renderTab();
        } catch (e) {
            alert('Invalid JSON Backup: ' + e.message);
        }
    }

    showToast(msg) {
        let toast = document.getElementById('ws-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'ws-toast';
            toast.style.cssText = 'position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.95); color:#fff; padding:8px 18px; border-radius:20px; font-family:sans-serif; font-size:13px; z-index:99999; pointer-events:none; border:1px solid rgba(255,255,255,0.2); transition:opacity 0.3s ease; box-shadow:0 10px 25px rgba(0,0,0,0.5);';
            document.body.appendChild(toast);
        }
        toast.innerText = msg;
        toast.style.opacity = '1';
        clearTimeout(toast._t);
        toast._t = setTimeout(() => {
            if (toast) toast.style.opacity = '0';
        }, 2200);
    }
}
