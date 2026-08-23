// GroundFogEditor.js - Per-Biome Linked Volumetric Ground Fog & Atmospheric Fog Editor
// Clean plain-text UI with full per-biome persistence, live lerping, and presets.

export const DEFAULT_BIOME_FOG_CONFIGS = {
    'Archipelago': {
        enabled: true,
        intensity: 0.85,
        opacity: 0.75,
        heightOffset: 0,
        layerSpacing: 16,
        driftSpeed: 1.0,
        turbulence: 1.0,
        nearFade: 10,
        farFade: 1750,
        color: '#dbeafe',
        colorDusk: '#fed7aa',
        colorNight: '#1e293b'
    },
    'Ghibli Land': {
        enabled: true,
        intensity: 0.90,
        opacity: 0.80,
        heightOffset: -4,
        layerSpacing: 14,
        driftSpeed: 0.8,
        turbulence: 0.9,
        nearFade: 8,
        farFade: 1600,
        color: '#fef3c7',
        colorDusk: '#fbcfe8',
        colorNight: '#312e81'
    },
    'Vast Plains': {
        enabled: true,
        intensity: 0.70,
        opacity: 0.65,
        heightOffset: -6,
        layerSpacing: 12,
        driftSpeed: 1.2,
        turbulence: 0.8,
        nearFade: 12,
        farFade: 1900,
        color: '#fef9c3',
        colorDusk: '#fed7aa',
        colorNight: '#1e1b4b'
    },
    'Misty Mountains': {
        enabled: true,
        intensity: 1.80,
        opacity: 0.95,
        heightOffset: 25,
        layerSpacing: 28,
        driftSpeed: 1.4,
        turbulence: 1.6,
        nearFade: 5,
        farFade: 2200,
        color: '#e2e8f0',
        colorDusk: '#cbd5e1',
        colorNight: '#0f172a'
    },
    'Lush Jungle': {
        enabled: true,
        intensity: 1.40,
        opacity: 0.90,
        heightOffset: -8,
        layerSpacing: 10,
        driftSpeed: 0.5,
        turbulence: 1.2,
        nearFade: 6,
        farFade: 1400,
        color: '#bbf7d0',
        colorDusk: '#fde047',
        colorNight: '#064e3b'
    },
    'Crystal Land': {
        enabled: true,
        intensity: 1.10,
        opacity: 0.85,
        heightOffset: 8,
        layerSpacing: 22,
        driftSpeed: 1.8,
        turbulence: 2.2,
        nearFade: 15,
        farFade: 1800,
        color: '#f3e8ff',
        colorDusk: '#e9d5ff',
        colorNight: '#3b0764'
    },
    'Open Ocean': {
        enabled: true,
        intensity: 0.60,
        opacity: 0.55,
        heightOffset: -2,
        layerSpacing: 18,
        driftSpeed: 1.1,
        turbulence: 0.7,
        nearFade: 15,
        farFade: 2000,
        color: '#cffafe',
        colorDusk: '#fdba74',
        colorNight: '#082f49'
    },
    'Desert Dunes': {
        enabled: true,
        intensity: 0.45,
        opacity: 0.45,
        heightOffset: -5,
        layerSpacing: 24,
        driftSpeed: 2.5,
        turbulence: 2.5,
        nearFade: 25,
        farFade: 1500,
        color: '#fef08a',
        colorDusk: '#fb923c',
        colorNight: '#451a03'
    },
    'Badlands Canyon': {
        enabled: true,
        intensity: 0.65,
        opacity: 0.60,
        heightOffset: -12,
        layerSpacing: 20,
        driftSpeed: 1.0,
        turbulence: 1.4,
        nearFade: 10,
        farFade: 1650,
        color: '#fed7aa',
        colorDusk: '#ea580c',
        colorNight: '#292524'
    },
    'North Pole': {
        enabled: true,
        intensity: 1.60,
        opacity: 0.90,
        heightOffset: 12,
        layerSpacing: 20,
        driftSpeed: 2.0,
        turbulence: 1.8,
        nearFade: 4,
        farFade: 2100,
        color: '#f0f9ff',
        colorDusk: '#e0f2fe',
        colorNight: '#0c4a6e'
    }
};

