export const DEFAULT_PRESETS = {
    'Golden Hour Dusk (Default)': {
        name: 'Golden Hour Dusk (Default)',
        timePhase: 1,
        sunAltitude: 160,
        envConfigs: [
            { name: 'Day', bg: 0x4a90d9, mid: 0x7ab4e6, fog: 0xc8dce8, amb: 0xdcf2ff, dir: 0xfffaeb, ambI: 1.2, dirI: 2.4, starOp: 0, sunY: 10000, moonY: -8000, glintCol: 0xfff0d0, cloudCol: 0xfffaec },
            { name: 'Dusk', bg: 0x2a5090, mid: 0xc85078, fog: 0xffa07a, amb: 0xffdab9, dir: 0xffaa00, ambI: 1.1, dirI: 3.2, starOp: 0, sunY: 160, moonY: 200, glintCol: 0xffaa00, cloudCol: 0xfffaec },
            { name: 'Twilight', bg: 0x040816, mid: 0x0f1d3a, fog: 0x16284d, amb: 0x556688, dir: 0x88bbff, ambI: 0.8, dirI: 1.8, starOp: 1.0, sunY: -8000, moonY: 9000, glintCol: 0x66aaff, cloudCol: 0x223355 }
        ],
        params: {
            sceneFog: true,
            fogIntensity: 3.5,
            sunAltitude: 160,
            godRays: true,
            bloom: true,
            skyRenderMode: 'Gradient Regular'
        }
    },
    'Bright Daylight (Noon)': {
        name: 'Bright Daylight (Noon)',
        timePhase: 0,
        sunAltitude: 10000,
        envConfigs: [
            { name: 'Day', bg: 0x4a90d9, mid: 0x7ab4e6, fog: 0xc8dce8, amb: 0xdcf2ff, dir: 0xfffaeb, ambI: 1.2, dirI: 2.4, starOp: 0, sunY: 10000, moonY: -8000, glintCol: 0xfff0d0, cloudCol: 0xfffaec },
            { name: 'Dusk', bg: 0x2a5090, mid: 0xc85078, fog: 0xffa07a, amb: 0xffdab9, dir: 0xffaa00, ambI: 1.1, dirI: 3.2, starOp: 0, sunY: 160, moonY: 200, glintCol: 0xffaa00, cloudCol: 0xfffaec },
            { name: 'Twilight', bg: 0x040816, mid: 0x0f1d3a, fog: 0x16284d, amb: 0x556688, dir: 0x88bbff, ambI: 0.8, dirI: 1.8, starOp: 1.0, sunY: -8000, moonY: 9000, glintCol: 0x66aaff, cloudCol: 0x223355 }
        ],
        params: {
            sceneFog: true,
            fogIntensity: 3.5,
            sunAltitude: 10000,
            godRays: true,
            bloom: true,
            skyRenderMode: 'Gradient Regular'
        }
    },
    'Midnight Moonlight (Twilight)': {
        name: 'Midnight Moonlight (Twilight)',
        timePhase: 2,
        sunAltitude: -8000,
        envConfigs: [
            { name: 'Day', bg: 0x4a90d9, mid: 0x7ab4e6, fog: 0xc8dce8, amb: 0xdcf2ff, dir: 0xfffaeb, ambI: 1.2, dirI: 2.4, starOp: 0, sunY: 10000, moonY: -8000, glintCol: 0xfff0d0, cloudCol: 0xfffaec },
            { name: 'Dusk', bg: 0x2a5090, mid: 0xc85078, fog: 0xffa07a, amb: 0xffdab9, dir: 0xffaa00, ambI: 1.1, dirI: 3.2, starOp: 0, sunY: 160, moonY: 200, glintCol: 0xffaa00, cloudCol: 0xfffaec },
            { name: 'Twilight', bg: 0x040816, mid: 0x0f1d3a, fog: 0x16284d, amb: 0x556688, dir: 0x88bbff, ambI: 0.8, dirI: 1.8, starOp: 1.0, sunY: -8000, moonY: 9000, glintCol: 0x66aaff, cloudCol: 0x223355 }
        ],
        params: {
            sceneFog: true,
            fogIntensity: 3.5,
            sunAltitude: -8000,
            godRays: false,
            bloom: true,
            skyRenderMode: 'Gradient Regular'
        }
    }
};
