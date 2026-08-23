const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

// 1. Add new imports at the top
const importIdx = lines.findIndex(l => l.includes("import * as THREE from 'three';"));
const newImports = `
import { scene, camera, renderer, clock } from './src/core/Engine.js';
import { composer, bloomPass, godRaysPass, summerPass, initPostProcessingUI } from './src/core/PostProcessing.js';
`;
lines.splice(importIdx + 1, 0, newImports);

let newLines = lines.join('\n').split('\n');

// 2. Remove the old inline setup
const startIdx = newLines.findIndex(l => l.includes("const container = document.getElementById('app');"));
const endIdx = newLines.findIndex(l => l.includes("// 2. LIGHTING")) - 1;

if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    const replacement = `
    initPostProcessingUI();
    // (Engine & PostProcessing initialized via modules)
    `;
    newLines.splice(startIdx, endIdx - startIdx + 1, replacement);
}

// 3. Find and remove `const clock = new THREE.Clock();`
const clockIdx = newLines.findIndex(l => l.includes('const clock = new THREE.Clock();'));
if (clockIdx !== -1) {
    newLines.splice(clockIdx, 1);
}

fs.writeFileSync('index.html', newLines.join('\n'));
console.log('Engine surgery complete');
