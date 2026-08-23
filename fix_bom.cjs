const fs = require('fs');

function addBOM(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath);
    if (content.length >= 3 && content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
        // Already has BOM
        return;
    }
    const strContent = content.toString('utf8');
    fs.writeFileSync(filePath, '\uFEFF' + strContent, 'utf8');
    console.log(`Added BOM to ${filePath}`);
}

addBOM('index.html');
addBOM('src/main.js');
addBOM('TerrainEditor.js');
addBOM('src/world/BiomeManager.js');

// Also fix TerrainEditor.js corrupted strings from previous powershell replace
let te = fs.readFileSync('TerrainEditor.js', 'utf8');
te = te.replace(/Server offline \?"/g, 'Server offline —');
te = te.replace(/Git push failed \?"/g, 'Git push failed —');
fs.writeFileSync('TerrainEditor.js', te, 'utf8');

