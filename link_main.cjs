const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The inline script starts with <script type="module"> and ends with </script> right before </body>
const moduleScriptStart = html.indexOf('<script type="module">');
const bodyEnd = html.indexOf('</body>');

if (moduleScriptStart !== -1 && bodyEnd !== -1) {
    const endScript = html.lastIndexOf('</script>', bodyEnd);
    if (endScript > moduleScriptStart) {
        // Replace the whole block
        const before = html.substring(0, moduleScriptStart);
        const after = html.substring(endScript + 9);
        const newHtml = before + '<script type="module" src="/src/main.js"></script>\n' + after;
        fs.writeFileSync('index.html', newHtml, 'utf8');
        console.log('Replaced inline module script with src/main.js import.');
    } else {
        console.log('Could not find </script> tag after <script type="module">');
    }
} else {
    console.log('Could not find <script type="module"> or </body>');
}
