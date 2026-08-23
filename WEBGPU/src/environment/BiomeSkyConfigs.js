export const BIOME_SKY_CONFIGS = {
    '🏝️ Archipelago': {
        coverage: 0.40, edge: 0.07, speed: 0.02,
        skyZenith: 0x4a90d9, skyHorizon: 0xb8d4e8,
        cloudCol: 0xfff8f0, cloudShadow: 0xb0a898,
        turbulence: 0.0, stormDarken: 0.0
    },
    '🌲 Ghibli Land': {
        coverage: 0.45, edge: 0.06, speed: 0.018,
        skyZenith: 0x5a9ed0, skyHorizon: 0xc8dce8,
        cloudCol: 0xfffaec, cloudShadow: 0xa89888,
        turbulence: 0.0, stormDarken: 0.0
    },
    '🌾 Vast Plains': {
        coverage: 0.35, edge: 0.08, speed: 0.025,
        skyZenith: 0x5aade0, skyHorizon: 0xd0e4f0,
        cloudCol: 0xffffff, cloudShadow: 0xb0b8c0,
        turbulence: 0.0, stormDarken: 0.0
    },
    '🏔️ Misty Mountains': {
        coverage: 0.65, edge: 0.12, speed: 0.015,
        skyZenith: 0x6888a8, skyHorizon: 0xa0b8c8,
        cloudCol: 0xe8ecf0, cloudShadow: 0x889098,
        turbulence: 0.0, stormDarken: 0.1
    },
    '🌴 Lush Jungle': {
        coverage: 0.55, edge: 0.08, speed: 0.012,
        skyZenith: 0x5a9bc4, skyHorizon: 0x98c8a0,
        cloudCol: 0xe8f0e8, cloudShadow: 0x90a090,
        turbulence: 0.0, stormDarken: 0.05
    },
    '💎 Crystal Land': {
        coverage: 0.25, edge: 0.05, speed: 0.01,
        skyZenith: 0x6a4a90, skyHorizon: 0xc0a0e0,
        cloudCol: 0xe8d8f8, cloudShadow: 0x9080a8,
        turbulence: 0.0, stormDarken: 0.0
    },
    '🌊 Open Ocean': {
        coverage: 0.30, edge: 0.07, speed: 0.022,
        skyZenith: 0x3880c0, skyHorizon: 0xa0c8e0,
        cloudCol: 0xfff4e8, cloudShadow: 0xa8a098,
        turbulence: 0.0, stormDarken: 0.0
    },
    '🏜️ Desert Dunes': {
        coverage: 0.08, edge: 0.10, speed: 0.008,
        skyZenith: 0xc4a35a, skyHorizon: 0xf0d6a0,
        cloudCol: 0xffe8c0, cloudShadow: 0xc0a070,
        turbulence: 0.0, stormDarken: 0.0
    },
    '⛰️ Badlands Canyon': {
        coverage: 0.12, edge: 0.08, speed: 0.012,
        skyZenith: 0x3672b8, skyHorizon: 0xf5d4a6,
        cloudCol: 0xfff2e2, cloudShadow: 0xb8947c,
        turbulence: 0.0, stormDarken: 0.0
    },
    '❄️ North Pole': {
        coverage: 0.50, edge: 0.10, speed: 0.01,
        skyZenith: 0x90b8d0, skyHorizon: 0xd0e0f0,
        cloudCol: 0xf0f4f8, cloudShadow: 0xa8b8c8,
        turbulence: 0.0, stormDarken: 0.0
    }
};

export const WEATHER_PRESETS = {
    clear:    { coverage: null, edge: null, speed: null, turbulence: 0.0, stormDarken: 0.0 },
    storm:    { coverage: 0.78, edge: 0.15, speed: 0.08, turbulence: 1.0, stormDarken: 0.5 },
    overcast: { coverage: 0.82, edge: 0.20, speed: 0.01, turbulence: 0.0, stormDarken: 0.25 },
};
