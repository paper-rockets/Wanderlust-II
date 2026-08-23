export const BARK_FRAGMENT_HEAD = /* glsl */ `
  varying vec2 vBarkUv;
  uniform sampler2D uBarkColorMap;
  uniform sampler2D uBarkAOMap;
  uniform sampler2D uBarkHeightMap;
  uniform float uBarkScale;
  uniform vec3  uBarkTint;
  uniform float uBarkTintStrength;
  uniform float uBarkSaturation;
  uniform float uBarkBrightness;
  uniform float uBarkAOStrength;
  uniform float uBarkRelief;
`;
