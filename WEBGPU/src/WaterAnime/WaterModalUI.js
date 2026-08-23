import {
  seaUniform,
  speedUniform,
  detailAmountUniform,
  foamAmountUniform,
  waterOpacityUniform,
  waveHeightUniform,
  oceanScaleUniform,
  swellWavelengthUniform,
  foamEnabledUniform,
  chopPatchinessUniform,
  deepColorUniform,
  shallowColorUniform,
  horizonColorUniform,
  zenithColorUniform,
  sunColorUniform,
  sandColorUniform,
  shoreShallowColorUniform,
  shoreDepthUniform,
  shoreOpacityUniform,
  shoreFoamWidthUniform,
  shoreFoamSpeedUniform,
  shoreFoamStrengthUniform,
  shoreRefractionUniform,
  chopStrengthUniform,
  crestSharpnessUniform,
  microRoughnessUniform,
  sparkleUniform,
  foamJacobianUniform,
  foamTrailUniform,
  foamStreakUniform,
  sssColorUniform,
  sssStrengthUniform,
  sssPowerUniform,
  extinctionUniform,
  inScatterUniform,
  aerialStrengthUniform,
  aerialDistanceUniform,
  WAVE_PARAMS,
  updateWaveUniforms,
  randomizeSeaSpectrum,
  setWindDirection
} from './OpenSeaOcean.js';

// Shore defaults — mirrors the uniform defaults declared in OpenSeaOcean.js.
// Colors are the sRGB hex equivalents of Color(0.85, 0.80, 0.62) / Color(0.32, 0.72, 0.70).
const SHORE_DEFAULTS = {
    sand: '#ede7ce',
    shoreShallow: '#99ddda',
    shoreDepth: 6.0,
    shoreOpacity: 0.10,
    shoreFoamWidth: 2.2,
    shoreFoamSpeed: 0.8,
    shoreFoamStrength: 1.0,
    shoreRefraction: 0.35
};

// Surface-realism defaults — mirrors the uniform defaults declared in OpenSeaOcean.js.
const SURFACE_DEFAULTS = {
    chopStrength: 4.5,
    crestSharpness: 0.8,
    microRoughness: 1.0,
    sparkle: 1.0,
    foamJacobian: 0.66,
    foamTrail: 1.0,
    foamStreak: 1.0,
    sssColor: '#1a9e8d',
    sssStrength: 1.35,
    sssPower: 4.5,
    clarity: 1.0,
    inScatter: 0.55,
    aerialStrength: 0.85,
    aerialDistance: 7000
};

// Base per-metre absorption, scaled by the Clarity slider. Red is extinguished ~5x faster than
// blue, which is the whole reason shallow water reads turquoise and deep water reads blue.
const EXTINCTION_BASE = { r: 0.75, g: 0.30, b: 0.16 };

export class WaterModalUI {
    constructor(waterSystem) {
        this.waterSystem = waterSystem;
        this.isOpen = false;
        this.isCollapsed = false;
        this.activeTab = 'waves';

        this.windAngle = 45;
        this.windSpread = 45;

        this.injectStyles();
        this.createDOM();
        this.bindEvents();
    }