export const BIOME_NAMES = Object.keys(DEFAULT_BIOME_FOG_CONFIGS);

export function cleanBiomeName(rawName) {
    if (!rawName) return 'Archipelago';
    for (const b of BIOME_NAMES) {
        if (rawName.includes(b)) return b;
    }
    return rawName.replace(/[^\w\s]/gi, '').trim() || 'Archipelago';
}

export class GroundFogEditor {
    constructor() {
        this.isMinimized = false;
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.el = null;
        this.visible = false;
        this.followPlayerBiome = true;
        this.selectedBiome = 'Archipelago';

        // Load saved configs or clone defaults
        this.biomeConfigs = this.loadSavedConfigs();

        // Active runtime lerped state
        this.runtimeState = { ...this.biomeConfigs[this.selectedBiome] };

        // Presets library
        this.stylePresets = {
            'Default':        { intensity: 0.80, opacity: 0.80, heightOffset: 0,  layerSpacing: 15, driftSpeed: 1.0, turbulence: 1.0, nearFade: 10, farFade: 1700, color: '#ffffff' },
            'Morning Mist':   { intensity: 0.50, opacity: 0.90, heightOffset: -5, layerSpacing: 10, driftSpeed: 0.5, turbulence: 0.8, nearFade: 5,  farFade: 1400, color: '#fff5e6' },
            'Deep Forest':    { intensity: 1.30, opacity: 0.85, heightOffset: -10,layerSpacing: 8,  driftSpeed: 0.3, turbulence: 1.5, nearFade: 5,  farFade: 1000, color: '#c8e6c9' },
            'Ethereal Wisps': { intensity: 0.40, opacity: 0.60, heightOffset: 10, layerSpacing: 25, driftSpeed: 2.0, turbulence: 2.5, nearFade: 20, farFade: 1600, color: '#e8d5f5' },
            'Alpine Cloud':   { intensity: 1.00, opacity: 0.95, heightOffset: 18, layerSpacing: 20, driftSpeed: 1.5, turbulence: 1.2, nearFade: 15, farFade: 1800, color: '#e0f0ff' },
            'Desert Mirage':  { intensity: 0.30, opacity: 0.40, heightOffset: -3, layerSpacing: 30, driftSpeed: 3.0, turbulence: 3.0, nearFade: 30, farFade: 1200, color: '#ffe4b5' },
            'Midnight Gloom': { intensity: 1.50, opacity: 0.70, heightOffset: -8, layerSpacing: 12, driftSpeed: 0.4, turbulence: 0.6, nearFade: 5,  farFade: 1500, color: '#7b8fa1' },
        };

        this.build();
    }

    loadSavedConfigs() {
        try {
            const raw = localStorage.getItem('wl_biome_fog_configs_v1');
            if (raw) {
                const parsed = JSON.parse(raw);
                const merged = {};
                for (const b of BIOME_NAMES) {
                    merged[b] = Object.assign({}, DEFAULT_BIOME_FOG_CONFIGS[b], parsed[b] || {});
                }
                return merged;
            }
        } catch (e) {
            console.warn('[FogEditor] Error reading saved configs', e);
        }
        const initial = {};
        for (const b of BIOME_NAMES) {
            initial[b] = { ...DEFAULT_BIOME_FOG_CONFIGS[b] };
        }
        return initial;
    }

    saveConfigsToStorage() {
        try {
            localStorage.setItem('wl_biome_fog_configs_v1', JSON.stringify(this.biomeConfigs));
        } catch (e) {
            console.warn('[FogEditor] Error saving configs', e);
        }
    }

