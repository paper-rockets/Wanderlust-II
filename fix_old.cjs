const fs = require('fs');
let content = fs.readFileSync('old_index_utf8.html', 'utf8');
content = content.replace(/\r\n/g, '\n');
fs.writeFileSync('old_index_utf8.html', content);