    injectStyles() {
        if (document.getElementById('kimi-ocean-styles')) return;
        const style = document.createElement('style');
        style.id = 'kimi-ocean-styles';
        style.textContent = `
            :root {
                --oc-accent: #8fe9e4;
                --oc-ink: rgba(255, 255, 255, 0.92);
                --oc-ink-dim: rgba(255, 255, 255, 0.45);
            }

            #kimi-ocean-modal {
                position: fixed;
                top: 24px;
                left: 24px;
                z-index: 1000;
                pointer-events: auto;
                display: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }

            #kimi-ocean-modal.open {
                display: block;
            }

            .oc-panel-wrap {
                padding: 6px;
                border-radius: 26px;
                background: rgba(255, 255, 255, 0.045);
                border: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
            }

            .oc-panel {
                width: 320px;
                height: 590px;
                max-height: calc(100vh - 60px);
                min-height: 120px;
                padding: 20px 22px;
                border-radius: 20px;
                background: rgba(8, 11, 16, 0.72);
                -webkit-backdrop-filter: blur(28px) saturate(140%);
                backdrop-filter: blur(28px) saturate(140%);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09);
                overflow-y: auto;
                resize: vertical;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                color: var(--oc-ink);
                user-select: none;
            }

            .oc-panel.collapsed {
                height: auto !important;
                min-height: 0 !important;
                resize: none !important;
                overflow: hidden !important;
            }

            .oc-panel.collapsed .oc-tab-bar,
            .oc-panel.collapsed .oc-tab-content,
            .oc-panel.collapsed .oc-bottom-row {
                display: none !important;
            }

            .oc-panel::-webkit-scrollbar { width: 5px; }
            .oc-panel::-webkit-scrollbar-track { background: transparent; }
            .oc-panel::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.22);
                border-radius: 4px;
            }
            .oc-panel::-webkit-scrollbar-thumb:hover { background: var(--oc-accent); }

            .oc-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 8px;
            }

            .oc-title {
                margin: 0;
                font-size: 20px;
                font-weight: 500;
                letter-spacing: 0.14em;
                color: #fff;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .oc-subtitle {
                margin-top: 4px;
                font-family: monospace;
                font-size: 9px;
                letter-spacing: 0.08em;
                color: var(--oc-ink-dim);
            }

            .oc-btn-group {
                display: flex;
                gap: 4px;
            }

            .oc-btn-icon {
                padding: 2px 8px;
                font-size: 11px;
                cursor: pointer;
                border: 1px solid rgba(255, 255, 255, 0.18);
                background: rgba(255, 255, 255, 0.06);
                color: rgba(255, 255, 255, 0.6);
                border-radius: 999px;
                transition: all 0.15s ease;
            }
            .oc-btn-icon:hover {
                color: #fff;
                background: rgba(255, 255, 255, 0.14);
            }

            .oc-tab-bar {
                display: flex;
                gap: 3px;
                margin-top: 14px;
                padding: 3px;
                background: rgba(255, 255, 255, 0.04);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.07);
            }

            .oc-tab-btn {
                flex: 1;
                font-family: monospace;
                font-size: 9px;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                padding: 6px 0;
                border: none;
                border-radius: 9px;
                background: transparent;
                color: rgba(255, 255, 255, 0.45);
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .oc-tab-btn:hover { color: rgba(255, 255, 255, 0.85); }
            .oc-tab-btn.active {
                background: rgba(255, 255, 255, 0.1);
                color: var(--oc-accent);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
            }

            .oc-tab-content { display: none; margin-top: 14px; }
            .oc-tab-content.active { display: block; }

            .oc-control { margin-bottom: 16px; }

            .oc-control-head {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                margin-bottom: 8px;
            }

            .oc-control-head label {
                font-family: monospace;
                font-size: 10px;
                letter-spacing: 0.18em;
                text-transform: uppercase;
                color: rgba(255, 255, 255, 0.62);
            }

            .oc-control-head .oc-value {
                font-family: monospace;
                font-size: 10px;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                color: var(--oc-accent);
            }

            .oc-slider {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                height: 16px;
                background: transparent;
                cursor: pointer;
                display: block;
            }
            .oc-slider::-webkit-slider-runnable-track {
                height: 3px;
                border-radius: 2px;
                background: rgba(255, 255, 255, 0.2);
            }
            .oc-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 12px;
                height: 12px;
                margin-top: -4.5px;
                border: none;
                border-radius: 50%;
                background: var(--oc-accent);
                box-shadow: 0 0 8px rgba(143, 233, 228, 0.85);
                transition: transform 0.15s ease;
            }
            .oc-slider::-webkit-slider-thumb:hover { transform: scale(1.25); }

            .oc-pill-btn {
                font-family: monospace;
                font-size: 10px;
                letter-spacing: 0.14em;
                text-transform: uppercase;
                padding: 7px 14px;
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, 0.16);
                background: rgba(255, 255, 255, 0.05);
                color: rgba(255, 255, 255, 0.6);
                cursor: pointer;
                width: 100%;
                text-align: center;
                transition: all 0.2s ease;
            }
            .oc-pill-btn:hover {
                border-color: var(--oc-accent);
                color: #fff;
            }
            .oc-pill-btn.active {
                background: rgba(143, 233, 228, 0.16);
                border-color: var(--oc-accent);
                color: var(--oc-accent);
            }

            .oc-preset-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 4px;
                margin-top: 4px;
            }

            .oc-preset-btn {
                font-family: monospace;
                font-size: 8px;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                padding: 6px 2px;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.12);
                background: rgba(255, 255, 255, 0.04);
                color: rgba(255, 255, 255, 0.5);
                cursor: pointer;
                text-align: center;
                transition: all 0.18s ease;
            }
            .oc-preset-btn:hover {
                border-color: var(--oc-accent);
                color: #fff;
            }
            .oc-preset-btn.active {
                background: rgba(143, 233, 228, 0.18);
                border-color: var(--oc-accent);
                color: var(--oc-accent);
            }

            .oc-hint {
                margin-top: 6px;
                font-size: 10.5px;
                line-height: 1.45;
                color: rgba(200, 220, 235, 0.45);
            }

            .oc-color-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-top: 6px;
            }
            .oc-color-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: rgba(255, 255, 255, 0.05);
                padding: 6px 10px;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .oc-color-item span {
                font-family: monospace;
                font-size: 9px;
                color: rgba(255, 255, 255, 0.7);
            }
            .oc-color-item input[type="color"] {
                width: 24px;
                height: 20px;
                border: none;
                background: transparent;
                cursor: pointer;
                border-radius: 4px;
            }

            .oc-wave-card {
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                padding: 12px;
                margin-bottom: 12px;
            }
            .oc-wave-title {
                font-family: monospace;
                font-size: 10px;
                letter-spacing: 0.16em;
                text-transform: uppercase;
                color: var(--oc-accent);
                margin-bottom: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    createDOM() {
        const modal = document.createElement('div');
        modal.id = 'kimi-ocean-modal';
        modal.innerHTML = `
            <div class="oc-panel-wrap">
                <section class="oc-panel" id="oc-main-panel">
                    <div class="oc-header">
                        <div>
                            <h1 class="oc-title">🌊 KIMI SEA</h1>
                            <p class="oc-subtitle">3-wave spectral swell · FBM optics</p>
                        </div>
                        <div class="oc-btn-group">
                            <button class="oc-btn-icon" id="oc-min-btn" title="Collapse/Expand">–</button>
                            <button class="oc-btn-icon" id="oc-close-btn" title="Close">✖</button>
                        </div>
                    </div>

                    <!-- Nav Tabs -->
                    <div class="oc-tab-bar">
                        <button class="oc-tab-btn active" data-tab="waves">Waves</button>
                        <button class="oc-tab-btn" data-tab="spectrum">Spectrum</button>
                        <button class="oc-tab-btn" data-tab="shore">Shore</button>
                        <button class="oc-tab-btn" data-tab="surface">Surface</button>
                        <button class="oc-tab-btn" data-tab="atmosphere">Atmosphere</button>
                        <button class="oc-tab-btn" data-tab="view">View</button>
                        <button class="oc-tab-btn" data-tab="debug">Debug</button>
                    </div>

                    <!-- Tab 1: Waves -->
                    <div class="oc-tab-content active" id="oc-tab-waves">
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-seaState">Sea State</label>
                                <span class="oc-value" id="oc-seaVal">45</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-seaState" min="0" max="100" value="45"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-windDir">Wind Direction</label>
                                <span class="oc-value" id="oc-windDirVal">45°</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-windDir" min="0" max="360" value="45"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-windSpread">Directional Spread</label>
                                <span class="oc-value" id="oc-windSpreadVal">45%</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-windSpread" min="0" max="100" value="45"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-waveHeight">Global Wave Height</label>
                                <span class="oc-value" id="oc-waveHeightVal">100%</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-waveHeight" min="0" max="300" value="100"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-oceanScale">Ocean Scale / Wave Scale</label>
                                <span class="oc-value" id="oc-oceanScaleVal">100%</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-oceanScale" min="10" max="400" value="100"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-swellLength">Swell Wavelength</label>
                                <span class="oc-value" id="oc-swellLengthVal">100%</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-swellLength" min="50" max="250" value="100"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-waveSpeed">Wave Speed</label>
                                <span class="oc-value" id="oc-waveSpeedVal">1.0x</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-waveSpeed" min="10" max="300" value="100"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-choppiness">Choppiness</label>
                                <span class="oc-value" id="oc-choppinessVal">50%</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-choppiness" min="0" max="100" value="50"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-chopPatch">Choppiness Patchiness</label>
                                <span class="oc-value" id="oc-chopPatchVal">100%</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-chopPatch" min="0" max="250" value="100"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-foam">Foam Coverage</label>
                                <span class="oc-value" id="oc-foamVal">50%</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-foam" min="0" max="100" value="50"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-opacity">Water Opacity</label>
                                <span class="oc-value" id="oc-opacityVal">92%</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-opacity" min="10" max="100" value="92"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-heightY">Water Level Y</label>
                                <span class="oc-value" id="oc-heightYVal">2.4m</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-heightY" min="-10" max="40" value="2.4" step="0.2"/>
                        </div>

                        <div class="oc-control">
                            <button class="oc-pill-btn active" id="oc-foam-toggle">Wave Crest Foam: ON</button>
                        </div>

                        <div class="oc-control">
                            <button class="oc-pill-btn" id="oc-randomize-btn">🎲 Randomize Sea Spectrum</button>
                        </div>
                    </div>

                    <!-- Tab 2: Spectrum (3 Wave Components) -->
                    <div class="oc-tab-content" id="oc-tab-spectrum">
                        <p class="oc-subtitle" style="margin-bottom: 14px; white-space: normal;">Tweak the 3 individual directional swells that synthesize the ocean surface.</p>
                        
                        <div class="oc-wave-card">
                            <div class="oc-wave-title">Wave Component 1 (Primary Swell)</div>
                            <div class="oc-control">
                                <div class="oc-control-head">
                                    <label>Wavelength</label>
                                    <span class="oc-value" id="oc-w1-len-val">74m</span>
                                </div>
                                <input class="oc-slider" type="range" id="oc-w1-len" min="5" max="150" value="74"/>
                            </div>
                            <div class="oc-control">
                                <div class="oc-control-head">
                                    <label>Steepness</label>
                                    <span class="oc-value" id="oc-w1-stp-val">12%</span>
                                </div>
                                <input class="oc-slider" type="range" id="oc-w1-stp" min="0" max="25" value="12"/>
                            </div>
                            <div class="oc-control">
                                <div class="oc-control-head">
                                    <label>Direction</label>
                                    <span class="oc-value" id="oc-w1-dir-val">14°</span>
                                </div>
                                <input class="oc-slider" type="range" id="oc-w1-dir" min="0" max="360" value="14"/>
                            </div>
                        </div>

                        <div class="oc-wave-card">
                            <div class="oc-wave-title">Wave Component 2 (Secondary Cross-Sea)</div>
                            <div class="oc-control">
                                <div class="oc-control-head">
                                    <label>Wavelength</label>
                                    <span class="oc-value" id="oc-w2-len-val">32m</span>
                                </div>
                                <input class="oc-slider" type="range" id="oc-w2-len" min="5" max="150" value="32"/>
                            </div>
                            <div class="oc-control">
                                <div class="oc-control-head">
                                    <label>Steepness</label>
                                    <span class="oc-value" id="oc-w2-stp-val">9%</span>
                                </div>
                                <input class="oc-slider" type="range" id="oc-w2-stp" min="0" max="25" value="9"/>
                            </div>
                            <div class="oc-control">
                                <div class="oc-control-head">
                                    <label>Direction</label>
                                    <span class="oc-value" id="oc-w2-dir-val">49°</span>
                                </div>
                                <input class="oc-slider" type="range" id="oc-w2-dir" min="0" max="360" value="49"/>
                            </div>
                        </div>

                        <div class="oc-wave-card">
                            <div class="oc-wave-title">Wave Component 3 (Capillary Swell)</div>
                            <div class="oc-control">
                                <div class="oc-control-head">
                                    <label>Wavelength</label>
                                    <span class="oc-value" id="oc-w3-len-val">14m</span>
                                </div>
                                <input class="oc-slider" type="range" id="oc-w3-len" min="2" max="60" value="14"/>
                            </div>
                            <div class="oc-control">
                                <div class="oc-control-head">
                                    <label>Steepness</label>
                                    <span class="oc-value" id="oc-w3-stp-val">6%</span>
                                </div>
                                <input class="oc-slider" type="range" id="oc-w3-stp" min="0" max="25" value="6"/>
                            </div>
                            <div class="oc-control">
                                <div class="oc-control-head">
                                    <label>Direction</label>
                                    <span class="oc-value" id="oc-w3-dir-val">135°</span>
                                </div>
                                <input class="oc-slider" type="range" id="oc-w3-dir" min="0" max="360" value="135"/>
                            </div>
                        </div>
                    </div>

                    <!-- Tab 3: Shore -->
                    <div class="oc-tab-content" id="oc-tab-shore">
                        <p class="oc-subtitle" style="margin-bottom: 14px; white-space: normal;">Shallow-water shading where the ocean meets the beach.</p>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label>Shore Colors</label>
                            </div>
                            <div class="oc-color-grid">
                                <div class="oc-color-item">
                                    <span>Sand Band</span>
                                    <input type="color" id="oc-col-sand" value="#ede7ce"/>
                                </div>
                                <div class="oc-color-item">
                                    <span>Shore Shallow</span>
                                    <input type="color" id="oc-col-shoreShallow" value="#99ddda"/>
                                </div>
                            </div>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-shoreDepth">Shore Depth</label>
                                <span class="oc-value" id="oc-shoreDepthVal">6.0m</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-shoreDepth" min="0.5" max="30" value="6" step="0.1"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-shoreOpacity">Shore Opacity</label>
                                <span class="oc-value" id="oc-shoreOpacityVal">10%</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-shoreOpacity" min="0" max="100" value="10"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-shoreFoamWidth">Shore Foam Width</label>
                                <span class="oc-value" id="oc-shoreFoamWidthVal">2.2m</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-shoreFoamWidth" min="0" max="12" value="2.2" step="0.1"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-shoreFoamSpeed">Shore Foam Speed</label>
                                <span class="oc-value" id="oc-shoreFoamSpeedVal">0.80x</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-shoreFoamSpeed" min="0" max="4" value="0.8" step="0.05"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-shoreFoamStrength">Shore Foam Strength</label>
                                <span class="oc-value" id="oc-shoreFoamStrengthVal">1.00</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-shoreFoamStrength" min="0" max="3" value="1" step="0.05"/>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-shoreRefraction">Shore Refraction</label>
                                <span class="oc-value" id="oc-shoreRefractionVal">0.35</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-shoreRefraction" min="0" max="2" value="0.35" step="0.01"/>
                        </div>
                    </div>


                    <!-- Tab: Surface realism -->
                    <div class="oc-tab-content" id="oc-tab-surface">
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label>Wave Shape</label>
                            </div>
                        </div>
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-chopStrength">Crest Sharpening (Q)</label>
                                <span class="oc-value" id="oc-chopStrengthVal">4.50</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-chopStrength" min="0" max="7" value="4.5" step="0.05"/>
                            <div class="oc-hint">Pinches peaks and flattens troughs. Above ~3.5 the surface starts folding through itself.</div>
                        </div>
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-crestSharp">Peak Pinch (Stokes)</label>
                                <span class="oc-value" id="oc-crestSharpVal">0.80</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-crestSharp" min="0" max="2" value="0.8" step="0.05"/>
                            <div class="oc-hint">Extra sharpening at the very tip of the crest. Does not change wave height.</div>
                        </div>
                        <div class="oc-control" style="margin-top:14px;">
                            <div class="oc-control-head">
                                <label>Micro-Surface &amp; Specular</label>
                            </div>
                        </div>
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-microRough">Normal Filtering</label>
                                <span class="oc-value" id="oc-microRoughVal">1.00</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-microRough" min="0" max="2" value="1.0" step="0.05"/>
                            <div class="oc-hint">Turns sub-pixel ripple into roughness. Drop to 0 to see the raw sparkle it removes.</div>
                        </div>
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-sparkle">Sun Glitter</label>
                                <span class="oc-value" id="oc-sparkleVal">1.00</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-sparkle" min="0" max="3" value="1.0" step="0.05"/>
                        </div>
                        <div class="oc-control" style="margin-top:14px;">
                            <div class="oc-control-head">
                                <label>Whitecaps</label>
                            </div>
                        </div>
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-foamJac">Break Threshold</label>
                                <span class="oc-value" id="oc-foamJacVal">0.66</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-foamJac" min="0.1" max="1.0" value="0.66" step="0.01"/>
                            <div class="oc-hint">How steep a crest must get before it foams. Higher = foam on more waves.</div>
                        </div>
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-foamTrail">Foam Trail Length</label>
                                <span class="oc-value" id="oc-foamTrailVal">1.00</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-foamTrail" min="0" max="3" value="1.0" step="0.05"/>
                        </div>
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-foamStreak">Streak Anisotropy</label>
                                <span class="oc-value" id="oc-foamStreakVal">1.00</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-foamStreak" min="0" max="1" value="1.0" step="0.05"/>
                            <div class="oc-hint">0 = round clumps, 1 = streaks stretched along the swell direction.</div>
                        </div>
                        <div class="oc-control" style="margin-top:14px;">
                            <div class="oc-control-head">
                                <label>Subsurface Scattering</label>
                            </div>
                        </div>
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-col-sss">Backlight Colour</label>
                            </div>
                            <div class="oc-color-grid">
                                <div class="oc-color-item">
                                    <span>Backlight</span>
                                    <input type="color" id="oc-col-sss" value="#1a9e8d"/>
                                </div>
                            </div>
                        </div>
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-sssStrength">SSS Strength</label>
                                <span class="oc-value" id="oc-sssStrengthVal">1.35</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-sssStrength" min="0" max="4" value="1.35" step="0.05"/>
                            <div class="oc-hint">Glow through a wave lit from behind. Peaks on thin, steep crests.</div>
                        </div>
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-sssPower">SSS Tightness</label>
                                <span class="oc-value" id="oc-sssPowerVal">4.5</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-sssPower" min="1" max="16" value="4.5" step="0.1"/>
                        </div>
                        <div class="oc-control" style="margin-top:14px;">
                            <div class="oc-control-head">
                                <label>Water Clarity &amp; Air</label>
                            </div>
                        </div>
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-clarity">Water Clarity</label>
                                <span class="oc-value" id="oc-clarityVal">1.00</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-clarity" min="0.2" max="3" value="1.0" step="0.05"/>
                            <div class="oc-hint">Lower = clearer water, the bottom shows through from deeper. Higher = murkier.</div>
                        </div>
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-inScatter">Turquoise In-Scatter</label>
                                <span class="oc-value" id="oc-inScatterVal">0.55</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-inScatter" min="0" max="2" value="0.55" step="0.05"/>
                        </div>
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-aerialStrength">Haze Strength</label>
                                <span class="oc-value" id="oc-aerialStrengthVal">0.85</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-aerialStrength" min="0" max="1.5" value="0.85" step="0.05"/>
                        </div>
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label for="oc-aerialDist">Haze Distance</label>
                                <span class="oc-value" id="oc-aerialDistVal">7000m</span>
                            </div>
                            <input class="oc-slider" type="range" id="oc-aerialDist" min="800" max="20000" value="7000" step="100"/>
                        </div>
                    </div>

                    <!-- Tab 4: Atmosphere & Colors -->
                    <div class="oc-tab-content" id="oc-tab-atmosphere">
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label>Water Mood & Lighting Presets</label>
                            </div>
                            <div class="oc-preset-grid">
                                <button class="oc-preset-btn active" data-preset="deep">Deep</button>
                                <button class="oc-preset-btn" data-preset="tropical">Tropical</button>
                                <button class="oc-preset-btn" data-preset="emerald">Emerald</button>
                                <button class="oc-preset-btn" data-preset="abyss">Abyss</button>
                                <button class="oc-preset-btn" data-preset="night">Night 🌙</button>
                            </div>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label>Custom Water Colors</label>
                            </div>
                            <div class="oc-color-grid">
                                <div class="oc-color-item">
                                    <span>Deep Sea</span>
                                    <input type="color" id="oc-col-deep" value="#04171c"/>
                                </div>
                                <div class="oc-color-item">
                                    <span>Shallow</span>
                                    <input type="color" id="oc-col-shallow" value="#0f525c"/>
                                </div>
                                <div class="oc-color-item">
                                    <span>Sun Reflect</span>
                                    <input type="color" id="oc-col-sun" value="#ffffff"/>
                                </div>
                                <div class="oc-color-item">
                                    <span>Horizon Haze</span>
                                    <input type="color" id="oc-col-horizon" value="#85adae"/>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tab 5: View & Performance -->
                    <div class="oc-tab-content" id="oc-tab-view">
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label>Shader Quality Mode</label>
                            </div>
                            <div class="oc-preset-grid" style="grid-template-columns: 1fr 1fr;">
                                <button class="oc-preset-btn active" id="oc-mode-high" data-mode="high">🌟 High (Cinematic)</button>
                                <button class="oc-preset-btn" id="oc-mode-perf" data-mode="performance">⚡ Fast (High FPS)</button>
                            </div>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label>Mesh Density / Resolution</label>
                            </div>
                            <div class="oc-preset-grid" style="grid-template-columns: 1fr 1fr 1fr;">
                                <button class="oc-preset-btn active" id="oc-res-512" data-res="512">512 (Ultra)</button>
                                <button class="oc-preset-btn" id="oc-res-256" data-res="256">256 (Med)</button>
                                <button class="oc-preset-btn" id="oc-res-128" data-res="128">128 (Fast)</button>
                            </div>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label>Distance Quality LOD (Reduces Far Noise)</label>
                            </div>
                            <button class="oc-pill-btn active" id="oc-lod-toggle">Distance LOD: ON</button>
                        </div>

                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label>Surface Wireframe</label>
                            </div>
                            <button class="oc-pill-btn" id="oc-wireframe-toggle">Wireframe: OFF</button>
                        </div>
                    </div>

                    <!-- Tab 6: Debug -->
                    <div class="oc-tab-content" id="oc-tab-debug">
                        <div class="oc-control">
                            <div class="oc-control-head">
                                <label>Ocean Visibility</label>
                            </div>
                            <button class="oc-pill-btn active" id="oc-vis-toggle">Ocean Visible: YES</button>
                        </div>
                        <div class="oc-control" style="margin-top: 20px;">
                            <button class="oc-pill-btn" id="oc-reset-btn" style="color: #ff8888; border-color: rgba(255,100,100,0.3);">Reset Defaults</button>
                        </div>
                    </div>
                </section>
            </div>
        `;
        document.body.appendChild(modal);
        this.dom = modal;
    }

    bindEvents() {
        const modal = this.dom;
        const panel = modal.querySelector('#oc-main-panel');

        // Minimize / Expand
        const minBtn = modal.querySelector('#oc-min-btn');
        minBtn.addEventListener('click', () => {
            this.isCollapsed = !this.isCollapsed;
            panel.classList.toggle('collapsed', this.isCollapsed);
            minBtn.textContent = this.isCollapsed ? '+' : '–';
        });

        // Close
        const closeBtn = modal.querySelector('#oc-close-btn');
        closeBtn.addEventListener('click', () => this.hide());

        // Tab Switching
        const tabBtns = modal.querySelectorAll('.oc-tab-btn');
        const tabContents = modal.querySelectorAll('.oc-tab-content');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                const content = modal.querySelector(`#oc-tab-${targetTab}`);
                if (content) content.classList.add('active');
            });
        });

        // Tab 1: Waves
        const bindSlider = (id, valId, onInput, format = v => v) => {
            const slider = modal.querySelector(`#${id}`);
            const valEl = modal.querySelector(`#${valId}`);
            if (!slider || !valEl) return;
            slider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                valEl.textContent = format(val);
                onInput(val);
            });
        };

        bindSlider('oc-seaState', 'oc-seaVal', (v) => {
            seaUniform.value = 0.2 + (v / 100) * 1.5;
        });

        bindSlider('oc-windDir', 'oc-windDirVal', (v) => {
            this.windAngle = v;
            setWindDirection(this.windAngle, this.windSpread);
        }, v => `${Math.round(v)}°`);

        bindSlider('oc-windSpread', 'oc-windSpreadVal', (v) => {
            this.windSpread = v;
            setWindDirection(this.windAngle, this.windSpread);
        }, v => `${Math.round(v)}%`);

        bindSlider('oc-waveHeight', 'oc-waveHeightVal', (v) => {
            waveHeightUniform.value = v / 100.0;
        }, v => `${Math.round(v)}%`);

        bindSlider('oc-oceanScale', 'oc-oceanScaleVal', (v) => {
            oceanScaleUniform.value = v / 100.0;
        }, v => `${Math.round(v)}%`);

        bindSlider('oc-swellLength', 'oc-swellLengthVal', (v) => {
            swellWavelengthUniform.value = v / 100.0;
        }, v => `${Math.round(v)}%`);

        bindSlider('oc-waveSpeed', 'oc-waveSpeedVal', (v) => {
            speedUniform.value = v / 100.0;
        }, v => `${(v / 100.0).toFixed(1)}x`);

        bindSlider('oc-choppiness', 'oc-choppinessVal', (v) => {
            detailAmountUniform.value = (v / 100.0) * 2.0;
        }, v => `${Math.round(v)}%`);

        bindSlider('oc-chopPatch', 'oc-chopPatchVal', (v) => {
            chopPatchinessUniform.value = v / 100.0;
        }, v => `${Math.round(v)}%`);

        bindSlider('oc-foam', 'oc-foamVal', (v) => {
            foamAmountUniform.value = (v / 100.0) * 2.0;
        }, v => `${Math.round(v)}%`);

        bindSlider('oc-opacity', 'oc-opacityVal', (v) => {
            waterOpacityUniform.value = v / 100.0;
        }, v => `${Math.round(v)}%`);

        bindSlider('oc-heightY', 'oc-heightYVal', (v) => {
            this.waterSystem.setHeight(v);
        }, v => `${v.toFixed(1)}m`);

        const foamToggle = modal.querySelector('#oc-foam-toggle');
        foamToggle.addEventListener('click', () => {
            const isOn = foamEnabledUniform.value > 0.5;
            foamEnabledUniform.value = isOn ? 0.0 : 1.0;
            foamToggle.classList.toggle('active', !isOn);
            foamToggle.textContent = !isOn ? 'Wave Crest Foam: ON' : 'Wave Crest Foam: OFF';
        });

        const randomBtn = modal.querySelector('#oc-randomize-btn');
        randomBtn.addEventListener('click', () => {
            randomizeSeaSpectrum();
            this.updateSpectrumUI();
        });

        // Tab 2: Spectrum Sliders (3 Waves)
        for (let i = 0; i < 3; i++) {
            const idx = i + 1;
            bindSlider(`oc-w${idx}-len`, `oc-w${idx}-len-val`, (v) => {
                WAVE_PARAMS[i].wavelength = v;
                updateWaveUniforms(i);
            }, v => `${Math.round(v)}m`);

            bindSlider(`oc-w${idx}-stp`, `oc-w${idx}-stp-val`, (v) => {
                WAVE_PARAMS[i].steepness = v / 100.0;
                updateWaveUniforms(i);
            }, v => `${Math.round(v)}%`);

            bindSlider(`oc-w${idx}-dir`, `oc-w${idx}-dir-val`, (v) => {
                const rad = (v * Math.PI) / 180;
                WAVE_PARAMS[i].dir[0] = Math.cos(rad);
                WAVE_PARAMS[i].dir[1] = Math.sin(rad);
                updateWaveUniforms(i);
            }, v => `${Math.round(v)}°`);
        }

        // Tab 3: Shore
        bindSlider('oc-shoreDepth', 'oc-shoreDepthVal', (v) => {
            shoreDepthUniform.value = v;
        }, v => `${v.toFixed(1)}m`);

        bindSlider('oc-shoreOpacity', 'oc-shoreOpacityVal', (v) => {
            shoreOpacityUniform.value = v / 100.0;
        }, v => `${Math.round(v)}%`);

        bindSlider('oc-shoreFoamWidth', 'oc-shoreFoamWidthVal', (v) => {
            shoreFoamWidthUniform.value = v;
        }, v => `${v.toFixed(1)}m`);

        bindSlider('oc-shoreFoamSpeed', 'oc-shoreFoamSpeedVal', (v) => {
            shoreFoamSpeedUniform.value = v;
        }, v => `${v.toFixed(2)}x`);

        bindSlider('oc-shoreFoamStrength', 'oc-shoreFoamStrengthVal', (v) => {
            shoreFoamStrengthUniform.value = v;
        }, v => `${v.toFixed(2)}`);

        bindSlider('oc-shoreRefraction', 'oc-shoreRefractionVal', (v) => {
            shoreRefractionUniform.value = v;
        }, v => `${v.toFixed(2)}`);

        modal.querySelector('#oc-col-sand').addEventListener('input', e => sandColorUniform.value.set(e.target.value));
        modal.querySelector('#oc-col-shoreShallow').addEventListener('input', e => shoreShallowColorUniform.value.set(e.target.value));

        // Tab: Surface realism
        bindSlider('oc-chopStrength', 'oc-chopStrengthVal', (v) => {
            chopStrengthUniform.value = v;
        }, v => v.toFixed(2));

        bindSlider('oc-crestSharp', 'oc-crestSharpVal', (v) => {
            crestSharpnessUniform.value = v;
        }, v => v.toFixed(2));

        bindSlider('oc-microRough', 'oc-microRoughVal', (v) => {
            microRoughnessUniform.value = v;
        }, v => v.toFixed(2));

        bindSlider('oc-sparkle', 'oc-sparkleVal', (v) => {
            sparkleUniform.value = v;
        }, v => v.toFixed(2));

        bindSlider('oc-foamJac', 'oc-foamJacVal', (v) => {
            foamJacobianUniform.value = v;
        }, v => v.toFixed(2));

        bindSlider('oc-foamTrail', 'oc-foamTrailVal', (v) => {
            foamTrailUniform.value = v;
        }, v => v.toFixed(2));

        bindSlider('oc-foamStreak', 'oc-foamStreakVal', (v) => {
            foamStreakUniform.value = v;
        }, v => v.toFixed(2));

        bindSlider('oc-sssStrength', 'oc-sssStrengthVal', (v) => {
            sssStrengthUniform.value = v;
        }, v => v.toFixed(2));

        bindSlider('oc-sssPower', 'oc-sssPowerVal', (v) => {
            sssPowerUniform.value = v;
        }, v => v.toFixed(1));

        // One slider scales all three absorption channels together, keeping their ratio -- that
        // ratio is what produces the turquoise-to-blue gradient and should not be user-editable.
        bindSlider('oc-clarity', 'oc-clarityVal', (v) => {
            extinctionUniform.value.set(
                EXTINCTION_BASE.r * v, EXTINCTION_BASE.g * v, EXTINCTION_BASE.b * v);
        }, v => v.toFixed(2));

        bindSlider('oc-inScatter', 'oc-inScatterVal', (v) => {
            inScatterUniform.value = v;
        }, v => v.toFixed(2));

        bindSlider('oc-aerialStrength', 'oc-aerialStrengthVal', (v) => {
            aerialStrengthUniform.value = v;
        }, v => v.toFixed(2));

        bindSlider('oc-aerialDist', 'oc-aerialDistVal', (v) => {
            aerialDistanceUniform.value = v;
        }, v => `${Math.round(v)}m`);

        modal.querySelector('#oc-col-sss').addEventListener('input', e => sssColorUniform.value.set(e.target.value));

        // Tab 4: Atmosphere & Color Presets
        const presets = {
            deep: { deep: '#04171c', shallow: '#0f525c', sun: '#ffffff', horizon: '#85adae' },
            tropical: { deep: '#062d3e', shallow: '#14b8a6', sun: '#ffffff', horizon: '#99e6ff' },
            emerald: { deep: '#04241c', shallow: '#10b981', sun: '#ffffff', horizon: '#a7f3d0' },
            abyss: { deep: '#010508', shallow: '#041d28', sun: '#e2e8f0', horizon: '#334155' },
            night: { deep: '#020408', shallow: '#0a101f', sun: '#88aaff', horizon: '#0b132b' }
        };

        const presetBtns = modal.querySelectorAll('.oc-preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                presetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const p = presets[btn.dataset.preset];
                if (p) {
                    deepColorUniform.value.set(p.deep);
                    shallowColorUniform.value.set(p.shallow);
                    sunColorUniform.value.set(p.sun);
                    horizonColorUniform.value.set(p.horizon);

                    modal.querySelector('#oc-col-deep').value = p.deep;
                    modal.querySelector('#oc-col-shallow').value = p.shallow;
                    modal.querySelector('#oc-col-sun').value = p.sun;
                    modal.querySelector('#oc-col-horizon').value = p.horizon;
                }
            });
        });

        // Color Pickers
        modal.querySelector('#oc-col-deep').addEventListener('input', e => deepColorUniform.value.set(e.target.value));
        modal.querySelector('#oc-col-shallow').addEventListener('input', e => shallowColorUniform.value.set(e.target.value));
        modal.querySelector('#oc-col-sun').addEventListener('input', e => sunColorUniform.value.set(e.target.value));
        modal.querySelector('#oc-col-horizon').addEventListener('input', e => horizonColorUniform.value.set(e.target.value));

        // Tab 5: View & Performance
        const modeHighBtn = modal.querySelector('#oc-mode-high');
        const modePerfBtn = modal.querySelector('#oc-mode-perf');
        if (modeHighBtn && modePerfBtn) {
            modeHighBtn.addEventListener('click', () => {
                this.waterSystem.setQualityMode('high');
                this.syncQualityUI();
            });
            modePerfBtn.addEventListener('click', () => {
                this.waterSystem.setQualityMode('performance');
                this.syncQualityUI();
            });
        }

        ['512', '256', '128'].forEach(res => {
            const btn = modal.querySelector(`#oc-res-${res}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.waterSystem.setMeshResolution(res);
                    this.syncQualityUI();
                });
            }
        });

        const lodBtn = modal.querySelector('#oc-lod-toggle');
        if (lodBtn) {
            lodBtn.addEventListener('click', () => {
                this.waterSystem.setDistanceLod(!this.waterSystem.distanceLod);
                this.syncQualityUI();
            });
        }

        const wireframeBtn = modal.querySelector('#oc-wireframe-toggle');
        wireframeBtn.addEventListener('click', () => {
            if (this.waterSystem.openSeaMaterial) {
                this.waterSystem.openSeaMaterial.wireframe = !this.waterSystem.openSeaMaterial.wireframe;
                const isWire = this.waterSystem.openSeaMaterial.wireframe;
                wireframeBtn.classList.toggle('active', isWire);
                wireframeBtn.textContent = isWire ? 'Wireframe: ON' : 'Wireframe: OFF';
            }
        });

        // Tab 6: Debug Visibility & Reset
        const visBtn = modal.querySelector('#oc-vis-toggle');
        visBtn.addEventListener('click', () => {
            this.waterSystem.setVisible(!this.waterSystem.visible);
            visBtn.classList.toggle('active', this.waterSystem.visible);
            visBtn.textContent = this.waterSystem.visible ? 'Ocean Visible: YES' : 'Ocean Visible: NO';
        });

        const resetBtn = modal.querySelector('#oc-reset-btn');
        resetBtn.addEventListener('click', () => {
            seaUniform.value = 0.45;
            waveHeightUniform.value = 1.0;
            speedUniform.value = 1.0;
            oceanScaleUniform.value = 1.0;
            swellWavelengthUniform.value = 1.0;
            waterOpacityUniform.value = 0.92;
            foamAmountUniform.value = 1.0;
            detailAmountUniform.value = 1.0;
            sandColorUniform.value.set(SHORE_DEFAULTS.sand);
            shoreShallowColorUniform.value.set(SHORE_DEFAULTS.shoreShallow);
            shoreDepthUniform.value = SHORE_DEFAULTS.shoreDepth;
            shoreOpacityUniform.value = SHORE_DEFAULTS.shoreOpacity;
            shoreFoamWidthUniform.value = SHORE_DEFAULTS.shoreFoamWidth;
            shoreFoamSpeedUniform.value = SHORE_DEFAULTS.shoreFoamSpeed;
            shoreFoamStrengthUniform.value = SHORE_DEFAULTS.shoreFoamStrength;
            shoreRefractionUniform.value = SHORE_DEFAULTS.shoreRefraction;
            chopStrengthUniform.value = SURFACE_DEFAULTS.chopStrength;
            crestSharpnessUniform.value = SURFACE_DEFAULTS.crestSharpness;
            microRoughnessUniform.value = SURFACE_DEFAULTS.microRoughness;
            sparkleUniform.value = SURFACE_DEFAULTS.sparkle;
            foamJacobianUniform.value = SURFACE_DEFAULTS.foamJacobian;
            foamTrailUniform.value = SURFACE_DEFAULTS.foamTrail;
            foamStreakUniform.value = SURFACE_DEFAULTS.foamStreak;
            sssColorUniform.value.set(SURFACE_DEFAULTS.sssColor);
            sssStrengthUniform.value = SURFACE_DEFAULTS.sssStrength;
            sssPowerUniform.value = SURFACE_DEFAULTS.sssPower;
            extinctionUniform.value.set(EXTINCTION_BASE.r, EXTINCTION_BASE.g, EXTINCTION_BASE.b);
            inScatterUniform.value = SURFACE_DEFAULTS.inScatter;
            aerialStrengthUniform.value = SURFACE_DEFAULTS.aerialStrength;
            aerialDistanceUniform.value = SURFACE_DEFAULTS.aerialDistance;
            this.waterSystem.setHeight(2.4);
            this.waterSystem.setQualityMode('high');
            this.syncQualityUI();
            this.updateShoreUI();
            this.updateSurfaceUI();
            presetBtns[0].click();
        });
    }

    updateShoreUI() {
        const setSlider = (id, valId, value, format) => {
            const el = this.dom.querySelector(`#${id}`);
            const valEl = this.dom.querySelector(`#${valId}`);
            if (el) el.value = value;
            if (valEl) valEl.textContent = format(value);
        };

        setSlider('oc-shoreDepth', 'oc-shoreDepthVal', shoreDepthUniform.value, v => `${v.toFixed(1)}m`);
        setSlider('oc-shoreOpacity', 'oc-shoreOpacityVal', shoreOpacityUniform.value * 100, v => `${Math.round(v)}%`);
        setSlider('oc-shoreFoamWidth', 'oc-shoreFoamWidthVal', shoreFoamWidthUniform.value, v => `${v.toFixed(1)}m`);
        setSlider('oc-shoreFoamSpeed', 'oc-shoreFoamSpeedVal', shoreFoamSpeedUniform.value, v => `${v.toFixed(2)}x`);
        setSlider('oc-shoreFoamStrength', 'oc-shoreFoamStrengthVal', shoreFoamStrengthUniform.value, v => `${v.toFixed(2)}`);
        setSlider('oc-shoreRefraction', 'oc-shoreRefractionVal', shoreRefractionUniform.value, v => `${v.toFixed(2)}`);

        const sandEl = this.dom.querySelector('#oc-col-sand');
        if (sandEl) sandEl.value = '#' + sandColorUniform.value.getHexString();
        const shallowEl = this.dom.querySelector('#oc-col-shoreShallow');
        if (shallowEl) shallowEl.value = '#' + shoreShallowColorUniform.value.getHexString();
    }

    updateSurfaceUI() {
        const setSlider = (id, value, format) => {
            const el = this.dom.querySelector(`#${id}`);
            const valEl = this.dom.querySelector(`#${id}Val`);
            if (el) el.value = value;
            if (valEl) valEl.textContent = format(value);
        };
        const f2 = v => v.toFixed(2);

        setSlider('oc-chopStrength', chopStrengthUniform.value, f2);
        setSlider('oc-crestSharp', crestSharpnessUniform.value, f2);
        setSlider('oc-microRough', microRoughnessUniform.value, f2);
        setSlider('oc-sparkle', sparkleUniform.value, f2);
        setSlider('oc-foamJac', foamJacobianUniform.value, f2);
        setSlider('oc-foamTrail', foamTrailUniform.value, f2);
        setSlider('oc-foamStreak', foamStreakUniform.value, f2);
        setSlider('oc-sssStrength', sssStrengthUniform.value, f2);
        setSlider('oc-sssPower', sssPowerUniform.value, v => v.toFixed(1));
        // Clarity is stored as the scale factor applied to EXTINCTION_BASE, so read it back out.
        setSlider('oc-clarity', extinctionUniform.value.x / EXTINCTION_BASE.r, f2);
        setSlider('oc-inScatter', inScatterUniform.value, f2);
        setSlider('oc-aerialStrength', aerialStrengthUniform.value, f2);
        setSlider('oc-aerialDist', aerialDistanceUniform.value, v => `${Math.round(v)}m`);

        const sssEl = this.dom.querySelector('#oc-col-sss');
        if (sssEl) sssEl.value = '#' + sssColorUniform.value.getHexString();
    }

    syncQualityUI() {
        const isHigh = this.waterSystem.qualityMode === 'high';
        const modeHighBtn = this.dom.querySelector('#oc-mode-high');
        const modePerfBtn = this.dom.querySelector('#oc-mode-perf');
        if (modeHighBtn && modePerfBtn) {
            modeHighBtn.classList.toggle('active', isHigh);
            modePerfBtn.classList.toggle('active', !isHigh);
        }

        const currentRes = String(this.waterSystem.meshResolution);
        ['512', '256', '128'].forEach(res => {
            const btn = this.dom.querySelector(`#oc-res-${res}`);
            if (btn) {
                btn.classList.toggle('active', currentRes === res);
            }
        });

        const lodBtn = this.dom.querySelector('#oc-lod-toggle');
        if (lodBtn) {
            const isOn = this.waterSystem.distanceLod;
            lodBtn.classList.toggle('active', isOn);
            lodBtn.textContent = isOn ? 'Distance LOD: ON' : 'Distance LOD: OFF';
        }
    }

    updateSpectrumUI() {
        for (let i = 0; i < 3; i++) {
            const idx = i + 1;
            const p = WAVE_PARAMS[i];
            const lenEl = this.dom.querySelector(`#oc-w${idx}-len`);
            const lenVal = this.dom.querySelector(`#oc-w${idx}-len-val`);
            const stpEl = this.dom.querySelector(`#oc-w${idx}-stp`);
            const stpVal = this.dom.querySelector(`#oc-w${idx}-stp-val`);
            const dirEl = this.dom.querySelector(`#oc-w${idx}-dir`);
            const dirVal = this.dom.querySelector(`#oc-w${idx}-dir-val`);

            if (lenEl && lenVal) {
                lenEl.value = p.wavelength;
                lenVal.textContent = `${Math.round(p.wavelength)}m`;
            }
            if (stpEl && stpVal) {
                stpEl.value = Math.round(p.steepness * 100);
                stpVal.textContent = `${Math.round(p.steepness * 100)}%`;
            }
            if (dirEl && dirVal) {
                const angle = Math.round(((Math.atan2(p.dir[1], p.dir[0]) * 180) / Math.PI + 360) % 360);
                dirEl.value = angle;
                dirVal.textContent = `${angle}°`;
            }
        }
    }

    show() {
        this.isOpen = true;
        this.dom.classList.add('open');
    }

    hide() {
        this.isOpen = false;
        this.dom.classList.remove('open');
    }

    toggle() {
        if (this.isOpen) this.hide();
        else this.show();
    }
}
