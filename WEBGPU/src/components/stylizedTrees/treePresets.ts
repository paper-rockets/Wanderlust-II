export interface TreePreset {
  label: string;
  values: {
    leafBottom: string;
    leafTop: string;
    leafVarColor: string;
    leafBrightness: number;
    leafGradPower: number;
    leafVarStrength: number;
    leafVarScale: number;
    windStrength: number;
    windSpeed: number;
    windFreq: number;
    flutterAmp: number;
    flutterSpeed: number;
    pendulumDip: number;
    barkScale: number;
    barkTint: string;
    barkTintStrength: number;
    barkSaturation: number;
    barkBrightness: number;
    barkAOStrength: number;
    barkRelief: number;
  };
}

export const TREE_PRESETS: Record<"spring" | "autumn", TreePreset> = {
  spring: {
    label: "Spring",
    values: {
      leafBottom: "#1c3b23",
      leafTop: "#5c8338",
      leafVarColor: "#1e4430",
      leafBrightness: 1.05,
      leafGradPower: 1.1,
      leafVarStrength: 0.6,
      leafVarScale: 2.5,
      windStrength: 0.15,
      windSpeed: 1.2,
      windFreq: 0.5,
      flutterAmp: 0.03,
      flutterSpeed: 2.5,
      pendulumDip: 0.05,
      barkScale: 5.6,
      barkTint: "#8a6a4a",
      barkTintStrength: 0.0,
      barkSaturation: 0.7,
      barkBrightness: 1.55,
      barkAOStrength: 0.45,
      barkRelief: 1.5,
    },
  },
  autumn: {
    label: "Autumn",
    values: {
      leafBottom: "#ffaf36",
      leafTop: "#ff1910",
      leafVarColor: "#1e4430",
      leafBrightness: 1.05,
      leafGradPower: 1.1,
      leafVarStrength: 0.6,
      leafVarScale: 2.5,
      windStrength: 0.15,
      windSpeed: 1.2,
      windFreq: 0.5,
      flutterAmp: 0.03,
      flutterSpeed: 2.5,
      pendulumDip: 0.05,
      barkScale: 5.6,
      barkTint: "#8a6a4a",
      barkTintStrength: 0.0,
      barkSaturation: 0.7,
      barkBrightness: 1.55,
      barkAOStrength: 0.45,
      barkRelief: 1.5,
    },
  },
};
