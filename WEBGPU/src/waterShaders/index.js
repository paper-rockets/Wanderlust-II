import { windWakerShader } from './windWaker.js';
import { windWakerDeepShader } from './windWakerDeep.js';
import { toon06Shader } from './toon06.js';
import { toon07Shader } from './toon07.js';
import { toon08Shader } from './toon08.js';

export const waterShaderRegistry = {
    'realistic': { name: 'Realistic Waves (Wanderlust Standard)' },
    'anime': { name: 'Anime Cel-Shaded (Stylized-Components Full 5-Layer System)' },
    'windWaker': windWakerShader,
    'windWakerDeep': windWakerDeepShader,
    'toon06': toon06Shader,
    'toon07': toon07Shader,
    'toon08': toon08Shader,
};

