const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const styleStart = html.indexOf('<style>');
const styleEnd = html.indexOf('</style>') + 8;

if (styleStart !== -1 && styleEnd !== -1) {
    const replacement = '<link rel="stylesheet" href="./src/index.css" />';
    const newHtml = html.substring(0, styleStart) + replacement + html.substring(styleEnd);
    fs.writeFileSync('index.html', newHtml);
    console.log('Successfully replaced inline style with external CSS link.');
} else {
    console.log('Style tag not found.');
}
