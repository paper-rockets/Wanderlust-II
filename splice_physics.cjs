const fs = require('fs');
let lines = fs.readFileSync('src/main.js', 'utf8').split('\n');

const firstBrake = lines.findIndex(l => l.includes('const isBraking = keys.space || touchState.brake;'));
const secondBrake = lines.findIndex((l, i) => i > firstBrake && l.includes('const isBraking = keys.space || touchState.brake;'));

if (secondBrake !== -1) {
    const end = lines.findIndex((l, i) => i > secondBrake && l.includes('camera.updateProjectionMatrix();'));
    if (end !== -1) {
        lines.splice(secondBrake, end - secondBrake + 1);
        fs.writeFileSync('src/main.js', lines.join('\n'));
        console.log('Successfully removed old physics block.');
    } else {
        console.log('End not found.');
    }
} else {
    console.log('Second brake not found.');
}
