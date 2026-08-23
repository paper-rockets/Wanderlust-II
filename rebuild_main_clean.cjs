const fs = require('fs');
let content = fs.readFileSync('old_index_utf8.html', 'utf8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('<script type="module">'));
const endIdx = lines.findIndex((l, idx) => idx > startIdx && l.includes('</script>'));

if (startIdx !== -1 && endIdx !== -1) {
    let mainJsLines = lines.slice(startIdx + 1, endIdx);
    
    // Fixes for src/main.js
    let mainJsContent = mainJsLines.join('\n');
    mainJsContent = mainJsContent.replace(/\.\/src\//g, './');
    mainJsContent = mainJsContent.replace(/import \{ initTerrainEditor \} from '\.\/TerrainEditor\.js';/g, "import { initTerrainEditor } from '../TerrainEditor.js';");
    mainJsContent = mainJsContent.replace(/import \{ composer, bloomPass, godRaysPass, summerPass, initPostProcessingUI \} from '\.\/core\/PostProcessing\.js';/g, "import { composer, renderPass, bloomPass, godRaysPass, summerPass, initPostProcessingUI } from './core/PostProcessing.js';");
    
    // Write src/main.js with UTF-8
    fs.writeFileSync('src/main.js', mainJsContent, 'utf8');
    console.log('src/main.js fully restored with UTF-8 and all path/import fixes!');
    
    // We do NOT need to overwrite index.html because index.html is already trimmed and has CSS extracted!
} else {
    console.log('Failed to find boundaries');
}
