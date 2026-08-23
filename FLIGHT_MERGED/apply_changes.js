const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Fix sun glare
html = html.replace(/const lensflare = new Lensflare\(\);/,
\const staticSun = new THREE.Group();
staticSun.position.set(0, 1500, -20000); // Fixed world position
scene.add(staticSun);

const lensflare = new Lensflare();\);

html = html.replace(/dirLight\.add\(lensflare\);/g, 'staticSun.add(lensflare);');
html = html.replace(/dirLight\.add\(sunMesh\);/g, 'staticSun.add(sunMesh);');

// Change dirLight to point FROM static sun TO player
html = html.replace(/dirLight\.position\.set\(playerGrp\.position\.x \+ sunDistX, playerGrp\.position\.y \+ sunHeight, playerGrp\.position\.z \+ sunDistZ\);/,
\const toSun = staticSun.position.clone().sub(playerGrp.position).normalize();
dirLight.position.copy(playerGrp.position).add(toSun.multiplyScalar(2000));\);


// 2. Fix ocean sun reflections
html = html.replace(/new THREE\.MeshToonMaterial\(\{\s*color: 0x4da9e8,\s*transparent: true,\s*opacity: 0\.85\s*\}\);/m,
\
ew THREE.MeshStandardMaterial({ 
    color: 0x4da9e8, 
    transparent: true, 
    opacity: 0.85,
    roughness: 0.1,
    metalness: 0.2
});\);


// 3. Cloud Density
html = html.replace(/const CLOUD_COUNT = 50;/g, 'const CLOUD_COUNT = 200;');
html = html.replace(/const SUPER_CLOUD_COUNT = 450;/g, 'const SUPER_CLOUD_COUNT = 1200;');
html = html.replace(/const NUM_TOWERS = 18;/g, 'const NUM_TOWERS = 40;');
html = html.replace(/const BG_CLOUD_COUNT = 300;/g, 'const BG_CLOUD_COUNT = 800;');


// 4. Visible Stars during Twilight
html = html.replace(/starOp: 1\.0\}, \/\/ Twilight/g, 'starOp: 1.0}, // Twilight'); // Wait, starOp is already 1.0 in twilight? Let's check twilight star opacity. Actually, scene.fog might be hiding them. Let's make sure fog is properly faded for stars. 
html = html.replace(/moonMesh\.position\.copy\(playerGrp\.position\)\.add\(new THREE\.Vector3\(2000, 1000, -2000\)\);/, 
\moonMesh.position.copy(playerGrp.position).add(new THREE.Vector3(2000, 1000, -2000));
        starField.material.opacity = currentSky.starOp; // Ensure stars fade based on TOD\);


// 5. Remove Butterflies entirely
html = html.replace(/\/\/ Add glowing butterflies[\s\S]*?whalePod\.userData\.butterfliesMat = motesMat;/m, '');
html = html.replace(/if\s*\(whalePod\.userData\.butterfliesMat\)[\s\S]*?\}/m, '');

// 6. Whale behavior (Single whales and blue glow)
html = html.replace(/const \{ group: whale, material: wMat \} = createParticleWhale\(\);/g,
\const { group: whale, material: wMat } = createParticleWhale();
        // Add magical blue glow light to each whale!
        const whaleLight = new THREE.PointLight(0x4488ff, 1.5, 200);
        whaleLight.position.set(0, 0, 0);
        whale.add(whaleLight);
        wMat.emissive = new THREE.Color(0x113366); // Slight self-glow
        wMat.emissiveIntensity = 0.5;\);
        
// Increase frequency by reducing pod radius slightly and increasing speed
html = html.replace(/whalePod\.userData = \{[\s\S]*?\};/m,
\whalePod.userData = {
        angle: Math.random() * Math.PI * 2,
        radius: 1200 + Math.random() * 400, // Tighter orbit
        speed: 0.15 // Faster
    };\);
    
// Spawn random single whales
html = html.replace(/scene\.add\(whalePod\);/,
\scene.add(whalePod);
    const singleWhales = [];
    for(let w=0; w<4; w++) {
        const { group: sWhale, material: sMat } = createParticleWhale();
        sWhale.scale.setScalar(4 + Math.random() * 3);
        const sLight = new THREE.PointLight(0x4488ff, 1.5, 300);
        sWhale.add(sLight);
        sMat.emissive = new THREE.Color(0x113366);
        sMat.emissiveIntensity = 0.5;
        
        const wrapper = new THREE.Group();
        wrapper.add(sWhale);
        wrapper.userData = {
            angle: Math.random() * Math.PI * 2,
            radius: 800 + Math.random() * 1500,
            speed: 0.1 + Math.random() * 0.15,
            yOffset: 150 + Math.random() * 300
        };
        scene.add(wrapper);
        singleWhales.push(wrapper);
    }\);

html = html.replace(/const pod = whalePod\.userData;/, 
\singleWhales.forEach(wrapper => {
            wrapper.userData.angle += wrapper.userData.speed * dt;
            wrapper.position.x = Math.cos(wrapper.userData.angle) * wrapper.userData.radius;
            wrapper.position.z = Math.sin(wrapper.userData.angle) * wrapper.userData.radius;
            wrapper.position.y = wrapper.userData.yOffset + Math.sin(time * 0.1 + wrapper.userData.angle) * 80;
            wrapper.rotation.y = -wrapper.userData.angle + Math.PI;
            wrapper.position.add(playerGrp.position); // Follow player broadly
        });
        const pod = whalePod.userData;\);

fs.writeFileSync('index.html', html);
console.log('Changes applied');
