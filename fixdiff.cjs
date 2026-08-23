const fs = require('fs');
let buf = fs.readFileSync('diff.txt');
let str = buf.toString('utf16le');
// Fix double CR if PowerShell added it
str = str.replace(/\r\r\n/g, '\n').replace(/\r\n/g, '\n');
fs.writeFileSync('diff_fixed.txt', str, 'utf8');
console.log('Fixed diff.txt');
