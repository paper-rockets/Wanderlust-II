const fs = require('fs');
let lines = fs.readFileSync('src/main.js', 'utf8').split('\n');

const bStart = lines.findIndex(l => l.includes('// PROCEDURAL NOISE & MULTI-BIOMES SETUP'));
const bEnd = lines.findIndex(l => l.includes('let _mapEl = null;')) - 1; 

if (bStart !== -1 && bEnd !== -1 && bStart < bEnd) {
    lines.splice(bStart, bEnd - bStart + 1);
    fs.writeFileSync('src/main.js', lines.join('\n'));
    console.log('Successfully removed old terrain noise chunk.');
} else {
    console.log('Chunk not found or bounds invalid:', bStart, bEnd);
}