    build() {
        const el = document.createElement('div');
        el.id = 'ground-fog-editor';
        el.innerHTML = `
<style>
#ground-fog-editor {
    position: fixed; right: 20px; top: 100px; width: 310px; z-index: 120;
    background: rgba(12, 14, 20, 0.88); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 12px;
    color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 11px; box-shadow: 0 16px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08);
    display: none; user-select: none; overflow: hidden;
}
#ground-fog-editor * { box-sizing: border-box; }
#gfe-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px; cursor: grab; border-bottom: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
}
#gfe-header:active { cursor: grabbing; }
#gfe-title { font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #93c5fd; }
#gfe-header-btns { display: flex; gap: 6px; }
#gfe-header-btns button {
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; font-size: 11px;
    width: 24px; height: 24px; border-radius: 5px; cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
}
#gfe-header-btns button:hover { background: rgba(255,255,255,0.2); color: #fff; }
#gfe-body { padding: 12px 14px 14px; max-height: 80vh; overflow-y: auto; }
#gfe-body.minimized { display: none; }

.gfe-biome-bar {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; padding: 8px 10px; margin-bottom: 12px;
}
.gfe-biome-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.gfe-biome-select {
    flex: 1; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px;
    color: #38bdf8; font-size: 11px; font-weight: 600; padding: 5px 8px; cursor: pointer; outline: none;
}
.gfe-follow-row { display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #94a3b8; }

.gfe-section { margin-bottom: 12px; }
.gfe-section-title {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;
    margin-bottom: 6px; font-weight: 700;
}
.gfe-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px; }
.gfe-row label { flex: 0 0 80px; white-space: nowrap; color: #cbd5e1; font-size: 11px; }
.gfe-row input[type="range"] { flex: 1; height: 4px; accent-color: #38bdf8; cursor: pointer; }
.gfe-row .gfe-val { width: 44px; text-align: right; font-size: 10px; color: #94a3b8; font-variant-numeric: tabular-nums; font-weight: 600; }

.gfe-toggle-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.gfe-toggle {
    position: relative; width: 34px; height: 18px; border-radius: 9px; cursor: pointer;
    background: rgba(255,255,255,0.15); transition: background 0.2s;
}
.gfe-toggle.on { background: #0284c7; box-shadow: 0 0 10px rgba(2,132,199,0.5); }
.gfe-toggle-knob {
    position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%;
    background: #fff; transition: transform 0.2s;
}
.gfe-toggle.on .gfe-toggle-knob { transform: translateX(16px); }

.gfe-color-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 8px; }
.gfe-color-item { background: rgba(255,255,255,0.04); padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); text-align: center; }
.gfe-color-item span { display: block; font-size: 9px; color: #94a3b8; margin-bottom: 4px; text-transform: uppercase; font-weight: 600; }
.gfe-color-input {
    width: 100%; height: 22px; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
    cursor: pointer; background: transparent; padding: 0;
}
.gfe-color-input::-webkit-color-swatch-wrapper { padding: 1px; }
.gfe-color-input::-webkit-color-swatch { border-radius: 3px; border: none; }

.gfe-presets { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.gfe-preset-btn {
    padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04); color: #cbd5e1; font-size: 10px; cursor: pointer;
    transition: all 0.15s; white-space: nowrap;
}
.gfe-preset-btn:hover { background: rgba(56,189,248,0.2); border-color: rgba(56,189,248,0.4); color: #fff; }

.gfe-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
.gfe-actions button {
    padding: 6px 0; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06); color: #cbd5e1; font-size: 10px; cursor: pointer;
    transition: all 0.15s; font-weight: 600; text-align: center;
}
.gfe-actions button:hover { background: rgba(56,189,248,0.25); color: #fff; border-color: rgba(56,189,248,0.5); }
.gfe-actions button.btn-danger { color: #f87171; border-color: rgba(248,113,113,0.2); }
.gfe-actions button.btn-danger:hover { background: rgba(248,113,113,0.2); color: #fff; }

.gfe-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 10px 0; }
</style>

<div id="gfe-header">
    <div id="gfe-title">Biome Fog Editor</div>
    <div id="gfe-header-btns">
        <button id="gfe-minimize" title="Minimize">_</button>
        <button id="gfe-close" title="Close">X</button>
    </div>
</div>
<div id="gfe-body">
    <div class="gfe-biome-bar">
        <div class="gfe-biome-row">
            <label style="font-weight:600; color:#e2e8f0;">Biome:</label>
            <select class="gfe-biome-select" id="gfe-biome-select"></select>
        </div>
        <div class="gfe-follow-row">
            <span>Auto-Track Player Biome</span>
            <div class="gfe-toggle on" id="gfe-follow-toggle"><div class="gfe-toggle-knob"></div></div>
        </div>
    </div>

    <div class="gfe-section">
        <div class="gfe-toggle-row">
            <span style="font-weight:600; font-size:11px;">Fog Enabled in Biome</span>
            <div class="gfe-toggle on" id="gfe-enable"><div class="gfe-toggle-knob"></div></div>
        </div>
    </div>

    <div class="gfe-section">
        <div class="gfe-section-title">Fog Density and Opacity</div>
        <div class="gfe-row"><label>Intensity</label><input type="range" id="gfe-intensity" min="0.10" max="5.00" step="0.05" value="0.80"><span class="gfe-val" id="gfe-intensity-val">0.80</span></div>
        <div class="gfe-row"><label>Opacity</label><input type="range" id="gfe-opacity" min="0.00" max="1.00" step="0.02" value="0.80"><span class="gfe-val" id="gfe-opacity-val">0.80</span></div>
    </div>

    <div class="gfe-section">
        <div class="gfe-section-title">Color Tints (Time of Day)</div>
        <div class="gfe-color-grid">
            <div class="gfe-color-item">
                <span>Day</span>
                <input type="color" class="gfe-color-input" id="gfe-color-day" value="#ffffff">
            </div>
            <div class="gfe-color-item">
                <span>Dusk</span>
                <input type="color" class="gfe-color-input" id="gfe-color-dusk" value="#fed7aa">
            </div>
            <div class="gfe-color-item">
                <span>Night</span>
                <input type="color" class="gfe-color-input" id="gfe-color-night" value="#1e293b">
            </div>
        </div>
    </div>

    <div class="gfe-divider"></div>

    <div class="gfe-section">
        <div class="gfe-section-title">Altitude and Dynamics</div>
        <div class="gfe-row"><label>Height Y</label><input type="range" id="gfe-height" min="-50" max="80" step="1" value="0"><span class="gfe-val" id="gfe-height-val">0m</span></div>
        <div class="gfe-row"><label>Layer Gap</label><input type="range" id="gfe-spacing" min="2" max="50" step="1" value="15"><span class="gfe-val" id="gfe-spacing-val">15m</span></div>
        <div class="gfe-row"><label>Drift Speed</label><input type="range" id="gfe-drift" min="0.0" max="5.0" step="0.1" value="1.0"><span class="gfe-val" id="gfe-drift-val">1.0x</span></div>
        <div class="gfe-row"><label>Turbulence</label><input type="range" id="gfe-turbulence" min="0.2" max="4.0" step="0.1" value="1.0"><span class="gfe-val" id="gfe-turbulence-val">1.0x</span></div>
        <div class="gfe-row"><label>Near Fade</label><input type="range" id="gfe-near" min="1" max="100" step="1" value="10"><span class="gfe-val" id="gfe-near-val">10</span></div>
        <div class="gfe-row"><label>Far Fade</label><input type="range" id="gfe-far" min="500" max="3000" step="50" value="1700"><span class="gfe-val" id="gfe-far-val">1700</span></div>
    </div>

    <div class="gfe-divider"></div>

    <div class="gfe-section">
        <div class="gfe-section-title">Quick Presets</div>
        <div class="gfe-presets" id="gfe-presets"></div>
    </div>

    <div class="gfe-actions">
        <button id="gfe-reset-biome" class="btn-danger" title="Reset this biome to factory default">Reset Biome</button>
        <button id="gfe-save-all" title="Save all biome configs">Save Configs</button>
        <button id="gfe-copy-json" title="Copy all biome JSON to clipboard">Copy JSON</button>
        <button id="gfe-apply-all" title="Apply current settings to all biomes">Copy To All</button>
    </div>
</div>`;
        document.body.appendChild(el);
        this.el = el;

        this.populateBiomeDropdown();
        this.buildPresetButtons();
        this.bindEvents();
    }

