const fs = require('fs');
let content = fs.readFileSync('old_index_utf8.html', 'utf8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('<script type="module">'));
const endIdx = lines.findLastIndex(l => l.includes('</script>'));

if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    const mainJsContent = lines.slice(startIdx + 1, endIdx).join('\n');
    fs.writeFileSync('src/main.js', mainJsContent);
    console.log('src/main.js created with ' + mainJsContent.split('\n').length + ' lines.');

    // Replace the block in index.html
    const htmlReplacement = '  <script type="module" src="./src/main.js"></script>';
    lines.splice(startIdx, endIdx - startIdx + 1, htmlReplacement);
    fs.writeFileSync('index.html', lines.join('\n'));
    console.log('index.html successfully trimmed!');
} else {
    console.log('Failed to find boundaries');
}