    populateBiomeDropdown() {
        const select = document.getElementById('gfe-biome-select');
        select.innerHTML = '';
        BIOME_NAMES.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            select.appendChild(opt);
        });
        select.value = this.selectedBiome;
    }

    buildPresetButtons() {
        const container = document.getElementById('gfe-presets');
        container.innerHTML = '';
        Object.keys(this.stylePresets).forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'gfe-preset-btn';
            btn.textContent = name;
            btn.addEventListener('click', () => this.applyStylePreset(name));
            container.appendChild(btn);
        });
    }

    getCurrentConfig() {
        if (!this.biomeConfigs[this.selectedBiome]) {
            this.biomeConfigs[this.selectedBiome] = { ...DEFAULT_BIOME_FOG_CONFIGS['Archipelago'] };
        }
        return this.biomeConfigs[this.selectedBiome];
    }

    bindEvents() {
        const $ = (id) => document.getElementById(id);

        // Biome Selector change
        $('gfe-biome-select').addEventListener('change', (e) => {
            this.selectedBiome = e.target.value;
            this.syncUI();
            this.applyToScene(true);
        });

        // Auto-Track Toggle
        $('gfe-follow-toggle').addEventListener('click', () => {
            this.followPlayerBiome = !this.followPlayerBiome;
            $('gfe-follow-toggle').classList.toggle('on', this.followPlayerBiome);
        });

        // Enable Toggle
        $('gfe-enable').addEventListener('click', () => {
            const cfg = this.getCurrentConfig();
            cfg.enabled = !cfg.enabled;
            $('gfe-enable').classList.toggle('on', cfg.enabled);
            this.saveConfigsToStorage();
            this.applyToScene(true);
        });

        // Sliders
        const sliders = [
            { id: 'gfe-intensity',   key: 'intensity',    valId: 'gfe-intensity-val',   fmt: v => parseFloat(v).toFixed(2) },
            { id: 'gfe-opacity',     key: 'opacity',      valId: 'gfe-opacity-val',     fmt: v => parseFloat(v).toFixed(2) },
            { id: 'gfe-height',      key: 'heightOffset', valId: 'gfe-height-val',      fmt: v => `${v}m` },
            { id: 'gfe-spacing',     key: 'layerSpacing', valId: 'gfe-spacing-val',     fmt: v => `${v}m` },
            { id: 'gfe-drift',       key: 'driftSpeed',   valId: 'gfe-drift-val',       fmt: v => `${parseFloat(v).toFixed(1)}x` },
            { id: 'gfe-turbulence',  key: 'turbulence',   valId: 'gfe-turbulence-val',  fmt: v => `${parseFloat(v).toFixed(1)}x` },
            { id: 'gfe-near',        key: 'nearFade',     valId: 'gfe-near-val',        fmt: v => v },
            { id: 'gfe-far',         key: 'farFade',      valId: 'gfe-far-val',         fmt: v => v },
        ];

        sliders.forEach(s => {
            const input = $(s.id);
            const valEl = $(s.valId);
            input.addEventListener('input', () => {
                const v = parseFloat(input.value);
                const cfg = this.getCurrentConfig();
                cfg[s.key] = v;
                valEl.textContent = s.fmt(input.value);
                this.saveConfigsToStorage();
                this.applyToScene(false);
            });
        });

        // Colors
        $('gfe-color-day').addEventListener('input', (e) => {
            this.getCurrentConfig().color = e.target.value;
            this.saveConfigsToStorage();
            this.applyToScene(false);
        });
        $('gfe-color-dusk').addEventListener('input', (e) => {
            this.getCurrentConfig().colorDusk = e.target.value;
            this.saveConfigsToStorage();
            this.applyToScene(false);
        });
        $('gfe-color-night').addEventListener('input', (e) => {
            this.getCurrentConfig().colorNight = e.target.value;
            this.saveConfigsToStorage();
            this.applyToScene(false);
        });

        // Actions
        $('gfe-reset-biome').addEventListener('click', () => {
            this.biomeConfigs[this.selectedBiome] = { ...DEFAULT_BIOME_FOG_CONFIGS[this.selectedBiome] };
            this.saveConfigsToStorage();
            this.syncUI();
            this.applyToScene(true);
            const btn = $('gfe-reset-biome');
            btn.textContent = 'Reset Done';
            setTimeout(() => { btn.textContent = 'Reset Biome'; }, 1500);
        });

        $('gfe-save-all').addEventListener('click', () => {
            this.saveConfigsToStorage();
            const btn = $('gfe-save-all');
            btn.textContent = 'Saved';
            setTimeout(() => { btn.textContent = 'Save Configs'; }, 1500);
        });

        $('gfe-copy-json').addEventListener('click', () => {
            const json = JSON.stringify(this.biomeConfigs, null, 2);
            navigator.clipboard.writeText(json).then(() => {
                const btn = $('gfe-copy-json');
                btn.textContent = 'Copied';
                setTimeout(() => { btn.textContent = 'Copy JSON'; }, 1500);
            });
        });

        $('gfe-apply-all').addEventListener('click', () => {
            const cur = { ...this.getCurrentConfig() };
            BIOME_NAMES.forEach(b => {
                this.biomeConfigs[b] = { ...cur };
            });
            this.saveConfigsToStorage();
            const btn = $('gfe-apply-all');
            btn.textContent = 'Applied';
            setTimeout(() => { btn.textContent = 'Copy To All'; }, 1500);
        });

        // Header window controls
        $('gfe-close').addEventListener('click', () => this.toggle(false));
        $('gfe-minimize').addEventListener('click', () => {
            this.isMinimized = !this.isMinimized;
            $('gfe-body').classList.toggle('minimized', this.isMinimized);
            $('gfe-minimize').textContent = this.isMinimized ? '+' : '_';
        });

        // Window drag
        const header = $('gfe-header');
        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            this.isDragging = true;
            const rect = this.el.getBoundingClientRect();
            this.dragOffsetX = e.clientX - rect.left;
            this.dragOffsetY = e.clientY - rect.top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.el.style.left = (e.clientX - this.dragOffsetX) + 'px';
            this.el.style.top = (e.clientY - this.dragOffsetY) + 'px';
            this.el.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => { this.isDragging = false; });
    }

    applyStylePreset(name) {
        const p = this.stylePresets[name];
        if (!p) return;
        const cfg = this.getCurrentConfig();
        Object.assign(cfg, p);
        this.saveConfigsToStorage();
        this.syncUI();
        this.applyToScene(true);
    }

    syncUI() {
        const cfg = this.getCurrentConfig();
        const $ = (id) => document.getElementById(id);

        $('gfe-biome-select').value = this.selectedBiome;
        $('gfe-enable').classList.toggle('on', cfg.enabled !== false);
        $('gfe-intensity').value = cfg.intensity;
        $('gfe-intensity-val').textContent = cfg.intensity.toFixed(2);
        $('gfe-opacity').value = cfg.opacity;
        $('gfe-opacity-val').textContent = cfg.opacity.toFixed(2);
        $('gfe-height').value = cfg.heightOffset;
        $('gfe-height-val').textContent = `${cfg.heightOffset}m`;
        $('gfe-spacing').value = cfg.layerSpacing;
        $('gfe-spacing-val').textContent = `${cfg.layerSpacing}m`;
        $('gfe-drift').value = cfg.driftSpeed;
        $('gfe-drift-val').textContent = `${cfg.driftSpeed.toFixed(1)}x`;
        $('gfe-turbulence').value = cfg.turbulence;
        $('gfe-turbulence-val').textContent = `${cfg.turbulence.toFixed(1)}x`;
        $('gfe-near').value = cfg.nearFade;
        $('gfe-near-val').textContent = cfg.nearFade;
        $('gfe-far').value = cfg.farFade;
        $('gfe-far-val').textContent = cfg.farFade;
        $('gfe-color-day').value = cfg.color || '#ffffff';
        $('gfe-color-dusk').value = cfg.colorDusk || '#fed7aa';
        $('gfe-color-night').value = cfg.colorNight || '#1e293b';
    }

    getCurrentBiomeFromScene() {
        if (typeof window.getBiomeAt === 'function' && window.playerGrp) {
            const raw = window.getBiomeAt(window.playerGrp.position.x, window.playerGrp.position.z);
            return cleanBiomeName(raw ? raw.name : '');
        }
        return 'Archipelago';
    }

    updateFrame(dt, timePhase = 0) {
        // TimePhase: 0 = Day, 1 = Dusk, 2 = Night
        const activeBiome = this.getCurrentBiomeFromScene();

        // If auto-tracking player biome, update dropdown if changed
        if (this.followPlayerBiome && activeBiome !== this.selectedBiome) {
            this.selectedBiome = activeBiome;
            if (this.visible) this.syncUI();
        }

        const targetCfg = this.biomeConfigs[activeBiome] || DEFAULT_BIOME_FOG_CONFIGS['Archipelago'];

        // Smoothly lerp runtime state toward target config
        const lerpFactor = Math.min(1.0, dt * 2.5);
        this.runtimeState.intensity += (targetCfg.intensity - this.runtimeState.intensity) * lerpFactor;
        this.runtimeState.opacity += (targetCfg.opacity - this.runtimeState.opacity) * lerpFactor;
        this.runtimeState.heightOffset += (targetCfg.heightOffset - this.runtimeState.heightOffset) * lerpFactor;
        this.runtimeState.layerSpacing += (targetCfg.layerSpacing - this.runtimeState.layerSpacing) * lerpFactor;
        this.runtimeState.driftSpeed += (targetCfg.driftSpeed - this.runtimeState.driftSpeed) * lerpFactor;
        this.runtimeState.turbulence += (targetCfg.turbulence - this.runtimeState.turbulence) * lerpFactor;
        this.runtimeState.nearFade += (targetCfg.nearFade - this.runtimeState.nearFade) * lerpFactor;
        this.runtimeState.farFade += (targetCfg.farFade - this.runtimeState.farFade) * lerpFactor;

        // Active color based on timePhase
        let targetHex = targetCfg.color || '#ffffff';
        if (timePhase === 1) targetHex = targetCfg.colorDusk || '#fed7aa';
        else if (timePhase === 2) targetHex = targetCfg.colorNight || '#1e293b';

        // Apply to scene objects
        if (window.fogGroup) {
            window.fogGroup.visible = false;
            const children = window.fogGroup.children;
            for (let i = 0; i < children.length; i++) {
                children[i].position.y = 12 + i * this.runtimeState.layerSpacing;
            }
        }

        if (window.fogMat) {
            window.fogMat.opacity = this.runtimeState.opacity * 0.25 * this.runtimeState.intensity;
            if (window.fogMat.color) window.fogMat.color.set(targetHex);
        }

        if (window.fogUniforms) {
            if (window.fogUniforms.uFogIntensity) window.fogUniforms.uFogIntensity.value = this.runtimeState.intensity;
            if (window.fogUniforms.uFogOpacity) window.fogUniforms.uFogOpacity.value = this.runtimeState.opacity;
            if (window.fogUniforms.uFogDrift) window.fogUniforms.uFogDrift.value = this.runtimeState.driftSpeed;
            if (window.fogUniforms.uFogTurbulence) window.fogUniforms.uFogTurbulence.value = this.runtimeState.turbulence;
            if (window.fogUniforms.uFogNear) window.fogUniforms.uFogNear.value = this.runtimeState.nearFade;
            if (window.fogUniforms.uFogFar) window.fogUniforms.uFogFar.value = this.runtimeState.farFade;
        }

        // Export biome height offset for main render loop positioning
        if (window.biomeFogSettings) {
            window.biomeFogSettings[activeBiome] = this.runtimeState.heightOffset;
        }
    }

    applyToScene(instant = false) {
        const cfg = this.getCurrentConfig();
        if (instant) {
            Object.assign(this.runtimeState, cfg);
        }
    }

    startBiomePolling() {
        setInterval(() => {
            if (this.visible && this.followPlayerBiome) {
                const b = this.getCurrentBiomeFromScene();
                if (b !== this.selectedBiome) {
                    this.selectedBiome = b;
                    this.syncUI();
                }
            }
        }, 600);
    }

    toggle(forceState) {
        this.visible = forceState !== undefined ? forceState : !this.visible;
        this.el.style.display = this.visible ? 'block' : 'none';
        if (this.visible) {
            if (this.followPlayerBiome) {
                this.selectedBiome = this.getCurrentBiomeFromScene();
            }
            this.syncUI();
        }
    }
}
